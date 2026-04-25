import { describe, it, expect } from "vitest";
import { hashInput } from "./cache-key";

describe("hashInput", () => {
  it("is stable across key order", () => {
    const a = hashInput({ a: 1, b: 2, c: "hello" });
    const b = hashInput({ c: "hello", b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("changes when any value changes", () => {
    const a = hashInput({ kind: "qa", q: "abc" });
    const b = hashInput({ kind: "qa", q: "abd" });
    expect(a).not.toBe(b);
  });

  it("returns hex sha-256", () => {
    expect(hashInput({ x: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
