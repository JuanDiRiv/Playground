import "server-only";
import { z } from "zod";
import { MODEL_FAST, getOpenAI } from "@/lib/ai/client";
import { getCached, hashInput, setCached } from "@/lib/ai/cache";
import type { Exercise } from "@/lib/schemas/content";

export const HintLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type HintLevel = z.infer<typeof HintLevelSchema>;

export const HintResponseSchema = z.object({
  level: HintLevelSchema,
  hint: z.string(),
});
export type HintResponse = z.infer<typeof HintResponseSchema>;

const LEVEL_INSTRUCTION: Record<HintLevel, string> = {
  1: "A small nudge. Point at the right idea without revealing implementation. 1-2 sentences.",
  2: "Suggest the approach (data structure, function, pattern) but no code. 2-3 sentences.",
  3: "Walk through the solution at a high level. You may name specific APIs or write a tiny pseudo-code line, but do NOT paste the full reference solution.",
};

const SYSTEM_PROMPT = `You are a patient mentor. Given an exercise and the candidate's current code, you give ONE hint at the requested level.
Reply ONLY with JSON: { "level": 1|2|3, "hint": string }.
Never paste the reference solution verbatim. Be concise. No markdown headings.`;

function formatFiles(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([name, body]) => `--- ${name} ---\n${body}`)
    .join("\n\n");
}

export async function getProgressiveHint(
  exercise: Exercise,
  files: Record<string, string>,
  level: HintLevel,
): Promise<HintResponse> {
  const cacheKey = hashInput({
    kind: "hint",
    exerciseId: exercise.id,
    files,
    level,
    model: MODEL_FAST,
    v: 1,
  });

  const cached = await getCached<HintResponse>(cacheKey);
  if (cached) return cached;

  const userPrompt = [
    `Exercise: ${exercise.title}`,
    `Description: ${exercise.description}`,
    exercise.rubric ? `Rubric: ${exercise.rubric}` : null,
    exercise.solution ? `Reference (DO NOT paste): ${exercise.solution}` : null,
    `Hint level: ${level} — ${LEVEL_INSTRUCTION[level]}`,
    `Candidate code:\n${formatFiles(files)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await getOpenAI().chat.completions.create({
    model: MODEL_FAST,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = HintResponseSchema.parse(JSON.parse(raw));

  await setCached(cacheKey, parsed, {
    exerciseId: exercise.id,
    level,
    model: MODEL_FAST,
  });

  return parsed;
}
