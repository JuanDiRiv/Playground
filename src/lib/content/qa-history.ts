import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import type { TopicSlug } from "@/lib/schemas/content";

export type DailyScorePoint = {
  /** YYYY-MM-DD (UTC). */
  day: string;
  /** Average score (0-5) of all Q&A attempts that day. */
  avgScore: number;
  /** Number of attempts that day. */
  attempts: number;
};

/**
 * Returns daily average Q&A scores for a user on a given topic, for the last
 * `days` days (UTC). Days with no attempts are filled with `attempts: 0`.
 */
export async function getQaHistory(
  uid: string,
  topicSlug: TopicSlug,
  days = 30,
): Promise<DailyScorePoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const snap = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("qa_attempts")
    .where("topicSlug", "==", topicSlug)
    .where("createdAt", ">=", since.toISOString())
    .get();

  // Aggregate per day (UTC).
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const doc of snap.docs) {
    const data = doc.data() as {
      createdAt?: string;
      feedback?: { score?: number };
    };
    const score = data.feedback?.score;
    const createdAt = data.createdAt;
    if (typeof score !== "number" || !createdAt) continue;
    const day = createdAt.slice(0, 10); // YYYY-MM-DD from ISO string
    const cur = buckets.get(day) ?? { sum: 0, count: 0 };
    cur.sum += score;
    cur.count += 1;
    buckets.set(day, cur);
  }

  // Build a continuous series for the requested window.
  const out: DailyScorePoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    const b = buckets.get(day);
    out.push({
      day,
      attempts: b?.count ?? 0,
      avgScore: b && b.count > 0 ? b.sum / b.count : 0,
    });
  }
  return out;
}
