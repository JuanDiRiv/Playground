"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
    CheckCircle2,
    Lightbulb,
    Loader2,
    Play,
    RotateCcw,
    Send,
    Sparkles,
    XCircle,
} from "lucide-react";
import { transform } from "sucrase";
import type { Exercise } from "@/lib/schemas/content";
import type { ConceptualFeedback } from "@/lib/ai/exercise";
import { requestHintAction } from "@/lib/ai/hint-action";
import type { HintLevel, HintResponse } from "@/lib/ai/hint";
import { useToast } from "@/components/toast";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full items-center justify-center text-sm text-fg-muted">
            Loading editor…
        </div>
    ),
});

export type TestResult = { name: string; ok: boolean; error?: string };

export type WorkbenchSubmit =
    | {
        kind: "worker";
        files: Record<string, string>;
        passed: number;
        total: number;
        results: TestResult[];
    }
    | { kind: "sandbox"; files: Record<string, string> }
    | { kind: "conceptual"; files: Record<string, string> };

export type WorkbenchSubmitResult = {
    ok: boolean;
    error?: string;
    info?: string;
    feedback?: ConceptualFeedback;
};

const LANG_BY_EXT: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
};

function languageFor(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return LANG_BY_EXT[ext] ?? "plaintext";
}

function isTsLike(filename: string): boolean {
    return /\.(ts|tsx)$/.test(filename);
}

function compileForWorker(filename: string, source: string): string {
    if (!isTsLike(filename)) return source;
    const result = transform(source, {
        transforms: ["typescript", "jsx"],
        production: true,
    });
    return result.code;
}

