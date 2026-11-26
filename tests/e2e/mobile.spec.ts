import { expect, test } from "@playwright/test";
import { installGameData } from "./fixtures";

test("mobile navigation drawer and no horizontal overflow", async ({ page }) => {
  await installGameData(page);
  for (const r of ["/", "/warp", "/characters", "/relics", "/teams", "/map"]) {
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
