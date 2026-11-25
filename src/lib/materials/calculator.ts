/** Material requirement calculator. Uses StarRailRes promotion and skill-tree cost tables only. */

export interface MaterialCost {
  id: string;
  num: number;
}

export interface SkillTreeLevel {
  promotion: number;
  level: number;
  materials: MaterialCost[];
}

export interface SkillTreeNode {
  id: string;
  name: string;
  max_level: number;
  anchor: string;
  pre_points: string[];
  levels: SkillTreeLevel[];
}

/** Level caps by ascension (promotion) phase 0–6. */
export const LEVEL_CAP_BY_ASCENSION = [20, 30, 40, 50, 60, 70, 80] as const;

export function ascensionForLevel(level: number): number {
  const i = LEVEL_CAP_BY_ASCENSION.findIndex((cap) => level <= cap);
  return i === -1 ? 6 : i;
}

export type MaterialTotals = Map<string, number>;

function add(t: MaterialTotals, list: MaterialCost[] | undefined, times = 1) {
  for (const m of list ?? []) t.set(m.id, (t.get(m.id) ?? 0) + m.num * times);
}

/** promotionMaterials[i] = cost to ascend from phase i to phase i+1. */
export function ascensionCost(promotionMaterials: MaterialCost[][], from: number, to: number): MaterialTotals {
  if (from < 0 || to > 6 || from > to) throw new RangeError("ascension must satisfy 0 ≤ from ≤ to ≤ 6");
  const t: MaterialTotals = new Map();
  for (let i = from; i < to; i++) add(t, promotionMaterials[i]);
  return t;
}

export interface TraceState {
  /** Current level of each node (0 = locked / not owned). */
  levels: Record<string, number>;
}

export interface TraceCostResult {
  totals: MaterialTotals;
  /** Nodes whose target exceeds what the target ascension allows. */
  blocked: { nodeId: string; name: string; needsAscension: number }[];
}

/**
 * Cost to raise trace nodes from current to target levels. levels[k] holds the requirement for
 * reaching level k+1; level 1 of basic/skill/ult/talent is free (empty materials).
 */
export function traceCost(
  nodes: SkillTreeNode[],
  current: TraceState,
  target: TraceState,
  targetAscension: number,
): TraceCostResult {
  const totals: MaterialTotals = new Map();
  const blocked: TraceCostResult["blocked"] = [];
  for (const node of nodes) {
    const from = Math.max(0, Math.min(node.max_level, current.levels[node.id] ?? 0));
    const to = Math.max(0, Math.min(node.max_level, target.levels[node.id] ?? from));
    for (let lv = from + 1; lv <= to; lv++) {
      const step = node.levels[lv - 1];
      if (!step) continue;
      if (step.promotion > targetAscension) {
        blocked.push({ nodeId: node.id, name: node.name || node.anchor, needsAscension: step.promotion });
        break;
      }
      add(totals, step.materials);
    }
  }
  return { totals, blocked };
}

export function mergeTotals(...all: MaterialTotals[]): MaterialTotals {
  const t: MaterialTotals = new Map();
  for (const m of all) for (const [k, v] of m) t.set(k, (t.get(k) ?? 0) + v);
  return t;
}

export interface MaterialRow {
  id: string;
  required: number;
  owned: number;
  missing: number;
}

export function compareWithInventory(required: MaterialTotals, inventory: Record<string, number>): MaterialRow[] {
  return [...required.entries()]
    .map(([id, req]) => {
      const owned = Math.max(0, inventory[id] ?? 0);
      return { id, required: req, owned, missing: Math.max(0, req - owned) };
    })
    .sort((a, b) => (a.id === "2" ? -1 : b.id === "2" ? 1 : b.missing - a.missing));
}

/** Target state helper: every node at its maximum level. */
export function maxedTraces(nodes: SkillTreeNode[]): TraceState {
  return { levels: Object.fromEntries(nodes.map((n) => [n.id, n.max_level])) };
}

/** Baseline state for a newly obtained character: level-1 skills owned, nothing unlocked. */
export function freshTraces(nodes: SkillTreeNode[]): TraceState {
  return {
    levels: Object.fromEntries(
      nodes.map((n) => [n.id, n.levels[0] && n.levels[0].materials.length === 0 ? 1 : 0]),
    ),
  };
}
