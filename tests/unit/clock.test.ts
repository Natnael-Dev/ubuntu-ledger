import { describe, it, expect } from "vitest";
import { SystemClock, TestClock } from "@/infra/clock";

describe("injectable clock (T-03)", () => {
  it("system clock returns current real date and timestamps", () => {
    const clock = new SystemClock();
    const before = Date.now();
    const now = clock.now();
    const after = Date.now();

    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
    expect(typeof clock.nowIso()).toBe("string");
    expect(typeof clock.nowMs()).toBe("number");
  });

  it("test clock provides fixed deterministic time", () => {
    const fixed = new Date("2026-09-15T12:00:00.000Z");
    const clock = new TestClock(fixed);

    expect(clock.now().toISOString()).toBe("2026-09-15T12:00:00.000Z");
    expect(clock.nowMs()).toBe(fixed.getTime());
    expect(clock.nowIso()).toBe("2026-09-15T12:00:00.000Z");
  });

  it("test clock travels 7 days forward in <10 ms (T-03 acceptance criteria)", () => {
    const start = new Date("2026-09-15T00:00:00.000Z");
    const clock = new TestClock(start);

    const perfStart = performance.now();
    clock.travelDays(7);
    const elapsed = performance.now() - perfStart;

    expect(elapsed).toBeLessThan(10);
    expect(clock.now().toISOString()).toBe("2026-09-22T00:00:00.000Z");
    expect(clock.nowMs() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("test clock supports arbitrary millisecond travel and time setting", () => {
    const clock = new TestClock(1000);
    clock.travel(500);
    expect(clock.nowMs()).toBe(1500);

    clock.setTime("2026-10-01T00:00:00.000Z");
    expect(clock.nowIso()).toBe("2026-10-01T00:00:00.000Z");
  });
});
