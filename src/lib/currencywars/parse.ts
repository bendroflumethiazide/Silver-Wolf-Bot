/**
 * Currency Wars data from the Honkai: Star Rail Wiki (Fandom, CC BY-SA 3.0): characters by cost,
 * bonds with thresholds and effects, and shop odds by level. Parsed from page wikitext.
 */

export interface CwCharacter { name: string; cost: number }
export type BondTier = "bronze" | "silver" | "gold" | "plat";
export interface CwBond {
  name: string;
  category: string;
  members: string[];
  summary: string;
  /** Unique members needed → effect text at that level. */
  levels: { count: number; effect: string; tier: BondTier }[];
}
export interface CwOdds { level: number; odds: number[] }

/** Wikitext → readable text: keeps the visible part of templates and links. */
export function cleanWikitext(s: string): string {
  // "nobold=1" is a styling flag that sits before or after the coloured text.
  let t = s.replace(/<!--[\s\S]*?-->/g, "").replace(/\|\s*nobold=1\s*(?=[|}])/g, "");
  for (let i = 0; i < 4; i++) {
    t = t
      .replace(/\{\{Color\|[^|{}]*\|([^|{}]*)(?:\|[^{}]*)?\}\}/g, "$1")
      // Icon pairs/icons stand in for words when no text follows them.
      .replace(/\{\{Icon\|On Field\}\}\{\{Icon\|Off Field\}\}(?![A-Za-z])/g, "On-/Off-Field Strength")
      .replace(/\{\{Icon\|[^{}|]+(?:\|[^{}]*)?\}\}(?=[A-Za-z"\u201c{])/g, "")
      .replace(/\{\{Icon\|([^{}|]+)(?:\|[^{}]*)?\}\}/g, "$1")
      .replace(/\{\{Item\|([^|{}]*)(?:\|[^{}]*)?\}\}/g, "$1")
      // Templates that just show a name: {{Enemy|X}}, {{Extra Effect|X}}, {{w|X}}, {{Term|X}}.
      .replace(/\{\{(?:Enemy|Extra Effect|w|Term|Character|Light Cone)\|([^|{}]*)(?:\|[^{}]*)?\}\}/g, "$1");
  }
  // Only after the known templates have given up their text, drop whatever templates remain.
  for (let i = 0; i < 4; i++) t = t.replace(/\{\{[^{}]*\}\}/g, "");
  return t
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&mdash;/g, "—").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** "===5-Cost===\n{{Card List|A, B|...}}" → characters with their cost. */
export function parseCharacters(wikitext: string): CwCharacter[] {
  const out: CwCharacter[] = [];
  const re = /===\s*(\d+)-Cost\s*===\s*\n\s*\{\{Card List\|([^|}]*)/g;
  const live = wikitext.replace(/<!--[\s\S]*?-->/g, "");
  for (const m of live.matchAll(re)) {
    const cost = Number(m[1]);
    for (const name of m[2].split(",").map((x) => x.trim()).filter((x) => x && x !== "TBA")) out.push({ name, cost });
  }
  return out;
}

function field(block: string, key: string): string | undefined {
  const m = new RegExp(`^\\|\\s*${key}\\s*=\\s*([\\s\\S]*?)(?=\\n\\||$)`, "m").exec(block);
  return m?.[1].trim();
}

/** Every {{Bond Information}} block, with the "== X Bonds ==" section it sits under. */
export function parseBonds(wikitext: string): CwBond[] {
  const bonds: CwBond[] = [];
  const re = /\{\{Bond Information\s*\n([\s\S]*?)\n\}\}/g;
  for (const m of wikitext.matchAll(re)) {
    const block = m[1];
    const before = wikitext.slice(0, m.index);
    const cat = [...before.matchAll(/^==([^=\n][^\n]*?)==\s*$/gm)].pop()?.[1].trim() ?? "Bonds";
    const name = field(block, "name");
    if (!name) continue;
    const members = cleanWikitext(field(block, "members") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const limit = (k: string) => { const v = Number(field(block, k)); return Number.isFinite(v) && v > 0 ? v : Infinity; };
    const silver = limit("silver"), gold = limit("gold"), plat = limit("plat");
    const levels = [...block.matchAll(/^\|\s*effect(\d+)\s*=\s*([\s\S]*?)(?=\n\||$)/gm)]
      .map((e) => {
        const count = Number(e[1]);
        const tier: BondTier = count >= plat ? "plat" : count >= gold ? "gold" : count >= silver ? "silver" : "bronze";
        return { count, effect: cleanWikitext(e[2]), tier };
      })
      .sort((a, b) => a.count - b.count);
    bonds.push({ name, category: cat.replace(/ Bonds$/, ""), members, summary: cleanWikitext(field(block, "effect") ?? ""), levels });
  }
  return bonds;
}

/** The "Shop Odds" wikitable: | 7 || 19% || 30% || ... */
export function parseOdds(wikitext: string): CwOdds[] {
  const at = wikitext.search(/\|\+\s*Shop Odds/);
  if (at < 0) return [];
  const table = wikitext.slice(at, wikitext.indexOf("|}", at));
  const rows: CwOdds[] = [];
  for (const line of table.split("\n")) {
    const m = /^\|\s*(\d+)\s*\|\|(.*)$/.exec(line.trim());
    if (!m) continue;
    const odds = m[2].split("||").slice(0, 5).map((c) => { const n = parseFloat(c); return Number.isFinite(n) ? n / 100 : 0; });
    while (odds.length < 5) odds.push(0);
    rows.push({ level: Number(m[1]), odds });
  }
  return rows;
}

/** Current period from the "Currency Wars" page gallery ("Version 4.7 – Present"). */
export function parseCurrentSeason(wikitext: string): { season: string; version: string } | null {
  const re = /link=Currency Wars: ([^|\]]+)\|[^\n]*?Version \[\[([\d.]+)\]\]\s*–\s*Present/;
  const m = re.exec(wikitext);
  return m ? { season: m[1].trim(), version: m[2] } : null;
}

// ---------------------------------------------------------------------------------------------
// Tables: equipment, Investment Environments/Strategies, opponents, difficulty, character pages.
// ---------------------------------------------------------------------------------------------

const ATTR = /^(?:rowspan|colspan|style|class|width|align|id)\s*=\s*"?[^|"]*"?\s*\|(?!\|)/i;

/** Split "a || b" table cells, ignoring "||" inside {{templates}} and [[links]] (pages have such typos). */
function splitCells(line: string): string[] {
  const out: string[] = [];
  let depth = 0, last = 0;
  for (let i = 0; i < line.length; i++) {
    const two = line.slice(i, i + 2);
    if (two === "{{" || two === "[[") { depth++; i++; continue; }
    if ((two === "}}" || two === "]]") && depth > 0) { depth--; i++; continue; }
    if (two === "||" && depth === 0) { out.push(line.slice(last, i)); last = i + 2; i++; }
  }
  out.push(line.slice(last));
  return out;
}

/** Rows of the first wikitable at or after `from` (cells are raw wikitext; header rows are skipped). */
export function wikiTableRows(wikitext: string, from = 0): string[][] {
  const start = wikitext.indexOf("{|", from);
  if (start < 0) return [];
  const end = wikitext.indexOf("\n|}", start);
  const body = wikitext.slice(start, end < 0 ? undefined : end);
  const rows: string[][] = [];
  let cur: string[] | null = null;
  for (const raw of body.split("\n").slice(1)) {
    const line = raw.trimEnd();
    if (line.startsWith("|+")) continue;
    if (line.startsWith("|-")) { if (cur?.length) rows.push(cur); cur = []; continue; }
    if (line.startsWith("!")) { cur = null; continue; }
    if (line.startsWith("|")) {
      cur ??= [];
      cur.push(...splitCells(line.slice(1)).map((c) => c.trim().replace(ATTR, "").trim()));
      continue;
    }
    if (cur?.length) cur[cur.length - 1] += `\n${line}`;
  }
  if (cur?.length) rows.push(cur);
  return rows;
}

const headingAt = (wikitext: string, title: string) => {
  const m = new RegExp(`^=+\\s*${title.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\s*=+\\s*$`, "m").exec(wikitext);
  return m ? m.index : -1;
};

/** "[[File:…|50px]]<br />Roller Skates" → "Roller Skates". */
const nameCell = (cell: string) => cleanWikitext(cell.split(/<br\s*\/?>/i).pop() ?? cell);
const lines = (cell: string) => cleanWikitext(cell.replace(/\{\{Icon\|[^{}]*\}\}\s*/g, "")).split("\n").map((x) => x.replace(/^\*\s*/, "").trim()).filter(Boolean);

/** Names inside {{Card|X}} / {{Card List|A, B}} (comma or "delim=;" separated). */
export function cardNames(cell: string): string[] {
  const out: string[] = [];
  for (const m of cell.matchAll(/\{\{Card( List)?\|([^|}]*)([^}]*)\}\}/g)) {
    // A single {{Card}} is one name, even with commas in it ("Savage God, Mad King, …").
    if (!m[1]) { out.push(m[2].trim()); continue; }
    const sep = /delim=;/.test(m[3]) ? ";" : ",";
    out.push(...m[2].split(sep).map((x) => x.trim()).filter(Boolean));
  }
  return out;
}

