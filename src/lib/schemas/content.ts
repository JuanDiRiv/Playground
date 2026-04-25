import { z } from "zod";

export const TOPIC_SLUGS = [
  "html",
  "css",
  "javascript",
  "react",
  "nextjs",
  "typescript",
  "node",
] as const;

export const TopicSlugSchema = z.enum(TOPIC_SLUGS);
export type TopicSlug = z.infer<typeof TopicSlugSchema>;

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ContentSourceSchema = z.enum(["seed", "ai", "curated"]);
export type ContentSource = z.infer<typeof ContentSourceSchema>;

export const TopicSchema = z.object({
  slug: TopicSlugSchema,
  name: z.string(),
  description: z.string(),
  color: z.string(),
  order: z.number().int(),
});
export type Topic = z.infer<typeof TopicSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  topicSlug: TopicSlugSchema,
  prompt: z.string(),
  hint: z.string().optional(),
  modelAnswer: z.string(),
  difficulty: DifficultySchema,
  tags: z.array(z.string()).default([]),
  source: ContentSourceSchema.default("seed"),
});
export type Question = z.infer<typeof QuestionSchema>;

export const ExerciseTypeSchema = z.enum([
  "sandbox",
  "worker",
  "conceptual",
]);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

export const TestCaseSchema = z.object({
  name: z.string(),
  /** JS source executed inside the worker. Should call `expect()`. */
  body: z.string(),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const ExerciseSchema = z.object({
  id: z.string(),
  topicSlug: TopicSlugSchema,
  type: ExerciseTypeSchema,
  title: z.string(),
  description: z.string(),
  difficulty: DifficultySchema,
  /** Starter files keyed by filename. e.g. { "index.html": "...", "styles.css": "..." } */
  starter: z.record(z.string(), z.string()),
  /** Reference solution (used only by the tutor for hints). */
  solution: z.string().optional(),
  /** Tests for `worker` exercises. */
  tests: z.array(TestCaseSchema).default([]),
  /** Rubric for `conceptual` exercises (passed to AI evaluator). */
  rubric: z.string().optional(),
  tags: z.array(z.string()).default([]),
  source: ContentSourceSchema.default("seed"),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

export const ChallengeSchema = ExerciseSchema.extend({
  /** Target completion time in seconds. */
  targetTimeSec: z.number().int().positive(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;
