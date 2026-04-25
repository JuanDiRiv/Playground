import "server-only";
import { z } from "zod";
import { MODEL_DEFAULT, getOpenAI } from "@/lib/ai/client";
import { getCached, hashInput, setCached } from "@/lib/ai/cache";
import {
  DifficultySchema,
  TopicSlugSchema,
  type Difficulty,
  type Question,
  type TopicSlug,
} from "@/lib/schemas/content";

/**
 * On-demand AI generation of a Q&A question (F2).
 *
 * The model is asked to return a self-contained question with a reference
 * answer in the same shape as seed questions. We cache by (topic, difficulty,
 * tag-hint, model) so a "Generate" click is cheap when repeated.
 */

const GeneratedQaSchema = z.object({
  prompt: z.string().min(8).max(500),
  modelAnswer: z.string().min(20).max(1500),
  hint: z.string().min(4).max(280).optional(),
  tags: z.array(z.string().min(1).max(40)).max(6).default([]),
});

export type GeneratedQa = z.infer<typeof GeneratedQaSchema> & {
  id: string;
  topicSlug: TopicSlug;
  difficulty: Difficulty;
  source: "ai";
};

const SYSTEM_PROMPT = `You are an expert engineering interviewer who designs short-answer questions.
Reply ONLY with JSON of the shape:
{
  "prompt": string (one clear, specific question; one paragraph, no bullets, no code fences),
  "modelAnswer": string (concise reference answer, 2-5 short paragraphs OR a short ordered list, plain text),
  "hint": string (one short hint, optional but recommended),
  "tags": string[] (max 6 short slugs like "hooks", "ssr", "closures")
}
Rules:
- Difficulty must match: easy = single concept, medium = trade-offs, hard = nuanced edge cases.
- Do not repeat well-known clichés; vary phrasing.
- Stay strictly within the given topic.`;

const InputSchema = z.object({
  topicSlug: TopicSlugSchema,
  difficulty: DifficultySchema,
  /** Optional free-form hint to bias generation (e.g. a tag the user wants to focus on). */
  focus: z.string().trim().max(80).optional(),
});

export type GenerateQaInput = z.infer<typeof InputSchema>;

function makeId(): string {
  // 9 chars, URL-safe; collision risk is negligible at our scale.
  return `ai-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export async function generateQaQuestion(
  raw: GenerateQaInput,
): Promise<Question> {
  const { topicSlug, difficulty, focus } = InputSchema.parse(raw);

  const cacheKey = hashInput({
    kind: "gen-qa",
    topicSlug,
    difficulty,
    focus: focus ?? "",
    model: MODEL_DEFAULT,
    v: 1,
  });

  const userPrompt = [
    `Topic: ${topicSlug}`,
    `Difficulty: ${difficulty}`,
    focus ? `Focus: ${focus}` : null,
    "Generate one new question now.",
  ]
    .filter(Boolean)
    .join("\n");

  let parsed: z.infer<typeof GeneratedQaSchema>;
  const cached = await getCached<z.infer<typeof GeneratedQaSchema>>(cacheKey);
  if (cached) {
    parsed = cached;
  } else {
    const completion = await getOpenAI().chat.completions.create({
      model: MODEL_DEFAULT,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    parsed = GeneratedQaSchema.parse(JSON.parse(raw));
    await setCached(cacheKey, parsed, { topicSlug, difficulty });
  }

  // Fresh id every time — cache is on the *content*, not the document.
  const question: Question = {
    id: makeId(),
    topicSlug,
    prompt: parsed.prompt,
    modelAnswer: parsed.modelAnswer,
    hint: parsed.hint,
    difficulty,
    tags: parsed.tags ?? [],
    source: "ai",
  };
  return question;
}
