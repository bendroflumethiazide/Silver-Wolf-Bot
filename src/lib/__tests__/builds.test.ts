import { describe, expect, it } from "vitest";
import { grade, GRADE_LETTERS } from "../builds/grade";
import { computeStats, mainStatValue } from "../builds/stats";
import { evaluateBuild } from "../builds/evaluate";
import { recommendBuild } from "../builds/recommend";
import type { GameData } from "../gamedata/types";
import type { ScoringProfile } from "../relics/scoring";
import type { OwnedCharacter, Relic } from "../types";

describe("letter grades", () => {
  it("spans D to WTF with -/+ modifiers, monotonic", () => {
    expect(grade(0).label).toBe("D-");
    expect(grade(14.9).label).toBe("D+");
    expect(grade(15).label).toBe("C-");
    expect(grade(40).label).toBe("A");
    expect(grade(44.9).label).toBe("A+");
    expect(grade(56).label).toBe("SS-");
    expect(grade(70).label).toBe("SSS");
    expect(grade(80).label).toBe("WTF-");
    expect(grade(100).label).toBe("WTF+");
    let prev = -1;
    for (let s = 0; s <= 100; s += 0.5) { const r = grade(s).rank; expect(r).toBeGreaterThanOrEqual(prev); prev = r; }
    expect(new Set(Array.from({ length: 201 }, (_, i) => grade(i / 2).letter))).toEqual(new Set(GRADE_LETTERS));
  });
});

const lv = (promotion: number, properties: { type: string; value: number }[] = []) => ({ promotion, level: 1, properties, materials: [{ id: "2", num: 1 }] });
const game = {
  characters: { "1": { id: "1", name: "Tester", rarity: 5, path: "Mage", element: "Quantum", skills: [], ranks: [], skill_trees: ["1201", "1202"] } },
  characterPromotions: { "1": { id: "1", values: Array.from({ length: 7 }, () => ({ hp: { base: 1000, step: 0 }, atk: { base: 500, step: 0 }, def: { base: 400, step: 0 }, spd: { base: 100, step: 0 }, crit_rate: { base: 0.05, step: 0 }, crit_dmg: { base: 0.5, step: 0 } })), materials: [] } },
  characterSkillTrees: {
    "1201": { id: "1201", name: "CR", max_level: 1, anchor: "Point09", levels: [lv(0, [{ type: "CriticalChanceBase", value: 0.1 }])] },
    "1202": { id: "1202", name: "SPD", max_level: 1, anchor: "Point10", levels: [lv(2, [{ type: "SpeedDelta", value: 5 }])] },
  },
  lightCones: { "9": { id: "9", name: "Cone", rarity: 5, path: "Mage" } },
  lightConePromotions: { "9": { id: "9", values: Array.from({ length: 7 }, () => ({ hp: { base: 100, step: 0 }, atk: { base: 100, step: 0 }, def: { base: 100, step: 0 } })), materials: [] } },
  lightConeRanks: { "9": { id: "9", skill: "x", desc: "", params: [], properties: [[{ type: "SpeedAddedRatio", value: 0.1 }]] } },
  relicSets: {
    "101": { id: "101", name: "Crit Set", desc: ["CR", "x"], properties: [[{ type: "CriticalChanceBase", value: 0.08 }], []] },
    "102": { id: "102", name: "Def Set", desc: ["DEF", "x"], properties: [[{ type: "DefenceAddedRatio", value: 0.15 }], []] },
    "301": { id: "301", name: "Atk Planar", desc: ["ATK"], properties: [[{ type: "AttackAddedRatio", value: 0.12 }]] },
  },
  relicMainAffixes: {
    "51": { id: "51", affixes: { "1": { affix_id: "1", property: "HPDelta", base: 112.896, step: 39.5136 } } },
    "52": { id: "52", affixes: { "1": { affix_id: "1", property: "AttackDelta", base: 56.448, step: 19.7568 } } },
    "53": { id: "53", affixes: { "5": { affix_id: "5", property: "CriticalChanceBase", base: 0.0518, step: 0.0181 }, "1": { affix_id: "1", property: "DefenceAddedRatio", base: 0.0864, step: 0.0302 } } },
  },
  lightConeRanksDesc: {},
} as unknown as GameData;

