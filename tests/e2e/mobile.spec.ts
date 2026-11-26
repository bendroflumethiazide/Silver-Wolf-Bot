import { expect, test } from "@playwright/test";
import { installCwWiki, installGameData } from "./fixtures";

test("mobile navigation drawer and no horizontal overflow", async ({ page }) => {
  await installGameData(page);
  for (const r of ["/", "/warp", "/characters", "/relics", "/teams", "/map", "/guides", "/guides/view?g=relics-101", "/endgame", "/codes", "/currency-wars", "/universe", "/bosses", "/characters/view?id=1006"]) {
    await page.goto(r);
    await page.locator("main h1").first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${r}`).toBeLessThanOrEqual(1);
    const vw = page.viewportSize()!.width;
    const tooWide = await page.locator("main section").evaluateAll((els, w) => els.filter((e) => e.getBoundingClientRect().right > w + 1).length, vw);
    expect(tooWide, `panels wider than the viewport on ${r}`).toBe(0);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Warp Planner" }).click();
  await expect(page).toHaveURL(/\/warp/);
});

test("Currency Wars tabs fit a phone", async ({ page }) => {
  await installGameData(page);
  await installCwWiki(page);
  await page.goto("/currency-wars");
  await page.getByRole("button", { name: "Download Currency Wars data" }).click();
  await page.getByRole("button", { name: "Start run" }).click();
  await page.locator("section").filter({ has: page.getByRole("heading", { name: /Choose an Investment Environment/ }) }).locator("div.grid > button").first().click();
  for (const tab of ["Run simulator", "Team builder", "Equipment", "Investments"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on Currency Wars ${tab}`).toBeLessThanOrEqual(1);
  }
  // The search box sits on its own row, clear of the cost chips.
  await page.getByRole("tab", { name: "Team builder" }).click();
  const search = await page.getByLabel("Search characters").boundingBox();
  const all = await page.getByRole("button", { name: "All", exact: true }).boundingBox();
  expect(search!.y + search!.height).toBeLessThanOrEqual(all!.y);
});
