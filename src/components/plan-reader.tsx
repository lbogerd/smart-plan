import { useEffect, useRef, useState } from "react";
import { Check, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { planSchema, type Parameter, type PlanRecord } from "../lib/schema";
import { PlanContent } from "./plan-content";
import { Button, Header } from "./ui";

export function PlanReader({ initial }: { initial: PlanRecord }) {
  const [record, setRecord] = useState(initial);
  const [plan, setPlan] = useState(initial.plan);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [reading, setReading] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = JSON.stringify(plan) !== JSON.stringify(record.plan);
  useEffect(() => {
    document.title = `${plan.title} · Smart Plan`;
  }, [plan.title]);
  useEffect(() => {
    if (!dirty && !reading) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, reading]);
  async function save(status: "draft" | "ready") {
    if (saving.current || reading) return;
    setError("");
    setNotice("");
    const valid = planSchema.safeParse(plan);
    if (!valid.success) {
      setError(valid.error.issues.map((i) => i.message).join(". "));
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      const saved = await api(`/api/plans/${record.id}`, "PATCH", {
        revision: record.revision,
        plan: valid.data,
        status,
      });
      setRecord(saved);
      setPlan(saved.plan);
      setNotice(status === "ready" ? "Ready" : "Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function change(id: string, value: Parameter["value"]) {
    if (saving.current) return;
    setPlan((p) => ({
      ...p,
      parameters: p.parameters.map((parameter) =>
        parameter.id === id ? { ...parameter, value } : parameter,
      ),
    }));
    setNotice("");
    setError("");
  }
  const ready = record.status === "ready" && !dirty;
  const words =
    typeof plan.content === "string"
      ? plan.content.trim().split(/\s+/).length
      : 0;
  return (
    <>
      <Header>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Plans
        </a>
      </Header>
      <main
        id="main"
        className="mx-auto max-w-[790px] px-6 pb-20 pt-12 sm:px-8 sm:pt-20"
      >
        <article>
          <div className="mb-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <span>Project plan</span>
            <span className="h-px w-5 bg-border" />
            <span className={ready ? "text-accent" : ""}>
              {ready ? "Ready" : "Draft"}
            </span>
          </div>
          <h1 className="text-balance text-[36px] leading-[1.13] font-semibold tracking-[-0.055em] sm:text-[48px]">
            {plan.title}
          </h1>
          {plan.brief && (
            <p className="mt-5 text-pretty text-lg leading-relaxed tracking-[-0.012em] text-muted-foreground sm:text-[21px]">
              {plan.brief}
            </p>
          )}
          <div className="mb-11 mt-6 flex items-center gap-2.5 text-xs text-muted-foreground">
            <time dateTime={record.createdAt}>
              {new Date(record.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </time>
            <span aria-hidden="true">·</span>
            <span>{Math.max(1, Math.ceil(words / 220))} min read</span>
          </div>
          <fieldset disabled={busy} className="border-0 p-0">
            <legend className="sr-only">Plan decisions</legend>
            <PlanContent
              plan={plan}
              original={record.original}
              change={change}
              onReadingChange={(value) =>
                setReading((count) => count + (value ? 1 : -1))
              }
            />
          </fieldset>
        </article>
        <footer className="reader-actions mt-14 border-t border-border pt-5">
          {error && (
            <p
              className="mb-4 text-sm leading-relaxed text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span
              className="inline-flex items-center gap-2 text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Saving…
                </>
              ) : reading ? (
                "Reading files…"
              ) : dirty ? (
                <>
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </>
              ) : notice || ready ? (
                <>
                  <Check size={13} />
                  {notice || "Ready"}
                </>
              ) : (
                ""
              )}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {dirty && (
                <Button
                  disabled={busy || reading > 0}
                  onClick={() => save("draft")}
                >
                  Save draft
                </Button>
              )}
              <Button
                variant={ready ? "outline" : "primary"}
                disabled={busy || reading > 0 || ready}
                onClick={() => save("ready")}
              >
                {ready ? (
                  <>
                    <Check size={14} />
                    Ready
                  </>
                ) : (
                  "Mark ready"
                )}
              </Button>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
