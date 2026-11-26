import { wikiQueryAll, WIKI } from "./fandom";

export const ENEMY_PACK_KEY = "wikiEnemies";

export type EnemyType = "Boss" | "Echo of War" | "Elite" | "Normal" | "Other";
export const ELEMENTS = ["Physical", "Fire", "Ice", "Lightning", "Wind", "Quantum", "Imaginary"] as const;
export type Element = (typeof ELEMENTS)[number];

export interface WikiEnemy { title: string; image?: string; type: EnemyType; weak: Element[]; version?: string; url: string }
export interface EnemyPack { fetchedAt: string; source: string; license: string; enemies: WikiEnemy[] }

const TYPE_CATS: [string, EnemyType][] = [["Echo of War Enemies", "Echo of War"], ["Boss Enemies", "Boss"], ["Elite Enemies", "Elite"], ["Normal Enemies", "Normal"]];
const WEAK = (e: string) => `Enemies Weak to ${e}`;
export const ENEMY_CATEGORIES = [...TYPE_CATS.map(([c]) => c), ...ELEMENTS.map(WEAK)];

interface RawPage { title?: string; thumbnail?: { source?: string }; categories?: { title?: string }[] }

/** Turn raw wiki pages into enemies; drops variant pages like “X (Bug)” when “X” exists. */
export function parseEnemyPages(pages: Record<string, RawPage>): WikiEnemy[] {
  const list = Object.values(pages).filter((p) => p.title).map((p) => {
    const cats = new Set((p.categories ?? []).map((c) => (c.title ?? "").replace(/^Category:/, "")));
    const type = TYPE_CATS.find(([c]) => cats.has(c))?.[1] ?? "Other";
    return { title: p.title!, image: p.thumbnail?.source, type, weak: ELEMENTS.filter((e) => cats.has(WEAK(e))), url: WIKI.page(p.title!) } as WikiEnemy;
  });
  const names = new Set(list.map((e) => e.title));
  return list
    .filter((e) => { const m = /^(.*) \(([^)]*)\)$/.exec(e.title); return !m || !names.has(m[1]); })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function downloadEnemyPack(fetchFn: typeof fetch = fetch): Promise<EnemyPack> {
  const pages = await wikiQueryAll({
    generator: "categorymembers", gcmtitle: "Category:Enemies", gcmtype: "page", gcmlimit: "50",
    prop: "categories|pageimages", clcategories: ENEMY_CATEGORIES.map((c) => `Category:${c}`).join("|"), cllimit: "max",
    piprop: "thumbnail", pithumbsize: "320",
  }, 40, fetchFn);
  const enemies = parseEnemyPages(pages as Record<string, RawPage>);
  if (!enemies.length) throw new Error("The wiki returned no enemies.");
  return { fetchedAt: new Date().toISOString(), source: WIKI.name, license: WIKI.license, enemies };
}
