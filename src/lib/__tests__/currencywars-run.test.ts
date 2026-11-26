import { describe, expect, it } from "vitest";
import { buildTimeline, hpAt, turnOrder, turnsOf } from "../currencywars/timeline";
import { bondNames, membersOf, trackedMatches } from "../currencywars/bonds";
import { characterStats, itemBoosts, parseStatLine } from "../currencywars/stats";
import { combinations, combineResult, describe as describeItem, goldOreName, isOre, oreName } from "../currencywars/items";
import { cardNames, cleanWikitext, parseCharInfo, parseRareEquipment, parseDifficulty, parseEnvironments, parseEquipment, parseOpponents, parseStrategies, wikiTableRows } from "../currencywars/parse";
import {
  ASSUMED, advance, applyEffect, enterNode, openOre, skipSupply, teamSize, battle, buy, buyXp, chooseEnvironment, combineBag, deployed, enemyPower, equip, merge, moveUnit, newRun,
  nodeKind, objectives, pickStrategy, pickSupply, recipe, refresh, RULES, sell, teamPower, toggleLock, unitPower, units, type RunState,
} from "../currencywars/run";
import { bondVariants, withVariants, type CwPack } from "../currencywars/sim";
import { createRng } from "../warp/simulator";

const EQUIP = `==Equipment==
===Basic Equipment===
{|class="wikitable tdc1 thc1"
! width="100px" | Equipment
! Tags !! Stats
|-
| [[File:Equipment Roller Skates.png|50px]]<br />Roller Skates
| SPD
| {{Icon|SPD Amplification}} SPD Amplification: 5%
|-
| [[File:Equipment Folding Knife.png|50px]]<br />Folding Knife
| On-Field
| {{Icon|On Field}} On-Field Strength: 10%
|}

===Advanced/Privileged Equipment===
{| class="wikitable"
! Equipment !! Tags !! Stats !! Effect !! Users !! Synthesis
|-
| [[File:Equipment Firestorm Surge.png|50px]]<br />Firestorm Surge
| Consecutive Action<br />DPS
| {{Icon|SPD Amplification}} SPD Amplification 10%/20%<br />{{Icon|On Field}} On-Field Strength 25%/50%
| After each attack by the wearer, their strength increases by 6%/12%.
| {{Card List|Kafka,Welt|type=Currency Wars Character}}
| {{nowrap|[[File:Equipment Folding Knife.png|40px]] + [[File:Equipment Roller Skates.png|40px]]}}
|-
| [[File:Equipment Anti-Grav Boots.png|50px]]<br />Anti-Grav Boots
| SPD
| {{Icon|SPD Amplification}} SPD Amplification: 25%/50%
| SPD up each turn.
| {{Card List|Pearl|type=Currency Wars Character}}
| {{nowrap|[[File:Equipment Roller Skates.png|40px]] + [[File:Equipment Roller Skates.png|40px]]}}
|}`;

const OPP = `==Difficulty==
===Stat Modifiers===
{| class="wikitable"
!Difficulty Level
!Enemy Stat Boosts (Planes 1/2/3)
!Additional Effects
|-
! colspan="3" style="text-align: center;"| A0 Black Iron
|-
|A0-1
|
* Plane 1: ATK 1%/HP 4%/SPD 1%
* Planes 2/3: ATK 1%/HP 5%/SPD 1%
|
* The match starts with a "Precision Disassembly Wrench"
* Enemy difficulty +1 (1)
|-
|A0-2
|
* Plane 1: ATK 2%/HP 8%/SPD \`2%
* Plane 2: ATK 2%/HP 9%/SPD 2%
* Plane 3: Plane: ATK 2%/HP 11%/SPD 2%
|
* Enemy difficulty +1 (2)
|}

==Bosses==
{| class="article-table tdc"
! colspan="2" | Boss
! Elite Enemies
! Normal Enemies
|- id="Strifront Legion"
| Strifront Legion
| {{Card|Savage God, Mad King, Incarnation of Strife|show_caption=1|notext=1}}
| {{Card List|Furiae Praetor; Moonlit Pegasus|delim=;|show_caption=1|notext=1}}
| {{Card List|Furiae Warrior; Furiae Archer|delim=;|show_caption=1|notext=1}}
|- id="Everwinter"
| Everwinter Trade Union
| {{Card|Cocolia (Complete)|show_caption=1|notext=1}}
| {{Card List|Silvermane Lieutenant|delim=;}}
| {{Card List|Silvermane Soldier; Silvermane Gunner|delim=;}}
|- id="Ironwill"
| Ironwill Corps
| {{Card|Alloy Mechatron: King Pom-Pom|show_caption=1|notext=1}}
| {{Card List|Senior Staff: Team Leader|delim=;}}
| {{Card List|Grunt: Field Personnel|delim=;}}
|}`;

const ENV = `==List of Investment Environments==
{| class="wikitable tdc1"
! Name !! Effect
|-
|{{Icon/Dark|Investment Environment Scent of Gunpowder Icon.png|50}}<br />Scent of Gunpowder
|Starts with 2 Basic Weapon Box(es).
|-
|{{Icon/Dark|X.png|50}}<br />Talent Recruitment
|Start with 1 random {{Color|#927fe7|4-cost character(s)}}.
|}`;

const STRAT = `==Investment Strategy by Rarity==
===Prismatic===
{| class="wikitable tdc1"
! Name !! Effect !! Plane of Appearance
|-
|{{Icon/Dark|A.png|50}}<br />Interest Rate Increase
|Gain 25 Gold Coin(s). Your maximum Interest is increased to 10 Gold Coins.
|Plane 1
|}
===Gold===
{| class="wikitable tdc1"
! Name !! Effect !! Plane of Appearance
|-
|{{Icon/Dark|B.png|50}}<br />Buy-Out
|You no longer gain Interest. Instantly gain 15 Gold Coins. Gain 4 Experience whenever you enter a new Node.
|Plane 1, Plane 2
|}
===Silver===
{| class="wikitable tdc1"
! Name !! Effect !! Plane of Appearance
|-
|{{Icon/Dark|C.png|50}}<br />Small Help
|When a fight ends, gain 1 Gold Coin(s).
|Plane 1, Plane 2, Plane 3
|}`;

