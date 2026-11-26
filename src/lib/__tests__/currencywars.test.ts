import { describe, expect, it } from "vitest";
import { cleanWikitext, parseBonds, parseCharacters, parseCurrentSeason, parseOdds } from "../currencywars/parse";
import { boardBonds, boardGold, chanceToSee, copiesFor, rollShop } from "../currencywars/sim";
import { createRng } from "../warp/simulator";

const CHARS = `==Characters by Rarity==
===5-Cost===
{{Card List|Kafka, Clara|type=Currency Wars Character}}

===1-Cost===
{{Card List|Welt, Pearl|type=Currency Wars Character}}
<!--
===Expert Advisor===
{{Card List|TBA|type=Currency Wars Character}}
-->`;

const BONDS = `==Faction Bonds==
===Stellaron Hunters===
{{Bond Information
|name      = Stellaron Hunters
|members   = Kafka, Welt, Pearl
|effect    = Script Equipment for the {{Color|highlight|"Stellaron Hunters"|nobold=1}}.
|silver    = 3
|gold      = 5
|effect2   = Grants 1 piece. {{Icon|On Field}}{{Icon|Off Field}}20% bonus
|effect3   = 40% {{Icon|On Field}}{{Icon|Off Field}}.
}}
==School Bonds==
===Solo===
{{Bond Information
|name      = Solo
|members   = Clara
|gold      = 1
|effect1   = Becomes [[Clara|the boss]].
}}`;

const ODDS = `{| class="article-table"
|+ Shop Odds
! Level !! 1-Cost !! 2-Cost !! 3-Cost !! 4-Cost !! 5-Cost !!
|-
| 1 || 100% || - || - || - || - ||
|-
| 8 || 18% || 25% || 32% || 22% || 3% ||
|}`;

describe("Currency Wars wiki parsing", () => {
  it("reads characters by cost and ignores commented-out sections", () => {
    expect(parseCharacters(CHARS)).toEqual([{ name: "Kafka", cost: 5 }, { name: "Clara", cost: 5 }, { name: "Welt", cost: 1 }, { name: "Pearl", cost: 1 }]);
  });
  it("reads bonds with category, members, tiers and readable effects", () => {
    const [sh, solo] = parseBonds(BONDS);
    expect(sh.category).toBe("Faction");
    expect(sh.members).toEqual(["Kafka", "Welt", "Pearl"]);
    expect(sh.summary).toBe('Script Equipment for the "Stellaron Hunters".');
    expect(sh.levels.map((l) => [l.count, l.tier])).toEqual([[2, "bronze"], [3, "silver"]]);
    expect(sh.levels[1].effect).toBe("40% On-/Off-Field Strength.");
    expect(solo.category).toBe("School");
    expect(solo.levels[0]).toEqual({ count: 1, effect: "Becomes the boss.", tier: "gold" });
  });
  it("reads the shop odds table", () => {
    expect(parseOdds(ODDS)).toEqual([{ level: 1, odds: [1, 0, 0, 0, 0] }, { level: 8, odds: [0.18, 0.25, 0.32, 0.22, 0.03] }]);
  });
  it("finds the current period", () => {
    expect(parseCurrentSeason("Old.png|link=Currency Wars: Zero-Sum Game|<big>x</big><br />Version [[3.7]] – [[4.6]]\nNew.png|link=Currency Wars: Voyage Into the Canvas|<big>x</big><br />Version [[4.7]] – Present"))
      .toEqual({ season: "Voyage Into the Canvas", version: "4.7" });
  });
  it("cleans nested templates and links", () => {
    expect(cleanWikitext("A {{Color|highlight|{{Item|Credit}}|nobold=1}} and [[Page|link]]<br />B")).toBe("A Credit and link\nB");
  });
});

describe("Currency Wars board", () => {
  const bonds = parseBonds(BONDS);
  const roster = parseCharacters(CHARS);
  it("counts each character once per bond and reports the next threshold", () => {
    const states = boardBonds([{ name: "Kafka", stars: 1 }, { name: "Welt", stars: 2 }], bonds);
    expect(states[0].bond.name).toBe("Stellaron Hunters");
    expect(states[0].count).toBe(2);
    expect(states[0].active?.count).toBe(2);
    expect(states[0].next?.count).toBe(3);
  });
  it("prices the board by copies needed for each star level", () => {
    expect(copiesFor(3)).toBe(9);
    expect(boardGold([{ name: "Kafka", stars: 1 }, { name: "Welt", stars: 2 }], roster)).toBe(5 + 3);
  });
  it("shop rolls follow the level's odds and are reproducible", () => {
    const odds = parseOdds(ODDS);
    expect(rollShop(odds, 1, roster, createRng("s")).every((c) => c.cost === 1)).toBe(true);
    expect(rollShop(odds, 8, roster, createRng("x"))).toEqual(rollShop(odds, 8, roster, createRng("x")));
    expect(chanceToSee(odds, 8, 5, 5)).toBeCloseTo(1 - 0.97 ** 5, 6);
  });
});
