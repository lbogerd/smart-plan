import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  planSchema,
  updateSchema,
  type PlanRecord,
  type PlanSummary,
} from "./schema";

import { example } from "./example";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const directory = () =>
  process.env.PLAN_DATA_DIR || join(process.cwd(), "data");
const file = (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new HttpError(404, "Plan not found");
  return join(directory(), `${id}.json`);
};
async function write(record: PlanRecord) {
  await mkdir(directory(), { recursive: true });
  const destination = file(record.id);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(record, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
export async function getPlan(id: string): Promise<PlanRecord> {
  try {
    return JSON.parse(await readFile(file(id), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new HttpError(404, "Plan not found");
    throw error;
  }
}
export async function createPlan(input: unknown) {
  const plan = planSchema.parse(input);
  const now = new Date().toISOString();
  const record: PlanRecord = {
    id: randomUUID(),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    original: structuredClone(plan),
    plan,
  };
  await write(record);
  return record;
}
// Serialize updates per plan in this single-process, file-backed prototype.
const locks = new Map<string, Promise<unknown>>();
export async function updatePlan(id: string, input: unknown) {
  const update = updateSchema.parse(input);
  const previous = locks.get(id) || Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(async () => {
      const current = await getPlan(id);
      if (current.revision !== update.revision)
        throw new HttpError(
          409,
          "This plan changed in another session. Reload before saving; your edits have not been saved.",
        );
      const next: PlanRecord = {
        ...current,
        plan: update.plan ?? current.plan,
        status: update.status ?? (update.plan ? "draft" : current.status),
        revision: current.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      await write(next);
      return next;
    });
  locks.set(id, task);
  try {
    return await task;
  } finally {
    if (locks.get(id) === task) locks.delete(id);
  }
}

// One stable persisted example; serialize first visits in this single-process service.
const exampleId = "24c63e69-d694-4a51-9ca8-a7538d01bf80";
let exampleInitialization: Promise<void> | undefined;
async function ensureExample() {
  if (!exampleInitialization) {
    exampleInitialization = (async () => {
      try {
        await getPlan(exampleId);
        return;
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 404) throw error;
      }
      const now = new Date().toISOString();
      await write({
        id: exampleId,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        status: "draft",
        original: structuredClone(example),
        plan: structuredClone(example),
      });
    })().finally(() => {
      exampleInitialization = undefined;
    });
  }
  await exampleInitialization;
}
export async function listPlans(origin: string): Promise<PlanSummary[]> {
  await ensureExample();
  const names = await readdir(directory());
  const records = await Promise.all(
    names
      .filter((name) => /^[0-9a-f-]{36}\.json$/i.test(name))
      .map((name) => getPlan(name.slice(0, -5))),
  );
  return records
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    )
    .map((record) => ({
      id: record.id,
      title: record.plan.title,
      status: record.status,
      updatedAt: record.updatedAt,
      editorUrl: `${origin}/plans/${record.id}`,
      isExample: record.id === exampleId,
    }));
}
