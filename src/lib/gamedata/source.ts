import { z } from "zod";
import { getDb, kvGet, kvSet, nowIso, type GameSnapshot } from "../db";
import type { GameData } from "./types";

/**
 * Game data comes from StarRailRes (https://github.com/Mar-7th/StarRailRes, AGPL-3.0; game content © HoYoverse).
 * It is downloaded on demand into the user's browser only. Nothing is bundled with or redistributed by this app.
 */
export const SOURCE = {
  name: "StarRailRes",
  repo: "https://github.com/Mar-7th/StarRailRes",
  license: "AGPL-3.0",
  rawBase: "https://raw.githubusercontent.com/Mar-7th/StarRailRes/master/",
  ipNotice: "Game text, data and images © COGNOSPHERE / HoYoverse. Used for personal, non-commercial reference.",
} as const;

export const LANGUAGES = [
  { code: "en", label: "English" }, { code: "cn", label: "简体中文" }, { code: "jp", label: "日本語" },
  { code: "kr", label: "한국어" }, { code: "de", label: "Deutsch" }, { code: "fr", label: "Français" },
  { code: "es", label: "Español" }, { code: "ru", label: "Русский" },
] as const;

/** file name in StarRailRes → key in GameData */
export const FILES: Record<string, keyof GameData> = {
  paths: "paths", elements: "elements", characters: "characters", character_ranks: "characterRanks",
  character_skills: "characterSkills", character_skill_trees: "characterSkillTrees",
  character_promotions: "characterPromotions", light_cones: "lightCones", light_cone_ranks: "lightConeRanks",
  light_cone_promotions: "lightConePromotions", relic_sets: "relicSets", relics: "relics",
  relic_main_affixes: "relicMainAffixes", relic_sub_affixes: "relicSubAffixes", items: "items",
  achievements: "achievements", simulated_blessings: "blessings", simulated_curios: "curios",
  simulated_events: "simEvents", nickname: "nicknames", descriptions: "descriptions",
};

const Info = z.object({ version: z.string(), timestamp: z.number(), folder: z.string().optional() });
export type SourceInfo = z.infer<typeof Info>;

const IdRecord = z.record(z.string(), z.object({ id: z.string() }).passthrough());
const Required: Partial<Record<string, z.ZodTypeAny>> = {
  characters: z.record(z.string(), z.object({ id: z.string(), name: z.string(), rarity: z.number(), path: z.string(), element: z.string(), skill_trees: z.array(z.string()) }).passthrough()),
  light_cones: z.record(z.string(), z.object({ id: z.string(), name: z.string(), rarity: z.number(), path: z.string() }).passthrough()),
  relic_sets: z.record(z.string(), z.object({ id: z.string(), name: z.string(), desc: z.array(z.string()) }).passthrough()),
  items: z.record(z.string(), z.object({ id: z.string(), name: z.string() }).passthrough()),
  achievements: z.record(z.string(), z.object({ id: z.string(), title: z.string(), series_id: z.string() }).passthrough()),
};

type Fetcher = (url: string) => Promise<Response>;

export async function fetchSourceInfo(fetcher: Fetcher = fetch): Promise<SourceInfo> {
  const res = await fetcher(`${SOURCE.rawBase}info.json`);
  if (!res.ok) throw new Error(`Could not reach ${SOURCE.name} (HTTP ${res.status}).`);
  const parsed = Info.safeParse(await res.json());
  if (!parsed.success) throw new Error(`${SOURCE.name} info.json has an unexpected format.`);
  return parsed.data;
}

export interface DownloadProgress { done: number; total: number; file: string }

