import { describe, expect, it } from "vitest";
import { parseEnemyPages, downloadEnemyPack } from "../wiki/enemies";
import { wikiQueryAll } from "../wiki/fandom";

const page = (title: string, cats: string[], img = true) => ({ title, ...(img ? { thumbnail: { source: `https://static.wikia.nocookie.net/x/${title}.png` } } : {}), categories: cats.map((c) => ({ title: `Category:${c}` })) });

describe("wiki enemy pack", () => {
  it("reads type and weaknesses from categories and drops duplicate variants", () => {
    const list = parseEnemyPages({
      1: page("Cocolia, Mother of Deception", ["Echo of War Enemies", "Enemies Weak to Fire", "Enemies Weak to Lightning"]),
      2: page("Automaton Beetle", ["Normal Enemies", "Enemies Weak to Wind"]),
      3: page("Automaton Beetle (Bug)", ["Normal Enemies"]),
      4: page("Argenti (Boss)", ["Boss Enemies", "Enemies Weak to Physical"]),
    });
    expect(list.map((e) => e.title)).toEqual(["Argenti (Boss)", "Automaton Beetle", "Cocolia, Mother of Deception"]);
    const c = list.find((e) => e.title.startsWith("Cocolia"))!;
    expect(c.type).toBe("Echo of War");
    expect(c.weak).toEqual(["Fire", "Lightning"]);
    expect(c.url).toBe("https://honkai-star-rail.fandom.com/wiki/Cocolia%2C_Mother_of_Deception");
  });
  it("follows API continuation and merges categories split across responses", async () => {
    const responses = [
      { continue: { clcontinue: "x", continue: "||" }, query: { pages: { 1: page("A", ["Elite Enemies"]) } } },
      { query: { pages: { 1: { title: "A", categories: [{ title: "Category:Enemies Weak to Ice" }] }, 2: page("B", ["Normal Enemies"]) } } },
    ];
    const urls: string[] = [];
    const fake = (async (u: string) => { urls.push(u); return new Response(JSON.stringify(responses.shift())); }) as unknown as typeof fetch;
    const pages = await wikiQueryAll({ generator: "categorymembers" }, 5, fake);
    expect(Object.keys(pages)).toHaveLength(2);
    expect((pages["1"].categories as unknown[]).length).toBe(2);
    expect(urls[0]).toContain("origin=*");
    expect(urls[1]).toContain("clcontinue=x");
  });
  it("fails loudly on an empty answer", async () => {
    const fake = (async () => new Response(JSON.stringify({ query: { pages: {} } }))) as unknown as typeof fetch;
    await expect(downloadEnemyPack(fake)).rejects.toThrow(/no enemies/);
  });
});
