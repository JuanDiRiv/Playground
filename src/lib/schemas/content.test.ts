import { describe, it, expect } from "vitest";
import {
  ChallengeSchema,
  ExerciseSchema,
  QuestionSchema,
  TopicSchema,
} from "./content";

describe("content schemas", () => {
  it("TopicSchema accepts a valid topic", () => {
    const ok = TopicSchema.parse({
      slug: "javascript",
      name: "JavaScript",
      description: "JS practice",
      color: "yellow",
      order: 3,
    });
    expect(ok.slug).toBe("javascript");
  });

  it("TopicSchema rejects unknown slug", () => {
    expect(() =>
      TopicSchema.parse({
        slug: "rust",
        name: "Rust",
        description: "",
        color: "orange",
        order: 1,
      }),
    ).toThrow();
  });

  it("QuestionSchema fills defaults", () => {
    const q = QuestionSchema.parse({
      id: "q1",
      topicSlug: "html",
      prompt: "Explain semantic HTML",
      modelAnswer: "...",
      difficulty: "easy",
    });
    expect(q.tags).toEqual([]);
    expect(q.source).toBe("seed");
  });

  it("ExerciseSchema requires starter map", () => {
    const ex = ExerciseSchema.parse({
      id: "e1",
      topicSlug: "javascript",
      type: "worker",
      title: "Sum",
      description: "",
      difficulty: "easy",
      starter: { "index.ts": "export const sum = (a:number,b:number)=>a+b;" },
      tests: [{ name: "adds", body: "expect(sum(1,2)).toBe(3);" }],
    });
    expect(ex.starter["index.ts"]).toContain("sum");
  });

  it("ChallengeSchema requires positive targetTimeSec", () => {
    expect(() =>
      ChallengeSchema.parse({
        id: "c1",
        topicSlug: "javascript",
        type: "worker",
        title: "x",
        description: "",
        difficulty: "easy",
        starter: { "index.ts": "" },
        targetTimeSec: 0,
      }),
    ).toThrow();
  });
});
