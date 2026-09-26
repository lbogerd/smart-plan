import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3802";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const proposal = JSON.parse(
    await readFile("examples/inputs-plan.json", "utf8"),
  );
  const response = await page.request.post(`${base}/api/plans`, {
    data: proposal,
  });
  assert.equal(response.status(), 201);
  const record = await response.json();
  await page.goto(`${base}/plans/${record.id}`);
  const open = (label) =>
    page.getByRole("button", { name: new RegExp(`^Adjust ${label}:`) }).click();
  await open("text");
  await page
    .getByRole("textbox", { name: "text", exact: true })
    .fill("Updated");
  await open("number");
  await page.getByRole("spinbutton", { name: "number", exact: true }).fill("");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Numeric value must be within its bounds",
  );
  await page.getByRole("spinbutton", { name: "number", exact: true }).fill("4");
  await open("multi-select");
  const group = page.getByRole("group", { name: "multi-select", exact: true });
  await group.getByRole("checkbox", { name: "B", exact: true }).click();
  await open("radio");
  await page
    .getByRole("radiogroup", { name: "radio", exact: true })
    .getByRole("radio", { name: "B", exact: true })
    .click();
  await open("choice-cards");
  await page
    .getByRole("radiogroup", { name: "choice-cards", exact: true })
    .getByRole("radio", { name: "B Option B description" })
    .click();
  await open("list");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("list item 2", { exact: true }).fill("Second item");
  await page
    .getByRole("button", { name: "Move list item 2 up", exact: true })
    .click();
  await open("ranking");
  await page
    .getByRole("button", { name: "Move ranking item 2 up", exact: true })
    .click();
  await open("range");
  await page
    .getByRole("slider", { name: "range minimum", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await open("date");
  await page.getByLabel("date", { exact: true }).fill("2026-10-01");
  await open("date-range");
  await page.getByLabel("date-range start", { exact: true }).fill("2026-10-01");
  await page.getByLabel("date-range end", { exact: true }).fill("2026-10-10");
  await open("url");
  await page
    .getByLabel("url", { exact: true })
    .fill("https://example.com/reference");
  await open("file");
  await page.getByLabel("file", { exact: true }).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Sample notes"),
  });
  await expect(
    page.getByRole("button", { name: "Download notes.txt", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download notes.txt", exact: true })
    .click();
  assert.equal((await downloadPromise).suggestedFilename(), "notes.txt");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const saved = await page.request
    .get(`${base}/api/plans/${record.id}?full=true`)
    .then((r) => r.json());
  const values = Object.fromEntries(
    saved.plan.parameters.map((p) => [p.id, p.value]),
  );
  assert.equal(values.text, "Updated");
  assert.equal(values.number, 4);
  assert.deepEqual(values["multi-select"], ["A", "B"]);
  assert.equal(values.radio, "B");
  assert.equal(values["choice-cards"], "B");
  assert.deepEqual(values.list, ["Second item", "First item"]);
  assert.deepEqual(values.ranking, ["B", "A", "C"]);
  assert.deepEqual(values.range, [2, 4]);
  assert.equal(values.date, "2026-10-01");
  assert.deepEqual(values["date-range"], {
    start: "2026-10-01",
    end: "2026-10-10",
  });
  assert.equal(values.url, "https://example.com/reference");
  assert.equal(
    Buffer.from(values.file[0].data, "base64").toString(),
    "Sample notes",
  );
  assert.deepEqual(saved.original.parameters, record.original.parameters);
  await page.reload();
  await open("file");
  await expect(
    page.getByRole("button", { name: "Download notes.txt", exact: true }),
  ).toBeVisible();
  await open("ranking");
  await page
    .getByRole("button", { name: "Reset ranking", exact: true })
    .click();
  await open("file");
  await page.getByRole("button", { name: "Reset file", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Download notes.txt", exact: true }),
  ).toHaveCount(0);
  await open("url");
  await page.getByLabel("url", { exact: true }).fill("bad URL");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "URL must use http or https",
  );
  await page.getByLabel("url", { exact: true }).fill("https://example.com");
  await open("list");
  await page
    .getByRole("button", { name: "Remove list item 2", exact: true })
    .click();
  await open("file");
  await page.getByLabel("file", { exact: true }).setInputFiles({
    name: "large.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(256 * 1024 + 1),
  });
  await expect(page.getByText("large.bin exceeds 256 KiB.")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/inputs-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Input controls: edits, ordering, upload/download, save/reload, reset, validation and mobile layout passed.",
  );
} finally {
  await browser.close();
}
