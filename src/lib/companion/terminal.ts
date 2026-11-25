/**
 * Silver Wolf's terminal: a deterministic, retrieval-based assistant. It answers ONLY from the
 * user's local data and the downloaded game database, and always returns the facts and sources
 * it used. Anything it cannot ground in data, it says so. No external AI is called.
 */
import type { GameData } from "../gamedata/types";
import { characterDisplayName } from "../gamedata/types";
import { compareWithInventory, type MaterialTotals } from "../materials/calculator";
import { investment, suggestTeams } from "../teams";
import type { AccountSummary } from "../summary";
import type { EventEntry, MapMarker, MapZone, OwnedCharacter, Profile } from "../types";
import { planWarps, pullsFromResources } from "../warp/planner";
import { POOLS } from "../warp/rules";
import { pick } from "./voice";

export interface TerminalContext {
  game: GameData | null;
  summary: AccountSummary;
  profile: Profile;
  characters: OwnedCharacter[];
  events: EventEntry[];
  zones: MapZone[];
  markers: MapMarker[];
  materialNeeds: MaterialTotals | null;
  inventory: Record<string, number>;
  codex: { kind: string; name: string; body: string; sourceUrl?: string }[];
  now?: number;
}

export interface TerminalAnswer {
  line: string;
  facts: string[];
  sources: string[];
  links: { label: string; href: string }[];
  intent: string;
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export const SUGGESTIONS = [
  "How many pulls can I afford?",
  "Can I guarantee the next featured character?",
  "Which character should I build next?",
  "What's my strongest team?",
  "Which relics should I replace?",
  "What materials am I missing?",
  "Which achievements am I closest to?",
  "What am I missing on the map?",
  "What events are expiring?",
];

export function answer(raw: string, ctx: TerminalContext): TerminalAnswer {
  const q = raw.toLowerCase().trim();
  const name = (id: string) => (ctx.game?.characters[id] ? characterDisplayName(ctx.game.characters[id]) : id);
  const r = ctx.profile.resources ?? {};
  const eventPulls = pullsFromResources(r.stellarJade ?? 0, r.specialPasses ?? 0, r.undyingStarlight ?? 0);

  if (!q || has(q, "who are you", "hello", "hi ", "hey", "help") || q === "hi") {
    return {
      intent: "help",
      line: "Yo|I read ur save data and tell u what's broken|Only stuff that's actually on disk. no guessing|Ask me something",
      facts: [`Local mode: answers come from this device's database${ctx.game ? ` and game data v${ctx.game.version}` : ""}.`],
      sources: ["Local database"], links: [], };
  }

  if (has(q, "pull", "afford", "jade", "save", "how many warp")) {
    const s = ctx.summary.pools.character;
    const plan = planWarps({ pool: "character", stellarJade: r.stellarJade ?? 0, passes: r.specialPasses ?? 0, undyingStarlight: r.undyingStarlight ?? 0, expectedFutureJade: 0, expectedFuturePasses: 0, state: { pity: s.pity5, guaranteed: s.guaranteed5 }, copies: 1 });
    return {
      intent: "pulls",
      line: eventPulls === 0
        ? "0 pulls?|Either ur broke or u didn't tell me ur jade|Fill in Resources on the home screen"
        : `${eventPulls} event pulls in the bank|From ur pity that's ${pct(plan.probability)} for the featured 5★|${plan.probability >= 1 ? "Guaranteed. just pull" : plan.probability >= 0.75 ? `Worst case is ${plan.worstCase}|If ur asking, u want it ;)` : `Worst case is ${plan.worstCase}|Save a bit more`}`,
      facts: [`Stellar Jade ${r.stellarJade ?? 0} → ${Math.floor((r.stellarJade ?? 0) / 160)} pulls; Special Passes ${r.specialPasses ?? 0}; Undying Starlight ${r.undyingStarlight ?? 0} → ${Math.floor((r.undyingStarlight ?? 0) / 20)} pulls.`, `Character Warp pity ${s.pity5}${s.guaranteed5 ? ", guaranteed" : ""} (from ${s.total} recorded pulls).`, ...plan.assumptions.slice(0, 2)],
      sources: ["Resources you entered", "Your Warp history", "Published Warp rules + community soft-pity model"],
      links: [{ label: "Open planner", href: "/warp?tab=planner" }],
    };
  }

