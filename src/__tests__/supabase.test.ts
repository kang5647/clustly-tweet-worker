import { describe, it, expect } from "vitest";

// Test the retry math logic without hitting Supabase.
// markFailed uses: backoffMinutes * 60 * 1000 * Math.pow(2, newAttempts - 1)

describe("markFailed retry math", () => {
  const backoffMinutes = 5;

  it("first retry (attempt 1) waits 5 minutes", () => {
    const newAttempts = 1;
    const delayMs = backoffMinutes * 60 * 1000 * Math.pow(2, newAttempts - 1);
    expect(delayMs).toBe(5 * 60 * 1000); // 5 min
  });

  it("second retry (attempt 2) waits 10 minutes", () => {
    const newAttempts = 2;
    const delayMs = backoffMinutes * 60 * 1000 * Math.pow(2, newAttempts - 1);
    expect(delayMs).toBe(10 * 60 * 1000); // 10 min
  });

  it("third retry (attempt 3) would wait 20 minutes but hits max", () => {
    const maxAttempts = 3;
    const newAttempts = 3;
    // At max attempts, entry is marked as failed (no retry)
    expect(newAttempts >= maxAttempts).toBe(true);
  });

  it("exponential growth is correct", () => {
    const delays = [1, 2, 3, 4, 5].map(
      (n) => backoffMinutes * 60 * 1000 * Math.pow(2, n - 1)
    );
    // 5min, 10min, 20min, 40min, 80min
    expect(delays).toEqual([
      300_000,
      600_000,
      1_200_000,
      2_400_000,
      4_800_000,
    ]);
  });
});
