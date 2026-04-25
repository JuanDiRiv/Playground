import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Hard daily quota of AI calls per user. Counter is stored at
 * `users/{uid}/ai_usage/{YYYY-MM-DD}` and incremented atomically.
 */

const DAILY_LIMIT = Number.parseInt(
  process.env.AI_DAILY_LIMIT_PER_USER ?? "50",
  10,
);

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export class RateLimitError extends Error {
  constructor(public readonly limit: number) {
    super(`Daily AI limit reached (${limit}). Try again tomorrow.`);
    this.name = "RateLimitError";
  }
}

/**
 * Reserves one AI call for the user. Throws RateLimitError if the daily
 * quota is exceeded. Uses a Firestore transaction for atomicity.
 */
export async function reserveDailyCall(uid: string): Promise<void> {
  const ref = getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("ai_usage")
    .doc(todayKey());

  await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = (snap.data()?.count as number | undefined) ?? 0;
    if (used >= DAILY_LIMIT) {
      throw new RateLimitError(DAILY_LIMIT);
    }
    tx.set(
      ref,
      { count: FieldValue.increment(1), updatedAt: new Date().toISOString() },
      { merge: true },
    );
  });
}
