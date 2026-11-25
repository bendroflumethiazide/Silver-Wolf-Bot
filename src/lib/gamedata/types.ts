/** Subset of the StarRailRes index format that the app reads. Field names mirror the source. */

export interface SrrPath { id: string; text: string; name: string; desc: string; icon: string }
export interface SrrElement { id: string; name: string; desc: string; color: string; icon: string }
export interface SrrCharacter {
  id: string; name: string; tag: string; rarity: number; path: string; element: string; max_sp: number;
  ranks: string[]; skills: string[]; skill_trees: string[]; icon: string; preview: string; portrait: string;
}
export interface SrrRank { id: string; name: string; rank: number; desc: string; materials: { id: string; num: number }[]; icon: string }
export interface SrrSkill {
  id: string; name: string; max_level: number; element: string; type: string; type_text: string;
  effect: string; effect_text: string; simple_desc: string; desc: string; params: number[][]; icon: string;
}
export interface SrrSkillTree {
  id: string; name: string; max_level: number; desc: string; params: number[][]; anchor: string; pre_points: string[];
  level_up_skills: { id: string; num: number }[];
  levels: { promotion: number; level: number; properties: { type: string; value: number }[]; materials: { id: string; num: number }[] }[];
  icon: string;
}
export interface StatGrowth { base: number; step: number }
export interface SrrCharacterPromotion {
  id: string;
  values: Record<string, StatGrowth>[];
  materials: { id: string; num: number }[][];
}
export interface SrrLightCone { id: string; name: string; rarity: number; path: string; desc: string; icon: string; preview: string; portrait: string }
export interface SrrLightConeRank { id: string; skill: string; desc: string; params: number[][]; properties: { type: string; value: number }[][] }
export interface SrrLightConePromotion { id: string; values: Record<string, StatGrowth>[]; materials: { id: string; num: number }[][] }
export interface SrrRelicSet { id: string; name: string; desc: string[]; properties: { type: string; value: number }[][]; icon: string }
export interface SrrRelic { id: string; set_id: string; name: string; rarity: number; type: string; max_level: number; main_affix_id: string; sub_affix_id: string; icon: string }
export interface SrrAffixGroup { id: string; affixes: Record<string, { affix_id: string; property: string; base: number; step: number; step_num?: number }> }
export interface SrrItem { id: string; name: string; type: string; sub_type: string; rarity: number; icon: string; come_from: string[] }
export interface SrrAchievement { id: string; series_id: string; title: string; desc: string; hide_desc: string; hide: boolean }
export interface SrrBlessing { id: string; name: string; desc: string; enhanced_desc: string }
export interface SrrCurio { id: string; name: string; desc: string; bg_desc: string; icon: string }
export interface SrrSimEvent { id: string; name: string; type: string; image: string }
export interface SrrDescription { id: string; title: string; desc: string }

export interface GameData {
  version: string;
  timestamp: number;
  language: string;
  downloadedAt: string;
  sourceBase: string;
  paths: Record<string, SrrPath>;
  elements: Record<string, SrrElement>;
  characters: Record<string, SrrCharacter>;
  characterRanks: Record<string, SrrRank>;
  characterSkills: Record<string, SrrSkill>;
  characterSkillTrees: Record<string, SrrSkillTree>;
  characterPromotions: Record<string, SrrCharacterPromotion>;
  lightCones: Record<string, SrrLightCone>;
  lightConeRanks: Record<string, SrrLightConeRank>;
  lightConePromotions: Record<string, SrrLightConePromotion>;
  relicSets: Record<string, SrrRelicSet>;
  relics: Record<string, SrrRelic>;
  relicMainAffixes: Record<string, SrrAffixGroup>;
  relicSubAffixes: Record<string, SrrAffixGroup>;
  items: Record<string, SrrItem>;
  achievements: Record<string, SrrAchievement>;
  blessings: Record<string, SrrBlessing>;
  curios: Record<string, SrrCurio>;
  simEvents: Record<string, SrrSimEvent>;
  nicknames: { characters?: Record<string, string[]> };
  descriptions: Record<string, SrrDescription>;
}

/** Display names of internal Path ids. */
export const PATH_DISPLAY: Record<string, string> = {
  Warrior: "Destruction", Rogue: "The Hunt", Mage: "Erudition", Shaman: "Harmony", Warlock: "Nihility",
  Knight: "Preservation", Priest: "Abundance", Memory: "Remembrance", Elation: "Elation",
};

export const ELEMENT_DISPLAY: Record<string, string> = { Thunder: "Lightning" };
export const elementName = (e: string) => ELEMENT_DISPLAY[e] ?? e;
export const pathName = (p: string) => PATH_DISPLAY[p] ?? p;

/** Trailblazer variants share one name with a {NICKNAME} placeholder. */
export function characterDisplayName(c: SrrCharacter): string {
  if (c.name === "{NICKNAME}") return `Trailblazer (${pathName(c.path)})`;
  return c.name;
}

/** Strip StarRailRes inline markup (<unbreak>, <color>, etc.) for plain text display. */
export function stripMarkup(s: string): string {
  return s.replace(/<\/?[a-z][^>]*>/gi, "").replace(/\\n/g, "\n");
}

/** Fill `#1[i]%` style parameters with values for the given level (1-indexed). */
export function formatSkillDesc(desc: string, params: number[][] | undefined, level: number): string {
  const row = params?.[Math.max(0, Math.min((params?.length ?? 1) - 1, level - 1))] ?? [];
  return stripMarkup(desc).replace(/#(\d+)\[(i|f1|f2)\](%?)/g, (_m, idx: string, fmt: string, pct: string) => {
    const v = row[Number(idx) - 1];
    if (v === undefined) return "?";
    const n = pct ? v * 100 : v;
    const out = fmt === "i" ? Math.round(n).toString() : n.toFixed(fmt === "f1" ? 1 : 2);
    return out + pct;
  });
}
