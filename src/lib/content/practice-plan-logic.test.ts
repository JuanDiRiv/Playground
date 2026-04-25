import { describe, it, expect } from "vitest";
import {
  pickQaTarget,
  pickExerciseTarget,
  pickChallengeTarget,
  buildPracticePlan,
} from "./practice-plan-logic";
import type { Challenge, Exercise, Question } from "@/lib/schemas/content";

function q(
  id: string,
  difficulty: "easy" | "medium" | "hard" = "medium",
): Question {
  return {
    id,
    topicSlug: "javascript",
    prompt: id,
    modelAnswer: "x",
    difficulty,
    tags: [],
    source: "seed",
  };
}

function ex(
  id: string,
  difficulty: "easy" | "medium" | "hard" = "medium",
): Exercise {
  return {
    id,
    topicSlug: "javascript",
    title: id,
    description: "x",
    type: "conceptual",
    starter: { "main.ts": "" },
    rubric: "x",
    difficulty,
    tags: [],
    tests: [],
    source: "seed",
  };
}

function ch(
  id: string,
  difficulty: "easy" | "medium" | "hard" = "medium",
): Challenge {
  return { ...ex(id, difficulty), targetTimeSec: 600 } as Challenge;
}

describe("pickQaTarget", () => {
  it("prefers unattempted over attempted", () => {
    const a = q("a");
    const b = q("b");
    const map = new Map([["a", { questionId: "a", bestScore: 4 }]]);
    expect(pickQaTarget([a, b], map)?.id).toBe("b");
  });

  it("prefers lowest score among attempted", () => {
    const a = q("a");
    const b = q("b");
    const map = new Map([
      ["a", { questionId: "a", bestScore: 4 }],
      ["b", { questionId: "b", bestScore: 2 }],
    ]);
    expect(pickQaTarget([a, b], map)?.id).toBe("b");
  });

  it("breaks ties by harder difficulty first", () => {
    const easy = q("a", "easy");
    const hard = q("b", "hard");
    expect(pickQaTarget([easy, hard], new Map())?.id).toBe("b");
  });

  it("returns null when all solved", () => {
    const a = q("a");
    const map = new Map([["a", { questionId: "a", bestScore: 5 }]]);
    expect(pickQaTarget([a], map)).toBeNull();
  });
});

describe("pickExerciseTarget", () => {
  it("returns first not-passed, harder first", () => {
    const easy = ex("e", "easy");
    const hard = ex("h", "hard");
    expect(pickExerciseTarget([easy, hard], new Map())?.id).toBe("h");
  });

  it("skips passed ones", () => {
    const a = ex("a");
    const b = ex("b");
    const map = new Map([["a", { exerciseId: "a", passed: true }]]);
    expect(pickExerciseTarget([a, b], map)?.id).toBe("b");
  });
});

describe("pickChallengeTarget", () => {
  it("prefers never-attempted, easier first", () => {
    const easy = ch("e", "easy");
    const hard = ch("h", "hard");
    expect(pickChallengeTarget([easy, hard], new Map())?.id).toBe("e");
  });

  it("returns null when all on-time", () => {
    const a = ch("a");
    const map = new Map([
      ["a", { challengeId: "a", passed: true, onTime: true }],
    ]);
    expect(pickChallengeTarget([a], map)).toBeNull();
  });

  it("returns passed-but-slow ones", () => {
    const a = ch("a");
    const map = new Map([
      ["a", { challengeId: "a", passed: true, onTime: false }],
    ]);
    expect(pickChallengeTarget([a], map)?.id).toBe("a");
  });
});

describe("buildPracticePlan", () => {
  it("picks across topics and returns null when nothing left", () => {
    const plan = buildPracticePlan({
      perTopic: [
        {
          topicSlug: "javascript",
          questions: [q("a")],
          exercises: [ex("e1")],
          challenges: [ch("c1")],
          qaProgress: new Map(),
          exerciseProgress: new Map(),
          challengeProgress: new Map(),
        },
      ],
    });
    expect(plan.qa?.question.id).toBe("a");
    expect(plan.exercise?.exercise.id).toBe("e1");
    expect(plan.challenge?.challenge.id).toBe("c1");
  });
});
