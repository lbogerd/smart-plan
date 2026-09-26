import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlan, getPlan, updatePlan } from "../src/lib/store.server";
import { planSchema } from "../src/lib/schema";
import { planDiff } from "../src/lib/plan-diff";

test("Markdown and metadata persist; original stays immutable; concurrent edits conflict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smart-plan-test-"));
  process.env.PLAN_DATA_DIR = dir;
  try {
    const record = await createPlan({
      title: "Graph",
      content: "Use [React Flow](input:library).",
      extra: { agent: "custom" },
      parameters: [
        {
          id: "library",
          label: "Library",
          type: "text",
          value: "React Flow",
          extra: true,
        },
      ],
    });
    const plan = {
      ...record.plan,
      parameters: [{ ...record.plan.parameters[0], value: "Cytoscape.js" }],
    };
    const results = await Promise.allSettled([
      updatePlan(record.id, { revision: 1, plan, status: "ready" }),
      updatePlan(record.id, { revision: 1, plan }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
        .reason.status,
      409,
    );
    const saved = await getPlan(record.id);
    assert.equal(saved.revision, 2);
    assert.equal(saved.status, "ready");
    assert.equal(saved.original.parameters[0].value, "React Flow");
    assert.deepEqual(saved.plan.extra, { agent: "custom" });
    assert.equal(saved.plan.content, record.plan.content);
    assert.equal(saved.plan.parameters[0].extra, true);
    assert.deepEqual(planDiff(saved).changes, [
      { op: "replace", path: "/parameters/0/value", value: "Cytoscape.js" },
    ]);
    assert.deepEqual(
      JSON.parse(await readFile(join(dir, `${record.id}.json`), "utf8")),
      saved,
    );
    await assert.rejects(getPlan("../../etc/passwd"), { status: 404 });
    await assert.rejects(
      updatePlan(record.id, {
        revision: 2,
        plan: {
          parameters: [{ id: "x", label: "X", type: "slider", value: 6 }],
        },
      }),
    );
    assert.equal((await getPlan(record.id)).revision, 2);
    const draft = await updatePlan(record.id, { revision: 2, plan });
    assert.equal(draft.status, "draft");
  } finally {
    delete process.env.PLAN_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
test("schema requires Markdown, supported controls and unique parameter IDs", () => {
  assert.ok(
    planSchema.safeParse({ content: "# Just a document", extra: true }).success,
  );
  assert.ok(!planSchema.safeParse({ content: { steps: [] } }).success);
  assert.ok(
    !planSchema.safeParse({
      parameters: [{ id: "x", label: "X", type: "future-control" }],
    }).success,
  );
  assert.ok(
    !planSchema.safeParse({
      parameters: [{ id: "x", label: "X", type: "toggle", value: "yes" }],
    }).success,
  );
  assert.ok(
    !planSchema.safeParse({
      parameters: [
        { id: "x", label: "A" },
        { id: "x", label: "B" },
      ],
    }).success,
  );
});
