import { z } from "zod";
import { poolForGachaType } from "../warp/rules";
import type { WarpRecord } from "../warp/history";

const TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

const Item = z.object({
  gacha_id: z.union([z.string(), z.number()]).transform(String).optional(),
  gacha_type: z.union([z.string(), z.number()]).transform(String),
  item_id: z.union([z.string(), z.number()]).transform(String).optional(),
  count: z.union([z.string(), z.number()]).optional(),
  time: z.string().regex(TIME_RE, "time must be 'YYYY-MM-DD HH:mm:ss'"),
  name: z.string().optional(),
  item_type: z.string().optional(),
  rank_type: z.union([z.string(), z.number()]).transform(String).optional(),
  id: z.union([z.string(), z.number()]).transform(String),
});

const UigfV4 = z.object({
  info: z.object({ version: z.string(), export_app: z.string().optional() }),
  hkrpg: z.array(z.object({ uid: z.union([z.string(), z.number()]).transform(String), timezone: z.number(), lang: z.string().optional(), list: z.array(Item) })),
});

const Srgf = z.object({
  info: z.object({ uid: z.union([z.string(), z.number()]).transform(String), srgf_version: z.string(), region_time_zone: z.number().optional(), lang: z.string().optional() }),
  list: z.array(Item),
});

export interface WarpImport {
  format: "uigf" | "srgf" | "csv";
  accounts: { uid: string; timezone?: number; records: WarpRecord[] }[];
  issues: string[];
}

function toRecord(it: z.infer<typeof Item>, profileId: string, source: WarpRecord["source"], issues: string[]): WarpRecord | null {
  const pool = poolForGachaType(it.gacha_type);
  if (!pool) { issues.push(`Record ${it.id}: unknown gacha_type ${it.gacha_type} — skipped.`); return null; }
  const rank = Number(it.rank_type);
  if (rank !== 3 && rank !== 4 && rank !== 5) { issues.push(`Record ${it.id}: missing or invalid rank_type — skipped.`); return null; }
  if (it.count && String(it.count) !== "1") issues.push(`Record ${it.id}: count ${it.count} treated as 1 pull.`);
  return {
    id: it.id,
    profileId,
    pool,
    gachaType: it.gacha_type,
    gachaId: it.gacha_id,
    itemId: it.item_id,
    name: it.name ?? it.item_id ?? "Unknown",
    itemType: it.item_type ?? "",
    rank: rank as 3 | 4 | 5,
    time: it.time,
    source,
  };
}

/** Parse UIGF v4 (hkrpg section) or SRGF v1 JSON. Throws with a readable message on invalid input. */
export function parseWarpJson(json: unknown, profileId: string): WarpImport {
  const issues: string[] = [];
  const u = UigfV4.safeParse(json);
  if (u.success) {
    if (!/^v4\./.test(u.data.info.version)) issues.push(`UIGF ${u.data.info.version}: only v4.x is fully supported.`);
    return {
      format: "uigf",
      accounts: u.data.hkrpg.map((acc) => ({
        uid: acc.uid,
        timezone: acc.timezone,
        records: acc.list.map((it) => toRecord(it, profileId, "uigf", issues)).filter((r): r is WarpRecord => !!r),
      })),
      issues,
    };
  }
  const s = Srgf.safeParse(json);
  if (s.success) {
    return {
      format: "srgf",
      accounts: [{
        uid: s.data.info.uid,
        timezone: s.data.info.region_time_zone,
        records: s.data.list.map((it) => toRecord(it, profileId, "srgf", issues)).filter((r): r is WarpRecord => !!r),
      }],
      issues,
    };
  }
  throw new Error("File is neither UIGF v4 (with an \"hkrpg\" section) nor SRGF v1. Star Rail data in UIGF v3 or older is not supported.");
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

/**
 * CSV columns (header names, case-insensitive): time, name, rank, gacha_type,
 * optional: id, item_id, item_type, gacha_id. Rows must be one pull each.
 */
export function parseWarpCsv(text: string, profileId: string): WarpImport {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) throw new Error("CSV has no data rows.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n: string) => header.indexOf(n);
  for (const req of ["time", "name", "rank", "gacha_type"])
    if (col(req) === -1) throw new Error(`CSV is missing the required column "${req}".`);
  const issues: string[] = [];
  const records: WarpRecord[] = [];
  rows.slice(1).forEach((r, i) => {
    const get = (n: string) => (col(n) >= 0 ? (r[col(n)] ?? "").trim() : "");
    const parsed = Item.safeParse({
      gacha_type: get("gacha_type"), time: get("time"), name: get("name"), rank_type: get("rank"),
      item_id: get("item_id") || undefined, item_type: get("item_type") || undefined, gacha_id: get("gacha_id") || undefined,
      id: get("id") || `csv-${get("time")}-${i}`,
    });
    if (!parsed.success) { issues.push(`Row ${i + 2}: ${parsed.error.issues[0].message} — skipped.`); return; }
    const rec = toRecord(parsed.data, profileId, "csv", issues);
    if (rec) records.push({ ...rec, seq: i });
  });
  return { format: "csv", accounts: [{ uid: "", records }], issues };
}

export function warpRecordsToCsv(records: WarpRecord[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const head = "id,time,name,rank,gacha_type,item_id,item_type,gacha_id,source";
  return [head, ...records.map((r) => [r.id, r.time, r.name, String(r.rank), r.gachaType, r.itemId ?? "", r.itemType, r.gachaId ?? "", r.source].map(esc).join(","))].join("\n");
}

/** Split incoming warp records into new vs already-present (by record id). */
export function diffWarpRecords(existing: WarpRecord[], incoming: WarpRecord[]) {
  const have = new Set(existing.map((r) => r.id));
  const seen = new Set<string>();
  const fresh: WarpRecord[] = [];
  let duplicates = 0;
  for (const r of incoming) {
    if (have.has(r.id) || seen.has(r.id)) { duplicates++; continue; }
    seen.add(r.id);
    fresh.push(r);
  }
  return { fresh, duplicates };
}
