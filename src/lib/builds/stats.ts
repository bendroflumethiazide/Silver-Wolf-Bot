/**
 * Total-stat calculator: character base + Light Cone base, then every unconditional bonus from
 * relic main/sub stats, unlocked minor traces, relic set bonuses and the Light Cone passive.
 * Conditional effects (e.g. "after using Skill…") are NOT included — that needs combat simulation.
 */
import { classifyNodes } from "../materials/plan";
import { statAt } from "../gamedata/stats";
import { kitTrees, type GameData } from "../gamedata/types";
import { isPercentStat, PROPERTY_TO_STAT, type MainStatKey, type RelicSlot } from "../relics/stats";
import type { OwnedCharacter, OwnedLightCone, Relic } from "../types";

export const SLOT_INDEX: Record<RelicSlot, number> = { HEAD: 1, HAND: 2, BODY: 3, FOOT: 4, NECK: 5, OBJECT: 6 };

const STAT_TO_PROPERTY: Record<string, string> = Object.fromEntries(Object.entries(PROPERTY_TO_STAT).map(([p, s]) => [s, p]));

export interface TotalStats {
  hp: number; atk: number; def: number; spd: number;
  critRate: number; critDmg: number; ehr: number; res: number; be: number; err: number; ohb: number;
  /** Element DMG bonus, e.g. { Quantum: 0.388 }, plus "All". */
  dmg: Record<string, number>;
  base: { hp: number; atk: number; def: number; spd: number };
  /** Other properties found (e.g. Elation DMG), raw sums. */
  other: Record<string, number>;
  notes: string[];
}

/** Value of a relic's main stat, in raw game units (fractions for percentages). */
export function mainStatValue(game: GameData, r: Pick<Relic, "rarity" | "slot" | "mainStat" | "level">): number | null {
  const group = game.relicMainAffixes[`${r.rarity}${SLOT_INDEX[r.slot]}`];
  const prop = STAT_TO_PROPERTY[r.mainStat];
  const aff = group && Object.values(group.affixes).find((a) => a.property === prop);
  return aff ? aff.base + aff.step * r.level : null;
}

export function computeStats(game: GameData, c: OwnedCharacter, lc: OwnedLightCone | null, relics: Relic[]): TotalStats {
  const ch = game.characters[c.charId];
  const promo = game.characterPromotions[c.charId]?.values;
  const notes: string[] = [];
  const sum: Record<string, number> = {};
  const add = (prop: string, v: number) => { sum[prop] = (sum[prop] ?? 0) + v; };

  const base = {
    hp: statAt(promo, "hp", c.level, c.ascension) ?? 0,
    atk: statAt(promo, "atk", c.level, c.ascension) ?? 0,
    def: statAt(promo, "def", c.level, c.ascension) ?? 0,
    spd: statAt(promo, "spd", c.level, c.ascension) ?? 0,
  };
  const crBase = statAt(promo, "crit_rate", c.level, c.ascension) ?? 0.05;
  const cdBase = statAt(promo, "crit_dmg", c.level, c.ascension) ?? 0.5;

  if (lc && game.lightCones[lc.lcId]) {
    const lv = game.lightConePromotions[lc.lcId]?.values;
    base.hp += statAt(lv, "hp", lc.level, lc.ascension) ?? 0;
    base.atk += statAt(lv, "atk", lc.level, lc.ascension) ?? 0;
    base.def += statAt(lv, "def", lc.level, lc.ascension) ?? 0;
    if (ch && game.lightCones[lc.lcId].path === ch.path) {
      for (const p of game.lightConeRanks[lc.lcId]?.properties?.[lc.superimposition - 1] ?? []) add(p.type, p.value);
    } else notes.push("Light Cone Path doesn't match: its passive is inactive.");
  }

  for (const r of relics) {
    const mv = mainStatValue(game, r);
    if (mv === null) notes.push(`Couldn't resolve main stat value for ${r.slot} (${r.mainStat}).`);
    else add(STAT_TO_PROPERTY[r.mainStat], mv);
    for (const s of r.substats) add(STAT_TO_PROPERTY[s.key], isPercentStat(s.key) ? s.value / 100 : s.value);
  }

  if (ch) {
    const nodes = kitTrees(ch, "original").map((id) => game.characterSkillTrees[id]).filter(Boolean);
    classifyNodes(nodes).stats.forEach((n, i) => { if (c.traces[`stat_${i + 1}`]) for (const p of n.levels[0]?.properties ?? []) add(p.type, p.value); });
  }

  const counts = new Map<string, number>();
  for (const r of relics) counts.set(r.setId, (counts.get(r.setId) ?? 0) + 1);
  for (const [setId, n] of counts) {
    const props = game.relicSets[setId]?.properties ?? [];
    if (n >= 2) for (const p of props[0] ?? []) add(p.type, p.value);
    if (n >= 4 && Number(setId) < 300) for (const p of props[1] ?? []) add(p.type, p.value);
  }

  const g = (k: string) => sum[k] ?? 0;
  const known = new Set(["HPDelta", "AttackDelta", "DefenceDelta", "HPAddedRatio", "AttackAddedRatio", "DefenceAddedRatio", "SpeedDelta", "SpeedAddedRatio",
    "CriticalChanceBase", "CriticalDamageBase", "StatusProbabilityBase", "StatusResistanceBase", "BreakDamageAddedRatioBase", "SPRatioBase", "HealRatioBase", "AllDamageTypeAddedRatio"]);
  const dmg: Record<string, number> = { All: g("AllDamageTypeAddedRatio") };
  const other: Record<string, number> = {};
  for (const [k, v] of Object.entries(sum)) {
    const m = /^(Physical|Fire|Ice|Thunder|Wind|Quantum|Imaginary)AddedRatio$/.exec(k);
    if (m) dmg[m[1]] = v;
    else if (!known.has(k)) other[k] = v;
  }

  return {
    hp: base.hp * (1 + g("HPAddedRatio")) + g("HPDelta"),
    atk: base.atk * (1 + g("AttackAddedRatio")) + g("AttackDelta"),
    def: base.def * (1 + g("DefenceAddedRatio")) + g("DefenceDelta"),
    spd: base.spd * (1 + g("SpeedAddedRatio")) + g("SpeedDelta"),
    critRate: crBase + g("CriticalChanceBase"),
    critDmg: cdBase + g("CriticalDamageBase"),
    ehr: g("StatusProbabilityBase"),
    res: g("StatusResistanceBase"),
    be: g("BreakDamageAddedRatioBase"),
    err: 1 + g("SPRatioBase"),
    ohb: g("HealRatioBase"),
    dmg, base, other, notes,
  };
}

/** Value of a total stat in the same display units as profile targets. */
export function displayStat(t: TotalStats, k: MainStatKey | "Energy Regeneration Rate"): number {
  switch (k) {
    case "SPD": return t.spd;
    case "CRIT Rate": return t.critRate * 100;
    case "CRIT DMG": return t.critDmg * 100;
    case "Effect Hit Rate": return t.ehr * 100;
    case "Effect RES": return t.res * 100;
    case "Break Effect": return t.be * 100;
    case "Energy Regeneration Rate": return t.err * 100;
    default: return NaN;
  }
}
