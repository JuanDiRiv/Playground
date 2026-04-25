import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopicSlugSchema } from "@/lib/schemas/content";
import { getExercise, getTopic } from "@/lib/content/queries";
import { ExerciseRunner } from "./runner";

const DIFFICULTY_COLOR: Record<string, string> = {
    easy: "bg-emerald-500/15 text-emerald-300",
    medium: "bg-amber-500/15 text-amber-300",
    hard: "bg-red-500/15 text-red-300",
};

export default async function ExercisePage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;
    const parsed = TopicSlugSchema.safeParse(slug);
    if (!parsed.success) notFound();

    const [topic, exercise] = await Promise.all([
        getTopic(parsed.data),
        getExercise(parsed.data, id),
    ]);

    if (!topic || !exercise) notFound();

    return (
        <div className="space-y-5">
            <Link
                href={`/topics/${topic.slug}?tab=exercises`}
                className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
            >
                <ArrowLeft className="h-4 w-4" /> {topic.name} · Exercises
            </Link>

            <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${DIFFICULTY_COLOR[exercise.difficulty]}`}
                    >
                        {exercise.difficulty}
                    </span>
                    <span className="rounded-md bg-bg-muted px-2 py-1 text-xs text-fg-muted">
                        {exercise.type}
                    </span>
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {exercise.title}
                </h1>
                <p className="text-fg-muted">{exercise.description}</p>
            </header>

            <ExerciseRunner exercise={exercise} />
        </div>
    );
}
