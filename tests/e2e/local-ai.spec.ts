import { expect, test } from "@playwright/test";

// Runs the real on-device AI pipeline (download → WebGPU worker → streamed reply) using software
// WebGPU. Needs internet access to huggingface.co, so it only runs when E2E_LOCAL_AI=1 (CI job).
test.skip(!process.env.E2E_LOCAL_AI, "set E2E_LOCAL_AI=1 to run");
test.setTimeout(45 * 60_000);

for (const model of (process.env.E2E_LOCAL_AI_MODELS ?? "SmolLM2-360M-Instruct-q4f32_1-MLC").split(",")) {
  test(`built-in AI chats end to end (${model})`, async ({ page }) => {
    page.on("console", (m) => { if (m.type() !== "debug") console.log(`[page ${m.type()}]`, m.text().slice(0, 400)); });
    page.on("worker", (w) => console.log("[worker started]", w.url()));
    page.on("pageerror", (e) => console.log("[pageerror]", e.message));
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
    const thread = page.locator('[aria-live="polite"]');
    const t0 = Date.now();
    let reply = "";
    for (;;) {
      const badge = await page.getByText("built-in AI", { exact: true }).count();
      const text = (await thread.innerText()).replace(/\s+\n/g, "\n");
      const tail = text.slice(text.lastIndexOf("hey, how was ur day?"));
      if (badge || /glitched|crashed|booting/.test(tail)) { reply = tail; break; }
      if (Date.now() - t0 > 20 * 60_000) { reply = tail; break; }
      console.log(`[${Math.round((Date.now() - t0) / 1000)}s] waiting… ${tail.slice(0, 300).replace(/\n/g, " / ")}`);
      await page.waitForTimeout(30_000);
    }
    console.log(`REPLY (${model}) after ${Math.round((Date.now() - t0) / 1000)}s:\n${reply}`);
    expect(await page.getByText("built-in AI", { exact: true }).count(), reply).toBeGreaterThan(0);
    // Account questions still come straight from data.
    await page.getByLabel("Message Silver Wolf").fill("how many pulls can I afford");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText(/pulls|Stellar Jade|jade/i).last()).toBeVisible();
  });
}
