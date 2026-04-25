"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getAdminDb } from "@/lib/firebase/admin";
import { generateQaQuestion } from "@/lib/ai/generate-qa";
import { reserveDailyCall, RateLimitError } from "@/lib/ai/rate-limit";
import {
  DifficultySchema,
  QuestionSchema,
  TopicSlugSchema,
} from "@/lib/schemas/content";
import { log } from "@/lib/logger";

const InputSchema = z.object({
  topicSlug: TopicSlugSchema,
  difficulty: DifficultySchema,
  focus: z.string().trim().max(80).optional(),
});

export type GenerateQaResult =
  | { ok: true; topicSlug: string; questionId: string }
  | { ok: false; error: string };

export async function generateQaQuestionAction(
  raw: z.input<typeof InputSchema>,
): Promise<GenerateQaResult> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { topicSlug, difficulty, focus } = parsed.data;

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  try {
    await reserveDailyCall(user.uid);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  let question;
  try {
    question = await generateQaQuestion({ topicSlug, difficulty, focus });
  } catch (err) {
    log.error("qa.generate.failed", { uid: user.uid, topicSlug }, err);
    return { ok: false, error: "Generation failed. Try again." };
  }

  // Final validation before persisting.
  const safe = QuestionSchema.parse(question);

  await getAdminDb()
    .collection("topics")
    .doc(topicSlug)
    .collection("questions")
    .doc(safe.id)
    .set(safe);

  log.info("qa.generated", {
    uid: user.uid,
    topicSlug,
    difficulty,
    questionId: safe.id,
  });

  revalidatePath(`/topics/${topicSlug}`);
  return { ok: true, topicSlug, questionId: safe.id };
}
