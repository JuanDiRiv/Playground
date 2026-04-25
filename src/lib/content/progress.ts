import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { QaFeedback } from "@/lib/ai/qa";
import type { ConceptualFeedback } from "@/lib/ai/exercise";
import type { TopicSlug } from "@/lib/schemas/content";

export type QaAttempt = {
  id: string;
  questionId: string;
  topicSlug: TopicSlug;
  answer: string;
  feedback: QaFeedback;
  createdAt: string;
};

/**
 * Persists a Q&A attempt under the user's subtree and updates aggregate
 * progress (best score per question + per-topic counters).
 */
export async function saveQaAttempt(input: {
  uid: string;
  topicSlug: TopicSlug;
  questionId: string;
  answer: string;
  feedback: QaFeedback;
}): Promise<QaAttempt> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(input.uid);
  const attemptRef = userRef.collection("qa_attempts").doc();
  const progressRef = userRef.collection("qa_progress").doc(input.questionId);

  const createdAt = new Date().toISOString();
  const attempt: QaAttempt = {
    id: attemptRef.id,
    questionId: input.questionId,
    topicSlug: input.topicSlug,
    answer: input.answer,
    feedback: input.feedback,
    createdAt,
  };

  await db.runTransaction(async (tx) => {
    const prev = await tx.get(progressRef);
    const previousBest = (prev.data()?.bestScore as number | undefined) ?? -1;
    const isNewSolved =
      input.feedback.verdict === "correct" && previousBest < 5;

    tx.set(attemptRef, attempt);
    tx.set(
      progressRef,
      {
        questionId: input.questionId,
        topicSlug: input.topicSlug,
        bestScore: Math.max(previousBest, input.feedback.score),
        lastVerdict: input.feedback.verdict,
        attempts: FieldValue.increment(1),
        updatedAt: createdAt,
      },
      { merge: true },
    );

    if (isNewSolved) {
      tx.set(
        userRef,
        {
          completedCount: FieldValue.increment(1),
          updatedAt: createdAt,
        },
        { merge: true },
      );
    }
  });

  return attempt;
}

export type ExerciseOutcome =
  | { kind: "worker"; passed: number; total: number }
  | { kind: "conceptual"; feedback: ConceptualFeedback }
  | { kind: "sandbox"; selfReported: boolean };

function isPassed(outcome: ExerciseOutcome): boolean {
  if (outcome.kind === "worker")
    return outcome.total > 0 && outcome.passed === outcome.total;
  if (outcome.kind === "conceptual")
    return outcome.feedback.verdict === "correct";
  return outcome.selfReported;
}

/** Persists an exercise attempt and updates aggregate progress. */
export async function saveExerciseAttempt(input: {
  uid: string;
  topicSlug: TopicSlug;
  exerciseId: string;
  files: Record<string, string>;
  outcome: ExerciseOutcome;
}): Promise<void> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(input.uid);
  const attemptRef = userRef.collection("exercise_attempts").doc();
  const progressRef = userRef
    .collection("exercise_progress")
    .doc(input.exerciseId);

  const createdAt = new Date().toISOString();
  const passed = isPassed(input.outcome);

  await db.runTransaction(async (tx) => {
    const prev = await tx.get(progressRef);
    const wasPassed = (prev.data()?.passed as boolean | undefined) ?? false;

    tx.set(attemptRef, {
      id: attemptRef.id,
      exerciseId: input.exerciseId,
      topicSlug: input.topicSlug,
      files: input.files,
      outcome: input.outcome,
      passed,
      createdAt,
    });

    tx.set(
      progressRef,
      {
        exerciseId: input.exerciseId,
        topicSlug: input.topicSlug,
        passed: wasPassed || passed,
        attempts: FieldValue.increment(1),
        updatedAt: createdAt,
      },
      { merge: true },
    );

    if (passed && !wasPassed) {
      tx.set(
        userRef,
        {
          completedCount: FieldValue.increment(1),
          updatedAt: createdAt,
        },
        { merge: true },
      );
    }
  });
}
