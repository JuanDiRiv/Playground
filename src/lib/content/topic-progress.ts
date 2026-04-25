import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Aggregated progress lookup tables for a single user, used by topic listings
 * to color/filter items by status.
 */
export type TopicProgress = {
  qa: Map<string, { bestScore: number; lastVerdict: string }>;
  exercises: Map<string, { passed: boolean }>;
  challenges: Map<
    string,
    { passed: boolean; onTime: boolean; bestTimeSec: number | null }
  >;
};

export async function getTopicProgress(
  uid: string,
  topicSlug: string,
): Promise<TopicProgress> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);

  const [qaSnap, exSnap, chSnap] = await Promise.all([
    userRef.collection("qa_progress").where("topicSlug", "==", topicSlug).get(),
    userRef
      .collection("exercise_progress")
      .where("topicSlug", "==", topicSlug)
      .get(),
    userRef
      .collection("challenge_progress")
      .where("topicSlug", "==", topicSlug)
      .get(),
  ]);

  const qa = new Map<string, { bestScore: number; lastVerdict: string }>();
  for (const d of qaSnap.docs) {
    const data = d.data();
    qa.set(d.id, {
      bestScore: (data.bestScore as number | undefined) ?? 0,
      lastVerdict: (data.lastVerdict as string | undefined) ?? "",
    });
  }

  const exercises = new Map<string, { passed: boolean }>();
  for (const d of exSnap.docs) {
    exercises.set(d.id, {
      passed: (d.data().passed as boolean | undefined) ?? false,
    });
  }

  const challenges = new Map<
    string,
    { passed: boolean; onTime: boolean; bestTimeSec: number | null }
  >();
  for (const d of chSnap.docs) {
    const data = d.data();
    challenges.set(d.id, {
      passed: (data.passed as boolean | undefined) ?? false,
      onTime: (data.onTime as boolean | undefined) ?? false,
      bestTimeSec: (data.bestTimeSec as number | null | undefined) ?? null,
    });
  }

  return { qa, exercises, challenges };
}

/**
 * Per-topic completion summary used in the dashboard cards.
 */
export type TopicSummary = {
  qaSolved: number;
  qaTotal: number;
  exercisesPassed: number;
  exercisesTotal: number;
  challengesPassed: number;
  challengesTotal: number;
};

export async function getTopicSummary(
  uid: string,
  topicSlug: string,
  totals: { qa: number; exercises: number; challenges: number },
): Promise<TopicSummary> {
  const progress = await getTopicProgress(uid, topicSlug);
  let qaSolved = 0;
  for (const v of progress.qa.values()) {
    if (v.bestScore === 5) qaSolved += 1;
  }
  let exercisesPassed = 0;
  for (const v of progress.exercises.values()) {
    if (v.passed) exercisesPassed += 1;
  }
  let challengesPassed = 0;
  for (const v of progress.challenges.values()) {
    if (v.passed) challengesPassed += 1;
  }
  return {
    qaSolved,
    qaTotal: totals.qa,
    exercisesPassed,
    exercisesTotal: totals.exercises,
    challengesPassed,
    challengesTotal: totals.challenges,
  };
}
