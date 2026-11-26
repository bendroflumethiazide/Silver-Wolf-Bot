import { expect, test } from "@playwright/test";
import { collectErrors, installCwWiki, installGameData, mockGameData } from "./fixtures";

const ROUTES = ["/", "/terminal", "/account", "/characters", "/characters/view?id=1006", "/light-cones", "/relics", "/bosses", "/npcs", "/map", "/warp", "/warp?tab=planner", "/warp?tab=simulator", "/warp?tab=banners", "/teams", "/materials", "/game-modes", "/universe", "/story", "/events", "/achievements", "/journal", "/import", "/status", "/settings", "/guides", "/guides/view?g=warps", "/endgame", "/codes", "/currency-wars", "/universe"];

test("every page renders without errors, before and after game data", async ({ page }) => {
  const errors = collectErrors(page);
  await mockGameData(page);
  for (const r of ["/", "/characters", "/relics", "/materials"]) {
    await page.goto(r);
    await expect(page.locator("main h1")).toBeVisible();
  }
  await expect(page.getByText(/Ur database is empty|No game data|Zero files on disk/).first()).toBeVisible();
  await installGameData(page);
  for (const r of ROUTES) {
    await page.goto(r);
    await expect(page.locator("main h1").first(), r).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("game data download shows version and Silver Wolf comments on data", async ({ page }) => {
  await installGameData(page);
  await expect(page.getByText("v9.9.0 · en")).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/game data v9\.9\.0/i)).toBeVisible();
  await expect(page.getByLabel("Silver Wolf says").first()).toBeVisible();
});

test("characters: mark owned, validation, edit progress, dashboard reflects it", async ({ page }) => {
  await installGameData(page);
  await page.goto("/characters");
  await expect(page.getByText("Test Striker")).toBeVisible();
  await page.goto("/characters/view?id=1903");
  await page.getByRole("button", { name: "Mark owned" }).click();
  await page.getByRole("button", { name: "Edit progress" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Level").fill("75");
  await dialog.getByLabel("Ascension").fill("2");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toContainText("needs at least Ascension 6");
  await dialog.getByLabel("Ascension").fill("6");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("75/80")).toBeVisible();
  await page.goto("/characters/view?id=1006");
  await expect(page.getByText(/Oh\. me|My page/)).toBeVisible(); // Silver Wolf comments on herself
  await page.goto("/");
  await expect(page.getByText("1/5")).toBeVisible();
});

test("HSR Scanner import: preview, apply, rollback", async ({ page }) => {
  await installGameData(page);
  await page.goto("/import");
  const scan = {
    source: "HSR-Scanner", version: 4, build: "v1.6.1",
    characters: [{ id: "1901", level: 80, ascension: 6, eidolon: 1, skills: { basic: 6, skill: 10, ult: 10, talent: 10 }, traces: { ability_1: true } }],
    light_cones: [{ id: "29001", level: 80, ascension: 6, superimposition: 1, location: "1901", lock: true }],
    relics: [{ set_id: "101", slot: "Head", rarity: 5, level: 15, mainstat: "HP", substats: [{ key: "CRIT Rate_", value: 9.7 }, { key: "CRIT DMG_", value: 13 }], location: "1901", lock: true }],
  };
  await page.locator('input[type="file"]').first().setInputFiles({ name: "scan.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(scan)) });
  await expect(page.getByText(/3 new, 0 changed, 0 conflicts/)).toBeVisible();
  await page.getByRole("button", { name: "Apply import" }).click();
  await expect(page.getByText("3 written, 0 removed")).toBeVisible();
  await page.goto("/relics");
  await expect(page.locator("main li").getByText("Set of Testing")).toBeVisible();
  await page.goto("/characters/view?id=1901");
  await expect(page.getByText("Silver Wolf rating")).toBeVisible();
  await expect(page.getByText("What this build lacks")).toBeVisible();
  await expect(page.getByText(/No Hands, Body, Feet, Planar Sphere, Link Rope equipped/)).toBeVisible();
  await expect(page.getByText("Recommended build", { exact: true })).toBeVisible();
  await page.goto("/import");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Roll back" }).click();
  await expect(page.getByText("rolled back")).toBeVisible();
  await page.goto("/relics?tab=inventory");
  await expect(page.getByText("No relics")).toBeVisible();
  await page.goto("/relics");
  await expect(page.getByLabel("Search sets")).toBeVisible(); // no relics: opens on the set database
});

test("warp: tracker button, entered pity drives planner, deterministic simulator", async ({ page }) => {
  await installGameData(page);
  await page.goto("/warp");
  const tracker = page.getByRole("link", { name: /Open Warp Tracker/ }).first();
  await expect(tracker).toHaveAttribute("href", "https://starrailstation.com/en/warp#import");
  await expect(tracker).toHaveAttribute("target", "_blank");
  await page.getByRole("spinbutton", { name: "Character Event Warp pity" }).fill("70");
  await expect(page.getByText(/Pity 70|Counter's at 70/).first()).toBeVisible();
  await page.goto("/warp?tab=planner");
  await expect(page.getByLabel(/Current pity/)).toHaveValue("70");
  await page.getByLabel("Special Passes").fill("200");
  await expect(page.getByText("100.0%")).toBeVisible();
  await page.goto("/warp?tab=simulator");
  await page.getByLabel("Seed").fill("e2e-seed");
  await page.getByRole("button", { name: "×50" }).click();
  const first = await page.getByText(/Simulated pulls/).locator("..").innerText();
  await page.getByRole("button", { name: "Reset" }).click();
  await page.getByRole("button", { name: "×50" }).click();
  expect(await page.getByText(/Simulated pulls/).locator("..").innerText()).toBe(first);
  await page.goto("/import");
  await expect(page.getByRole("link", { name: /Open Warp Tracker/ })).toBeVisible();
});

test("journal persists, backup → delete → restore round-trip", async ({ page }) => {
  await installGameData(page);
  await page.goto("/journal");
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByLabel("Title").fill("Boss plan");
  await page.getByLabel("Note text").fill("Bring **Fire** units");
  await page.getByLabel("Add tag").fill("boss");
  await page.getByLabel("Add tag").press("Enter");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/^saved /)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Boss plan")).toBeVisible();
  await page.goto("/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const file = await (await download).path();
  page.once("dialog", (d) => d.accept());
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: "Delete all personal data" }).click()]);
  await page.goto("/journal");
  await expect(page.getByText("No notes yet")).toBeVisible();
  await page.goto("/settings");
  page.once("dialog", (d) => d.accept());
  await page.locator('input[type="file"]').setInputFiles(file!);
  await expect(page.getByText(/Restored \d+ records/)).toBeVisible();
  await page.goto("/journal");
  await expect(page.getByText("Boss plan")).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByText("v9.9.0 · en")).toBeVisible(); // game data survived
});

test("map: create zone, place marker, complete it", async ({ page }) => {
  await page.goto("/map");
  await page.getByRole("button", { name: "Add your first zone" }).click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Planet").fill("Testworld");
  await d.getByLabel("Region").fill("North");
  await d.getByLabel("Zone").fill("Plaza");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await d.getByLabel("Map image").setInputFiles({ name: "map.png", mimeType: "image/png", buffer: png });
  await d.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Place marker" }).click();
  const map = page.getByRole("application");
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const m = page.getByRole("dialog");
  await m.getByLabel("Name").fill("Chest A");
  await m.getByLabel("Status").selectOption("completed");
  await m.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("1/1 · 100%")).toBeVisible();
});