const owned: OwnedCharacter = { key: "p:1", profileId: "p", charId: "1", level: 80, ascension: 6, eidolon: 0, skills: { basic: 6, skill: 10, ult: 10, talent: 10 }, traces: { stat_1: true, stat_2: true }, source: "manual", updatedAt: "" };
const relic = (slot: Relic["slot"], mainStat: Relic["mainStat"], setId: string, substats: Relic["substats"], level = 15): Relic => ({ uid: slot, profileId: "p", setId, slot, rarity: 5, level, mainStat, substats, location: "1", lock: true, source: "manual", updatedAt: "" });
const profile: ScoringProfile = { id: "u", name: "Crit", origin: "user", weights: { "CRIT Rate": 1, "CRIT DMG": 1, SPD: 1 }, mainStats: { BODY: ["CRIT Rate"] }, targets: { "CRIT Rate": 70 } };

describe("total stats", () => {
  it("adds base, Light Cone, traces, relic main/sub stats and set bonuses", () => {
    expect(mainStatValue(game, { rarity: 5, slot: "HEAD", mainStat: "HP", level: 15 })).toBeCloseTo(705.6, 3);
    const relics = [relic("HEAD", "HP", "101", [{ key: "CRIT Rate", value: 10 }]), relic("HAND", "ATK", "101", [{ key: "SPD", value: 5 }]), relic("BODY", "CRIT Rate", "102", [])];
    const t = computeStats(game, owned, { uid: "l", profileId: "p", lcId: "9", level: 80, ascension: 6, superimposition: 1, location: "1", lock: true, source: "manual", updatedAt: "" }, relics);
    expect(t.base).toEqual({ hp: 1100, atk: 600, def: 500, spd: 100 });
    expect(t.hp).toBeCloseTo(1100 + 705.6, 3);
    expect(t.atk).toBeCloseTo(600 + 352.8, 3);
    expect(t.spd).toBeCloseTo(100 * 1.1 + 5 + 5, 6); // LC +10% SPD, trace +5, sub +5
    // 5% base + 10% trace + 10% sub + 8% (Crit Set 2pc) + 32.33% body main
    expect(t.critRate).toBeCloseTo(0.05 + 0.1 + 0.1 + 0.08 + 0.0518 + 0.0181 * 15, 6);
    expect(t.def).toBeCloseTo(500, 6); // Def Set has 1 piece only: no bonus
  });
});

describe("build evaluation", () => {
  it("grades relics, penalises wrong mains and lists what is lacking", () => {
    const relics = [relic("HEAD", "HP", "101", [{ key: "CRIT Rate", value: 3.24 * 3 }, { key: "CRIT DMG", value: 6.48 * 3 }, { key: "SPD", value: 2.6 * 2 }, { key: "DEF", value: 20 }]), relic("BODY", "DEF%", "102", [{ key: "CRIT Rate", value: 3.24 * 5 }])];
    const t = computeStats(game, owned, null, relics);
    const e = evaluateBuild(game, owned, relics, profile, t, null);
    const head = e.slots.find((s) => s.slot === "HEAD")!;
    expect(head.grade!.letter).toMatch(/^(SS|SSS|WTF)$/);
    const body = e.slots.find((s) => s.slot === "BODY")!;
    expect(body.effective).toBeCloseTo(body.score!.score * 0.5, 6);
    expect(e.lacks.join("\n")).toMatch(/No Hands, Feet, Planar Sphere, Link Rope equipped/);
    expect(e.lacks.join("\n")).toMatch(/Body main is DEF%/);
    expect(e.lacks.join("\n")).toMatch(/CRIT Rate .* \(target 70%\)/);
    expect(e.lacks.join("\n")).toMatch(/No Light Cone equipped/);
    expect(e.overall.score).toBeCloseTo(e.slots.reduce((s, x) => s + x.effective, 0) / 6, 6);
  });
  it("recommends sets and light cones that match the profile", () => {
    const r = recommendBuild(game, "1", profile, { relics: [], lightCones: [] });
    expect(r.cavern[0].name).toBe("Crit Set");
    expect(r.cavern.some((s) => s.name === "Def Set")).toBe(false);
    expect(r.substatPriority.map((s) => s.key)).toEqual(["CRIT Rate", "CRIT DMG", "SPD"]);
    expect(r.lightCones.map((l) => l.lcId)).toEqual(["9"]);
    expect(r.caveats[0]).toMatch(/not a community guide/);
  });
});
