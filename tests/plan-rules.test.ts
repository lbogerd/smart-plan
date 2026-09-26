import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { planSchema } from "../src/lib/schema";
import { conditionValue, selectPassage } from "../src/lib/plan-rules";
import { PlanContent } from "../src/components/plan-content";
import { example } from "../src/lib/example";

function proposal() {
  return {
    content:
      '::passage{id="persistence"}\n\n:::when{parameter="persist" equals="true"}\n## Storage\n\nSave by project ID.\n:::',
    parameters: [
      { id: "persist", label: "Persistence", type: "toggle", value: true },
    ],
    passages: [
      {
        id: "persistence",
        parameter: "persist",
        cases: [
          {
            value: true,
            content:
              "Keep persistence [on](input:persist). Save the arrangement.",
          },
          {
            value: false,
            content:
              "Keep persistence [off](input:persist). Start fresh on reopening.",
          },
        ],
      },
    ],
  };
}
function issues(input: unknown) {
  const result = planSchema.safeParse(input);
  assert.equal(result.success, false);
  return result.success
    ? ""
    : result.error.issues.map((i) => i.message).join("\n");
}
function render(value: unknown) {
  const plan = planSchema.parse(value);
  return renderToStaticMarkup(
    createElement(PlanContent, {
      plan,
      original: plan,
      change: () => {},
      onReadingChange: () => {},
    }),
  );
}

test("passages select strict typed cases and explicit fallbacks, including empty text", () => {
  const passage = {
    id: "p",
    parameter: "x",
    cases: [
      { value: true, content: "boolean" },
      { value: "true", content: "string" },
      { value: 1, content: "number" },
      { value: false, content: "" },
    ],
    fallback: "other",
  };
  assert.equal(selectPassage(passage, true), "boolean");
  assert.equal(selectPassage(passage, "true"), "string");
  assert.equal(selectPassage(passage, 1), "number");
  assert.equal(selectPassage(passage, "1"), "other");
  assert.equal(selectPassage(passage, false), "");
  assert.equal(conditionValue({ type: "text" }, "false"), "false");
  assert.equal(conditionValue({ type: "toggle" }, "false"), false);
  assert.equal(conditionValue({ type: "number" }, "0"), 0);
  for (const value of ["", "NaN", "Infinity", "1 + 1", "true"])
    assert.throws(() => conditionValue({ type: "number" }, value));
  assert.throws(() => conditionValue({ type: "toggle" }, "0"));
  assert.throws(() => conditionValue({ type: "list" }, "[]"));
});
test("toggle and choice passages require full coverage even with a fallback", () => {
  const plan = proposal();
  assert.ok(planSchema.safeParse(plan).success);
  plan.passages[0].cases.pop();
  assert.match(issues(plan), /every value/);
  assert.match(
    issues({ ...plan, passages: [{ ...plan.passages[0], fallback: "other" }] }),
    /every value/,
  );
  const choice = {
    content: '::passage{id="p"}',
    parameters: [
      {
        id: "choice",
        label: "Choice",
        type: "select",
        value: "A",
        options: ["A", "B", "C"],
      },
    ],
    passages: [
      {
        id: "p",
        parameter: "choice",
        cases: ["A", "B", "C"].map((value) => ({
          value,
          content: "[value](input:choice)",
        })),
      },
    ],
  };
  assert.ok(planSchema.safeParse(choice).success);
  choice.passages[0].cases.pop();
  assert.match(issues(choice), /every value/);
});
test("numeric and text passages need fallbacks unless a slider domain is exhausted", () => {
  for (const type of ["number", "text", "slider"]) {
    const value = type === "text" ? "a" : 1;
    const plan = {
      content: '::passage{id="p"}',
      parameters: [{ id: "x", label: "X", type, value }],
      passages: [
        {
          id: "p",
          parameter: "x",
          cases: [{ value, content: "[x](input:x)" }],
        },
      ],
    };
    assert.match(issues(plan), /explicit fallback/);
    assert.ok(
      planSchema.safeParse({
        ...plan,
        passages: [{ ...plan.passages[0], fallback: "[x](input:x)" }],
      }).success,
    );
  }
  assert.ok(
    planSchema.safeParse({
      content: '::passage{id="p"}',
      parameters: [
        { id: "x", label: "X", type: "slider", value: 1, min: 0, max: 2 },
      ],
      passages: [
        {
          id: "p",
          parameter: "x",
          cases: [0, 1, 2].map((value) => ({ value, content: "[x](input:x)" })),
        },
      ],
    }).success,
  );
});
test("reject unknown IDs, duplicates, wrong types, unsupported structures and bad cases", () => {
  let plan = proposal();
  assert.match(
    issues({ ...plan, content: '::passage{id="missing"}' }),
    /Unknown passage/,
  );
  assert.match(
    issues({ ...plan, content: "[missing](input:missing)" }),
    /Unknown input/,
  );
  assert.match(
    issues({ ...plan, passages: [plan.passages[0], plan.passages[0]] }),
    /Duplicate passage/,
  );
  assert.match(
    issues({
      ...plan,
      passages: [{ ...plan.passages[0], parameter: "missing" }],
    }),
    /Unknown passage parameter/,
  );
  plan.passages[0].cases.push(plan.passages[0].cases[0]);
  assert.match(issues(plan), /Duplicate case/);
  plan = proposal();
  assert.match(
    issues({
      ...plan,
      passages: [
        {
          ...plan.passages[0],
          cases: [{ value: "true", content: "[x](input:persist)" }],
        },
      ],
    }),
    /match its type/,
  );
  assert.match(
    issues({
      ...plan,
      content: plan.content.replace('equals="true"', 'equals="yes"'),
    }),
    /boolean/,
  );
  assert.match(
    issues({
      ...plan,
      content: plan.content.replace(
        'parameter="persist"',
        'parameter="unknown"',
      ),
    }),
    /Unknown condition parameter/,
  );
  assert.match(
    issues({
      ...plan,
      passages: [{ ...plan.passages[0], extra: "unsupported" }],
    }),
    /Unrecognized/,
  );
});
test("reject malformed, unclosed, inline, or misspelled directives without scanning code", () => {
  const plan = proposal();
  for (const content of [
    '::passage{id="persistence"',
    "::passage",
    ':passage{id="persistence"}',
    ':::when{parameter="persist" equals="true"}\nUnclosed',
    '::when{parameter="persist" equals="true"}',
    '::pasage{id="persistence"}',
    ':::when{parameter="persist" equals="true" extra="x"}\nText\n:::',
  ])
    assert.ok(issues({ ...plan, content }));
  assert.match(
    issues({
      ...plan,
      content:
        '[p](input:persist)\n\n::::when{parameter="persist" equals="true"}\n:::when{parameter="persist" equals="true"}\ntext\n:::',
    }),
    /closing/,
  );
  assert.ok(
    planSchema.safeParse({
      content: "```markdown\n:::when{broken\n```\n\n`::passage{broken`",
    }).success,
  );
});
test("prevent direct and indirect recursion, including recursion in unselected cases", () => {
  const plan = proposal();
  plan.passages[0].cases[1].content += '\n\n::passage{id="persistence"}';
  assert.match(issues(plan), /Recursive passage/);
  plan.passages[0].cases[1].content = '::passage{id="other"}';
  plan.passages.push({
    ...plan.passages[0],
    id: "other",
    cases: [
      { value: true, content: "[p](input:persist)" },
      { value: false, content: '::passage{id="persistence"}' },
    ],
  });
  assert.match(issues(plan), /Recursive passage/);
});
test("a controller must stay available across every variant and outside conditional cycles", () => {
  const plan = proposal();
  plan.passages[0].cases[1].content = "The control disappeared.";
  assert.match(issues(plan), /always remains reachable/);
  assert.ok(
    planSchema.safeParse({
      ...plan,
      content: "[p](input:persist)\n\n" + plan.content,
    }).success,
  );
  const two = {
    content:
      ':::when{parameter="a" equals="true"}\n[b](input:b)\n:::\n\n:::when{parameter="b" equals="true"}\n[a](input:a)\n:::',
    parameters: ["a", "b"].map((id) => ({
      id,
      label: id,
      type: "toggle",
      value: true,
    })),
  };
  assert.match(issues(two), /always remains reachable/);
});
test("nested Markdown and nested passages render with safe text and stable rule wrappers", () => {
  const plan = proposal();
  plan.content =
    '[p](input:persist)\n\n> :::when{parameter="persist" equals="true"}\n> ## Nested heading\n>\n> - **Strong** item\n> :::\n\n::passage{id="outer"}';
  plan.passages.push({
    id: "outer",
    parameter: "persist",
    cases: [true, false].map((value) => ({
      value,
      content:
        '::passage{id="persistence"}\n\n| Value |\n| --- |\n| [p](input:persist) |',
    })),
  });
  const html = render(plan);
  assert.match(html, /Nested heading/);
  assert.match(html, /<strong>Strong<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /Save the arrangement/);
  assert.ok(!html.includes("Start fresh"));
  assert.ok(!html.includes("::passage"));
});
test("example variants remain coherent for all interaction levels and persistence states", () => {
  for (const persist of [true, false])
    for (let level = 0; level <= 5; level++) {
      const plan = {
        ...example,
        parameters: example.parameters.map((p) =>
          p.id === "persistence"
            ? { ...p, value: persist }
            : p.id === "interaction"
              ? { ...p, value: level }
              : p,
        ),
      };
      const html = render(plan);
      assert.equal(html.includes("Save the current node positions"), persist);
      assert.equal(
        html.includes("Reopening the project restores the default layout"),
        !persist,
      );
      assert.equal(
        html.includes('hidden="" data-condition-parameter="persistence"'),
        !persist,
      );
      assert.ok(!html.includes("::passage"));
    }
});

