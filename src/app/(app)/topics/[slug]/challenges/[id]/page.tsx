import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Timer } from "lucide-react";
import { TopicSlugSchema } from "@/lib/schemas/content";
import { getChallenge, getTopic } from "@/lib/content/queries";
import { formatMinSec } from "@/lib/utils/format";
import { ChallengeRunner } from "./challenge-runner";

const DIFFICULTY_COLOR: Record<string, string> = {
    easy: "bg-emerald-500/15 text-emerald-300",
    medium: "bg-amber-500/15 text-amber-300",
    hard: "bg-red-500/15 text-red-300",
};

export default async function ChallengePage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;
    const parsed = TopicSlugSchema.safeParse(slug);
    if (!parsed.success) notFound();

    const [topic, challenge] = await Promise.all([
        getTopic(parsed.data),
        getChallenge(parsed.data, id),
    ]);

    if (!topic || !challenge) notFound();

    return (
        <div className="space-y-5">
            <Link
                href={`/topics/${topic.slug}?tab=challenges`}
                className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
            >
                <ArrowLeft className="h-4 w-4" /> {topic.name} · Challenges
            </Link>

            <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${DIFFICULTY_COLOR[challenge.difficulty]}`}
                    >
                        {challenge.difficulty}
                    </span>
                    <span className="rounded-md bg-bg-muted px-2 py-1 text-xs text-fg-muted">
                        {challenge.type}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-2 py-1 text-xs font-medium text-brand-300">
                        <Timer className="h-3 w-3" /> Target {formatMinSec(challenge.targetTimeSec)}
                    </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {challenge.title}
                </h1>
                <p className="text-fg-muted">{challenge.description}</p>
            </header>

            <ChallengeRunner challenge={challenge} />
        </div>
    );
}
