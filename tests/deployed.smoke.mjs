// Read-only verification of the deployed site. No live plans are changed.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.BASE_URL || "https://smart-plan.tainer.run";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  assert.equal((await page.request.get(`${base}/health`)).status(), 200);
  await page.goto(base);
  const summaries = await page.request
    .get(`${base}/api/plans`)
    .then((r) => r.json());
  const seed = summaries.find((p) => p.isExample);
  assert.ok(seed?.planUrl);
  await page.goto(seed.planUrl);
  await expect(
    page.getByRole("heading", { name: "Interactive project map", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  assert.ok(
    await page.evaluate(() => document.fonts.check('18px "Inter Variable"')),
  );
  await expect(page.getByRole("slider")).toHaveCount(0);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/deployed-desktop-closed.png",
    fullPage: true,
    animations: "disabled",
  });
  const trigger = page.getByRole("button", { name: /^Adjust Testing effort:/ });
  await trigger.click();
  await expect(
    page.getByRole("slider", { name: "Testing effort", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/deployed-desktop-open.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Close Testing effort", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/deployed-mobile-closed.png",
    fullPage: true,
    animations: "disabled",
  });
  await trigger.click();
  await page.screenshot({
    path: "test-results/deployed-mobile-open.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close Testing effort", exact: true })
    .click();
  const persistence = page.getByRole("button", {
    name: /^Adjust Layout persistence:/,
  });
  await persistence.click();
  const toggle = page.getByRole("switch", { name: "Layout persistence" });
  const initialPersistence = await toggle.getAttribute("aria-checked");
  for (const enabled of [true, false]) {
    if ((await toggle.getAttribute("aria-checked")) !== String(enabled))
      await toggle.click();
    if (enabled) {
      await expect(
        page.getByRole("heading", { name: "A small, durable model" }),
      ).toBeVisible();
      await expect(
        page.getByText("Save the current node positions", { exact: false }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: "A small, durable model" }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Reopening the project restores the default layout.", {
          exact: false,
        }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `test-results/deployed-persistence-${enabled ? "enabled" : "disabled"}-mobile.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.screenshot({
      path: `test-results/deployed-persistence-${enabled ? "enabled" : "disabled"}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  if ((await toggle.getAttribute("aria-checked")) !== initialPersistence)
    await toggle.click();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toHaveCount(0);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      url: seed.planUrl,
      checks:
        "HTTPS health, library, Markdown, local font, closed/open disclosures, passage switching, conditional storage section, mobile layout, no browser errors; no writes",
    }),
  );
} finally {
  await browser.close();
}
