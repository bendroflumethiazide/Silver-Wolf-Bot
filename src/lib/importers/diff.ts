import type { DataSource } from "../types";

export type DiffKind = "new" | "changed" | "unchanged" | "conflict" | "removed";

export interface DiffRow<T> {
  kind: DiffKind;
  key: string;
  before: T | null;
  after: T | null;
  /** Human-readable list of changed fields. */
  changes: string[];
}

/**
 * Keyed diff between stored records and an import. Records the user typed by hand ("manual")
 * are never silently overwritten or removed: such cases are reported as "conflict" and need approval.
 */
export function diffByKey<T extends { source: DataSource }>(
  existing: T[],
  incoming: T[],
  keyOf: (t: T) => string,
  compareFields: (keyof T)[],
  opts: { removeMissing: boolean },
): DiffRow<T>[] {
  const before = new Map(existing.map((e) => [keyOf(e), e]));
  const rows: DiffRow<T>[] = [];
  const seen = new Set<string>();
  for (const inc of incoming) {
    const k = keyOf(inc);
    if (seen.has(k)) continue; // duplicates inside the file: first wins
    seen.add(k);
    const old = before.get(k) ?? null;
    if (!old) { rows.push({ kind: "new", key: k, before: null, after: inc, changes: [] }); continue; }
    const changes = compareFields.filter((f) => JSON.stringify(old[f]) !== JSON.stringify(inc[f])).map(String);
    if (!changes.length) rows.push({ kind: "unchanged", key: k, before: old, after: inc, changes });
    else rows.push({ kind: old.source === "manual" ? "conflict" : "changed", key: k, before: old, after: inc, changes });
  }
  if (opts.removeMissing)
    for (const [k, old] of before)
      if (!seen.has(k)) rows.push({ kind: old.source === "manual" ? "conflict" : "removed", key: k, before: old, after: null, changes: ["(not in import)"] });
  return rows;
}

export function countDiff<T>(rows: DiffRow<T>[]): Record<DiffKind, number> {
  const c: Record<DiffKind, number> = { new: 0, changed: 0, unchanged: 0, conflict: 0, removed: 0 };
  for (const r of rows) c[r.kind]++;
  return c;
}
