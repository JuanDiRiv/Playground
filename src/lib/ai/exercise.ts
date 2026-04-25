import "server-only";
import { z } from "zod";
import { MODEL_DEFAULT, getOpenAI } from "@/lib/ai/client";
import { getCached, hashInput, setCached } from "@/lib/ai/cache";
import type { Exercise } from "@/lib/schemas/content";

export const ConceptualFeedbackSchema = z.object({
  score: z.number().int().min(0).max(5),
  verdict: z.enum(["incorrect", "partial", "correct"]),
  matched: z.array(z.string()).max(8),
  missing: z.array(z.string()).max(8),
  suggestion: z.string(),
});
export type ConceptualFeedback = z.infer<typeof ConceptualFeedbackSchema>;

const SYSTEM_PROMPT = `You are a senior code reviewer evaluating a candidate's solution for a small coding exercise.
You will receive a description, a rubric and the candidate's code (multi-file).
Reply ONLY with JSON of the shape:
{
  "score": integer 0-5,
  "verdict": "incorrect" | "partial" | "correct",
  "matched": string[]  (rubric points the solution satisfies),
  "missing": string[]  (rubric points missing or wrong),
  "suggestion": string (one short paragraph on how to improve)
}
Be strict but fair. Score:
- 5: meets all rubric points cleanly
- 4: mostly correct, minor issues
- 3: partial — half the rubric
- 1-2: major mistakes or doesn't run
- 0: empty / off-topic
Stay grounded in the rubric. Do not request features outside it.`;

function formatFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([name, body]) => `--- ${name} ---\n${body}`)
    .join("\n\n");
}

function buildUserPrompt(
  exercise: Exercise,
  files: Record<string, string>,
): string {
  return [
    `Title: ${exercise.title}`,
    `Description: ${exercise.description}`,
    `Difficulty: ${exercise.difficulty}`,
    `Rubric: ${exercise.rubric ?? "(none provided)"}`,
    `Candidate solution:\n${formatFiles(files)}`,
  ].join("\n\n");
}

export async function evaluateConceptualExercise(
  exercise: Exercise,
  files: Record<string, string>,
): Promise<ConceptualFeedback> {
  const cacheKey = hashInput({
    kind: "exercise-conceptual",
    exerciseId: exercise.id,
    files,
    model: MODEL_DEFAULT,
    v: 1,
  });

  const cached = await getCached<ConceptualFeedback>(cacheKey);
  if (cached) return cached;

  const completion = await getOpenAI().chat.completions.create({
    model: MODEL_DEFAULT,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(exercise, files) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = ConceptualFeedbackSchema.parse(JSON.parse(raw));

  await setCached(cacheKey, parsed, {
    exerciseId: exercise.id,
    model: MODEL_DEFAULT,
  });

  return parsed;
}