export interface CwBasicItem { name: string; tags: string[]; stats: string }
export interface CwAdvancedItem {
  name: string;
  tags: string[];
  /** "Advanced/Privileged" values, e.g. "SPD Amplification: 25%/50%". */
  stats: string[];
  effect: string;
  /** Characters the wiki lists as good users. */
  users: string[];
  /** The two basic items it is made from. */
  recipe: [string, string];
}

export interface CwEmblem {
  name: string;
  /** The Bond it grants its wearer. */
  bond: string;
  stats: string[];
  effect: string;
  users: string[];
  recipe: [string, string] | null;
}
export interface CwGem { name: string; effect: string; recipes: [string, string][] }

const pairs = (cell: string): [string, string][] => {
  const names = [...cell.matchAll(/File:Equipment[ _]([^|\]]+?)\.png/g)].map((m) => m[1].replace(/_/g, " ").trim());
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < names.length; i += 2) out.push([names[i], names[i + 1]]);
  return out;
};

/** Emblems (each grants a Bond) and the Diamond gems, from the "Other Equipment" tables. */
export function parseRareEquipment(wikitext: string): { emblems: CwEmblem[]; gems: CwGem[] } {
  const e = headingAt(wikitext, "Emblem");
  const g = headingAt(wikitext, "Diamond & Treasure Gem");
  const emblems: CwEmblem[] = e < 0 ? [] : wikiTableRows(wikitext, e).filter((r) => r.length >= 4).map((r) => {
    const effect = cleanWikitext(r[3]);
    return { name: nameCell(r[0]), bond: /Grants (?:the )?wearer the "([^"]+)" Bond/.exec(effect)?.[1] ?? "", stats: lines(r[2]), effect, users: cardNames(r[4] ?? ""), recipe: pairs(r[5] ?? "")[0] ?? null };
  }).filter((x, i, all) => x.name && x.bond && all.findIndex((y) => y.name === x.name) === i);
  const gems: CwGem[] = g < 0 ? [] : wikiTableRows(wikitext, g).filter((r) => r.length >= 3)
    .map((r) => ({ name: nameCell(r[0]), effect: cleanWikitext(r[2]).split("\n")[0], recipes: pairs(r[3] ?? "") }))
    .filter((x) => x.name);
  return { emblems, gems };
}

