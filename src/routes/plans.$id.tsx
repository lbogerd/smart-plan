import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, Brand, Editor } from "../components/editor";
import type { PlanRecord } from "../lib/schema";
export const Route = createFileRoute("/plans/$id")({ component: PlanPage });
function PlanPage() {
  const { id } = Route.useParams();
  const [record, setRecord] = useState<PlanRecord>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
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
  }, [id]);
  return record ? (
    <Editor key={record.id} initial={record} />
  ) : (
    <>
      <header className="topbar">
        <Brand />
      </header>
      <main className="landing">
        <h1>{error || "Opening your plan…"}</h1>
        {error && <a href="/">Back to workspace</a>}
      </main>
    </>
  );
}