  if (has(q, "guarantee", "pity", "50/50", "5050")) {
    const lines = (["character", "lightcone", "standard"] as const).map((k) => {
      const s = ctx.summary.pools[k];
      return `${POOLS[k].label}: pity ${s.pity5}/${POOLS[k].five.hard}${POOLS[k].fiveFeaturedChance !== null ? (s.guaranteed5 ? ", guaranteed" : ", not guaranteed") : ""} (${s.total} pulls recorded${s.historyComplete ? "" : ", history may be incomplete"})`;
    });
    const c = ctx.summary.pools.character;
    const need = 90 - c.pity5 + (c.guaranteed5 ? 0 : 90);
    return {
      intent: "pity",
      line: c.total === 0 ? "No warp history imported|Can't see ur pity|Drop a UIGF or SRGF file and ask again" : c.guaranteed5 ? `Guarantee's on|${90 - c.pity5} pulls max to the featured unit|U have ${eventPulls}` : `No guarantee|For 100% on the featured 5★ u need ${need} pulls|U have ${eventPulls}`,
      facts: lines, sources: ["Your Warp history", "Published guarantee rules"], links: [{ label: "Warp tracker", href: "/warp" }],
    };
  }

  if (has(q, "build next", "which character", "upgrade potential", "improve my account", "who should i build", "build")) {
    const ranked = ctx.characters.filter((c) => ctx.game?.characters[c.charId]).map((c) => ({ c, rarity: ctx.game!.characters[c.charId].rarity, inv: investment(c, ctx.game!.characters[c.charId].rarity) }))
      .sort((a, b) => (Number(!!b.c.favorite) - Number(!!a.c.favorite)) || (b.rarity - a.rarity) || (a.inv - b.inv)).filter((x) => x.inv < 95).slice(0, 3);
    if (!ranked.length) return { intent: "build", line: ctx.characters.length ? "Everyone u own is basically maxed|Go pull something new|Or farm relics. forever" : "U haven't told me who u own|Mark them in the Archive or import a scan", facts: [], sources: ["Your character records"], links: [{ label: "Character Archive", href: "/characters" }] };
    return {
      intent: "build",
      line: `Build ${name(ranked[0].c.charId)} next|${ranked[0].rarity}★ w/ the most room to grow|Then ${ranked.slice(1).map((x) => name(x.c.charId)).join(" and ") || "whoever's next"}`,
      facts: ranked.map((x) => `${name(x.c.charId)}: Lv ${x.c.level}, skills ${x.c.skills.skill}/${x.c.skills.ult}/${x.c.skills.talent}, E${x.c.eidolon} → investment ${x.inv}/100${x.c.favorite ? " (favourite)" : ""}.`),
      sources: ["Your character records", "Investment score: level, skill levels, Eidolons, rarity (rule-based, not a tier list)"],
      links: [{ label: `Material plan for ${name(ranked[0].c.charId)}`, href: `/materials?char=${ranked[0].c.charId}` }],
    };
  }

  if (has(q, "team", "strongest", "comp")) {
    const pool = ctx.characters.filter((c) => ctx.game?.characters[c.charId]).map((c) => { const g = ctx.game!.characters[c.charId]; return { info: { id: g.id, path: g.path, element: g.element, rarity: g.rarity }, invest: investment(c, g.rarity) }; });
    if (pool.length < 4) return { intent: "team", line: "Need at least 4 owned characters|Mark more as owned first", facts: [`${pool.length} owned character(s) recorded.`], sources: ["Your character records"], links: [{ label: "Team builder", href: "/teams" }] };
    const [t] = suggestTeams(pool, 1);
    return { intent: "team", line: `On paper: ${t.members.map(name).join(", ")}|Roles covered|I don't fake damage sims. execution's on u`, facts: t.reasons, sources: ["Your character records", "Rule-based role coverage (no damage simulation)"], links: [{ label: "Optimizer", href: "/teams" }] };
  }

  if (has(q, "relic", "replace", "artifact")) {
    const relicObjs = ctx.summary.objectives.filter((o) => o.category === "relic");
    return {
      intent: "relics",
      line: relicObjs.length ? `${relicObjs.length} equipped relic(s) are dragging ppl down|Start w/ this|${relicObjs[0].title}` : "No +15 fodder on anyone|Either ur gear's fine or u didn't import it",
      facts: relicObjs.slice(0, 5).map((o) => `${o.title} — ${o.reason}`), sources: ["Your relic inventory", "Per-character scoring profiles"], links: [{ label: "Relic optimizer", href: "/relics" }],
    };
  }

