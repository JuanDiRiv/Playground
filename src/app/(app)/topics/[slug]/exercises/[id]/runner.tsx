"use client";

import type { Exercise } from "@/lib/schemas/content";
import {
    Workbench,
    type WorkbenchSubmit,
    type WorkbenchSubmitResult,
} from "@/components/workbench/workbench";
import { submitExerciseAction } from "./actions";

export function ExerciseRunner({ exercise }: { exercise: Exercise }) {
    async function handleSubmit(
        payload: WorkbenchSubmit,
    ): Promise<WorkbenchSubmitResult> {
        if (payload.kind === "worker") {
            const res = await submitExerciseAction({
                kind: "worker",
                topicSlug: exercise.topicSlug,
                exerciseId: exercise.id,
                files: payload.files,
                passed: payload.passed,
                total: payload.total,
            });
            if (!res.ok) return { ok: false, error: res.error };
            return {
                ok: true,
                info:
                    payload.passed === payload.total && payload.total > 0
                        ? "Saved as completed ✓"
                        : `Saved (${payload.passed}/${payload.total} tests passing).`,
            };
        }
        if (payload.kind === "sandbox") {
            const res = await submitExerciseAction({
                kind: "sandbox",
                topicSlug: exercise.topicSlug,
                exerciseId: exercise.id,
                files: payload.files,
                selfReported: true,
            });
            if (!res.ok) return { ok: false, error: res.error };
            return { ok: true, info: "Marked as done. Keep practicing!" };
        }
        const res = await submitExerciseAction({
            kind: "conceptual",
            topicSlug: exercise.topicSlug,
            exerciseId: exercise.id,
            files: payload.files,
        });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, feedback: res.feedback };
    }

    return (
        <Workbench
            item={exercise}
            source="exercise"
            submitLabel={
                exercise.type === "conceptual" ? "Submit for review" : "Save attempt"
            }
            onSubmit={handleSubmit}
        />
    );
}
