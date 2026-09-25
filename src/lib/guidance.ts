import type { Plan, Parameter } from "./schema";

function discreteValues(p: Parameter): string[] | undefined {
  if (p.type === "toggle") return ["true", "false"];
  if (
    ["select", "radio", "choice-cards", "multi-select", "ranking"].includes(
      p.type,
    )
  )
    return p.options;
  if (p.type !== "slider") return undefined;
  const min = p.min ?? 0,
    max = p.max ?? 5,
    step = p.step ?? 1;
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  // Keep optional authoring advice cheap even for very large ranges.
  if (count > 1000) return undefined;
  return Array.from({ length: count }, (_, i) =>
    String(Number((min + i * step).toPrecision(12))),
  );
}
export function guidanceSuggestions(plan: Plan): string[] {
  const suggestions: string[] = [];
  for (const p of plan.parameters) {
    const values = discreteValues(p);
    if (!values) continue;
    const missing = values.filter((value) => !p.previews?.[value]?.trim());
    if (missing.length)
      suggestions.push(
        `${p.label}: add examples or explanations for ${missing.length} ${missing.length === 1 ? "value" : "values"}.`,
      );
  }
  for (const f of plan.features) {
    const missing = [0, 1, 2, 3, 4, 5].filter(
      (value) => !f.levels?.[String(value)]?.trim(),
    );
    if (missing.length)
      suggestions.push(
        `${f.title}: add examples or explanations for ${missing.length} ${missing.length === 1 ? "level" : "levels"}.`,
      );
  }
  return suggestions;
}
