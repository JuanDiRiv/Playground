"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Play, RotateCcw, Send, XCircle } from "lucide-react";
import { transform } from "sucrase";
import type { Exercise } from "@/lib/schemas/content";
import type { ConceptualFeedback } from "@/lib/ai/exercise";
import { submitExerciseAction } from "./actions";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-fg-muted">
      Loading editor…
    </div>
  ),
});

type TestResult = { name: string; ok: boolean; error?: string };

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

export function ExerciseRunner({ exercise }: { exercise: Exercise }) {
  const filenames = useMemo(() => Object.keys(exercise.starter), [exercise]);
  const [files, setFiles] = useState<Record<string, string>>(exercise.starter);
  const [activeFile, setActiveFile] = useState<string>(filenames[0] ?? "");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<ConceptualFeedback | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitInfo, setSubmitInfo] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  function updateFile(name: string, value: string) {
    setFiles((prev) => ({ ...prev, [name]: value }));
  }

  function reset() {
    setFiles(exercise.starter);
    setResults(null);
    setRunError(null);
    setFeedback(null);
    setSubmitError(null);
    setSubmitInfo(null);
  }

  // ---- Sandbox preview (HTML/CSS) ----
  const sandboxSrcDoc = useMemo(() => {
    if (exercise.type !== "sandbox") return "";
    const html = files["index.html"] ?? "";
    const css = files["styles.css"] ?? "";
    return `<!doctype html><html><head><meta charset="utf-8"/><style>${css}</style></head><body>${html}</body></html>`;
  }, [exercise.type, files]);

  // ---- Worker tests ----
  function runTests() {
    if (exercise.type !== "worker") return;
    setRunError(null);
    setResults(null);
    setRunning(true);

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

    worker.postMessage({ code, tests: exercise.tests });
  }

  // ---- Submit ----
  function submit() {
    setSubmitError(null);
    setSubmitInfo(null);
    setFeedback(null);

    startSubmit(async () => {
      if (exercise.type === "worker") {
        if (!results) {
          setSubmitError("Run the tests first.");
          return;
        }
        const passed = results.filter((r) => r.ok).length;
        const total = results.length;
        const res = await submitExerciseAction({
          kind: "worker",
          topicSlug: exercise.topicSlug,
          exerciseId: exercise.id,
          files,
          passed,
          total,
        });
        if (!res.ok) setSubmitError(res.error);
        else
          setSubmitInfo(
            passed === total
              ? "Saved as completed ✓"
              : `Saved (${passed}/${total} tests passing).`,
          );
      } else if (exercise.type === "sandbox") {
        const res = await submitExerciseAction({
          kind: "sandbox",
          topicSlug: exercise.topicSlug,
          exerciseId: exercise.id,
          files,
          selfReported: true,
        });
        if (!res.ok) setSubmitError(res.error);
        else setSubmitInfo("Marked as done. Keep practicing!");
      } else {
        const res = await submitExerciseAction({
          kind: "conceptual",
          topicSlug: exercise.topicSlug,
          exerciseId: exercise.id,
          files,
        });
        if (!res.ok) setSubmitError(res.error);
        else if (res.feedback) setFeedback(res.feedback);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Left: Editor */}
      <div className="flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        <div className="flex items-center gap-1 border-b border-border bg-bg px-2">
          {filenames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setActiveFile(name)}
              className={`px-3 py-2 text-xs font-medium transition ${
                activeFile === name
                  ? "border-b-2 border-brand-500 text-fg"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {name}
            </button>
          ))}
          <div className="ml-auto">
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

      {/* Right: Output panel */}
      <div className="flex h-[60vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        <div className="flex items-center gap-2 border-b border-border bg-bg px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
            {exercise.type === "sandbox"
              ? "Preview"
              : exercise.type === "worker"
                ? "Tests"
                : "Review"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {exercise.type === "worker" ? (
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
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {exercise.type === "conceptual" ? "Submit for review" : "Save attempt"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {exercise.type === "sandbox" ? (
            <iframe
              title="preview"
              sandbox="allow-scripts"
              srcDoc={sandboxSrcDoc}
              className="h-full w-full bg-white"
            />
          ) : null}

          {exercise.type === "worker" ? (
            <WorkerOutput results={results} error={runError} running={running} />
          ) : null}

          {exercise.type === "conceptual" ? (
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
            className={`rounded-lg border px-3 py-2 text-sm ${
              r.ok
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                : "border-red-500/30 bg-red-500/5 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {r.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span>{r.name}</span>
            </div>
            {!r.ok && r.error ? (
              <pre className="mt-1 ml-6 whitespace-pre-wrap text-xs opacity-80">
                {r.error}
              </pre>
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
