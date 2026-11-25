import { expect, test } from "@playwright/test";
import { installGameData } from "./fixtures";

test("mobile navigation drawer and no horizontal overflow", async ({ page }) => {
  await installGameData(page);
  for (const r of ["/", "/warp", "/characters", "/relics", "/teams", "/map"]) {
    await page.goto(r);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on ${r}`).toBeLessThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog", { name: "Navigation" }).getByRole("link", { name: "Warp Observatory" }).click();
  await expect(page).toHaveURL(/\/warp/);
});
