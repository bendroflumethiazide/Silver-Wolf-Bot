/** Relic stat vocabulary shared by importers, inventory, and the optimizer. Values are stored in
 *  display units: percentages as percent numbers (5.1 = 5.1%), flat stats as raw numbers. */

export type RelicSlot = "HEAD" | "HAND" | "BODY" | "FOOT" | "NECK" | "OBJECT";
export const RELIC_SLOTS: RelicSlot[] = ["HEAD", "HAND", "BODY", "FOOT", "NECK", "OBJECT"];
export const SLOT_LABEL: Record<RelicSlot, string> = {
  HEAD: "Head",
  HAND: "Hands",
  BODY: "Body",
  FOOT: "Feet",
  NECK: "Planar Sphere",
  OBJECT: "Link Rope",
};

export type SubStatKey =
  | "HP" | "ATK" | "DEF" | "HP%" | "ATK%" | "DEF%" | "SPD"
  | "CRIT Rate" | "CRIT DMG" | "Effect Hit Rate" | "Effect RES" | "Break Effect";

export type MainStatKey =
  | SubStatKey
  | "Outgoing Healing Boost" | "Energy Regeneration Rate"
  | "Physical DMG Boost" | "Fire DMG Boost" | "Ice DMG Boost" | "Lightning DMG Boost"
  | "Wind DMG Boost" | "Quantum DMG Boost" | "Imaginary DMG Boost";

export const SUB_STATS: SubStatKey[] = [
  "HP", "ATK", "DEF", "HP%", "ATK%", "DEF%", "SPD",
  "CRIT Rate", "CRIT DMG", "Effect Hit Rate", "Effect RES", "Break Effect",
];

export const ELEMENT_DMG: MainStatKey[] = [
  "Physical DMG Boost", "Fire DMG Boost", "Ice DMG Boost", "Lightning DMG Boost",
  "Wind DMG Boost", "Quantum DMG Boost", "Imaginary DMG Boost",
];

/** Possible main stats per slot (game rules). */
export const MAIN_STATS_BY_SLOT: Record<RelicSlot, MainStatKey[]> = {
  HEAD: ["HP"],
  HAND: ["ATK"],
  BODY: ["HP%", "ATK%", "DEF%", "CRIT Rate", "CRIT DMG", "Outgoing Healing Boost", "Effect Hit Rate"],
  FOOT: ["HP%", "ATK%", "DEF%", "SPD"],
  NECK: ["HP%", "ATK%", "DEF%", ...ELEMENT_DMG],
  OBJECT: ["Break Effect", "Energy Regeneration Rate", "HP%", "ATK%", "DEF%"],
};

/**
 * Maximum single-roll value of each substat by relic rarity, in display units.
 * Derived from StarRailRes `relic_sub_affixes.json` (game 4.7): max = base + step × step_num.
 */
export const SUBSTAT_MAX_ROLL: Record<2 | 3 | 4 | 5, Record<SubStatKey, number>> = {
  5: { HP: 42.3375, ATK: 21.1688, DEF: 21.1688, "HP%": 4.32, "ATK%": 4.32, "DEF%": 5.4, SPD: 2.6, "CRIT Rate": 3.24, "CRIT DMG": 6.48, "Effect Hit Rate": 4.32, "Effect RES": 4.32, "Break Effect": 6.48 },
  4: { HP: 33.87, ATK: 16.935, DEF: 16.935, "HP%": 3.456, "ATK%": 3.456, "DEF%": 4.32, SPD: 2.0, "CRIT Rate": 2.592, "CRIT DMG": 5.184, "Effect Hit Rate": 3.456, "Effect RES": 3.456, "Break Effect": 5.184 },
  3: { HP: 25.4025, ATK: 12.7013, DEF: 12.7013, "HP%": 2.592, "ATK%": 2.592, "DEF%": 3.24, SPD: 1.4, "CRIT Rate": 1.944, "CRIT DMG": 3.888, "Effect Hit Rate": 2.592, "Effect RES": 2.592, "Break Effect": 3.888 },
  2: { HP: 16.935, ATK: 8.4675, DEF: 8.4675, "HP%": 1.728, "ATK%": 1.728, "DEF%": 2.16, SPD: 1.2, "CRIT Rate": 1.296, "CRIT DMG": 2.592, "Effect Hit Rate": 1.728, "Effect RES": 1.728, "Break Effect": 2.592 },
};

export const MAX_LEVEL_BY_RARITY: Record<2 | 3 | 4 | 5, number> = { 2: 6, 3: 9, 4: 12, 5: 15 };

/** HSR Scanner substat keys ("_" suffix = percentage). */
const SCANNER_SUB: Record<string, SubStatKey> = {
  HP: "HP", ATK: "ATK", DEF: "DEF", HP_: "HP%", ATK_: "ATK%", DEF_: "DEF%", SPD: "SPD",
  "CRIT Rate_": "CRIT Rate", "CRIT DMG_": "CRIT DMG", "Effect Hit Rate_": "Effect Hit Rate",
  "Effect RES_": "Effect RES", "Break Effect_": "Break Effect",
};

export function scannerSubStat(key: string): SubStatKey | null {
  return SCANNER_SUB[key] ?? null;
}

/** HSR Scanner main stat names never carry "_"; HP/ATK/DEF are flat only on Head/Hands. */
export function scannerMainStat(key: string, slot: RelicSlot): MainStatKey | null {
  if (key === "HP") return slot === "HEAD" ? "HP" : "HP%";
  if (key === "ATK") return slot === "HAND" ? "ATK" : "ATK%";
  if (key === "DEF") return "DEF%";
  const direct = (MAIN_STATS_BY_SLOT[slot] as string[]).includes(key) ? (key as MainStatKey) : null;
  return direct;
}

const SCANNER_SLOT: Record<string, RelicSlot> = {
  Head: "HEAD", Hands: "HAND", Body: "BODY", Feet: "FOOT", "Planar Sphere": "NECK", "Link Rope": "OBJECT",
};
export function scannerSlot(s: string): RelicSlot | null {
  return SCANNER_SLOT[s] ?? null;
}

/** StarRailRes property names → our keys (used by Enka showcase parsing). */
export const PROPERTY_TO_STAT: Record<string, MainStatKey> = {
  HPDelta: "HP", AttackDelta: "ATK", DefenceDelta: "DEF",
  HPAddedRatio: "HP%", AttackAddedRatio: "ATK%", DefenceAddedRatio: "DEF%",
  SpeedDelta: "SPD", CriticalChanceBase: "CRIT Rate", CriticalDamageBase: "CRIT DMG",
  StatusProbabilityBase: "Effect Hit Rate", StatusResistanceBase: "Effect RES",
  BreakDamageAddedRatioBase: "Break Effect", HealRatioBase: "Outgoing Healing Boost",
  SPRatioBase: "Energy Regeneration Rate",
  PhysicalAddedRatio: "Physical DMG Boost", FireAddedRatio: "Fire DMG Boost", IceAddedRatio: "Ice DMG Boost",
  ThunderAddedRatio: "Lightning DMG Boost", WindAddedRatio: "Wind DMG Boost",
  QuantumAddedRatio: "Quantum DMG Boost", ImaginaryAddedRatio: "Imaginary DMG Boost",
};

export function isPercentStat(k: MainStatKey): boolean {
  return !(k === "HP" || k === "ATK" || k === "DEF" || k === "SPD");
}

export function formatStat(k: MainStatKey, v: number): string {
  return isPercentStat(k) ? `${v.toFixed(1)}%` : k === "SPD" ? v.toFixed(1) : Math.round(v).toString();
}
