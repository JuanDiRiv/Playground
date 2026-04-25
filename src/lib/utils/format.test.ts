import { describe, it, expect } from "vitest";
import { clamp, formatMinSec, pct } from "./format";

describe("formatMinSec", () => {
  it("formats seconds as M:SS", () => {
    expect(formatMinSec(0)).toBe("0:00");
    expect(formatMinSec(9)).toBe("0:09");
    expect(formatMinSec(60)).toBe("1:00");
    expect(formatMinSec(75)).toBe("1:15");
    expect(formatMinSec(600)).toBe("10:00");
  });

  it("clamps negatives to 0:00", () => {
    expect(formatMinSec(-30)).toBe("0:00");
  });

  it("floors fractional seconds", () => {
    expect(formatMinSec(75.9)).toBe("1:15");
  });
});

describe("clamp", () => {
  it("returns value in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps below min", () => {
    expect(clamp(-2, 0, 10)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("pct", () => {
  it("returns integer percent", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(3, 4)).toBe(75);
  });
  it("returns 0 when total is 0", () => {
    expect(pct(5, 0)).toBe(0);
  });
  it("clamps to 100", () => {
    expect(pct(10, 5)).toBe(100);
  });
});
