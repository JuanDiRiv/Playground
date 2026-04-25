import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getOpenAI, MODEL_FAST } from "@/lib/ai/client";
import { reserveDailyCall, RateLimitError } from "@/lib/ai/rate-limit";
import { log } from "@/lib/logger";

/**
 * Streaming explanation endpoint. Used by:
 *  - Q&A "Explain in detail" panel (F1)
 *  - Workbench "Explain this code" mode (F3)
 *
 * Returns a `text/plain` stream of tokens as the model produces them.
 */

const InputSchema = z.object({
  mode: z.enum(["qa-explain", "code-explain"]),
  /** Free-form context: the question, the code, etc. */
  prompt: z.string().min(1).max(8000),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    await reserveDailyCall(user.uid);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    throw err;
  }

  const { mode, prompt } = parsed.data;
  const system =
    mode === "qa-explain"
      ? "You are a senior tutor. Explain the concept clearly and concisely (max ~250 words). Use plain text and short paragraphs. Avoid bullet lists unless essential."
      : "You are a senior code reviewer. Explain what the given code does, highlight any issues or improvements, and finish with a one-line summary. Plain text, short paragraphs.";

  const completion = await getOpenAI().chat.completions.create({
    model: MODEL_FAST,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        log.error("ai-stream failed", {
          uid: user.uid,
          mode,
          err: String(err),
        });
        try {
          controller.enqueue(
            encoder.encode("\n\n[stream interrupted: please retry]"),
          );
        } catch {
          // ignore
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
