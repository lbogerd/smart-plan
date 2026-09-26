import { ExtendedInput, hasExtendedInput } from "./extended-inputs";
import { Range, Toggle } from "./ui";
import type { Parameter } from "../lib/schema";

export function ParameterControl({
  p,
  change,
  onReadingChange,
}: {
  p: Parameter;
  change: (value: Parameter["value"]) => void;
  onReadingChange: (reading: boolean) => void;
}) {
  const id = `param-${p.id}`;
  if (hasExtendedInput(p))
    return (
      <ExtendedInput p={p} change={change} onReadingChange={onReadingChange} />
    );
  if (p.type === "slider")
    return (
      <div>
        <Range
          id={id}
          label={p.label}
          value={Number(p.value)}
          min={p.min}
          max={p.max}
          step={p.step}
          onChange={change}
        />
        <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{p.min ?? 0}</span>
          <output className="font-medium text-accent">{String(p.value)}</output>
          <span>{p.max ?? 5}</span>
        </div>
      </div>
    );
  if (p.type === "toggle")
    return <Toggle id={id} checked={Boolean(p.value)} onChange={change} />;
  if (p.type === "select")
    return (
      <select
        id={id}
        value={String(p.value)}
        onChange={(e) => change(e.target.value)}
      >
        {p.options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  if (p.type === "textarea")
    return (
      <textarea
        id={id}
        rows={3}
        value={String(p.value)}
        onChange={(e) => change(e.target.value)}
      />
    );
  return (
    <input
      id={id}
      type={p.type === "number" ? "number" : "text"}
      value={String(p.value)}
      min={p.min}
      max={p.max}
      step={p.step}
      onChange={(e) =>
        change(
          p.type === "number" && e.target.value !== ""
            ? Number(e.target.value)
            : e.target.value,
        )
      }
    />
  );
}
