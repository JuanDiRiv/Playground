import Image from "next/image";
import { redirect } from "next/navigation";
import { Brain, Code2, Trophy, Zap } from "lucide-react";
import { getSessionUser } from "@/lib/firebase/auth-server";
import { signOut } from "@/lib/firebase/auth-actions";
import { getUserStats } from "@/lib/content/progress";

export default async function ProfilePage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const stats = await getUserStats(user.uid);
    const aiPct = Math.min(
        100,
        Math.round((stats.aiCallsToday / Math.max(1, stats.aiDailyLimit)) * 100),
    );

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>

            <div className="flex items-center gap-4 rounded-2xl border border-border bg-bg-elevated p-5">
                {user.photoURL ? (
                    <Image
                        src={user.photoURL}
                        alt={user.displayName ?? "User avatar"}
                        width={64}
                        height={64}
                        className="rounded-full"
                    />
                ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-purple-500 text-xl font-bold text-white">
                        {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                )}
                <div>
                    <div className="font-semibold">{user.displayName ?? "Anonymous"}</div>
                    <div className="text-sm text-fg-muted">{user.email}</div>
                    <div className="mt-1 text-xs text-fg-subtle">UID: {user.uid}</div>
                </div>
            </div>

            <section className="grid gap-3 sm:grid-cols-3">
                <StatCard
                    icon={<Brain className="h-4 w-4" />}
                    label="Q&A solved"
                    value={stats.qaSolved}
                    sub={`${stats.qaAttempts} attempts`}
                />
                <StatCard
                    icon={<Code2 className="h-4 w-4" />}
                    label="Exercises passed"
                    value={stats.exercisesPassed}
                    sub={`${stats.exerciseAttempts} attempts`}
                />
                <StatCard
                    icon={<Zap className="h-4 w-4" />}
                    label="Challenges"
                    value={stats.challengesPassed}
                    sub={`${stats.challengesOnTime} on time · ${stats.challengeAttempts} attempts`}
                />
            </section>

            <section className="rounded-2xl border border-border bg-bg-elevated p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Trophy className="h-4 w-4 text-brand-300" />
                        AI calls today
                    </div>
                    <div className="text-sm tabular-nums text-fg-muted">
                        {stats.aiCallsToday} / {stats.aiDailyLimit}
                    </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-muted">
                    <div
                        className={`h-full transition-all ${aiPct >= 90
                            ? "bg-red-500"
                            : aiPct >= 70
                                ? "bg-amber-500"
                                : "bg-brand-500"
                            }`}
                        style={{ width: `${aiPct}%` }}
                    />
                </div>
                <p className="mt-2 text-xs text-fg-subtle">
                    Quota resets at midnight UTC.
                </p>
            </section>

            <form action={signOut}>
                <button
                    type="submit"
                    className="rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm font-medium text-fg transition hover:border-danger hover:text-danger"
                >
                    Sign out
                </button>
            </form>
        </div>
    );
}

function StatCard({
    icon,
    label,
    value,
    sub,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    sub: string;
}) {
    return (
        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
            <div className="flex items-center gap-2 text-xs text-fg-muted">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-500/15 text-brand-300">
                    {icon}
                </span>
                {label}
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
            <div className="mt-1 text-xs text-fg-subtle">{sub}</div>
        </div>
    );
}
