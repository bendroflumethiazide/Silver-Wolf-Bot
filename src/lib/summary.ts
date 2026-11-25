import type { GameData } from "./gamedata/types";
import { characterDisplayName } from "./gamedata/types";
import { LEVEL_CAP_BY_ASCENSION } from "./materials/calculator";
import { PROFILE_TEMPLATES, scoreRelic, suggestTemplate, type ScoringProfile } from "./relics/scoring";
import { SLOT_LABEL } from "./relics/stats";
import type { AchievementProgress, BannerEntry, EventEntry, MapMarker, OwnedCharacter, OwnedLightCone, Relic } from "./types";
import { EMPTY_PITY, type PityStore } from "./warp/pity";

export interface Objective {
  id: string;
  title: string;
  reason: string;
  href: string;
  priority: number; // higher first
  category: "data" | "event" | "banner" | "character" | "trace" | "relic" | "exploration" | "warp" | "achievement";
}

export interface AccountInput {
  game: GameData | null;
  characters: OwnedCharacter[];
  lightCones: OwnedLightCone[];
  relics: Relic[];
  /** Current pity the user entered (Warp history lives on Star Rail Station). */
  pity?: PityStore;
  achievements: AchievementProgress[];
  markers: MapMarker[];
  banners: BannerEntry[];
  events: EventEntry[];
  relicProfiles: Record<string, ScoringProfile>;
  now?: number;
}

export interface AccountSummary {
  totalPlayable: number;
  owned: number;
  owned5: number;
  owned4: number;
  lightConesOwned: number;
  lightConesTotal: number;
  achievementsDone: number;
  achievementsTotal: number;
  markersDone: number;
  markersTotal: number;
  pity: PityStore;
  objectives: Objective[];
}

/** Playable characters: excludes the duplicated Trailblazer gender variants (odd ids ≥ 8001 keep one per Path). */
export function playableCharacters(game: GameData | null) {
  if (!game) return [];
  return Object.values(game.characters).filter((c) => !(Number(c.id) >= 8000 && Number(c.id) % 2 === 0));
}

export function profileFor(charId: string, game: GameData | null, saved: Record<string, ScoringProfile>): ScoringProfile {
  if (saved[charId]) return saved[charId];
  const path = game?.characters[charId]?.path ?? "";
  const tpl = PROFILE_TEMPLATES.find((t) => t.id === suggestTemplate(path))!;
  return { ...tpl, id: `auto-${charId}`, templateId: tpl.id };
}

