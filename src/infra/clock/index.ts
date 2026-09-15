export interface Clock {
  now(): Date;
  nowMs(): number;
  nowIso(): string;
}

/**
 * Production clock implementation reading from the system environment.
 * All time reads in application code must go through this clock.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return this.now().toISOString();
  }
}

/**
 * Deterministic test clock supporting milliseconds and days time travel.
 * Used in tests to simulate probation windows and expiration instantly.
 */
export class TestClock implements Clock {
  private currentTimeMs: number;

  constructor(initialTime: Date | number | string = new Date(0)) {
    this.currentTimeMs =
      typeof initialTime === "number"
        ? initialTime
        : new Date(initialTime).getTime();
  }

  now(): Date {
    return new Date(this.currentTimeMs);
  }

  nowMs(): number {
    return this.currentTimeMs;
  }

  nowIso(): string {
    return this.now().toISOString();
  }

  travel(ms: number): void {
    this.currentTimeMs += ms;
  }

  travelDays(days: number): void {
    this.travel(days * 24 * 60 * 60 * 1000);
  }

  setTime(time: Date | number | string): void {
    this.currentTimeMs =
      typeof time === "number" ? time : new Date(time).getTime();
  }
}

/**
 * Singleton system clock instance for application services.
 */
export const systemClock = new SystemClock();