  if (has(q, "material", "farm", "trailblaze power", "stamina", "tb power", "spend")) {
    if (!ctx.materialNeeds || !ctx.game) return { intent: "materials", line: "No farming plan saved|Pick targets in Materials, add them to the plan|Then ask again", facts: [], sources: [], links: [{ label: "Materials", href: "/materials" }] };
    const rows = compareWithInventory(ctx.materialNeeds, ctx.inventory).filter((x) => x.missing > 0).slice(0, 5);
    return {
      intent: "materials",
      line: rows.length ? `Spend ur TB power on ${ctx.game.items[rows[0].id]?.name ?? rows[0].id}|U're ${rows[0].missing.toLocaleString()} short|Go` : "Ur plans are fully covered|Upgrade stuff before u forget",
      facts: rows.map((x) => `${ctx.game!.items[x.id]?.name ?? x.id}: need ${x.required.toLocaleString()}, have ${x.owned.toLocaleString()}. Sources: ${ctx.game!.items[x.id]?.come_from.slice(0, 2).join(", ") || "—"}`),
      sources: ["Saved farming plans", "Your material inventory", "Game cost tables"], links: [{ label: "Farming plan", href: "/materials" }],
    };
  }

  if (has(q, "achievement")) {
    if (!ctx.game) return { intent: "achievements", line: pick(["Download the game data first|Can't count achievements that aren't installed"], "a"), facts: [], sources: [], links: [] };
    return {
      intent: "achievements",
      line: `${ctx.summary.achievementsDone}/${ctx.summary.achievementsTotal} done|Filter by series on the Achievements page|Finish the closest one first`,
      facts: ["Per-achievement completion is manual: no connected source exposes it."], sources: ["Your achievement checklist", "Game achievement list"], links: [{ label: "Achievements", href: "/achievements" }],
    };
  }

  if (has(q, "map", "missing", "treasure", "puzzle", "explor")) {
    const planet = ctx.zones.find((z) => q.includes(z.planet.toLowerCase()) || q.includes(z.region.toLowerCase()));
    const zoneIds = new Set(ctx.zones.filter((z) => !planet || z.planet === planet.planet).map((z) => z.id));
    const todo = ctx.markers.filter((m) => zoneIds.has(m.zoneId) && m.status !== "completed" && m.status !== "skipped");
    return {
      intent: "map",
      line: !ctx.markers.length ? "Ur map's empty|I only know what u marked|U marked nothing" : `${todo.length} open marker(s)${planet ? ` on ${planet.planet}` : ""}|${todo.length ? `First one: ${todo[0].name} (${todo[0].category})` : "Clean sweep"}`,
      facts: [...new Set(todo.map((m) => m.category))].map((c) => `${c}: ${todo.filter((m) => m.category === c).length} open`), sources: ["Your manual map markers"], links: [{ label: "Map", href: "/map" }],
    };
  }

  if (has(q, "event", "expir", "deadline")) {
    const now = ctx.now ?? Date.now();
    const soon = ctx.events.filter((e) => e.end && !e.permanent && e.completion !== "completed" && Date.parse(e.end) > now).sort((a, b) => Date.parse(a.end!) - Date.parse(b.end!));
    return {
      intent: "events",
      line: soon.length ? `${soon[0].name} closes first|${Math.ceil((Date.parse(soon[0].end!) - now) / 3600_000)}h left|Do it now` : "No unfinished events w/ a deadline|U're clear",
      facts: soon.slice(0, 5).map((e) => `${e.name} (${e.status}) ends ${new Date(e.end!).toLocaleString()}`), sources: ["Events you track"], links: [{ label: "Events", href: "/events" }],
    };
  }

  if (has(q, "boss", "defeat", "beat", "enemy", "how do i")) {
    const hit = ctx.codex.find((c) => q.includes(c.name.toLowerCase()));
    if (hit) return { intent: "codex", line: `Here's what u wrote abt ${hit.name}`, facts: [hit.body.slice(0, 400)], sources: [hit.sourceUrl ?? "Your codex entry"], links: [{ label: "Codex", href: "/bosses" }] };
    return { intent: "codex", line: "No boss data in my database|No legit source connected and I'm not inventing mechanics|Add it to the codex w/ a source and I'll pull it up", facts: [], sources: [], links: [{ label: "Bosses & Enemies", href: "/bosses" }] };
  }

  return {
    intent: "unknown",
    line: "What r u even talkin abt|I can't answer that from ur data|Try one of the buttons",
    facts: [], sources: [], links: [],
  };
}