const KAFKA = `{{Currency Wars Character Infobox
|name           = Kafka
|cost           = 5
|field          = On Field
|role1          = DPS
|role2          = Support
|bond1          = Stellaron Hunters
|bond2          = DoT
}}
{{Currency Wars Character Details
|hp1 = 60%
|hp2 = 108%
|hp3 = 500%
|on_field1 = 200
|on_field2 = 320
|on_field3 = 2000
|off_field1 = 0
|off_field2 = 0
|off_field3 = 0
}}`;

describe("Currency Wars table parsers", () => {
  it("reads wikitables with multi-line cells and attributes", () => {
    const rows = wikiTableRows(`{|\n! a !! b\n|-\n|rowspan=2| x || y\n|-\n| z\n* more\n|}`);
    expect(rows).toEqual([["x", "y"], ["z\n* more"]]);
  });

  it("parses equipment with recipes and without duplicated icon names", () => {
    const eq = parseEquipment(EQUIP);
    expect(eq.basic).toEqual([{ name: "Roller Skates", tags: ["SPD"], stats: "SPD Amplification: 5%" }, { name: "Folding Knife", tags: ["On-Field"], stats: "On-Field Strength: 10%" }]);
    expect(eq.advanced[0]).toMatchObject({ name: "Firestorm Surge", recipe: ["Folding Knife", "Roller Skates"], users: ["Kafka", "Welt"], tags: ["Consecutive Action", "DPS"] });
    expect(eq.advanced[0].stats[1]).toBe("On-Field Strength 25%/50%");
  });

  it("keeps a single card's commas and splits card lists", () => {
    expect(cardNames("{{Card|Savage God, Mad King|x=1}}")).toEqual(["Savage God, Mad King"]);
    expect(cardNames("{{Card List|A; B|delim=;}} {{Card List|C, D}}")).toEqual(["A", "B", "C", "D"]);
  });

  it("parses opponents and difficulty steps, tolerating the page's typos", () => {
    const opp = parseOpponents(OPP);
    expect(opp.map((o) => o.name)).toEqual(["Strifront Legion", "Everwinter Trade Union", "Ironwill Corps"]);
    expect(opp[0].bosses).toEqual(["Savage God, Mad King, Incarnation of Strife"]);
    const diff = parseDifficulty(OPP);
    expect(diff.map((d) => d.id)).toEqual(["A0-1", "A0-2"]);
    expect(diff[0]).toMatchObject({ rank: "A0 Black Iron", difficulty: 1, effects: ['The match starts with a "Precision Disassembly Wrench"'] });
    expect(diff[0].planes.map((p) => p.hp)).toEqual([4, 5, 5]);
    expect(diff[1].planes.map((p) => p.hp)).toEqual([8, 9, 11]);
  });

  it("parses environments, strategies by rarity and character pages", () => {
    expect(parseEnvironments(ENV)[1]).toEqual({ name: "Talent Recruitment", effect: "Start with 1 random 4-cost character(s)." });
    const st = parseStrategies(STRAT);
    expect(st.map((s) => [s.name, s.rarity, s.planes])).toEqual([["Interest Rate Increase", "Prismatic", [1]], ["Buy-Out", "Gold", [1, 2]], ["Small Help", "Silver", [1, 2, 3]]]);
    expect(parseCharInfo(KAFKA)).toMatchObject({ cost: 5, field: "on", roles: ["DPS", "Support"], bonds: ["Stellaron Hunters", "DoT"], onField: [200, 320, 2000], offField: [0, 0, 0], hp: [60, 108, 500] });
    expect(parseCharInfo("no infobox")).toBeNull();
  });

  it("drops the nobold flag on either side of coloured text", () => {
    expect(cleanWikitext("for every {{Color|highlight|nobold=1|10 Gold Coins}} and {{Color|highlight|15%|nobold=1}}")).toBe("for every 10 Gold Coins and 15%");
  });
});

