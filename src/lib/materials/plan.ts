import { kitTrees, type GameData, type SrrSkillTree } from "../gamedata/types";
import type { OwnedCharacter } from "../types";
import { ascensionCost, mergeTotals, traceCost, type MaterialTotals, type SkillTreeNode, type TraceState } from "./calculator";

export interface CharacterTarget {
  ascension: number;
  basic: number;
  skill: number;
  ult: number;
  talent: number;
  /** Raise any other levelled nodes (memosprite, Elation skills…) to max. */
  extrasMax: boolean;
  unlockAllTraces: boolean;
}

export const FULL_TARGET: CharacterTarget = { ascension: 6, basic: 6, skill: 10, ult: 10, talent: 10, extrasMax: true, unlockAllTraces: true };

const ANCHOR_SKILL: Record<string, "basic" | "skill" | "ult" | "talent"> = { Point01: "basic", Point02: "skill", Point03: "ult", Point04: "talent" };

/** Major traces (have a name/description) ordered like HSR Scanner's ability_1..3; stat nodes like stat_1..10. */
export function classifyNodes(nodes: SrrSkillTree[]) {
  const unlockables = nodes.filter((n) => n.max_level === 1 && n.levels[0]?.materials.length);
  const byOrder = (a: SrrSkillTree, b: SrrSkillTree) => (a.levels[0].promotion - b.levels[0].promotion) || a.anchor.localeCompare(b.anchor, undefined, { numeric: true });
  const abilities = unlockables.filter((n) => n.name && !n.levels[0].properties.length).sort(byOrder);
  const stats = unlockables.filter((n) => n.levels[0].properties.length).sort(byOrder);
  const levelled = nodes.filter((n) => n.max_level > 1);
  return { abilities, stats, levelled };
}

export function currentTraceState(nodes: SrrSkillTree[], owned: OwnedCharacter | null): TraceState {
  const { abilities, stats, levelled } = classifyNodes(nodes);
  const levels: Record<string, number> = {};
  for (const n of levelled) {
    const key = ANCHOR_SKILL[n.anchor];
    levels[n.id] = owned && key ? owned.skills[key] ?? 1 : n.levels[0]?.materials.length ? 0 : 1;
  }
  abilities.forEach((n, i) => (levels[n.id] = owned?.traces[`ability_${i + 1}`] ? 1 : 0));
  stats.forEach((n, i) => (levels[n.id] = owned?.traces[`stat_${i + 1}`] ? 1 : 0));
  return { levels };
}

export function targetTraceState(nodes: SrrSkillTree[], current: TraceState, t: CharacterTarget): TraceState {
  const { abilities, stats, levelled } = classifyNodes(nodes);
  const levels = { ...current.levels };
  for (const n of levelled) {
    const key = ANCHOR_SKILL[n.anchor];
    const want = key ? Math.min(n.max_level, t[key]) : t.extrasMax ? n.max_level : levels[n.id];
    levels[n.id] = Math.max(levels[n.id] ?? 0, want);
  }
  if (t.unlockAllTraces) for (const n of [...abilities, ...stats]) levels[n.id] = 1;
  return { levels };
}

export interface CharacterPlanResult {
  totals: MaterialTotals;
  blocked: { nodeId: string; name: string; needsAscension: number }[];
  notes: string[];
}

export function planCharacter(game: GameData, charId: string, owned: OwnedCharacter | null, target: CharacterTarget): CharacterPlanResult {
  const c = game.characters[charId];
  if (!c) throw new Error(`Character ${charId} is not in the game data.`);
  const promo = game.characterPromotions[charId];
  // Original kit only: an enhanced kit reuses the same progress, so counting both would double costs.
  const nodes = kitTrees(c, "original").map((id) => game.characterSkillTrees[id]).filter(Boolean);
  const fromAsc = owned?.ascension ?? 0;
  const toAsc = Math.max(fromAsc, target.ascension);
  const asc = promo ? ascensionCost(promo.materials, fromAsc, toAsc) : new Map<string, number>();
  const cur = currentTraceState(nodes, owned);
  const tgt = targetTraceState(nodes, cur, target);
  const traces = traceCost(nodes as SkillTreeNode[], cur, tgt, toAsc);
  const notes = [
    "Character level-up EXP materials and their Credits are not included (EXP tables are not in the data source).",
  ];
  if (!promo) notes.push("No ascension table found for this character.");
  if (!owned) notes.push("Character not owned: costs are from Level 1, Ascension 0, no traces.");
  return { totals: mergeTotals(asc, traces.totals), blocked: traces.blocked, notes };
}

export function planLightCone(game: GameData, lcId: string, fromAscension: number, toAscension: number): MaterialTotals {
  const p = game.lightConePromotions[lcId];
  if (!p) throw new Error(`Light Cone ${lcId} has no ascension data.`);
  return ascensionCost(p.materials, fromAscension, toAscension);
}
