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
  let t = s.replace(/<!--[\s\S]*?-->/g, "");
  for (let i = 0; i < 4; i++) {
    t = t
      .replace(/\{\{Color\|[^|{}]*\|([^|{}]*)(?:\|[^{}]*)?\}\}/g, "$1")
      // Icon pairs/icons stand in for words when no text follows them.
      .replace(/\{\{Icon\|On Field\}\}\{\{Icon\|Off Field\}\}(?![A-Za-z])/g, "On-/Off-Field Strength")
      .replace(/\{\{Icon\|[^{}|]+(?:\|[^{}]*)?\}\}(?=[A-Za-z"\u201c{])/g, "")
      .replace(/\{\{Icon\|([^{}|]+)(?:\|[^{}]*)?\}\}/g, "$1")
      .replace(/\{\{Item\|([^|{}]*)(?:\|[^{}]*)?\}\}/g, "$1");
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
