/**
 * Synthetic game data for hermetic E2E tests. Entirely invented names and numbers — no HoYoverse
 * content — served by intercepting requests to the StarRailRes host.
 */
import type { Page } from "@playwright/test";

const tree = (id: string, anchor: string, max: number, name = "", props: { type: string; value: number }[] = [], promo = 0, mats = [{ id: "2", num: 1000 }]) => ({
  id, name, max_level: max, desc: name ? `${name} does something.` : "", params: [], anchor, pre_points: [], level_up_skills: [],
  levels: Array.from({ length: max }, (_, i) => ({ promotion: i === 0 ? promo : Math.min(6, i), level: 0, properties: props, materials: i === 0 && max > 1 ? [] : mats })), icon: "",
});

function character(id: string, name: string, path: string, element: string, rarity: number) {
  const ids = ["001", "002", "003", "004", "101", "102", "103", ...Array.from({ length: 10 }, (_, i) => `2${String(i + 1).padStart(2, "0")}`)].map((s) => id + s);
  return { id, name, tag: name.toLowerCase(), rarity, path, element, max_sp: 120, ranks: [1, 2, 3, 4, 5, 6].map((r) => `${id}0${r}`), skills: [`${id}01`, `${id}02`], skill_trees: ids, icon: "", preview: "", portrait: "" };
}