test("reference-style controls are validated consistently with rendered links", () => {
  const plan = proposal();
  plan.content =
    '[p][control]\n\n[control]: input:persist\n\n:::when{parameter="persist" equals="true"}\nStored.\n:::';
  assert.ok(planSchema.safeParse(plan).success);
  assert.match(
    issues({
      ...plan,
      content: plan.content.replace("input:persist", "input:missing"),
    }),
    /Unknown input/,
  );
});
test("passage Markdown keeps HTML and unsafe URLs inert", () => {
  const plan = proposal();
  plan.passages[0].cases[0].content +=
    "\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert)";
  const html = render(plan);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes('href="javascript:'));
});
test("reject out-of-domain cases and bound recursive expansion without evaluating expressions", () => {
  assert.match(
    issues({
      content: '[n](input:n)\n\n:::when{parameter="n" equals="3"}\nX\n:::',
      parameters: [
        { id: "n", label: "N", type: "number", min: 0, max: 2, value: 0 },
      ],
    }),
    /allowed values/,
  );
  const plan = proposal();
  plan.passages = Array.from({ length: 10 }, (_, i) => ({
    id: i ? `p${i}` : "persistence",
    parameter: "persist",
    cases: [true, false].map((value) => ({
      value,
      content: i === 9 ? "[p](input:persist)" : `::passage{id="p${i + 1}"}`,
    })),
  }));
  assert.match(issues(plan), /nesting exceeds/);
});
