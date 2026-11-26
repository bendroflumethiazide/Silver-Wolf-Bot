import { describe, expect, it } from "vitest";
import { cardNames, cleanWikitext, parseCharInfo, parseDifficulty, parseEnvironments, parseEquipment, parseOpponents, parseStrategies, wikiTableRows } from "../currencywars/parse";
import {
  ASSUMED, advance, applyEffect, skipSupply, battle, buy, buyXp, chooseEnvironment, combineBag, deployed, enemyPower, equip, merge, moveUnit, newRun,
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
    expect(parseCharInfo(KAFKA)).toEqual({ cost: 5, field: "on", roles: ["DPS", "Support"], bonds: ["Stellaron Hunters", "DoT"], onField: [200, 320, 2000], offField: [0, 0, 0], hp: [60, 108, 500] });
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
  equipment: eq,
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
        while (s.bag.length) { const target = deployed(s).find((u) => u.items.length < 3); if (!target) break; const spot = (["on", "off"] as const).map((z) => ({ zone: z, index: s[z].findIndex((x) => x?.uid === target.uid) })).find((x) => x.index >= 0)!; const n = equip(s, PACK, 0, spot); if (n === s) break; s = n; }
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
