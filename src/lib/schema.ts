import { z } from "zod";
import { validatePlanRules } from "./plan-rules";

export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_PLAN_FILE_BYTES = 512 * 1024;
export const attachmentSchema = z
  .object({
    name: z.string().min(1).max(255),
    type: z.string().max(255),
    size: z.number().int().min(0).max(MAX_FILE_BYTES),
    data: z
      .string()
      .max(4 * Math.ceil(MAX_FILE_BYTES / 3))
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
      ),
  })
  .superRefine((file, ctx) => {
    const padding = file.data.endsWith("==")
      ? 2
      : file.data.endsWith("=")
        ? 1
        : 0;
    if ((file.data.length * 3) / 4 - padding !== file.size)
      ctx.addIssue({
        code: "custom",
        message: "File size must match its base64 data",
      });
  });
export type Attachment = z.infer<typeof attachmentSchema>;
const dateValue = z.union([z.literal(""), z.iso.date()]);

// Markdown and optional, explicitly placed inputs. Extra metadata stays open.
export const parameterSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z
      .enum([
        "slider",
        "number",
        "text",
        "textarea",
        "select",
        "toggle",
        "multi-select",
        "radio",
        "choice-cards",
        "list",
        "ranking",
        "range",
        "date",
        "date-range",
        "url",
        "file",
      ])
      .default("text"),
    summaries: z.record(z.string(), z.string()).optional(),
    value: z.json().default(""),
    suggested: z.json().optional(),
    description: z
      .string()
      .optional()
      .describe("Optional text displayed with the parameter."),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    options: z.array(z.string()).optional(),
    presentation: z.enum(["dropdown", "radio", "cards"]).optional(),
    previews: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Optional descriptions keyed by parameter value or option. Toggle keys are true and false.",
      ),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (["multi-select", "ranking", "radio", "choice-cards"].includes(p.type)) {
      if (!p.options?.length || new Set(p.options).size !== p.options.length)
        error("Options must be a nonempty array of unique strings");
    }
    if (
      ["radio", "choice-cards"].includes(p.type) &&
      (typeof p.value !== "string" || !p.options?.includes(p.value))
    )
      error("Value must be one of its options");
    if (["multi-select", "ranking", "list"].includes(p.type)) {
      const result = z.array(z.string()).safeParse(p.value);
      if (!result.success) error("Value must be an array of strings");
      else if (p.type !== "list") {
        if (
          new Set(result.data).size !== result.data.length ||
          result.data.some((v) => !p.options?.includes(v))
        )
          error("Values must be unique members of options");
        if (p.type === "ranking" && result.data.length !== p.options?.length)
          error("Ranking must contain every option exactly once");
      }
    }
    if (p.type === "range") {
      const result = z.tuple([z.number(), z.number()]).safeParse(p.value);
      const min = p.min ?? 0,
        max = p.max ?? 5;
      if (
        min > max ||
        !result.success ||
        result.data[0] < min ||
        result.data[1] > max ||
        result.data[0] > result.data[1]
      )
        error("Range must be an ordered pair within its bounds");
    }
    if (p.type === "date" && !dateValue.safeParse(p.value).success)
      error("Date must be YYYY-MM-DD or empty");
    if (p.type === "date-range") {
      const result = z
        .object({ start: dateValue, end: dateValue })
        .strict()
        .safeParse(p.value);
      if (
        !result.success ||
        (result.data.start &&
          result.data.end &&
          result.data.start > result.data.end)
      )
        error("Date range must contain start and end dates in order");
    }
    if (
      p.type === "url" &&
      !(
        p.value === "" ||
        z.url({ protocol: /^https?$/ }).safeParse(p.value).success
      )
    )
      error("URL must use http or https, or be empty");
    if (
      p.type === "file" &&
      !z.array(attachmentSchema).safeParse(p.value).success
    )
      error(
        "Files must contain name, type, size, and base64 data; maximum 256 KiB per file",
      );
    if (p.type === "slider" || p.type === "number") {
      const min = p.min ?? (p.type === "slider" ? 0 : -Infinity);
      const max = p.max ?? (p.type === "slider" ? 5 : Infinity);
      if (min > max) error("Minimum must not exceed maximum");
      if (typeof p.value !== "number" || p.value < min || p.value > max)
        error("Numeric value must be within its bounds");
    }
    if (p.type === "toggle" && typeof p.value !== "boolean")
      error("Toggle value must be boolean");
    if (
      ["text", "textarea", "select"].includes(p.type) &&
      typeof p.value !== "string"
    )
      error("Text value must be a string");
    if (
      p.type === "select" &&
      (!p.options?.length || !p.options.includes(String(p.value)))
    )
      error("Select value must be one of its options");
  });
export const passageSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Passage IDs use letters, numbers, underscores, and hyphens",
      ),
    parameter: z.string().min(1),
    cases: z
      .array(
        z
          .object({
            value: z.union([z.string(), z.number(), z.boolean()]),
            content: z.string(),
          })
          .strict(),
      )
      .min(1),
    fallback: z.string().optional(),
  })
  .strict();
export const planSchema = z
  .object({
    title: z.string().min(1).default("Untitled plan"),
    brief: z.string().default(""),
    content: z.string().default(""),
    parameters: z.array(parameterSchema).default([]),
    passages: z.array(passageSchema).default([]),
  })
  .passthrough()
  .superRefine((plan, ctx) => {
    for (const issue of validatePlanRules(
      plan,
      (p, value) => parameterSchema.safeParse({ ...p, value }).success,
    )) {
      ctx.addIssue({ code: "custom", ...issue });
    }
    const fileBytes = plan.parameters
      .filter((p) => p.type === "file")
      .reduce(
        (total, p) =>
          total +
          (Array.isArray(p.value)
            ? p.value.reduce<number>(
                (sum, f) =>
                  sum +
                  (typeof f === "object" &&
                  f !== null &&
                  "size" in f &&
                  typeof f.size === "number"
                    ? f.size
                    : 0),
                0,
              )
            : 0),
        0,
      );
    if (fileBytes > MAX_PLAN_FILE_BYTES)
      ctx.addIssue({
        code: "custom",
        path: ["parameters"],
        message: "Combined files must not exceed 512 KiB",
      });
    for (const key of ["parameters"] as const) {
      const ids = plan[key].map((item) => item.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "IDs must be unique within each collection",
        });
    }
  });
export const updateSchema = z
  .object({
    revision: z.number().int().positive(),
    plan: planSchema.optional(),
    status: z.enum(["draft", "ready"]).optional(),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
export type Parameter = z.infer<typeof parameterSchema>;
export type PlanRecord = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "ready";
  original: Plan;
  plan: Plan;
};
export type PlanSummary = Pick<PlanRecord, "id" | "status" | "updatedAt"> & {
  title: string;
  planUrl: string;
  isExample: boolean;
};
