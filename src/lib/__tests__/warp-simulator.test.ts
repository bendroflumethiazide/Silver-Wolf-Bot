import { describe, expect, it } from "vitest";
import { createRng, INITIAL_SIM_STATE, simulatePulls, type SimBanner } from "../warp/simulator";

const banner: SimBanner = {
  kind: "character",
  featured5: [{ name: "Featured" }],
  offBanner5: [{ name: "Standard A" }, { name: "Standard B" }],
  featured4: [{ name: "F4a" }, { name: "F4b" }, { name: "F4c" }],
  offBanner4: [{ name: "S4" }],
};

describe("warp simulator", () => {
  it("is deterministic for a given seed", () => {
    const a = simulatePulls(banner, INITIAL_SIM_STATE, createRng("abc"), 500);
    const b = simulatePulls(banner, INITIAL_SIM_STATE, createRng("abc"), 500);
    expect(a.pulls.map((p) => p.item.name)).toEqual(b.pulls.map((p) => p.item.name));
    const c = simulatePulls(banner, INITIAL_SIM_STATE, createRng("abd"), 500);
    expect(c.pulls.map((p) => p.item.name)).not.toEqual(a.pulls.map((p) => p.item.name));
  });

  it("RNG output is uniform-ish in [0,1)", () => {
    const rng = createRng(42);
    let sum = 0;
    for (let i = 0; i < 100000; i++) { const x = rng(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); sum += x; }
    expect(sum / 100000).toBeCloseTo(0.5, 2);
  });

  it("long-run rates match published consolidated rates and rules hold", () => {
    const { pulls } = simulatePulls(banner, INITIAL_SIM_STATE, createRng("rates"), 300000);
    const five = pulls.filter((p) => p.rarity === 5);
    const four = pulls.filter((p) => p.rarity === 4);
    expect(five.length / pulls.length).toBeGreaterThan(0.0150);
    expect(five.length / pulls.length).toBeLessThan(0.0170);
    expect(four.length / pulls.length).toBeGreaterThan(0.125);
    expect(four.length / pulls.length).toBeLessThan(0.135);
    // hard pity
    expect(Math.max(...five.map((p) => p.pityAt))).toBeLessThanOrEqual(90);
    // after an off-banner 5★, the next 5★ is always featured
    for (let i = 1; i < five.length; i++) if (!five[i - 1].featured) expect(five[i].featured).toBe(true);
    // never 10 consecutive 3★
    let streak = 0;
    for (const p of pulls) { streak = p.rarity === 3 ? streak + 1 : 0; expect(streak).toBeLessThan(10); }
    // featured share of 5★ ≈ 2/3 for a 50/50 with guarantee
    const share = five.filter((p) => p.featured).length / five.length;
    expect(share).toBeGreaterThan(0.62);
    expect(share).toBeLessThan(0.71);
  });
});
