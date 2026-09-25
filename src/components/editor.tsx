import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Code2,
  Copy,
  FileText,
  Layers3,
  MessageSquare,
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { planDiff } from "../lib/plan-diff";
import { PlanContent } from "./plan-content";
import { Button, Range, Toggle } from "./ui";
import { GuidanceHints } from "./guidance-hints";
import {
  depthLabels,
  type Plan,
  type PlanRecord,
  type Parameter,
} from "../lib/schema";

export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-icon">
        <SlidersHorizontal size={19} />
      </span>
      smart<span className="brand-light">plan</span>
      <span className="beta">preview</span>
    </a>
  );
}
export async function api(url: string, method = "GET", data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.issues
        ? `${result.error}: ${result.issues.map((i: { message: string }) => i.message).join("; ")}`
        : result.error || "Request failed",
    );
  return result;
}
function displayValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}
function ChangeControl({
  label,
  value,
  original,
  reset,
}: {
  label: string;
  value: unknown;
  original: unknown;
  reset: () => void;
}) {
  if (JSON.stringify(value) === JSON.stringify(original)) return null;
  return (
    <div className="change-control">
      <span className="changed-badge">Changed</span>
      <span>Original: {displayValue(original) || "Empty"}</span>
      <Button
        className="ghost small"
        aria-label={`Reset ${label}`}
        onClick={reset}
      >
        Reset
      </Button>
    </div>
  );
}
function ParameterControl({
  p,
  change,
  original,
}: {
  original?: Parameter;
  p: Parameter;
  change: (v: Parameter["value"]) => void;
}) {
  const id = `param-${p.id}`;
  return (
    <div className="parameter">
      {original && (
        <ChangeControl
          label={p.label}
          value={p.value}
          original={original.value}
          reset={() => change(original.value)}
        />
      )}
      <div className="control-heading">
        <label htmlFor={id}>{p.label}</label>
        {p.type === "slider" && (
          <span className="value-pill">
            {String(p.value)}
            <span> / {p.max ?? 5}</span>
          </span>
        )}
        {p.type === "toggle" && (
          <Toggle id={id} checked={Boolean(p.value)} onChange={change} />
        )}
      </div>
      {p.description && <p className="description">{p.description}</p>}
      {p.type === "slider" ? (
        <>
          <Range
            id={id}
            label={p.label}
            value={Number(p.value)}
            min={p.min}
            max={p.max}
            step={p.step}
            onChange={change}
          />
          <div className="range-labels">
            <span>Less</span>
            <span>More</span>
          </div>
        </>
      ) : p.type === "select" ? (
        <select
          id={id}
          value={String(p.value)}
          onChange={(e) => change(e.target.value)}
        >
          {p.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : p.type === "textarea" ? (
        <textarea
          id={id}
          value={String(p.value)}
          onChange={(e) => change(e.target.value)}
          rows={3}
        />
      ) : p.type === "number" ? (
        <input
          id={id}
          type="number"
          min={p.min}
          max={p.max}
          step={p.step}
          value={Number(p.value)}
          onChange={(e) => change(e.target.valueAsNumber)}
        />
      ) : p.type === "text" ? (
        <input
          id={id}
          value={String(p.value)}
          onChange={(e) => change(e.target.value)}
        />
      ) : p.type !== "toggle" ? (
        <JsonInput value={p.value} onChange={change} label={p.label} />
      ) : null}
      {p.previews?.[String(p.value)]?.trim() && (
        <p className="value-guidance">{p.previews[String(p.value)]}</p>
      )}
      {p.suggested !== undefined && (
        <div className="suggestion">
          <Sparkles size={12} /> Suggested:{" "}
          {typeof p.suggested === "boolean"
            ? p.suggested
              ? "On"
              : "Off"
            : typeof p.suggested === "object"
              ? JSON.stringify(p.suggested)
              : String(p.suggested)}
        </div>
      )}
    </div>
  );
}
function JsonInput({
  value,
  onChange,
  label,
}: {
  value: Parameter["value"];
  onChange: (v: Parameter["value"]) => void;
  label: string;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);
  const lastValue = useRef(value);
  useEffect(() => {
    if (lastValue.current !== value) {
      setText(JSON.stringify(value, null, 2));
      setInvalid(false);
      lastValue.current = value;
    }
  }, [value]);
  return (
    <>
      <textarea
        aria-label={label}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            lastValue.current = parsed;
            onChange(parsed);
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && (
        <small role="alert">
          Invalid JSON; the last valid value will be saved.
        </small>
      )}
    </>
  );
}
export function Editor({ initial }: { initial: PlanRecord }) {
  const [record, setRecord] = useState(initial);
  const [plan, setPlan] = useState<Plan>(initial.plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const dirty = JSON.stringify(plan) !== JSON.stringify(record.plan);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const changedCount = planDiff({ ...record, plan }).changes.length;
  async function save(ready: boolean) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await api(`/api/plans/${record.id}`, "PATCH", {
        revision: record.revision,
        plan,
        status: ready ? "ready" : "draft",
      });
      setRecord(next);
      setPlan(next.plan);
      setNotice(
        ready
          ? "Ready for your agent. Tell it you’re done and share this plan URL."
          : "Your adjustments are saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const featureChange = (id: string, change: object) =>
    setPlan((p) => ({
      ...p,
      features: p.features.map((f) => (f.id === id ? { ...f, ...change } : f)),
    }));
  const addFeature = () => {
    if (!newTitle.trim()) return;
    setPlan((p) => ({
      ...p,
      features: [
        ...p.features,
        {
          id: crypto.randomUUID(),
          title: newTitle.trim(),
          description: newDescription,
          strength: 2,
          comments: "",
          source: "user",
        },
      ],
    }));
    setNewTitle("");
    setNewDescription("");
    setAdding(false);
  };
  return (
    <>
      <header className="topbar">
        <Brand />
        <div className="header-meta">
          <span
            className={`status-dot ${record.status === "ready" && !dirty ? "green" : ""}`}
          />
          {dirty
            ? "Unsaved changes"
            : record.status === "ready"
              ? "Ready for agent"
              : "Draft proposal"}
          <span className="divider" />
          <span>Revision {record.revision}</span>
        </div>
        <a className="quiet-link" href="/api-docs">
          <Code2 size={16} /> Agent API
        </a>
      </header>
      <main className="workspace review-workspace">
        <div className="breadcrumb">
          <a href="/">
            <ArrowLeft size={13} /> Workspace
          </a>
          <span>/</span>
          <span>Plan review</span>
        </div>
        <div className="page-heading">
          <div>
            <div className="eyebrow">A LITTLE LESS GUESSWORK</div>
            <h1>{plan.title}</h1>
            <p>
              {plan.brief ||
                "Shape the scope. Leave your thoughts. Build what matters."}
            </p>
          </div>
          <span className="review-badge">
            <span /> In your hands
          </span>
        </div>
        <div className="workflow">
          <span className="completed">
            <Check size={14} /> Agent proposes
          </span>
          <div />
          <span className="active">
            <span className="step">2</span> You shape the plan
          </span>
          <div />
          <span>
            <span className="step">3</span> Agent picks it up
          </span>
        </div>
        <p className="review-summary">
          {plan.features.filter((f) => f.strength > 0).length} features included
          · {changedCount} {changedCount === 1 ? "change" : "changes"} from the
          original proposal
        </p>
        <div className="review-surface" inert={busy}>
          <section className="controls-column">
            <div className="section-title">
              <h2>
                <SlidersHorizontal size={18} /> Parameters
              </h2>
              <span className="count">{plan.parameters.length}</span>
            </div>
            <p className="section-description">
              Start with the defaults. Make them yours.
            </p>
            <div className="card parameter-card review-parameters">
              {plan.parameters.length ? (
                plan.parameters.map((p) => (
                  <ParameterControl
                    key={p.id}
                    p={p}
                    original={record.original.parameters.find(
                      (o) => o.id === p.id,
                    )}
                    change={(value) =>
                      setPlan((current) => ({
                        ...current,
                        parameters: current.parameters.map((item) =>
                          item.id === p.id ? { ...item, value } : item,
                        ),
                      }))
                    }
                  />
                ))
              ) : (
                <p className="empty">
                  No parameters supplied. Add features and notes below, or have
                  your agent suggest controls.
                </p>
              )}
            </div>
            <section className="plan-section" aria-labelledby="plan-heading">
              <div className="section-title">
                <h2 id="plan-heading">
                  <FileText size={18} /> The plan
                </h2>
              </div>
              <p className="section-description">
                Controls update scope explanations. Your agent revises the plan
                text after review.
              </p>
              {JSON.stringify(plan.content) !==
                JSON.stringify(record.original.content) && (
                <p className="changed-badge">Plan content changed</p>
              )}
              {JSON.stringify(plan.diagrams) !==
                JSON.stringify(record.original.diagrams) && (
                <p className="changed-badge">Diagrams changed</p>
              )}
              <div className="card preview-body markdown">
                <PlanContent plan={plan} onChange={setPlan} />
              </div>
            </section>
            <div className="section-title feature-heading">
              <h2>
                <Layers3 size={18} /> Features
              </h2>
              <Button
                className="ghost small"
                onClick={() => setAdding(!adding)}
              >
                <Plus size={15} /> Add feature
              </Button>
            </div>
            <p className="section-description">
              Decide how far each feature should go.
            </p>
            <div className="feature-list">
              {plan.features.map((f, index) => {
                const original = record.original.features.find(
                  (o) => o.id === f.id,
                );
                return (
                  <article
                    className={`card feature-card ${f.strength === 0 ? "feature-excluded" : ""}`}
                    key={f.id}
                  >
                    <div className="feature-top">
                      <span className="feature-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3>{f.title}</h3>
                      <span className="value-pill">
                        {f.strength}
                        <span> / 5</span>
                      </span>
                    </div>
                    {original ? (
                      <ChangeControl
                        label={`${f.title} strength`}
                        value={f.strength}
                        original={original.strength}
                        reset={() =>
                          featureChange(f.id, { strength: original.strength })
                        }
                      />
                    ) : (
                      <span className="changed-badge">Added feature</span>
                    )}
                    <p className="description">{f.description}</p>
                    <Range
                      id={`feature-${f.id}`}
                      label={`${f.title} strength`}
                      value={f.strength}
                      onChange={(strength) => featureChange(f.id, { strength })}
                    />
                    <div className="range-labels">
                      <span>
                        {f.strength === 0
                          ? "Excluded"
                          : depthLabels[f.strength]}
                      </span>
                      {f.suggested !== undefined && (
                        <span>Suggested: {f.suggested}</span>
                      )}
                    </div>
                    <p className="value-guidance">
                      {f.levels?.[String(f.strength)]?.trim() ||
                        depthLabels[f.strength]}
                    </p>
                    {original && (
                      <ChangeControl
                        label={`comments for ${f.title}`}
                        value={f.comments}
                        original={original.comments}
                        reset={() =>
                          featureChange(f.id, { comments: original.comments })
                        }
                      />
                    )}
                    <div className="feature-note">
                      <MessageSquare size={14} />
                      <input
                        aria-label={`Comments for ${f.title}`}
                        placeholder="Add a note for your agent…"
                        value={f.comments}
                        onChange={(e) =>
                          featureChange(f.id, { comments: e.target.value })
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </div>
            {adding && (
              <form
                className="card add-feature"
                onSubmit={(e) => {
                  e.preventDefault();
                  addFeature();
                }}
              >
                <div className="section-title">
                  <h3>Something missing?</h3>
                  <Button
                    type="button"
                    className="ghost icon-button"
                    aria-label="Close add feature"
                    onClick={() => setAdding(false)}
                  >
                    <X size={16} />
                  </Button>
                </div>
                <label htmlFor="new-title">Feature name</label>
                <input
                  id="new-title"
                  autoFocus
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Export as Markdown"
                />
                <label htmlFor="new-description">What should it do?</label>
                <textarea
                  id="new-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="A sentence or two is enough."
                />
                <Button className="primary" type="submit">
                  <Plus size={15} /> Add feature
                </Button>
              </form>
            )}
            <div className="card notes-card">
              <label htmlFor="plan-notes">
                <MessageSquare size={16} /> A note for your agent
              </label>
              <ChangeControl
                label="plan note"
                value={plan.comments}
                original={record.original.comments}
                reset={() =>
                  setPlan((p) => ({ ...p, comments: record.original.comments }))
                }
              />
              <textarea
                id="plan-notes"
                placeholder="Tradeoffs, constraints, or anything the sliders can’t say…"
                value={plan.comments}
                onChange={(e) =>
                  setPlan((p) => ({ ...p, comments: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="review-tools">
              <GuidanceHints plan={plan} />
              <details className="json-details card">
                <summary>Plan JSON</summary>
                <pre>{JSON.stringify(plan, null, 2)}</pre>
              </details>
            </div>
            <Button
              className="ghost copy-link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setNotice("Plan link copied.");
                } catch {
                  setError(
                    "Could not copy. Copy the URL from your address bar.",
                  );
                }
              }}
            >
              <Copy size={14} /> Copy plan link
            </Button>
          </section>
        </div>
      </main>
      <footer className="save-bar">
        <div>
          <span className={`status-dot ${!dirty ? "green" : ""}`} />
          <span>
            {dirty ? "You have unsaved adjustments" : "All adjustments saved"}
          </span>
          <span className="save-hint">
            Your agent can retrieve saved changes.
          </span>
        </div>
        <div>
          <Button disabled={busy || !dirty} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button
            className="primary"
            disabled={busy}
            onClick={() => save(true)}
          >
            <CheckCheck size={16} />
            {busy ? "Saving…" : "Ready for agent"}
          </Button>
        </div>
      </footer>
      {(error || notice) && (
        <div
          className={`toast ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error || notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
