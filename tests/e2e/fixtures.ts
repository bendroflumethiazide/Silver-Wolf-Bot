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
    simulated_blessings: { "1": { id: "1", name: "Test Blessing", desc: "Bless.", enhanced_desc: "" } },
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
