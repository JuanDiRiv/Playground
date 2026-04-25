"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getExercise } from "@/lib/content/queries";
import {
  evaluateConceptualExercise,
  type ConceptualFeedback,
} from "@/lib/ai/exercise";
import { reserveDailyCall, RateLimitError } from "@/lib/ai/rate-limit";
import {
  saveExerciseAttempt,
  type ExerciseOutcome,
} from "@/lib/content/progress";
import { TopicSlugSchema } from "@/lib/schemas/content";

const FilesSchema = z.record(z.string(), z.string().max(20_000));

const SubmitSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("worker"),
    topicSlug: TopicSlugSchema,
    exerciseId: z.string().min(1),
    files: FilesSchema,
    passed: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal("sandbox"),
    topicSlug: TopicSlugSchema,
    exerciseId: z.string().min(1),
    files: FilesSchema,
    selfReported: z.boolean(),
  }),
  z.object({
    kind: z.literal("conceptual"),
    topicSlug: TopicSlugSchema,
    exerciseId: z.string().min(1),
    files: FilesSchema,
  }),
]);

export type SubmitResult =
  | { ok: true; outcome: ExerciseOutcome; feedback?: ConceptualFeedback }
  | { ok: false; error: string };

export async function submitExerciseAction(
  raw: z.input<typeof SubmitSchema>,
): Promise<SubmitResult> {
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

  const exercise = await getExercise(data.topicSlug, data.exerciseId);
  if (!exercise) return { ok: false, error: "Exercise not found" };

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
      feedback = await evaluateConceptualExercise(exercise, data.files);
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

  await saveExerciseAttempt({
    uid: user.uid,
    topicSlug: data.topicSlug,
    exerciseId: data.exerciseId,
    files: data.files,
    outcome,
  });

  revalidatePath(`/topics/${data.topicSlug}/exercises/${data.exerciseId}`);
  return { ok: true, outcome, feedback };
}
