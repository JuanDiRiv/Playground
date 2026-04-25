"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getChallenge } from "@/lib/content/queries";
import {
  evaluateConceptualExercise,
  type ConceptualFeedback,
} from "@/lib/ai/exercise";
import { reserveDailyCall, RateLimitError } from "@/lib/ai/rate-limit";
import {
  saveChallengeAttempt,
  type ExerciseOutcome,
} from "@/lib/content/progress";
import { TopicSlugSchema } from "@/lib/schemas/content";

const FilesSchema = z.record(z.string(), z.string().max(20_000));

const SubmitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("worker"),
    topicSlug: TopicSlugSchema,
    challengeId: z.string().min(1),
    files: FilesSchema,
    passed: z.number().int().min(0),
    total: z.number().int().min(0),
    elapsedSec: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("sandbox"),
    topicSlug: TopicSlugSchema,
    challengeId: z.string().min(1),
    files: FilesSchema,
    selfReported: z.boolean(),
    elapsedSec: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("conceptual"),
    topicSlug: TopicSlugSchema,
    challengeId: z.string().min(1),
    files: FilesSchema,
    elapsedSec: z.number().int().min(0),
  }),
]);

export type SubmitChallengeResult =
  | {
      ok: true;
      outcome: ExerciseOutcome;
      feedback?: ConceptualFeedback;
      onTime: boolean;
      elapsedSec: number;
      targetTimeSec: number;
    }
  | { ok: false; error: string };

export async function submitChallengeAction(
  raw: z.input<typeof SubmitSchema>,
): Promise<SubmitChallengeResult> {
  const parsed = SubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const challenge = await getChallenge(data.topicSlug, data.challengeId);
  if (!challenge) return { ok: false, error: "Challenge not found" };

  let outcome: ExerciseOutcome;
  let feedback: ConceptualFeedback | undefined;

  if (data.kind === "conceptual") {
    try {
      await reserveDailyCall(user.uid);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { ok: false, error: err.message };
      }
      throw err;
    }
    try {
      feedback = await evaluateConceptualExercise(challenge, data.files);
    } catch (err) {
      console.error("evaluateConceptualExercise failed", err);
      return { ok: false, error: "AI evaluation failed. Try again." };
    }
    outcome = { kind: "conceptual", feedback };
  } else if (data.kind === "worker") {
    outcome = { kind: "worker", passed: data.passed, total: data.total };
  } else {
    outcome = { kind: "sandbox", selfReported: data.selfReported };
  }

  await saveChallengeAttempt({
    uid: user.uid,
    topicSlug: data.topicSlug,
    challengeId: data.challengeId,
    files: data.files,
    outcome,
    elapsedSec: data.elapsedSec,
    targetTimeSec: challenge.targetTimeSec,
  });

  const passed =
    (outcome.kind === "worker" &&
      outcome.total > 0 &&
      outcome.passed === outcome.total) ||
    (outcome.kind === "conceptual" && outcome.feedback.verdict === "correct") ||
    (outcome.kind === "sandbox" && outcome.selfReported);
  const onTime = passed && data.elapsedSec <= challenge.targetTimeSec;

  revalidatePath(`/topics/${data.topicSlug}/challenges/${data.challengeId}`);
  return {
    ok: true,
    outcome,
    feedback,
    onTime,
    elapsedSec: data.elapsedSec,
    targetTimeSec: challenge.targetTimeSec,
  };
}
