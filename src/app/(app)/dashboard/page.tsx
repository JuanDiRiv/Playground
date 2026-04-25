import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/firebase/auth-server";
import {
    listChallenges,
    listExercises,
    listQuestions,
    listTopics,
} from "@/lib/content/queries";
import { getTopicSummary, type TopicSummary } from "@/lib/content/topic-progress";

const COLOR_MAP: Record<string, string> = {
    orange: "bg-orange-500/20 text-orange-300",
    blue: "bg-blue-500/20 text-blue-300",
    yellow: "bg-yellow-500/20 text-yellow-300",
    cyan: "bg-cyan-500/20 text-cyan-300",
    zinc: "bg-zinc-500/20 text-zinc-200",
    indigo: "bg-indigo-500/20 text-indigo-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
};

export default async function DashboardPage() {
    const [user, topics] = await Promise.all([
        getSessionUser(),
        listTopics(),
    ]);

    const summaries = user
        ? await Promise.all(
            topics.map(async (t) => {
                const [qa, ex, ch] = await Promise.all([
                    listQuestions(t.slug),
                    listExercises(t.slug),
                    listChallenges(t.slug),
                ]);
                return getTopicSummary(user.uid, t.slug, {
                    qa: qa.length,
                    exercises: ex.length,
                    challenges: ch.length,
                });
            }),
        )
        : [];

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-semibold tracking-tight">
                    Welcome back
                    {user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""} 👋
                </h1>
                <p className="text-fg-muted">Pick a topic to start practicing.</p>
            </header>

            {topics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-10 text-center">
                    <p className="text-fg-muted">
                        No content yet. Run{" "}
                        <code className="rounded bg-bg-muted px-1.5 py-0.5 text-fg">
                            npx tsx scripts/seed.ts
                        </code>{" "}
                        to seed initial topics.
                    </p>
                </div>
            ) : (
                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {topics.map((topic, idx) => {
                        const summary = summaries[idx];
                        return (
                            <Link
                                key={topic.slug}
                                href={`/topics/${topic.slug}`}
                                className="group flex flex-col rounded-2xl border border-border bg-bg-elevated p-5 transition hover:border-brand-500"
                            >
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`rounded-md px-2 py-1 text-xs font-bold ${COLOR_MAP[topic.color] ?? "bg-bg-muted text-fg"
                                            }`}
                                    >
                                        {topic.name}
                                    </span>
                                    <ArrowRight className="h-4 w-4 text-fg-subtle transition group-hover:text-brand-300" />
                                </div>
                                <h3 className="mt-3 font-semibold">{topic.name}</h3>
                                <p className="mt-1 line-clamp-2 text-sm text-fg-muted">
                                    {topic.description}
                                </p>
                                {summary ? <ProgressFooter summary={summary} /> : null}
                            </Link>
                        );
                    })}
                </section>
            )}
        </div>
    );
}

function ProgressFooter({ summary }: { summary: TopicSummary }) {
    const total =
        summary.qaTotal + summary.exercisesTotal + summary.challengesTotal;
    const done =
        summary.qaSolved + summary.exercisesPassed + summary.challengesPassed;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    return (
        <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-fg-muted tabular-nums">
                <span>Progress</span>
                <span>
                    {done}/{total} · {pct}%
                </span>
            </div>
            <div
                className="h-1.5 overflow-hidden rounded-full bg-bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex items-center justify-between text-[10px] text-fg-subtle tabular-nums">
                <span>
                    Q&A {summary.qaSolved}/{summary.qaTotal}
                </span>
                <span>
                    Ex {summary.exercisesPassed}/{summary.exercisesTotal}
                </span>
                <span>
                    Ch {summary.challengesPassed}/{summary.challengesTotal}
                </span>
            </div>
        </div>
    );
}
