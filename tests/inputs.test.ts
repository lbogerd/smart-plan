import { test } from "node:test";
import assert from "node:assert/strict";
import { parameterSchema, planSchema, MAX_FILE_BYTES } from "../src/lib/schema";
const check = (type: string, value: unknown, fields = {}) =>
  parameterSchema.safeParse({
    id: "p",
    label: "Parameter",
    type,
    value,
    ...fields,
  }).success;
test("choice inputs validate membership, multiplicity and complete rankings", () => {
  const options = ["A", "B"];
  for (const type of ["radio", "choice-cards", "select"]) {
    assert.ok(check(type, "A", { options }));
    assert.ok(!check(type, "C", { options }));
  }
  assert.ok(check("select", "B", { options, presentation: "cards" }));
  assert.ok(check("multi-select", [], { options }));
  assert.ok(check("multi-select", ["B", "A"], { options }));
  assert.ok(!check("multi-select", ["A", "A"], { options }));
  assert.ok(!check("multi-select", ["C"], { options }));
  assert.ok(!check("radio", "A", { options: ["A", "A"] }));
  assert.ok(check("ranking", ["B", "A"], { options }));
  assert.ok(!check("ranking", ["A"], { options }));
  assert.ok(check("list", ["", "A", "A"]));
  assert.ok(!check("list", [12]));
});
test("ranges, dates and URLs validate bounds and formats", () => {
  assert.ok(check("range", [1, 4]));
  for (const value of [[4, 1], [-1, 4], [0, 6], [1], [1, 2, 3]])
    assert.ok(!check("range", value));
  assert.ok(check("range", [100, 500], { min: 0, max: 1000, step: 50 }));
  assert.ok(check("date", "2028-02-29"));
  assert.ok(!check("date", "2026-02-29"));
  assert.ok(check("date", ""));
  assert.ok(check("date-range", { start: "", end: "" }));
  assert.ok(check("date-range", { start: "2026-01-01", end: "2026-02-01" }));
  assert.ok(!check("date-range", { start: "2026-02-01", end: "2026-01-01" }));
  assert.ok(!check("date-range", { start: "bad", end: "" }));
  for (const value of ["", "https://example.com", "http://localhost:3000"])
    assert.ok(check("url", value));
  for (const value of [
    "relative/path",
    "javascript:alert(1)",
    "file:///tmp/test",
  ])
    assert.ok(!check("url", value));
});
test("attachments validate base64, size, and aggregate limits", () => {
  const file = {
    name: "sample.txt",
    type: "text/plain",
    size: 3,
    data: "YWJj",
  };
  assert.ok(check("file", [file]));
  assert.ok(check("file", []));
  for (const changed of [
    { data: "%%%" },
    { size: 2 },
    { size: MAX_FILE_BYTES + 1 },
    { name: "" },
  ])
    assert.ok(!check("file", [{ ...file, ...changed }]));
  const large = {
    ...file,
    size: MAX_FILE_BYTES,
    data: Buffer.alloc(MAX_FILE_BYTES).toString("base64"),
  };
  const parameters = [0, 1, 2].map((i) => ({
    id: String(i),
    label: "File",
    type: "file",
    value: [large],
  }));
  assert.ok(
    planSchema.safeParse({ parameters: parameters.slice(0, 2) }).success,
  );
  assert.ok(!planSchema.safeParse({ parameters }).success);
});
