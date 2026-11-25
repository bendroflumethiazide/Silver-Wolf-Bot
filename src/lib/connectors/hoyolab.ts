/**
 * HoYoLAB Battle Chronicle connector for Honkai: Star Rail (global servers), READ-ONLY.
 *
 * These are HoYoLAB's own web endpoints, not a documented public API. Request shape (DS header,
 * x-rpc headers) follows the long-standing community clients. Not verified against a live response
 * from the development sandbox (host blocked) — covered by fixture tests; adjust if HoYoLAB changes.
 *
 * Safety rules enforced here:
 * - Only GET requests to game_record endpoints. No check-ins, redemptions or any write action.
 * - Cookies come from server environment variables only; never from or to the browser.
 * - Verification/CAPTCHA responses are surfaced to the user, never bypassed or retried.
 */
import { z } from "zod";
import type { GameData } from "../gamedata/types";
import { characterDisplayName } from "../gamedata/types";
import { ascensionForLevel } from "../materials/calculator";
import type { EndgameRecord, OwnedCharacter } from "../types";


export const HOYOLAB_CAPABILITIES = {
  id: "hoyolab",
  name: "HoYoLAB Battle Chronicle",
  readOnly: true as const,
  requiresSecret: true,
  provides: [
    "Active days, character count, achievement count, treasure chests opened",
    "Real-time note: Trailblaze Power, reserve, Daily Training, Simulated Universe weekly points, Echo of War runs, assignments",
    "Memory of Chaos, Pure Fiction and Apocalyptic Shadow: season, stars, floors, teams, scores",
    "Owned characters with level and Eidolon",
  ],
  doesNotProvide: ["Relics and Light Cones in detail (use HSR Scanner)", "Trace levels", "Warp history", "Per-treasure map completion"],
};

export function serverForUid(uid: string): string | null {
  if (!/^\d{9,10}$/.test(uid)) return null;
  const first = uid[0];
  return ({ "6": "prod_official_usa", "7": "prod_official_eur", "8": "prod_official_asia", "9": "prod_official_cht" } as Record<string, string>)[first] ?? null;
}

export const RETCODE_MESSAGE: Record<number, string> = {
  10001: "HoYoLAB says the cookies are invalid or expired. Copy fresh ltuid_v2 / ltoken_v2 into .env.local.",
  [-100]: "HoYoLAB says you're not logged in. Refresh the cookies in .env.local.",
  10102: "Your Battle Chronicle data is private. Make it public in HoYoLAB → Battle Chronicle → settings.",
  1034: "HoYoLAB wants a verification check. Open hoyolab.com in your browser, pass it there, then try again. (This app never bypasses CAPTCHA.)",
  10035: "HoYoLAB wants a verification check. Open hoyolab.com in your browser, pass it there, then try again. (This app never bypasses CAPTCHA.)",
  5003: "HoYoLAB wants a verification check. Open hoyolab.com in your browser, pass it there, then try again. (This app never bypasses CAPTCHA.)",
  10101: "HoYoLAB rate limit reached. Try again later.",
  1008: "This UID doesn't match the HoYoLAB account in your cookies.",
};

export interface HoyolabRaw {
  uid: string;
  fetchedAt: string;
  index?: unknown;
  note?: unknown;
  moc?: unknown;
  pf?: unknown;
  as?: unknown;
  errors: Record<string, string>;
}

// ---------------------------------------------------------------- parsing (pure, client-safe)

const n = z.coerce.number().optional().default(0);
const Time = z.object({ year: n, month: n, day: n, hour: n, minute: n }).partial().optional();
const Avatar = z.object({ id: z.coerce.string(), level: n, rank: n }).passthrough();
const Node = z.object({ avatars: z.array(Avatar).optional().default([]), score: z.coerce.number().optional() }).passthrough().optional();
const Floor = z.object({ name: z.string().optional().default(""), round_num: n, star_num: n, node_1: Node, node_2: Node, is_fast: z.boolean().optional() }).passthrough();
const Challenge = z.object({
  schedule_id: z.coerce.string().optional(), begin_time: Time, end_time: Time, star_num: n, max_floor: z.string().optional(), battle_num: n, has_data: z.boolean().optional(),
  all_floor_detail: z.array(Floor).optional().default([]),
  groups: z.array(z.object({ schedule_id: z.coerce.string().optional(), name_mi18n: z.string().optional() }).passthrough()).optional().default([]),
}).passthrough();
const Index = z.object({
  stats: z.object({ active_days: n, avatar_num: n, achievement_num: n, chest_num: n }).passthrough().optional(),
  avatar_list: z.array(Avatar.extend({ name: z.string().optional() })).optional().default([]),
}).passthrough();
const Note = z.object({
  current_stamina: n, max_stamina: n, stamina_recover_time: n, current_reserve_stamina: n,
  current_train_score: n, max_train_score: n, current_rogue_score: n, max_rogue_score: n,
  weekly_cocoon_cnt: n, weekly_cocoon_limit: n, accepted_epedition_num: n, total_expedition_num: n,
}).passthrough();