/** Equipment page: basic items and the advanced items with their two-item recipes. */
export function parseEquipment(wikitext: string): { basic: CwBasicItem[]; advanced: CwAdvancedItem[] } {
  const b = headingAt(wikitext, "Basic Equipment");
  const a = headingAt(wikitext, "Advanced/Privileged Equipment");
  const basic = b < 0 ? [] : wikiTableRows(wikitext, b).filter((r) => r.length >= 3)
    .map((r) => ({ name: nameCell(r[0]), tags: lines(r[1]), stats: lines(r[2]).join(" · ") }));
  const advanced: CwAdvancedItem[] = [];
  if (a >= 0) {
    for (const r of wikiTableRows(wikitext, a)) {
      if (r.length < 6) continue;
      const parts = [...r[5].matchAll(/File:Equipment ([^|\]]+?)\.png/g)].map((m) => m[1].trim());
      if (parts.length !== 2) continue;
      advanced.push({ name: nameCell(r[0]), tags: lines(r[1]), stats: lines(r[2]), effect: cleanWikitext(r[3]), users: cardNames(r[4]), recipe: [parts[0], parts[1]] });
    }
  }
  return { basic, advanced };
}

export interface CwNamed { name: string; effect: string }
/** Investment Environment list: name + effect. */
export function parseEnvironments(wikitext: string): CwNamed[] {
  return wikiTableRows(wikitext, Math.max(0, headingAt(wikitext, "List of Investment Environments")))
    .filter((r) => r.length >= 2)
    .map((r) => ({ name: nameCell(r[0]), effect: cleanWikitext(r[1]) }))
    .filter((e) => e.name && e.effect);
}

