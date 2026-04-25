import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, Code2, Sparkles, Zap } from "lucide-react";
import { getSessionUser } from "@/lib/firebase/auth-server";
import {
    listTopics,
    listChallenges,
    listExercises,
    listQuestions,
} from "@/lib/content/queries";
import { getTopicProgress } from "@/lib/content/topic-progress";
import {
    buildPracticePlan,
    type ChallengeProgressLike,
    type ExerciseProgressLike,
    type QaProgressLike,
} from "@/lib/content/practice-plan-logic";
import { formatMinSec } from "@/lib/utils/format";

const DIFF_COLOR: Record<string, string> = {
    easy: "bg-emerald-500/15 text-emerald-300",
    medium: "bg-amber-500/15 text-amber-300",
    hard: "bg-red-500/15 text-red-300",
};

export default async function PracticePage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const topics = await listTopics();

    // Pull content + progress for every topic in parallel.
    const perTopic = await Promise.all(
        topics.map(async (t) => {
            const [questions, exercises, challenges, progress] = await Promise.all([
                listQuestions(t.slug),
                listExercises(t.slug),
                listChallenges(t.slug),
                getTopicProgress(user.uid, t.slug),
            ]);

            const qaProgress = new Map<string, QaProgressLike>();
            for (const [id, p] of progress.qa) {
                qaProgress.set(id, { questionId: id, bestScore: p.bestScore });
            }
            const exerciseProgress = new Map<string, ExerciseProgressLike>();
            for (const [id, p] of progress.exercises) {
                exerciseProgress.set(id, { exerciseId: id, passed: p.passed });
            }
            const challengeProgress = new Map<string, ChallengeProgressLike>();
            for (const [id, p] of progress.challenges) {
                challengeProgress.set(id, {
                    challengeId: id,
                    passed: p.passed,
                    onTime: p.onTime,
                });
            }

            return {
                topicSlug: t.slug,
                topicName: t.name,
                questions,
                exercises,
                challenges,
                qaProgress,
                exerciseProgress,
                challengeProgress,
            };
        }),
    );

    const plan = buildPracticePlan({ perTopic });
    const topicNameBySlug = new Map(topics.map((t) => [t.slug, t.name]));

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <header className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Daily practice
                </div>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Today&apos;s plan
                </h1>
                <p className="text-fg-muted">
                    A short, balanced set of items chosen from your weakest spots.
                </p>
            </header>

            <div className="space-y-4">
                {plan.qa ? (
                    <PlanCard
                        icon={Brain}
                        kind="Q&A"
                        topic={topicNameBySlug.get(plan.qa.topicSlug) ?? plan.qa.topicSlug}
                        title={plan.qa.question.prompt}
                        difficulty={plan.qa.question.difficulty}
                        href={`/topics/${plan.qa.topicSlug}/qa/${plan.qa.question.id}`}
                    />
                ) : (
                    <EmptyCard label="Q&A — all caught up!" />
                )}

                {plan.exercise ? (
                    <PlanCard
                        icon={Code2}
                        kind="Exercise"
                        topic={
                            topicNameBySlug.get(plan.exercise.topicSlug) ??
                            plan.exercise.topicSlug
                        }
                        title={plan.exercise.exercise.title}
                        description={plan.exercise.exercise.description}
                        difficulty={plan.exercise.exercise.difficulty}
                        href={`/topics/${plan.exercise.topicSlug}/exercises/${plan.exercise.exercise.id}`}
                    />
                ) : (
                    <EmptyCard label="Exercises — all passed!" />
                )}

                {plan.challenge ? (
                    <PlanCard
                        icon={Zap}
                        kind="Challenge"
                        topic={
                            topicNameBySlug.get(plan.challenge.topicSlug) ??
                            plan.challenge.topicSlug
                        }
                        title={plan.challenge.challenge.title}
                        description={plan.challenge.challenge.description}
                        difficulty={plan.challenge.challenge.difficulty}
                        meta={`target ${formatMinSec(plan.challenge.challenge.targetTimeSec)}`}
                        href={`/topics/${plan.challenge.topicSlug}/challenges/${plan.challenge.challenge.id}`}
                    />
                ) : (
                    <EmptyCard label="Challenges — all on-time!" />
                )}
            </div>
        </div>
    );
}

function PlanCard({
    icon: Icon,
    kind,
    topic,
    title,
    description,
    difficulty,
    meta,
    href,
}: {
    icon: typeof Brain;
    kind: string;
    topic: string;
    title: string;
    description?: string;
    difficulty: "easy" | "medium" | "hard";
    meta?: string;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="group block rounded-2xl border border-border bg-bg-elevated p-5 transition hover:border-brand-500/40 hover:bg-bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-fg-muted">
                <Icon className="h-3.5 w-3.5" />
                {kind}
                <span className="text-fg-subtle">·</span>
                <span>{topic}</span>
                <span
                    className={`ml-auto rounded-md px-2 py-0.5 text-[10px] ${DIFF_COLOR[difficulty]}`}
                >
                    {difficulty}
                </span>
            </div>
            <h2 className="mt-2 text-lg font-medium text-fg group-hover:text-brand-200">
                {title}
            </h2>
            {description ? (
                <p className="mt-1 text-sm text-fg-muted">{description}</p>
            ) : null}
            {meta ? (
                <p className="mt-2 text-xs text-fg-subtle">{meta}</p>
            ) : null}
        </Link>
    );
}

function EmptyCard({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-bg-elevated/40 p-5 text-sm text-fg-muted">
            {label}
        </div>
    );
}
