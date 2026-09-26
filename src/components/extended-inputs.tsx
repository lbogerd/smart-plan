import { useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Slider from "@radix-ui/react-slider";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { Button } from "./ui";
import {
  MAX_FILE_BYTES,
  attachmentSchema,
  type Attachment,
  type Parameter,
} from "../lib/schema";

export function hasExtendedInput(p: Parameter) {
  return (
    [
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
    ].includes(p.type) ||
    (p.type === "select" && ["radio", "cards"].includes(p.presentation ?? ""))
  );
}

function OrderedList({ p, change }: InputProps) {
  const values = p.value as string[];
  function move(index: number, offset: number) {
    const next = [...values];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change(next);
  }
  return (
    <div className="input-stack" role="group" aria-label={p.label}>
      <ol className="ordered-input">
        {values.map((value, index) => (
          <li key={index} className="input-row">
            <span className="list-position">{index + 1}</span>
            {p.type === "list" ? (
              <input
                aria-label={`${p.label} item ${index + 1}`}
                value={value}
                onChange={(e) =>
                  change(
                    values.map((v, i) => (i === index ? e.target.value : v)),
                  )
                }
              />
            ) : (
              <span className="rank-value">
                {value}
                {p.previews?.[value] && <small>{p.previews[value]}</small>}
              </span>
            )}
            <Button
              className="ghost icon-button"
              aria-label={`Move ${p.label} item ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={16} />
            </Button>
            <Button
              className="ghost icon-button"
              aria-label={`Move ${p.label} item ${index + 1} down`}
              disabled={index === values.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={16} />
            </Button>
            {p.type === "list" && (
              <Button
                className="ghost icon-button"
                aria-label={`Remove ${p.label} item ${index + 1}`}
                onClick={() => change(values.filter((_, i) => i !== index))}
              >
                <X size={16} />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {p.type === "list" && (
        <Button className="small" onClick={() => change([...values, ""])}>
          <Plus size={14} />
          Add item
        </Button>
      )}
    </div>
  );
}

type InputProps = {
  p: Parameter;
  change: (value: Parameter["value"]) => void;
  onReadingChange?: (reading: boolean) => void;
};

function FileInput({ p, change, onReadingChange }: InputProps) {
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const files = p.value as Attachment[];
  async function readFiles(selected: File[]) {
    setError("");
    setReading(true);
    onReadingChange?.(true);
    try {
      const added = await Promise.all(
        selected.map(async (file) => {
          if (file.size > MAX_FILE_BYTES)
            throw new Error(`${file.name} exceeds 256 KiB.`);
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = () =>
              reject(new Error(`Could not read ${file.name}.`));
            reader.readAsDataURL(file);
          });
          return attachmentSchema.parse({
            name: file.name,
            type: file.type,
            size: file.size,
            data,
          });
        }),
      );
      change([...files, ...added]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
      onReadingChange?.(false);
    }
  }
  function download(file: Attachment) {
    const bytes = Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/octet-stream" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="input-stack">
      <input
        id={`param-${p.id}`}
        type="file"
        multiple
        disabled={reading}
        aria-describedby={`files-help-${p.id}`}
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          e.target.value = "";
          void readFiles(selected);
        }}
      />
      <small id={`files-help-${p.id}`}>
        256 KiB per file; 512 KiB across the plan. Files are saved with the plan
        and visible to anyone with access.
      </small>
      {reading && <span role="status">Reading files…</span>}
      {files.map((file, index) => (
        <div className="input-row" key={index}>
          <Button
            className="ghost file-name"
            onClick={() => download(file)}
            aria-label={`Download ${file.name}`}
          >
            {file.name} ({file.size} bytes)
          </Button>
          <Button
            disabled={reading}
            className="ghost icon-button"
            aria-label={`Remove ${file.name}`}
            onClick={() => change(files.filter((_, i) => i !== index))}
          >
            <X size={16} />
          </Button>
        </div>
      ))}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}

export function ExtendedInput({ p, change, onReadingChange }: InputProps) {
  const id = `param-${p.id}`;
  if (p.type === "multi-select")
    return (
      <div className="input-stack" role="group" aria-label={p.label}>
        {p.options?.map((option, index) => (
          <label
            className="choice-option"
            key={option}
            htmlFor={`${id}-${index}`}
          >
            <Checkbox.Root
              id={`${id}-${index}`}
              className="checkbox"
              checked={(p.value as string[]).includes(option)}
              onCheckedChange={(checked) =>
                change(
                  p.options!.filter((o) =>
                    o === option
                      ? checked === true
                      : (p.value as string[]).includes(o),
                  ),
                )
              }
            >
              <Checkbox.Indicator>
                <Check size={14} />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span>
              {option}
              {p.previews?.[option] && <small>{p.previews[option]}</small>}
            </span>
          </label>
        ))}
      </div>
    );
  if (["radio", "choice-cards", "select"].includes(p.type))
    return (
      <RadioGroup.Root
        id={id}
        aria-label={p.label}
        value={p.value as string}
        onValueChange={change}
        className={`input-stack ${p.type === "choice-cards" || p.presentation === "cards" ? "choice-cards" : ""}`}
      >
        {p.options?.map((option, index) => (
          <label
            className="choice-option"
            data-selected={p.value === option}
            key={option}
            htmlFor={`${id}-${index}`}
          >
            <RadioGroup.Item
              className="radio-item"
              id={`${id}-${index}`}
              value={option}
            >
              <RadioGroup.Indicator className="radio-indicator" />
            </RadioGroup.Item>
            <span>
              {option}
              {p.previews?.[option] && <small>{p.previews[option]}</small>}
            </span>
          </label>
        ))}
      </RadioGroup.Root>
    );
  if (p.type === "list" || p.type === "ranking")
    return <OrderedList p={p} change={change} />;
  if (p.type === "range")
    return (
      <div className="input-stack">
        <output>{(p.value as number[]).join(" – ")}</output>
        <Slider.Root
          className="slider"
          min={p.min ?? 0}
          max={p.max ?? 5}
          step={p.step ?? 1}
          value={p.value as number[]}
          onValueChange={change}
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb
            className="slider-thumb"
            aria-label={`${p.label} minimum`}
          />
          <Slider.Thumb
            className="slider-thumb"
            aria-label={`${p.label} maximum`}
          />
        </Slider.Root>
      </div>
    );
  if (p.type === "date-range") {
    const value = p.value as { start: string; end: string };
    return (
      <div className="date-range" role="group" aria-label={p.label}>
        <label>
          Start
          <input
            type="date"
            aria-label={`${p.label} start`}
            value={value.start}
            max={value.end || undefined}
            onChange={(e) => change({ ...value, start: e.target.value })}
          />
        </label>
        <label>
          End
          <input
            type="date"
            aria-label={`${p.label} end`}
            value={value.end}
            min={value.start || undefined}
            onChange={(e) => change({ ...value, end: e.target.value })}
          />
        </label>
      </div>
    );
  }
  if (p.type === "file")
    return (
      <FileInput p={p} change={change} onReadingChange={onReadingChange} />
    );
  return (
    <input
      id={id}
      type={p.type === "date" ? "date" : "url"}
      value={p.value as string}
      onChange={(e) => change(e.target.value)}
    />
  );
}