export type StrategyRarity = "Silver" | "Gold" | "Prismatic";
export interface CwStrategy extends CwNamed { rarity: StrategyRarity; planes: number[] }
/** Investment Strategies by rarity section, with the planes they can appear on. */
export function parseStrategies(wikitext: string): CwStrategy[] {
  const out: CwStrategy[] = [];
  for (const rarity of ["Prismatic", "Gold", "Silver"] as const) {
    const at = headingAt(wikitext, rarity);
    if (at < 0) continue;
    for (const r of wikiTableRows(wikitext, at)) {
      if (r.length < 2) continue;
      const planes = [...(r[2] ?? "").matchAll(/Plane (\d)/g)].map((m) => Number(m[1]));
      const name = nameCell(r[0]);
      if (name) out.push({ name, effect: cleanWikitext(r[1]), rarity, planes: planes.length ? planes : [1, 2, 3] });
    }
  }
  return out;
}

export interface CwOpponent { name: string; bosses: string[]; elites: string[]; normals: string[] }
/** The "Bosses" table: each opponent faction with its boss, elite and normal enemies. */
export function parseOpponents(wikitext: string): CwOpponent[] {
  const at = headingAt(wikitext, "Bosses");
  if (at < 0) return [];
  return wikiTableRows(wikitext, at)
    .filter((r) => r.length >= 4)
    .map((r) => ({ name: cleanWikitext(r[0]), bosses: cardNames(r[1]), elites: cardNames(r[2]), normals: cardNames(r[3]) }))
    .filter((o) => o.name && o.bosses.length);
}

export interface CwDifficulty {
  /** "A0-1" */
  id: string;
  /** "A0 Black Iron" */
  rank: string;
  /** Enemy stat boosts per plane in percent. */
  planes: { atk: number; hp: number; spd: number }[];
  /** Running total of "enemy difficulty". */
  difficulty: number;
  effects: string[];
}
/** Difficulty steps (A0-1 … A8-20) with enemy stat boosts per plane. */
export function parseDifficulty(wikitext: string): CwDifficulty[] {
  const at = headingAt(wikitext, "Stat Modifiers");
  if (at < 0) return [];
  const end = wikitext.indexOf("\n|}", at);
  const out: CwDifficulty[] = [];
  let rank = "";
  for (const chunk of wikitext.slice(at, end < 0 ? undefined : end).split(/\n\|-/)) {
    const head = /colspan[^|]*\|\s*(A\d+\s[^\n]+)/.exec(chunk);
    if (head) { rank = head[1].replace(/\s+/g, " ").replace(/Vi ridian/, "Viridian").trim(); continue; }
    const id = /^\s*\n?\|\s*(A\d+-\d+)/.exec(chunk)?.[1];
    if (!id) continue;
    const planes: CwDifficulty["planes"] = [];
    // Tolerates the page's typos ("SPD `4%", "ATK 40/HP", "Plane: ATK").
    for (const m of chunk.matchAll(/Planes? ([\d/]+):\s*(?:Plane:\s*)?ATK ([\d.]+)%?\/HP ([\d.]+)%?\/SPD\s*\D?([\d.]+)%?/g)) {
      for (const p of m[1].split("/")) planes[Number(p) - 1] = { atk: Number(m[2]), hp: Number(m[3]), spd: Number(m[4]) };
    }
    const effects = [...chunk.matchAll(/^\*\s*(.+)$/gm)].map((m) => cleanWikitext(m[1])).filter((e) => e && !/^Planes? \d/.test(e));
    const difficulty = Number(/Enemy difficulty \+\d+ \((\d+)\)/.exec(chunk)?.[1] ?? 0);
    if (planes.filter(Boolean).length === 3) out.push({ id, rank: rank || id.split("-")[0], planes, difficulty, effects: effects.filter((e) => !/^Enemy difficulty/.test(e)) });
  }
  return out;
}

