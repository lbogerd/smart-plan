import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, Upload, FileText } from "lucide-react";
import { api } from "../lib/api";
import { Button, Header } from "../components/ui";
import type { PlanSummary } from "../lib/schema";
export const Route = createFileRoute("/")({ component: Home });
function Home() {
  const [plans, setPlans] = useState<PlanSummary[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  async function load() {
    setError("");
    try {
      setPlans(await api("/api/plans"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    document.title = "Plans · Smart Plan";
    void load();
  }, []);
  async function importFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 1_048_576) throw new Error("Maximum file size is 1 MB.");
      const text = await file.text();
      const markdown = /\.(md|markdown|txt)$/i.test(file.name);
      const heading = text.match(/^#\s+(.+)$/m);
      const input = markdown
        ? {
            title: heading?.[1] || file.name.replace(/\.[^.]+$/, ""),
            content:
              heading && text.startsWith(heading[0])
                ? text.slice(heading[0].length).trimStart()
                : text,
          }
        : JSON.parse(text);
      const record = await api("/api/plans", "POST", input);
      window.location.assign(`/plans/${record.id}`);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "Choose a Markdown or valid JSON file."
          : (e as Error).message,
      );
      setBusy(false);
    }
  }
  return (
    <>
      <Header>
        <a
          href="/api-docs"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          API
          <ArrowUpRight size={14} />
        </a>
      </Header>
      <main
        id="main"
        className="mx-auto max-w-[880px] px-6 pb-20 pt-14 sm:px-8 sm:pt-24"
      >
        <div className="mb-12 flex items-end justify-between gap-4">
          <div>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Workspace
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
              Plans
            </h1>
          </div>
          <Button onClick={() => upload.current?.click()} disabled={busy}>
            <Upload size={14} />
            {busy ? "Uploading…" : "Upload plan"}
          </Button>
          <input
            ref={upload}
            type="file"
            accept=".md,.markdown,.txt,.json"
            aria-label="Upload Markdown or JSON"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-3 text-sm text-red-700"
          >
            {error}
            {!plans && <Button onClick={load}>Retry</Button>}
          </div>
        )}
        {!plans ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading plans…
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {plans.map((plan) => (
              <a
                key={plan.id}
                href={`/plans/${plan.id}`}
                className="group flex items-center gap-4 py-6 transition-colors hover:bg-muted/40 sm:gap-6"
              >
                <FileText
                  size={19}
                  strokeWidth={1.4}
                  className="hidden shrink-0 text-muted-foreground sm:block"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-medium tracking-tight">
                    {plan.title}
                  </h2>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {plan.isExample && (
                      <>
                        <span>Example</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{plan.status === "ready" ? "Ready" : "Draft"}</span>
                    <span>·</span>
                    <time dateTime={plan.updatedAt}>
                      {new Date(plan.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </time>
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="mr-2 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-accent"
                />
              </a>
            ))}
            {!plans.length && (
              <p className="py-10 text-muted-foreground">No plans yet.</p>
            )}
          </div>
        )}
      </main>
    </>
  );
}