// A small but complete pack: 2 characters per cost so shops and supplies always have something.
const NAMES: [string, number, "on" | "off" | "both"][] = [
  ["Welt", 1, "both"], ["Pearl", 1, "off"], ["Natasha", 2, "off"], ["Robin", 2, "on"], ["Feixiao", 3, "on"], ["Luocha", 3, "both"],
  ["Serval", 4, "on"], ["Huohuo", 4, "off"], ["Kafka", 5, "on"], ["Jade", 5, "off"], ["Aeon ★ Aha", 7, "on"],
];
const STR: Record<number, number[]> = { 1: [100, 160, 220], 2: [125, 200, 275], 3: [150, 240, 330], 4: [175, 280, 500], 5: [200, 320, 2000], 7: [175, 280, 385] };
const eq = parseEquipment(EQUIP);
const PACK: CwPack = {
  schema: 2, season: "Test", version: "4.7",
  characters: NAMES.map(([name, cost]) => ({ name, cost })),
  bonds: [
    { name: "Stellaron Hunters", category: "Faction", members: ["Kafka", "Welt", "Pearl"], summary: "", levels: [{ count: 2, effect: "a", tier: "bronze" }, { count: 3, effect: "b", tier: "gold" }] },
    { name: "Heal", category: "School", members: ["Natasha", "Luocha", "Huohuo"], summary: "", levels: [{ count: 2, effect: "c", tier: "silver" }] },
  ],
  odds: [[1, [1, 0, 0, 0, 0]], [2, [1, 0, 0, 0, 0]], [3, [1, 0, 0, 0, 0]], [4, [0.65, 0.25, 0.1, 0, 0]], [5, [0.45, 0.33, 0.2, 0.02, 0]], [6, [0.3, 0.4, 0.25, 0.05, 0]], [7, [0.19, 0.3, 0.4, 0.1, 0.01]], [8, [0.18, 0.25, 0.32, 0.22, 0.03]], [9, [0.15, 0.2, 0.25, 0.3, 0.1]], [10, [0.05, 0.1, 0.2, 0.4, 0.25]]].map(([level, odds]) => ({ level: level as number, odds: odds as number[] })),
  oddsFrom: "test",
  equipment: {
    ...eq,
    emblems: [
      { name: "Stellaron Hunters Emblem", bond: "Stellaron Hunters", stats: ["DMG Mitigation 15%"], effect: 'Grants wearer the "Stellaron Hunters" Bond.', users: [], recipe: ["Red Gem", "Folding Knife"] },
      { name: "Heal Emblem", bond: "Heal", stats: [], effect: 'Grants the wearer the "Heal" Bond.', users: [], recipe: null },
    ],
    gems: [
      { name: "Red Gem", effect: "Used to synthesize Faction Emblems.", recipes: [] },
      { name: "Blue Gem", effect: "Used to synthesize School Emblems.", recipes: [] },
      { name: "Wealth Gem", effect: "Owning a Gem increases the team size limit by 1.", recipes: [["Red Gem", "Red Gem"], ["Red Gem", "Blue Gem"]] },
    ],
  },
  environments: parseEnvironments(ENV),
  strategies: parseStrategies(STRAT),
  opponents: parseOpponents(OPP),
  difficulty: parseDifficulty(OPP),
  info: Object.fromEntries(NAMES.map(([name, cost, field]) => [name, { cost, field, roles: [], bonds: [], onField: field === "off" ? [100, 160, 220] : STR[cost], offField: field === "on" ? [0, 0, 0] : STR[cost], hp: [0, 30, 60] }])),
  fetchedAt: "2026-11-26", source: "test", license: "test",
};

/** Plays a run with a simple, sensible policy; returns the final state. */
function autoplay(seed: string, rank = "A0-1", smart = true): RunState {
  let s = newRun(PACK, seed, rank);
  for (let guard = 0; guard < 400 && s.phase !== "over"; guard++) {
    if (s.phase === "environment") s = chooseEnvironment(s, PACK, 0);
    else if (s.phase === "strategy") s = pickStrategy(s, PACK, 0);
    else if (s.phase === "supply") { const n = pickSupply(s, PACK, 0); s = n.phase === "supply" ? skipSupply(n, PACK) : n; }
    else if (s.phase === "encounter") s = { ...s, phase: "prep", encounter: "easy" };
    else if (s.phase === "result") s = advance(s, PACK);
    else {
      if (smart) {
        while (s.level < 8 && s.gold >= s.xpCost + 6) { const n = buyXp(s); if (n === s) break; s = n; }
        s.shop.forEach((slot, i) => { if (slot && s.gold - slot.cost >= 4) s = buy(s, PACK, i); });
        for (let i = 0; i < s.bench.length; i++) {
          const u = s.bench[i];
          if (!u) continue;
          const zone = PACK.info![u.name].field === "off" ? "off" : "on";
          const free = s[zone].findIndex((x) => !x);
          if (free >= 0) s = moveUnit(s, { zone: "bench", index: i }, { zone, index: free });
        }
        for (let g = 0; g < 20; g++) { const i = s.bag.findIndex((x) => /Crystal Ore/.test(x)); if (i < 0) break; const n = openOre(s, PACK, i); if (n.bag.length >= s.bag.length && n.gold === s.gold) break; s = n; }
        for (let g = 0; g < 20; g++) {
          const bi = s.bag.findIndex((x) => !/Crystal Ore/.test(x));
          const target = deployed(s).find((u) => u.items.length < 3);
          if (bi < 0 || !target) break;
          const spot = (["on", "off"] as const).map((z) => ({ zone: z, index: s[z].findIndex((x) => x?.uid === target.uid) })).find((x) => x.index >= 0)!;
          const n = equip(s, PACK, bi, spot);
          if (n.bag.length >= s.bag.length) break;
          s = n;
        }
      }
      s = battle(s, PACK);
    }
  }
  return s;
}

describe("variant bonds", () => {
  const b = (name: string) => ({ name, category: "Faction", members: ["A"], summary: "", levels: [] });
  const list = [b("Phantasmoon Games: Wishpower"), b("Phantasmoon Games: Roll-Call"), b("Beast Garden"), b("Twin Dragons: Solo")];
  it("groups per-game variants and keeps one", () => {
    expect(bondVariants(list)).toEqual({ "Phantasmoon Games": ["Phantasmoon Games: Wishpower", "Phantasmoon Games: Roll-Call"] });
    expect(withVariants(list).map((x) => x.name)).toEqual(["Phantasmoon Games: Wishpower", "Beast Garden", "Twin Dragons: Solo"]);
    expect(withVariants(list, { "Phantasmoon Games": "Phantasmoon Games: Roll-Call" }).map((x) => x.name)).toEqual(["Phantasmoon Games: Roll-Call", "Beast Garden", "Twin Dragons: Solo"]);
  });
});

