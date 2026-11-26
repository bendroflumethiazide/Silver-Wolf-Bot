import { describe, expect, it } from "vitest";
import type { GameData } from "../gamedata/types";
import { planScan } from "../importers/apply";
import { parseFribbelsSave } from "../importers/fribbels";
import type { OwnedCharacter, OwnedLightCone } from "../types";

const game = {
  version: "test",
  relicSets: { "104": { id: "104", name: "Hunter of Glacial Forest" }, "305": { id: "305", name: "Rutilant Arena" } },
  characters: { "1212": { id: "1212", name: "Jingliu" }, "1006": { id: "1006", name: "Silver Wolf" } },
  lightCones: { "23014": { id: "23014", name: "I Shall Be My Own Sword" }, "23007": { id: "23007", name: "Incessant Rain" } },
} as unknown as GameData;

const save = {
  relics: [
    { id: "a", part: "Head", set: "Hunter of Glacial Forest", enhance: 15, grade: 5, main: { stat: "HP", value: 705.6 }, substats: [{ stat: "CRIT Rate", value: 11.016 }, { stat: "SPD", value: 2.3 }], equippedBy: "1212b1" },
    { id: "b", part: "PlanarSphere", set: "Rutilant Arena", enhance: 12, grade: 5, main: { stat: "Ice DMG Boost", value: 30 }, substats: [], equippedBy: undefined },
    { id: "c", part: "Body", set: "Hunter of Glacial Forest", enhance: 15, grade: 5, main: { stat: "SPD", value: 25 }, substats: [] },
    { id: "d", part: "Feet", set: "Not A Real Set", enhance: 0, grade: 5, main: { stat: "SPD", value: 4 }, substats: [] },
  ],
  characters: [
    { id: "1212b1", form: { characterLevel: 80, characterEidolon: 1, lightCone: "23014", lightConeLevel: 80, lightConeSuperimposition: 2 } },
    { id: "9999", form: { characterLevel: 80 } },
  ],
};

describe("Fribbels save import", () => {
  const existing: OwnedCharacter[] = [{ key: "p:1212", profileId: "p", charId: "1212", level: 70, ascension: 5, eidolon: 0, skills: { basic: 6, skill: 10, ult: 10, talent: 10 }, traces: { ability_1: true }, source: "hsr-scanner", updatedAt: "" }];
  const p = parseFribbelsSave(save, "p", game, existing, "2026-01-01T00:00:00Z");

  it("maps sets by name, slots, equipped character (variant ids) and substats", () => {
    expect(p.relics).toHaveLength(2);
    expect(p.relics[0]).toMatchObject({ setId: "104", slot: "HEAD", rarity: 5, level: 15, mainStat: "HP", location: "1212", source: "fribbels" });
    expect(p.relics[0].substats).toEqual([{ key: "CRIT Rate", value: 11.016 }, { key: "SPD", value: 2.3 }]);
    expect(p.relics[1]).toMatchObject({ slot: "NECK", location: "" });
  });
  it("reports what it had to skip instead of guessing", () => {
    expect(p.issues.join(" ")).toMatch(/main stat "SPD" isn't valid for Body/);
    expect(p.issues.join(" ")).toMatch(/set "Not A Real Set"/);
    expect(p.issues.join(" ")).toMatch(/Character 9999/);
  });
  it("updates level and Eidolon but keeps your traces", () => {
    expect(p.characters[0]).toMatchObject({ charId: "1212", level: 80, ascension: 6, eidolon: 1 });
    expect(p.characters[0].skills.skill).toBe(10);
    expect(p.characters[0].traces).toEqual({ ability_1: true });
  });
  it("imports equipped Light Cones without deleting the rest of your Light Cones", () => {
    expect(p.lightCones).toEqual([expect.objectContaining({ lcId: "23014", superimposition: 2, location: "1212", ascension: 6 })]);
    const mine: OwnedLightCone = { uid: "lc1", profileId: "p", lcId: "23007", level: 80, ascension: 6, superimposition: 1, location: "", lock: false, source: "hsr-scanner", updatedAt: "" };
    const plan = planScan({ characters: existing, lightCones: [mine], relics: [] }, p, { lightConesAreFullInventory: false });
    expect(plan.lightCones.some((r) => r.kind === "removed")).toBe(false);
    expect(plan.lightCones.filter((r) => r.kind === "new")).toHaveLength(1);
  });
  it("rejects files that aren't Fribbels saves", () => {
    expect(() => parseFribbelsSave({ hello: 1 }, "p", game, [])).toThrow(/Not a Fribbels optimizer save/);
  });
});
