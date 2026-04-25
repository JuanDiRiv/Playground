import "server-only";
import { z } from "zod";
import { MODEL_DEFAULT, getOpenAI } from "@/lib/ai/client";
import { getCached, hashInput, setCached } from "@/lib/ai/cache";
import type { Question } from "@/lib/schemas/content";

export const QaFeedbackSchema = z.object({
  score: z.number().int().min(0).max(5),
  verdict: z.enum(["incorrect", "partial", "correct"]),
  strengths: z.array(z.string()).max(5),
  gaps: z.array(z.string()).max(5),
  suggestion: z.string(),
});
export type QaFeedback = z.infer<typeof QaFeedbackSchema>;

const SYSTEM_PROMPT = `You are a senior interviewer evaluating a candidate's short answer.
Be strict but fair. Reply ONLY with JSON matching this shape:
{
  "score": integer 0-5,
  "verdict": "incorrect" | "partial" | "correct",
  "strengths": string[] (max 5, what the answer got right; empty if none),
  "gaps": string[] (max 5, key concepts missing or wrong),
  "suggestion": string (one short paragraph: how to improve)
}
Scoring rubric:
- 0: empty / off-topic
- 1-2: incorrect or major misconceptions
- 3: partial — touches the idea but misses key points
- 4: mostly correct, minor gaps
- 5: complete and precise
Stay grounded in the reference answer. Do not invent facts.`;

function buildUserPrompt(question: Question, userAnswer: string): string {
  return [
    `Question: ${question.prompt}`,
    `Difficulty: ${question.difficulty}`,
    `Reference answer: ${question.modelAnswer}`,
    `Candidate answer: ${userAnswer.trim() || "(empty)"}`,
  ].join("\n\n");
}

/**
 * Evaluates a candidate's answer against the reference answer.
 * Caches identical (questionId + normalized answer) pairs in Firestore
 * to avoid duplicate model calls.
 */
export async function evaluateQaAnswer(
  question: Question,
  userAnswer: string,
): Promise<QaFeedback> {
  const normalized = userAnswer.trim().toLowerCase().replace(/\s+/g, " ");
  const cacheKey = hashInput({
    kind: "qa",
    questionId: question.id,
    answer: normalized,
    model: MODEL_DEFAULT,
    v: 1,
  });

  const cached = await getCached<QaFeedback>(cacheKey);
  if (cached) return cached;

  const completion = await getOpenAI().chat.completions.create({
    model: MODEL_DEFAULT,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(question, userAnswer) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = QaFeedbackSchema.parse(JSON.parse(raw));

  await setCached(cacheKey, parsed, {
    questionId: question.id,
    model: MODEL_DEFAULT,
  });

  return parsed;
}
