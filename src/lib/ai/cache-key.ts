import { createHash } from "node:crypto";

/**
 * Stable hash for AI cache keys. Sorts keys for determinism so callers don't
 * have to worry about object insertion order. Pure: no Firebase imports here
 * so this can be unit-tested without booting Admin SDK.
 */
export function hashInput(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
