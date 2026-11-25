import { describe, expect, it } from "vitest";
import { summarizePool, type WarpRecord } from "../warp/history";
import { pullsFromResources, planWarps } from "../warp/planner";

let n = 0;
const rec = (rank: 3 | 4 | 5, itemId = "x", pool: WarpRecord["pool"] = "character"): WarpRecord => {
  n++;
  return { id: String(1700000000000000000n + BigInt(n)), profileId: "p", pool, gachaType: pool === "character" ? "11" : "1", itemId, name: itemId, itemType: "", rank, time: "2026-01-01 00:00:00", source: "uigf" };
};

describe("warp history", () => {
  it("computes pity, 50/50 results and guarantee", () => {
    const list: WarpRecord[] = [];
    for (let i = 0; i < 9; i++) list.push(rec(3));
    list.push(rec(4));
    for (let i = 0; i < 64; i++) list.push(rec(3));
    list.push(rec(5, "1003")); // Himeko = standard → lost 50/50 at pity 75
    for (let i = 0; i < 20; i++) list.push(rec(3));
    list.push(rec(5, "1308")); // limited → guaranteed at 21
    for (let i = 0; i < 7; i++) list.push(rec(3));
    const s = summarizePool("character", list, { pity5Before: 0, pity4Before: 0, guaranteedBefore: false, complete: true });
    expect(s.total).toBe(103);
    expect(s.fiveStars.map((f) => [f.pityAt, f.fiftyFifty])).toEqual([[75, "lost"], [21, "guaranteed"]]);
    expect(s.pity5).toBe(7);
    expect(s.guaranteed5).toBe(false);
    expect(s.lostFiftyFifty).toBe(1);
    expect(s.averagePullsPerFiveStar).toBe(48);
  });

  it("respects a pre-history offset and flags uncertain pity", () => {
    const list = [rec(3), rec(5, "1308")];
    const unknown = summarizePool("character", list);
    expect(unknown.fiveStars[0].pityUncertain).toBe(true);
    expect(unknown.averagePullsPerFiveStar).toBeNull();
    expect(unknown.warnings.join(" ")).toMatch(/incomplete/);
    const known = summarizePool("character", list, { pity5Before: 30, pity4Before: 0, guaranteedBefore: true, complete: false });
    expect(known.fiveStars[0].pityAt).toBe(32);
    expect(known.fiveStars[0].fiftyFifty).toBe("guaranteed");
  });

  it("never mixes pools", () => {
    const s = summarizePool("standard", [rec(5, "1308", "character"), rec(3, "x", "standard")]);
    expect(s.total).toBe(1);
    expect(s.fiveStars).toHaveLength(0);
  });
});

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
