/**
 * Pure helpers for streak tracking and XP awarding.
 * Kept separate from Firestore writes so the logic is unit-testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Returns YYYY-MM-DD in UTC. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function diffInDays(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs))
    return Number.POSITIVE_INFINITY;
  return Math.round((toMs - fromMs) / DAY_MS);
}

export type StreakState = {
  current: number;
  longest: number;
  lastActiveDay: string | null;
};

/** Returns the next streak state given the previous one and today's day key. */
export function advanceStreak(prev: StreakState, today: string): StreakState {
  if (prev.lastActiveDay === today) return prev;
  let nextCurrent = 1;
  if (prev.lastActiveDay) {
    const gap = diffInDays(prev.lastActiveDay, today);
    if (gap === 1) nextCurrent = prev.current + 1;
    else if (gap === 0) nextCurrent = prev.current;
    else nextCurrent = 1;
  }
  return {
    current: nextCurrent,
    longest: Math.max(prev.longest, nextCurrent),
    lastActiveDay: today,
  };
}

/**
 * XP rewards for completion events. Tunable in one place.
 * Only awarded the first time the user passes/solves the item.
 */
export const XP_REWARDS = {
  qaFirstSolve: 30,
  exerciseFirstPass: 60,
  challengeFirstPass: 90,
  challengeOnTimeBonus: 30,
  streakDailyBonus: 10,
} as const;

export type BadgeId =
  | "first-blood"
  | "streak-3"
  | "streak-7"
  | "streak-30"
  | "challenger-5"
  | "speedster-5";

export type BadgeAwardContext = {
  completedCount: number;
  streakCurrent: number;
  challengesPassed: number;
  challengesOnTime: number;
};

/** Returns the list of badge ids the user has just earned. */
export function evaluateBadges(
  prevOwned: BadgeId[],
  ctx: BadgeAwardContext,
): BadgeId[] {
  const owned = new Set(prevOwned);
  const earned: BadgeId[] = [];
  function award(id: BadgeId, condition: boolean) {
    if (condition && !owned.has(id)) {
      owned.add(id);
      earned.push(id);
    }
  }
  award("first-blood", ctx.completedCount >= 1);
  award("streak-3", ctx.streakCurrent >= 3);
  award("streak-7", ctx.streakCurrent >= 7);
  award("streak-30", ctx.streakCurrent >= 30);
  award("challenger-5", ctx.challengesPassed >= 5);
  award("speedster-5", ctx.challengesOnTime >= 5);
  return earned;
}

export const BADGE_LABEL: Record<BadgeId, string> = {
  "first-blood": "First Blood",
  "streak-3": "3-Day Streak",
  "streak-7": "7-Day Streak",
  "streak-30": "30-Day Streak",
  "challenger-5": "Challenger",
  "speedster-5": "Speedster",
};

export const BADGE_DESCRIPTION: Record<BadgeId, string> = {
  "first-blood": "Complete your first item.",
  "streak-3": "Practice 3 days in a row.",
  "streak-7": "Practice 7 days in a row.",
  "streak-30": "Practice 30 days in a row.",
  "challenger-5": "Pass 5 challenges.",
  "speedster-5": "Pass 5 challenges on time.",
};
