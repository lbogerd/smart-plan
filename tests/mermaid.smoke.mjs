import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.BASE_URL || "https://smart-plan.tainer.run";
const sample = JSON.parse(
  await readFile(
    new URL("../examples/mermaid-plan.json", import.meta.url),
    "utf8",
  ),
);
const response = await fetch(`${base}/api/plans`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(sample),
});
assert.equal(response.status, 201);
const record = await response.json();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(record.editorUrl);
  const cards = page.locator(".mermaid-card");
  await expect(page.locator(".diagram-svg svg")).toHaveCount(3, {
    timeout: 30000,
  });
  console.log("Three diagrams rendered");
  await expect(
    page.locator("pre").filter({ hasText: '{"status":"ready"}' }),
  ).toBeVisible();
  const first = cards.first();
  await first.getByRole("button", { name: "Copy source", exact: true }).click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /flowchart LR/,
  );
  for (const format of ["SVG", "PNG"]) {
    const downloaded = page.waitForEvent("download");
    await first.getByRole("button", { name: format, exact: true }).click();
    const download = await downloaded;
    const bytes = await readFile(await download.path());
    if (format === "PNG")
      assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    else assert.match(bytes.toString(), /<svg/);
    console.log(format, "downloaded", bytes.length, "bytes");
  }
  await first.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Zoom in", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset view", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await first.getByRole("button", { name: "Edit source", exact: true }).click();
  await first
    .getByRole("textbox", { name: "Mermaid source" })
    .fill("this is not a valid diagram");
  await expect(first.getByRole("alert")).toBeVisible();
  await first
    .getByRole("textbox", { name: "Mermaid source" })
    .fill("flowchart LR\n  A[Edited idea] --> B[Build]");
  await expect(first.locator(".diagram-svg svg")).toHaveCount(1);
  await first
    .getByRole("button", { name: "Apply to plan", exact: true })
    .click();
  await expect(page.locator(".review-summary")).toContainText("1 change from");
  await expect(
    page.getByText("Plan content changed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your adjustments are saved." })
    .waitFor();
  const saved = await fetch(`${base}/api/plans/${record.id}?full=true`).then(
    (r) => r.json(),
  );
  assert.match(saved.plan.content, /Edited idea/);
  assert.match(saved.plan.content, /sequenceDiagram/);
  assert.deepEqual(saved.plan.diagrams, sample.diagrams);
  assert.equal(saved.original.content, sample.content);
  await page.reload();
  await expect(page.locator(".diagram-svg svg")).toHaveCount(3);
  const structured = cards.last();
  await structured
    .getByRole("button", { name: "Edit source", exact: true })
    .click();
  await structured
    .getByRole("textbox", { name: "Mermaid source" })
    .fill("stateDiagram-v2\n  [*] --> Ready");
  await structured
    .getByRole("button", { name: "Apply to plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your adjustments are saved." })
    .waitFor();
  const updated = await fetch(`${base}/api/plans/${record.id}?full=true`).then(
    (r) => r.json(),
  );
  assert.deepEqual(updated.plan.diagrams[0].customMetadata, { keep: true });
  assert.match(updated.plan.diagrams[0].source, /\[\*\] --> Ready/);
  await expect(page.locator(".diagram-svg svg")).toHaveCount(3);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/mermaid-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mermaid-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, url: record.editorUrl }));
} finally {
  await browser.close();
}