describe("Currency Wars run simulator", () => {
  it("starts a run by the rules: 100 HP, 3 starters of up to 3-cost, 3 environments, 3 opponents", () => {
    const s = newRun(PACK, "seed", "A0-1");
    expect(s.hp).toBe(100);
    expect(units(s)).toHaveLength(3);
    expect(units(s).every((u) => u.cost <= 3)).toBe(true);
    expect(new Set(units(s).map((u) => u.name)).size).toBe(3);
    expect(deployed(s)).toHaveLength(3);
    expect(s.offers.environments).toHaveLength(2); // only two exist in the fixture
    expect(s.opponents).toHaveLength(3);
    expect(newRun(PACK, "seed", "A0-1")).toEqual(s);
  });

  it("follows the wiki node order and turns Encounters into fights below Jade Steel", () => {
    expect(RULES.planes.map((p) => p.length)).toEqual([9, 7, 7]);
    expect(nodeKind({ plane: 0, node: 6, rank: "A0-1" })).toBe("Combat");
    expect(nodeKind({ plane: 0, node: 6, rank: "A2-1" })).toBe("Encounter");
    expect(nodeKind({ plane: 2, node: 6, rank: "A0-1" })).toBe("Boss");
  });

  it("applies environment and strategy text it understands", () => {
    const s = newRun(PACK, "fx", "A0-1");
    const [a, appliedA] = applyEffect(s, PACK, "Starts with 2 Basic Weapon Box(es).", createRng("x"));
    expect(a.bag).toHaveLength(2);
    expect(appliedA).toContain("2 basic equipment");
    const [b] = applyEffect(s, PACK, "Gain 25 Gold Coin(s). Your maximum Interest is increased to 10 Gold Coins.", createRng("x"));
    expect([b.gold - s.gold, b.interestCap]).toEqual([25, 10]);
    const [c] = applyEffect(s, PACK, "You no longer gain Interest. Instantly gain 15 Gold Coins. Gain 4 Experience whenever you enter a new Node.", createRng("x"));
    expect([c.gold - s.gold, c.interestCap, c.xpPerNode]).toEqual([15, 0, 4]);
    const [d, appliedD] = applyEffect(s, PACK, "When a fight ends, gain 1 Gold Coin(s).", createRng("x"));
    expect([d.gold, appliedD]).toEqual([s.gold, []]);
    const [e] = applyEffect(s, PACK, "Gains a crystal ore worth 6/8/12 Gold Coin(s) at the start of Plane 1/2/3 respectively.", createRng("x"));
    expect(e.planeGold).toEqual([6, 8, 12]);
  });

  it("merges three copies of the same star, keeping items", () => {
    let s = newRun(PACK, "m", "A0-1");
    s = { ...s, on: Array(4).fill(null), off: Array(6).fill(null), bench: Array(9).fill(null), bag: [] };
    s.bench[0] = { uid: 90, name: "Welt", cost: 1, stars: 1, items: ["Roller Skates"] };
    s.bench[1] = { uid: 91, name: "Welt", cost: 1, stars: 1, items: [] };
    s.bench[2] = { uid: 92, name: "Welt", cost: 1, stars: 1, items: ["Folding Knife"] };
    const m = merge(s);
    expect(units(m)).toEqual([{ uid: 90, name: "Welt", cost: 1, stars: 2, items: ["Roller Skates", "Folding Knife"] }]);
  });

  it("charges the verified prices: 2 gold refresh, 4 gold Experience, cost to buy", () => {
    let s = newRun(PACK, "p", "A0-1");
    s = chooseEnvironment(s, PACK, 1);
    s = { ...s, gold: 20 };
    const r = refresh(s, PACK);
    expect(r.gold).toBe(18);
    const x = buyXp(s);
    expect(x.gold).toBe(16);
    expect(x.xp + (x.level - s.level) * 6).toBeGreaterThanOrEqual(ASSUMED.xpPerBuy);
    const slot = s.shop.findIndex(Boolean);
    const b = buy(s, PACK, slot);
    expect(b.gold).toBe(20 - s.shop[slot]!.cost);
    expect(b.tick).toBeGreaterThan(s.tick); // bought (a third copy merges, so the unit count can drop)
    expect(toggleLock(s).locked).toBe(true);
    expect(refresh({ ...s, gold: 1 }, PACK).note).toMatch(/costs 2/);
  });

  it("combines two basic items into the recipe's advanced item, on a character or in the bag", () => {
    expect(recipe(PACK, "Roller Skates", "Folding Knife")?.name).toBe("Firestorm Surge");
    let s = chooseEnvironment(newRun(PACK, "i", "A0-1"), PACK, 0);
    s = { ...s, bag: ["Folding Knife", "Roller Skates", "Roller Skates"] };
    const spot = { zone: "on" as const, index: s.on.findIndex(Boolean) };
    if (spot.index < 0) { spot.index = 0; s = { ...s, on: [deployed(s)[0], null, null, null], off: Array(6).fill(null) }; }
    s = equip(s, PACK, 0, spot);
    s = equip(s, PACK, 0, spot);
    expect(s.on[spot.index]!.items).toEqual(["Firestorm Surge"]);
    expect(combineBag({ ...s, bag: ["Roller Skates", "Roller Skates"] }, PACK, 0, 1).bag).toEqual(["Anti-Grav Boots"]);
  });

  it("enforces team size and makes wrongly placed On-Field characters idle", () => {
    let s = chooseEnvironment(newRun(PACK, "t", "A0-1"), PACK, 0);
    s = { ...s, level: 3, on: Array(4).fill(null), off: Array(6).fill(null), bench: Array(9).fill(null) };
    s.on[0] = { uid: 1, name: "Kafka", cost: 5, stars: 1, items: [] };
    s.on[1] = { uid: 2, name: "Welt", cost: 1, stars: 1, items: [] };
    s.on[2] = { uid: 3, name: "Pearl", cost: 1, stars: 1, items: [] };
    s.bench[0] = { uid: 4, name: "Robin", cost: 2, stars: 1, items: [] };
    expect(moveUnit(s, { zone: "bench", index: 0 }, { zone: "on", index: 3 }).note).toMatch(/Team is full/);
    expect(unitPower(s.on[0]!, "off", PACK)).toBe(0);
    expect(unitPower(s.on[0]!, "on", PACK)).toBeGreaterThan(0);
    const moved = moveUnit(s, { zone: "on", index: 0 }, { zone: "off", index: 0 });
    expect(teamPower(moved, PACK).idle).toEqual(["Kafka"]);
    expect(teamPower(s, PACK).bonds.map((b) => b.bond.name)).toEqual(["Stellaron Hunters"]);
  });

  it("pays base, streak and interest after a fight and loses HP by the plane table on a loss", () => {
    let s = chooseEnvironment(newRun(PACK, "g", "A0-1"), PACK, 1);
    s = { ...s, gold: 37, phase: "prep", plane: 1, node: 0, streak: 0 };
    const won = battle({ ...s, on: [{ uid: 1, name: "Kafka", cost: 5, stars: 3, items: [] }, null, null, null] }, PACK);
    expect(won.last!.won).toBe(true);
    expect(won.last!.gold).toEqual({ base: ASSUMED.baseIncome, streak: 0, interest: 3, drops: 0 });
    const lost = battle({ ...s, on: [{ uid: 1, name: "Welt", cost: 1, stars: 1, items: [] }, null, null, null], off: Array(6).fill(null) }, PACK);
    expect(lost.last!.won).toBe(false);
    expect(lost.last!.hpLost).toBeGreaterThanOrEqual(RULES.hpLoss[1][0]);
    expect(lost.hp).toBe(100 - lost.last!.hpLost);
    expect(lost.streak).toBe(0);
  });

  it("a full bench never blocks a Supply node: sell or skip", () => {
    let s = chooseEnvironment(newRun(PACK, "full", "A0-1"), PACK, 1);
    s = { ...s, phase: "supply", plane: 0, node: 4, bench: Array(9).fill(null).map((_, i) => ({ uid: 100 + i, name: i % 2 ? "Welt" : "Pearl", cost: 1, stars: 2 as const, items: [] })), offers: { supply: [{ name: "Robin", cost: 2, item: "Roller Skates" }] } };
    expect(pickSupply(s, PACK, 0).note).toMatch(/bench is full/);
    const sold = sell(s, { zone: "bench", index: 0 });
    expect(sold.bench[0]).toBeNull();
    const took = pickSupply(sold, PACK, 0);
    expect(took.node).toBe(5);
    expect(took.bag).toContain("Roller Skates");
    expect(skipSupply(s, PACK).node).toBe(5);
  });

  it("selling refunds and frees the slot; enemies get tougher with rank", () => {
    const s = chooseEnvironment(newRun(PACK, "s", "A0-1"), PACK, 1);
    const spot = { zone: "on" as const, index: s.on.findIndex(Boolean) };
    const sold = sell(s, spot);
    expect(sold.on[spot.index]).toBeNull();
    expect(sold.gold).toBeGreaterThan(s.gold);
    const at = (rank: string) => enemyPower({ ...s, rank, plane: 1, node: 0 }, PACK, "Combat");
    expect(at("A0-2")).toBeGreaterThan(at("A0-1"));
  });

  it("a sensible player usually clears A0 and a passive one doesn't; runs replay from their seed", () => {
    const smart = Array.from({ length: 40 }, (_, i) => autoplay(`s${i}`));
    const idle = Array.from({ length: 40 }, (_, i) => autoplay(`s${i}`, "A0-1", false));
    const rate = (xs: RunState[]) => xs.filter((x) => x.result === "cleared").length / xs.length;
    expect(rate(smart)).toBeGreaterThan(0.5);
    expect(rate(idle)).toBeLessThan(0.2);
    expect(smart.every((x) => x.phase === "over")).toBe(true);
    expect(autoplay("s3")).toEqual(smart[3]);
    const goals = objectives(smart[0], PACK);
    expect(goals).toHaveLength(6);
  });
});

