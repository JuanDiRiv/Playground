"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import type { Difficulty, TopicSlug } from "@/lib/schemas/content";
import { generateQaQuestionAction } from "./generate-actions";

const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

/**
 * "Generate question with AI" button shown on the Q&A tab.
 * On success, redirects to the freshly created question page.
 */
export function GenerateQaButton({ topicSlug }: { topicSlug: TopicSlug }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [difficulty, setDifficulty] = useState<Difficulty>("medium");
    const [focus, setFocus] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    function submit() {
        setError(null);
        startTransition(async () => {
            const res = await generateQaQuestionAction({
                topicSlug,
                difficulty,
                focus: focus.trim() || undefined,
            });
            if (res.ok) {
                router.push(`/topics/${res.topicSlug}/qa/${res.questionId}`);
            } else {
                setError(res.error);
            }
        });
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-200 transition hover:bg-brand-500/20"
            >
                <Sparkles className="h-3.5 w-3.5" />
                Generate with AI
            </button>
        );
    }

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-500/40 bg-brand-500/5 p-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-bg p-0.5">
                {DIFFS.map((d) => (
                    <button
                        key={d}
                        type="button"
                        onClick={() => setDifficulty(d)}
                        className={`rounded-md px-2 py-1 text-xs font-medium capitalize transition ${difficulty === d
                            ? "bg-brand-500/20 text-brand-200"
                            : "text-fg-muted hover:text-fg"
                            }`}
                    >
                        {d}
                    </button>
                ))}
            </div>
            <input
                type="text"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Optional focus (e.g. closures)"
                className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-brand-500"
                maxLength={80}
            />
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-50"
                >
                    {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Generate
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setOpen(false);
                        setError(null);
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-fg-muted hover:text-fg"
                >
                    Cancel
                </button>
            </div>
            {error ? (
                <p className="text-xs text-red-300 sm:basis-full">{error}</p>
            ) : null}
        </div>
    );
}
