import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:3803";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const sample = JSON.parse(await readFile("examples/plan.json", "utf8"));
async function create(plan) {
  const response = await page.request.post(`${base}/api/plans`, { data: plan });
  assert.equal(response.status(), 201, await response.text());
  const record = await response.json();
  await page.goto(`${base}/plans/${record.id}`);
  await expect(
    page.getByRole("heading", { name: plan.title, exact: true }),
  ).toBeVisible();
  return record;
}
const adjust = (name) =>
  page.getByRole("button", { name: new RegExp(`^Adjust ${name}:`) });
const close = (name) =>
  page.getByRole("button", { name: `Close ${name}`, exact: true }).click();
try {
  await mkdir("test-results", { recursive: true });
  const record = await create(sample);
  const persistence = adjust("Layout persistence");
  const storage = page.getByRole("heading", { name: "A small, durable model" });
  await expect(storage).toBeVisible();
  await persistence.click();
  const toggle = page.getByRole("switch", { name: "Layout persistence" });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(storage).toHaveCount(0);
  await expect(
    page.getByText("Reopening the project restores the default layout.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Save the current node positions", { exact: false }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "test-results/rules-disabled-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await close("Layout persistence");
  await expect(persistence).toBeFocused();
  await persistence.click();
  await page
    .getByRole("button", { name: "Reset Layout persistence", exact: true })
    .click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(storage).toBeVisible();
  // Cross-product of two decisions: layout instructions and interaction variants.
  for (const persist of [true, false]) {
    if ((await toggle.getAttribute("aria-checked")) !== String(persist))
      await toggle.click();
    await close("Layout persistence");
    await adjust("Interaction depth").click();
    const slider = page.getByRole("slider", {
      name: "Interaction depth",
      exact: true,
    });
    await slider.focus();
    const controlY = (await slider.boundingBox()).y;
    await page.keyboard.press("Home");
    for (let level = 0; level <= 5; level++) {
      await expect(slider).toBeFocused();
      await expect(slider).toHaveAttribute("aria-valuenow", String(level));
      const currentY = (await slider.boundingBox()).y;
      assert.ok(Math.abs(currentY - controlY) < 1, "Changing passage text must not move its control");
      await expect(adjust("Interaction depth")).toContainText(
        sample.parameters[1].summaries[String(level)],
      );
      if (persist) await expect(storage).toBeVisible();
      else await expect(storage).toHaveCount(0);
      if (level === 0)
        await expect(
          page.getByText(
            "Label each file so its connections can be understood without moving the graph.",
            { exact: false },
          ),
        ).toBeVisible();
      if (level < 5) await page.keyboard.press("ArrowRight");
    }
    await close("Interaction depth");
    await adjust("Layout persistence").click();
  }
  await close("Layout persistence");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  const saved = await page.request
    .get(`${base}/api/plans/${record.id}?full=true`)
    .then((r) => r.json());
  assert.equal(saved.plan.content, sample.content);
  assert.deepEqual(saved.plan.passages, sample.passages);
  assert.deepEqual(saved.original, record.original);
  const diff = await page.request
    .get(`${base}/api/plans/${record.id}`)
    .then((r) => r.json());
  assert.deepEqual(diff.changes.map((c) => c.path).sort(), [
    "/parameters/1/value",
    "/parameters/3/value",
  ]);
  await page.reload();
  await expect(persistence).toContainText("disabled");
  await expect(storage).toHaveCount(0);
  // Another session saves first: the failed save retains the current passage.
  await page.request.patch(`${base}/api/plans/${record.id}`, {
    data: { revision: saved.revision, status: "ready" },
  });
  await persistence.click();
  await toggle.click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("another session");
  await expect(storage).toBeVisible();
  // Unsaved changes must trigger the browser guard before leaving.
  page.on("dialog", (dialog) => dialog.accept());
  const choice = await create(
    JSON.parse(await readFile("examples/choice-passages.json", "utf8")),
  );
  await adjust("Delivery format").click();
  const select = page.getByRole("combobox", {
    name: "Delivery format",
    exact: true,
  });
  for (const [value, heading] of [
    ["pdf", "Print layout"],
    ["markdown", "Portability"],
    ["web", "Hosting"],
  ]) {
    await select.focus();
    await select.selectOption(value);
    await expect(select).toBeFocused();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    for (const other of ["Print layout", "Portability", "Hosting"].filter(
      (h) => h !== heading,
    ))
      await expect(page.getByRole("heading", { name: other })).toHaveCount(0);
  }
  // Reference links, nested blockquotes/lists/tables, repeated controls, and a
  // text fallback that rewrites its own surrounding paragraph on each keystroke.
  const nested = {
    title: "Nested decisions",
    content:
      '::passage{id="outer"}\n\n::passage{id="wording"}\n\n> :::when{parameter="show" equals="true"}\n> ### Nested details\n>\n> - **Notes:** [note](input:note)\n>\n> | Decision |\n> | --- |\n> | [visible][visibility] |\n> :::\n\n[visibility]: input:show',
    parameters: [
      { id: "show", label: "Show details", type: "toggle", value: true },
      { id: "note", label: "Note", type: "text", value: "start" },
    ],
    passages: [
      {
        id: "outer",
        parameter: "show",
        cases: [
          { value: true, content: '## Overview\n\n::passage{id="inner"}' },
          {
            value: false,
            content: 'A shorter introduction.\n\n::passage{id="inner"}',
          },
        ],
      },
      {
        id: "inner",
        parameter: "show",
        cases: [
          {
            value: true,
            content:
              "Keep details [visible](input:show). Read the explanation below.",
          },
          {
            value: false,
            content:
              "Keep details [hidden](input:show). The summary is enough.",
          },
        ],
      },
      {
        id: "wording",
        parameter: "note",
        cases: [
          { value: "start", content: "Initial wording: [start](input:note)." },
        ],
        fallback:
          "## Revised wording\n\nUse [the chosen text](input:note) as the new wording.\n\nThe edited wording is retained.",
      },
    ],
  };
  await create(nested);
  await adjust("Note").first().click();
  const note = page.getByRole("textbox", { name: "Note", exact: true });
  await note.focus();
  await note.press("End");
  await note.pressSequentially("ing", { delay: 30 });
  await expect(note).toBeFocused();
  await expect(note).toHaveValue("starting");
  assert.equal(await note.evaluate((n) => n.selectionStart), 8);
  await close("Note");
  await adjust("Show details").first().click();
  const show = page.getByRole("switch", { name: "Show details" });
  await show.focus();
  await page.keyboard.press("Space");
  await expect(show).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Nested details" }),
  ).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(show).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Nested details" }),
  ).toBeVisible();
  await close("Show details");
  await adjust("Note").last().click();
  await expect(note).toHaveValue("starting");
  await close("Note");
  // Hide the region containing this occurrence of the controlling input.
  // Its always-visible counterpart must receive focus, with no orphan panel.
  await adjust("Show details").last().click();
  await show.focus();
  await page.keyboard.press("Space");
  await expect(show).toHaveCount(0);
  await expect(adjust("Show details").first()).toBeFocused();
  await adjust("Show details").first().click();
  await show.click();
  await close("Show details");
  await page.setViewportSize({ width: 390, height: 844 });
  await adjust("Show details").first().click();
  await show.click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/rules-nested-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  // API validation is applied to both creates and updates, including hidden cases.
  const bad = structuredClone(nested);
  bad.passages[1].cases[1].content = '::passage{id="outer"}';
  assert.equal(
    (await page.request.post(`${base}/api/plans`, { data: bad })).status(),
    400,
  );
  assert.equal(
    (
      await page.request.patch(`${base}/api/plans/${choice.id}`, {
        data: { revision: choice.revision, plan: bad },
      })
    ).status(),
    400,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Rules passed: cross-product, variants, conditions, reset, persistence, diff integrity, conflict, choices, nested Markdown/passages, repeated controls, text cursor, API rejection, desktop/mobile.",
  );
} finally {
  await browser.close();
}
