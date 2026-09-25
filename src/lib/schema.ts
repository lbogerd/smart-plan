import { z } from "zod";

// Only the editor envelope is opinionated. Content and extra fields stay open.
export const parameterSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.string().default("text"),
    value: z.json().default(""),
    suggested: z.json().optional(),
    description: z
      .string()
      .optional()
      .describe(
        "Recommended: a short explanation or representative example for open-ended text, number, or custom values. Optional.",
      ),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    options: z.array(z.string()).optional(),
    previews: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Recommended: an explanation or concrete example for each offered slider value, select option, or toggle value (keys true and false). Missing, partial, and empty maps are valid.",
      ),
  })
  .passthrough()
  .superRefine((p, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: "custom", message });
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
export const featureSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().default(""),
    strength: z.number().int().min(0).max(5).default(2),
    suggested: z.number().int().min(0).max(5).optional(),
    levels: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        "Recommended: an explanation or concrete example for each strength from 0 to 5. Missing, partial, and empty maps are valid.",
      ),
    comments: z.string().default(""),
  })
  .passthrough();
export const planSchema = z
  .object({
    title: z.string().min(1).default("Untitled plan"),
    brief: z.string().default(""),
    content: z.json().default(""),
    parameters: z.array(parameterSchema).default([]),
    features: z.array(featureSchema).default([]),
    comments: z.string().default(""),
  })
  .passthrough()
  .superRefine((plan, ctx) => {
    for (const key of ["parameters", "features"] as const) {
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
export type Feature = z.infer<typeof featureSchema>;
export type PlanRecord = {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "ready";
  original: Plan;
  plan: Plan;
};
export const depthLabels = [
  "Leave it out",
  "Smallest useful version",
  "Basic functionality",
  "Common workflows",
  "Polish & edge cases",
  "Extensive & robust",
];

export type PlanSummary = Pick<PlanRecord, "id" | "status" | "updatedAt"> & {
  title: string;
  editorUrl: string;
  isExample: boolean;
};