export function syntheticFiles(version = "9.9.0") {
  const characters = {
    "1006": character("1006", "Silver Wolf", "Warlock", "Quantum", 5),
    "1901": character("1901", "Test Vanguard", "Knight", "Fire", 4),
    "1902": character("1902", "Test Medic", "Priest", "Ice", 4),
    "1903": character("1903", "Test Striker", "Warrior", "Physical", 5),
    "1904": character("1904", "Test Bard", "Shaman", "Wind", 4),
  };
  const character_skill_trees: Record<string, unknown> = {};
  for (const c of Object.values(characters)) {
    c.skill_trees.forEach((t, i) => {
      if (i < 4) character_skill_trees[t] = tree(t, `Point0${i + 1}`, i === 0 ? 6 : 10);
      else if (i < 7) character_skill_trees[t] = tree(t, `Point0${i + 2}`, 1, `Ability ${i - 3}`, [], 2 * (i - 3));
      else character_skill_trees[t] = tree(t, `Point${i + 2}`, 1, "Stat Boost", [{ type: "AttackAddedRatio", value: 0.04 }], i > 10 ? 4 : 0);
    });
  }
  const growth = (b: number) => ({ base: b, step: b / 20 });
  const character_promotions = Object.fromEntries(Object.keys(characters).map((id) => [id, {
    id, values: Array.from({ length: 7 }, (_, i) => ({ hp: growth(100 + i * 50), atk: growth(50 + i * 25), def: growth(40 + i * 20), spd: { base: 100, step: 0 }, taunt: { base: 100, step: 0 }, crit_rate: { base: 0.05, step: 0 }, crit_dmg: { base: 0.5, step: 0 } })),
    materials: [0, 1, 2, 3, 4, 5].map((i) => [{ id: "2", num: 4000 * (i + 1) }, { id: "900001", num: 2 + i }]).concat([[]]),
  }]));
  const character_skills = Object.fromEntries(Object.values(characters).flatMap((c) => c.skills.map((s, i) => [s, { id: s, name: i ? "Test Skill" : "Test Basic", max_level: i ? 10 : 6, element: c.element, type: i ? "BPSkill" : "Normal", type_text: i ? "Skill" : "Basic ATK", effect: "SingleAttack", effect_text: "Single Target", simple_desc: "", desc: "Deals DMG equal to #1[i]% of ATK.", params: Array.from({ length: 10 }, (_, k) => [0.5 + k * 0.1]), icon: "" }])));
  const character_ranks = Object.fromEntries(Object.values(characters).flatMap((c) => c.ranks.map((r, i) => [r, { id: r, name: `Eidolon ${i + 1}`, rank: i + 1, desc: "Improves things.", materials: [], icon: "" }])));
  const light_cones = { "29001": { id: "29001", name: "Test Cone", rarity: 5, path: "Warlock", desc: "", icon: "", preview: "", portrait: "" }, "23000": { id: "23000", name: "Standard Cone", rarity: 5, path: "Warrior", desc: "", icon: "", preview: "", portrait: "" }, "21001": { id: "21001", name: "Small Cone", rarity: 4, path: "Knight", desc: "", icon: "", preview: "", portrait: "" } };
  const light_cone_ranks = Object.fromEntries(Object.keys(light_cones).map((id) => [id, { id, skill: "Test Passive", desc: "CRIT Rate +#1[i]%.", params: [[0.1], [0.12], [0.14], [0.16], [0.18]], properties: [[], [], [], [], []] }]));
  const light_cone_promotions = Object.fromEntries(Object.keys(light_cones).map((id) => [id, { id, values: Array.from({ length: 7 }, () => ({ hp: growth(40), atk: growth(20), def: growth(15) })), materials: [0, 1, 2, 3, 4, 5].map(() => [{ id: "2", num: 3000 }]).concat([[]]) }]));
  const relic_sets = { "101": { id: "101", name: "Set of Testing", desc: ["2pc: +10% ATK.", "4pc: +10% SPD."], properties: [[], []], icon: "" }, "301": { id: "301", name: "Planar of Testing", desc: ["2pc: +8% ERR."], properties: [[]], icon: "" } };
  const items = { "2": { id: "2", name: "Credit", type: "Virtual", sub_type: "Virtual", rarity: 3, icon: "", come_from: ["Calyx (Golden)"] }, "900001": { id: "900001", name: "Test Ore", type: "Material", sub_type: "Material", rarity: 4, icon: "", come_from: ["Stagnant Shadow: Test"] } };
  const achievements = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`40${i}`, { id: `40${i}`, series_id: String((i % 2) + 1), title: `Test Achievement ${i}`, desc: `Do test thing ${i}`, hide_desc: "", hide: i === 5 }]));
  return {
    info: { version, timestamp: 1790000000, folder: "index_min" },
    paths: { Warlock: { id: "Warlock", text: "Nihility", name: "Nihility", desc: "", icon: "" }, Knight: { id: "Knight", text: "Preservation", name: "Preservation", desc: "", icon: "" }, Priest: { id: "Priest", text: "Abundance", name: "Abundance", desc: "", icon: "" }, Warrior: { id: "Warrior", text: "Destruction", name: "Destruction", desc: "", icon: "" }, Shaman: { id: "Shaman", text: "Harmony", name: "Harmony", desc: "", icon: "" } },
    elements: Object.fromEntries(["Quantum", "Fire", "Ice", "Physical", "Wind"].map((e) => [e, { id: e, name: e, desc: "", color: "#fff", icon: "" }])),
    characters, character_ranks, character_skills, character_skill_trees, character_promotions, light_cones, light_cone_ranks, light_cone_promotions,
    relic_sets, relics: {}, relic_main_affixes: {}, relic_sub_affixes: {}, items, achievements,
    simulated_blessings: {
      "1": { id: "1", name: "Test Blessing", desc: "Bless.", enhanced_desc: "" },
      // Classic SU id scheme 612 + Path digit (8 = Erudition, 5 = Destruction) + rarity digit (3/4/5) + n.
      ...Object.fromEntries(["612820", "612830", "612840", "612841", "612850", "612851", "612852", "612853", "612540", "612550", "612551", "612552"].map((id) => [id, { id, name: id.endsWith("20") ? "Path Resonance: Erudition" : `Fixture Blessing ${id}`, desc: `Effect ${id}.`, enhanced_desc: `Better ${id}.` }])),
    },
    simulated_curios: { "1": { id: "1", name: "Test Curio", desc: "Curious.", bg_desc: "", icon: "" } },
    simulated_events: { "1": { id: "1", name: "Test Occurrence", type: "Nihility", image: "" } },
    nickname: { characters: { "1006": ["SW"] } },
    descriptions: { "1": { id: "1", title: "Test Term", desc: "A glossary term." } },
    avatars: { "1": { id: "1", name: "Test Contact", icon: "" } },
  } as Record<string, unknown>;
}

/** Serve synthetic data for every StarRailRes request; images 404 so fallbacks are exercised. */
export async function mockGameData(page: Page, version = "9.9.0") {
  const files = syntheticFiles(version);
  await page.route("https://raw.githubusercontent.com/**", async (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname.split("/").pop()!.replace(/\.json$/, "");
    if (url.pathname.endsWith(".json") && name in files) return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(files[name]) });
    return route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "not found" });
  });
}

export async function installGameData(page: Page) {
  await mockGameData(page);
  await page.goto("/settings");
  await page.getByLabel(/I understand this downloads/).check();
  await page.getByRole("button", { name: /Download game data/ }).click();
  await page.getByText("active", { exact: true }).waitFor();
}

export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return errors;
}

/**
 * Synthetic Currency Wars wiki pages (invented names), served by intercepting the wiki API, so the
 * download → parse → simulator path runs without the network.
 */
