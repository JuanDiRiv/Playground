import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { QaFeedback } from "@/lib/ai/qa";
import type { TopicSlug } from "@/lib/schemas/content";
import { isPassed, type ExerciseOutcome } from "@/lib/content/progress-logic";
import { applyGamificationInTx } from "@/lib/content/gamification";

export type { ExerciseOutcome };

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

    await applyGamificationInTx(
      tx,
      input.uid,
      { type: "qa-solve", isFirstCompletion: isNewSolved },
      new Date(createdAt),
    );

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
  });

  return attempt;
}

// ExerciseOutcome + isPassed live in `./progress-logic` (pure, unit-tested).

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
    const isFirstCompletion = passed && !wasPassed;

    await applyGamificationInTx(
      tx,
      input.uid,
      { type: "exercise-pass", isFirstCompletion },
      new Date(createdAt),
    );

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
  });
}

/** Persists a challenge attempt with timing info and updates aggregate progress. */
export async function saveChallengeAttempt(input: {
  uid: string;
  topicSlug: TopicSlug;
  challengeId: string;
  files: Record<string, string>;
  outcome: ExerciseOutcome;
  elapsedSec: number;
  targetTimeSec: number;
}): Promise<void> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(input.uid);
  const attemptRef = userRef.collection("challenge_attempts").doc();
  const progressRef = userRef
    .collection("challenge_progress")
    .doc(input.challengeId);

  const createdAt = new Date().toISOString();
  const passed = isPassed(input.outcome);
  const onTime = passed && input.elapsedSec <= input.targetTimeSec;

  await db.runTransaction(async (tx) => {
    const prev = await tx.get(progressRef);
    const wasPassed = (prev.data()?.passed as boolean | undefined) ?? false;
    const wasOnTime = (prev.data()?.onTime as boolean | undefined) ?? false;
    const previousBestSec = prev.data()?.bestTimeSec as number | undefined;
    const nextBestSec = passed
      ? Math.min(previousBestSec ?? Number.POSITIVE_INFINITY, input.elapsedSec)
      : previousBestSec;
    const isFirstCompletion = passed && !wasPassed;

    await applyGamificationInTx(
      tx,
      input.uid,
      { type: "challenge-pass", isFirstCompletion, onTime },
      new Date(createdAt),
    );

    tx.set(attemptRef, {
      id: attemptRef.id,
      challengeId: input.challengeId,
      topicSlug: input.topicSlug,
      files: input.files,
      outcome: input.outcome,
      elapsedSec: input.elapsedSec,
      targetTimeSec: input.targetTimeSec,
      passed,
      onTime,
      createdAt,
    });

    tx.set(
      progressRef,
      {
        challengeId: input.challengeId,
        topicSlug: input.topicSlug,
        passed: wasPassed || passed,
        onTime: wasOnTime || onTime,
        bestTimeSec: nextBestSec ?? null,
        attempts: FieldValue.increment(1),
        updatedAt: createdAt,
      },
      { merge: true },
    );
  });
}

export type UserStats = {
  qaSolved: number;
  qaAttempts: number;
  exercisesPassed: number;
  exerciseAttempts: number;
  challengesPassed: number;
  challengesOnTime: number;
  challengeAttempts: number;
  aiCallsToday: number;
  aiDailyLimit: number;
};

/**
 * Aggregates user progress across Q&A, exercises and challenges.
 * Reads only progress docs (not full attempt history) for efficiency.
 */
export async function getUserStats(uid: string): Promise<UserStats> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const todayKey = new Date().toISOString().slice(0, 10);

  const [qaSnap, exSnap, chSnap, usageSnap] = await Promise.all([
    userRef.collection("qa_progress").get(),
    userRef.collection("exercise_progress").get(),
    userRef.collection("challenge_progress").get(),
    userRef.collection("ai_usage").doc(todayKey).get(),
  ]);

  let qaSolved = 0;
  let qaAttempts = 0;
  for (const d of qaSnap.docs) {
    const data = d.data();
    if ((data.bestScore as number | undefined) === 5) qaSolved += 1;
    qaAttempts += (data.attempts as number | undefined) ?? 0;
  }

  let exercisesPassed = 0;
  let exerciseAttempts = 0;
  for (const d of exSnap.docs) {
    const data = d.data();
    if (data.passed === true) exercisesPassed += 1;
    exerciseAttempts += (data.attempts as number | undefined) ?? 0;
  }

  let challengesPassed = 0;
  let challengesOnTime = 0;
  let challengeAttempts = 0;
  for (const d of chSnap.docs) {
    const data = d.data();
    if (data.passed === true) challengesPassed += 1;
    if (data.onTime === true) challengesOnTime += 1;
    challengeAttempts += (data.attempts as number | undefined) ?? 0;
  }

  return {
    qaSolved,
    qaAttempts,
    exercisesPassed,
    exerciseAttempts,
    challengesPassed,
    challengesOnTime,
    challengeAttempts,
    aiCallsToday: (usageSnap.data()?.count as number | undefined) ?? 0,
    aiDailyLimit: Number.parseInt(
      process.env.AI_DAILY_LIMIT_PER_USER ?? "50",
      10,
    ),
  };
}
