import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { QaFeedback } from "@/lib/ai/qa";
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
  const progressRef = userRef
    .collection("qa_progress")
    .doc(input.questionId);

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
