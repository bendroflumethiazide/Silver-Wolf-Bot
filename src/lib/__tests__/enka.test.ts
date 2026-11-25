import { describe, expect, it } from "vitest";
import { parseEnka } from "../connectors/enka";
import type { GameData } from "../gamedata/types";

const lv = (promotion: number, materials = [{ id: "2", num: 1 }], properties: { type: string; value: number }[] = []) => ({ promotion, level: 0, properties, materials });
const game = {
  version: "4.7.0",
  characters: { "1006": { id: "1006", name: "Silver Wolf", rarity: 5, path: "Warlock", element: "Quantum", skills: [], ranks: [], skill_trees: ["1006001", "1006002", "1006003", "1006004", "1006101", "1006201", "1006202"] } },
  characterSkillTrees: {
    "1006001": { id: "1006001", name: "", max_level: 6, anchor: "Point01", levels: [lv(0, [])] },
    "1006002": { id: "1006002", name: "", max_level: 10, anchor: "Point02", levels: [lv(0, [])] },
    "1006003": { id: "1006003", name: "", max_level: 10, anchor: "Point03", levels: [lv(0, [])] },
    "1006004": { id: "1006004", name: "", max_level: 10, anchor: "Point04", levels: [lv(0, [])] },
    "1006101": { id: "1006101", name: "Generate", max_level: 1, anchor: "Point06", levels: [lv(2)] },
    "1006201": { id: "1006201", name: "ATK Boost", max_level: 1, anchor: "Point09", levels: [lv(0, undefined, [{ type: "AttackAddedRatio", value: 0.04 }])] },
    "1006202": { id: "1006202", name: "EHR Boost", max_level: 1, anchor: "Point10", levels: [lv(2, undefined, [{ type: "StatusProbabilityBase", value: 0.04 }])] },
  },
  lightCones: { "23007": { id: "23007", name: "Incessant Rain", rarity: 5, path: "Warlock" } },
  relics: { "61011": { id: "61011", set_id: "101", name: "Hairstick", rarity: 5, type: "HEAD", max_level: 15, main_affix_id: "51", sub_affix_id: "5" } },
  relicMainAffixes: { "51": { id: "51", affixes: { "1": { affix_id: "1", property: "HPDelta", base: 112.896, step: 39.5136 } } } },
  relicSubAffixes: { "5": { id: "5", affixes: {
    "8": { affix_id: "8", property: "CriticalChanceBase", base: 0.02592, step: 0.00324 },
    "7": { affix_id: "7", property: "SpeedDelta", base: 2, step: 0.3 },
  } } },
} as unknown as GameData;

describe("Enka showcase parser", () => {
  it("maps profile, character, light cone and relic values", () => {
    const raw = {
      detailInfo: {
        uid: 800000001, nickname: "Tester", level: 70, worldLevel: 6, isDisplayAvatar: true,
        recordInfo: { achievementCount: 512, avatarCount: 40, equipmentCount: 120 },
        avatarDetailList: [{
          avatarId: 1006, level: 80, promotion: 6, rank: 2,
          skillTreeList: [{ pointId: 1006001, level: 6 }, { pointId: 1006002, level: 10 }, { pointId: 1006003, level: 10 }, { pointId: 1006004, level: 8 }, { pointId: 1006101, level: 1 }, { pointId: 1006202, level: 1 }],
          equipment: { tid: 23007, level: 80, promotion: 6 },
          relicList: [{ tid: 61011, type: 1, level: 15, mainAffixId: 1, subAffixList: [{ affixId: 8, cnt: 3, step: 4 }, { affixId: 7, cnt: 2 }] }, { tid: 99999 }],
        }],
        assistAvatarList: [{ avatarId: 9999 }],
      },
      ttl: 60,
    };
    const p = parseEnka(raw, game, "p", "T");
    expect(p.profile).toMatchObject({ uid: "800000001", name: "Tester", trailblazeLevel: 70, equilibriumLevel: 6, source: "enka", stats: { achievements: 512, relics: 0 } });
    const c = p.characters[0];
    expect(c).toMatchObject({ charId: "1006", level: 80, ascension: 6, eidolon: 2, skills: { basic: 6, skill: 10, ult: 10, talent: 8 }, source: "enka" });
    expect(c.traces).toEqual({ ability_1: true, stat_1: false, stat_2: true });
    expect(p.lightCones[0]).toMatchObject({ lcId: "23007", superimposition: 1, location: "1006" }); // rank omitted → S1
    expect(p.relics[0]).toMatchObject({ slot: "HEAD", mainStat: "HP", level: 15, rarity: 5 });
    // CRIT Rate: 3 × 2.592% + 4 × 0.324% = 9.072%; SPD: 2 × 2 + 0 = 4
    expect(p.relics[0].substats).toEqual([{ key: "CRIT Rate", value: 9.072 }, { key: "SPD", value: 4 }]);
    expect(p.warnings.join(" ")).toMatch(/Relic 99999/);
    expect(p.warnings.join(" ")).toMatch(/Character 9999/);
  });
  it("rejects unrelated payloads", () => {
    expect(() => parseEnka({ hello: 1 }, game, "p")).toThrow(/Unexpected showcase format/);
  });
});
