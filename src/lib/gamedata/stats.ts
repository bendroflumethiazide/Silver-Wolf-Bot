import type { StatGrowth } from "./types";

/** Base stat at a level within an ascension phase: base + step × (level − 1). Matches in-game values. */
export function statAt(values: Record<string, StatGrowth>[] | undefined, key: string, level: number, ascension: number): number | null {
  const row = values?.[Math.max(0, Math.min(values.length - 1, ascension))];
  const g = row?.[key];
  if (!g) return null;
  return g.base + g.step * (level - 1);
}

/** Sum of trace stat bonuses (properties of unlocked minor trace nodes). */
export function sumProperties(list: { type: string; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of list) out[p.type] = (out[p.type] ?? 0) + p.value;
  return out;
}
