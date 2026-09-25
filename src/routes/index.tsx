import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Upload, X } from "lucide-react";
import { api, Brand } from "../components/editor";
import { Button } from "../components/ui";
import { GuidanceHints } from "../components/guidance-hints";
import { example } from "../lib/example";
import { planSchema, type Plan, type PlanSummary } from "../lib/schema";
export const Route = createFileRoute("/")({ component: Home });
function Home() {
  const [plans, setPlans] = useState<PlanSummary[]>();
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"new" | "import" | null>(null);
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  async function load() {
    setListError("");
    try {
      setPlans(await api("/api/plans"));
    } catch (e) {
      setListError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  let importedPlan: Plan | undefined;
  try {
    const result = planSchema.safeParse(JSON.parse(raw));
    if (result.success) importedPlan = result.data;
  } catch {
    /* Show validation only on submit. */
  }
  async function create(input: unknown) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/plans", "POST", input);
      window.location.assign(`/plans/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <header className="topbar">
        <Brand />
        <a href="/api-docs" className="quiet-link">
          Agent API <ArrowRight size={15} />
        </a>
      </header>
      <main className="plan-library">
        <div className="library-heading">
          <h1>Plans</h1>
          <div className="library-actions">
            <Button
              aria-expanded={mode === "import"}
              onClick={() => {
                setMode(mode === "import" ? null : "import");
                setError("");
              }}
            >
              <Upload size={15} /> Import
            </Button>
            <Button
              className="primary"
              aria-expanded={mode === "new"}
              onClick={() => {
                setMode(mode === "new" ? null : "new");
                setError("");
              }}
            >
              <Plus size={15} /> New plan
            </Button>
          </div>
        </div>
        {mode && (
          <form
            className="card library-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "new")
                void create({ title, brief, parameters: example.parameters });
              else {
                try {
                  void create(JSON.parse(raw));
                } catch {
                  setError("Paste valid JSON to import a plan.");
                }
              }
            }}
          >
            <div className="section-title">
              <h2>{mode === "new" ? "New plan" : "Import plan"}</h2>
              <Button
                type="button"
                className="ghost icon-button"
                aria-label="Close form"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                <X size={16} />
              </Button>
            </div>
            {mode === "new" ? (
              <>
                <label htmlFor="title">Project name</label>
                <input
                  id="title"
                  autoFocus
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <label htmlFor="brief">Brief</label>
                <textarea
                  id="brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                />
              </>
            ) : (
              <>
                <label htmlFor="json">Plan JSON</label>
                <textarea
                  id="json"
                  autoFocus
                  className="code-input"
                  required
                  rows={7}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                />
                {importedPlan && <GuidanceHints plan={importedPlan} />}
              </>
            )}
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <Button className="primary" disabled={busy} type="submit">
              {busy
                ? "Saving…"
                : mode === "new"
                  ? "Create plan"
                  : "Import plan"}
            </Button>
          </form>
        )}
        {listError ? (
          <div className="inline-error" role="alert">
            {listError} <Button onClick={load}>Retry</Button>
          </div>
        ) : !plans ? (
          <p className="empty" role="status">
            Loading plans…
          </p>
        ) : (
          <div className="card plan-list">
            {plans.map((plan) => (
              <a className="plan-row" key={plan.id} href={`/plans/${plan.id}`}>
                <div className="plan-row-title">
                  <h2>{plan.title}</h2>
                  {plan.isExample && (
                    <span className="example-badge">Example</span>
                  )}
                </div>
                <div className="plan-row-meta">
                  <span className={`plan-status ${plan.status}`}>
                    {plan.status === "ready" ? "Ready" : "Draft"}
                  </span>
                  <time dateTime={plan.updatedAt} title={plan.updatedAt}>
                    {new Date(plan.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                  <ArrowRight size={16} />
                </div>
              </a>
            ))}
            {plans.length === 0 && <p className="empty">No plans yet.</p>}
          </div>
        )}
        <p className="library-note">
          Public workspace · Anyone can view and edit these plans.
        </p>
      </main>
    </>
  );
}
