"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Timer } from "lucide-react";
import type { Challenge } from "@/lib/schemas/content";
import {
    Workbench,
    type WorkbenchSubmit,
    type WorkbenchSubmitResult,
} from "@/components/workbench/workbench";
import { submitChallengeAction } from "./actions";

function formatMinSec(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.max(0, sec) % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ChallengeRunner({ challenge }: { challenge: Challenge }) {
    const [running, setRunning] = useState(false);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [stoppedInfo, setStoppedInfo] = useState<{
        onTime: boolean;
        elapsedSec: number;
        target: number;
    } | null>(null);
    const startedAtRef = useRef<number | null>(null);

    // Tick
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => {
            if (startedAtRef.current != null) {
                const now = Date.now();
                setElapsedSec(Math.floor((now - startedAtRef.current) / 1000));
            }
        }, 250);
        return () => clearInterval(id);
    }, [running]);

    function start() {
        startedAtRef.current = Date.now() - elapsedSec * 1000;
        setRunning(true);
        setStoppedInfo(null);
    }

    function pause() {
        setRunning(false);
    }

    const remaining = challenge.targetTimeSec - elapsedSec;
    const overTime = remaining < 0;

    async function handleSubmit(
        payload: WorkbenchSubmit,
    ): Promise<WorkbenchSubmitResult> {
        // Snapshot the timer at submit and pause it.
        setRunning(false);
        const finalElapsed = elapsedSec;

        let res: Awaited<ReturnType<typeof submitChallengeAction>>;
        if (payload.kind === "worker") {
            res = await submitChallengeAction({
                kind: "worker",
                topicSlug: challenge.topicSlug,
                challengeId: challenge.id,
                files: payload.files,
                passed: payload.passed,
                total: payload.total,
                elapsedSec: finalElapsed,
            });
        } else if (payload.kind === "sandbox") {
            res = await submitChallengeAction({
                kind: "sandbox",
                topicSlug: challenge.topicSlug,
                challengeId: challenge.id,
                files: payload.files,
                selfReported: true,
                elapsedSec: finalElapsed,
            });
        } else {
            res = await submitChallengeAction({
                kind: "conceptual",
                topicSlug: challenge.topicSlug,
                challengeId: challenge.id,
                files: payload.files,
                elapsedSec: finalElapsed,
            });
        }

        if (!res.ok) return { ok: false, error: res.error };

        setStoppedInfo({
            onTime: res.onTime,
            elapsedSec: res.elapsedSec,
            target: res.targetTimeSec,
        });

        const timeText = res.onTime
            ? `On time! (${formatMinSec(res.elapsedSec)} ≤ ${formatMinSec(res.targetTimeSec)})`
            : `Time: ${formatMinSec(res.elapsedSec)} / target ${formatMinSec(res.targetTimeSec)}`;

        return {
            ok: true,
            feedback: res.feedback,
            info: timeText,
        };
    }

    return (
        <div className="space-y-4">
            <Workbench
                item={challenge}
                source="challenge"
                submitLabel={challenge.type === "conceptual" ? "Submit for review" : "Save attempt"}
                onSubmit={handleSubmit}
                headerExtra={
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium tabular-nums ${overTime
                                    ? "bg-red-500/15 text-red-300"
                                    : running
                                        ? "bg-brand-500/15 text-brand-300"
                                        : "bg-bg-muted text-fg-muted"
                                }`}
                        >
                            <Timer className="h-3 w-3" /> {formatMinSec(elapsedSec)}
                        </span>
                        {running ? (
                            <button
                                type="button"
                                onClick={pause}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-bg-muted"
                            >
                                <Pause className="h-3 w-3" /> Pause
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={start}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-bg-muted"
                            >
                                <Play className="h-3 w-3" /> {elapsedSec === 0 ? "Start" : "Resume"}
                            </button>
                        )}
                    </div>
                }
            />

            {stoppedInfo ? (
                <div
                    className={`rounded-2xl border p-4 text-sm ${stoppedInfo.onTime
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        }`}
                >
                    <div className="font-semibold">
                        {stoppedInfo.onTime ? "On time!" : "Saved"}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                        Elapsed {formatMinSec(stoppedInfo.elapsedSec)} · target{" "}
                        {formatMinSec(stoppedInfo.target)}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
