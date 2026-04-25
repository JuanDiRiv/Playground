"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getChallenge, getExercise } from "@/lib/content/queries";
import {
  getProgressiveHint,
  HintLevelSchema,
  type HintResponse,
} from "@/lib/ai/hint";
import { reserveDailyCall, RateLimitError } from "@/lib/ai/rate-limit";
import { TopicSlugSchema } from "@/lib/schemas/content";

const InputSchema = z.object({
  source: z.enum(["exercise", "challenge"]),
  topicSlug: TopicSlugSchema,
  itemId: z.string().min(1),
  files: z.record(z.string(), z.string().max(20_000)),
  level: HintLevelSchema,
});

export type HintResult =
  | { ok: true; hint: HintResponse }
  | { ok: false; error: string };

export async function requestHintAction(
  raw: z.input<typeof InputSchema>,
): Promise<HintResult> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { source, topicSlug, itemId, files, level } = parsed.data;

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const exercise =
    source === "challenge"
      ? await getChallenge(topicSlug, itemId)
      : await getExercise(topicSlug, itemId);
  if (!exercise) return { ok: false, error: "Item not found" };

  try {
    await reserveDailyCall(user.uid);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  try {
    const hint = await getProgressiveHint(exercise, files, level);
    return { ok: true, hint };
  } catch (err) {
    console.error("getProgressiveHint failed", err);
    return { ok: false, error: "AI hint failed. Try again." };
  }
}