export type CwField = "on" | "off" | "both";
export interface CwAbility { name: string; types: string[]; effect: string }
export interface CwCharInfo {
  cost: number;
  field: CwField;
  roles: string[];
  bonds: string[];
  /** On-/Off-Field Strength by star (1★, 2★, 3★, and 4★ where the character has one). */
  onField: number[];
  offField: number[];
  /** HP Amplification in percent by star. */
  hp: number[];
  /** SPD Amplification in percent by star. */
  spd?: number[];
  healing?: number[];
  shield?: number[];
  /** Hidden multipliers from the damage formula: base DMG Amplification, and per Eidolon level. */
  baseDmgAmp?: number;
  eidolonAmp?: number;
  /** Short ability summaries from the infobox (with Energy where listed). */
  summaries?: { name: string; types: string[]; desc: string; energy?: number }[];
  /** Full abilities by group ("On Field", "Off Field", "4-Cost", …). Values read "1★/2★/3★(/4★)". */
  abilities?: { group: string; list: CwAbility[] }[];
  eidolons?: { name: string; desc: string }[];
  lightCone?: { name: string; desc: string } | null;
  /** Recommended equipment by group ("On-Field", "Off-Field" or "All"). */
  recommended?: { group: string; items: string[] }[];
  notes?: string[];
}

