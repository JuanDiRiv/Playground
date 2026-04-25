"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lightbulb, Loader2, XCircle } from "lucide-react";
import type { TopicSlug } from "@/lib/schemas/content";
import type { QaFeedback } from "@/lib/ai/qa";
import { evaluateQuestionAction } from "./actions";

const VERDICT_STYLE: Record<
    QaFeedback["verdict"],
    { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
    correct: {
        label: "Correct",
        className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
        Icon: CheckCircle2,
    },
    partial: {
        label: "Partial",
        className: "border-amber-500/40 bg-amber-500/10 text-amber-200",
        Icon: Lightbulb,
    },
    incorrect: {
        label: "Incorrect",
        className: "border-red-500/40 bg-red-500/10 text-red-200",
        Icon: XCircle,
    },
};

export function QaAnswerForm({
    topicSlug,
    questionId,
    modelAnswer,
    hint,
}: {
    topicSlug: TopicSlug;
    questionId: string;
    modelAnswer: string;
    hint?: string;
}) {
    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState<QaFeedback | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [showModel, setShowModel] = useState(false);
    const [isPending, startTransition] = useTransition();

    function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setFeedback(null);
        startTransition(async () => {
            const result = await evaluateQuestionAction({
                topicSlug,
                questionId,
                answer,
            });
            if (result.ok) {
                setFeedback(result.feedback);
            } else {
                setError(result.error);
            }
        });
    }

    return (
        <div className="space-y-6">
            <form onSubmit={onSubmit} className="space-y-3">
                <label className="block text-sm font-medium text-fg-muted">
                    Your answer
                </label>
                <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={isPending}
                    rows={8}
                    placeholder="Write your answer in your own words…"
                    className="w-full resize-y rounded-xl border border-border bg-bg-elevated p-4 text-sm leading-relaxed text-fg outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="submit"
                        disabled={isPending || answer.trim().length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Evaluating…
                            </>
                        ) : (
                            "Submit for AI feedback"
                        )}
                    </button>
                    {hint ? (
                        <button
                            type="button"
                            onClick={() => setShowHint((v) => !v)}
                            className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-fg-muted hover:text-fg"
                        >
                            {showHint ? "Hide hint" : "Show hint"}
                        </button>
                    ) : null}
                </div>
            </form>

            {showHint && hint ? (
                <div className="rounded-xl border border-border bg-bg-elevated p-4 text-sm text-fg-muted">
                    <span className="font-medium text-fg">Hint:</span> {hint}
                </div>
            ) : null}

            {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {feedback ? <FeedbackCard feedback={feedback} /> : null}

            <div className="rounded-xl border border-border bg-bg-elevated p-4">
                <button
                    type="button"
                    onClick={() => setShowModel((v) => !v)}
                    className="text-sm font-medium text-fg-muted hover:text-fg"
                >
                    {showModel ? "Hide reference answer" : "Show reference answer"}
                </button>
                {showModel ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">
                        {modelAnswer}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function FeedbackCard({ feedback }: { feedback: QaFeedback }) {
    const v = VERDICT_STYLE[feedback.verdict];
    const Icon = v.Icon;
    return (
        <div className={`space-y-4 rounded-2xl border p-5 ${v.className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    <Icon className="h-5 w-5" />
                    {v.label}
                </div>
                <div className="text-sm font-medium tabular-nums">
                    {feedback.score} / 5
                </div>
            </div>

            {feedback.strengths.length > 0 ? (
                <Section title="Strengths" items={feedback.strengths} bullet="✓" />
            ) : null}
            {feedback.gaps.length > 0 ? (
                <Section title="Gaps" items={feedback.gaps} bullet="•" />
            ) : null}

            <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    Suggestion
                </div>
                <p className="mt-1 text-sm leading-relaxed">{feedback.suggestion}</p>
            </div>
        </div>
    );
}

function Section({
    title,
    items,
    bullet,
}: {
    title: string;
    items: string[];
    bullet: string;
}) {
    return (
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                {title}
            </div>
            <ul className="mt-1 space-y-1 text-sm">
                {items.map((it, i) => (
                    <li key={i} className="flex gap-2">
                        <span className="opacity-60">{bullet}</span>
                        <span>{it}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
