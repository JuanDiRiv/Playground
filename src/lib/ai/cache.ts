import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { hashInput } from "@/lib/ai/cache-key";

export { hashInput };

/**
 * Stable cache for AI responses keyed by a SHA-256 hash of the canonical input.
 * Server-only: writes happen via Admin SDK and the `ai_cache` collection is
 * forbidden to clients in firestore.rules.
 */

export async function getCached<T>(key: string): Promise<T | null> {
  const doc = await getAdminDb().collection("ai_cache").doc(key).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return (data?.payload as T) ?? null;
}

export async function setCached<T>(
  key: string,
  payload: T,
  meta?: Record<string, unknown>,
): Promise<void> {
  await getAdminDb()
    .collection("ai_cache")
    .doc(key)
    .set({
      payload,
      meta: meta ?? {},
      createdAt: new Date().toISOString(),
    });
}
