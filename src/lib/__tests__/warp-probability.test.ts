import { describe, expect, it } from "vitest";
import { probabilityWithin, pullsForConfidence, targetDistribution, worstCasePulls } from "../warp/probability";
import { consolidated, POOLS } from "../warp/rules";
import { monteCarlo } from "../warp/simulator";

describe("exact warp probabilities", () => {
  it("worst cases follow hard pity and guarantee rules", () => {
    expect(worstCasePulls("character", { pity: 0, guaranteed: false }, 1)).toBe(180);
    expect(worstCasePulls("character", { pity: 0, guaranteed: true }, 1)).toBe(90);
    expect(worstCasePulls("character", { pity: 70, guaranteed: true }, 1)).toBe(20);
    expect(worstCasePulls("character", { pity: 0, guaranteed: false }, 2)).toBe(360);
    expect(worstCasePulls("lightcone", { pity: 10, guaranteed: false }, 1)).toBe(150);
    expect(worstCasePulls("standard", { pity: 0, guaranteed: false }, 1)).toBe(90);
  });

  it("CDF is monotonic and reaches exactly 1 at the worst case", () => {
    const d = targetDistribution("character", { pity: 12, guaranteed: false }, 2);
    for (let n = 1; n < d.cdf.length; n++) expect(d.cdf[n]).toBeGreaterThanOrEqual(d.cdf[n - 1] - 1e-15);
    expect(d.cdf[d.worstCasePulls]).toBeCloseTo(1, 10);
  });

  it("expected pulls equal consolidated expectation × rate-up factor", () => {
    const e5 = consolidated(POOLS.character.five).expectedPulls;
    expect(targetDistribution("character", { pity: 0, guaranteed: true }, 1).expectedPulls).toBeCloseTo(e5, 8);
    expect(targetDistribution("character", { pity: 0, guaranteed: false }, 1).expectedPulls).toBeCloseTo(e5 * 1.5, 8);
    const eLc = consolidated(POOLS.lightcone.five).expectedPulls;
    expect(targetDistribution("lightcone", { pity: 0, guaranteed: false }, 1).expectedPulls).toBeCloseTo(eLc * 1.25, 8);
  });

  it("guarantee strictly improves odds", () => {
    const a = probabilityWithin("character", { pity: 30, guaranteed: false }, 1, 80);
    const b = probabilityWithin("character", { pity: 30, guaranteed: true }, 1, 80);
    expect(b).toBeGreaterThan(a);
    expect(probabilityWithin("character", { pity: 30, guaranteed: true }, 1, 60)).toBe(1);
  });

  it("confidence percentiles are ordered", () => {
    const d = targetDistribution("character", { pity: 0, guaranteed: false }, 1);
    const m = pullsForConfidence(d, 0.5);
    const p90 = pullsForConfidence(d, 0.9);
    expect(m).toBeLessThanOrEqual(p90);
    expect(p90).toBeLessThanOrEqual(d.worstCasePulls);
  });

  it.each([
    ["character", { pity: 0, guaranteed: false }, 1, 100],
    ["character", { pity: 40, guaranteed: true }, 2, 150],
    ["lightcone", { pity: 5, guaranteed: false }, 1, 60],
  ] as const)("Monte Carlo agrees with the exact DP (%s)", (kind, st, copies, budget) => {
    const exact = probabilityWithin(kind, st, copies, budget);
    const mc = monteCarlo(kind, st, copies, budget, 40000, `seed-${kind}-${budget}`);
    expect(Math.abs(mc.successRate - exact)).toBeLessThan(4 * mc.standardError + 1e-3);
  });
});