export function summarizeAccount(i: AccountInput): AccountSummary {
  const now = i.now ?? Date.now();
  const playable = playableCharacters(i.game);
  const ownedIds = new Set(i.characters.map((c) => c.charId));
  const rarity = (id: string) => i.game?.characters[id]?.rarity ?? 0;
  const name = (id: string) => (i.game?.characters[id] ? characterDisplayName(i.game.characters[id]) : `Character ${id}`);
  const objectives: Objective[] = [];

  if (!i.game) objectives.push({ id: "data", title: "Download game data", reason: "Character, Light Cone and material databases are empty until game data is downloaded.", href: "/settings#game-data", priority: 100, category: "data" });

  for (const e of i.events) {
    if (e.permanent || !e.end || e.completion === "completed") continue;
    const left = Date.parse(e.end) - now;
    if (left > 0 && left < 7 * 86400_000)
      objectives.push({ id: `ev-${e.id}`, title: `Finish ${e.name}`, reason: `Ends in ${Math.ceil(left / 86400_000)} day(s); marked ${e.completion.replace("-", " ")}.`, href: "/events", priority: 90 - left / 86400_000, category: "event" });
  }
  for (const b of i.banners) {
    const left = Date.parse(b.end) - now;
    if (left > 0 && left < 3 * 86400_000 && b.status === "official")
      objectives.push({ id: `bn-${b.id}`, title: `Banner ending: ${b.featured5.join(", ") || b.version}`, reason: `Ends in ${Math.ceil(left / 3600_000)} hour(s). Decide whether to pull before it closes.`, href: "/warp?tab=planner", priority: 80, category: "banner" });
  }

  for (const c of i.characters) {
    const cap = LEVEL_CAP_BY_ASCENSION[Math.min(6, c.ascension)];
    if (c.level >= cap && c.ascension < 6)
      objectives.push({ id: `asc-${c.charId}`, title: `Ascend ${name(c.charId)}`, reason: `Level ${c.level} is at the cap for Ascension ${c.ascension}.`, href: `/materials?char=${c.charId}`, priority: 60 + rarity(c.charId), category: "character" });
    else if (c.level < 80 && (c.favorite || rarity(c.charId) === 5))
      objectives.push({ id: `lvl-${c.charId}`, title: `Level up ${name(c.charId)}`, reason: `Level ${c.level}/80${c.favorite ? " · favourite" : ""}.`, href: `/characters/${c.charId}`, priority: 40 + rarity(c.charId) + (c.favorite ? 10 : 0), category: "character" });
    const abilities = ["ability_1", "ability_2", "ability_3"].filter((k) => k in c.traces);
    const missing = abilities.filter((k) => !c.traces[k]);
    if (c.ascension >= 6 && missing.length)
      objectives.push({ id: `tr-${c.charId}`, title: `Unlock ${name(c.charId)}'s major traces`, reason: `${missing.length} of ${abilities.length} major traces locked at Ascension 6.`, href: `/materials?char=${c.charId}`, priority: 45 + rarity(c.charId), category: "trace" });
  }

  for (const r of i.relics) {
    if (!r.location || !ownedIds.has(r.location)) continue;
    const profile = profileFor(r.location, i.game, i.relicProfiles);
    const s = scoreRelic(r, profile);
    if (r.level >= 15 && (s.verdict === "fodder" || !s.mainStatFits))
      objectives.push({ id: `rl-${r.uid}`, title: `Replace ${name(r.location)}'s ${SLOT_LABEL[r.slot]}`, reason: `${s.mainStatFits ? `Scores ${s.score.toFixed(0)}/100` : "Main stat does not fit"} for the ${profile.name} profile${profile.origin === "template" ? " (template)" : ""}.`, href: `/relics?char=${r.location}`, priority: 30 + rarity(r.location), category: "relic" });
  }

  const zoneTodo = new Map<string, number>();
  for (const m of i.markers) if (m.status === "not-started" || m.status === "in-progress" || m.status === "investigate") zoneTodo.set(m.zoneId, (zoneTodo.get(m.zoneId) ?? 0) + 1);
  for (const [zone, n] of zoneTodo) objectives.push({ id: `map-${zone}`, title: `${n} map objective(s) remaining`, reason: "Tracked markers not yet completed in one of your zones.", href: `/map?zone=${zone}`, priority: 20 + Math.min(10, n), category: "exploration" });

  const pity = i.pity ?? EMPTY_PITY;
  if (pity.character.pity >= 74)
    objectives.push({ id: "warp-soft", title: "Character Warp in soft pity", reason: `Pity ${pity.character.pity}: a 5★ is very likely within the next few pulls.`, href: "/warp", priority: 50, category: "warp" });

  const achTotal = i.game ? Object.keys(i.game.achievements).length : 0;
  const achDone = i.achievements.filter((a) => a.status === "completed").length;

  return {
    totalPlayable: playable.length,
    owned: i.characters.length,
    owned5: i.characters.filter((c) => rarity(c.charId) === 5).length,
    owned4: i.characters.filter((c) => rarity(c.charId) === 4).length,
    lightConesOwned: i.lightCones.length,
    lightConesTotal: i.game ? Object.keys(i.game.lightCones).length : 0,
    achievementsDone: achDone,
    achievementsTotal: achTotal,
    markersDone: i.markers.filter((m) => m.status === "completed").length,
    markersTotal: i.markers.length,
    pity,
    objectives: objectives.sort((a, b) => b.priority - a.priority),
  };
}
