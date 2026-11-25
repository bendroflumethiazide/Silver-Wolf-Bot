import { expect, test } from "@playwright/test";
import { collectErrors, installGameData, mockGameData } from "./fixtures";

const ROUTES = ["/", "/terminal", "/account", "/characters", "/characters/1006", "/light-cones", "/relics", "/bosses", "/npcs", "/map", "/warp", "/warp?tab=planner", "/warp?tab=simulator", "/warp?tab=banners", "/teams", "/materials", "/game-modes", "/universe", "/story", "/events", "/achievements", "/journal", "/import", "/status", "/settings"];

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
  await expect(page.getByText(/game data v9\.9\.0/)).toBeVisible();
  await expect(page.getByLabel("Silver Wolf says").first()).toBeVisible();
});

test("characters: mark owned, validation, edit progress, dashboard reflects it", async ({ page }) => {
  await installGameData(page);
  await page.goto("/characters");
  await expect(page.getByText("Test Striker")).toBeVisible();
  await page.goto("/characters/1903");
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
  await page.goto("/characters/1006");
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
  await page.goto("/characters/1901");
  await expect(page.getByText("Silver Wolf rating")).toBeVisible();
  await expect(page.getByText("What this build lacks")).toBeVisible();
  await expect(page.getByText(/No Hands, Body, Feet, Planar Sphere, Link Rope equipped/)).toBeVisible();
  await expect(page.getByText(/Silver Wolf's recommended build/)).toBeVisible();
  await page.goto("/import");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Roll back" }).click();
  await expect(page.getByText("rolled back")).toBeVisible();
  await page.goto("/relics");
  await expect(page.getByText("No relics")).toBeVisible();
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
  await expect(page.getByRole("radio", { name: "Claude" })).toBeDisabled(); // no API key in tests
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
