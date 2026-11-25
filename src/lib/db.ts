import Dexie, { type Table } from "dexie";
import type {
  AchievementProgress, AppNotification, CodexEntry, BannerEntry, EndgameRecord, EventEntry, ImportHistoryEntry,
  JournalNote, MapMarker, MapZone, OwnedCharacter, OwnedLightCone, Profile, Relic, Team,
} from "./types";
import type { ScoringProfile } from "./relics/scoring";
import type { SimPull, SimState } from "./warp/simulator";
import type { PoolKind } from "./warp/rules";

export interface KV { key: string; value: unknown }

export interface GameSnapshot {
  id: string;
  version: string;
  /** StarRailRes build timestamp (seconds). */
  timestamp: number;
  language: string;
  downloadedAt: string;
  sourceBase: string;
  files: Record<string, unknown>;
  sizeBytes: number;
  report: { warnings: string[]; counts: Record<string, number> };
}

/** Legacy table from the removed in-app Warp tracker; kept so existing data and backups still load. */
export type WarpRow = { key: string; profileId: string; [k: string]: unknown };
export interface MaterialStock { key: string; profileId: string; itemId: string; count: number; updatedAt: string }
export interface RelicProfileRow { key: string; profileId: string; charId: string; profile: ScoringProfile }
export interface SimSession {
  id: string;
  name: string;
  pool: PoolKind;
  seed: string;
  createdAt: string;
  state: SimState;
  pulls: SimPull[];
  jadeSpent: number;
}

export class AstralDB extends Dexie {
  kv!: Table<KV, string>;
  gameSnapshots!: Table<GameSnapshot, string>;
  profiles!: Table<Profile, string>;
  characters!: Table<OwnedCharacter, string>;
  lightCones!: Table<OwnedLightCone, string>;
  relics!: Table<Relic, string>;
  warps!: Table<WarpRow, string>;
  materials!: Table<MaterialStock, string>;
  relicProfiles!: Table<RelicProfileRow, string>;
  teams!: Table<Team, string>;
  notes!: Table<JournalNote, string>;
  achievements!: Table<AchievementProgress, string>;
  mapZones!: Table<MapZone, string>;
  mapMarkers!: Table<MapMarker, string>;
  endgame!: Table<EndgameRecord, string>;
  banners!: Table<BannerEntry, string>;
  events!: Table<EventEntry, string>;
  importHistory!: Table<ImportHistoryEntry, string>;
  notifications!: Table<AppNotification, string>;
  simSessions!: Table<SimSession, string>;
  codex!: Table<CodexEntry, string>;

  constructor(name = "astral-companion") {
    super(name);
    this.version(1).stores({
      kv: "key",
      gameSnapshots: "id, downloadedAt, version",
      profiles: "id",
      characters: "key, profileId, charId",
      lightCones: "uid, profileId, lcId, location",
      relics: "uid, profileId, setId, slot, location",
      warps: "key, profileId, pool, [profileId+pool], time",
      materials: "key, profileId, itemId",
      relicProfiles: "key, profileId, charId",
      teams: "id, profileId, updatedAt",
      notes: "id, updatedAt, *tags, favorite",
      achievements: "key, profileId, achievementId, status",
      mapZones: "id, planet, region",
      mapMarkers: "id, zoneId, profileId, category, status",
      endgame: "id, profileId, mode, date",
      banners: "id, start, end, status",
      events: "id, start, end",
      importHistory: "id, importedAt",
      notifications: "id, createdAt, read, dedupe",
      simSessions: "id, createdAt",
    });
    this.version(2).stores({ codex: "id, kind, name, updatedAt" });
  }
}

/** Personal tables included in backups and in "delete all personal data". */
export const PERSONAL_TABLES = [
  "kv", "profiles", "characters", "lightCones", "relics", "warps", "materials", "relicProfiles", "teams", "notes",
  "achievements", "mapZones", "mapMarkers", "endgame", "banners", "events", "importHistory", "notifications", "simSessions", "codex",
] as const;
export type PersonalTable = (typeof PERSONAL_TABLES)[number];

let instance: AstralDB | null = null;
export function getDb(): AstralDB {
  if (!instance) instance = new AstralDB();
  return instance;
}

export const nowIso = () => new Date().toISOString();
export const newId = (prefix = "id") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().kv.get(key);
  return row ? (row.value as T) : fallback;
}
export async function kvSet(key: string, value: unknown) {
  await getDb().kv.put({ key, value });
}
