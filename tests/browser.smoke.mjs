import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.BASE_URL || "https://smart-plan.tainer.run";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(base);
  await page.locator(".plan-list").waitFor();
  const summaries = await page.request
    .get(`${base}/api/plans`)
    .then((r) => r.json());
  const seed = summaries.find((p) => p.isExample);
  const proposal = await page.request
    .get(`${base}/api/plans/${seed.id}?full=true`)
    .then((r) => r.json());
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Plan JSON").fill(JSON.stringify(proposal.original));
  await page.getByRole("button", { name: "Import plan", exact: true }).click();
  await page.waitForURL("**/plans/*");
  await page
    .getByRole("heading", { name: "A calmer project planner" })
    .waitFor();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  const slider = page.getByRole("slider", {
    name: "Testing effort",
    exact: true,
  });
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "The smallest useful workflow" }),
  ).toBeVisible();
  await expect(page.locator(".review-summary")).toContainText("0 changes");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", { name: "Reset Testing effort", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reset Testing effort", exact: true })
    .click();
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  await expect(page.locator(".review-summary")).toContainText("0 changes");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  const featureSlider = page.getByRole("slider", {
    name: "Parameter editor strength",
    exact: true,
  });
  await featureSlider.focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".feature-excluded")).toContainText("Excluded");
  await page
    .getByRole("button", {
      name: "Reset Parameter editor strength",
      exact: true,
    })
    .click();
  await expect(page.locator(".feature-excluded")).toHaveCount(0);
  await page.getByLabel("Implementation approach").selectOption("Balanced");
  await page.getByLabel("Save between visits").click();
  await page
    .getByLabel("Build constraints")
    .fill("Use libraries. Keep the test suite small.");
  await page
    .getByLabel("Comments for Parameter editor")
    .fill("Simple controls are enough.");
  await page.getByRole("button", { name: "Add feature", exact: true }).click();
  await page.getByLabel("Feature name").fill("Markdown export");
  await page
    .getByLabel("What should it do?")
    .fill("Download the adjusted scope.");
  await page
    .locator("form")
    .getByRole("button", { name: "Add feature", exact: true })
    .click();
  await page
    .getByLabel("A note for your agent")
    .fill("Build only what helps prove the concept.");
  await page
    .getByRole("button", { name: "Ready for agent", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Ready for your agent." })
    .waitFor();
  const response = await page.request.get(`${base}/api/plans/${id}?full=true`);
  const record = await response.json();
  assert.equal(record.status, "ready");
  assert.equal(record.revision, 2);
  assert.equal(record.plan.parameters[0].value, 2);
  assert.equal(record.plan.parameters[1].value, "Balanced");
  assert.equal(record.plan.parameters[3].value, false);
  assert.equal(record.plan.features.length, 4);
  assert.equal(record.plan.features[0].comments, "Simple controls are enough.");
  assert.equal(record.original.parameters[0].value, 1);
  await page.reload();
  await page
    .getByRole("heading", { name: "A calmer project planner" })
    .waitFor();
  assert.equal(
    await page.getByLabel("A note for your agent").inputValue(),
    record.plan.comments,
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("heading", { name: "The smallest useful workflow" })
    .waitFor();
  await page.getByText("Plan JSON", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Plan JSON", { exact: true }).click();
  await page.getByLabel("A note for your agent").focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => {
      const focused = document.activeElement.getBoundingClientRect();
      return (
        focused.bottom <=
        document.querySelector(".save-bar").getBoundingClientRect().top
      );
    }),
    true,
  );
  await page.screenshot({
    path: "test-results/editor-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const conflict = await page.request.patch(`${base}/api/plans/${id}`, {
    data: { revision: 1, status: "draft" },
  });
  assert.equal(conflict.status(), 409);
  const malformed = await page.request.post(`${base}/api/plans`, {
    data: {
      parameters: [{ id: "bad", label: "Bad", type: "slider", value: 10 }],
    },
  });
  assert.equal(malformed.status(), 400);
  // Failed saves preserve edits and surface the error above the action bar.
  await page
    .getByLabel("A note for your agent")
    .fill("Keep this unsaved edit.");
  await page.route(`**/api/plans/${id}`, (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Revision conflict. Reload the latest plan.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Revision conflict");
  await expect(page.getByLabel("A note for your agent")).toHaveValue(
    "Keep this unsaved edit.",
  );
  const alertBox = await page.getByRole("alert").boundingBox();
  const saveBox = await page.locator(".save-bar").boundingBox();
  assert.ok(alertBox.y + alertBox.height <= saveBox.y);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      url: page.url(),
      checks:
        "create, controls, comments, add feature, ready, retrieve, reload, resets, unified view, keyboard focus, save errors, mobile overflow, conflict, validation, browser errors",
    }),
  );
} finally {
  await browser.close();
}
