import { describe, it, expect } from "vitest";
import { isPassed, isOnTime, nextBestTime } from "./progress-logic";

describe("isPassed", () => {
  it("worker: all tests pass", () => {
    expect(isPassed({ kind: "worker", passed: 3, total: 3 })).toBe(true);
  });
  it("worker: any test failing", () => {
    expect(isPassed({ kind: "worker", passed: 2, total: 3 })).toBe(false);
  });
  it("worker: zero tests is not passing", () => {
    expect(isPassed({ kind: "worker", passed: 0, total: 0 })).toBe(false);
  });
  it("conceptual: verdict correct", () => {
    expect(
      isPassed({
        kind: "conceptual",
        feedback: {
          verdict: "correct",
          score: 5,
          matched: [],
          missing: [],
          suggestion: "",
        },
      }),
    ).toBe(true);
  });
  it("conceptual: verdict partial", () => {
    expect(
      isPassed({
        kind: "conceptual",
        feedback: {
          verdict: "partial",
          score: 3,
          matched: [],
          missing: [],
          suggestion: "",
        },
      }),
    ).toBe(false);
  });
  it("sandbox: self-reported", () => {
    expect(isPassed({ kind: "sandbox", selfReported: true })).toBe(true);
    expect(isPassed({ kind: "sandbox", selfReported: false })).toBe(false);
  });
});

describe("isOnTime", () => {
  it("requires passed=true", () => {
    expect(isOnTime(false, 30, 60)).toBe(false);
  });
  it("on-time when elapsed <= target", () => {
    expect(isOnTime(true, 60, 60)).toBe(true);
    expect(isOnTime(true, 59, 60)).toBe(true);
  });
  it("late when elapsed > target", () => {
    expect(isOnTime(true, 61, 60)).toBe(false);
  });
});

describe("nextBestTime", () => {
  it("ignores failing attempts", () => {
    expect(nextBestTime(120, 30, false)).toBe(120);
    expect(nextBestTime(undefined, 30, false)).toBeUndefined();
  });
  it("first passing time becomes the best", () => {
    expect(nextBestTime(undefined, 45, true)).toBe(45);
  });
  it("keeps minimum across passing attempts", () => {
    expect(nextBestTime(50, 70, true)).toBe(50);
    expect(nextBestTime(50, 30, true)).toBe(30);
  });
});
