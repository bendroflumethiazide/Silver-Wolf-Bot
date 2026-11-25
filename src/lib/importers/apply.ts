import { getDb, newId, nowIso } from "../db";
import type { ImportHistoryEntry, OwnedCharacter, OwnedLightCone, Relic } from "../types";
import { diffByKey, type DiffRow } from "./diff";
import { lightConeFingerprint, relicFingerprint, type ParsedScan } from "./hsrScanner";

/** Key items by content fingerprint plus an occurrence counter, so identical duplicates stay distinct. */
function keyByOccurrence<T>(items: T[], fp: (t: T) => string): Map<T, string> {
  const seen = new Map<string, number>();
  const out = new Map<T, string>();
  for (const it of items) {
    const f = fp(it);
    const n = seen.get(f) ?? 0;
    seen.set(f, n + 1);
    out.set(it, `${f}#${n}`);
  }
  return out;
}

export interface ScanPlan {
  characters: DiffRow<OwnedCharacter>[];
  lightCones: DiffRow<OwnedLightCone>[];
  relics: DiffRow<Relic>[];
}

/**
 * Compare a parsed scan with stored inventory.
 * - Characters merge by id (a scan may cover only some characters; missing ones are kept).
 * - Light Cones and relics are treated as a full inventory snapshot: items missing from the scan
 *   are proposed for removal (upgraded items show as one removal + one addition).
 */
export function planScan(existing: { characters: OwnedCharacter[]; lightCones: OwnedLightCone[]; relics: Relic[] }, scan: ParsedScan): ScanPlan {
  const characters = diffByKey(existing.characters, scan.characters, (c) => c.charId, ["level", "ascension", "eidolon", "skills", "traces"], { removeMissing: false });

  const lcKeysOld = keyByOccurrence(existing.lightCones, lightConeFingerprint);
  const lcKeysNew = keyByOccurrence(scan.lightCones, lightConeFingerprint);
  const lightCones = diffByKey(existing.lightCones, scan.lightCones, (l) => lcKeysOld.get(l) ?? lcKeysNew.get(l)!, ["location", "lock"], { removeMissing: true });

  const rKeysOld = keyByOccurrence(existing.relics, relicFingerprint);
  const rKeysNew = keyByOccurrence(scan.relics, relicFingerprint);
  const relics = diffByKey(existing.relics, scan.relics, (r) => rKeysOld.get(r) ?? rKeysNew.get(r)!, ["location", "lock"], { removeMissing: true });

  return { characters, lightCones, relics };
}

export interface ApplyOptions {
  categories: { characters: boolean; lightCones: boolean; relics: boolean };
  /** Keys of conflict rows the user explicitly approved. */
  approvedConflicts: Set<string>;
  fileName?: string;
}

type Undo = ImportHistoryEntry["undo"];

/** Write an approved plan. Records the prior state of every touched row so the import can be rolled back. */
export async function applyScanPlan(plan: ScanPlan, opts: ApplyOptions): Promise<{ written: number; removed: number; historyId: string }> {
  const db = getDb();
  const undo: Undo = [];
  let written = 0;
  let removed = 0;
  await db.transaction("rw", [db.characters, db.lightCones, db.relics, db.importHistory], async () => {
    const take = <T,>(r: DiffRow<T>) => r.kind === "new" || r.kind === "changed" || r.kind === "removed" || (r.kind === "conflict" && opts.approvedConflicts.has(r.key));

    if (opts.categories.characters)
      for (const r of plan.characters.filter(take)) {
        // Keep user-only fields (favourite, build status) that a scan does not carry.
        const row = { ...(r.before ?? {}), ...r.after! };
        undo.push({ table: "characters", key: row.key, before: r.before ?? null });
        await db.characters.put(row);
        written++;
      }

    const handleInventory = async <T extends { uid: string }>(rows: DiffRow<T>[], table: "lightCones" | "relics") => {
      for (const r of rows.filter(take)) {
        if (r.after === null) {
          undo.push({ table, key: r.before!.uid, before: r.before });
          await db.table(table).delete(r.before!.uid);
          removed++;
        } else {
          const uid = r.before?.uid ?? newId(table === "relics" ? "relic" : "lc");
          const row = { ...r.after, uid };
          undo.push({ table, key: uid, before: r.before ?? null });
          await db.table(table).put(row);
          written++;
        }
      }
    };
    if (opts.categories.lightCones) await handleInventory(plan.lightCones, "lightCones");
    if (opts.categories.relics) await handleInventory(plan.relics, "relics");
  });
  const historyId = newId("import");
  await db.importHistory.put({
    id: historyId, kind: "hsr-scanner", fileName: opts.fileName, importedAt: nowIso(),
    summary: `${written} written, ${removed} removed (${Object.entries(opts.categories).filter(([, v]) => v).map(([k]) => k).join(", ")})`,
    undo,
  });
  return { written, removed, historyId };
}

/** Restore every row touched by an import to its prior state. */
export async function rollbackImport(id: string) {
  const db = getDb();
  const entry = await db.importHistory.get(id);
  if (!entry) throw new Error("Import not found.");
  if (entry.rolledBack) throw new Error("This import was already rolled back.");
  const tables = [...new Set(entry.undo.map((u) => u.table))];
  await db.transaction("rw", [...tables.map((t) => db.table(t)), db.importHistory], async () => {
    for (const u of [...entry.undo].reverse()) {
      if (u.before === null) await db.table(u.table).delete(u.key);
      else await db.table(u.table).put(u.before);
    }
    await db.importHistory.update(id, { rolledBack: true });
  });
}
