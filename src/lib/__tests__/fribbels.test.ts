import { describe, expect, it } from "vitest";
import data from "@/data/fribbels-builds.json";
import { fribbelsBuild, fribbelsProfile, substatOrder } from "../builds/fribbels";
import { profileFor } from "../summary";
import { MAIN_STATS_BY_SLOT, SUB_STATS, type RelicSlot } from "../relics/stats";

const builds = data.characters as Record<string, { weights: Record<string, number>; mainStats: Record<string, string[]> }>;

describe("Fribbels build data", () => {
  it("credits the source and pins a commit", () => {
    expect(data.license).toMatch(/MIT/);
    expect(data.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(builds).length).toBeGreaterThan(80);
  });
  it("only uses stats and main stats that exist in the game", () => {
    for (const [id, b] of Object.entries(builds)) {
      for (const k of Object.keys(b.weights)) expect(SUB_STATS, `${id} weight ${k}`).toContain(k);
      for (const [slot, mains] of Object.entries(b.mainStats)) for (const m of mains) expect(MAIN_STATS_BY_SLOT[slot as RelicSlot], `${id} ${slot} ${m}`).toContain(m);
    }
  });
  it("is the default scoring profile, but your own profile wins", () => {
    const p = profileFor("1308", null, {});
    expect(p.templateId).toBe("fribbels");
    expect(p.weights["CRIT DMG"]).toBe(1);
    const mine = { ...p, id: "mine", origin: "user" as const };
    expect(profileFor("1308", null, { "1308": mine }).id).toBe("mine");
  });
  it("female Trailblazers use the male variant's build", () => {
    expect(fribbelsBuild("8002")).toEqual(fribbelsBuild("8001"));
    expect(fribbelsProfile("8002")?.weights).toEqual(fribbelsProfile("8001")?.weights);
  });
  it("orders substats by Fribbels' list, else by weight", () => {
    expect(substatOrder(fribbelsBuild("1308")!)[0]).toBe("CRIT DMG");
    expect(substatOrder(fribbelsBuild("1006")!).slice(0, 2).sort()).toEqual(["Effect Hit Rate", "SPD"]);
  });
});