/** Download, validate and store a new snapshot. Does not activate it unless `activate` is true. */
export async function downloadSnapshot(
  language: string,
  onProgress?: (p: DownloadProgress) => void,
  fetcher: Fetcher = fetch,
  activate = true,
): Promise<GameSnapshot> {
  const info = await fetchSourceInfo(fetcher);
  const folder = info.folder ?? "index_min";
  const names = Object.keys(FILES);
  const files: Record<string, unknown> = {};
  const warnings: string[] = [];
  const counts: Record<string, number> = {};
  let size = 0;
  let done = 0;
  // Sequential with a small concurrency to be gentle on the host.
  const queue = [...names];
  const worker = async () => {
    while (queue.length) {
      const name = queue.shift()!;
      const url = `${SOURCE.rawBase}${folder}/${language}/${name}.json`;
      const res = await fetcher(url);
      if (!res.ok) throw new Error(`Failed to download ${name}.json (HTTP ${res.status}). Nothing was changed.`);
      const text = await res.text();
      size += text.length;
      let json: unknown;
      try { json = JSON.parse(text); } catch { throw new Error(`${name}.json is not valid JSON. Nothing was changed.`); }
      const schema = Required[name] ?? (name === "nickname" ? z.record(z.string(), z.unknown()) : IdRecord);
      const ok = schema.safeParse(json);
      if (!ok.success) throw new Error(`${name}.json failed validation (${ok.error.issues[0]?.path.join(".")}: ${ok.error.issues[0]?.message}). Nothing was changed.`);
      files[name] = json;
      counts[name] = Object.keys(json as object).length;
      onProgress?.({ done: ++done, total: names.length, file: name });
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  // Missing-asset and integrity checks (reported, not fatal).
  const chars = files.characters as Record<string, { name: string; icon?: string; portrait?: string; skill_trees: string[] }>;
  const trees = files.character_skill_trees as Record<string, unknown>;
  for (const [id, c] of Object.entries(chars)) {
    if (!c.icon) warnings.push(`Character ${c.name} (${id}) has no icon path.`);
    if (!c.portrait) warnings.push(`Character ${c.name} (${id}) has no portrait path.`);
    const missing = c.skill_trees.filter((t) => !trees[t]);
    if (missing.length) warnings.push(`Character ${c.name} (${id}) references ${missing.length} missing trace node(s).`);
  }
  const promos = files.character_promotions as Record<string, unknown>;
  for (const id of Object.keys(chars)) if (!promos[id]) warnings.push(`Character ${chars[id].name} (${id}) has no ascension data.`);

  const snap: GameSnapshot = {
    id: `${info.version}-${language}-${info.timestamp}`,
    version: info.version,
    timestamp: info.timestamp,
    language,
    downloadedAt: nowIso(),
    sourceBase: `${SOURCE.rawBase}${folder}/${language}/`,
    files,
    sizeBytes: size,
    report: { warnings, counts },
  };
  const db = getDb();
  await db.gameSnapshots.put(snap);
  // Keep the 3 most recent snapshots for rollback.
  const all = await db.gameSnapshots.orderBy("downloadedAt").reverse().primaryKeys();
  const active = await kvGet<string | null>("activeSnapshot", null);
  for (const id of all.slice(3)) if (id !== active && id !== snap.id) await db.gameSnapshots.delete(id);
  if (activate) await kvSet("activeSnapshot", snap.id);
  return snap;
}

export function snapshotToGameData(s: GameSnapshot): GameData {
  const data: Record<string, unknown> = {
    version: s.version, timestamp: s.timestamp, language: s.language, downloadedAt: s.downloadedAt, sourceBase: s.sourceBase,
  };
  for (const [file, key] of Object.entries(FILES)) data[key] = s.files[file] ?? {};
  return data as unknown as GameData;
}

export async function loadActiveGameData(): Promise<GameData | null> {
  const id = await kvGet<string | null>("activeSnapshot", null);
  if (!id) return null;
  const snap = await getDb().gameSnapshots.get(id);
  return snap ? snapshotToGameData(snap) : null;
}

export async function listSnapshots() {
  const rows = await getDb().gameSnapshots.orderBy("downloadedAt").reverse().toArray();
  return rows.map(({ files: _f, ...meta }) => meta);
}

export async function activateSnapshot(id: string) {
  const snap = await getDb().gameSnapshots.get(id);
  if (!snap) throw new Error("Snapshot not found.");
  await kvSet("activeSnapshot", id);
}

export function assetUrl(path: string | undefined | null): string | null {
  if (!path) return null;
  return `${SOURCE.rawBase}${path}`;
}
