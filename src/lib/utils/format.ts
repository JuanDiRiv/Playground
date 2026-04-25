/**
 * Pure formatting helpers — safe to import from client and server.
 * No `server-only` here; covered by unit tests.
 */

/** Formats a duration as `M:SS` (`75 -> "1:15"`). Negative values clamp to 0. */
export function formatMinSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Clamps a number to a closed range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Computes a percentage 0..100 (integer) from `value / total`. */
export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return clamp(Math.round((value / total) * 100), 0, 100);
}