describe("emblems, gems and Crystal Ores", () => {
  const RARE = `====Diamond & Treasure Gem====
{|class="wikitable"
! Equipment !! Tags !! Effect !! Synthesis
|-
| [[File:Equipment Red Gem.png|50px]]<br />Red Gem
| Diamond
| Used to synthesize Faction Emblems.<br /><br />''"quote"''
| N/A
|-
| [[File:Equipment Wealth Gem.png|50px]]<br />Wealth Gem
| Diamond
| Owning a Gem increases the team size limit by 1.
| {{nowrap|[[File:Equipment Red Gem.png|40px]] + [[File:Equipment Red Gem.png|40px]]}}<br />{{nowrap|[[File:Equipment Red Gem.png|40px]] + [[File:Equipment Blue Gem.png|40px]]}}
|}
====Emblem====
{|class="wikitable"
! Equipment !! Tags !! Stats !! Effect !! Users !! Synthesis
|-
| [[File:Equipment A Emblem.png|50px]]<br />Galactic Voyager Emblem
| Emblem
| {{Icon|Break Efficiency}} Break Efficiency 40%
| Grants the wearer the "Galactic Voyager" Bond.
| {{Card List|Fugue|type=x}}
| {{nowrap|[[File:Equipment Red Gem.png|40px]] + [[File:Equipment Aether Drill.png|40px]]}}
|-
| [[File:Equipment A Emblem.png|50px]]<br />Galactic Voyager Emblem
| Emblem
| x
| Grants wearer the "Galactic Voyager" Bond.
| x
| N/A
|-
| [[File:Equipment B Emblem.png|50px]]<br />Astropolis Merchant Guild Emblem
| Emblem
| {{Icon|DMG Amplification}} DMG Amplification 15%
| Grants wearer the "Astropolis Merchant Guild" Bond.
| {{Card List|Jade|type=x}}
| N/A
|}`;

  it("parses emblems (both wordings, no duplicates) and gem recipes", () => {
    const r = parseRareEquipment(RARE);
    expect(r.emblems.map((e) => [e.name, e.bond, e.recipe])).toEqual([["Galactic Voyager Emblem", "Galactic Voyager", ["Red Gem", "Aether Drill"]], ["Astropolis Merchant Guild Emblem", "Astropolis Merchant Guild", null]]);
    expect(r.gems.map((g) => [g.name, g.recipes.length])).toEqual([["Red Gem", 0], ["Wealth Gem", 2]]);
    expect(r.gems[0].effect).toBe("Used to synthesize Faction Emblems.");
  });

  it("Labor Dispatch Contract gives an emblem and a Bond character at each Boss node", () => {
    const s = chooseEnvironment(newRun(PACK, "ld", "A0-1"), PACK, 1);
    const [a, applied] = applyEffect(s, PACK, "Gain a random emblem. Each time you enter a Boss Node, receive a random character with the corresponding Bond.", createRng("e"));
    const emblem = a.bag.find((x) => x.endsWith("Emblem"))!;
    expect(emblem).toBeTruthy();
    expect(a.dispatchBond).toBe(emblem.replace(" Emblem", ""));
    expect(applied.join(" ")).toMatch(/Boss node/);
    const atBoss = enterNode({ ...a, plane: 0, node: 8, phase: "result", dispatchBond: "Stellaron Hunters" }, PACK);
    expect(atBoss.log.at(-1) ?? "").toBeDefined();
    expect(atBoss.log.some((l) => /Labor Dispatch: (Kafka|Welt|Pearl)/.test(l))).toBe(true);
  });

  it("an equipped Emblem joins its Bond; gems combine; a Wealth Gem raises team size", () => {
    let s = chooseEnvironment(newRun(PACK, "em", "A0-1"), PACK, 1);
    s = { ...s, on: [{ uid: 1, name: "Kafka", cost: 5, stars: 1, items: [] }, { uid: 2, name: "Robin", cost: 2, stars: 1, items: [] }, null, null], off: Array(6).fill(null), bench: Array(9).fill(null), bag: ["Stellaron Hunters Emblem"] };
    expect(teamPower(s, PACK).bonds.map((b) => b.bond.name)).toEqual([]);
    s = equip(s, PACK, 0, { zone: "on", index: 1 });
    expect(teamPower(s, PACK).bonds.map((b) => [b.bond.name, b.count])).toEqual([["Stellaron Hunters", 2]]);
    expect(combineResult(PACK, "Folding Knife", "Red Gem")).toBe("Stellaron Hunters Emblem");
    expect(combineBag({ ...s, bag: ["Red Gem", "Folding Knife"] }, PACK, 0, 1).bag).toEqual(["Stellaron Hunters Emblem"]);
    expect(combineBag({ ...s, bag: ["Red Gem", "Blue Gem"] }, PACK, 0, 1).bag).toEqual(["Wealth Gem"]);
    expect(combinations(PACK, "Folding Knife").map((c) => c.makes)).toEqual(["Firestorm Surge", "Stellaron Hunters Emblem"]);
    expect(teamSize({ ...s, bag: ["Wealth Gem"] })).toBe(teamSize(s) + 1);
  });

  it("opens ores: fixed-gold ores pay exactly, tier ores give something and count as opened", () => {
    let s = chooseEnvironment(newRun(PACK, "ore", "A0-1"), PACK, 1);
    s = { ...s, bag: [goldOreName(8), oreName("Blue")], gold: 0 };
    const a = openOre(s, PACK, 0);
    expect(a.gold).toBe(8);
    expect(a.bag).toEqual([oreName("Blue")]);
    expect(a.stats.goldEarned).toBe(s.stats.goldEarned + 8);
    const b = openOre(a, PACK, 0);
    expect(b.bag.filter(isOre)).toHaveLength(0);
    expect(b.stats.oresOpened).toBe(2);
    expect(b.note).toMatch(/^Opened Blue Crystal Ore: .+/);
    expect(describeItem(PACK, oreName("Prismatic")).details.length).toBeGreaterThan(0);
  });

  it("Reward nodes drop ores; Prismatic Ore and Gold Miner strategies work; Print More Money gives an ore", () => {
    let s = chooseEnvironment(newRun(PACK, "rw", "A0-1"), PACK, 1);
    const [st] = applyEffect(s, PACK, "Get an extra Prismatic Crystal Ore that is packed with valuable treasures at the next Reward Node.", createRng("p"));
    s = { ...st, phase: "prep", plane: 0, node: 0 };
    const r = battle(s, PACK);
    expect(r.last!.kind).toBe("Reward");
    expect(r.last!.ores!.length).toBe(ASSUMED.rewardOres + 1);
    expect(r.bag).toContain(oreName("Prismatic"));
    expect(r.pendingOres).toEqual([]);
    const [gm] = applyEffect(s, PACK, "When opening a crystal ore, there is a 50% chance to obtain a crystal ore of one tier lower, with a very small chance to obtain a Prismatic Crystal Ore. Immediately obtains a Gold Crystal Ore.", createRng("g"));
    expect(gm.oreEcho).toBe(true);
    expect(gm.bag).toContain(oreName("Gold"));
    const [pm] = applyEffect(s, PACK, "Gains a crystal ore worth 6/8/12 Gold Coin(s) at the start of Plane 1/2/3 respectively.", createRng("m"));
    const p2 = enterNode({ ...pm, plane: 1, node: 0 }, PACK);
    expect(p2.bag).toContain(goldOreName(8));
  });
});