export function Workbench({
    item,
    source,
    onSubmit,
    submitLabel,
    headerExtra,
    disableSubmit,
}: {
    item: Exercise;
    source: "exercise" | "challenge";
    onSubmit: (payload: WorkbenchSubmit) => Promise<WorkbenchSubmitResult>;
    submitLabel: string;
    headerExtra?: ReactNode;
    disableSubmit?: boolean;
}) {
    const filenames = useMemo(() => Object.keys(item.starter), [item]);
    const [files, setFiles] = useState<Record<string, string>>(item.starter);
    const [activeFile, setActiveFile] = useState<string>(filenames[0] ?? "");
    const [results, setResults] = useState<TestResult[] | null>(null);
    const [runError, setRunError] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [feedback, setFeedback] = useState<ConceptualFeedback | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitInfo, setSubmitInfo] = useState<string | null>(null);
    const [isSubmitting, startSubmit] = useTransition();

    const [hint, setHint] = useState<HintResponse | null>(null);
    const [hintError, setHintError] = useState<string | null>(null);
    const [hintLevel, setHintLevel] = useState<HintLevel>(1);
    const [loadingHint, startHint] = useTransition();

    // Which pane is visible on mobile (lg+ shows both side-by-side).
    const [mobilePane, setMobilePane] = useState<"editor" | "output">("editor");

    // ---- Explain code (F3) ----
    const [explanation, setExplanation] = useState<string>("");
    const [explaining, setExplaining] = useState(false);
    const [explainError, setExplainError] = useState<string | null>(null);
    const [showExplain, setShowExplain] = useState(false);

    const toast = useToast();

    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

    // ---- Keyboard shortcuts ----
    // Ctrl/Cmd+Enter -> run tests (worker) | Ctrl/Cmd+S -> submit
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            if (e.key === "Enter" && item.type === "worker") {
                e.preventDefault();
                runTestsRef.current?.();
            } else if (e.key.toLowerCase() === "s") {
                e.preventDefault();
                submitRef.current?.();
            }
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [item.type]);

    const runTestsRef = useRef<() => void>(undefined);
    const submitRef = useRef<() => void>(undefined);

    function updateFile(name: string, value: string) {
        setFiles((prev) => ({ ...prev, [name]: value }));
    }

    function reset() {
        setFiles(item.starter);
        setResults(null);
        setRunError(null);
        setFeedback(null);
        setSubmitError(null);
        setSubmitInfo(null);
        setHint(null);
        setHintError(null);
        setHintLevel(1);
    }

    async function explainCode() {
        const code = files[activeFile] ?? "";
        if (!code.trim()) {
            setExplainError("File is empty.");
            setShowExplain(true);
            return;
        }
        setExplainError(null);
        setExplanation("");
        setExplaining(true);
        setShowExplain(true);
        try {
            const res = await fetch("/api/ai/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "code-explain",
                    prompt: `File: ${activeFile}\nExercise: ${item.title}\n\n\`\`\`\n${code}\n\`\`\``,
                }),
            });
            if (!res.ok || !res.body) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? `Stream failed (${res.status})`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                setExplanation((prev) => prev + decoder.decode(value, { stream: true }));
            }
        } catch (e) {
            setExplainError(e instanceof Error ? e.message : "Stream failed");
        } finally {
            setExplaining(false);
        }
    }

    // ---- Sandbox preview ----
    const sandboxSrcDoc = useMemo(() => {
        if (item.type !== "sandbox") return "";
        const html = files["index.html"] ?? "";
        const css = files["styles.css"] ?? "";
        return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${html}</body></html>`;
    }, [item.type, files]);

    // ---- Worker tests ----
    function runTests() {
        if (item.type !== "worker") return;
        setRunError(null);
        setResults(null);
        setRunning(true);
        setMobilePane("output");

        let code = "";
        try {
            code = Object.entries(files)
                .map(([name, body]) => compileForWorker(name, body))
                .join("\n;\n");
        } catch (err) {
            setRunError(`Compile error: ${(err as Error).message}`);
            setRunning(false);
            return;
        }

        workerRef.current?.terminate();
        const worker = new Worker("/exercise-runner.worker.js");
        workerRef.current = worker;

        const timeout = setTimeout(() => {
            worker.terminate();
            workerRef.current = null;
            setRunError("Timed out after 5s. Possible infinite loop?");
            setRunning(false);
        }, 5000);

        worker.onmessage = (e: MessageEvent) => {
            clearTimeout(timeout);
            const data = e.data as
                | { type: "done"; results: TestResult[] }
                | { type: "error"; error: string };
            if (data.type === "done") {
                setResults(data.results);
            } else {
                setRunError(data.error);
            }
            setRunning(false);
            worker.terminate();
            workerRef.current = null;
        };
        worker.onerror = (err) => {
            clearTimeout(timeout);
            setRunError(err.message || "Worker error");
            setRunning(false);
            worker.terminate();
            workerRef.current = null;
        };

        worker.postMessage({ code, tests: item.tests });
    }

    // ---- Submit ----
    function submit() {
        setSubmitError(null);
        setSubmitInfo(null);
        setFeedback(null);
        setMobilePane("output");

        startSubmit(async () => {
            let payload: WorkbenchSubmit;
            if (item.type === "worker") {
                if (!results) {
                    setSubmitError("Run the tests first.");
                    return;
                }
                const passed = results.filter((r) => r.ok).length;
                payload = {
                    kind: "worker",
                    files,
                    passed,
                    total: results.length,
                    results,
                };
            } else if (item.type === "sandbox") {
                payload = { kind: "sandbox", files };
            } else {
                payload = { kind: "conceptual", files };
            }

            const res = await onSubmit(payload);
            if (!res.ok) {
                setSubmitError(res.error ?? "Submission failed");
                toast.error("Submission failed", res.error);
                return;
            }
            if (res.feedback) setFeedback(res.feedback);
            if (res.info) {
                setSubmitInfo(res.info);
                toast.success("Saved", res.info);
            } else {
                toast.success("Saved");
            }
        });
    }

    // Bind shortcut refs to current functions
    runTestsRef.current = runTests;
    submitRef.current = submit;

    // ---- Hint ----
    function requestHint(level: HintLevel) {
        setHintError(null);
        setHint(null);
        setHintLevel(level);
        startHint(async () => {
            const res = await requestHintAction({
                source,
                topicSlug: item.topicSlug,
                itemId: item.id,
                files,
                level,
            });
            if (!res.ok) setHintError(res.error);
            else setHint(res.hint);
        });
    }

    return (
        <div className="space-y-4">
            {/* Mobile pane toggle (hidden on lg+) */}
            <div
                className="flex gap-1 rounded-xl border border-border bg-bg-elevated p-1 lg:hidden"
                role="tablist"
                aria-label="Workbench panes"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={mobilePane === "editor"}
                    onClick={() => setMobilePane("editor")}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${mobilePane === "editor"
                        ? "bg-bg text-fg shadow"
                        : "text-fg-muted hover:text-fg"
                        }`}
                >
                    Editor
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={mobilePane === "output"}
                    onClick={() => setMobilePane("output")}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${mobilePane === "output"
                        ? "bg-bg text-fg shadow"
                        : "text-fg-muted hover:text-fg"
                        }`}
                >
                    {item.type === "sandbox" ? "Preview" : item.type === "worker" ? "Tests" : "Review"}
                </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {/* Editor */}
                <div
                    className={`flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated ${mobilePane === "editor" ? "" : "hidden lg:flex"}`}
                >
                    <div
                        className="flex items-center gap-1 border-b border-border bg-bg px-2"
                        role="tablist"
                        aria-label="Open files"
                    >
                        {filenames.map((name) => (
                            <button
                                key={name}
                                type="button"
                                role="tab"
                                aria-selected={activeFile === name}
                                onClick={() => setActiveFile(name)}
                                className={`px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${activeFile === name
                                    ? "border-b-2 border-brand-500 text-fg"
                                    : "text-fg-muted hover:text-fg"
                                    }`}
                            >
                                {name}
                            </button>
                        ))}
                        <div className="ml-auto flex items-center gap-1">
                            {headerExtra}
                            <button
                                type="button"
                                onClick={explainCode}
                                disabled={explaining}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
                                title="Explain this code with AI"
                            >
                                {explaining ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Sparkles className="h-3.5 w-3.5" />
                                )}
                                Explain
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted hover:text-fg"
                            >
                                <RotateCcw className="h-3.5 w-3.5" /> Reset
                            </button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <Monaco
                            height="100%"
                            theme="vs-dark"
                            language={languageFor(activeFile)}
                            value={files[activeFile] ?? ""}
                            onChange={(v) => updateFile(activeFile, v ?? "")}
                            options={{
                                fontSize: 13,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                tabSize: 2,
                                automaticLayout: true,
                            }}
                        />
                    </div>
                </div>

                {/* Output */}
                <div
                    className={`flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated ${mobilePane === "output" ? "" : "hidden lg:flex"}`}
                    role="region"
                    aria-label={item.type === "sandbox" ? "Live preview" : item.type === "worker" ? "Test results" : "AI review"}
                    aria-live="polite"
                >
                    <div className="flex items-center gap-2 border-b border-border bg-bg px-3 py-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
                            {item.type === "sandbox"
                                ? "Preview"
                                : item.type === "worker"
                                    ? "Tests"
                                    : "Review"}
                        </span>
                        <div className="ml-auto flex items-center gap-2">
                            {item.type === "worker" ? (
                                <button
                                    type="button"
                                    onClick={runTests}
                                    disabled={running}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg-muted disabled:opacity-50"
                                >
                                    {running ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Play className="h-3.5 w-3.5" />
                                    )}
                                    Run tests
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={submit}
                                disabled={isSubmitting || disableSubmit}
                                className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Send className="h-3.5 w-3.5" />
                                )}
                                {submitLabel}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        {item.type === "sandbox" ? (
                            <iframe
                                title="preview"
                                sandbox="allow-scripts"
                                srcDoc={sandboxSrcDoc}
                                className="h-full w-full bg-white"
                            />
                        ) : null}
                        {item.type === "worker" ? (
                            <WorkerOutput results={results} error={runError} running={running} />
                        ) : null}
                        {item.type === "conceptual" ? (
                            <ConceptualOutput feedback={feedback} />
                        ) : null}
                    </div>

                    {submitError ? (
                        <div className="border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                            {submitError}
                        </div>
                    ) : null}
                    {submitInfo ? (
                        <div className="border-t border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                            {submitInfo}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Hint bar */}
            <HintBar
                level={hintLevel}
                hint={hint}
                error={hintError}
                loading={loadingHint}
                onRequest={requestHint}
            />

            {/* Explain code panel (F3) */}
            {showExplain ? (
                <div
                    className="rounded-2xl border border-border bg-bg-elevated p-4"
                    role="region"
                    aria-label="AI code explanation"
                    aria-live="polite"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-fg">
                            <Sparkles className="h-4 w-4 text-brand-400" />
                            Code explanation · {activeFile}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowExplain(false)}
                            className="rounded-md px-2 py-1 text-xs text-fg-muted hover:text-fg"
                        >
                            Close
                        </button>
                    </div>
                    {explainError ? (
                        <p className="mt-3 text-sm text-red-300">{explainError}</p>
                    ) : null}
                    {explanation ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">
                            {explanation}
                            {explaining ? (
                                <span className="ml-0.5 animate-pulse">▍</span>
                            ) : null}
                        </p>
                    ) : explaining ? (
                        <p className="mt-3 text-sm text-fg-muted">Streaming…</p>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

function HintBar({
    level,
    hint,
    error,
    loading,
    onRequest,
}: {
    level: HintLevel;
    hint: HintResponse | null;
    error: string | null;
    loading: boolean;
    onRequest: (level: HintLevel) => void;
}) {
    return (
        <div className="rounded-2xl border border-border bg-bg-elevated p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-300" />
                <span className="text-sm font-medium">Hints</span>
                <span className="text-xs text-fg-muted">
                    Progressive — each level reveals more.
                </span>
                <div className="ml-auto flex gap-1">
                    {([1, 2, 3] as const).map((lvl) => (
                        <button
                            key={lvl}
                            type="button"
                            onClick={() => onRequest(lvl)}
                            disabled={loading}
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${hint && hint.level === lvl
                                ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                                : "border-border text-fg-muted hover:text-fg"
                                }`}
                        >
                            {loading && level === lvl ? (
                                <Loader2 className="inline h-3 w-3 animate-spin" />
                            ) : (
                                `Level ${lvl}`
                            )}
                        </button>
                    ))}
                </div>
            </div>
            {error ? (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {error}
                </div>
            ) : null}
            {hint ? (
                <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300/80">
                        Level {hint.level}
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{hint.hint}</p>
                </div>
            ) : null}
        </div>
    );
}

