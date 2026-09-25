import type { PlanRecord } from "./schema";

export type Change =
  | { op: "add" | "replace"; path: string; value: unknown }
  | { op: "remove"; path: string };

// JSON Patch subset: paths refer to the document after earlier operations.
// Compare with the immutable original so repeated retrievals are stable.
export function planDiff(record: PlanRecord) {
  const changes: Change[] = [];
  const child = (path: string, key: string | number) =>
    `${path}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;
  function compare(before: unknown, after: unknown, path: string) {
    if (before === after) return;
    if (Array.isArray(before) && Array.isArray(after)) {
      const common = Math.min(before.length, after.length);
      for (let i = 0; i < common; i++)
        compare(before[i], after[i], child(path, i));
      for (let i = before.length - 1; i >= after.length; i--)
        changes.push({ op: "remove", path: child(path, i) });
      for (let i = common; i < after.length; i++)
        changes.push({ op: "add", path: child(path, i), value: after[i] });
      return;
    }
    if (
      before !== null &&
      after !== null &&
      typeof before === "object" &&
      typeof after === "object" &&
      !Array.isArray(before) &&
      !Array.isArray(after)
    ) {
      const left = before as Record<string, unknown>,
        right = after as Record<string, unknown>;
      for (const key of Object.keys(left)) {
        if (!Object.hasOwn(right, key))
          changes.push({ op: "remove", path: child(path, key) });
        else compare(left[key], right[key], child(path, key));
      }
      for (const key of Object.keys(right)) {
        if (!Object.hasOwn(left, key))
          changes.push({
            op: "add",
            path: child(path, key),
            value: right[key],
          });
      }
      return;
    }
    changes.push({ op: "replace", path, value: after });
  }
  compare(record.original, record.plan, "");
  return {
    id: record.id,
    revision: record.revision,
    status: record.status,
    base: "original" as const,
    changes,
  };
}
