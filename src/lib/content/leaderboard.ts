import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

export type LeaderboardEntry = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  xp: number;
  completedCount: number;
  challengesPassed: number;
};

/**
 * Returns top users by XP. Server-only (uses Admin SDK).
 */
export async function getLeaderboard(limit = 25): Promise<LeaderboardEntry[]> {
  const snap = await getAdminDb()
    .collection("users")
    .orderBy("xp", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: doc.id,
      displayName: (d.displayName as string | null | undefined) ?? null,
      photoURL: (d.photoURL as string | null | undefined) ?? null,
      xp: (d.xp as number | undefined) ?? 0,
      completedCount: (d.completedCount as number | undefined) ?? 0,
      challengesPassed: (d.challengesPassed as number | undefined) ?? 0,
    };
  });
}