describe("battle timeline", () => {
  const allies = [{ name: "Kafka", cost: 5, stars: 2 as const, power: 600, place: "on" as const }, { name: "Pearl", cost: 1, stars: 1 as const, power: 0, place: "on" as const }];
  const foes = Array.from({ length: 5 }, (_, i) => ({ name: `Grunt ${i}` }));
  it("a win ends with every enemy at 0 HP before the limit, and idle allies never act", () => {
    const tl = buildTimeline({ allies, enemies: foes, waves: 2, won: true, cleared: 1, ratio: 1.3, limit: 150, bossPhases: 2, reviveCost: 15 }, createRng("w"));
    const end = hpAt(tl, tl.end);
    expect(tl.units.filter((u) => u.side === "enemy").every((u) => end.get(u.id) === 0)).toBe(true);
    expect(tl.end).toBeLessThan(150);
    expect(tl.kills).toBe(5);
    expect(tl.events.some((e) => e.kind === "wave")).toBe(true);
    expect(tl.events.filter((e) => e.kind === "hit" && e.from === "a1")).toHaveLength(0);
    expect(tl.events.every((e, i) => i === 0 || tl.events[i - 1].t <= e.t)).toBe(true);
  });
  it("a loss runs out of Action Value with the same share cleared", () => {
    const tl = buildTimeline({ allies, enemies: foes, waves: 2, won: false, cleared: 0.4, ratio: 0.6, limit: 125, bossPhases: 2, reviveCost: 15 }, createRng("l"));
    const end = hpAt(tl, tl.end);
    const enemies = tl.units.filter((u) => u.side === "enemy");
    const max = enemies.reduce((n, u) => n + u.maxHp, 0), left = enemies.reduce((n, u) => n + (end.get(u.id) ?? 0), 0);
    expect(tl.end).toBe(125);
    expect(1 - left / max).toBeCloseTo(0.4, 1);
    expect(tl.events.at(-1)!.text).toBe("Out of Action Value");
  });
  it("a boss breaks through its phases on a win", () => {
    const tl = buildTimeline({ allies, enemies: [{ name: "Big Boss", boss: true }], waves: 1, won: true, cleared: 1, ratio: 1.2, limit: 150, bossPhases: 3, reviveCost: 35 }, createRng("b"));
    expect(tl.events.filter((e) => e.kind === "phase")).toHaveLength(2);
    expect(tl.events.some((e) => e.kind === "kill")).toBe(true);
  });
});

