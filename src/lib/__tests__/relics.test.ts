import { describe, expect, it } from "vitest";
import { PROFILE_TEMPLATES, scoreRelic, upgradesRemaining, type ScoringProfile } from "../relics/scoring";
import { scannerMainStat, SUBSTAT_MAX_ROLL } from "../relics/stats";

const crit = PROFILE_TEMPLATES.find((p) => p.id === "tpl-crit-atk")!;
const custom: ScoringProfile = { id: "c", name: "test", origin: "user", weights: { "CRIT Rate": 1, "CRIT DMG": 1, "ATK%": 1, SPD: 1 }, mainStats: { BODY: ["CRIT Rate"] } };
const m = SUBSTAT_MAX_ROLL[5];

describe("relic scoring", () => {
  it("a perfect +15 relic scores 100", () => {
    const r = scoreRelic({ slot: "HEAD", rarity: 5, level: 15, mainStat: "HP", substats: [
      { key: "CRIT Rate", value: m["CRIT Rate"] * 6 }, { key: "CRIT DMG", value: m["CRIT DMG"] }, { key: "ATK%", value: m["ATK%"] }, { key: "SPD", value: m.SPD },
    ] }, custom);
    expect(r.score).toBeCloseTo(100, 6);
    expect(r.verdict).toBe("keep");
  });
  it("useless substats score 0 and are fodder", () => {
    const r = scoreRelic({ slot: "HEAD", rarity: 5, level: 15, mainStat: "HP", substats: [
      { key: "DEF", value: 20 }, { key: "HP", value: 40 }, { key: "Effect RES", value: 4 }, { key: "DEF%", value: 5 },
    ] }, custom);
    expect(r.score).toBe(0);
    expect(r.verdict).toBe("fodder");
  });
  it("wrong main stat is flagged regardless of substats", () => {
    const r = scoreRelic({ slot: "BODY", rarity: 5, level: 15, mainStat: "DEF%", substats: [
      { key: "CRIT Rate", value: 10 }, { key: "CRIT DMG", value: 20 }, { key: "ATK%", value: 8 }, { key: "SPD", value: 5 },
    ] }, custom);
    expect(r.mainStatFits).toBe(false);
    expect(r.verdict).toBe("fodder");
  });
  it("different profiles score the same relic differently", () => {
    const relic = { slot: "FOOT" as const, rarity: 5 as const, level: 15, mainStat: "SPD" as const, substats: [
      { key: "Break Effect" as const, value: 19 }, { key: "ATK%" as const, value: 4 }, { key: "HP" as const, value: 40 }, { key: "DEF" as const, value: 20 },
    ] };
    const breakProfile = PROFILE_TEMPLATES.find((p) => p.id === "tpl-break")!;
    expect(scoreRelic(relic, breakProfile).score).toBeGreaterThan(scoreRelic(relic, crit).score);
  });
  it("counts remaining upgrades and projects potential", () => {
    expect(upgradesRemaining({ slot: "HEAD", rarity: 5, level: 0, mainStat: "HP", substats: [] })).toBe(5);
    expect(upgradesRemaining({ slot: "HEAD", rarity: 5, level: 14, mainStat: "HP", substats: [] })).toBe(1);
    expect(upgradesRemaining({ slot: "HEAD", rarity: 4, level: 12, mainStat: "HP", substats: [] })).toBe(0);
    const r = scoreRelic({ slot: "HEAD", rarity: 5, level: 0, mainStat: "HP", substats: [{ key: "CRIT Rate", value: m["CRIT Rate"] }, { key: "CRIT DMG", value: m["CRIT DMG"] }, { key: "DEF", value: 20 }] }, custom);
    expect(r.bestCaseAtMax).toBeGreaterThanOrEqual(r.expectedAtMax);
    expect(r.expectedAtMax).toBeGreaterThanOrEqual(r.score);
  });
  it("maps scanner main stats by slot", () => {
    expect(scannerMainStat("HP", "HEAD")).toBe("HP");
    expect(scannerMainStat("HP", "BODY")).toBe("HP%");
    expect(scannerMainStat("ATK", "HAND")).toBe("ATK");
    expect(scannerMainStat("SPD", "FOOT")).toBe("SPD");
    expect(scannerMainStat("SPD", "BODY")).toBeNull();
  });
});
