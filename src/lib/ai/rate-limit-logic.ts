/**
 * Pure helpers for the daily AI rate limiter. Kept free of any Firebase
 * imports so they can be unit-tested without the Admin SDK.
 */

/** YYYY-MM-DD key derived from a Date in UTC. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Returns true when the user has hit (or exceeded) the daily quota. */
export function isOverLimit(used: number, limit: number): boolean {
  return used >= limit;
}

/** Remaining calls left in the day, never negative. */
export function remaining(used: number, limit: number): number {
  return Math.max(0, limit - used);
}

export class RateLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Daily AI limit reached (${limit}). Try again tomorrow.`);
    this.name = "RateLimitError";
  }
}
