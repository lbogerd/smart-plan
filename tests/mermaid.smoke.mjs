import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3802";
const sample = JSON.parse(await readFile("examples/mermaid-plan.json", "utf8"));
sample.content +=
  "\n\n```mermaid\nnot a diagram\n```\n\n```mermaid\nflowchart LR\n A[Safe] --> B[Graph]\n```";
const response = await fetch(`${base}/api/plans`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(sample),
});
assert.equal(response.status, 201);
const record = await response.json();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${base}/plans/${record.id}`);
  await expect(page.locator("figure > [role=img] svg")).toHaveCount(2, {
    timeout: 30000,
  });
  await expect(page.getByRole("alert")).toHaveText("Diagram unavailable.");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Expand diagram" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Diagrams passed: render, invalid source isolation, fullscreen, keyboard close, mobile, no editor.",
  );
} finally {
  await browser.close();
}
