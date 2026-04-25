"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getQuestion } from "@/lib/content/queries";
import { evaluateQaAnswer, type QaFeedback } from "@/lib/ai/qa";
import { reserveDailyCall, RateLimitError } from "@/lib/ai/rate-limit";
import { saveQaAttempt } from "@/lib/content/progress";
import { TopicSlugSchema } from "@/lib/schemas/content";

const InputSchema = z.object({
  topicSlug: TopicSlugSchema,
  questionId: z.string().min(1),
  answer: z
    .string()
    .trim()
    .min(1, "Write something before submitting.")
    .max(4000),
});

export type EvaluateResult =
  | { ok: true; feedback: QaFeedback }
  | { ok: false; error: string };

export async function evaluateQuestionAction(
  raw: z.input<typeof InputSchema>,
): Promise<EvaluateResult> {
  const parsed = InputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { topicSlug, questionId, answer } = parsed.data;

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const question = await getQuestion(topicSlug, questionId);
  if (!question) return { ok: false, error: "Question not found" };

  try {
    await reserveDailyCall(user.uid);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  let feedback: QaFeedback;
  try {
    feedback = await evaluateQaAnswer(question, answer);
  } catch (err) {
    console.error("evaluateQaAnswer failed", err);
    return { ok: false, error: "AI evaluation failed. Try again." };
  }

  await saveQaAttempt({
    uid: user.uid,
    topicSlug,
    questionId,
    answer,
    feedback,
  });

  revalidatePath(`/topics/${topicSlug}/qa/${questionId}`);
  return { ok: true, feedback };
}