describe("character pages: stats, abilities, Eidolons, Light Cone, equipment", () => {
  const PAGE = `{{Currency Wars Character Infobox
|name           = Topaz & Numby
|cost           = 1
|field          = On/Off Field
|role1          = DPS
|role2          = Support
|bond1          = Astropolis Merchant Guild
|bond2          = Follow-Up ATK
|dmg            = 150%
|eidolon        = 10%
|ability1       = Debt Collection
|ability1_type1 = Ultimate
|ability1_type2 = Talent
|ability1_desc  = Ultimate enhances Numby.
|energy1        = 130
}}
==Character Details==
{{Currency Wars Character Details
|hp1 = 0%
|hp2 = 30%
|hp3 = 60%
|on_field1 = 100
|on_field2 = 160
|on_field3 = 220
|off_field1 = 100
|off_field2 = 160
|off_field3 = 220
|spd1 = 0%
|spd2 = 10%
|spd3 = 20%
|spd4 = 30%
|healing1 = 60
|healing2 = 60
|healing3 = 60
|shield1 = 60
|shield2 = 60
|shield3 = 60
}}
==Abilities==
===On Field===
{| class="wikitable"
! Ability !! Type !! Effect
|-
| {{Icon/Dark|A.png|50}}<br />Turn a Profit!
| Ultimate (Change)
| DMG multiplier increases by {{Color|highlight|150%/187%/270%||nobold=1}}. Hits {{Extra Effect|adjacent targets}} like {{Enemy|Big Boss}}.
|}
===Off Field===
{| class="wikitable"
! Ability !! Type !! Effect
|-
| {{Icon/Dark|B.png|50}}<br />Difficulty Paying?
| Skill (Change)
| Inflicts "Proof of Debt".
|}
==Off-Field Eidolon/Light Cone==
{{Currency Wars Character Eidolons
|eidolon1      = Future Market
|eidolon1_desc = Debtor state.
|eidolon2      = Bona Fide Acquisition
|eidolon2_desc = Numby's SPD increases by 20%.
}}
{{Currency Wars Character Light Cone
|name = Worrisome, Blissful
|desc = Increases Independent DMG Amplification by 12%/18%.
}}
==Recommended Equipment==
===On-Field===
{{Currency Wars Character Equipment
|equipment 1 = High-frequency Chainsaw
|equipment 2 = Firestorm Surge
}}
===Off-Field===
{{Currency Wars Character Equipment
|equipment 1 = Starfall Sniper
}}
==Gameplay Notes==
* Numby counts as a summon.
==Change History==`;
  it("reads every stat by star (with a 4th star only where listed) and the hidden multipliers", () => {
    const i = parseCharInfo(PAGE)!;
    expect(i.spd).toEqual([0, 10, 20, 30]);
    expect(i.healing).toEqual([60, 60, 60]);
    expect(i.shield).toEqual([60, 60, 60]);
    expect(i.onField).toEqual([100, 160, 220]);
    expect([i.baseDmgAmp, i.eidolonAmp]).toEqual([150, 10]);
    expect(i.summaries).toEqual([{ name: "Debt Collection", types: ["Ultimate", "Talent"], desc: "Ultimate enhances Numby.", energy: 130 }]);
  });
  it("reads abilities by group, Eidolons, Light Cone, recommended equipment and notes", () => {
    const i = parseCharInfo(PAGE)!;
    expect(i.abilities!.map((g) => [g.group, g.list.map((a) => [a.name, a.types])])).toEqual([["On Field", [["Turn a Profit!", ["Ultimate (Change)"]]]], ["Off Field", [["Difficulty Paying?", ["Skill (Change)"]]]]]);
    expect(i.abilities![0].list[0].effect).toBe("DMG multiplier increases by 150%/187%/270%. Hits adjacent targets like Big Boss.");
    expect(i.eidolons).toEqual([{ name: "Future Market", desc: "Debtor state." }, { name: "Bona Fide Acquisition", desc: "Numby's SPD increases by 20%." }]);
    expect(i.lightCone).toEqual({ name: "Worrisome, Blissful", desc: "Increases Independent DMG Amplification by 12%/18%." });
    expect(i.recommended).toEqual([{ group: "On-Field", items: ["High-frequency Chainsaw", "Firestorm Surge"] }, { group: "Off-Field", items: ["Starfall Sniper"] }]);
    expect(i.notes).toEqual(["Numby counts as a summon."]);
  });
});

