import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Header, Button } from "../components/ui";
import { PlanReader } from "../components/plan-reader";
import type { PlanRecord } from "../lib/schema";
export const Route = createFileRoute("/plans/$id")({ component: PlanPage });
function PlanPage() {
  const { id } = Route.useParams();
  const [record, setRecord] = useState<PlanRecord>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRecord(undefined);
    setError("");
    api(`/api/plans/${id}?full=true`)
      .then((data) => {
        if (active) setRecord(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return record ? (
    <PlanReader key={record.id} initial={record} />
  ) : (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-[790px] px-6 py-20">
        {error ? (
          <div className="space-y-4">
            <p role="alert">{error}</p>
            <Button onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
            <a className="ml-4 text-sm text-muted-foreground" href="/">
              All plans
            </a>
          </div>
        ) : (
          <div className="space-y-6 motion-safe:animate-pulse" role="status">
            <span className="sr-only">Opening plan…</span>
            <div className="h-10 w-3/4 rounded bg-muted" />
            <div className="h-5 w-full rounded bg-muted" />
            <div className="mt-14 h-40 rounded bg-muted" />
          </div>
        )}
      </main>
    </>
  );
}
