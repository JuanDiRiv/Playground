import { describe, it, expect } from "vitest";
import {
  isOverLimit,
  RateLimitError,
  remaining,
  todayKey,
} from "./rate-limit-logic";

describe("rate-limit-logic", () => {
  it("todayKey is YYYY-MM-DD", () => {
    expect(todayKey(new Date("2026-04-25T03:14:00Z"))).toBe("2026-04-25");
  });

  it("todayKey defaults to now", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("isOverLimit triggers at the limit", () => {
    expect(isOverLimit(0, 50)).toBe(false);
    expect(isOverLimit(49, 50)).toBe(false);
    expect(isOverLimit(50, 50)).toBe(true);
    expect(isOverLimit(99, 50)).toBe(true);
  });

  it("remaining is clamped to zero", () => {
    expect(remaining(0, 10)).toBe(10);
    expect(remaining(7, 10)).toBe(3);
    expect(remaining(10, 10)).toBe(0);
    expect(remaining(15, 10)).toBe(0);
  });

  it("RateLimitError carries the limit and a useful message", () => {
    const err = new RateLimitError(50);
    expect(err.name).toBe("RateLimitError");
    expect(err.limit).toBe(50);
    expect(err.message).toContain("50");
  });
});
