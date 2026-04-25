import "server-only";
import type { Transaction } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  advanceStreak,
  dayKey,
  evaluateBadges,
  XP_REWARDS,
  type BadgeId,
  type StreakState,
} from "./gamification-logic";

export type GamificationEvent =
  | { type: "qa-solve" }
  | { type: "exercise-pass" }
  | { type: "challenge-pass"; onTime: boolean };

type UserGamificationState = {
  xp: number;
  streak: StreakState;
  badges: BadgeId[];
  completedCount: number;
  challengesPassed: number;
  challengesOnTime: number;
};

function readState(
  data: Record<string, unknown> | undefined,
): UserGamificationState {
  const streakRaw = (data?.streak ?? {}) as Partial<StreakState>;
  return {
    xp: (data?.xp as number | undefined) ?? 0,
    streak: {
      current: streakRaw.current ?? 0,
      longest: streakRaw.longest ?? 0,
      lastActiveDay: streakRaw.lastActiveDay ?? null,
    },
    badges: (data?.badges as BadgeId[] | undefined) ?? [],
    completedCount: (data?.completedCount as number | undefined) ?? 0,
    challengesPassed: (data?.challengesPassed as number | undefined) ?? 0,
    challengesOnTime: (data?.challengesOnTime as number | undefined) ?? 0,
  };
}

export type GamificationDelta = {
  xpAwarded: number;
  streak: StreakState;
  badgesEarned: BadgeId[];
};

/**
 * Updates the user's gamification fields inside an existing transaction.
 * Caller must already hold a `tx.get(userRef)` snapshot to avoid second reads
 * after writes; we accept the fresh snap as input.
 */
export async function applyGamificationInTx(
  tx: Transaction,
  uid: string,
  event: GamificationEvent & { isFirstCompletion: boolean },
  now: Date,
): Promise<GamificationDelta> {
  const userRef = getAdminDb().collection("users").doc(uid);
  const snap = await tx.get(userRef);
  const state = readState(snap.data());

  const today = dayKey(now);
  const previouslyActiveToday = state.streak.lastActiveDay === today;
  const nextStreak = advanceStreak(state.streak, today);

  let xpAwarded = 0;
  if (event.isFirstCompletion) {
    if (event.type === "qa-solve") xpAwarded += XP_REWARDS.qaFirstSolve;
    else if (event.type === "exercise-pass")
      xpAwarded += XP_REWARDS.exerciseFirstPass;
    else if (event.type === "challenge-pass") {
      xpAwarded += XP_REWARDS.challengeFirstPass;
      if (event.onTime) xpAwarded += XP_REWARDS.challengeOnTimeBonus;
    }
  }
  if (!previouslyActiveToday) xpAwarded += XP_REWARDS.streakDailyBonus;

  const challengesPassedNext =
    state.challengesPassed +
    (event.type === "challenge-pass" && event.isFirstCompletion ? 1 : 0);
  const challengesOnTimeNext =
    state.challengesOnTime +
    (event.type === "challenge-pass" && event.isFirstCompletion && event.onTime
      ? 1
      : 0);

  const completedCountNext =
    state.completedCount + (event.isFirstCompletion ? 1 : 0);

  const earned = evaluateBadges(state.badges, {
    completedCount: completedCountNext,
    streakCurrent: nextStreak.current,
    challengesPassed: challengesPassedNext,
    challengesOnTime: challengesOnTimeNext,
  });

  const update: Record<string, unknown> = {
    streak: nextStreak,
    updatedAt: now.toISOString(),
  };
  if (xpAwarded > 0) update.xp = FieldValue.increment(xpAwarded);
  if (event.isFirstCompletion) {
    update.completedCount = FieldValue.increment(1);
    if (event.type === "challenge-pass") {
      update.challengesPassed = FieldValue.increment(1);
      if (event.onTime) update.challengesOnTime = FieldValue.increment(1);
    }
  }
  if (earned.length > 0) {
    update.badges = FieldValue.arrayUnion(...earned);
  }

  tx.set(userRef, update, { merge: true });

  return { xpAwarded, streak: nextStreak, badgesEarned: earned };
}

export async function getUserGamification(
  uid: string,
): Promise<UserGamificationState> {
  const snap = await getAdminDb().collection("users").doc(uid).get();
  return readState(snap.data());
}