export interface DailyNote {
  fetchedAt: string;
  trailblazePower: number; maxTrailblazePower: number; fullInSeconds: number; reserve: number;
  dailyTraining: [number, number]; universeWeekly: [number, number]; echoOfWar: [number, number]; assignments: [number, number];
}

export interface HoyolabParsed {
  stats?: { activeDays: number; characters: number; achievements: number; chests: number };
  note?: DailyNote;
  characters: OwnedCharacter[];
  endgame: EndgameRecord[];
  warnings: string[];
}

const dateOf = (t: z.infer<typeof Time>) => (t?.year ? `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}` : new Date().toISOString().slice(0, 10));

function challengeRecords(raw: unknown, mode: EndgameRecord["mode"], profileId: string, warnings: string[]): EndgameRecord[] {
  if (!raw) return [];
  const p = Challenge.safeParse(raw);
  if (!p.success) { warnings.push(`${mode}: unexpected response format.`); return []; }
  const d = p.data;
  if (d.has_data === false || !d.all_floor_detail.length) return [];
  const top = d.all_floor_detail[0];
  const team = (node: z.infer<typeof Node>) => (node?.avatars ?? []).map((a) => a.id);
  const floorScore = (f: z.infer<typeof Floor>) => (f.node_1?.score ?? 0) + (f.node_2?.score ?? 0);
  const best = mode === "Memory of Chaos" ? undefined : Math.max(...d.all_floor_detail.map(floorScore));
  return [{
    id: `hoyolab-${mode.replace(/\s/g, "")}-${d.schedule_id ?? dateOf(d.begin_time)}`,
    profileId, mode,
    season: d.groups[0]?.name_mi18n ?? `Schedule ${d.schedule_id ?? "?"}`,
    date: dateOf(d.begin_time),
    teams: [team(top.node_1), team(top.node_2)],
    stars: d.star_num,
    ...(best !== undefined && best > 0 ? { score: best } : {}),
    ...(mode === "Memory of Chaos" ? { cycles: top.round_num } : {}),
    notes: `Synced from HoYoLAB. Highest floor: ${d.max_floor ?? top.name}. Battles: ${d.battle_num}.`,
  }];
}

export function parseHoyolab(raw: HoyolabRaw, game: GameData | null, profileId: string): HoyolabParsed {
  const warnings = Object.entries(raw.errors).map(([k, v]) => `${k}: ${v}`);
  const out: HoyolabParsed = { characters: [], endgame: [], warnings };
  if (raw.index) {
    const p = Index.safeParse(raw.index);
    if (!p.success) warnings.push("Profile index: unexpected response format.");
    else {
      const s = p.data.stats;
      if (s) out.stats = { activeDays: s.active_days, characters: s.avatar_num, achievements: s.achievement_num, chests: s.chest_num };
      for (const a of p.data.avatar_list) {
        if (game && !game.characters[a.id]) { warnings.push(`Character ${a.name ?? a.id} isn't in your game data; update game data.`); continue; }
        const level = Math.max(1, Math.min(80, a.level));
        out.characters.push({
          key: `${profileId}:${a.id}`, profileId, charId: a.id, level, ascension: ascensionForLevel(level), eidolon: Math.max(0, Math.min(6, a.rank)),
          skills: { basic: 1, skill: 1, ult: 1, talent: 1 }, traces: {}, source: "hoyolab", updatedAt: raw.fetchedAt,
        });
      }
    }
  }
  if (raw.note) {
    const p = Note.safeParse(raw.note);
    if (!p.success) warnings.push("Real-time note: unexpected response format.");
    else {
      const d = p.data;
      out.note = {
        fetchedAt: raw.fetchedAt, trailblazePower: d.current_stamina, maxTrailblazePower: d.max_stamina, fullInSeconds: d.stamina_recover_time, reserve: d.current_reserve_stamina,
        dailyTraining: [d.current_train_score, d.max_train_score], universeWeekly: [d.current_rogue_score, d.max_rogue_score],
        echoOfWar: [d.weekly_cocoon_cnt, d.weekly_cocoon_limit], assignments: [d.accepted_epedition_num, d.total_expedition_num],
      };
    }
  }
  out.endgame.push(...challengeRecords(raw.moc, "Memory of Chaos", profileId, warnings), ...challengeRecords(raw.pf, "Pure Fiction", profileId, warnings), ...challengeRecords(raw.as, "Apocalyptic Shadow", profileId, warnings));
  if (game) for (const e of out.endgame) e.notes += ` Team: ${e.teams.flat().map((id) => (game.characters[id] ? characterDisplayName(game.characters[id]) : id)).join(", ")}.`;
  return out;
}
