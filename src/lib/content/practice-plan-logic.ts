import type {
  Challenge,
  Difficulty,
  Exercise,
  Question,
  TopicSlug,
} from "@/lib/schemas/content";

export type QaProgressLike = {
  questionId: string;
  bestScore: number;
};

export type ExerciseProgressLike = {
  exerciseId: string;
  passed: boolean;
};

export type ChallengeProgressLike = {
  challengeId: string;
  passed: boolean;
  onTime?: boolean;
};

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/**
 * Picks the next Q&A question to practice. Prefers, in order:
 *   1) Unattempted questions
 *   2) Questions with the lowest bestScore (i.e. weakest)
 *   3) Within ties, harder difficulty first
 *   4) Stable: lexicographic id
 */
export function pickQaTarget(
  questions: Question[],
  progressById: Map<string, QaProgressLike>,
): Question | null {
  if (questions.length === 0) return null;
  // Filter out fully-solved (bestScore === 5).
  const candidates = questions.filter((q) => {
    const p = progressById.get(q.id);
    return !p || p.bestScore < 5;
  });
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const sa = progressById.get(a.id)?.bestScore ?? -1; // unattempted -> -1 (highest priority)
    const sb = progressById.get(b.id)?.bestScore ?? -1;
    if (sa !== sb) return sa - sb;
    const da = DIFFICULTY_WEIGHT[a.difficulty];
    const db = DIFFICULTY_WEIGHT[b.difficulty];
    if (da !== db) return db - da;
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Picks the next exercise to practice: any not-yet-passed; harder first.
 */
export function pickExerciseTarget(
  exercises: Exercise[],
  progressById: Map<string, ExerciseProgressLike>,
): Exercise | null {
  const candidates = exercises.filter((e) => !progressById.get(e.id)?.passed);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const da = DIFFICULTY_WEIGHT[a.difficulty];
    const db = DIFFICULTY_WEIGHT[b.difficulty];
    if (da !== db) return db - da;
    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Picks the next challenge to practice. Prefers ones not passed at all,
 * then ones passed but not on-time, then easier (warm-up) first.
 */
export function pickChallengeTarget(
  challenges: Challenge[],
  progressById: Map<string, ChallengeProgressLike>,
): Challenge | null {
  if (challenges.length === 0) return null;
  function rank(c: Challenge): number {
    const p = progressById.get(c.id);
    if (!p) return 0; // never attempted
    if (!p.passed) return 1;
    if (!p.onTime) return 2;
    return 3; // already passed on time
  }
  const minRank = Math.min(...challenges.map(rank));
  if (minRank === 3) return null;
  const candidates = challenges.filter((c) => rank(c) === minRank);
  return [...candidates].sort((a, b) => {
    const da = DIFFICULTY_WEIGHT[a.difficulty];
    const db = DIFFICULTY_WEIGHT[b.difficulty];
    if (da !== db) return da - db; // easier first
    return a.id.localeCompare(b.id);
  })[0];
}

export type PracticePlan = {
  qa: { topicSlug: TopicSlug; question: Question } | null;
  exercise: { topicSlug: TopicSlug; exercise: Exercise } | null;
  challenge: { topicSlug: TopicSlug; challenge: Challenge } | null;
};

/**
 * Picks one Q&A, one exercise, and one challenge across all topics.
 * For each category, evaluates per-topic candidates and chooses the topic
 * whose target has the highest "priority" (lowest score, otherwise hardest).
 */
export function buildPracticePlan(input: {
  perTopic: Array<{
    topicSlug: TopicSlug;
    questions: Question[];
    exercises: Exercise[];
    challenges: Challenge[];
    qaProgress: Map<string, QaProgressLike>;
    exerciseProgress: Map<string, ExerciseProgressLike>;
    challengeProgress: Map<string, ChallengeProgressLike>;
  }>;
}): PracticePlan {
  let qa: PracticePlan["qa"] = null;
  let exercise: PracticePlan["exercise"] = null;
  let challenge: PracticePlan["challenge"] = null;

  // Q&A: pick globally weakest.
  let bestQaScore = Infinity;
  for (const t of input.perTopic) {
    const q = pickQaTarget(t.questions, t.qaProgress);
    if (!q) continue;
    const s = t.qaProgress.get(q.id)?.bestScore ?? -1;
    if (s < bestQaScore) {
      bestQaScore = s;
      qa = { topicSlug: t.topicSlug, question: q };
    }
  }

  // Exercise: first topic with an unpassed one (ordered by topic).
  for (const t of input.perTopic) {
    const e = pickExerciseTarget(t.exercises, t.exerciseProgress);
    if (e) {
      exercise = { topicSlug: t.topicSlug, exercise: e };
      break;
    }
  }

  // Challenge: first topic with an unpassed-or-not-on-time one.
  for (const t of input.perTopic) {
    const c = pickChallengeTarget(t.challenges, t.challengeProgress);
    if (c) {
      challenge = { topicSlug: t.topicSlug, challenge: c };
      break;
    }
  }

  return { qa, exercise, challenge };
}