/** A template parameter that may span lines: "|key = value" up to the next "|param" or "}}". */
function param(block: string, key: string): string {
  const m = new RegExp(`^\\|\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*([\\s\\S]*?)(?=\\n\\s*\\||\\n\\}\\}|$)`, "m").exec(block);
  return m?.[1].trim() ?? "";
}
/** The body of the first {{Name …}} template (balanced braces). */
function template(wikitext: string, name: string): string | null {
  const at = wikitext.indexOf(`{{${name}`);
  if (at < 0) return null;
  let depth = 0;
  for (let i = at; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") { depth++; i++; }
    else if (wikitext[i] === "}" && wikitext[i + 1] === "}") { depth--; i++; if (depth === 0) return wikitext.slice(at, i + 1); }
  }
  return null;
}
/** Text of a "==Heading==" section (up to the next heading of the same or higher level). */
function section(wikitext: string, title: string, level = 2): string {
  const eq = "=".repeat(level);
  const m = new RegExp(`^${eq}\\s*${title.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\s*${eq}\\s*$`, "m").exec(wikitext);
  if (!m) return "";
  const rest = wikitext.slice(m.index + m[0].length);
  const next = new RegExp(`^={1,${level}}[^=]`, "m").exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** A "<Name> (<Season>)" character page: infobox, Character Details, abilities, Eidolons, Light Cone, equipment. */
export function parseCharInfo(wikitext: string): CwCharInfo | null {
  const infobox = template(wikitext, "Currency Wars Character Infobox") ?? wikitext;
  const get = (k: string) => new RegExp(`^\\|\\s*${k}\\s*=\\s*([^\\n|]*)`, "m").exec(infobox)?.[1].trim() ?? "";
  const cost = Number(get("cost"));
  const fieldText = get("field").toLowerCase();
  if (!cost || !fieldText) return null;
  const field: CwField = fieldText.includes("/") ? "both" : fieldText.startsWith("off") ? "off" : "on";
  const details = template(wikitext, "Currency Wars Character Details") ?? wikitext;
  const dget = (k: string) => new RegExp(`^\\|\\s*${k}\\s*=\\s*([^\\n|]*)`, "m").exec(details)?.[1].trim() ?? "";
  // 1★–3★ always; a 4★ value only where the page has one.
  const nums = (k: string) => { const v = [1, 2, 3, 4].map((i) => dget(`${k}${i}`)); return v.filter((x, i) => i < 3 || x !== "").map((x) => parseFloat(x) || 0); };

  const summaries: NonNullable<CwCharInfo["summaries"]> = [];
  for (let i = 1; i <= 6; i++) {
    const name = get(`ability${i}`);
    if (!name) continue;
    const types = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => get(`ability${i}_type${k}`)).filter(Boolean);
    const energy = Number(get(`energy${i}`)) || undefined;
    summaries.push({ name, types, desc: cleanWikitext(param(infobox, `ability${i}_desc`)), energy });
  }

  const abilitiesText = section(wikitext, "Abilities");
  const abilities: NonNullable<CwCharInfo["abilities"]> = [];
  const parts = abilitiesText.split(/^===\s*([^=\n]+?)\s*===\s*$/m);
  // parts: [before, title1, body1, title2, body2, …]
  const groups: [string, string][] = [];
  if (parts[0].includes("{|")) groups.push([field === "off" ? "Off Field" : "On Field", parts[0]]);
  for (let i = 1; i + 1 < parts.length; i += 2) groups.push([parts[i], parts[i + 1]]);
  for (const [group, body] of groups) {
    const list = wikiTableRows(body).filter((r) => r.length >= 3).map((r) => ({
      name: nameCell(r[0].replace(/<!--[\s\S]*?-->/g, "")),
      types: cleanWikitext(r[1]).split(/\s*[,/]\s*|\n/).filter(Boolean),
      effect: cleanWikitext(r[2].replace(/\{\{Extra Effect\|([^|}]+)(?:\|[^}]*)?\}\}/g, "$1")),
    })).filter((a) => a.name && a.effect);
    if (list.length) abilities.push({ group, list });
  }

  const eid = template(wikitext, "Currency Wars Character Eidolons");
  const eidolons = eid ? [1, 2, 3, 4, 5, 6].map((i) => ({ name: cleanWikitext(param(eid, `eidolon${i}`)), desc: cleanWikitext(param(eid, `eidolon${i}_desc`).replace(/\{\{Extra Effect\|([^|}]+)(?:\|[^}]*)?\}\}/g, "$1")) })).filter((e) => e.name) : [];
  const lc = template(wikitext, "Currency Wars Character Light Cone");
  const lightCone = lc ? { name: cleanWikitext(param(lc, "name")), desc: cleanWikitext(param(lc, "desc")) } : null;

  const eqText = section(wikitext, "Recommended Equipment");
  const recommended: NonNullable<CwCharInfo["recommended"]> = [];
  const eqParts = eqText.split(/^===\s*([^=\n]+?)\s*===\s*$/m);
  const eqGroups: [string, string][] = [];
  if (/\{\{Currency Wars Character Equipment/.test(eqParts[0])) eqGroups.push(["All", eqParts[0]]);
  for (let i = 1; i + 1 < eqParts.length; i += 2) eqGroups.push([eqParts[i], eqParts[i + 1]]);
  for (const [group, body] of eqGroups) {
    const items = [...body.matchAll(/^\|\s*equipment\s*\d+\s*=\s*([^\n|]+)/gm)].map((m) => m[1].trim()).filter(Boolean);
    if (items.length) recommended.push({ group, items });
  }
  const notes = [...section(wikitext, "Gameplay Notes").matchAll(/^\*+\s*(.+)$/gm)].map((m) => cleanWikitext(m[1])).filter(Boolean);

  return {
    cost, field,
    roles: ["role1", "role2"].map(get).map((r) => r.replace(/\s*\(.*\)$/, "")).filter(Boolean),
    bonds: ["bond1", "bond2", "bond3"].map(get).filter(Boolean),
    onField: nums("on_field"), offField: nums("off_field"), hp: nums("hp"),
    spd: nums("spd"), healing: nums("healing"), shield: nums("shield"),
    baseDmgAmp: parseFloat(get("dmg")) || 0, eidolonAmp: parseFloat(get("eidolon")) || 0,
    summaries, abilities, eidolons, lightCone, recommended, notes,
  };
}
