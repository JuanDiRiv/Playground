import { describe, expect, it } from "vitest";
import {
  advanceStreak,
  dayKey,
  diffInDays,
  evaluateBadges,
} from "./gamification-logic";

describe("dayKey", () => {
  it("returns YYYY-MM-DD in UTC", () => {
    expect(dayKey(new Date("2025-03-04T01:23:45Z"))).toBe("2025-03-04");
  });
});

describe("diffInDays", () => {
  it("returns 0 for same day", () => {
    expect(diffInDays("2025-01-01", "2025-01-01")).toBe(0);
  });
  it("returns 1 for next day", () => {
    expect(diffInDays("2025-01-01", "2025-01-02")).toBe(1);
  });
  it("returns large gap correctly", () => {
    expect(diffInDays("2025-01-01", "2025-01-11")).toBe(10);
  });
});

describe("advanceStreak", () => {
  it("starts a streak at 1 when no prior activity", () => {
    const next = advanceStreak(
      { current: 0, longest: 0, lastActiveDay: null },
      "2025-01-01",
    );
    expect(next).toEqual({
      current: 1,
      longest: 1,
      lastActiveDay: "2025-01-01",
    });
  });

  it("is a no-op for the same day", () => {
    const prev = { current: 4, longest: 7, lastActiveDay: "2025-01-05" };
    expect(advanceStreak(prev, "2025-01-05")).toBe(prev);
  });

  it("increments on consecutive day", () => {
    const next = advanceStreak(
      { current: 4, longest: 7, lastActiveDay: "2025-01-05" },
      "2025-01-06",
    );
    expect(next.current).toBe(5);
    expect(next.longest).toBe(7);
  });

  it("updates longest when current passes it", () => {
    const next = advanceStreak(
      { current: 7, longest: 7, lastActiveDay: "2025-01-05" },
      "2025-01-06",
    );
    expect(next.longest).toBe(8);
  });

  it("resets to 1 on a gap", () => {
    const next = advanceStreak(
      { current: 5, longest: 5, lastActiveDay: "2025-01-05" },
      "2025-01-09",
    );
    expect(next.current).toBe(1);
    expect(next.longest).toBe(5);
  });
});

describe("evaluateBadges", () => {
  it("awards first-blood when reaching 1 completion", () => {
    const earned = evaluateBadges([], {
      completedCount: 1,
      streakCurrent: 1,
      challengesPassed: 0,
      challengesOnTime: 0,
    });
    expect(earned).toContain("first-blood");
  });
  it("does not re-award already owned badges", () => {
    const earned = evaluateBadges(["first-blood", "streak-3"], {
      completedCount: 5,
      streakCurrent: 3,
      challengesPassed: 1,
      challengesOnTime: 0,
    });
    expect(earned).toEqual([]);
  });
  it("awards streak tiers cumulatively", () => {
    const earned = evaluateBadges(["first-blood"], {
      completedCount: 10,
      streakCurrent: 7,
      challengesPassed: 0,
      challengesOnTime: 0,
    });
    expect(earned).toContain("streak-3");
    expect(earned).toContain("streak-7");
    expect(earned).not.toContain("streak-30");
  });
  it("awards challenger-5 and speedster-5", () => {
    const earned = evaluateBadges([], {
      completedCount: 5,
      streakCurrent: 1,
      challengesPassed: 5,
      challengesOnTime: 5,
    });
    expect(earned).toContain("challenger-5");
    expect(earned).toContain("speedster-5");
  });
});
