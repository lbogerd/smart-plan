import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlan, getPlan, updatePlan } from "../src/lib/store.server";
import { planSchema } from "../src/lib/schema";

test("custom JSON survives edits; original persists; concurrent edits conflict", async () => {
  const dir = await mkdtemp(join(tmpdir(), "smart-plan-test-"));
  process.env.PLAN_DATA_DIR = dir;
  try {
    const record = await createPlan({
      title: "Graph",
      content: [{ arbitrary: { nested: [1, true, null] } }],
      extra: { agent: "custom" },
      features: [
        { id: "graph", title: "Graph", plugin: { library: "existing" } },
      ],
      parameters: [
        {
          id: "custom",
          label: "Custom",
          type: "future-control",
          value: { foo: [1] },
          extra: true,
        },
      ],
    });
    const plan = {
      ...record.plan,
      comments: "Keep this simple",
      features: [{ ...record.plan.features[0], strength: 1 }],
    };
    const results = await Promise.allSettled([
      updatePlan(record.id, { revision: 1, plan, status: "ready" }),
      updatePlan(record.id, { revision: 1, plan }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    assert.equal(rejected.reason.status, 409);
    const saved = await getPlan(record.id);
    assert.equal(saved.revision, 2);
    assert.equal(saved.status, "ready");
    assert.equal(saved.original.features[0].strength, 2);
    assert.deepEqual(saved.plan.extra, { agent: "custom" });
    assert.deepEqual(saved.plan.content, record.plan.content);
    assert.deepEqual(saved.plan.features[0].plugin, { library: "existing" });
    assert.deepEqual(saved.plan.parameters[0].value, { foo: [1] });
    assert.deepEqual(
      JSON.parse(await readFile(join(dir, `${record.id}.json`), "utf8")),
      saved,
    );
    await assert.rejects(getPlan("../../etc/passwd"), { status: 404 });
    await assert.rejects(
      updatePlan(record.id, {
        revision: 2,
        plan: { features: [{ id: "x", title: "X", strength: 6 }] },
      }),
    );
    assert.equal((await getPlan(record.id)).revision, 2);
  } finally {
    delete process.env.PLAN_DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  }
});
test("schema validates controls while keeping the document open", () => {
  assert.equal(
    planSchema.safeParse({ completelyNewSection: { anything: true } }).success,
    true,
  );
  assert.equal(
    planSchema.safeParse({
      parameters: [{ id: "x", label: "X", type: "slider", value: 7 }],
    }).success,
    false,
  );
  assert.equal(
    planSchema.safeParse({
      parameters: [{ id: "x", label: "X", type: "toggle", value: "yes" }],
    }).success,
    false,
  );
  assert.equal(
    planSchema.safeParse({
      features: [
        { id: "x", title: "A" },
        { id: "x", title: "B" },
      ],
    }).success,
    false,
  );
});
