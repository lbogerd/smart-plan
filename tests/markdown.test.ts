import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanContent } from "../src/components/plan-content";
import { planSchema } from "../src/lib/schema";
function render(content: string) {
  const plan = planSchema.parse({
    content,
    parameters: [
      {
        id: "test",
        label: "Testing",
        type: "slider",
        value: 1,
        summaries: { "1": "essential checks" },
      },
    ],
  });
  return renderToStaticMarkup(
    createElement(PlanContent, {
      plan,
      original: plan,
      change: () => {},
      onReadingChange: () => {},
    }),
  );
}
test("inline references use current values and disclosures stay collapsed", () => {
  const html = render(
    "Run [placeholder](input:test).\n\n- Also [test](input:test)\n\n| Checks |\n| --- |\n| [test](input:test) |",
  );
  assert.equal((html.match(/aria-expanded="false"/g) || []).length, 3);
  assert.equal((html.match(/essential checks<svg/g) || []).length, 3);
  assert.ok(!html.includes("placeholder"));
  assert.ok(!html.includes("input-panel"));
  assert.ok(html.includes("<table>"));
});
test("plain Markdown stays readable; unsafe URLs and HTML stay inert", () => {
  const html = render(
    "# Heading\n\n**Body** and plain text.\n\n[unsafe](javascript:alert)\n\n<script>alert(1)</script>\n\n`[literal](input:test)`",
  );
  assert.ok(html.includes("<h1>Heading</h1>"));
  assert.ok(html.includes("<strong>Body</strong>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("aria-expanded"));
  assert.ok(html.includes("[literal](input:test)"));
});
