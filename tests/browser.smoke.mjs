import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3802";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await mkdir("test-results", { recursive: true });
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Plans", exact: true }),
  ).toBeVisible();
  await page.locator("main a[href^='/plans/']").first().waitFor();
  await page
    .getByLabel("Upload Markdown or JSON")
    .setInputFiles("examples/plan.json");
  await page.waitForURL("**/plans/*");
  await expect(
    page.getByRole("heading", { name: "Interactive project map", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const id = new URL(page.url()).pathname.split("/").at(-1);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/reader-desktop-closed.png",
    fullPage: true,
  });
  const testing = page.getByRole("button", { name: /^Adjust Testing effort:/ });
  await testing.focus();
  await page.keyboard.press("Enter");
  const slider = page.getByRole("slider", {
    name: "Testing effort",
    exact: true,
  });
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await page.screenshot({
    path: "test-results/reader-desktop-open.png",
    fullPage: true,
  });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(testing).toContainText("core integration tests");
  await page
    .getByRole("button", { name: "Reset Testing effort", exact: true })
    .click();
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(slider).toHaveCount(0);
  await expect(testing).toBeFocused();
  await page.getByRole("button", { name: /^Adjust Graph library:/ }).click();
  await page
    .getByLabel("Graph library", { exact: true })
    .selectOption("Cytoscape.js");
  await page
    .getByRole("button", { name: /^Adjust Layout persistence:/ })
    .click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("switch", { name: "Layout persistence" }).click();
  await page.getByRole("button", { name: /^Adjust Constraints:/ }).click();
  await page
    .getByLabel("Constraints", { exact: true })
    .fill("Keep the first release small.");
  await page.getByRole("button", { name: "Close Constraints" }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await page.getByRole("button", { name: "Mark ready", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Ready");
  const saved = await page.request
    .get(`${base}/api/plans/${id}?full=true`)
    .then((r) => r.json());
  assert.equal(saved.status, "ready");
  assert.equal(saved.revision, 3);
  assert.equal(saved.plan.parameters[2].value, 2);
  assert.equal(saved.plan.parameters[0].value, "Cytoscape.js");
  assert.equal(saved.plan.parameters[3].value, false);
  assert.equal(saved.original.parameters[2].value, 1);
  assert.equal(saved.plan.content, saved.original.content);
  await page.reload();
  await expect(testing).toContainText("core integration tests");
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ready", exact: true }),
  ).toBeDisabled();
  // Real revision conflict: edits stay in the browser and the other writer wins.
  await page.request.patch(`${base}/api/plans/${id}`, {
    data: { revision: 3, status: "draft" },
  });
  await testing.click();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("another session");
  await expect(testing).toContainText("workflow tests");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/reader-mobile-open.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Close Testing effort" }).click();
  await expect(testing).toBeFocused();
  await page.screenshot({
    path: "test-results/reader-mobile-closed.png",
    fullPage: true,
  });
  // Markdown files produce a plain document, with no parameter controls.
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(base);
  await page.locator("main a[href^='/plans/']").first().waitFor();
  await page.getByLabel("Upload Markdown or JSON").setInputFiles({
    name: "plain.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# A quiet document\n\n## Overview\n\nJust **read** this plan.\n\n- First step\n- Second step",
    ),
  });
  await page.waitForURL("**/plans/*");
  await expect(
    page.getByRole("heading", { name: "A quiet document" }),
  ).toBeVisible();
  await expect(page.locator(".inline-value")).toHaveCount(0);
  await expect(page.locator("article strong")).toHaveText("read");
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByRole("status")).toHaveText("Ready");
  await page.goto(`${base}/api-docs`);
  await expect(page.getByRole("heading", { name: "Plan API" })).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(
    errors.filter((e) => !e.includes("status of 409")),
    [],
  );
  console.log(
    "Reader passed: import, reading, keyboard disclosures, reset, select, switch, notes, save, ready, reload, conflict, mobile, plain Markdown, docs.",
  );
} finally {
  await browser.close();
}
