import Image from "next/image";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { getLeaderboard } from "@/lib/content/leaderboard";

const RANK_STYLE: Record<number, string> = {
    1: "bg-yellow-500/20 text-yellow-200 border-yellow-500/40",
    2: "bg-zinc-400/20 text-zinc-200 border-zinc-400/40",
    3: "bg-amber-700/20 text-amber-200 border-amber-700/40",
};

export default async function LeaderboardPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const entries = await getLeaderboard(25);
    const myIndex = entries.findIndex((e) => e.uid === user.uid);

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <header className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                    <Trophy className="h-3.5 w-3.5" />
                    Leaderboard
                </div>
                <h1 className="text-3xl font-semibold tracking-tight">Top learners</h1>
                <p className="text-fg-muted">
                    Ranked by total XP earned across Q&A, exercises, and challenges.
                </p>
            </header>

            {entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-bg-elevated/40 p-6 text-sm text-fg-muted">
                    No data yet. Solve some questions to appear on the board.
                </div>
            ) : (
                <ol className="space-y-2">
                    {entries.map((entry, i) => {
                        const rank = i + 1;
                        const isMe = entry.uid === user.uid;
                        return (
                            <li
                                key={entry.uid}
                                className={`flex items-center gap-3 rounded-2xl border p-4 ${isMe
                                    ? "border-brand-500/50 bg-brand-500/5"
                                    : "border-border bg-bg-elevated"
                                    }`}
                            >
                                <div
                                    className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold tabular-nums ${RANK_STYLE[rank] ?? "border-border bg-bg text-fg-muted"
                                        }`}
                                >
                                    {rank}
                                </div>
                                {entry.photoURL ? (
                                    <Image
                                        src={entry.photoURL}
                                        alt=""
                                        width={36}
                                        height={36}
                                        className="rounded-full"
                                    />
                                ) : (
                                    <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500/30 text-sm font-bold text-brand-100">
                                        {(entry.displayName ?? "?").slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium text-fg">
                                        {entry.displayName ?? "Anonymous"}
                                        {isMe ? (
                                            <span className="ml-2 rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[10px] uppercase text-brand-200">
                                                you
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="text-xs text-fg-muted">
                                        {entry.completedCount} solved · {entry.challengesPassed}{" "}
                                        challenges
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-semibold tabular-nums text-fg">
                                        {entry.xp.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-wide text-fg-subtle">
                                        XP
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {myIndex === -1 ? (
                <p className="text-center text-xs text-fg-subtle">
                    You haven&apos;t made it to the top {entries.length} yet — keep going!
                </p>
            ) : null}
        </div>
    );
}
