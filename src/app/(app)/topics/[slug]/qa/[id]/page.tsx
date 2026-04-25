import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopicSlugSchema } from "@/lib/schemas/content";
import { getQuestion, getTopic } from "@/lib/content/queries";
import { QaAnswerForm } from "./qa-form";

const DIFFICULTY_COLOR: Record<string, string> = {
    easy: "bg-emerald-500/15 text-emerald-300",
    medium: "bg-amber-500/15 text-amber-300",
    hard: "bg-red-500/15 text-red-300",
};

export default async function QaQuestionPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { slug, id } = await params;
    const parsed = TopicSlugSchema.safeParse(slug);
    if (!parsed.success) notFound();

    const [topic, question] = await Promise.all([
        getTopic(parsed.data),
        getQuestion(parsed.data, id),
    ]);

    if (!topic || !question) notFound();

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <Link
                href={`/topics/${topic.slug}?tab=qa`}
                className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
            >
                <ArrowLeft className="h-4 w-4" /> {topic.name} · Q&A
            </Link>

            <header className="space-y-3">
                <span
                    className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${DIFFICULTY_COLOR[question.difficulty]}`}
                >
                    {question.difficulty}
                </span>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {question.prompt}
                </h1>
                {question.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {question.tags.map((t) => (
                            <span
                                key={t}
                                className="rounded-full bg-bg-muted px-2 py-0.5 text-xs text-fg-muted"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                ) : null}
            </header>

            <QaAnswerForm
                topicSlug={topic.slug}
                questionId={question.id}
                modelAnswer={question.modelAnswer}
                hint={question.hint}
            />
        </div>
    );
}
