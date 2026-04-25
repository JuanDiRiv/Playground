/**
 * Pure progress logic. No firebase imports — safe to unit-test and import
 * from client components. The server-only persistence layer lives in
 * `@/lib/content/progress`.
 */
import type { ConceptualFeedback } from "@/lib/ai/exercise";

export type ExerciseOutcome =
  | { kind: "worker"; passed: number; total: number }
  | { kind: "conceptual"; feedback: ConceptualFeedback }
  | { kind: "sandbox"; selfReported: boolean };

/** Whether the outcome counts as "passed" for progress aggregation. */
export function isPassed(outcome: ExerciseOutcome): boolean {
  if (outcome.kind === "worker") {
    return outcome.total > 0 && outcome.passed === outcome.total;
  }
  if (outcome.kind === "conceptual") {
    return outcome.feedback.verdict === "correct";
  }
  return outcome.selfReported;
}

/** Whether a passing attempt was completed within the target time. */
export function isOnTime(
  passed: boolean,
  elapsedSec: number,
  targetSec: number,
): boolean {
  return passed && elapsedSec <= targetSec;
}

/** Best (lowest) elapsed time across passing attempts. */
export function nextBestTime(
  previousBest: number | undefined,
  newElapsed: number,
  passed: boolean,
): number | undefined {
  if (!passed) return previousBest;
  if (previousBest == null) return newElapsed;
  return Math.min(previousBest, newElapsed);
}
