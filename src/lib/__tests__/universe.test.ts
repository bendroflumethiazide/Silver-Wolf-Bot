import { describe, expect, it } from "vitest";
import { advance, ASSUMPTIONS, blessingOffer, classicBlessings, domainChoices, hasResonance, newRun, summarize, takeBlessing } from "../universe/sim";
import { createRng } from "../warp/simulator";

// Synthetic blessings in the game's id scheme: 612 + Path digit + rarity digit + n.
const raw: Record<string, { id: string; name: string; desc: string; enhanced_desc: string }> = {};
const add = (id: string, name: string) => { raw[id] = { id, name, desc: `${name} desc`, enhanced_desc: `${name}+` }; };
for (let p = 0; p <= 8; p++) {
  add(`612${p}20`, `Resonance ${p}`);
  for (let i = 0; i < 3; i++) add(`612${p}3${i}`, `Rare ${p}.${i}`);
  for (let i = 0; i < 7; i++) add(`612${p}4${i}`, `Mid ${p}.${i}`);
  for (let i = 0; i < 8; i++) add(`612${p}5${i}`, `Common ${p}.${i}`);
}
add("615010", "Other mode blessing");

describe("Simulated Universe simulator", () => {
  const { pool, resonance } = classicBlessings(raw);
  it("decodes Path and rarity from blessing ids and ignores other modes", () => {
    expect(pool).toHaveLength(9 * 18);
    expect(pool.find((b) => b.id === "612430")).toMatchObject({ path: "The Hunt", rarity: 3 });
    expect(pool.find((b) => b.id === "612854")).toMatchObject({ path: "Erudition", rarity: 1 });
    expect(resonance.Preservation?.name).toBe("Resonance 0");
  });
  it("offers three different blessings you don't own", () => {
    const run = takeBlessing(newRun("Destruction"), pool[0]);
    const offer = blessingOffer(pool, run, createRng("x"));
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((b) => b.id)).size).toBe(3);
    expect(offer.some((b) => b.id === pool[0].id)).toBe(false);
  });
  it("roughly follows the stated own-Path share", () => {
    const rng = createRng("share");
    const run = newRun("Nihility");
    let own = 0, n = 0;
    for (let i = 0; i < 400; i++) for (const b of blessingOffer(pool, run, rng)) { n++; if (b.path === "Nihility") own++; }
    expect(own / n).toBeGreaterThan(ASSUMPTIONS.ownPath - 0.08);
    expect(own / n).toBeLessThan(ASSUMPTIONS.ownPath + 0.08);
  });
  it("unlocks Resonance at three Path blessings", () => {
    let run = newRun("Erudition");
    for (const b of pool.filter((x) => x.path === "Erudition").slice(0, 2)) run = takeBlessing(run, b);
    expect(hasResonance(run)).toBe(false);
    run = takeBlessing(run, pool.filter((x) => x.path === "Erudition")[2]);
    expect(hasResonance(run)).toBe(true);
    expect(run.log.at(-1)).toMatch(/Resonance unlocked/);
    expect(summarize(run).focus).toBe(1);
  });
  it("ends with the Boss and replays the same with the same seed", () => {
    let run = newRun("Abundance");
    for (let i = 0; i < ASSUMPTIONS.domains - 1; i++) run = advance(run, "x");
    expect(domainChoices(run, createRng("b"))).toEqual(["Boss"]);
    const a = domainChoices(newRun("Abundance"), createRng("same"));
    expect(domainChoices(newRun("Abundance"), createRng("same"))).toEqual(a);
  });
});