describe("Bond Tracking and bond members", () => {
  it("matches characters by Bond, collapses variants, and counts worn Emblems", () => {
    expect(bondNames(PACK)).toEqual(["Stellaron Hunters", "Heal"]);
    expect(trackedMatches(PACK, "Kafka", ["Stellaron Hunters"])).toEqual(["Stellaron Hunters"]);
    expect(trackedMatches(PACK, "Robin", ["Stellaron Hunters"])).toEqual([]);
    expect(trackedMatches(PACK, "Robin", ["Stellaron Hunters"], ["Stellaron Hunters Emblem"])).toEqual(["Stellaron Hunters"]);
    expect(trackedMatches(PACK, "Kafka", [])).toEqual([]);
    expect(membersOf(PACK, "Heal")).toEqual(["Natasha", "Luocha", "Huohuo"]);
    const variants = { ...PACK, bonds: [{ name: "Moon: A", category: "Faction", members: ["Welt"], summary: "", levels: [] }, { name: "Moon: B", category: "Faction", members: ["Welt", "Pearl"], summary: "", levels: [] }] };
    expect(bondNames(variants)).toEqual(["Moon"]);
    expect(membersOf(variants, "Moon: A")).toEqual(["Welt", "Pearl"]);
  });
});

describe("turn order", () => {
  const allies = [{ name: "Kafka", cost: 5, stars: 2 as const, power: 600, place: "on" as const }, { name: "Welt", cost: 1, stars: 1 as const, power: 200, place: "on" as const }];
  const tl = buildTimeline({ allies, enemies: Array.from({ length: 4 }, (_, i) => ({ name: `Grunt ${i}` })), waves: 2, won: true, cleared: 1, ratio: 1.2, limit: 150, bossPhases: 2, reviveCost: 15 }, createRng("turns"));
  it("records allies' and enemies' turns in order", () => {
    expect(tl.turns!.length).toBeGreaterThan(4);
    expect(tl.turns!.every((x, i) => i === 0 || tl.turns![i - 1].t <= x.t)).toBe(true);
    expect(new Set(tl.turns!.map((x) => x.id.charAt(0)))).toEqual(new Set(["a", "e"]));
  });
  it("lists upcoming turns with Action Value until each, skipping the defeated", () => {
    const mid = tl.end / 2;
    const { next } = turnOrder(tl, mid, 6);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((n, i) => n.t > mid && n.av === Math.round(n.t - mid) && (i === 0 || next[i - 1].t <= n.t))).toBe(true);
    const hp = hpAt(tl, mid);
    expect(next.every((n) => (hp.get(n.id) ?? 1) > 0)).toBe(true);
    expect(turnOrder(tl, tl.end).next).toEqual([]);
  });
  it("rebuilds turns for fights saved before turns were recorded", () => {
    const old = { ...tl, turns: undefined };
    expect(turnsOf(old).length).toBeGreaterThan(0);
    expect(turnsOf(old).every((x) => tl.events.some((e) => e.kind === "hit" && e.from === x.id && e.t === x.t))).toBe(true);
  });
});

describe("character stats", () => {
  it("parses stat lines from items (advanced value, not privileged)", () => {
    expect(parseStatLine("SPD Amplification: 5%")).toEqual({ keys: ["spdAmp"], value: 5 });
    expect(parseStatLine("On-Field Strength 25%/50%")).toEqual({ keys: ["onField"], value: 25 });
    expect(parseStatLine("On-Field/Off-Field Strength 10%")).toEqual({ keys: ["onField", "offField"], value: 10 });
    expect(parseStatLine("Initial Energy: 15")).toEqual({ keys: ["initialEnergy"], value: 15 });
    expect(parseStatLine("Something odd")).toBeNull();
    expect(itemBoosts(PACK, ["Roller Skates", "Firestorm Surge"])).toEqual({ spdAmp: 15, onField: 25 });
  });
  it("matches the game's Stats Details layout and base values", () => {
    const rows = characterStats(PACK, "Welt", 1);
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(rows.map((r) => r.label).slice(0, 9)).toEqual(["On-Field Strength", "Off-Field Strength", "DMG Amplification", "DMG Mitigation", "Lucky Strike Rate", "Lucky Strike DMG", "SPD Amplification", "Healing Strength", "Shield Strength"]);
    expect([by.onField.total, by.offField.total, by.dmgAmp.total, by.mitigation.total, by.luckyRate.total, by.luckyDmg.total]).toEqual([100, 100, 0, 0, 5, 100]);
    expect(by.dmgAmp.parts.map((p) => p.label)).toEqual(["DMG Amplification", "Basic ATK DMG Amplification", "Skill DMG Amplification", "Ultimate DMG Amplification", "Follow-Up ATK DMG Amplification", "DoT Amplification", "Break DMG Amplification", "Elation DMG Amplification"]);
    const geared = Object.fromEntries(characterStats(PACK, "Welt", 2, ["Folding Knife", "Roller Skates"]).map((r) => [r.key, r]));
    expect(geared.onField.total).toBe(176); // 160 × 1.10
    expect(geared.spdAmp.total).toBe(5);
    expect(geared.hpAmp.total).toBe(30);
  });
});
