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
import { POOLS, WARP_TRACKER_URL } from "../warp/rules";
import { pityKnown } from "../warp/pity";
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
  /** Build ratings for owned characters with relics (see lib/builds). */
  builds?: BuildSummary[];
  now?: number;
}

export interface BuildSummary { charId: string; name: string; grade: string; score: number; lacks: string[]; best?: string; equipped: number }

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
  "Rate my builds",
  "What should I do today?",
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

  if (has(q, "what should i do", "what to do", "what do i do", "todo", "to do", "plan for today", "priorit", "what now", "what next")) {
    const top = ctx.summary.objectives.slice(0, 3);
    if (!top.length) return { intent: "todo", line: "Nothing urgent|Import a scan or track some events and I'll find stuff|Or just pull ;)", facts: [], sources: ["Objectives engine"], links: [{ label: "Import Center", href: "/import" }] };
    return {
      intent: "todo",
      line: [`Ok here's the plan`, ...top.map((o, i) => `${i + 1}. ${o.title}`), "Do the first one now"].join("|"),
      facts: top.map((o) => `${o.title}: ${o.reason}`), sources: ["Your data → objectives engine"],
      links: top.slice(0, 2).map((o) => ({ label: o.title, href: o.href })),
    };
  }

  if (has(q, "rate", "rating", "grade") || (has(q, "build") && (ctx.builds ?? []).some((b) => q.includes(b.name.toLowerCase())))) {
    const builds = ctx.builds ?? [];
    const one = builds.find((b) => q.includes(b.name.toLowerCase()));
    if (one) return {
      intent: "rate",
      line: `${one.name}: ${one.grade}|${one.best ? `${one.best} is carrying` : "Nothing's carrying tbh"}|${one.lacks[0] ?? "No notes"}${one.lacks[1] ? `|Also ${one.lacks[1].charAt(0).toLowerCase()}${one.lacks[1].slice(1)}` : ""}`,
      facts: [`${one.name}: ${one.grade} (${one.score.toFixed(1)}/100), ${one.equipped}/6 relics.`, ...one.lacks.map((l) => `Lacks: ${l}`)],
      sources: ["Your relics", "Character scoring profile", "Game data stat tables"],
      links: [{ label: `Open ${one.name}`, href: `/characters/${one.charId}` }],
    };
    if (!builds.length) return { intent: "rate", line: "Nothing to rate|No one has relics equipped in my data|Import a scan first", facts: [], sources: [], links: [{ label: "Import Center", href: "/import" }] };
    const sorted = [...builds].sort((a, b) => b.score - a.score);
    return {
      intent: "rate",
      line: `Best: ${sorted[0].name} (${sorted[0].grade})|Worst: ${sorted[sorted.length - 1].name} (${sorted[sorted.length - 1].grade})|Fix the bottom one first`,
      facts: sorted.map((b) => `${b.name}: ${b.grade} (${b.score.toFixed(1)})`), sources: ["Your relics", "Character scoring profiles"],
      links: [{ label: `Open ${sorted[sorted.length - 1].name}`, href: `/characters/${sorted[sorted.length - 1].charId}` }],
    };
  }

  if (has(q, "pull", "afford", "jade", "save", "how many warp")) {
    const s = ctx.summary.pity.character;
    const plan = planWarps({ pool: "character", stellarJade: r.stellarJade ?? 0, passes: r.specialPasses ?? 0, undyingStarlight: r.undyingStarlight ?? 0, expectedFutureJade: 0, expectedFuturePasses: 0, state: { pity: s.pity, guaranteed: s.guaranteed }, copies: 1 });
    return {
      intent: "pulls",
      line: eventPulls === 0
        ? "0 pulls?|Either ur broke or u didn't tell me ur jade|Fill in Resources on the home screen"
        : `${eventPulls} event pulls in the bank|From ur pity that's ${pct(plan.probability)} for the featured 5★|${plan.probability >= 1 ? "Guaranteed. just pull" : plan.probability >= 0.75 ? `Worst case is ${plan.worstCase}|If ur asking, u want it ;)` : `Worst case is ${plan.worstCase}|Save a bit more`}`,
      facts: [`Stellar Jade ${r.stellarJade ?? 0} → ${Math.floor((r.stellarJade ?? 0) / 160)} pulls; Special Passes ${r.specialPasses ?? 0}; Undying Starlight ${r.undyingStarlight ?? 0} → ${Math.floor((r.undyingStarlight ?? 0) / 20)} pulls.`, `Character Warp pity ${s.pity}${s.guaranteed ? ", guaranteed" : ""} (${pityKnown(s) ? "entered by you" : "not entered yet, assumed 0"}).`, ...plan.assumptions.slice(0, 2)],
      sources: ["Resources you entered", "Pity you entered", "Published Warp rules + community soft-pity model"],
      links: [{ label: "Open planner", href: "/warp?tab=planner" }],
    };
  }

  if (has(q, "guarantee", "pity", "50/50", "5050")) {
    const lines = (["character", "lightcone", "standard"] as const).map((k) => {
      const s = ctx.summary.pity[k];
      return `${POOLS[k].label}: pity ${s.pity}/${POOLS[k].five.hard}${POOLS[k].fiveFeaturedChance !== null ? (s.guaranteed ? ", guaranteed" : ", not guaranteed") : ""}${pityKnown(s) ? "" : " (not entered)"}`;
    });
    const c = ctx.summary.pity.character;
    const need = 90 - c.pity + (c.guaranteed ? 0 : 90);
    return {
      intent: "pity",
      line: !pityKnown(c) ? "I don't know ur pity|Check Star Rail Station, then type it in the Warp page|Then ask again" : c.guaranteed ? `Guarantee's on|${90 - c.pity} pulls max to the featured unit|U have ${eventPulls}` : `No guarantee|For 100% on the featured 5★ u need ${need} pulls|U have ${eventPulls}`,
      facts: lines, sources: ["Pity you entered", "Published guarantee rules"], links: [{ label: "Warp page", href: "/warp" }, { label: "Star Rail Station", href: WARP_TRACKER_URL }],
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

/**
 * Compact facts block for the Claude-powered chat. Deliberately minimal: no UID, no nickname, no
 * signature, no notes — only numbers and names the answer may need.
 */
/** Compact facts for the AI. `compact` keeps it small enough for the built-in model's short memory. */
export function buildAiContext(raw: string, ctx: TerminalContext, opts: { compact?: boolean } = {}): string {
  const lim = opts.compact ? { roster: 12, builds: 4, objectives: 3, events: 2, max: 2200 } : { roster: 60, builds: 99, objectives: 6, events: 5, max: 15000 };
  const name = (id: string) => (ctx.game?.characters[id] ? characterDisplayName(ctx.game.characters[id]) : `Character ${id}`);
  const r = ctx.profile.resources ?? {};
  const lines: string[] = [];
  lines.push(`Game data version: ${ctx.game?.version ?? "not downloaded"}`);
  lines.push(`Resources (user-entered): Stellar Jade ${r.stellarJade ?? "unknown"}, Special Passes ${r.specialPasses ?? "unknown"}, Star Rail Passes ${r.starRailPasses ?? "unknown"}, Undying Starlight ${r.undyingStarlight ?? "unknown"}, Trailblaze Power ${r.trailblazePower ?? "unknown"}`);
  for (const k of ["character", "lightcone", "standard"] as const) {
    const p = ctx.summary.pity[k];
    lines.push(`${POOLS[k].label}: ${pityKnown(p) ? `pity ${p.pity}/${POOLS[k].five.hard}` : "pity not entered"}${POOLS[k].fiveFeaturedChance !== null && pityKnown(p) ? (p.guaranteed ? ", next 5★ guaranteed featured" : ", 50/50 not guaranteed") : ""}`);
  }
  lines.push(`Characters owned: ${ctx.summary.owned}/${ctx.summary.totalPlayable}`);
  const chars = ctx.characters.slice(0, lim.roster).map((c) => {
    const g = ctx.game?.characters[c.charId];
    return `${name(c.charId)} (${g ? `${g.rarity}★ ${g.path} ${g.element}` : "?"}) Lv${c.level} E${c.eidolon} skills ${c.skills.basic}/${c.skills.skill}/${c.skills.ult}/${c.skills.talent}`;
  });
  if (chars.length) lines.push(`Roster: ${chars.join("; ")}`);
  for (const b of (ctx.builds ?? []).slice(0, lim.builds)) lines.push(`Build rating ${b.name}: ${b.grade} (${b.score.toFixed(1)}/100), ${b.equipped}/6 relics. Lacks: ${b.lacks.slice(0, 4).join("; ") || "nothing flagged"}`);
  lines.push(`Achievements tracked complete: ${ctx.summary.achievementsDone}/${ctx.summary.achievementsTotal}; map markers complete: ${ctx.summary.markersDone}/${ctx.summary.markersTotal}`);
  for (const o of ctx.summary.objectives.slice(0, lim.objectives)) lines.push(`Objective: ${o.title} — ${o.reason}`);
  const now = ctx.now ?? Date.now();
  for (const e of ctx.events.filter((e) => e.end && !e.permanent && Date.parse(e.end) > now).slice(0, lim.events)) lines.push(`Event (${e.status}): ${e.name}, ends ${e.end}, ${e.completion}`);
  const local = answer(raw, ctx);
  if (local.intent !== "unknown" && local.intent !== "help") lines.push(`Local lookup (${local.intent}): ${local.facts.join(" | ")}`);
  return lines.join("\n").slice(0, lim.max);
}