test("Silver Wolf full chat answers from data and admits gaps", async ({ page }) => {
  await installGameData(page);
  await page.goto("/");
  await page.getByLabel("Stellar Jade").fill("1600");
  await expect(page.getByText("Event pulls").locator("..")).toContainText("10");
  await page.goto("/terminal");
  await page.getByLabel("Message Silver Wolf").fill("how many pulls can I afford");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/10 event pulls in the bank/)).toBeVisible();
  await page.getByLabel("Message Silver Wolf").fill("how do I beat the moon boss");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/not inventing mechanics/)).toBeVisible();
  await expect(page.getByText(/Don't make a game if you don't know how to/)).toBeVisible();
  await page.getByRole("button", { name: "Chat settings" }).click();
  await expect(page.getByLabel("Her brain").locator('option[value="claude"]')).toHaveAttribute("disabled", ""); // no API key in tests
  await expect(page.getByText(/Using now: (quick replies|built-in AI)/)).toBeVisible();
  await expect(page.getByText(/Built-in AI \(Qwen3 1.7B\)/)).toBeVisible();
});

test("phone chat: floating button, small talk, family settings, history persists", async ({ page }) => {
  await installGameData(page);
  await page.goto("/characters");
  await page.getByRole("button", { name: /Text Silver Wolf/ }).click();
  const phone = page.getByRole("dialog", { name: "Phone chat with Silver Wolf" });
  await expect(phone).toBeVisible();
  await expect(phone.getByText("Silver Wolf").first()).toBeVisible();
  await phone.getByRole("button", { name: "Chat settings" }).click();
  await phone.getByLabel("She calls you").fill("Dad");
  await phone.locator("select").first().selectOption("daughter");
  await phone.getByRole("button", { name: "Chat settings" }).click();
  await phone.getByLabel("Message Silver Wolf").fill("love you");
  await phone.getByLabel("Message Silver Wolf").press("Enter");
  await expect(phone.getByText(/Love u (too Dad|more)/)).toBeVisible();
  await phone.getByRole("button", { name: "What should I do today?" }).click();
  await expect(phone.getByText(/Ok here's the plan|Nothing urgent/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(phone).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: /Text Silver Wolf/ }).click();
  await expect(page.getByRole("dialog", { name: "Phone chat with Silver Wolf" }).getByText("love you")).toBeVisible();
  await page.goto("/terminal");
  await expect(page.getByText("love you")).toBeVisible(); // same history as the phone
  await expect(page.getByRole("button", { name: /Text Silver Wolf/ })).toHaveCount(0);
});

test("new hubs: guides, endgame, codes, Currency Wars and the SU run simulator", async ({ page }) => {
  const errors = collectErrors(page);
  await installGameData(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await page.locator("main").getByRole("link", { name: /Guides Beginner to endgame/ }).click();
  await page.getByRole("link", { name: /How Warps work/ }).click();
  await expect(page.getByText(/guaranteed by pull/).first()).toBeVisible();

  await page.goto("/endgame");
  for (const m of ["Memory of Chaos", "Pure Fiction", "Apocalyptic Shadow", "Anomaly Arbitration"]) await expect(page.getByRole("heading", { name: m })).toBeVisible();

  await page.goto("/codes");
  await page.getByLabel("Code", { exact: true }).fill("silver-wolf 2026");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("SILVERWOLF2026")).toBeVisible();
  await expect(page.getByRole("link", { name: "Redeem" })).toHaveAttribute("href", "https://hsr.hoyoverse.com/gift?code=SILVERWOLF2026");
  await page.getByRole("button", { name: "Mark redeemed" }).click();
  await expect(page.getByText("redeemed", { exact: true })).toBeVisible();

  await page.goto("/currency-wars");
  await expect(page.getByRole("button", { name: "Download Currency Wars data" })).toBeVisible();

  await page.goto("/universe");
  await page.getByRole("button", { name: /Erudition/ }).click();
  await expect(page.getByText("Where next?")).toBeVisible();
  // Domain choices are random: take whichever is offered first.
  await page.getByRole("button", { name: /^(Combat|Elite|Occurrence|Respite)/ }).first().click();
  await expect(page.getByText(/Domain [12] of 13|Choose a blessing|Enhance a blessing|Where next/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("Currency Wars: download, play a run, browse items", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installGameData(page);
  await installCwWiki(page);
  await page.goto("/currency-wars");
  await page.getByRole("button", { name: "Download Currency Wars data" }).click();
  // A fixed seed: its Voyage Companion (Mummicat, synthesis refund) doesn't change the first nodes.
  await page.getByRole("textbox", { name: "Seed" }).fill("e2e-base");
  await page.getByRole("button", { name: "Start run" }).click();
  await page.getByRole("button", { name: "Let's go" }).click();
  const cards = (title: RegExp) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) }).locator("div.grid > button");
  // Labor Dispatch-style environment: the emblem must show up in Items (bug fix).
  await cards(/Choose an Investment Environment/).filter({ hasText: "Fixture Dispatch" }).click();
  await expect(page.getByText(/\d+\/\d+ deployed/)).toBeVisible();
  await expect(page.getByText(/Plane 1/).first()).toBeVisible();
  const emblem = page.getByRole("button", { name: "Grove Guild Emblem" });
  await expect(emblem).toBeVisible();
  // Item details: what it does and what it's made from.
  await emblem.click();
  const details = page.getByRole("region", { name: "Grove Guild Emblem details" });
  await expect(details.getByText(/Grants the wearer the "Grove Guild" Bond/)).toBeVisible();
  await expect(details.getByText(/Made from: Red Gem \+ Folding Knife/)).toBeVisible();
  await details.getByRole("button", { name: "Close item details" }).click();
  // Battle viewer: HP bars, elapsed time, speed, skip.
  await page.getByRole("button", { name: "Battle", exact: true }).click();
  await expect(page.getByText(/Elapsed/)).toBeVisible();
  await expect(page.getByText("Your squad")).toBeVisible();
  // Turn order with Action Value, which can be hidden.
  const order = page.getByLabel("Turn order");
  await expect(order.getByText(/Cycle/)).toBeVisible();
  await expect(order.locator("li").first()).toBeVisible();
  await page.getByRole("button", { name: "AV", exact: true }).click();
  await expect(page.getByRole("button", { name: "AV", exact: true })).toHaveAttribute("aria-pressed", "false");
  // Bond summons fight too: the DoT Bond's Crimson Thorns is in the squad and on the turn order.
  await expect(page.getByRole("list", { name: "Summons" }).getByText("Crimson Thorns")).toBeVisible();
  await expect(order.locator("li[title^='Crimson Thorns']").first()).toBeVisible();
  await page.getByRole("radio", { name: "4×" }).click();
  await expect(page.getByRole("radio", { name: "4×" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText("All enemies defeated")).toBeVisible();
  await page.getByRole("button", { name: /See results/ }).click();
  await expect(page.getByRole("heading", { name: "Reward node cleared" })).toBeVisible();
  // Reward nodes drop Crystal Ores: tap one to open it.
  const ore = page.getByRole("button", { name: /Crystal Ore$/ }).first();
  await expect(ore).toBeVisible();
  const oresBefore = await page.getByRole("button", { name: /Crystal Ore$/ }).count();
  await ore.click();
  await expect(page.getByRole("status")).toContainText(/Opened .* Crystal Ore/);
  expect(await page.getByRole("button", { name: /Crystal Ore$/ }).count()).toBe(oresBefore - 1);
  await page.getByRole("button", { name: /Next node/ }).click();
  // Buy XP spends 4 gold; Lock toggles.
  const gold = async () => Number((await page.getByText(/\d+ gold$/).first().innerText()).match(/\d+/)![0]);
  const before = await gold();
  await page.getByRole("button", { name: /Buy XP/ }).click();
  expect(await gold()).toBe(before - 4);
  await page.getByRole("button", { name: "Lock shop" }).click();
  await expect(page.getByRole("button", { name: /^Locked/ })).toBeVisible();
  // Character details: stats like the game's Stats Details, and abilities by star.
  await page.getByRole("button", { name: /^(On|Off)-Field slot \d: / }).first().click();
  // Recommended equipment on the selected character (like the game's card).
  await expect(page.getByLabel(/recommended equipment$/).first().getByText("Fixture Blade")).toBeVisible();
  await page.getByRole("button", { name: "Details" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Stats Details")).toBeVisible();
  // …and in the sheet, with its recipe; tapping it opens the item's details.
  await expect(sheet.getByText("Recommended equipment")).toBeVisible();
  await expect(sheet.getByText("Folding Knife + Roller Skates").first()).toBeVisible();
  await sheet.getByRole("button", { name: /Fixture Blade/ }).first().click();
  await expect(sheet.getByRole("region", { name: "Fixture Blade details" }).getByText("Hits harder.")).toBeVisible();
  await expect(sheet.getByText("Base Lucky Strike Rate")).toBeVisible();
  await expect(sheet.getByText("Base Healing Strength")).toBeVisible();
  await expect(sheet.getByRole("tab", { name: "On Field" })).toBeVisible();
  await sheet.getByRole("tab", { name: "Off Field" }).click();
  await expect(sheet.getByText(/Support$/).first()).toBeVisible();
  await sheet.getByRole("radio", { name: "3★" }).click();
  await expect(sheet.locator("span.text-cyan", { hasText: "30%" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Equipment Tracking: by default everyone deployed; "Track gear" picks characters.
  await expect(page.getByText(/everyone deployed/)).toBeVisible();
  await page.getByRole("button", { name: "Track gear" }).click();
  await expect(page.getByRole("button", { name: /^Stop tracking .*'s gear$/ })).toBeVisible();
  await expect(page.getByText(/everyone deployed/)).toHaveCount(0);
  // The unit is still selected after closing the details: send it to the bench.
  await page.getByRole("button", { name: "To bench" }).click();
  await expect(page.getByRole("button", { name: /^Bench slot \d: / }).first()).toBeVisible();
  // Simple Mode hides explanations (and is remembered).
  await expect(page.getByText("How this simulator works").first()).toBeVisible();
  await page.getByRole("switch", { name: "Simple Mode" }).click();
  await expect(page.getByRole("switch", { name: "Simple Mode" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("How this simulator works")).toHaveCount(0);
  await page.getByRole("switch", { name: "Simple Mode" }).click();
  await expect(page.getByText("How this simulator works").first()).toBeVisible();
  // The run survives a reload (give IndexedDB a moment to commit the last write).
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole("button", { name: /^Bench slot \d: / }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Equipment" }).click();
  await page.getByRole("button", { name: "Folding Knife + Roller Skates: Fixture Blade" }).first().click();
  await expect(page.getByText("Hits harder.")).toBeVisible();
  await page.getByRole("tab", { name: "Investments" }).click();
  await expect(page.getByText("Fixture Armory")).toBeVisible();
  await page.getByRole("button", { name: "Prismatic", exact: true }).click();
  await expect(page.getByText("Gold Plan A")).toHaveCount(0);
  await page.getByRole("tab", { name: "Team builder" }).click();
  // Bond Tracking: characters with a tracked Bond get a thumbs-up.
  await expect(page.getByRole("img", { name: /Tracked bond/ })).toHaveCount(0);
  await page.getByLabel("Track a bond").selectOption("Grove Guild");
  await expect(page.getByRole("button", { name: "Stop tracking Grove Guild" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fx Iris" }).first().getByRole("img", { name: "Tracked bond: Grove Guild" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fx Dune" }).getByRole("img", { name: /Tracked bond/ })).toHaveCount(0);
  await page.getByLabel("Search characters").fill("Fx Iris");
  await page.getByRole("button", { name: /Fx Iris/ }).first().click();
  await expect(page.getByText("Off-Field (1)")).toBeVisible();
  // Opening a Bond shows its members as little portraits.
  await page.getByRole("button", { name: /Grove Guild/ }).first().click();
  const members = page.getByRole("list", { name: "Grove Guild members" });
  await expect(members.getByRole("listitem")).toHaveCount(4);
  await expect(members.getByText("Fx Ash")).toBeVisible();
  await page.goto("/guides/view?g=currency-wars");
  await expect(page.getByRole("heading", { name: /Every mechanic/ })).toBeVisible();
  await page.goto("/guides/view?g=crystal-ores");
  await expect(page.getByRole("heading", { name: /Every Crystal Ore/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Currency Wars 4.7: Voyage Companion, Trailblaze Store and Plot Armor in a real run", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installGameData(page);
  await installCwWiki(page);
  await page.goto("/currency-wars");
  await page.getByRole("button", { name: "Download Currency Wars data" }).click();
  // The collection is empty before any run.
  await expect(page.getByText(/Companions met 0\/11/)).toBeVisible();
  await page.getByRole("textbox", { name: "Seed" }).fill("e2e47");
  await page.getByRole("button", { name: "Start run" }).click();
  // Escapade: the companion is revealed with an animation, once.
  const reveal = page.getByRole("dialog", { name: "Your Voyage Companion" });
  await expect(reveal.getByText("Escapade · Voyage Companion")).toBeVisible();
  const companion = (await reveal.getByRole("heading").innerText()).trim();
  await reveal.getByRole("button", { name: "Let's go" }).click();
  await expect(reveal).toHaveCount(0);
  const card = page.locator("section").filter({ has: page.getByRole("heading", { name: "Voyage Companion" }) });
  await expect(card.getByText(companion, { exact: true })).toBeVisible();
  const cards = (title: RegExp) => page.locator("section").filter({ has: page.getByRole("heading", { name: title }) }).locator("div.grid > button");
  await cards(/Choose an Investment Environment/).first().click();

  // Trailblaze Store: the starters are Trailblaze Silver Rail members, so it's open; the Express costs 0 TP.
  const store = page.locator("section").filter({ has: page.getByRole("heading", { name: "Trailblaze Store" }) });
  await expect(store.getByText(/\+20 TP after each combat|\+45 TP after each combat/)).toBeVisible();
  await store.getByRole("button", { name: /^Buy Astral Express, warp! for 0/ }).click();
  await expect(store.getByText("Express:")).toContainText("Astral Express, warp!");

  // Play nodes until the Plot Armor selection (before the First Plane boss).
  const plot = page.getByRole("heading", { name: /Plot Armor · Protagonist 1 of 2/ });
  let fights = 0;
  for (let i = 0; i < 40 && !(await plot.isVisible()); i++) {
    if (await page.getByRole("heading", { name: /Backstage Tea Break|Pearliefin's Treasury/ }).isVisible()) { await cards(/Backstage Tea Break|Pearliefin's Treasury/).first().click(); continue; }
    if (await page.getByRole("heading", { name: /Choose an Investment Strategy/ }).isVisible()) { await cards(/Choose an Investment Strategy/).first().click(); continue; }
    if (await page.getByRole("heading", { name: /^Supply/ }).isVisible()) { await page.getByRole("button", { name: "Skip" }).click(); continue; }
    if (await page.getByRole("heading", { name: /Encounter: pick a fight/ }).isVisible()) { await cards(/Encounter: pick a fight/).first().click(); continue; }
    if (await page.getByRole("button", { name: /Next node/ }).isVisible()) { await page.getByRole("button", { name: /Next node/ }).click(); continue; }
    await page.getByRole("button", { name: "Battle", exact: true }).click();
    fights++;
    await page.getByRole("button", { name: "Skip" }).click();
    await page.getByRole("button", { name: /See results/ }).click();
  }
  expect(fights).toBeGreaterThan(2);
  await expect(plot).toBeVisible();
  // TP came in after the fights (HUD counter).
  await expect(page.getByTitle("Trailblaze Power", { exact: true })).not.toHaveText(/^\s*0 TP/);
  // Pick a deployed character, see two options, refresh for 1 gold, choose.
  await page.getByRole("button", { name: /^Make .* the protagonist$/ }).first().click();
  const panel = page.locator("section").filter({ has: plot });
  const options = panel.locator("div.grid > button");
  await expect(options).toHaveCount(2);
  const gold = async () => Number((await page.getByText(/\d+ gold$/).first().innerText()).match(/\d+/)![0]);
  const before = await gold();
  await panel.getByRole("button", { name: /Refresh/ }).click();
  expect(await gold()).toBe(before - 1);
  await expect(panel.getByText(/Refreshed 1×/)).toBeVisible();
  await options.first().click();
  await expect(plot).toHaveCount(0);
  const status = page.locator("section").filter({ has: page.getByRole("heading", { name: "Plot Armor", exact: true }) });
  await expect(status.getByText(/Protagonist, Plane 1/)).toBeVisible();
  await expect(page.getByLabel("Plot Armor").first()).toBeVisible();
  await expect(status.getByText(/Plot Armor refresh for 1 gold/)).toBeHidden();
  await status.getByText(/History/).click();
  await expect(status.getByText(/Plot Armor refresh for 1 gold/)).toBeVisible();

  // Everything survives a reload; the reveal doesn't replay.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByText(/Protagonist, Plane 1/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Your Voyage Companion" })).toHaveCount(0);
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Trailblaze Store" }) }).getByText("Express:")).toContainText("Astral Express, warp!");

  // The collection remembers the companion after the run ends.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Abandon" }).click();
  await expect(page.getByText(/Companions met 1\/11/)).toBeVisible();
  expect(errors).toEqual([]);
});
