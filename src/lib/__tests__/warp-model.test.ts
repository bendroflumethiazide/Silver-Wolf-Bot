import { describe, expect, it } from "vitest";
import { consolidated, hitProbability, nextHitDistribution, POOLS, POOL_KINDS, poolForGachaType } from "../warp/rules";

describe("warp rules", () => {
  it.each([
    ["character 5★", POOLS.character.five],
    ["character 4★", POOLS.character.four],
    ["light cone 5★", POOLS.lightcone.five],
    ["light cone 4★", POOLS.lightcone.four],
  ])("%s soft-pity model reproduces the published consolidated rate", (_n, r) => {
    expect(Math.abs(consolidated(r).rate - r.publishedConsolidated)).toBeLessThan(0.0012);
  });

  it("matches published base rates before soft pity and hard pity", () => {
    expect(hitProbability(POOLS.character.five, 1)).toBe(0.006);
    expect(hitProbability(POOLS.character.five, 73)).toBe(0.006);
    expect(hitProbability(POOLS.character.five, 90)).toBe(1);
    expect(hitProbability(POOLS.lightcone.five, 1)).toBe(0.008);
    expect(hitProbability(POOLS.lightcone.five, 80)).toBe(1);
    expect(hitProbability(POOLS.character.four, 10)).toBe(1);
    expect(POOLS.character.fiveFeaturedChance).toBe(0.5);
    expect(POOLS.lightcone.fiveFeaturedChance).toBe(0.75);
  });

  it("probabilities are monotonic and bounded", () => {
    for (const k of POOL_KINDS) {
      const r = POOLS[k].five;
      let prev = 0;
      for (let n = 1; n <= r.hard; n++) {
        const p = hitProbability(r, n);
        expect(p).toBeGreaterThanOrEqual(prev);
        expect(p).toBeLessThanOrEqual(1);
        prev = p;
      }
    }
  });

  it("next-hit distribution sums to 1 from any pity", () => {
    for (const pity of [0, 50, 73, 89]) {
      const d = nextHitDistribution(POOLS.character.five, pity);
      expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(d.length - 1).toBe(90 - pity);
    }
  });

  it("maps game gacha types to separate pity pools", () => {
    expect(poolForGachaType("11")).toBe("character");
    expect(poolForGachaType("12")).toBe("lightcone");
    expect(poolForGachaType("1")).toBe("standard");
    expect(poolForGachaType("2")).toBe("departure");
    expect(poolForGachaType("21")).toBe("collab-character");
    expect(poolForGachaType("99")).toBeNull();
  });
});
