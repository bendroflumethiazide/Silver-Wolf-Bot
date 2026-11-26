import { describe, expect, it } from "vitest";
import { buildTimeline, hpAt, turnOrder, turnsOf } from "../currencywars/timeline";
import { bondNames, membersOf, trackedMatches } from "../currencywars/bonds";
import { characterStats, itemBoosts, parseStatLine } from "../currencywars/stats";
import { gearStatus, recommendedFor } from "../../components/currencywars/RecommendedGear";
import { craftableNow, fillUnknown, gearMark, gearNeeds } from "../currencywars/gear";
import { combinations, combineResult, describe as describeItem, goldOreName, isOre, oreName } from "../currencywars/items";
import { cardNames, cleanWikitext, parseCharInfo, parseRareEquipment, parseDifficulty, parseEnvironments, parseEquipment, parseOpponents, parseStrategies, wikiTableRows } from "../currencywars/parse";
import {
  ASSUMED, advance, applyEffect, enterNode, openOre, skipSupply, teamSize, battle, buy, buyXp, chooseEnvironment, combineBag, deployed, enemyPower, equip, merge, moveUnit, newRun,
  nodeKind, objectives, pickStrategy, pickSupply, recipe, refresh, RULES, sell, teamPower, toggleLock, unitPower, units, type RunState, pickTea, choosePlotArmor, settle, useSwap, nextInterlude,
} from "../currencywars/run";
import { chooseProtagonist, eligible, refreshPlot, refreshPrice, changeProtagonist, plotOf, plotOptions, PLOT_ARMOR_CONFIG } from "../currencywars/plotArmor";
import { buyTsr, expressPower, refreshTsr, tsrIncome, tsrOf, priceOf, tsrGood, TSR_GOODS } from "../currencywars/trailblazeStore";
import { COMPANIONS } from "../currencywars/voyageCompanions";
import { openBox, shiftEarlier } from "../currencywars/escapade";
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
  for (let guard = 0; guard < 600 && s.phase !== "over"; guard++) {
    if (s.phase === "environment") s = chooseEnvironment(s, PACK, 0);
    else if (s.phase === "teaBreak") s = pickTea(s, PACK, 0);
    else if (s.phase === "plotArmor") {
      const cur = s.plotArmor!.current!;
      s = cur.uid === undefined ? chooseProtagonist(s, PACK, eligible(s)[0].uid) : choosePlotArmor(s, PACK, 0);
    }
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
          if (!u || !PACK.info![u.name]) continue;
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

describe("recommended equipment", () => {
  const withRecs: CwPack = { ...PACK, info: { ...PACK.info, Kafka: { ...PACK.info!.Kafka, recommended: [{ group: "On-Field", items: ["Firestorm Surge", "Anti-Grav Boots"] }, { group: "Off-Field", items: ["Fixture Off"] }] } } };
  it("picks the group for the character's position, or every group when unplaced", () => {
    expect(recommendedFor(withRecs, "Kafka", "on")).toEqual(["Firestorm Surge", "Anti-Grav Boots"]);
    expect(recommendedFor(withRecs, "Kafka", "off")).toEqual(["Fixture Off"]);
    expect(recommendedFor(withRecs, "Kafka")).toEqual(["Firestorm Surge", "Anti-Grav Boots", "Fixture Off"]);
    expect(recommendedFor(withRecs, "Welt", "on")).toEqual([]);
  });
  it("says whether an item is held, can be made now, or one part is owned", () => {
    expect(gearStatus(PACK, "Firestorm Surge", ["Firestorm Surge"], [])).toBe("held");
    expect(gearStatus(PACK, "Firestorm Surge", [], ["Folding Knife", "Roller Skates"])).toBe("ready");
    expect(gearStatus(PACK, "Firestorm Surge", ["Folding Knife"], ["Roller Skates"])).toBe("ready");
    expect(gearStatus(PACK, "Anti-Grav Boots", [], ["Roller Skates"])).toBe("partial");
    expect(gearStatus(PACK, "Anti-Grav Boots", [], ["Roller Skates", "Roller Skates"])).toBe("ready");
    expect(gearStatus(PACK, "Firestorm Surge", [], [])).toBe("none");
  });
});

describe("Investment grants (items, characters, Peppy, later and repeated grants)", () => {
  const fresh = (): RunState => ({ ...chooseEnvironment(newRun(PACK, "grants", "A0-1"), PACK, 1), bag: [], bench: Array(9).fill(null) });
  const run = (text: string, source = "Test", s: RunState = fresh()) => applyEffect(s, PACK, text, createRng("g"), source);

  it("'X Emblem' strategies give the X Emblem the wiki lists as \"Unknown\", plus named characters", () => {
    const [s, applied] = run('Obtains 1 "Unknown," 1 "Kafka," and 1 "Firestorm Surge."', "Heal Emblem Set");
    expect(s.bag).toEqual(["Heal Emblem", "Firestorm Surge"]);
    expect(units(s).map((u) => u.name)).toContain("Kafka");
    expect(applied).toContain("Heal Emblem");
    expect(applied.join(" ")).not.toMatch(/Unknown/);
    const [s2, applied2] = run('Obtain 1 "Unknown."', "Intern Development Plan");
    expect(s2.bag).toEqual([]);
    expect(applied2.join(" ")).toMatch(/not simulated: an item the wiki hasn't named/);
    // Only the first "Unknown" of an Emblem Set is the Emblem; a later one is an unnamed item.
    const [s3, applied3] = run('Obtains 1 "Unknown," 1 "Kafka," and 1 "Unknown."', "Heal Emblem Set");
    expect(s3.bag).toEqual(["Heal Emblem"]);
    expect(applied3.join(" ")).toMatch(/not simulated: an item the wiki hasn't named/);
  });

  it("named items, weapon boxes, random equipment, gold and XP, all in one list", () => {
    expect(run('Obtains "Folding Knife" and "Roller Skates."')[0].bag).toEqual(["Folding Knife", "Roller Skates"]);
    const [s, applied] = run('Obtains 1 "Basic Weapon Box" and 8 Gold Coin(s).');
    expect(s.bag).toHaveLength(1);
    expect(s.gold).toBe(fresh().gold + 8);
    expect(applied).toContain("+8 gold");
    expect(run("Obtain 1 random basic equipment, 1 random 4-cost character(s), and 6 Gold Coin(s).")[0].gold).toBe(fresh().gold + 6);
    expect(run("Obtain 2 of each type of basic equipment.")[0].bag).toHaveLength(4);
    const [s3, a3] = run('Obtains 1 "Staff Projector."');
    expect([s3.bag, a3]).toEqual([["Staff Projector"], ["Staff Projector"]]);
  });

  it("Bond characters (Index Funds), random Bond members, and every N-cost character", () => {
    const [s] = run('Start with "Heal" character and basic equipment.');
    expect(units(s).some((u) => ["Natasha", "Luocha", "Huohuo"].includes(u.name))).toBe(true);
    expect(s.bag).toHaveLength(1);
    expect(units(run("Obtain 2 random Stellaron Hunters characters.")[0]).filter((u) => ["Kafka", "Welt", "Pearl"].includes(u.name)).length).toBeGreaterThanOrEqual(2);
    const twoCosts = (x: RunState) => units(x).filter((u) => u.cost === 2).map((u) => u.name);
    const base = fresh();
    expect(twoCosts(run("Obtain 1 of every 2-cost character.", "Test", base)[0]).length - twoCosts(base).length).toBe(2);
  });

  it("a full bench says so instead of losing the character silently", () => {
    const full = { ...fresh(), bench: Array(9).fill(null).map((_, i) => ({ uid: 500 + i, name: `X${i}`, cost: 1, stars: 1 as const, items: [] })) };
    const [s, applied] = run('Obtains 1 "Kafka."', "Test", full);
    expect(units(s).some((u) => u.name === "Kafka")).toBe(false);
    expect(applied.join(" ")).toMatch(/Kafka \(bench full\)/);
  });

  it("Peppy: a non-character squad member wearing Emblems that count for Bonds", () => {
    const [s, applied] = run('Obtains 1 "Peppy" with 3 permanently attached Emblems. Obtains 8 Gold Coin(s).');
    const peppy = units(s).find((u) => u.name === "Peppy")!;
    expect(peppy.npc).toBe(true);
    expect(peppy.items).toHaveLength(3);
    expect(applied[0]).toMatch(/^Peppy with /);
    expect(unitPower(peppy, "on", PACK)).toBe(0);
    // Deployed next to Kafka with a Stellaron Hunters Emblem, Peppy counts for the Bond and isn't IDLE.
    const deployed2 = { ...s, on: [{ uid: 1, name: "Kafka", cost: 5, stars: 1 as const, items: [] }, { ...peppy, items: ["Stellaron Hunters Emblem"] }, null, null], bench: Array(9).fill(null), off: Array(6).fill(null) };
    expect(teamPower(deployed2, PACK).bonds.map((b) => [b.bond.name, b.count])).toEqual([["Stellaron Hunters", 2]]);
    expect(teamPower(deployed2, PACK).idle).toEqual([]);
    expect(equip({ ...deployed2, phase: "prep", bag: ["Folding Knife"] }, PACK, 0, { zone: "on", index: 1 }).note).toMatch(/permanently attached/);
    // Three Peppys never merge.
    let three = s;
    for (let i = 0; i < 2; i++) three = run('Obtains 1 "Peppy" with 3 permanently attached Emblems.', "Test", three)[0];
    expect(units(three).filter((u) => u.name === "Peppy")).toHaveLength(3);
    const [withPeppi] = run("You got a Peppi that looks exactly like your Peppy!", "Peppy & Peppi", s);
    expect(units(withPeppi).find((u) => u.name === "Peppi")!.items).toEqual(peppy.items);
  });

  it("later grants fire on schedule: after N nodes, at a plane's start, after each combat", () => {
    let s = run('After entering 2 Node(s), obtains 1 "Basic Weapon Box."')[0];
    s = { ...s, phase: "result" };
    s = advance(s, PACK);
    expect(s.bag).toHaveLength(0);
    s = advance({ ...s, phase: "result" }, PACK);
    expect(s.bag).toHaveLength(1);
    expect(s.triggers).toEqual([]);

    let p = run("Gains 1 Privilege Weapon Box(es) at the start of the Second Plane.")[0];
    p = enterNode({ ...p, plane: 1, node: 0 }, PACK);
    expect(p.bag).toHaveLength(1);
    expect(p.log.some((l) => /Privilege Weapon Box/.test(l))).toBe(true);

    let c = run("After each combat ends, obtain 1 2-Cost character or 1-Cost character.")[0];
    c = { ...c, phase: "prep", plane: 0, node: 3, on: [{ uid: 1, name: "Kafka", cost: 5, stars: 3, items: [] }, null, null, null] };
    const before = units(c).length;
    const after = battle(c, PACK);
    expect(units(after).length).toBe(before + 1);
    expect(after.triggers).toHaveLength(1); // repeats
  });

  it("I Want It ALL: fewer Supply options, but every unselected one comes too", () => {
    let s = run("In this run, you have 2 fewer option(s) during the Supply phase. After making your selection in the next 1 Supply phase(s), you'll additionally receive all unselected characters and their carried equipment.")[0];
    expect([s.supplyFewer, s.supplyAll]).toEqual([2, 1]);
    s = enterNode({ ...s, plane: 0, node: 4 }, PACK);
    expect(s.phase).toBe("supply");
    expect(s.offers.supply).toHaveLength(3);
    const took = pickSupply(s, PACK, 0);
    expect(units(took).length).toBe(units(s).length + 3);
    expect(took.supplyAll).toBe(0);
  });
});

describe("Hiring Spree", () => {
  it("spends gold in 4s (up to 40) for 4-cost characters", () => {
    const s = { ...chooseEnvironment(newRun(PACK, "hire", "A0-1"), PACK, 1), gold: 13, bench: Array(9).fill(null) };
    const [a, applied] = applyEffect(s, PACK, 'Loses Gold Coins. For every 4 Gold Coins lost, gains a random 4-cost character, up to 40 Gold Coin(s). Gains 1 "Perfect Projector" and 10 Gold Coin(s).', createRng("h"), "Hiring Spree");
    expect(a.gold).toBe(13 - 12 + 10);
    expect(units(a).filter((u) => u.cost === 4).length - units(s).filter((u) => u.cost === 4).length).toBe(3);
    expect(applied.join(" ")).toMatch(/−12 gold → 3 random 4-cost characters/);
    expect(applied.join(" ")).toMatch(/Perfect Projector/);
    expect(applied.join(" ")).not.toMatch(/not simulated/);
  });
});

describe("Equipment Tracking", () => {
  const pack: CwPack = { ...PACK, info: { ...PACK.info, Kafka: { ...PACK.info!.Kafka, recommended: [{ group: "On-Field", items: ["Firestorm Surge"] }, { group: "Off-Field", items: ["Anti-Grav Boots"] }] } } };
  it("marks recommended items and their components as needed (thumbs-up)", () => {
    const needs = gearNeeds(pack, [{ name: "Kafka", place: "on", held: [] }]);
    expect([...needs.keys()].sort()).toEqual(["Firestorm Surge", "Folding Knife", "Roller Skates"]);
    expect(gearMark(needs, "Folding Knife", []).wanted).toBe(true);
    expect(gearMark(needs, "Folding Knife", []).ready).toBe(false);
    expect(gearMark(needs, "Folding Knife", []).notes).toEqual(["Kafka: Firestorm Surge (with Roller Skates)"]);
    expect(gearMark(needs, "Lucky Star", []).wanted).toBe(false);
  });
  it("adds the blue outline when the other component is already in hand", () => {
    const needs = gearNeeds(pack, [{ name: "Kafka", place: "on", held: [] }]);
    const mark = gearMark(needs, "Folding Knife", ["Roller Skates"]);
    expect([mark.wanted, mark.ready]).toEqual([true, true]);
    expect(mark.notes[0]).toMatch(/which you have/);
  });
  it("skips what the character already holds, and uses every group when the character isn't placed", () => {
    expect(gearNeeds(pack, [{ name: "Kafka", place: "on", held: ["Firestorm Surge"] }]).size).toBe(0);
    expect([...gearNeeds(pack, [{ name: "Kafka", held: [] }]).keys()]).toContain("Anti-Grav Boots");
  });
  it("fills in \"Unknown\" in plan text: the X Emblem first, an unnamed item after", () => {
    expect(fillUnknown("Elation Emblem", 'Obtains 1 "Unknown" and 1 "Sparxie."')).toBe('Obtains 1 "Elation Emblem" and 1 "Sparxie."');
    expect(fillUnknown("DoT Emblem Set", 'Obtains 1 "Unknown," 1 "Guinaifen," and 1 "Unknown."')).toBe('Obtains 1 "DoT Emblem," 1 "Guinaifen," and 1 "an item the wiki hasn\'t named."');
    expect(fillUnknown("Intern Development Plan", 'Obtain 1 "Unknown{{verify}}."')).toBe('Obtain 1 "an item the wiki hasn\'t named."');
  });
});

describe("craftable now (blue outline)", () => {
  it("is any recipe whose other part you already have, recommended or not", () => {
    expect(craftableNow(PACK, "Folding Knife", ["Roller Skates"])).toEqual([{ partner: "Roller Skates", makes: "Firestorm Surge" }]);
    expect(craftableNow(PACK, "Folding Knife", ["Red Gem"])).toEqual([{ partner: "Red Gem", makes: "Stellaron Hunters Emblem" }]);
    expect(craftableNow(PACK, "Folding Knife", ["Lucky Star"])).toEqual([]);
    expect(craftableNow(PACK, "Firestorm Surge", ["Roller Skates"])).toEqual([]);
  });
});

describe("store refresh", () => {
  const shopKey = (s: RunState) => s.shop.map((c) => c?.name ?? "-").join(",") + `@${s.tick}`;
  it("refreshes at the start of every node: after a fight, a Supply pick and a skip", () => {
    let s = chooseEnvironment(newRun(PACK, "store", "A0-1"), PACK, 1);
    expect(s.shopNote).toBe("refreshed");
    s = { ...s, on: [{ uid: 1, name: "Kafka", cost: 5, stars: 3, items: [] }, null, null, null] };
    const fought = advance(battle(s, PACK), PACK);
    expect([fought.node, fought.shopNote]).toEqual([1, "refreshed"]);
    expect(fought.log.join(" ")).not.toMatch(/kept by Lock/);
    const atSupply = enterNode({ ...fought, plane: 0, node: 4 }, PACK);
    expect(atSupply.phase).toBe("supply");
    expect(pickSupply(atSupply, PACK, 0).shopNote).toBe("refreshed");
    expect(skipSupply(atSupply, PACK).shopNote).toBe("refreshed");
    expect(shopKey(skipSupply(atSupply, PACK))).not.toBe(shopKey(atSupply));
  });
  it("Lock keeps the stock through the next node only, then releases", () => {
    let s = chooseEnvironment(newRun(PACK, "lock", "A0-1"), PACK, 1);
    const stock = s.shop.map((c) => c?.name);
    s = toggleLock({ ...s, phase: "result" });
    s = advance(s, PACK);
    expect(s.shop.map((c) => c?.name)).toEqual(stock);
    expect([s.locked, s.shopNote]).toEqual([false, "kept"]);
    expect(s.log.at(-1)).toMatch(/kept by Lock/);
    s = advance({ ...s, phase: "result" }, PACK);
    expect(s.shopNote).toBe("refreshed");
  });
});

// --------------------------------------------------------------------------------------------- 4.7: Trailblaze Store, Escapade, Plot Armor

const TSR_MEMBERS: [string, number][] = [["March 7th (The Hunt)", 1], ["Sunday", 2], ["Trailblazer (Elation)", 3], ["Himeko • Nova", 4], ["Dan Heng • Imbibitor Lunae", 5], ["King Pom-Pom", 5]];
const PHANTASMOON: [string, number][] = [["Sparxie", 2], ["Evanescia", 3], ["Silver Wolf LV.999", 4], ["Ashveil", 4], ["Mortenax Blade", 5]];
const P47: CwPack = {
  ...PACK,
  characters: [...PACK.characters, ...[...TSR_MEMBERS, ...PHANTASMOON].map(([name, cost]) => ({ name, cost }))],
  bonds: [
    ...PACK.bonds,
    { name: "Trailblaze Silver Rail", category: "Faction", members: ["Welt", ...TSR_MEMBERS.map(([n]) => n)], summary: "", levels: [
      { count: 2, effect: '20 "Trailblaze Power." Astral Express, all aboard!', tier: "bronze" }, { count: 4, effect: '45 "Trailblaze Power." Goods become better.', tier: "silver" },
      { count: 6, effect: '75 "Trailblaze Power." Goods become better, and Bond-exclusive Components appear.', tier: "gold" }, { count: 8, effect: '125 "Trailblaze Power."', tier: "gold" }, { count: 10, effect: '225 "Trailblaze Power"! Express evolution!', tier: "plat" }] },
    { name: "Phantasmoon Games: Roll-Call", category: "Faction", members: ["Pearl", "Sunday", ...PHANTASMOON.map(([n]) => n)], summary: "", levels: [
      { count: 3, effect: "The strongest character performs Roll-Call.", tier: "bronze" }, { count: 5, effect: 'Immediately gains 1 "Imagenae: Plot Armor."', tier: "silver" }, { count: 7, effect: "All characters with Plot Armor perform Roll-Call.", tier: "gold" }] },
    { name: "Follow-Up ATK", category: "School", members: ["Feixiao", "March 7th (The Hunt)"], summary: "", levels: [{ count: 3, effect: "x", tier: "bronze" }] },
    { name: "Joint Follow-Up ATK", category: "Plot Armor", members: [], summary: 'Only takes effect on "Follow-Up ATK" characters:', levels: [{ count: 1, effect: "After taking action, there is a 15% chance of advancing action by 100%.", tier: "bronze" }, { count: 2, effect: "KO x2", tier: "gold" }] },
    { name: "Deliverer", category: "Plot Armor", members: [], summary: 'Become "Deliverer."', levels: [{ count: 1, effect: "Gains all non-independent Bond effects activated by on-field characters.", tier: "gold" }] },
  ],
  info: { ...PACK.info, ...Object.fromEntries([...TSR_MEMBERS, ...PHANTASMOON].map(([name, cost]) => [name, { cost, field: "both" as const, roles: [], bonds: [], onField: STR[cost], offField: STR[cost], hp: [0, 30, 60] }])) },
};
const u47 = (uid: number, name: string, stars: 1 | 2 | 3 = 1, items: string[] = []) => ({ uid, name, cost: P47.characters.find((c) => c.name === name)!.cost, stars, items });
/** A run in preparation at a node, with `on` deployed (On-Field first, then Off-Field). */
function at47(names: string[], extra: Partial<RunState> = {}, opts: { companion?: string; variant?: string } = { companion: "Sundove", variant: "sd-gift" }): RunState {
  const s = chooseEnvironment(newRun(P47, "t47", "A0-1", opts), P47, 0);
  const all = names.map((n, i) => u47(500 + i, n));
  return { ...s, phase: "prep", level: 10, gold: 50, on: [...all.slice(0, 4), ...Array(4).fill(null)].slice(0, 4), off: [...all.slice(4, 10), ...Array(6).fill(null)].slice(0, 6), bench: Array(9).fill(null), bag: [], ...extra };
}

describe("4.7 Trailblaze Silver Rail: Trailblaze Power and the Trailblaze Store", () => {
  it("TP per combat phase by Bond level comes from the Bond text (20/45/75/125/225)", () => {
    expect([1, 2, 3, 4, 6, 8, 10].map((l) => tsrIncome(P47, l))).toEqual([0, 20, 20, 45, 75, 125, 225]);
  });

  it("opens at level 2, pays TP after each fight, and goods unlock as the Bond grows", () => {
    const s0 = at47(["Welt", "March 7th (The Hunt)"]);
    const s = settle(s0, P47);
    expect(s.tsr!.best).toBe(2);
    expect(s.tsr!.stock).toHaveLength(6);
    expect(s.note).toMatch(/Trailblaze Store open/);
    expect(settle(s, P47)).toBe(s); // nothing new: same object, no duplicate notices
    expect(refreshTsr({ ...s, gold: 0 }, P47, 2).note).toMatch(/Refresh All costs 1 gold/);
    const rolled = refreshTsr(s, P47, 2);
    expect(rolled.gold).toBe(s.gold - 1);
    expect(new Set(rolled.tsr!.stock).size).toBe(rolled.tsr!.stock.length); // no repeats while goods last
    const fought = battle({ ...s, plane: 0, node: 3 }, P47);
    expect(fought.tsr!.tp).toBe(20);
    expect(fought.tsr!.stock.every((id) => tsrGood(id)!.minLevel <= 2)).toBe(true);
    const four = battle(settle(at47(["Welt", "March 7th (The Hunt)", "Sunday", "Trailblazer (Elation)"], { plane: 0, node: 3 }), P47), P47);
    expect(four.tsr!.tp).toBe(45);
    expect(four.log.join(" ")).toMatch(/goods became better/);
  });

  it("buys characters, stats and Express parts with TP; prices rise by 40 / 60; King Pom-Pom after 500 TP spent", () => {
    let s = settle(at47(["Welt", "March 7th (The Hunt)", "Sunday", "Trailblazer (Elation)", "Himeko • Nova", "Dan Heng • Imbibitor Lunae"]), P47);
    s = { ...s, tsr: { ...tsrOf(s), tp: 1000 } };
    const lvl = 6;
    const bought = buyTsr(s, P47, "char-Sunday", lvl);
    expect(bought.tsr!.tp).toBe(965);
    expect(units(bought).filter((u) => u.name === "Sunday")).toHaveLength(2);
    expect(buyTsr(s, P47, "on-4", lvl).note).toMatch(/Bond level 8/);
    const on1 = buyTsr(s, P47, "on-1", lvl);
    expect(teamPower(on1, P47).power).toBeGreaterThan(teamPower(s, P47).power);
    let e = buyTsr(s, P47, "fuel", lvl);
    expect(e.tsr!.consumed).toBe(40);
    expect(priceOf(e.tsr!, tsrGood("rail")!)).toBe(80);
    e = buyTsr(e, P47, "rail", lvl);
    expect(e.tsr!.consumed).toBe(120);
    const c = buyTsr(s, P47, "comp-Nameless Proof", lvl);
    expect(c.bag).toContain("Nameless Proof");
    expect(priceOf(c.tsr!, tsrGood("comp-Navigator's Banner")!)).toBe(160);
    expect(buyTsr(s, P47, "char-King Pom-Pom", lvl).note).toMatch(/Consume 500 TP/);
    const spent = { ...s, tsr: { ...tsrOf(s), consumed: 470 } };
    const unlocked = buyTsr(spent, P47, "staff", lvl);
    expect(unlocked.log.join(" ")).toMatch(/King Pom-Pom unlocked/);
    expect(buyTsr(unlocked, P47, "char-King Pom-Pom", lvl).note ?? "").not.toMatch(/Consume/);
    expect(buyTsr({ ...s, tsr: { ...tsrOf(s), tp: 5 } }, P47, "char-Sunday", lvl).note).toMatch(/costs 35/);
  });

  it("the Express fights with you: warp → Forward II → III, Fuel makes TP from crashes", () => {
    let s = settle(at47(["Welt", "March 7th (The Hunt)", "Sunday", "Trailblazer (Elation)", "Himeko • Nova", "Dan Heng • Imbibitor Lunae"], { plane: 0, node: 3 }), P47);
    s = { ...s, tsr: { ...tsrOf(s), tp: 500 } };
    expect(buyTsr(s, P47, "forward2", 6).note).toMatch(/Needs the Express/);
    const base = teamPower(s, P47).power;
    s = buyTsr(s, P47, "warp", 6);
    expect(expressPower(s, 150).collisions).toBe(1);
    expect(teamPower(s, P47).power).toBeGreaterThan(base);
    s = buyTsr(buyTsr(buyTsr(s, P47, "forward2", 6), P47, "forward3", 6), P47, "fuel", 6);
    const ex = expressPower(s, 150);
    expect(ex.collisions).toBe(4);
    const fought = battle(s, P47);
    expect(fought.last!.express!.collisions).toBe(4);
    expect(fought.last!.timeline!.units.some((x) => x.name === "Astral Express")).toBe(true);
    expect(fought.tsr!.tp - s.tsr!.tp).toBe(75 + 5 * 4);
  });

  it("Bond level 10 grants 500 TP and Forward IV exactly once", () => {
    const s = at47(["Welt"], { tsr: { ...tsrOf(at47([])), best: 8, stock: ["on-1"] } });
    const tsrSync = (x: RunState) => settle({ ...x, on: x.on, off: x.off }, P47);
    // Ten "members" via Emblems isn't in the fixture, so drive syncTsrLevel through settle's count with extra copies of the Bond.
    const ten: CwPack = { ...P47, bonds: P47.bonds.map((b) => (b.name === "Trailblaze Silver Rail" ? { ...b, members: [...b.members, "Pearl", "Natasha", "Robin"] } : b)) };
    const board = { ...s, on: [u47(1, "Welt"), u47(2, "March 7th (The Hunt)"), u47(3, "Sunday"), u47(4, "Trailblazer (Elation)")], off: [u47(5, "Himeko • Nova"), u47(6, "Dan Heng • Imbibitor Lunae"), u47(7, "King Pom-Pom"), u47(8, "Pearl"), u47(9, "Natasha"), u47(10, "Robin")] };
    const once = settle(board, ten);
    expect(once.tsr!.tp).toBe(500);
    expect(once.tsr!.express).toBe(4);
    const twice = settle(JSON.parse(JSON.stringify(once)), ten);
    expect(twice.tsr!.tp).toBe(500);
    expect(tsrSync).toBeTruthy();
  });

  it("Projectors copy characters within their limits; Overload Energy Module makes TP each node", () => {
    const s = at47(["Sunday", "Feixiao"], { bag: ["Trailblaze: Staff Projector", "Trailblaze: Staff Projector"] });
    const copied = equip(s, P47, 0, { zone: "on", index: 0 });
    expect(units(copied).filter((u) => u.name === "Sunday")).toHaveLength(2);
    expect(copied.bag).toEqual(["Trailblaze: Staff Projector"]);
    expect(equip(s, P47, 0, { zone: "on", index: 1 }).note).toMatch(/Trailblaze Silver Rail/);
    const kpp = at47(["King Pom-Pom"], { bag: ["Overload Energy Module", "Navigator's Banner"] });
    expect(equip(kpp, P47, 0, { zone: "on", index: 0 }).on[0]!.items).toEqual(["Overload Energy Module"]);
    expect(equip(at47(["Kafka"], { bag: ["Overload Energy Module"] }), P47, 0, { zone: "on", index: 0 }).note).toMatch(/only be equipped by King Pom-Pom/);
    const worn = { ...kpp, on: [{ ...kpp.on[0]!, stars: 2 as const, items: ["Overload Energy Module"] }, null, null, null], plane: 0, node: 3 };
    expect(tsrOf(enterNode(worn, P47)).tp).toBe(20);
  });
});

describe("4.7 Escapade: Voyage Companions and Backstage Tea Break", () => {
  it("every run has one of the 11 companions with one of its effects, replayable from the seed", () => {
    expect(COMPANIONS).toHaveLength(11);
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const s = newRun(P47, `c${i}`, "A0-1");
      const c = COMPANIONS.find((x) => x.name === s.escapade!.companion)!;
      expect(c.variants.some((v) => v.id === s.escapade!.variant)).toBe(true);
      expect(s.escapade!.revealed).toBe(false);
      seen.add(c.name);
    }
    expect(seen.size).toBeGreaterThan(8);
    expect(newRun(P47, "c1", "A0-1").escapade).toEqual(newRun(P47, "c1", "A0-1").escapade);
  });

  it("Pearliefin: the Reward Node before the First Plane boss becomes a Tea Break with real rewards, once", () => {
    const s = at47(["Kafka"], { plane: 0, node: 7 }, { companion: "Pearliefin", variant: "pf-gifts" });
    const tea = enterNode(s, P47);
    expect(tea.phase).toBe("teaBreak");
    expect(tea.offers.teaBreak!.options[0].name).toBe("Draw a Few More Sketches.");
    const after = pickTea(tea, P47, 0);
    expect(after.bag.filter((x) => x === "Intern Projector")).toHaveLength(3);
    expect(after.node).toBe(8);
    expect(after.escapade!.done).toEqual([0]);
    expect(after.escapade!.history.map((h) => h.text).join(" ")).toMatch(/Backstage Tea Break/);
    expect(pickTea(after, P47, 0)).toBe(after);
    // Reloaded mid-run: the same node never offers it again.
    expect(enterNode(JSON.parse(JSON.stringify({ ...after, node: 7 })), P47).phase).not.toBe("teaBreak");
  });

  it("Woof Woof Dan turns the first loss of each plane into a Perfect Clear", () => {
    const s = at47(["Welt"], { plane: 1, node: 0, gold: 0 }, { companion: "Woof Woof Dan", variant: "wd-each" });
    const first = battle(s, P47);
    expect(first.last!.won).toBe(true);
    expect(first.last!.saved).toBe(true);
    expect(first.hp).toBe(100);
    const second = battle({ ...first, phase: "prep" }, P47);
    expect(second.last!.saved).toBeFalsy();
  });

  it("Evanefox, Mummicat and Sundove change Supplies, equipment and the node order", () => {
    const sup = enterNode(at47(["Kafka"], { plane: 0, node: 4 }, { companion: "Evanefox", variant: "ef-2star" }), P47);
    expect(sup.offers.supply!.every((o) => o.stars === 2)).toBe(true);
    expect(pickSupply(sup, P47, 0).bench.find(Boolean)!.stars).toBe(2);
    const box = enterNode(at47(["Kafka"], { plane: 0, node: 4 }, { companion: "Mummicat", variant: "mc-box" }), P47);
    const took = pickSupply(box, P47, 0);
    expect(took.bag).toContain("Basic Weapon Box");
    const opened = openBox(took, P47, took.bag.indexOf("Basic Weapon Box"), "Folding Knife");
    expect(opened.bag).toContain("Folding Knife");
    const early = newRun(P47, "sd", "A0-1", { companion: "Sundove", variant: "sd-strategy" });
    expect(nodeKind({ ...early, plane: 0, node: 1 })).toBe("Strategy");
    expect(shiftEarlier(["Combat", "Strategy", "Supply"], "Supply")).toEqual(["Combat", "Supply", "Strategy"]);
  });

  it("March Bunny adds XP in Planes 2–3; Ashwolf's assignment pays once; Bubble Wolf adds a Strategy pick", () => {
    const mb = at47(["Kafka"], { plane: 1, xp: 0, level: 5 }, { companion: "March Bunny", variant: "mb-xp" });
    expect(buyXp(mb).xp).toBe(ASSUMED.xpPerBuy + 1);
    const aw = enterNode(at47(["Kafka"], { plane: 1, node: 0, gold: 10 }, { companion: "Ashwolf", variant: "aw-plane" }), P47);
    expect(aw.escapade!.assignments).toHaveLength(1);
    const rich = settle({ ...aw, phase: "prep", gold: 120, streak: 4, level: 10, hp: 100, stats: { ...aw.stats, refreshes: 99, losses: 9 }, on: [u47(9, "Kafka", 3), u47(10, "Jade", 3), null, null] }, P47);
    const done = rich.escapade!.completed ?? [];
    if (aw.escapade!.assignments![0].id.match(/healthy|extreme|encounter/)) expect(done).toHaveLength(0);
    else { expect(done).toHaveLength(1); expect(rich.bag).toContain("Gold Crystal Ore"); expect(settle(rich, P47)).toBe(rich); }
    const bw = { ...at47(["Kafka"], { plane: 1, node: 0 }, { companion: "Bubble Wolf", variant: "bw-strategy" }) };
    const flagged = { ...bw, escapade: { ...bw.escapade!, extraStrategy: true } };
    const entered = enterNode(flagged, P47);
    expect(entered.phase).toBe("strategy");
    const picked = pickStrategy(entered, P47, 0);
    expect(picked.phase).toBe(nodeKind(picked) === "Combat" ? "prep" : picked.phase);
    expect(picked.escapade!.extraStrategy).toBe(false);
  });
});

describe("4.7 Plot Armor", () => {
  const toBoss = (s: RunState, plane = 0) => enterNode({ ...s, plane, node: RULES.planes[plane].length - 1 }, P47);
  it("two protagonists, chosen from deployed characters before the Plane 1 and Plane 2 bosses", () => {
    const s = toBoss(at47(["Kafka", "Welt", "Feixiao"]));
    expect(s.phase).toBe("plotArmor");
    expect(eligible(s).map((u) => u.name)).toEqual(["Kafka", "Welt", "Feixiao"]);
    const picked = chooseProtagonist(s, P47, eligible(s)[0].uid);
    expect(picked.plotArmor!.current!.options).toHaveLength(PLOT_ARMOR_CONFIG.options);
    const lead = plotOptions(P47).findIndex((o) => o.id === "lead");
    const chosen = choosePlotArmor({ ...picked, plotArmor: { ...picked.plotArmor!, current: { ...picked.plotArmor!.current!, options: ["lead", "pay"] } } }, P47, 0);
    expect(lead).toBeGreaterThanOrEqual(0);
    expect(chosen.phase).toBe("prep");
    expect(chosen.plotArmor!.holders).toEqual([expect.objectContaining({ name: "Kafka", option: "lead", source: "protagonist", plane: 0 })]);
    expect(teamPower(chosen, P47).power).toBeGreaterThan(teamPower(s, P47).power);
    // Reloading or re-entering the node doesn't ask again; the Second Plane boss asks for Protagonist 2; the Third doesn't.
    expect(toBoss(JSON.parse(JSON.stringify(chosen))).phase).toBe("prep");
    const second = toBoss(chosen, 1);
    expect(second.phase).toBe("plotArmor");
    expect(eligible(second).map((u) => u.name)).toEqual(["Welt", "Feixiao"]);
    const p2 = choosePlotArmor(chooseProtagonist(second, P47, eligible(second)[0].uid), P47, 0);
    expect(p2.plotArmor!.holders).toHaveLength(2);
    expect(toBoss(p2, 2).phase).toBe("prep");
  });

  it("refreshes: 1 gold for the first paid ones, then rising; free ones (by source) first; history kept", () => {
    let s = chooseProtagonist(toBoss(at47(["Kafka", "Welt"], { gold: 20 })), P47, 500);
    const costs: number[] = [];
    for (let i = 0; i < 4; i++) { costs.push(refreshPrice(plotOf(s))); s = refreshPlot(s, P47); }
    expect(costs).toEqual([1, 1, 2, 3]);
    expect(s.gold).toBe(20 - 7);
    expect(plotOf(s).history.filter((h) => h.kind === "refresh")).toHaveLength(4);
    expect(refreshPlot({ ...s, gold: 0 }, P47).note).toMatch(/costs 4 gold/);
    const [chain] = applyEffect(s, P47, 'When refreshing the "Plot Armor" effect, gains 1 free Store refresh(es). Gains 3 free Plot Armor refresh(es).', createRng("x"), "Refresh Chain");
    const r = refreshPlot(chain, P47);
    expect(r.gold).toBe(chain.gold);
    expect(r.freeRefreshes).toBe(chain.freeRefreshes + 1);
    expect(plotOf(r).free).toEqual([{ source: "Refresh Chain", left: 2 }]);
  });

  it("Plot Armor Procurement fixes the price at 1 and gives 6 free; Early Entrance moves selection to 1-6 and 2-4", () => {
    const [p, applied] = applyEffect(at47(["Kafka"]), P47, "The Plot Armor refresh cost for this run is fixed at 1 Gold Coin(s), and you'll receive 6 free Plot Armor refreshes.", createRng("y"), "Plot Armor Procurement");
    expect(applied.join(" ")).not.toMatch(/not simulated/);
    expect(plotOf(p)).toMatchObject({ fixedCost: 1, free: [{ source: "Plot Armor Procurement", left: 6 }] });
    expect(refreshPrice({ ...plotOf(p), paid: 9 })).toBe(1);
    const [e] = applyEffect(at47(["Kafka"]), P47, "The Plot Armor selection stage has been moved up to Nodes 1-6 and 2-4.", createRng("z"), "Early Entrance");
    expect(enterNode({ ...e, plane: 0, node: 5 }, P47).phase).toBe("plotArmor");
    expect(enterNode({ ...e, plane: 1, node: 3 }, P47).phase).toBe("plotArmor");
    expect(enterNode({ ...e, plane: 0, node: 8 }, P47).phase).not.toBe("plotArmor");
  });

  it("Plot Armor Bonds join the protagonist to the Bond; New Cast changes, It's A Wrap swaps", () => {
    const s = chooseProtagonist(toBoss(at47(["Feixiao", "March 7th (The Hunt)", "Kafka"])), P47, 500);
    const withBond = choosePlotArmor({ ...s, plotArmor: { ...s.plotArmor!, current: { ...s.plotArmor!.current!, options: ["bond:Joint Follow-Up ATK", "pay"] } } }, P47, 0);
    expect(teamPower(withBond, P47).bonds.find((b) => b.bond.name === "Joint Follow-Up ATK")?.tier).toBe("bronze");
    expect(teamPower(withBond, P47).power).toBeGreaterThan(teamPower({ ...withBond, plotArmor: { ...withBond.plotArmor!, holders: [] } }, P47).power);
    const [nc] = applyEffect(withBond, P47, "Obtains 1 chance(s) to change the Protagonist, and get 10 free Plot Armor refresh(es).", createRng("n"), "New Cast Performance");
    expect(plotOf(nc)).toMatchObject({ changes: 1, free: [{ source: "New Cast Performance", left: 10 }] });
    const moved = changeProtagonist(nc, 500, 502);
    expect(plotOf(moved).holders[0].name).toBe("Kafka");
    expect(plotOf(moved).changes).toBe(0);
    const [wrap] = applyEffect(withBond, P47, "All protagonists' Plot Armor is disabled. Gain an equal number of chances to swap them out.", createRng("w"), "It's A Wrap");
    expect(plotOf(wrap).holders[0].disabled).toBe(true);
    expect(plotOf(wrap).swaps).toBe(1);
    const swapping = useSwap(wrap, P47);
    expect(swapping.phase).toBe("plotArmor");
    const swapped = choosePlotArmor(chooseProtagonist(swapping, P47, 501), P47, 1);
    expect(swapped.phase).toBe("prep");
    expect(plotOf(swapped).holders.filter((h) => !h.disabled)).toEqual([expect.objectContaining({ source: "swap", name: "March 7th (The Hunt)" })]);
  });

  it("Roll-Call: 5 members give one Imagenae: Plot Armor (not a protagonist); 7 boost Plot Armor holders", () => {
    const five = at47(["Pearl", "Sparxie", "Evanescia", "Silver Wolf LV.999", "Ashveil"], { variants: { "Phantasmoon Games": "Phantasmoon Games: Roll-Call" } });
    const got = settle(five, P47);
    expect(got.bag).toEqual(["Phantasmoon: Plot Armor"]);
    expect(settle(JSON.parse(JSON.stringify({ ...got, bag: [] })), P47).bag).toEqual([]); // never twice
    const using = equip(got, P47, 0, { zone: "on", index: 0 });
    expect(using.phase).toBe("plotArmor");
    expect(using.plotArmor!.current).toMatchObject({ stage: "imagenae", uid: 500 });
    const done = choosePlotArmor(using, P47, 0);
    expect(done.phase).toBe("prep");
    expect(plotOf(done).holders[0]).toMatchObject({ source: "imagenae", name: "Pearl" });
    expect(plotOf(done).done).toEqual([]); // protagonist selections untouched
    const seven = { ...done, off: [...done.off.slice(0, 1), u47(600, "Mortenax Blade"), u47(601, "Sunday"), ...done.off.slice(3)] };
    const pb = (x: RunState) => teamPower(x, P47).per.find((p) => p.uid === 500)!.plot;
    expect(teamPower(seven, P47).rollCall7).toBe(true);
    expect(pb(seven) - pb(done)).toBeCloseTo(1, 5);
  });

  it("Bubble Wolf's System, Activate! stops Plot Armor adding enemy difficulty", () => {
    const s = chooseProtagonist(toBoss(at47(["Kafka"])), P47, 500);
    const pick = (x: RunState) => choosePlotArmor({ ...x, plotArmor: { ...x.plotArmor!, current: { ...x.plotArmor!.current!, options: ["star", "pay"] } } }, P47, 0);
    expect(pick(s).extraDifficulty - s.extraDifficulty).toBe(4);
    const boosted = { ...s, escapade: { ...s.escapade!, powerfulPlot: true } };
    expect(pick(boosted).extraDifficulty).toBe(s.extraDifficulty);
  });

  it("a whole run with all three systems survives save/load at every step and replays the same", () => {
    const play = (roundTrip: boolean) => {
      let s = newRun(P47, "full47", "A0-1", { companion: "Pearliefin", variant: "pf-gifts" });
      for (let g = 0; g < 600 && s.phase !== "over"; g++) {
        if (roundTrip) s = JSON.parse(JSON.stringify(s));
        if (s.phase === "environment") s = chooseEnvironment(s, P47, 0);
        else if (s.phase === "teaBreak") s = pickTea(s, P47, 0);
        else if (s.phase === "plotArmor") s = s.plotArmor!.current!.uid === undefined ? chooseProtagonist(s, P47, eligible(s)[0].uid) : choosePlotArmor(s, P47, 0);
        else if (s.phase === "strategy") s = pickStrategy(s, P47, 0);
        else if (s.phase === "supply") s = skipSupply(s, P47);
        else if (s.phase === "encounter") s = { ...s, phase: "prep", encounter: "easy" };
        else if (s.phase === "result") s = advance(s, P47);
        else s = battle(settle(s, P47), P47);
      }
      return s;
    };
    const a = play(false), b = play(true);
    expect(a.phase).toBe("over");
    expect(b).toEqual(a);
    if (a.plane >= 1 || a.result === "cleared") expect(a.escapade!.done.length).toBeGreaterThan(0);
    expect(new Set(a.plotArmor!.done).size).toBe(a.plotArmor!.done.length);
    expect(TSR_GOODS.length).toBeGreaterThan(40);
    expect(nextInterlude(a, P47)).toBe(a);
  });
});
