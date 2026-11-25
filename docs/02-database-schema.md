# 02 · Database schema (IndexedDB, Dexie, schema version 2)

Defined in `src/lib/db.ts`; types in `src/lib/types.ts`. Every personal row carries a `source` (`manual`, `hsr-scanner`, `enka`, `uigf`, `srgf`, `csv`, `backup`). Only `enka` counts as verified account data.

| Table | Primary key | Indexes | Purpose |
| --- | --- | --- | --- |
| `kv` | `key` | — | Settings, active profile, active snapshot, Warp offsets, material plans, SU collection |
| `gameSnapshots` | `id` = `version-lang-timestamp` | downloadedAt, version | Raw StarRailRes files + validation report (newest 3 kept) |
| `profiles` | `id` | — | Trailblazer profile, server, levels, verified stats, resources, `syncedAt` |
| `characters` | `key` = `profileId:charId` | profileId, charId | Level, ascension, Eidolon, skill levels, trace flags (HSR Scanner order), favourite, build status |
| `lightCones` | `uid` | profileId, lcId, location | Owned Light Cones, equip location |
| `relics` | `uid` | profileId, setId, slot, location | Set, slot, rarity, level, main stat, substats (display units) |
| `warps` | `key` = `profileId:recordId` | profileId, pool, [profileId+pool], time | Warp records; game ids order history; optional featured override |
| `materials` | `key` = `profileId:itemId` | profileId, itemId | Material inventory counts |
| `relicProfiles` | `key` = `profileId:charId` | profileId, charId | Per-character relic scoring weights and main stats |
| `teams` | `id` | profileId, updatedAt | Saved teams (4 slots), mode, notes |
| `notes` | `id` | updatedAt, *tags, favorite | Journal: Markdown, tags, entity links, reminder, attachments (data URLs ≤ 2 MB) |
| `achievements` | `key` = `profileId:achievementId` | profileId, achievementId, status | Manual achievement status |
| `mapZones` | `id` | planet, region | Planet/region/zone/floor + your map image (Blob) |
| `mapMarkers` | `id` | zoneId, profileId, category, status | Relative x/y, category, details, completion status |
| `endgame` | `id` | profileId, mode, date | Memory of Chaos / Pure Fiction / Apocalyptic Shadow… runs |
| `banners` | `id` | start, end, status | Banner schedule with official/speculation/leak status and source |
| `events` | `id` | start, end | Events with completion and status |
| `importHistory` | `id` | importedAt | Import summary + undo log (prior state of every touched row) |
| `notifications` | `id` | createdAt, read, dedupe | In-app notifications |
| `simSessions` | `id` | createdAt | Saved simulator sessions (never mixed with real Warps) |
| `codex` (v2) | `id` | kind, name, updatedAt | Bosses, enemies, NPCs, lore, missions, modes, with sources and spoiler flag |

## Record metadata required by the brief

Game records come from a snapshot that stores the source URL, game version, build timestamp and download time. That covers id, version introduced, source URL, verification status and last-verified date at snapshot level. Per-record "version introduced" is not in the source data, so it is not displayed. Manual knowledge records (`banners`, `events`, `codex`) store their own `status`, `sourceUrl`, `version` and dates.

## Migration path

Table shapes are plain JSON with string keys, so a future sync backend (SQLite, Postgres) can mirror them one-to-one. Dexie versioning handles in-browser migrations; v2 added `codex` without touching existing data.
