import {
  MAX_LEVEL_BY_RARITY, SUB_STATS, SUBSTAT_MAX_ROLL,
  type MainStatKey, type RelicSlot, type SubStatKey,
} from "./stats";

export interface RelicSubstat {
  key: SubStatKey;
  value: number;
}

export interface RelicLike {
  slot: RelicSlot;
  rarity: 2 | 3 | 4 | 5;
  level: number;
  mainStat: MainStatKey;
  substats: RelicSubstat[];
}

/**
 * A scoring profile belongs to ONE character. Templates exist only as starting points; the user is
 * expected to adjust weights per character. Weight 0 = useless, 1 = top priority.
 */
export interface ScoringProfile {
  id: string;
  name: string;
  weights: Partial<Record<SubStatKey, number>>;
  /** Acceptable main stats per slot (Head/Hands have fixed mains). */
  mainStats: Partial<Record<RelicSlot, MainStatKey[]>>;
  /** Where the weights came from — shown in the UI next to every score. */
  origin: "template" | "user";
  templateId?: string;
  note?: string;
}

export interface ScoreBreakdownRow {
  key: SubStatKey;
  value: number;
  weight: number;
  rolls: number;
  weightedRolls: number;
}

export interface RelicScore {
  /** Weighted roll count of current substats (1.0 = one max-value roll of a weight-1 stat). */
  weightedRolls: number;
  /** Best achievable weighted rolls for this slot/main stat at max level. */
  idealRolls: number;
  /** 0–100, current weighted rolls relative to the ideal. */
  score: number;
  /** Expected score at max level assuming uniform upgrade targets and average roll size (90%). */
  expectedAtMax: number;
  /** Best-case score at max level (all remaining upgrades hit the best present stat at max roll). */
  bestCaseAtMax: number;
  remainingUpgrades: number;
  mainStatFits: boolean;
  verdict: "keep" | "good" | "usable" | "fodder";
  breakdown: ScoreBreakdownRow[];
}

const AVERAGE_ROLL = 0.9; // three equally likely roll tiers: 80%, 90%, 100%

export function upgradesRemaining(r: RelicLike): number {
  const max = MAX_LEVEL_BY_RARITY[r.rarity];
  return Math.max(0, Math.floor(max / 3) - Math.floor(Math.min(r.level, max) / 3));
}

export function idealWeightedRolls(profile: ScoringProfile, r: Pick<RelicLike, "rarity" | "mainStat">): number {
  const candidates = SUB_STATS.filter((k) => k !== r.mainStat)
    .map((k) => profile.weights[k] ?? 0)
    .sort((a, b) => b - a);
  const lines = 4;
  const upgrades = Math.floor(MAX_LEVEL_BY_RARITY[r.rarity] / 3); // 5 for 5★
  // Best case: 4 initial lines on the top-weighted stats, then every upgrade on the best one (4+5 = 9 rolls for 5★).
  return candidates.slice(0, lines).reduce((s, w) => s + w, 0) + (upgrades - (lines - 4)) * (candidates[0] ?? 0);
}

export function scoreRelic(r: RelicLike, profile: ScoringProfile): RelicScore {
  const maxRoll = SUBSTAT_MAX_ROLL[r.rarity];
  const breakdown = r.substats.map<ScoreBreakdownRow>((s) => {
    const weight = profile.weights[s.key] ?? 0;
    const rolls = s.value / maxRoll[s.key];
    return { key: s.key, value: s.value, weight, rolls, weightedRolls: rolls * weight };
  });
  const weighted = breakdown.reduce((sum, b) => sum + b.weightedRolls, 0);
  const ideal = idealWeightedRolls(profile, r);
  const remaining = upgradesRemaining(r);

  // With 3 lines, the first upgrade adds a 4th line (unknown stat) instead of rolling an existing one.
  const newLine = r.substats.length < 4 && remaining > 0 ? 1 : 0;
  const present = breakdown.map((b) => b.weight);
  const avgPresent = present.length ? present.reduce((a, b) => a + b, 0) / present.length : 0;
  const unknownLineExpectation = expectedNewLineWeight(profile, r);
  const expected = weighted + newLine * unknownLineExpectation * AVERAGE_ROLL + (remaining - newLine) * avgPresent * AVERAGE_ROLL;
  const bestPresent = Math.max(0, ...present, newLine ? bestNewLineWeight(profile, r) : 0);
  const best = weighted + newLine * bestNewLineWeight(profile, r) + (remaining - newLine) * bestPresent;

  const pct = (x: number) => (ideal > 0 ? Math.min(100, (x / ideal) * 100) : 0);
  const allowed = profile.mainStats[r.slot];
  const mainStatFits = !allowed || allowed.length === 0 || allowed.includes(r.mainStat);
  const score = pct(weighted);
  const judged = remaining > 0 ? pct(expected) : score;
  const verdict: RelicScore["verdict"] = !mainStatFits
    ? "fodder"
    : judged >= 70 ? "keep" : judged >= 50 ? "good" : judged >= 30 ? "usable" : "fodder";

  return {
    weightedRolls: weighted,
    idealRolls: ideal,
    score,
    expectedAtMax: pct(expected),
    bestCaseAtMax: pct(best),
    remainingUpgrades: remaining,
    mainStatFits,
    verdict,
    breakdown,
  };
}

