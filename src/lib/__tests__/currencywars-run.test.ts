import { describe, expect, it } from "vitest";
import { buildTimeline, hpAt, turnOrder, turnsOf } from "../currencywars/timeline";
import { bondNames, membersOf, trackedMatches } from "../currencywars/bonds";
import { characterStats, itemBoosts, parseStatLine } from "../currencywars/stats";
import { gearStatus, recommendedFor } from "../../components/currencywars/RecommendedGear";
import { craftableNow, fillUnknown, gearMark, gearNeeds } from "../currencywars/gear";
import { combinations, combineResult, describe as describeItem, goldOreName, isOre, oreName } from "../currencywars/items";
import { cardNames, cleanWikitext, parseCharInfo, parseRareEquipment, parseDifficulty, parseEnvironments, parseEquipment, parseOpponents, parseStrategies, wikiTableRows } from "../currencywars/parse";
import {
  addToBag, costMedian, effectCoverage, levelUp, unitBase, maxHpOf, receive, refreshCostOf, sellItem,
  ASSUMED, advance, applyEffect, enterNode, refreshStrategy, gradeRulesOf, ahaStar, equipAha, promoteAeonAha, placedBondStates, rerollEnvironments, openOre, skipSupply, teamSize, battle, buy, buyXp, chooseEnvironment, combineBag, deployed, enemyPower, equip, merge, moveUnit, newRun,
  nodeKind, nodeKinds, objectives, pickStrategy, pickSupply, recipe, refresh, RULES, sell, teamPower, toggleLock, unitPower, units, type RunState, pickTea, choosePlotArmor, settle, useSwap, nextInterlude,
} from "../currencywars/run";
import { chooseProtagonist, eligible, refreshPlot, refreshPrice, changeProtagonist, plotOf, plotOptions, PLOT_ARMOR_CONFIG } from "../currencywars/plotArmor";
import { buyTsr, expressPower, refreshTsr, tsrIncome, tsrOf, priceOf, tsrGood, TSR_GOODS } from "../currencywars/trailblazeStore";
import { COMPANIONS } from "../currencywars/voyageCompanions";
import { boxOptions, openBox, shiftEarlier } from "../currencywars/escapade";
import { itemEffect, levelStats, powerMult, zeroStats } from "../currencywars/combat";
import { offerGrades, shiftGrade } from "../currencywars/strategyGrades";
import { abilityCard } from "../currencywars/abilities";
import { kitCoverage, kitEffect, starValue } from "../currencywars/kits";
import { emptyLayout, lockReason, payRun, resetLayout, syncSeason, unlockNode, advNode } from "../currencywars/advantage";
import { ahaSpeed, PUNCHLINE, simulateElation, type ElationUnit } from "../currencywars/elation";
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
    // The match also starts with a Precision Disassembly Wrench (A0–A5).
    expect(s.bag).toEqual(["Precision Disassembly Wrench"]);
    expect(a.bag).toHaveLength(3);
    expect(appliedA).toContain("2 basic equipment");
    const [b] = applyEffect(s, PACK, "Gain 25 Gold Coin(s). Your maximum Interest is increased to 10 Gold Coins.", createRng("x"));
    expect([b.gold - s.gold, b.interestCap]).toEqual([25, 10]);
    const [c] = applyEffect(s, PACK, "You no longer gain Interest. Instantly gain 15 Gold Coins. Gain 4 Experience whenever you enter a new Node.", createRng("x"));
    expect([c.gold - s.gold, c.interestCap, c.xpPerNode]).toEqual([15, 0, 4]);
    const [d, appliedD] = applyEffect(s, PACK, "When a fight ends, gain 1 Gold Coin(s).", createRng("x"));
    // A condition nothing handles is reported, not dropped silently.
    expect([d.gold, appliedD]).toEqual([s.gold, ["not simulated: When a fight ends, gain 1 Gold Coin(s)"]]);
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
    const won = battle({ ...s, on: [{ uid: 1, name: "Kafka", cost: 5, stars: 3, items: [] }, null, null, null], off: [{ uid: 2, name: "Jade", cost: 5, stars: 3, items: [] }, null, null, null, null, null] }, PACK);
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
    // With a full bench the character waits (red border) and joins when a slot frees up.
    const waited = pickSupply(s, PACK, 0);
    expect(waited.node).toBe(5);
    expect(waited.waiting?.map((u) => u.name)).toEqual(["Robin"]);
    expect(waited.bag).toContain("Roller Skates");
    const freed = sell({ ...waited, phase: "prep" }, { zone: "bench", index: 0 });
    expect(freed.bench[0]?.name).toBe("Robin");
    expect(freed.waiting).toEqual([]);
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

  it("a full bench keeps a given character waiting instead of losing it", () => {
    const full = { ...fresh(), bench: Array(9).fill(null).map((_, i) => ({ uid: 500 + i, name: `X${i}`, cost: 1, stars: 1 as const, items: [] })) };
    const [s, applied] = run('Obtains 1 "Kafka."', "Test", full);
    // The character waits for a free slot instead of being lost.
    expect(units(s).some((u) => u.name === "Kafka")).toBe(false);
    expect(s.waiting?.map((u) => u.name)).toEqual(["Kafka"]);
    expect(applied.join(" ")).toMatch(/Kafka/);
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

// --------------------------------------------------------------------------------------------- summons and equipment passives

const adv = (name: string, stats: string[], effect: string) => ({ name, tags: [], stats, effect, users: [], recipe: ["Folding Knife", "Roller Skates"] as [string, string] });
const P48: CwPack = {
  ...P47,
  characters: [...P47.characters, { name: "Dan Heng • Imbibitor Lunae", cost: 5 }, { name: "Dan Heng • Permansor Terrae", cost: 4 }].filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i),
  bonds: [
    ...P47.bonds,
    { name: "DoT", category: "School", members: ["Kafka", "Natasha", "Luocha", "Huohuo", "Serval"], summary: '"DoT" members\' DoT Amplification increases, and "Crimson Thorns" are summoned to attack all enemy targets. Ally squad gains 20% DMG Mitigation.', levels: [
      { count: 3, effect: "20% DoT Amplification.", tier: "bronze" }, { count: 5, effect: '50% DMG Amplification. Increases the action SPD of "Crimson Thorns" to 300', tier: "silver" }] },
    { name: "Twin Dragons' Call", category: "Unique", members: ["Dan Heng • Imbibitor Lunae", "Dan Heng • Permansor Terrae"], summary: "", levels: [{ count: 1, effect: 'When entering combat, summons "Dan Heng • Permansor Terrae" to the off-field area.', tier: "gold" }] },
  ],
  equipment: {
    ...P47.equipment!,
    advanced: [
      ...P47.equipment!.advanced,
      adv("Weapon Master", ["On-Field Strength 20%/40%", "Off-Field Strength 20%/40%"], "Increases ally squad's on-field/off-field strength by 25%/50%."),
      adv("Codex of Combat", ["On-Field Strength 20%/40%"], "The wearer gains 7%/14% SPD Amplification and 7%/14% DMG Amplification. When the wearer is 2/3-star or higher, these amplifications respectively increase to 3/6 times their original values."),
      adv("Colossal Imagenated Armor", ["DMG Mitigation 10%/20%"], "After the wearer is attacked by an enemy target or consumes HP, gains 6%/12% On/Off-Field Strength. This effect is stackable and can only be triggered 1 time per action."),
      adv("Whatever Dice", ["DMG Mitigation 20%/40%"], "At each Node, Whatever Dice randomly equips the character with two items (requires empty equipment slot to equip Whatever Dice)."),
    ],
  },
  info: { ...P47.info, "Dan Heng • Imbibitor Lunae": { cost: 5, field: "on", roles: [], bonds: [], onField: STR[5], offField: [0, 0, 0], hp: [0, 30, 60] }, "Dan Heng • Permansor Terrae": { cost: 4, field: "off", roles: [], bonds: [], onField: [0, 0, 0], offField: STR[4], hp: [0, 30, 60] } },
};

describe("equipment passives and Bond effects work in battle", () => {
  it("reads item stats and passives: squad buffs, star scaling, stacks, privileged values", () => {
    const wm = itemEffect(P48, "Weapon Master", { place: "on", stars: 1, boss: false });
    expect(wm.self).toMatchObject({ on: 0.2, off: 0.2 });
    expect(wm.squad).toEqual({ str: 0.25 });
    expect(itemEffect(P48, "Weapon Master", { place: "on", stars: 1, boss: false, privileged: true }).squad).toEqual({ str: 0.5 });
    expect(itemEffect(P48, "Codex of Combat", { place: "on", stars: 3, boss: false }).self.dmg).toBeCloseTo(0.42);
    expect(itemEffect(P48, "Colossal Imagenated Armor", { place: "on", stars: 1, boss: false }).self.str).toBeGreaterThan(0);
    expect(itemEffect(P48, "Folding Knife", { place: "on", stars: 1, boss: false }).self).toEqual({ on: 0.1 });
    expect(powerMult({ ...zeroStats(), on: 0.5 }, "off")).toBe(1);
  });

  it("Weapon Master raises the whole squad's strength, not just its wearer", () => {
    const s = at47(["Kafka", "Welt"], {}, { companion: "Sundove", variant: "sd-gift" });
    const plain = teamPower(s, P48).per.find((p) => p.name === "Welt")!.power;
    const worn = { ...s, on: [{ ...s.on[0]!, items: ["Weapon Master"] }, ...s.on.slice(1)] };
    expect(teamPower(worn, P48).per.find((p) => p.name === "Welt")!.power).toBeCloseTo(plain * 1.25, 3);
  });

  it("Bond texts become stats: members vs squad", () => {
    expect(levelStats("50% DMG Amplification. Increases the action SPD of \"Crimson Thorns\" to 300")).toEqual([{ dmg: 0.5 }, {}]);
    expect(levelStats("Ally squad gains 20% DMG Mitigation.")).toEqual([{}, { mit: 0.2 }]);
    expect(levelStats("Gains 1 Height. DMG taken by the enemy increases by 12%, and DMG dealt decreases by 6%.")[1]).toEqual({ dmg: 0.12, mit: 0.06 });
  });

  it("DoT's Crimson Thorns fights at 300 SPD, is on the turn order and isn't attacked", () => {
    const s = at47(["Kafka", "Natasha", "Luocha", "Huohuo", "Serval"], { plane: 0, node: 3 });
    const tp = teamPower(s, P48);
    expect(tp.summons.map((m) => [m.name, m.spd])).toEqual([["Crimson Thorns", 300]]);
    expect(tp.effects.find((e) => e.bond === "DoT")!.squad).toEqual({ mit: 0.2 });
    const fought = battle(s, P48);
    const tl = fought.last!.timeline!;
    const thorns = tl.units.find((u) => u.name === "Crimson Thorns")!;
    expect(thorns.summon).toMatchObject({ bond: "DoT", spd: 300 });
    expect(tl.turns!.some((t) => t.id === thorns.id)).toBe(true);
    expect(tl.events.some((e) => e.kind === "hit" && e.to === thorns.id)).toBe(false);
    // Without the summon the squad is weaker.
    const solo = teamPower({ ...s, on: [s.on[0], null, null, null], off: Array(6).fill(null) }, P48);
    expect(solo.summons).toHaveLength(0);
  });

  it("Twin Dragons' Call summons Dan Heng • Permansor Terrae off-field with copied equipment", () => {
    const s = at47(["Dan Heng • Imbibitor Lunae"], { plane: 0, node: 3 });
    const withGear = { ...s, on: [{ ...s.on[0]!, stars: 2 as const, items: ["Folding Knife", "Weapon Master", "Roller Skates"] }, null, null, null] };
    const tp = teamPower(withGear, P48);
    const pt = tp.summons.find((m) => m.character)!;
    expect(pt.character).toMatchObject({ name: "Dan Heng • Permansor Terrae", stars: 2, place: "off" });
    expect(pt.power).toBeGreaterThan(0);
    const tl = battle(withGear, P48).last!.timeline!;
    expect(tl.units.some((u) => u.name === "Dan Heng • Permansor Terrae" && u.side === "ally" && !u.summon)).toBe(true);
  });

  it("Whatever Dice puts two random items on its holder at each node", () => {
    const s = at47(["Kafka"], { plane: 0, node: 3 });
    const held = { ...s, on: [{ ...s.on[0]!, items: ["Whatever Dice"] }, null, null, null] };
    const next = enterNode(held, P48);
    expect(next.on[0]!.dice).toHaveLength(2);
    expect(teamPower(next, P48).power).toBeGreaterThan(teamPower(held, P48).power);
  });
});

// --------------------------------------------------------------------------------------------- Investment Strategy grades

const mkStrat = (rarity: "Silver" | "Gold" | "Prismatic", i: number) => ({ name: `${rarity} Plan ${i}`, rarity, effect: "Gain 1 Gold Coin(s).", planes: [1, 2, 3] });
const PG: CwPack = { ...P47, strategies: (["Silver", "Gold", "Prismatic"] as const).flatMap((r) => [1, 2, 3, 4, 5].map((i) => mkStrat(r, i))) };
const ENVS: Record<string, string> = {
  rainbow: "All Investment Strategies in this round are of Prismatic quality.",
  golden: "All Investment Strategies in this round are of Gold quality.",
  silver: "All Investment Strategies in this round are of Silver quality, so enemy difficulty will not increase with selecting higher quality Investment Strategies.",
  jackpot: "The first investment strategy is of Prismatic quality.",
  last: "The third investment strategy is of Prismatic quality.",
  sgi: "In this round, when selecting Investment Strategies at fixed Nodes, the left, middle, and right options will be Silver, Gold, and Prismatic quality respectively, and Investment Strategy refresh count increases by 2.",
};
/** A run with an environment text applied, standing on a Strategy node of `plane`. */
function stratNode(env: string | null, plane = 0, opts: { companion?: string; variant?: string } = { companion: "Sundove", variant: "sd-gift" }): RunState {
  let s = chooseEnvironment(newRun(PG, "grade", "A0-1", opts), PG, 0);
  if (env) s = applyEffect(s, PG, env, createRng("env"), "Test Environment")[0];
  return enterNode({ ...s, plane, node: nodeKinds(plane).indexOf("Strategy"), phase: "prep" }, PG);
}
const gradesOf = (s: RunState) => s.offers.strategies!.map((x) => x.rarity);

describe("Investment Strategy grades (Silver < Gold < Prismatic)", () => {
  it("moves grades with clamping at both ends", () => {
    expect([shiftGrade("Silver", 1), shiftGrade("Gold", 1), shiftGrade("Prismatic", 1), shiftGrade("Prismatic", -1), shiftGrade("Gold", -1), shiftGrade("Silver", -1)])
      .toEqual(["Gold", "Prismatic", "Prismatic", "Gold", "Silver", "Silver"]);
  });

  it("resolves rules in one place: forced > position > fixed > guarantee, then the one-shot shift (fixed rules win)", () => {
    const o = (rules: Parameters<typeof offerGrades>[0], kind: "node" | "extra" = "node", selection = 1, forced?: "Silver" | "Gold" | "Prismatic") => offerGrades(rules, { rolled: "Silver", kind, selection, count: 3, forced }).grades;
    expect(o({ fixed: "Silver" })).toEqual(["Silver", "Silver", "Silver"]);
    expect(o({ fixed: "Gold" })).toEqual(["Gold", "Gold", "Gold"]);
    expect(o({ fixed: "Prismatic" })).toEqual(["Prismatic", "Prismatic", "Prismatic"]);
    expect(o({ positions: ["Silver", "Gold", "Prismatic"] })).toEqual(["Silver", "Gold", "Prismatic"]);
    expect(o({ positions: ["Silver", "Gold", "Prismatic"] }, "extra")).toEqual(["Silver", "Silver", "Silver"]);
    expect(o({ guarantees: { 1: "Prismatic" } }, "node", 1)).toEqual(["Prismatic", "Prismatic", "Prismatic"]);
    expect(o({ guarantees: { 1: "Prismatic" } }, "node", 2)).toEqual(["Silver", "Silver", "Silver"]);
    expect(o({ nextShift: 1 })).toEqual(["Gold", "Gold", "Gold"]);
    expect(o({ fixed: "Silver", nextShift: 1 })).toEqual(["Silver", "Silver", "Silver"]);
    expect(o({ fixed: "Silver" }, "extra", 0, "Gold")).toEqual(["Gold", "Gold", "Gold"]);
  });

  it("the Ages fix every offer, and refreshing keeps the grade", () => {
    for (const [env, g] of [["rainbow", "Prismatic"], ["golden", "Gold"], ["silver", "Silver"]] as const) {
      const s = stratNode(ENVS[env]);
      expect(gradesOf(s)).toEqual([g, g, g]);
      expect(s.offers.strategyMeta!.why).toEqual(["fixed", "fixed", "fixed"]);
      const r = refreshStrategy({ ...s, offers: { ...s.offers, strategyMeta: { ...s.offers.strategyMeta!, refreshes: 2 } } }, PG, 1);
      expect(gradesOf(r)).toEqual([g, g, g]);
      expect(r.offers.strategies![1].name).not.toBe(s.offers.strategies![1].name);
    }
    // The Silver Age: no difficulty from picking.
    const silver = stratNode(ENVS.silver);
    expect(pickStrategy(silver, PG, 0).extraDifficulty).toBe(silver.extraDifficulty);
  });

  it("Jackpot makes the first Strategy selection Prismatic and Last Chance the third, and only those", () => {
    const j1 = stratNode(ENVS.jackpot, 0);
    expect(gradesOf(j1)).toEqual(["Prismatic", "Prismatic", "Prismatic"]);
    expect(j1.offers.strategyMeta!.why[0]).toBe("guarantee");
    const j2 = enterNode({ ...pickStrategy(j1, PG, 0), plane: 1, node: nodeKinds(1).indexOf("Strategy"), phase: "prep" }, PG);
    expect(j2.nodeSelections).toBe(2);
    expect(j2.offers.strategyMeta!.why[0]).not.toBe("guarantee");
    let l = stratNode(ENVS.last, 0);
    expect(l.offers.strategyMeta!.why[0]).not.toBe("guarantee");
    l = enterNode({ ...pickStrategy(l, PG, 0), plane: 1, node: nodeKinds(1).indexOf("Strategy"), phase: "prep" }, PG);
    l = enterNode({ ...pickStrategy(l, PG, 0), plane: 2, node: nodeKinds(2).indexOf("Strategy"), phase: "prep" }, PG);
    expect(gradesOf(l)).toEqual(["Prismatic", "Prismatic", "Prismatic"]);
  });

  it("Silver • Gold • Iridescence sets left/middle/right at fixed nodes, +2 refreshes, and refresh keeps each position", () => {
    const s = stratNode(ENVS.sgi);
    expect(gradesOf(s)).toEqual(["Silver", "Gold", "Prismatic"]);
    expect(s.offers.strategyMeta!.refreshes).toBe(2);
    let r = refreshStrategy(s, PG, 2);
    r = refreshStrategy(r, PG, 0);
    expect(gradesOf(r)).toEqual(["Silver", "Gold", "Prismatic"]);
    expect(r.offers.strategyMeta!.refreshes).toBe(0);
    expect(refreshStrategy(r, PG, 1).note).toMatch(/No Investment Strategy refreshes left/);
    // What you pick is what the card said, and difficulty follows it.
    const picked = pickStrategy(r, PG, 2);
    expect(picked.strategies.at(-1)!.rarity).toBe("Prismatic");
    expect(picked.extraDifficulty - r.extraDifficulty).toBe(RULES.strategyDifficulty.Prismatic);
  });

  it("Investment Level Up raises only the next selection by one", () => {
    let s = chooseEnvironment(newRun(PG, "grade", "A0-1", { companion: "Sundove", variant: "sd-gift" }), PG, 0);
    s = applyEffect(s, PG, "The quality of your next Investment Strategy increases by 1.", createRng("x"), "Investment Level Up")[0];
    expect(gradeRulesOf(s).nextShift).toBe(1);
    const first = enterNode({ ...s, node: nodeKinds(0).indexOf("Strategy"), phase: "prep" }, PG);
    expect(first.offers.strategyMeta!.grades[0]).not.toBe("Silver");
    expect(gradeRulesOf(first).nextShift).toBeUndefined();
  });

  it("Gold Investment opens an immediate Gold choice with 3 refreshes; Futures come later and can't be refreshed", () => {
    const base = chooseEnvironment(newRun(PG, "grade", "A0-1", { companion: "Sundove", variant: "sd-gift" }), PG, 0);
    const withGI = { ...base, phase: "strategy" as const, offers: { strategies: [{ name: "Gold Investment", rarity: "Prismatic" as const, planes: [1], effect: "Immediately choose one of three Gold Investment Strategies, with 3 refresh(es). After 3 Nodes, gains another refresh." }], strategyMeta: { grades: ["Prismatic" as const], why: ["rolled" as const], refreshes: 0, refreshable: true, kind: "node" as const } } };
    const now = pickStrategy(withGI, PG, 0);
    expect(now.phase).toBe("strategy");
    expect(gradesOf(now)).toEqual(["Gold", "Gold", "Gold"]);
    expect(now.offers.strategyMeta).toMatchObject({ kind: "extra", refreshes: 3, refreshable: true, source: "Gold Investment" });
    const after = pickStrategy(now, PG, 0);
    expect(after.phase).toBe("prep");
    expect(after.strategies.map((x) => x.rarity)).toEqual(["Prismatic", "Gold"]);
    expect(after.bankedStrategyRefreshes).toHaveLength(1);
    const futures = applyEffect(base, PG, "After 5 Node(s), choose one of three non-refreshable Prismatic Investment Strategies.", createRng("f"), "Prismatic Futures")[0];
    expect(futures.pendingSelections).toEqual([expect.objectContaining({ grade: "Prismatic", refreshable: false, at: 5 })]);
    const due = enterNode({ ...futures, node: 5, phase: "prep" }, PG);
    expect(due.phase).toBe("strategy");
    expect(gradesOf(due)).toEqual(["Prismatic", "Prismatic", "Prismatic"]);
    expect(refreshStrategy(due, PG, 0).note).toMatch(/can't be refreshed/);
  });

  it("Visionary turns Strategy Nodes into a free random Prismatic; Strategy Master pays per Strategy owned", () => {
    let s = chooseEnvironment(newRun(PG, "grade", "A0-1", { companion: "Sundove", variant: "sd-gift" }), PG, 0);
    s = applyEffect(s, PG, "Gains a random Gold Investment Strategy and 15 Gold Coins. Subsequent Investment Strategy Nodes will be changed to grant 1 random Prismatic Investment Strategies (cannot be refreshed) and will no longer increase enemy difficulty.", createRng("v"), "Visionary")[0];
    expect(s.strategies.map((x) => x.rarity)).toEqual(["Gold"]);
    const node = enterNode({ ...s, node: nodeKinds(0).indexOf("Strategy"), phase: "prep" }, PG);
    expect(node.phase).toBe("prep");
    expect(node.strategies.map((x) => x.rarity)).toEqual(["Gold", "Prismatic"]);
    expect(node.extraDifficulty).toBe(s.extraDifficulty);
    const m = applyEffect(stratNode(null), PG, "When obtaining an Investment Strategy, gain (2 × current number of Investment Strategies owned) Gold Coins. At Node 3-5, gain an additional Investment Strategy.", createRng("m"), "Strategy Master")[0];
    expect(pickStrategy(m, PG, 0).gold - m.gold).toBeGreaterThanOrEqual(2);
    expect(m.pendingSelections).toEqual([expect.objectContaining({ at: 9 + 7 + 4, source: "Strategy Master" })]);
  });

  it("Cottontail's first refresh each plane upgrades that option; save/load keeps grades and refreshes", () => {
    const s = stratNode(ENVS.golden, 0, { companion: "Cottontail", variant: "ct-strategy" });
    const meta = { ...s.offers.strategyMeta!, refreshes: 2 };
    const up = refreshStrategy({ ...s, offers: { ...s.offers, strategyMeta: meta } }, PG, 0);
    expect(up.offers.strategyMeta!.grades).toEqual(["Prismatic", "Gold", "Gold"]);
    expect(up.offers.strategyMeta!.why[0]).toBe("refresh-up");
    const again = refreshStrategy(up, PG, 1);
    expect(again.offers.strategyMeta!.grades[1]).toBe("Gold");
    const loaded = JSON.parse(JSON.stringify(again)) as RunState;
    expect(gradesOf(loaded)).toEqual(gradesOf(again));
    expect(pickStrategy(loaded, PG, 0).strategies.at(-1)!.rarity).toBe("Prismatic");
  });
});

// --------------------------------------------------------------------------------------------- ability labels (the game's character card)

const row = (name: string, type: string, effect: string) => `|-\n| {{Icon/Dark|Ability ${name}.png|50}}<br />${name}\n| ${type}\n| ${effect}`;
const table = (...rows: string[]) => `{| class="wikitable tdc1 thc1"\n! width="50px" | Ability !! Type !! Effect\n${rows.join("\n")}\n|}`;
const PEARL = `{{Currency Wars Character Infobox
|name           = Pearl
|cost           = 1
|field          = Off Field
|role1          = Heal
|role2          = Support
|bond1          = Phantasmoon Games
|ability1       = Blezzed Brushwork
|ability1_type1 = Basic ATK
|ability1_type2 = Ultimate
|ability1_type3 = Elation Skill
|ability1_type4 = Talent
|ability1_type5 = Innate Trace
|ability1_desc  = Can use "Certified Banger" to offset DMG. When taking action, uses Enhanced Basic ATK to attack enemies and heal on-field allies. When Energy is full, uses Ultimate to gain "Certified Banger" and advance the target's action.
|energy1        = 180
}}
==Abilities==
${table(row("Brushstroke", "Basic ATK (Change)", "Deals Ice DMG."), row("Appraise Soul's Ground", "Ultimate (Change)", "Gains 30 Certified Banger."), row("Dissolve Reason into Elation", "Elation Skill (Change)", "Elation DMG."), row("Grow Grace from Grit", "Talent (Change)", "Repellency."), row("Faces of Elation", "Innate Trace (Change)", "Party Trick."))}
==Recommended Equipment==`;
const SUNDAY = `{{Currency Wars Character Infobox
|name           = Sunday
|cost           = 2
|field          = On/Off Field
|role1          = Support
|ability1       = Bountiful Bestowal
|ability1_type1 = Skill
|ability1_type2 = Talent
|ability1_desc  = The SPD of "The Beatified" increases, and the ally squad's CRIT DMG increases.
|ability2       = Bountiful Bestowal
|ability2_type1 = Skill
|ability2_type2 = Ultimate
|ability2_type3 = Talent
|ability2_desc  = When taking action, makes one on-field unit immediately take action.
}}
==Abilities==
===On Field===
${table(row("Ode to Caress and Cicatrix", "Ultimate (Change)", "The Beatified."), row("Eternal Benediction", "Talent (New)", "Base Combo Rate of 15%/20%/30%/40%."))}
===Off Field===
${table(row("Benison of Paper and Rites", "Skill (Change)", "Immediate action."), row("Ode to Caress and Cicatrix", "Ultimate (Change)", "The Beatified."), row("The Sorrowing Body", "Talent (Change)", "CRIT Rate."))}
==Recommended Equipment==`;

describe("ability labels on character cards", () => {
  it("Pearl's card matches the game: Blessed Brushwork with five labels in the game's order", () => {
    const c = abilityCard(parseCharInfo(PEARL), "off")!;
    expect(c.name).toBe("Blessed Brushwork");
    expect(c.labels).toEqual(["Basic ATK", "Ultimate", "Elation Skill", "Talent", "Innate Trace"]);
    expect(c.desc).toMatch(/^Can use "Certified Banger" to offset DMG/);
    expect(c.energy).toBe(180);
    // All five infobox types survive parsing (the old parser kept three).
    expect(parseCharInfo(PEARL)!.summaries![0].types).toHaveLength(5);
  });

  it("labels follow the position: Sunday On-Field is Ultimate · Talent, Off-Field Skill · Ultimate · Talent", () => {
    const info = parseCharInfo(SUNDAY);
    expect(abilityCard(info, "on")).toMatchObject({ labels: ["Ultimate", "Talent"], desc: expect.stringMatching(/The Beatified/) });
    expect(abilityCard(info, "off")).toMatchObject({ labels: ["Skill", "Ultimate", "Talent"], desc: expect.stringMatching(/immediately take action/) });
    // No label a character doesn't have.
    expect(abilityCard(info, "on")!.labels).not.toContain("Elation Skill");
  });
});

// --------------------------------------------------------------------------------------------- Elation: Aha Instant, Punchline, Certified Banger, Lucky Strike

const eu = (uid: number, name: string, stars = 2, place: "on" | "off" = "off", power = 400): ElationUnit => ({ uid, name, stars, place, power, spdAmp: 0, lucky: 0, luckyDmg: 0, elation: 0 });
const AHA2 = { star: 2, strength: 0.16, dmg: 0.08, lucky: 0.08, luckyDmg: 0.08, spdAmp: 0 };

describe("Elation combat", () => {
  it("uses the wiki formulas: Punchline multiplier and Aha's SPD", () => {
    expect(PUNCHLINE.mult(0)).toBe(1);
    expect(PUNCHLINE.mult(240)).toBe(3.5);
    expect(ahaSpeed([150, 120, 100, 80], 0, 0)).toBe(80 + 30 + 12 + 5 + 2);
    expect(ahaSpeed([100], 30, 0.5)).toBe((80 + 20 + 30) * 1.5);
  });

  it("nothing happens without Elation characters or Aha", () => {
    expect(simulateElation([eu(1, "Kafka")], null, 150, "x").active).toBe(false);
  });

  it("Aha Instant: Elation Skills in Participant ID order, Aha at 199, Aeon ★ Aha last; Punchline grows during it", () => {
    const team = [eu(1, "Silver Wolf LV.999", 2, "on"), eu(2, "Sparxie"), eu(3, "Pearl"), eu(4, "Yao Guang"), eu(5, "Aeon ★ Aha", 1, "on")];
    const r = simulateElation(team, AHA2, 300, "order");
    expect(r.instants).toBeGreaterThan(0);
    const first = r.events.find((e) => e.kind === "aha")!;
    const seq = r.events.filter((e) => e.kind === "elation" && e.t > first.t && e.t < first.t + 1).map((e) => e.who);
    expect(seq).toEqual(["Pearl", "Yao Guang", "Sparxie", "Aha", "Silver Wolf LV.999", "Aeon ★ Aha"]);
    // Silver Wolf LV.999 (999) acts after Aha gained Punchline in the same Instant, so her hits count more Punchline than Sparxie's.
    const inFirst = (who: string) => r.events.find((e) => (e.kind === "hit" || e.kind === "lucky") && e.who === who && /all enemies/.test(e.text) && e.t > first.t && e.t < first.t + 1)!.punchline!;
    expect(inFirst("Silver Wolf LV.999")).toBeGreaterThan(inFirst("Sparxie"));
    // Aeon ★ Aha deals True DMG from the Instant's total.
    expect(r.events.some((e) => e.who === "Aeon ★ Aha" && /True DMG/.test(e.text))).toBe(true);
  });

  it("after an Instant: Certified Banger for participants, Punchline consumed, then +1 per Elation character", () => {
    const team = [eu(1, "Sparxie"), eu(2, "Pearl"), eu(3, "Yao Guang")];
    const r = simulateElation(team, AHA2, 300, "banger");
    const banger = r.events.find((e) => e.kind === "banger")!;
    expect(banger.text).toMatch(/Certified Banger \d+ → Pearl, Yao Guang, Sparxie \(2 turns\)/);
    const consumed = r.events.find((e) => e.kind === "punchline" && e.punchline === 0)!;
    expect(consumed.t).toBeGreaterThan(banger.t);
    const after = r.events.find((e) => e.kind === "punchline" && e.t > consumed.t)!;
    expect(after.punchline).toBe(3);
    expect(r.punchlineStart).toBe(3);
  });

  it("Lucky Strike is rolled per hit, separately from Punchline", () => {
    const sure = simulateElation([{ ...eu(1, "Sparxie"), lucky: 0.95 }], AHA2, 300, "lucky");
    // Without Aha (whose own hits roll the base 5%), a -100% rate never strikes.
    const never = simulateElation([{ ...eu(1, "Sparxie"), lucky: -1 }], null, 300, "lucky");
    expect(sure.luckyStrikes).toBeGreaterThan(10);
    expect(sure.events.filter((e) => e.lucky).length).toBe(sure.luckyStrikes);
    expect(never.luckyStrikes).toBe(0);
    const sameNoAha = simulateElation([{ ...eu(1, "Sparxie"), lucky: 0.95 }], null, 300, "lucky");
    expect(sameNoAha.punchlinePeak).toBe(never.punchlinePeak);
    expect(sameNoAha.damage).toBeGreaterThan(never.damage);
  });

  it("Punchline with no Elation Skill users and no Aha: \"Let There Be Laughter\"", () => {
    const r = simulateElation([eu(1, "Sparkle", 2, "on")], null, 300, "laughter");
    expect(r.events.some((e) => e.kind === "laughter")).toBe(true);
    expect(r.participants).toEqual([]);
  });
});

const ELATION_NAMES: [string, number, "on" | "off" | "both"][] = [["Sparxie", 2, "both"], ["Yao Guang", 3, "off"], ["Silver Wolf LV.999", 3, "on"], ["Aventurine • Waveflair", 4, "on"], ["Sparkle", 4, "on"], ["Pearl", 1, "off"]];
const PE: CwPack = {
  ...P48,
  characters: [...P48.characters, ...ELATION_NAMES.map(([name, cost]) => ({ name, cost }))].filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i),
  bonds: [...P48.bonds, { name: "Elation", category: "School", members: ["Sparxie", "Yao Guang", "Silver Wolf LV.999", "Aventurine • Waveflair", "Sparkle"], summary: "Increases the Lucky Strike Rate and SPD Amplification of Elation members.", levels: [
    { count: 3, effect: "10% Lucky Strike Rate and 6% SPD Amplification.", tier: "bronze" }, { count: 5, effect: "20% Lucky Strike and 12% SPD Amplification. 2-Star Aha, 2 equipment slots.", tier: "silver" }, { count: 6, effect: "30% and 18%.", tier: "gold" }, { count: 8, effect: "40% and 24%.", tier: "plat" }] }],
  info: { ...P48.info, ...Object.fromEntries(ELATION_NAMES.map(([name, cost, field]) => [name, { cost, field, roles: [], bonds: [], onField: STR[cost], offField: STR[cost], hp: [0, 30, 60] }])) },
};

describe("Elation in a run", () => {
  it("Aha descends with 3 basic pieces when the Bond activates, takes equipment, and fights in Aha Instants", () => {
    const pe = (uid: number, name: string) => ({ uid, name, cost: PE.characters.find((c) => c.name === name)!.cost, stars: 2 as const, items: [] as string[] });
    let s = at47([], { plane: 1, node: 0, bag: ["Folding Knife"], on: [pe(1, "Silver Wolf LV.999"), pe(2, "Aventurine • Waveflair"), pe(3, "Sparkle"), null], off: [pe(4, "Sparxie"), pe(5, "Yao Guang"), null, null, null, null] });
    expect(ahaStar(s, PE)).toBe(2);
    s = settle(s, PE);
    expect(s.aha!.items).toHaveLength(3);
    const withKnife = { ...s, aha: { items: ["Roller Skates", "Roller Skates", "Folding Knife"] } };
    const synth = equipAha(withKnife, PE, 0);
    expect(synth.aha!.items).toContain("Firestorm Surge");
    expect(synth.bag).toEqual([]);
    const tp = teamPower(synth, PE);
    expect(tp.elation.active).toBe(true);
    expect(tp.elationPower).toBeGreaterThan(0);
    const fought = battle(synth, PE);
    const tl = fought.last!.timeline!;
    const aha = tl.units.find((u) => u.name === "Aha")!;
    expect(aha.summon).toMatchObject({ bond: "Elation" });
    expect(tl.turns!.some((x) => x.id === aha.id)).toBe(true);
    expect(tl.events.some((e) => e.kind === "aha")).toBe(true);
    expect(tl.events.some((e) => e.kind === "punchline")).toBe(true);
    expect(fought.last!.elation).toMatchObject({ participants: expect.arrayContaining(["Yao Guang", "Sparxie"]) });
    expect(fought.last!.elation!.instants).toBeGreaterThan(0);
  });

  it("a squad without Elation characters is unchanged", () => {
    const s = at47(["Kafka", "Welt"], { plane: 1, node: 0 });
    expect(teamPower(s, PE).elation.active).toBe(false);
  });
});

// --------------------------------------------------------------------------------------------- kits (every character's Currency Wars abilities)

const kitInfo = (rows: [string, string, string][], field: "on" | "off" | "both" = "on", group = "On Field") => ({ cost: 3, field, roles: [], bonds: [], onField: [100, 200, 300], offField: [100, 200, 300], hp: [0, 30, 60], abilities: [{ group, list: rows.map(([name, t, effect]) => ({ name, types: [t], effect })) }] });

describe("character kits in combat", () => {
  it("reads star values", () => {
    expect(starValue("80%/120%/200%", 2)).toBe(120);
    expect(starValue("1,600%/2,000%/16,000%", 3)).toBe(16000);
    expect(starValue("50", 3)).toBe(50);
  });

  it("squad buffs and enemy debuffs count; a character's buffs to themselves are already in their strength", () => {
    const hanya = kitEffect(kitInfo([["Sanction", "Ultimate (Change)", "The SPD of other members in the ally squad also increases by an amount equal to 10%/14%/18% of Hanya's SPD, and the ally squad's ATK increases by 80%/120%/200%, lasting for 2 turn(s)."]]) as never, "Hanya", 2, "on");
    expect(hanya.squad.dmg).toBeGreaterThan(0);
    const cerydra = kitEffect(kitInfo([["Talent", "Talent (Change)", "Cerydra's CRIT Rate increases by 100% and CRIT DMG increases by 300%/360%/420%/480%."]]) as never, "Cerydra", 2, "on");
    expect(cerydra.squad).toEqual({});
    expect(cerydra.self).toEqual({});
    expect(cerydra.lines[0].status).toBe("strength");
    // "this unit's CRIT DMG …, and DMG dealt by the ally squad …": only the squad part is added.
    const anaxa = kitEffect(kitInfo([["Talent", "Talent (New)", "While Anaxa is on the field, this unit's CRIT DMG increases by 60%/100%/140%/180%, and DMG dealt by the ally squad increases by 30%/40%/50%/60%."]]) as never, "Anaxa", 1, "on");
    expect(anaxa.squad.dmg).toBeCloseTo(0.3 * 0.6, 5);
    const tribbie = kitEffect(kitInfo([["Zone", "Ultimate (Change)", "While the Zone lasts, increases enemy targets' DMG taken by 30.0%."]]) as never, "Tribbie", 1, "on");
    expect(tribbie.squad.dmg).toBeCloseTo(0.3 * 0.6, 5);
  });

  it("named summons become units; immediate actions speed the squad; shields count once", () => {
    const topaz = kitEffect(kitInfo([["Debt Collection", "Talent (Change)", "At the start of combat, summons Numby. When Numby takes action, additionally launches a Follow-Up ATK."]]) as never, "Topaz & Numby", 2, "on");
    expect(topaz.summons.map((x) => x.name)).toEqual(["Numby"]);
    const sunday = kitEffect(kitInfo([["Benison", "Skill (Change)", "Enables designated on-field ally character and their summon to immediately take action, increases their DMG dealt by 30%/45%/60%/75%."]]) as never, "Sunday", 1, "off");
    expect(sunday.squad.spd).toBeGreaterThan(0);
    const aven = kitEffect(kitInfo([["A", "Skill (Change)", "Provides a shield to all on-field allies."], ["B", "Talent (Change)", "Provides all on-field allies with a Shield."]]) as never, "Aventurine", 1, "on");
    expect(aven.squad.mit).toBeCloseTo(0.12 + 0.12 * 0.15, 5); // one shield (0.12), however many lines mention it
    expect(kitCoverage(aven).modelled).toBe(2);
  });

  it("in a fight: a kit summon is a unit on the turn order, and squad buffs raise everyone", () => {
    const withTopaz: CwPack = { ...P47, characters: [...P47.characters, { name: "Topaz & Numby", cost: 3 }], info: { ...P47.info, "Topaz & Numby": kitInfo([["Debt Collection", "Talent (Change)", "At the start of combat, summons Numby. All allies' ATK increases by 40%."]]) as never } };
    const s = at47(["Kafka"], { plane: 0, node: 3, on: [u47(1, "Kafka"), { uid: 2, name: "Topaz & Numby", cost: 3, stars: 2, items: [] }, null, null] });
    const tp = teamPower(s, withTopaz);
    expect(tp.summons.some((m) => m.name === "Numby" && m.power > 0)).toBe(true);
    const kafka = tp.per.find((p) => p.name === "Kafka")!;
    const alone = teamPower({ ...s, on: [u47(1, "Kafka"), null, null, null] }, withTopaz).per.find((p) => p.name === "Kafka")!;
    expect(kafka.power).toBeGreaterThan(alone.power);
    const tl = battle(s, withTopaz).last!.timeline!;
    expect(tl.units.some((u) => u.name === "Numby" && u.summon)).toBe(true);
  });
});

// --------------------------------------------------------------------------------------------- Advantage Layout, Aeon ★ Aha

describe("Advantage Layout and Phantasmal Orbs", () => {
  it("seasonal nodes need every permanent one; unlocking spends Orbs; reset refunds; a new season refunds only seasonal", () => {
    let l = { ...emptyLayout("Voyage Into the Canvas"), orbs: 500 };
    expect(lockReason(l, advNode("atk-1")!)).toMatch(/Permanent/);
    for (const id of ["battle-prep", "gold-blessing", "basic-armament", "bonus-supply", "strategy-refresh", "sustained-combat"]) l = unlockNode(l, id);
    expect(lockReason(l, advNode("atk-1")!)).toBeNull();
    l = unlockNode(unlockNode(l, "atk-1"), "sb-atk");
    expect(advNode("sb-atk")!.cost).toBe(20);
    const spent = 500 - l.orbs;
    expect(resetLayout(l)).toMatchObject({ orbs: 500, unlocked: [] });
    const next = syncSeason(l, "Next Season");
    expect(next.unlocked.every((id) => !["atk-1", "sb-atk"].includes(id))).toBe(true);
    expect(next.orbs).toBe(l.orbs + advNode("atk-1")!.cost + 20);
    expect(spent).toBeGreaterThan(0);
  });

  it("a run pays Orbs once", () => {
    const [a, n] = payRun(emptyLayout("S"), { id: "r1", cleared: true, rankSteps: 3, planesReached: 3, planeOneCleared: true });
    expect(n).toBeGreaterThan(0);
    expect(payRun(a, { id: "r1", cleared: true, rankSteps: 3, planesReached: 3, planeOneCleared: true })[1]).toBe(0);
    expect(a.lastPlaneOne).toBe(true);
  });

  it("unlocked nodes change the run: Strategy Refresh, Sustained Combat, Bonus Supply, Safety Mechanism, Total Refresh", () => {
    const adv = ["strategy-refresh", "sustained-combat", "bonus-supply", "safety", "total-refresh"];
    let s = newRun(PG, "adv", "A0-1", { companion: "Sundove", variant: "sd-gift", advantage: adv });
    expect(s.advantage).toEqual(adv);
    expect(s.bag.length).toBeGreaterThanOrEqual(1);
    const envs = rerollEnvironments(s, PG);
    expect(envs.advantageUsed).toEqual(["env"]);
    expect(rerollEnvironments(envs, PG)).toBe(envs);
    s = chooseEnvironment(s, PG, 0);
    const node = enterNode({ ...s, node: nodeKinds(0).indexOf("Strategy"), phase: "prep" }, PG);
    expect(node.offers.strategyMeta!.perOption).toEqual([false, false, false]);
    const sup = enterNode({ ...s, node: nodeKinds(0).indexOf("Supply"), phase: "prep" }, PG);
    expect(sup.offers.supply).toHaveLength(RULES.supplyOffers + 1);
    const fight = battle({ ...s, phase: "prep", plane: 1, node: 0, hp: 50 }, PG);
    if (fight.last!.won) expect(fight.hp).toBe(52);
    const dying = battle({ ...s, phase: "prep", plane: 2, node: 3, hp: 1, on: [u47(1, "Welt"), null, null, null], off: Array(6).fill(null) }, PG);
    // Safety Mechanism keeps the squad at 1 HP (then Sustained Combat heals 2): the run goes on.
    if (!dying.last!.won) { expect(dying.phase).not.toBe("over"); expect(dying.hp).toBe(3); expect(dying.advantageUsed).toContain("safety"); }
    // Without Safety Mechanism, 0 HP ends the run even with Sustained Combat.
    const noSafety = battle({ ...s, advantage: ["sustained-combat"], phase: "prep", plane: 2, node: 3, hp: 1, on: [u47(1, "Welt"), null, null, null], off: Array(6).fill(null) }, PG);
    if (!noSafety.last!.won) expect(noSafety.phase).toBe("over");
  });
});

describe("Aeon ★ Aha progression", () => {
  const AA: CwPack = { ...PE, characters: [...PE.characters, { name: "Aeon ★ Aha", cost: 4 }], bonds: PE.bonds.map((b) => (b.name === "Elation" ? { ...b, members: [...b.members, "Aeon ★ Aha"] } : b)), info: { ...PE.info, "Aeon ★ Aha": { cost: 4, field: "on", roles: [], bonds: [], onField: STR[4], offField: [0, 0, 0], hp: [0, 30, 60] } } };
  const aa = (stars: 1 | 2 | 3 = 1) => ({ uid: 77, name: "Aeon ★ Aha", cost: 4, stars, items: [] as string[] });
  it("becomes 5-cost at level 5 and 7-cost when Elation characters' stars reach 10", () => {
    const base = at47([], { level: 4, on: [aa(), null, null, null] });
    expect(promoteAeonAha(base, placedBondStates(base, AA))).toBe(base);
    const five = promoteAeonAha({ ...base, level: 5 }, placedBondStates(base, AA));
    expect(five.on[0]!.cost).toBe(5);
    const pe = (uid: number, name: string, stars: 1 | 2 | 3) => ({ uid, name, cost: AA.characters.find((c) => c.name === name)!.cost, stars, items: [] as string[] });
    const big = at47([], { level: 5, on: [aa(3), pe(2, "Sparxie", 3), pe(3, "Yao Guang", 2), pe(4, "Silver Wolf LV.999", 2)] });
    const seven = promoteAeonAha(big, placedBondStates(big, AA));
    expect(seven.on[0]!.cost).toBe(7);
    expect(teamPower(seven, AA).per.find((p) => p.name === "Aeon ★ Aha")!.power).toBeGreaterThan(teamPower(big, AA).per.find((p) => p.name === "Aeon ★ Aha")!.power);
  });
});

describe("Named Environment and Strategy rules (rules.ts) and consumables", () => {
  const strat = (s: RunState, name: string, effect: string, pack: CwPack = P47) =>
    pickStrategy({ ...s, phase: "strategy", offers: { strategies: [{ name, rarity: "Silver", effect, planes: [1, 2, 3] }] } }, pack, 0);
  const prep = (s: RunState): RunState => ({ ...s, phase: "prep" });

  it("consumables: Disassembly Wrench, Precision Wrench (reusable, wrench → 1 gold), Smelting Furnace, Special Privilege Card, Good Fortune Token", () => {
    const s = at47(["Welt", "Kafka"], { bag: ["Disassembly Wrench", "Precision Disassembly Wrench", "Smelting Furnace", "Special Privilege Card", "Good Fortune Token"] });
    const worn = { ...s, on: [{ ...s.on[0]!, items: ["Firestorm Surge", "Roller Skates"] }, s.on[1], null, null] };
    const off = equip(worn, P47, 0, { zone: "on", index: 0 });
    expect(off.on[0]!.items).toEqual([]);
    expect(off.bag).toEqual(expect.arrayContaining(["Firestorm Surge", "Roller Skates", "Precision Disassembly Wrench"]));
    expect(off.bag).not.toContain("Disassembly Wrench");
    // The Precision Wrench stays; a later Disassembly Wrench becomes 1 gold.
    const again = equip({ ...worn, bag: ["Precision Disassembly Wrench"] }, P47, 0, { zone: "on", index: 0 });
    expect(again.bag).toEqual(["Precision Disassembly Wrench", "Firestorm Surge", "Roller Skates"]);
    expect(addToBag(again, ["Disassembly Wrench"]).gold).toBe(again.gold + 1);
    // Privilege Card: the first advanced item becomes privileged (uses the second values).
    const priv = equip(worn, P47, 3, { zone: "on", index: 0 });
    expect(priv.on[0]!.items[0]).toBe("Firestorm Surge: Privilege");
    expect(unitPower(priv.on[0]!, "on", P47)).toBeGreaterThan(unitPower(worn.on[0]!, "on", P47));
    expect(describeItem(P47, "Firestorm Surge: Privilege").kindLabel).toMatch(/Privileged/);
    // Smelting Furnace on a bag item: same type (basic → basic).
    const smelt = combineBag({ ...s, bag: ["Smelting Furnace", "Roller Skates"] }, P47, 0, 1);
    expect(smelt.bag).toEqual(["Folding Knife"]);
    // Good Fortune Token: one of the character's recommended advanced items (Kafka: Firestorm Surge).
    const tok = equip(s, P47, 4, { zone: "on", index: 1 });
    expect(tok.bag).toContain("Firestorm Surge");
  });

  it("Trash Bags carry their wiki stats; HP, Max HP and win streak grants", () => {
    expect(itemEffect(P47, "Golden Trash Bag", { place: "on", stars: 1, boss: false }).self).toMatchObject({ on: 0.3, off: 0.3, lucky: 0.3, luckyDmg: 0.3, spd: 0.3, dmg: 0.3 });
    const s = at47(["Welt"], { hp: 50 });
    const hr = strat(s, "Health Recharge", "Gain 30 squad HP and 30 squad Max HP.");
    expect([hr.hp, maxHpOf(hr)]).toEqual([80, 130]);
    const cc = strat(s, "Cost Control", "At the end of combat, for each 10 action value(s) remaining, restores 1 squad HP during finalization. Gains up to 8 squad HP. Immediately gains 8 Gold Coin(s), 15 squad HP and 15 Max HP.");
    expect([cc.gold, cc.hp, maxHpOf(cc)]).toEqual([s.gold + 8, 65, 115]);
    expect(cc.log.at(-1)).not.toMatch(/not simulated/);
    expect(strat(s, "Victories After Victories", "Set current win streak to 4. Earn 4 Gold Coin(s).").streak).toBe(4);
  });

  it("event rules: Growth Fund, Twin Primes, Cashback, Bare Minimum, Goldgrubber, Long-Term Gains, Struggle Protocol, Longtermism", () => {
    const s = at47(["Welt"], { level: 8, xp: 0, gold: 10 });
    const gf = strat(s, "Growth Fund", "Provides 36 Gold Coin(s) when you reach level 9.");
    expect(levelUp(gf, 200).gold).toBe(gf.gold + 36);
    const tp = strat(s, "Twin Primes", "After obtaining this Investment Strategy, gain 2/3/5/7/11 Experience when you first purchase a 1/2/3/4/5-cost character.");
    const shop = [{ name: "Welt", cost: 1, stars: 1 as const }, { name: "Pearl", cost: 1, stars: 1 as const }, null, null, null];
    const b1 = buy(prep({ ...tp, shop }), P47, 0);
    expect(b1.xp).toBe(tp.xp + 2);
    expect(buy(b1, P47, 1).xp).toBe(b1.xp); // only the first 1-cost
    const bm = strat(s, "Bare Minimum", "You cannot purchase characters or refresh in the Store for 3 Node(s). After that, gains 20 Gold Coin(s).");
    expect(buy(prep({ ...bm, shop }), P47, 0).note).toMatch(/Bare Minimum/);
    expect(refresh(prep(bm), P47).note).toMatch(/Bare Minimum/);
    let n = prep(bm); for (let i = 0; i < 3; i++) n = prep(advance({ ...n, phase: "result" }, P47));
    expect(n.log.join(" ")).toMatch(/Bare Minimum: the Store opens again, \+20 gold/);
    const gg = strat({ ...s, gold: 20 }, "Goldgrubber", "Each time you spend Gold Coins to refresh the Store, you'll gain 2 Experience.");
    expect(refresh(prep(gg), P47).xp).toBe(gg.xp + 2);
    const sp = strat(s, "Struggle Protocol", "Purchasing EXP consumes 6 squad HP instead of Gold Coins. Restores 50 squad HP after boss battles.");
    const x = buyXp(prep(sp), P47);
    expect([x.gold, x.hp]).toEqual([sp.gold, sp.hp - 6]);
    const lt = strat({ ...s, gold: 0 }, "Longtermism", "Now and for the next 3 time(s) you enter a new Node, gain 7 Gold Coin(s) each time.");
    expect(lt.gold).toBe(7);
    let l = lt; for (let i = 0; i < 4; i++) l = advance({ ...l, phase: "result" }, P47);
    expect(l.log.filter((x2) => x2.startsWith("Longtermism: +7")).length).toBe(3);
  });

  it("combat rules change strength: Lone Wolf, Role Model, Team Power, Triple Threes, Hope of the Team, Easy Mode", () => {
    const s = at47(["Welt", "Kafka", "Feixiao"]);
    const base = teamPower(s, P47).power;
    const lone = strat(s, "Lone Wolf", "If the character has no active non-independent Bond, grants the character 120% On/Off-Field Strength and 36% DMG Mitigation.");
    // Welt and Kafka share Stellaron Hunters (a Faction Bond); only Feixiao has no non-independent Bond.
    const per = (st: RunState, n: string) => teamPower(st, P47).per.find((p) => p.name === n)!.power;
    expect(per(lone, "Feixiao")).toBeGreaterThan(per(s, "Feixiao") * 1.8);
    expect(per(lone, "Welt")).toBeCloseTo(per(s, "Welt"));
    for (const [name, text] of [["Role Model: Gold", "During combat, the member ranking first in DMG dealt becomes \"Role Model\" and their On/Off-Field Strength increases by 40%. Other members' On/Off-Field Strength increases by 10%."],
      ["Team Power: Gold", "For each activated Bond, the squad gains 6% On/Off-Field Strength and 4% HP Amplification."],
      ["Triple Threes", "Characters that are 3-star, 3-cost, or equipped with 3 items gain 10% SPD Amplification and 25% On/Off-Field Strength. These effects stack across different conditions."],
      ["Hope of the Team", "The ally character in the first on-field position gains 15% DMG Amplification and 15% HP Amplification."]] as const) {
      const r = strat(s, name, text);
      expect(teamPower(r, P47).power, name).toBeGreaterThanOrEqual(base);
      expect(r.log.at(-1), name).not.toMatch(/not simulated/);
    }
    const hard = { ...s, extraDifficulty: 6 };
    expect(enemyPower(strat(hard, "Easy Mode", "Reduces the difficulty of enemies by 3, down to a minimum of 0."), P47)).toBeLessThan(enemyPower(hard, P47));
    // Star Shifting: a 1-cost character fights at 3-star.
    const ss = strat(s, "Star Shifting", "At the start of combat, transforms a random 1-cost character into 3 star(s).");
    expect(teamPower(ss, P47).per.find((p) => p.name === "Welt")!.power).toBeGreaterThan(teamPower(s, P47).per.find((p) => p.name === "Welt")!.power * 1.8);
  });

  it("environments: Personal Accident Insurance adds a Supply before each Boss; War Frontier; Excess Budget; Long-Term Gains", () => {
    const s0 = newRun(P47, "env-rules", "A3-1");
    const env = (name: string, effect: string) => chooseEnvironment({ ...s0, offers: { environments: [{ name, effect }] } }, P47, 0);
    const pai = env("Personal Accident Insurance", "An extra supply phase is added before every Boss Node.");
    for (let p = 0; p < 3; p++) { const k = nodeKinds(p, pai); expect(k.at(-1)).toBe("Boss"); expect(k.at(-2)).toBe("Supply"); expect(k.length).toBe(RULES.planes[p].length + 1); }
    expect(nodeKinds(2, env("War Frontier", "All Combat Nodes in the Third Plane are replaced with Encounter Nodes."))).not.toContain("Combat");
    const eb = env("Excess Budget", "In supply phases, characters will carry two items.");
    const sup = enterNode({ ...eb, plane: 0, node: RULES.planes[0].indexOf("Supply") }, P47);
    expect(sup.offers.supply!.every((o) => (o.items ?? []).length === 2)).toBe(true);
    const lt = prep({ ...env("Long-Term Gains", "After refreshing 30 time(s) by spending Gold Coins, receives 20 Gold Coins. Afterwards, refreshing only costs 1 Gold Coin in this run."), gold: 200, freeRefreshes: 0 });
    let r = lt; for (let i = 0; i < 30; i++) r = refresh(r, P47);
    expect(r.gold).toBe(200 - 60 + 20);
    expect(refreshCostOf(r)).toBe(1);
  });

  it("coverage tags come from the same parser a run uses", () => {
    expect(effectCoverage(P47, "Growth Fund", "Provides 36 Gold Coin(s) when you reach level 9.").status).toBe("full");
    expect(effectCoverage(P47, "Holiday Giftbox", "Gain a random massive reward.").status).toBe("none");
    const part = effectCoverage(P47, "Chimera Growth Log", "When the Store levels up, obtains 2 \"Chimera Energy\" and 6 Gold Coins. Obtains 1 \"Welt\" and 1 \"Chimera Projector.\"");
    expect(part.status).toBe("partial");
    expect(part.missing).toEqual(["Chimera Projector"]);
  });

  it("conditional grants wait for their condition: The Sunken Arena, Diamond Dealer, Stars To Stars, Value Investing", () => {
    const s0 = newRun(P47, "cond", "A0-1");
    const sunk = chooseEnvironment({ ...s0, offers: { environments: [{ name: "The Sunken Arena", effect: 'Obtain a "Wealth Gem" upon achieving the first 5-win streak in this round.' }] } }, P47, 0);
    expect(sunk.bag).not.toContain("Wealth Gem");
    const fight = battle(prep({ ...sunk, streak: 4, plane: 0, node: 3, on: [u47(1, "Kafka", 3), u47(2, "Jade", 3), null, null], off: Array(6).fill(null) }), P47);
    if (fight.last!.won) expect(fight.bag).toContain("Wealth Gem");
    const s = at47(["Welt"], { level: 8, xp: 0 });
    const dd = strat(s, "Diamond Dealer", 'Gains "Wealth Gem" upon reaching Lv. 9.');
    expect(dd.bag).not.toContain("Wealth Gem");
    expect(levelUp(dd, 200).bag).toContain("Wealth Gem");
    const st = strat(s, "Stars To Stars", 'Upon merging a 3-star character, obtain 5 Gold Coin(s). Immediately obtain 1 "Staff Projector."');
    const three = merge({ ...st, bench: [u47(70, "Pearl", 2), u47(71, "Pearl", 2), u47(72, "Pearl", 2), ...Array(6).fill(null)] });
    expect(three.gold).toBe(st.gold + 5);
    const vi = strat(at47(["Welt"]), "Value Investing: Gold", "Obtain 1 random 2-star 1-cost character. Upon entering each new Node, get a 1-star version of this character, and after getting supplies, get 2 more, lasting until the end of this run.");
    const name = vi.ruleText?.value;
    expect(name).toBeTruthy();
    const next = advance({ ...vi, phase: "result" }, P47);
    expect(next.log.join(" ")).toContain(`Value Investing: ${name} joins.`);
  });

  it("Fusion Summon, Recycling Program, Obstinate, Free Market, Equipment Liquidation", () => {
    const s = at47(["Welt", "Kafka"]);
    const fs = strat(s, "Fusion Summon", 'When a character equips 2 identical advanced equipment, they will be synthesized into corresponding privileged equipment. Obtain 1 "Basic Weapon Box."');
    const worn = { ...prep(fs), on: [{ ...fs.on[0]!, items: ["Firestorm Surge"] }, fs.on[1], null, null], bag: ["Firestorm Surge"] };
    expect(equip(worn, P47, 0, { zone: "on", index: 0 }).on[0]!.items).toEqual(["Firestorm Surge: Privilege"]);
    const rp = strat(s, "Recycling Program", "When selling a character, advanced equipment will be broken down into basic equipment. Gains 1 piece(s) of advanced equipment, and gains 1 piece(s) of random basic equipment after 5 Nodes.");
    expect(rp.triggers?.some((t) => t.source === "Recycling Program" && t.after === 5)).toBe(true);
    const sold = sell({ ...prep(rp), bag: [], on: [{ ...rp.on[0]!, items: ["Firestorm Surge"] }, rp.on[1], null, null] }, { zone: "on", index: 0 }, P47);
    expect(sold.bag.sort()).toEqual(["Folding Knife", "Roller Skates"]);
    const ob = strat(s, "Obstinate", "When combat fails, increases the ally squad's DMG taken by 5, but maintains the original win streak. Gain 6 Gold Coin(s).");
    const lost = battle(prep({ ...ob, streak: 3, plane: 2, node: 6, on: [u47(1, "Welt"), null, null, null], off: Array(6).fill(null) }), P47);
    if (!lost.last!.won) expect(lost.streak).toBe(3);
    const fm = strat(s, "Free Market", "Whenever you are about to gain one piece of basic equipment, gains 1 \"Basic Weapon Box\" instead. Gains 1 piece(s) of random basic equipment.");
    expect(fm.bag).toEqual(["Basic Weapon Box"]);
    const el = strat(s, "Equipment Liquidation", 'Equipment can be sold. Immediately obtains 2 "Basic Weapon Box." At the start of each plane, obtains 1 random piece(s) of basic equipment.');
    const withKnife = prep({ ...el, bag: ["Folding Knife"] });
    expect(sellItem(withKnife, P47, 0).gold).toBe(withKnife.gold + 1);
    expect(el.triggers?.some((t) => t.on === "plane" && t.repeat)).toBe(true);
  });
});

describe("Wrenches, Weapon Boxes, Wishpower, Owlbert and the waiting area", () => {
  const strat = (s: RunState, name: string, effect: string) =>
    pickStrategy({ ...s, phase: "strategy", offers: { strategies: [{ name, rarity: "Prismatic", effect, planes: [1, 2, 3] }] } }, P47, 0);

  it("matches start with a Precision Disassembly Wrench (A0–A5) or a Disassembly Wrench (A6+)", () => {
    expect(newRun(P47, "w", "A3-1").bag).toContain("Precision Disassembly Wrench");
    expect(newRun(P47, "w", "A6-1").bag).toContain("Disassembly Wrench");
    expect(newRun(P47, "w", "A6-1").bag).not.toContain("Precision Disassembly Wrench");
  });

  it("every Weapon Box opens with a choice (basic / 3 advanced / 3 privileged)", () => {
    const s = { ...at47(["Welt"]), bag: ["Basic Weapon Box", "Advanced Weapon Box", "Privilege Weapon Box"] };
    expect(boxOptions(s, P47, "Basic Weapon Box")).toEqual(P47.equipment!.basic.map((b) => b.name));
    const adv = boxOptions(s, P47, "Advanced Weapon Box");
    expect(adv.length).toBeGreaterThan(0);
    expect(boxOptions(s, P47, "Advanced Weapon Box")).toEqual(adv); // stable until one is opened
    const opened = openBox(s, P47, 1, adv[0]);
    expect(opened.bag[1]).toBe(adv[0]);
    expect(boxOptions(s, P47, "Privilege Weapon Box").every((x) => x.endsWith(": Privilege"))).toBe(true);
    expect(openBox(s, P47, 1, "Not An Option").bag).toEqual(s.bag);
  });

  it("Owlbert gives 999 Gold Coins (house rule)", () => {
    const s = at47(["Welt"], { gold: 1 });
    expect(strat(s, "Owlbert, Emissary of Gold", "It's the incredibly rare Gold Coin Owlbert! Get ready for a shower of gold!").gold).toBe(1000);
    expect(strat(s, "Owlbert, Emissary of Emblems", "It's the incredibly rare Emblem Owlbert! Get ready for a shower of Emblems!").gold).toBe(1000);
  });

  it("Wishpower ores open into their wiki rewards", () => {
    const s = { ...at47(["Welt"]), bag: ["Wishpower Crystal Ore Lv. 8", "Wishpower Crystal Ore Lv. 2"] };
    const a = openOre(s, P47, 0);
    expect(a.bag).toEqual(expect.arrayContaining(["Basic Weapon Box", "Special Privilege Card", "Smelting Furnace"]));
    expect(openOre(s, P47, 1).gold).toBe(s.gold + 3);
  });

  it("characters given with a full bench wait (and take the next free slot)", () => {
    const full = at47(["Welt"], { bench: Array(9).fill(null).map((_, i) => ({ uid: 700 + i, name: i % 2 ? "Pearl" : "Natasha", cost: 1, stars: 2 as const, items: [] })) });
    const got = receive(full, "Kafka", 5);
    expect(got.waiting?.map((u) => u.name)).toEqual(["Kafka"]);
    expect(buy({ ...got, gold: 99, shop: [{ name: "Jade", cost: 5, stars: 1 }, null, null, null, null] }, P47, 0).note).toMatch(/bench is full/);
    const freed = sell(got, { zone: "bench", index: 0 });
    expect(freed.waiting).toEqual([]);
    expect(freed.bench[0]?.name).toBe("Kafka");
  });
});

describe("Battle realism: Action Value turns, idle characters, balance", () => {
  const ally = (name: string, spd: number, power = 100) => ({ name, cost: 2, stars: 1 as const, power, place: "on" as const, spd });
  const fight = (allies: ReturnType<typeof ally>[], won = true) => buildTimeline({ allies, enemies: [{ name: "E1" }, { name: "E2" }], waves: 1, won, cleared: won ? 1 : 0.5, ratio: won ? 2 : 0.8, limit: 150, bossPhases: 2, reviveCost: 15 }, createRng("t"));

  it("turns follow Action Value: one every 10000 / SPD, so faster characters act more", () => {
    const tl = fight([ally("Slow", 0), ally("Fast", 200)], false);
    const n = (name: string) => (tl.turns ?? []).filter((t) => t.id === tl.units.find((u) => u.name === name)!.id).length;
    expect(n("Slow")).toBe(1); // 100 SPD → AV 100 in a 150-AV fight
    expect(n("Fast")).toBe(4); // 300 SPD → every 33.3 AV
  });

  it("a quick win still lets every acting character take a turn", () => {
    const tl = fight([ally("A", 0), ally("B", 0), ally("C", 50)]);
    for (const u of tl.units.filter((x) => x.side === "ally")) expect((tl.turns ?? []).some((t) => t.id === u.id)).toBe(true);
  });

  it("a character without a wiki page uses its cost tier's median strength", () => {
    const pack = { ...P47, characters: [...P47.characters, { name: "Nobody", cost: 1 }] };
    const lone = unitBase({ uid: 1, name: "Nobody", cost: 1, stars: 2, items: [] }, "on", pack);
    expect(lone).toBe(costMedian(pack, 1)[1]);
    expect(lone).toBeGreaterThan(0);
  });

  it("Energy strategies count (Energy is in points)", () => {
    const s = at47(["Welt", "Kafka"]);
    const pe = pickStrategy({ ...s, phase: "strategy", offers: { strategies: [{ name: "Positive Energy", rarity: "Silver", effect: "When entering combat, the ally squad regenerates Energy equal to 20% of Max Energy.", planes: [1, 2, 3] }] } }, P47, 0);
    expect(teamPower(pe, P47).power).toBeGreaterThan(teamPower(s, P47).power * 1.05);
  });
});

