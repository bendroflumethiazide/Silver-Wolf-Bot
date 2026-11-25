import { expect, test } from "@playwright/test";

// Runs the real on-device AI pipeline (download → WebGPU worker → streamed reply) using software
// WebGPU. Needs internet access to huggingface.co, so it only runs when E2E_LOCAL_AI=1 (CI job).
test.skip(!process.env.E2E_LOCAL_AI, "set E2E_LOCAL_AI=1 to run");
test.setTimeout(45 * 60_000);

for (const model of (process.env.E2E_LOCAL_AI_MODELS ?? "SmolLM2-360M-Instruct-q4f32_1-MLC").split(",")) {
  test(`built-in AI chats end to end (${model})`, async ({ page }) => {
    page.on("console", (m) => { if (m.type() === "error") console.log("[page]", m.text()); });
    await page.goto("/terminal");
    await page.evaluate((m) => localStorage.setItem("silverwolf:aiModel", m), model);
    await page.reload();
    await page.getByRole("button", { name: "Chat settings" }).click();
    await expect(page.getByText("Using now: built-in AI")).toBeVisible({ timeout: 60_000 });
    // Auto mode starts the download by itself.
    await expect(page.getByText("Ready, running on this PC.")).toBeVisible({ timeout: 40 * 60_000 });
    await page.getByRole("button", { name: "Chat settings" }).click();
    await page.getByLabel("Message Silver Wolf").fill("hey, how was ur day?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("built-in AI", { exact: true }).first()).toBeVisible({ timeout: 10 * 60_000 });
    const reply = await page.locator("text=built-in AI").first().locator("xpath=ancestor::div[contains(@class,'max-w-[94%]')]").innerText();
    console.log(`REPLY (${model}):\n${reply}`);
    // Account questions still come straight from data.
    await page.getByLabel("Message Silver Wolf").fill("how many pulls can I afford");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/pulls|Stellar Jade|jade/i).last()).toBeVisible();
  });
}
