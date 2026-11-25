import type { MainStatKey, RelicSlot } from "./relics/stats";
import type { RelicSubstat } from "./relics/scoring";

/** Where a personal record came from. "verified" sources were read from the game/account, not typed. */
export type DataSource = "manual" | "hsr-scanner" | "enka" | "hoyolab" | "uigf" | "srgf" | "csv" | "backup";

export const VERIFIED_SOURCES: DataSource[] = ["enka", "hoyolab"];
export const SOURCE_LABEL: Record<DataSource, string> = {
  manual: "Manual entry",
  "hsr-scanner": "HSR Scanner import (OCR)",
  enka: "Verified: public showcase (Enka.Network)",
  hoyolab: "Verified: HoYoLAB Battle Chronicle",
  uigf: "UIGF import",
  srgf: "SRGF import",
  csv: "CSV import",
  backup: "Restored from backup",
};

export interface Profile {
  id: string;
  name: string;
  uid?: string;
  server?: "America" | "Europe" | "Asia" | "TW/HK/MO" | "China";
  trailblazeLevel?: number;
  equilibriumLevel?: number;
  signature?: string;
  /** Statistics as reported by a verified source. */
  stats?: {
    activeDays?: number;
    chests?: number;
    achievements?: number;
    characters?: number;
    lightCones?: number;
    relics?: number;
    books?: number;
    music?: number;
  };
  /** Values the user entered for dashboard widgets. */
  resources?: { stellarJade?: number; specialPasses?: number; starRailPasses?: number; undyingStarlight?: number; trailblazePower?: number; trailblazePowerRecordedAt?: number };
  source: DataSource;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterSkills {
  basic: number;
  skill: number;
  ult: number;
  talent: number;
  elation?: number;
  memoSkill?: number;
  memoTalent?: number;
}

export interface OwnedCharacter {
  /** `${profileId}:${charId}` */
  key: string;
  profileId: string;
  charId: string;
  level: number;
  ascension: number;
  eidolon: number;
  skills: CharacterSkills;
  /** HSR Scanner style trace flags: ability_1..3, stat_1..10. */
  traces: Record<string, boolean>;
  favorite?: boolean;
  buildStatus?: "unbuilt" | "in-progress" | "built";
  source: DataSource;
  updatedAt: string;
}

export interface OwnedLightCone {
  uid: string;
  profileId: string;
  lcId: string;
  level: number;
  ascension: number;
  superimposition: number;
  /** Character id equipping it, or "". */
  location: string;
  lock: boolean;
  source: DataSource;
  updatedAt: string;
}

export interface Relic {
  uid: string;
  profileId: string;
  setId: string;
  name?: string;
  slot: RelicSlot;
  rarity: 2 | 3 | 4 | 5;
  level: number;
  mainStat: MainStatKey;
  substats: RelicSubstat[];
  location: string;
  lock: boolean;
  discard?: boolean;
  source: DataSource;
  updatedAt: string;
}

export interface Team {
  id: string;
  profileId: string;
  name: string;
  members: (string | null)[]; // 4 character ids
  mode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  favorite: boolean;
  links: { type: "character" | "lightcone" | "relicSet" | "team" | "zone" | "event" | "warp" | "achievement"; id: string; label: string }[];
  remindAt?: string;
  /** Small attachments stored inline as data URLs (kept in backups). */
  attachments?: { name: string; type: string; dataUrl: string }[];
  createdAt: string;
  updatedAt: string;
}

export type ProgressStatus = "not-started" | "in-progress" | "completed" | "skipped" | "investigate";

export interface AchievementProgress {
  key: string; // `${profileId}:${achievementId}`
  profileId: string;
  achievementId: string;
  status: ProgressStatus;
  updatedAt: string;
}

export interface MapZone {
  id: string;
  planet: string;
  region: string;
  name: string;
  floor: string;
  /** User-supplied map image (stored locally only). */
  image?: Blob;
  width: number;
  height: number;
  createdAt: string;
}

export const MARKER_CATEGORIES = [
  "Basic Treasure", "Bountiful Treasure", "Precious Treasure", "Warp Trotter", "Puzzle", "Hidden Puzzle",
  "Space Anchor", "Calyx", "Stagnant Shadow", "Cavern of Corrosion", "Echo of War", "Boss", "Enemy", "NPC",
  "Readable", "Book", "Document", "Origami Bird", "Lordly Trashcan", "Hidden Quest", "Side Mission",
  "Collectible", "Shop", "Special Interaction", "Achievement Discovery",
] as const;
export type MarkerCategory = (typeof MARKER_CATEGORIES)[number];

export interface MapMarker {
  id: string;
  profileId: string;
  zoneId: string;
  x: number; // 0..1 relative to image width
  y: number; // 0..1 relative to image height
  category: MarkerCategory;
  name: string;
  description?: string;
  requirements?: string;
  instructions?: string;
  reward?: string;
  achievement?: string;
  guideUrl?: string;
  status: ProgressStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EndgameRecord {
  id: string;
  profileId: string;
  mode: "Memory of Chaos" | "Pure Fiction" | "Apocalyptic Shadow" | "Anomaly Arbitration" | "Other";
  season: string;
  date: string;
  teams: string[][];
  score?: number;
  cycles?: number;
  stars?: number;
  notes?: string;
}

export type InfoStatus = "official" | "speculation" | "leak";

export interface BannerEntry {
  id: string;
  pool: "character" | "lightcone";
  version: string;
  phase?: string;
  featured5: string[];
  featured4: string[];
  start: string; // ISO with offset
  end: string;
  serverNote?: string;
  status: InfoStatus;
  sourceUrl?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface EventEntry {
  id: string;
  name: string;
  version: string;
  start?: string;
  end?: string;
  permanent: boolean;
  rewards?: string;
  description?: string;
  status: InfoStatus;
  sourceUrl?: string;
  completion: ProgressStatus;
  createdAt: string;
}

export interface ImportHistoryEntry {
  id: string;
  kind: "hsr-scanner" | "uigf" | "srgf" | "csv" | "backup" | "enka" | "hoyolab";
  fileName?: string;
  importedAt: string;
  summary: string;
  /** Prior state of every row touched, so the import can be rolled back. */
  undo: { table: string; key: string; before: unknown | null }[];
  rolledBack?: boolean;
}

export interface AppNotification {
  id: string;
  kind: "banner" | "event" | "sync" | "reminder" | "data" | "system";
  title: string;
  body: string;
  href?: string;
  createdAt: string;
  read: boolean;
  /** De-duplication key so periodic checks do not repeat a notification. */
  dedupe?: string;
}

export type CodexKind = "boss" | "enemy" | "npc" | "lore" | "mission" | "mode";
/** Knowledge entries the user records from official sources (no licensed feed exists for these). */
export interface CodexEntry {
  id: string;
  kind: CodexKind;
  name: string;
  /** Free-form structured fields, e.g. weaknesses, location, rewards, reset schedule. */
  fields: Record<string, string>;
  body: string;
  status: InfoStatus | "fan-theory";
  sourceUrl?: string;
  progress?: ProgressStatus;
  spoiler?: boolean;
  version?: string;
  createdAt: string;
  updatedAt: string;
}
