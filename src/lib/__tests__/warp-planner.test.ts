import { describe, expect, it } from "vitest";
import { pullsFromResources, planWarps } from "../warp/planner";
import { pityKnown, sanitizePity } from "../warp/pity";
import { summarizeAccount } from "../summary";

describe("warp planner", () => {
  it("converts resources to pulls", () => {
    expect(pullsFromResources(1600, 2, 40)).toBe(14);
    expect(pullsFromResources(159, 0, 19)).toBe(0);
    expect(() => pullsFromResources(-1, 0, 0)).toThrow();
  });
  it("combines jade remainders and reports shortfall to certainty", () => {
    const r = planWarps({ pool: "character", stellarJade: 100, passes: 0, undyingStarlight: 0, expectedFutureJade: 60, expectedFuturePasses: 0, state: { pity: 0, guaranteed: true }, copies: 1 });
    expect(r.totalPulls).toBe(1);
    expect(r.shortfallForCertainty).toBe(89);
    expect(r.jadeShortfallForCertainty).toBe(89 * 160);
    const sure = planWarps({ pool: "character", stellarJade: 0, passes: 180, undyingStarlight: 0, expectedFutureJade: 0, expectedFuturePasses: 0, state: { pity: 0, guaranteed: false }, copies: 1 });
    expect(sure.probability).toBe(1);
  });
});

describe("entered pity", () => {
  it("is clamped to valid values per pool", () => {
    expect(sanitizePity("character", { pity: 120, guaranteed: true })).toEqual({ pity: 89, guaranteed: true, updatedAt: undefined });
    expect(sanitizePity("lightcone", { pity: 85 }).pity).toBe(79);
    expect(sanitizePity("standard", { pity: -3, guaranteed: true })).toEqual({ pity: 0, guaranteed: false, updatedAt: undefined });
    expect(pityKnown({ pity: 0, guaranteed: false })).toBe(false);
  });
  it("drives the soft-pity objective", () => {
    const base = { game: null, characters: [], lightCones: [], relics: [], achievements: [], markers: [], banners: [], events: [], relicProfiles: {} };
    const high = summarizeAccount({ ...base, pity: { character: { pity: 78, guaranteed: false, updatedAt: "x" }, lightcone: { pity: 0, guaranteed: false }, standard: { pity: 0, guaranteed: false } } });
    expect(high.objectives.some((o) => o.id === "warp-soft")).toBe(true);
    expect(summarizeAccount(base).objectives.some((o) => o.id === "warp-soft")).toBe(false);
  });
});
