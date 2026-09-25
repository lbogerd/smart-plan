import { createFileRoute } from "@tanstack/react-router";
import { getPlan, updatePlan, HttpError } from "../lib/store.server";
import { body, handle, json } from "../lib/http.server";
import { planDiff } from "../lib/plan-diff";
export const Route = createFileRoute("/api/plans/$id")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        handle(async () => {
          const full = new URL(request.url).searchParams.get("full");
          if (full !== null && full !== "true" && full !== "false")
            throw new HttpError(400, "full must be true or false");
          const record = await getPlan(params.id);
          return json(full === "true" ? record : planDiff(record));
        }),
      PATCH: ({ params, request }) =>
        handle(async () =>
          json(await updatePlan(params.id, await body(request))),
        ),
    },
  },
});
