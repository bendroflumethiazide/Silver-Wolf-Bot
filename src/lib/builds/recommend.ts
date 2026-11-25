/**
 * Silver Wolf's recommended build, derived ONLY from game data and the character's scoring profile.
 * No community guide is involved. Set ranking uses each set's unconditional stat bonuses; conditional
 * effects (most 4-piece effects) are shown as text but not scored, and the UI says so.
 */
import type { GameData } from "../gamedata/types";
import { stripMarkup } from "../gamedata/types";
import type { ScoringProfile } from "../relics/scoring";
import { SUBSTAT_MAX_ROLL, type RelicSlot, type SubStatKey } from "../relics/stats";
import type { OwnedLightCone, Relic } from "../types";

export interface SetPick { setId: string; name: string; score: number; reasons: string[]; ownedPieces: number; effects: string[] }
export interface LcPick { lcId: string; name: string; rarity: number; owned: boolean; matched: string[] }

export interface Recommendation {
  mainStats: Partial<Record<RelicSlot, string[]>>;
  substatPriority: { key: SubStatKey; weight: number }[];
  cavern: SetPick[];
  planar: SetPick[];
  lightCones: LcPick[];
  caveats: string[];
}

/** Weight of a set/LC bonus property for this profile, plus the value of one "roll" of it. */
function propertyWeight(prop: string, profile: ScoringProfile, element: string): { weight: number; roll: number; label: string } | null {
  const w = (k: SubStatKey) => profile.weights[k] ?? 0;
  const r = (k: SubStatKey) => SUBSTAT_MAX_ROLL[5][k] / 100;
  switch (prop) {
    case "AttackAddedRatio": return { weight: w("ATK%"), roll: r("ATK%"), label: "ATK%" };
    case "HPAddedRatio": return { weight: w("HP%"), roll: r("HP%"), label: "HP%" };
    case "DefenceAddedRatio": return { weight: w("DEF%"), roll: r("DEF%"), label: "DEF%" };
    case "CriticalChanceBase": return { weight: w("CRIT Rate"), roll: r("CRIT Rate"), label: "CRIT Rate" };
    case "CriticalDamageBase": return { weight: w("CRIT DMG"), roll: r("CRIT DMG"), label: "CRIT DMG" };
    case "StatusProbabilityBase": return { weight: w("Effect Hit Rate"), roll: r("Effect Hit Rate"), label: "Effect Hit Rate" };
    case "StatusResistanceBase": return { weight: w("Effect RES"), roll: r("Effect RES"), label: "Effect RES" };
    case "BreakDamageAddedRatioBase": return { weight: w("Break Effect"), roll: r("Break Effect"), label: "Break Effect" };
    case "SpeedAddedRatio": return { weight: w("SPD"), roll: 0.026, label: "SPD%" }; // ≈ 2.6 SPD on a ~100 SPD base
    case "SpeedDelta": return { weight: w("SPD"), roll: 2.6, label: "SPD" };
    case "SPRatioBase": return { weight: (profile.mainStats.OBJECT ?? []).includes("Energy Regeneration Rate") ? 0.6 : 0.2, roll: 0.02, label: "Energy Regen" };
    case "HealRatioBase": return { weight: (profile.mainStats.BODY ?? []).includes("Outgoing Healing Boost") ? 1 : 0, roll: 0.03, label: "Outgoing Healing" };
    case "AllDamageTypeAddedRatio": return { weight: (profile.weights["CRIT DMG"] ?? 0) > 0.5 || (profile.weights["ATK%"] ?? 0) > 0.5 ? 0.8 : 0.2, roll: 0.04, label: "DMG%" };
    default: {
      const m = /^(\w+)AddedRatio$/.exec(prop);
      if (m && ["Physical", "Fire", "Ice", "Thunder", "Wind", "Quantum", "Imaginary"].includes(m[1]))
        return { weight: m[1] === element ? 0.9 : 0, roll: 0.04, label: `${m[1] === "Thunder" ? "Lightning" : m[1]} DMG` };
      return null;
    }
  }
}

export function recommendBuild(
  game: GameData,
  charId: string,
  profile: ScoringProfile,
  inventory: { relics: Relic[]; lightCones: OwnedLightCone[] },
): Recommendation {
  const ch = game.characters[charId];
  const element = ch?.element ?? "";
  const scoreSet = (setId: string, planar: boolean): SetPick => {
    const set = game.relicSets[setId];
    const reasons: string[] = [];
    let score = 0;
    (set.properties ?? []).slice(0, planar ? 1 : 2).forEach((list, i) => {
      for (const p of list ?? []) {
        const pw = propertyWeight(p.type, profile, element);
        if (!pw || pw.weight <= 0) continue;
        const rolls = (p.value / pw.roll) * pw.weight;
        score += rolls;
        reasons.push(`${i === 0 ? "2pc" : "4pc"} +${pw.label}`);
      }
    });
    const ownedPieces = inventory.relics.filter((r) => r.setId === setId).length;
    return { setId, name: set.name, score, reasons, ownedPieces, effects: set.desc.map(stripMarkup) };
  };
  const all = Object.values(game.relicSets);
  const rank = (planar: boolean) => all.filter((s) => (Number(s.id) >= 300) === planar).map((s) => scoreSet(s.id, planar))
    .filter((s) => s.score > 0).sort((a, b) => b.score - a.score || b.ownedPieces - a.ownedPieces).slice(0, 3);

  const lcScore = (lcId: string) => {
    const props = game.lightConeRanks[lcId]?.properties?.[0] ?? [];
    const matched: string[] = [];
    let score = 0;
    for (const p of props) { const pw = propertyWeight(p.type, profile, element); if (pw && pw.weight > 0) { score += (p.value / pw.roll) * pw.weight; matched.push(pw.label); } }
    return { score, matched };
  };
  const owned = new Set(inventory.lightCones.map((l) => l.lcId));
  const lightCones = Object.values(game.lightCones).filter((l) => ch && l.path === ch.path)
    .map((l) => ({ l, ...lcScore(l.id) }))
    .sort((a, b) => b.l.rarity - a.l.rarity || b.score - a.score || Number(owned.has(b.l.id)) - Number(owned.has(a.l.id)))
    .slice(0, 6)
    .map(({ l, matched }) => ({ lcId: l.id, name: l.name, rarity: l.rarity, owned: owned.has(l.id), matched }));

  return {
    mainStats: profile.mainStats,
    substatPriority: (Object.entries(profile.weights) as [SubStatKey, number][]).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).map(([key, weight]) => ({ key, weight })),
    cavern: rank(false),
    planar: rank(true),
    lightCones,
    caveats: [
      "Derived from this character's scoring profile and game data — not a community guide.",
      "Sets are ranked on their always-on stat bonuses only. Most 4-piece effects are conditional; read them before committing.",
      "Light Cones are listed by Path and rarity; passive effects are not simulated.",
    ],
  };
}

export interface SavedBuild {
  id: string;
  name: string;
  source?: string;
  sourceUrl?: string;
  lightCone?: string;
  cavernSets: string[];
  planarSet?: string;
  mainStats: Partial<Record<RelicSlot, string>>;
  substats: string;
  notes?: string;
  createdAt: string;
}