function WorkerOutput({
    results,
    error,
    running,
}: {
    results: TestResult[] | null;
    error: string | null;
    running: boolean;
}) {
    if (running) {
        return (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Running tests…
            </div>
        );
    }
    if (error) {
        return (
            <pre className="m-3 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                {error}
            </pre>
        );
    }
    if (!results) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-fg-muted">
                Click <span className="mx-1 font-medium text-fg">Run tests</span> to execute.
            </div>
        );
    }
    const passed = results.filter((r) => r.ok).length;
    return (
        <div className="space-y-2 p-3">
            <div className="text-xs font-medium text-fg-muted">
                {passed} / {results.length} passing
            </div>
            <ul className="space-y-1">
                {results.map((r, i) => (
                    <li
                        key={i}
                        className={`rounded-lg border px-3 py-2 text-sm ${r.ok
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                            : "border-red-500/30 bg-red-500/5 text-red-200"
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            {r.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            <span>{r.name}</span>
                        </div>
                        {!r.ok && r.error ? (
                            <pre className="mt-1 ml-6 whitespace-pre-wrap text-xs opacity-80">{r.error}</pre>
                        ) : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ConceptualOutput({ feedback }: { feedback: ConceptualFeedback | null }) {
    if (!feedback) {
        return (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-fg-muted">
                Submit your code to get an AI review against the rubric.
            </div>
        );
    }
    const verdictStyle =
        feedback.verdict === "correct"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : feedback.verdict === "partial"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                : "border-red-500/40 bg-red-500/10 text-red-200";

    return (
        <div className="space-y-4 p-4">
            <div className={`flex items-center justify-between rounded-xl border p-3 ${verdictStyle}`}>
                <div className="font-semibold capitalize">{feedback.verdict}</div>
                <div className="text-sm tabular-nums">{feedback.score} / 5</div>
            </div>
            {feedback.matched.length > 0 ? (
                <RubricList title="Matched" items={feedback.matched} bullet="✓" />
            ) : null}
            {feedback.missing.length > 0 ? (
                <RubricList title="Missing" items={feedback.missing} bullet="•" />
            ) : null}
            <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    Suggestion
                </div>
                <p className="mt-1 text-sm leading-relaxed">{feedback.suggestion}</p>
            </div>
        </div>
    );
}

function RubricList({
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
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
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
