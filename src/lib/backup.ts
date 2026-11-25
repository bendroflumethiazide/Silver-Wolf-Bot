import { getDb, PERSONAL_TABLES, type PersonalTable } from "./db";

export const BACKUP_APP = "astral-companion";
export const BACKUP_SCHEMA = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  schema: number;
  exportedAt: string;
  tables: Partial<Record<PersonalTable, unknown[]>>;
}

async function blobToDataUrl(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${b.type || "application/octet-stream"};base64,${btoa(bin)}`;
}

function dataUrlToBlob(s: string): Blob {
  const m = /^data:([^;]*);base64,(.*)$/.exec(s);
  if (!m) throw new Error("Invalid embedded image in backup.");
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m[1] });
}

/** Export every personal table. Game data snapshots are excluded (they can be re-downloaded). */
export async function createBackup(): Promise<BackupFile> {
  const db = getDb();
  const tables: BackupFile["tables"] = {};
  for (const t of PERSONAL_TABLES) {
    const rows = await db.table(t).toArray();
    if (t === "mapZones")
      tables[t] = await Promise.all(rows.map(async (z) => (z.image instanceof Blob ? { ...z, image: await blobToDataUrl(z.image) } : z)));
    else tables[t] = rows;
  }
  return { app: BACKUP_APP, schema: BACKUP_SCHEMA, exportedAt: new Date().toISOString(), tables };
}

export function validateBackup(json: unknown): BackupFile {
  const b = json as Partial<BackupFile>;
  if (!b || b.app !== BACKUP_APP) throw new Error("This file is not an Astral Companion backup.");
  if (typeof b.schema !== "number" || b.schema > BACKUP_SCHEMA)
    throw new Error(`Backup schema ${String(b.schema)} is newer than this app supports (${BACKUP_SCHEMA}).`);
  if (!b.tables || typeof b.tables !== "object") throw new Error("Backup has no tables.");
  for (const [k, v] of Object.entries(b.tables)) {
    if (!(PERSONAL_TABLES as readonly string[]).includes(k)) throw new Error(`Unknown table "${k}" in backup.`);
    if (!Array.isArray(v)) throw new Error(`Table "${k}" in backup is not a list.`);
  }
  return b as BackupFile;
}

/** Replace all personal data with the backup contents, atomically. */
export async function restoreBackup(b: BackupFile): Promise<Record<string, number>> {
  const db = getDb();
  const counts: Record<string, number> = {};
  // The active game-data pointer belongs to this device, not to the backup.
  const active = await db.kv.get("activeSnapshot");
  await db.transaction("rw", PERSONAL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of PERSONAL_TABLES) {
      await db.table(t).clear();
      let rows = (b.tables[t] ?? []) as Record<string, unknown>[];
      if (t === "mapZones") rows = rows.map((z) => (typeof z.image === "string" ? { ...z, image: dataUrlToBlob(z.image) } : z));
      await db.table(t).bulkPut(rows);
      counts[t] = rows.length;
    }
    await db.kv.delete("activeSnapshot");
    if (active) await db.kv.put(active);
  });
  return counts;
}

/** Delete every personal record. Optionally also downloaded game data and cached images. */
export async function deleteAllPersonalData(opts: { includeGameData: boolean }) {
  const db = getDb();
  const active = await db.kv.get("activeSnapshot");
  await db.transaction("rw", PERSONAL_TABLES.map((t) => db.table(t)), async () => {
    for (const t of PERSONAL_TABLES) await db.table(t).clear();
    if (active && !opts.includeGameData) await db.kv.put(active);
  });
  if (opts.includeGameData) {
    await db.gameSnapshots.clear();
    if (typeof caches !== "undefined") await caches.delete(ASSET_CACHE);
  }
}

export const ASSET_CACHE = "astral-assets-v1";

export function downloadJson(name: string, data: unknown) {
  downloadText(name, JSON.stringify(data, null, 2), "application/json");
}
export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