export async function installCwWiki(page: Page) {
  const costs: Record<number, string[]> = { 1: ["Fx Ash", "Fx Birch", "Fx Cedar"], 2: ["Fx Dune", "Fx Elm"], 3: ["Fx Fern", "Fx Grove"], 4: ["Fx Heath"], 5: ["Fx Iris"] };
  const field: Record<string, string> = { "Fx Ash": "On Field", "Fx Birch": "Off Field", "Fx Cedar": "On/Off Field", "Fx Dune": "On Field", "Fx Elm": "Off Field", "Fx Fern": "On Field", "Fx Grove": "On/Off Field", "Fx Heath": "On Field", "Fx Iris": "Off Field" };
  const table = (head: string, rows: string[][]) => `{| class="wikitable"\n! ${head}\n${rows.map((r) => `|-\n${r.map((c) => `| ${c}`).join("\n")}`).join("\n")}\n|}`;
  const pages: Record<string, string> = {
    "Currency Wars": `<gallery>\nCurrency Wars Period Fixture.png|link=Currency Wars: Fixture Season|<big>Fixture Season</big><br />Version [[9.9]] – Present\n</gallery>`,
    "Currency Wars: Fixture Season/Characters": Object.entries(costs).map(([c, n]) => `===${c}-Cost===\n{{Card List|${n.join(", ")}|type=Currency Wars Character}}`).join("\n"),
    "Currency Wars: Fixture Season/Bonds": `==Faction Bonds==
===Grove Guild===
{{Bond Information
|name      = Grove Guild
|members   = Fx Ash, Fx Birch, Fx Fern, Fx Iris
|effect    = Fixture faction.
|silver    = 3
|effect2   = 10% strength.
|effect3   = 20% strength.
}}
==School Bonds==
===Fixture School===
{{Bond Information
|name      = Fixture School
|members   = Fx Cedar, Fx Dune, Fx Elm, Fx Grove, Fx Heath
|effect    = Fixture school.
|gold      = 4
|effect2   = 5% strength.
|effect4   = 15% strength.
}}`,
    "Currency Wars: Fixture Season": `{| class="article-table"\n|+ Shop Odds\n! Level !! 1 !! 2 !! 3 !! 4 !! 5\n${[[1, 100, 0, 0, 0, 0], [2, 100, 0, 0, 0, 0], [3, 100, 0, 0, 0, 0], [4, 65, 25, 10, 0, 0], [5, 45, 33, 20, 2, 0], [6, 30, 40, 25, 5, 0], [7, 19, 30, 40, 10, 1], [8, 18, 25, 32, 22, 3], [9, 15, 20, 25, 30, 10], [10, 5, 10, 20, 40, 25]].map((r) => `|-\n| ${r[0]} || ${r.slice(1).map((x) => `${x}%`).join(" || ")}`).join("\n")}\n|}`,
    "Currency Wars: Fixture Season/Equipment": `===Basic Equipment===\n${table("Equipment !! Tags !! Stats", [["[[File:Equipment Roller Skates.png|50px]]<br />Roller Skates", "SPD", "SPD Amplification: 5%"], ["[[File:Equipment Folding Knife.png|50px]]<br />Folding Knife", "On-Field", "On-Field Strength: 10%"]])}
===Advanced/Privileged Equipment===
${table("Equipment !! Tags !! Stats !! Effect !! Users !! Synthesis", [
  ["[[File:Equipment Fixture Blade.png|50px]]<br />Fixture Blade", "DPS", "On-Field Strength 25%/50%", "Hits harder.", "{{Card List|Fx Ash}}", "{{nowrap|[[File:Equipment Folding Knife.png|40px]] + [[File:Equipment Roller Skates.png|40px]]}}"],
  ["[[File:Equipment Fixture Boots.png|50px]]<br />Fixture Boots", "SPD", "SPD Amplification 25%/50%", "Runs faster.", "{{Card List|Fx Birch}}", "{{nowrap|[[File:Equipment Roller Skates.png|40px]] + [[File:Equipment Roller Skates.png|40px]]}}"],
  ["[[File:Equipment Fixture Edge.png|50px]]<br />Fixture Edge", "DPS", "On-Field Strength 40%/80%", "Cuts.", "{{Card List|Fx Iris}}", "{{nowrap|[[File:Equipment Folding Knife.png|40px]] + [[File:Equipment Folding Knife.png|40px]]}}"],
])}
====Diamond & Treasure Gem====
${table("Equipment !! Tags !! Effect !! Synthesis", [["[[File:Equipment Red Gem.png|50px]]<br />Red Gem", "Diamond", "Used to synthesize Faction Emblems.", "N/A"], ["[[File:Equipment Wealth Gem.png|50px]]<br />Wealth Gem", "Diamond", "Owning a Gem increases the team size limit by 1.", "{{nowrap|[[File:Equipment Red Gem.png|40px]] + [[File:Equipment Red Gem.png|40px]]}}"]])}
====Emblem====
${table("Equipment !! Tags !! Stats !! Effect !! Users !! Synthesis", [["[[File:Equipment Grove Guild Emblem.png|50px]]<br />Grove Guild Emblem", "Emblem", "On-Field Strength 30%", 'Grants the wearer the "Grove Guild" Bond.', "{{Card List|Fx Dune}}", "{{nowrap|[[File:Equipment Red Gem.png|40px]] + [[File:Equipment Folding Knife.png|40px]]}}"]])}`,
    "Currency Wars: Fixture Season/Investment Environment": `==List of Investment Environments==\n${table("Name !! Effect", [["{{Icon/Dark|a.png|50}}<br />Fixture Armory", "Starts with 2 Basic Weapon Box(es)."], ["{{Icon/Dark|b.png|50}}<br />Fixture Dispatch", "Gain a random emblem. Each time you enter a Boss Node, receive a random character with the corresponding Bond."], ["{{Icon/Dark|c.png|50}}<br />Fixture Mint", "Gains a crystal ore worth 6/8/12 Gold Coin(s) at the start of Plane 1/2/3 respectively."]])}`,
    "Currency Wars: Fixture Season/Investment Strategy": ["Prismatic", "Gold", "Silver"].map((r, i) => `===${r}===\n${table("Name !! Effect !! Plane of Appearance", [[`{{Icon/Dark|s${i}.png|50}}<br />${r} Plan A`, `Gain ${5 + i} Gold Coin(s).`, "Plane 1, Plane 2, Plane 3"], [`{{Icon/Dark|t${i}.png|50}}<br />${r} Plan B`, "Receives 2 free refresh(es).", "Plane 1, Plane 2, Plane 3"], [`{{Icon/Dark|u${i}.png|50}}<br />${r} Plan C`, "When a fight ends, nothing happens.", "Plane 1, Plane 2, Plane 3"]])}`).join("\n"),
    "Currency Wars: Fixture Season/Opponent": `===Stat Modifiers===
{| class="wikitable"
! Difficulty Level !! Boosts !! Effects
|-
! colspan="3" | A0 Fixture Iron
|-
|A0-1
|
* Plane 1: ATK 1%/HP 4%/SPD 1%
* Planes 2/3: ATK 1%/HP 5%/SPD 1%
|
* Enemy difficulty +1 (1)
|-
|A0-2
|
* Plane 1: ATK 2%/HP 8%/SPD 2%
* Plane 2: ATK 2%/HP 9%/SPD 2%
* Plane 3: ATK 2%/HP 11%/SPD 2%
|
* Enemy difficulty +1 (2)
|}
==Bosses==
${table("Boss !! Elite !! Normal", ["North", "South", "East", "West"].map((n) => [`Fixture ${n} Co.`, `{{Card|Fixture ${n} Boss}}`, `{{Card List|${n} Elite|delim=;}}`, `{{Card List|${n} Grunt; ${n} Scout|delim=;}}`]))}`,
  };
  const info = (name: string, cost: number) => `{{Currency Wars Character Infobox\n|name = ${name}\n|cost = ${cost}\n|field = ${field[name]}\n|role1 = DPS\n|bond1 = ${["Fx Ash", "Fx Birch", "Fx Fern", "Fx Iris"].includes(name) ? "Grove Guild" : "Fixture School"}\n}}\n{{Currency Wars Character Details\n${[1, 2, 3].map((i) => `|hp${i} = ${(i - 1) * 30}%\n|on_field${i} = ${field[name] === "Off Field" ? 100 : (90 + cost * 20) * i}\n|off_field${i} = ${field[name] === "On Field" ? 0 : (90 + cost * 20) * i}`).join("\n")}\n}}`;
  const cost = Object.fromEntries(Object.entries(costs).flatMap(([c, ns]) => ns.map((n) => [n, Number(c)])));
  await page.route("https://honkai-star-rail.fandom.com/api.php**", async (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("action") === "parse") {
      const title = u.searchParams.get("page") ?? "";
      const text = pages[title];
      return route.fulfill({ json: text === undefined ? { error: { info: `No page ${title}` } } : { parse: { title, wikitext: { "*": text } } } });
    }
    const titles = (u.searchParams.get("titles") ?? "").split("|").filter(Boolean);
    const out: Record<string, unknown> = {};
    titles.forEach((t, i) => {
      const name = t.replace(/ \(Fixture Season\)$/, "");
      out[cost[name] ? String(100 + i) : String(-1 - i)] = cost[name] ? { pageid: 100 + i, title: t, revisions: [{ slots: { main: { "*": info(name, cost[name]) } } }] } : { title: t, missing: "" };
    });
    return route.fulfill({ json: { query: { pages: out } } });
  });
}