function newLineCandidates(profile: ScoringProfile, r: RelicLike): number[] {
  const taken = new Set<string>([r.mainStat, ...r.substats.map((s) => s.key)]);
  return SUB_STATS.filter((k) => !taken.has(k)).map((k) => profile.weights[k] ?? 0);
}
function expectedNewLineWeight(profile: ScoringProfile, r: RelicLike): number {
  const c = newLineCandidates(profile, r);
  return c.length ? c.reduce((a, b) => a + b, 0) / c.length : 0;
}
function bestNewLineWeight(profile: ScoringProfile, r: RelicLike): number {
  return Math.max(0, ...newLineCandidates(profile, r));
}

/**
 * Starting templates. These are generic role archetypes, NOT character-specific recommendations.
 * The UI labels any profile with origin "template" as unverified until the user edits it.
 */
export const PROFILE_TEMPLATES: ScoringProfile[] = [
  {
    id: "tpl-crit-atk", name: "Crit DPS (ATK scaling)", origin: "template",
    weights: { "CRIT Rate": 1, "CRIT DMG": 1, "ATK%": 0.75, SPD: 0.75, ATK: 0.3 },
    mainStats: { BODY: ["CRIT Rate", "CRIT DMG"], FOOT: ["SPD", "ATK%"], NECK: ["ATK%"], OBJECT: ["ATK%", "Energy Regeneration Rate"] },
  },
  {
    id: "tpl-crit-hp", name: "Crit DPS (HP scaling)", origin: "template",
    weights: { "CRIT Rate": 1, "CRIT DMG": 1, "HP%": 0.75, SPD: 0.75, HP: 0.3 },
    mainStats: { BODY: ["CRIT Rate", "CRIT DMG"], FOOT: ["SPD", "HP%"], NECK: ["HP%"], OBJECT: ["HP%", "Energy Regeneration Rate"] },
  },
  {
    id: "tpl-break", name: "Break DPS", origin: "template",
    weights: { "Break Effect": 1, SPD: 1, "ATK%": 0.5, ATK: 0.2 },
    mainStats: { BODY: ["ATK%"], FOOT: ["SPD"], NECK: ["ATK%"], OBJECT: ["Break Effect", "Energy Regeneration Rate"] },
  },
  {
    id: "tpl-dot", name: "DoT / Effect Hit Rate DPS", origin: "template",
    weights: { "ATK%": 1, SPD: 1, "Effect Hit Rate": 0.75, ATK: 0.4, "Break Effect": 0.25 },
    mainStats: { BODY: ["ATK%", "Effect Hit Rate"], FOOT: ["SPD", "ATK%"], NECK: ["ATK%"], OBJECT: ["ATK%", "Energy Regeneration Rate"] },
  },
  {
    id: "tpl-support-spd", name: "Support (Speed)", origin: "template",
    weights: { SPD: 1, "HP%": 0.5, "DEF%": 0.5, "Effect RES": 0.5, HP: 0.2, DEF: 0.2 },
    mainStats: { FOOT: ["SPD"], OBJECT: ["Energy Regeneration Rate"] },
  },
  {
    id: "tpl-debuffer", name: "Debuffer (Effect Hit Rate)", origin: "template",
    weights: { SPD: 1, "Effect Hit Rate": 1, "HP%": 0.3, "DEF%": 0.3, "Effect RES": 0.3 },
    mainStats: { BODY: ["Effect Hit Rate"], FOOT: ["SPD"], OBJECT: ["Energy Regeneration Rate"] },
  },
  {
    id: "tpl-healer", name: "Healer (HP)", origin: "template",
    weights: { SPD: 1, "HP%": 1, "Effect RES": 0.5, HP: 0.4, "DEF%": 0.3 },
    mainStats: { BODY: ["Outgoing Healing Boost", "HP%"], FOOT: ["SPD", "HP%"], NECK: ["HP%"], OBJECT: ["Energy Regeneration Rate", "HP%"] },
  },
  {
    id: "tpl-shielder", name: "Shielder (DEF)", origin: "template",
    weights: { "DEF%": 1, SPD: 1, "Effect RES": 0.5, DEF: 0.4, "HP%": 0.3 },
    mainStats: { BODY: ["DEF%"], FOOT: ["SPD", "DEF%"], NECK: ["DEF%"], OBJECT: ["DEF%", "Energy Regeneration Rate"] },
  },
];

/** Path-based suggestion of a template. Only a suggestion: many characters break their Path's archetype. */
export function suggestTemplate(path: string): string {
  switch (path) {
    case "Shaman": return "tpl-support-spd"; // Harmony
    case "Warlock": return "tpl-debuffer"; // Nihility
    case "Priest": return "tpl-healer"; // Abundance
    case "Knight": return "tpl-shielder"; // Preservation
    default: return "tpl-crit-atk"; // Destruction, Hunt, Erudition, Remembrance, Elation…
  }
}
