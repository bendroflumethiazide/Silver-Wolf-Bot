export type DevStatus = "planned" | "in-development" | "implemented" | "tested" | "blocked" | "awaiting-integration";

export interface FeatureStatus {
  area: string;
  feature: string;
  status: DevStatus;
  note?: string;
}

/** Honest development status. "tested" = covered by automated unit and/or end-to-end tests. */
export const FEATURES: FeatureStatus[] = [
  { area: "Foundation", feature: "Local-first database (IndexedDB/Dexie), multi-profile", status: "tested" },
  { area: "Foundation", feature: "Game data download, validation, snapshots, rollback, missing-asset report", status: "tested", note: "Source: StarRailRes (download on demand)" },
  { area: "Foundation", feature: "Backup / restore / delete all data", status: "tested" },
  { area: "Foundation", feature: "Offline image cache", status: "implemented", note: "Cache Storage; full PWA offline shell is planned" },
  { area: "Silver Wolf", feature: "Data-grounded commentary on every page", status: "tested" },
  { area: "Silver Wolf", feature: "Local retrieval terminal (intents, facts, sources)", status: "tested" },
  { area: "Silver Wolf", feature: "Texting-style voice with Messages bubbles on every page", status: "tested" },
  { area: "Silver Wolf", feature: "Claude chat (claude-opus-5-5, streaming, server-side key, minimal facts)", status: "tested", note: "Route tested with a mocked SDK; needs your ANTHROPIC_API_KEY for live use" },
  { area: "Silver Wolf", feature: "Build ratings D → WTF with −/+, lacks, recommended builds", status: "tested", note: "Stat engine matched an in-game screenshot within rounding" },
  { area: "Account", feature: "Manual profile, resources, multi-account", status: "implemented" },
  { area: "Account", feature: "Enka.Network public showcase sync", status: "implemented", note: "Fixture-tested; live host blocked in the dev sandbox" },
  { area: "Account", feature: "HoYoLAB Battle Chronicle sync (stats, real-time note, MoC/PF/AS)", status: "implemented", note: "Fixture-tested; live HoYoLAB blocked in dev sandbox; unofficial endpoints" },
  { area: "Archive", feature: "Character database, filters, detail pages, kits", status: "implemented" },
  { area: "Archive", feature: "Light Cone database, ownership, comparison", status: "implemented" },
  { area: "Archive", feature: "Relic sets database, inventory, per-character scoring, letter grades, best-in-slot", status: "tested", note: "Scoring engine tested; UI implemented" },
  { area: "Archive", feature: "Total-stat calculator (traces, LC, relics, set bonuses)", status: "tested", note: "Excludes conditional buffs" },
  { area: "Archive", feature: "Bosses, enemies, NPCs, lore, missions, modes (codex)", status: "implemented", note: "Manual entries with sources; no licensed feed" },
  { area: "Archive", feature: "NPC directory + glossary from game data", status: "implemented" },
  { area: "Import", feature: "HSR Scanner JSON import with diff, conflicts, rollback", status: "tested" },
  { area: "Import", feature: "UIGF v4 / SRGF / CSV Warp import", status: "tested" },
  { area: "Import", feature: "Screenshot OCR inside the app", status: "blocked", note: "No reliable in-browser model; use HSR Scanner" },
  { area: "Warp", feature: "Pity tracker, 50/50 history, charts", status: "tested" },
  { area: "Warp", feature: "Exact probability planner + Monte Carlo cross-check", status: "tested" },
  { area: "Warp", feature: "Seeded simulator with animations", status: "tested" },
  { area: "Warp", feature: "Banner schedule (manual, with confirmed/speculation labels)", status: "implemented", note: "No licensed schedule feed" },
  { area: "Strategy", feature: "Team builder, saved teams, comparison", status: "implemented" },
  { area: "Strategy", feature: "Account-wide optimizer (rule-based, explained)", status: "tested" },
  { area: "Strategy", feature: "Saved builds from guides (with source links) + match check", status: "implemented" },
  { area: "Strategy", feature: "Community build database (Prydwen etc.) as a feed", status: "blocked", note: "Content not licensed for reuse; save builds manually instead" },
  { area: "Strategy", feature: "Damage / rotation simulation", status: "planned", note: "Requires a validated combat engine" },
  { area: "Strategy", feature: "Materials calculator + farming plan", status: "tested", note: "Excludes level EXP; no drop-rate data" },
  { area: "Strategy", feature: "Endgame performance history", status: "implemented" },
  { area: "Exploration", feature: "Image-based multi-floor map with markers, clustering, completion", status: "tested", note: "Logic tested; you supply map images" },
  { area: "Exploration", feature: "Preloaded official map markers", status: "blocked", note: "No licensed marker dataset" },
  { area: "Log", feature: "Achievements tracker (all achievements from game data)", status: "implemented" },
  { area: "Log", feature: "Events tracker with expiry alerts", status: "implemented" },
  { area: "Log", feature: "Journal: Markdown, tags, links, reminders, attachments, export", status: "tested", note: "Markdown renderer tested" },
  { area: "Log", feature: "In-app notifications", status: "implemented" },
  { area: "Log", feature: "Desktop notifications / Tauri packaging", status: "planned" },
  { area: "Simulated Universe", feature: "Blessings, Curios, Occurrences + collection tracking", status: "implemented" },
];
