import { createFileRoute } from "@tanstack/react-router";
import { createPlan, listPlans } from "../lib/store.server";
import { body, handle, json } from "../lib/http.server";
export const Route = createFileRoute("/api/plans")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () =>
          json(
            await listPlans(process.env.APP_URL || new URL(request.url).origin),
          ),
        ),
      POST: ({ request }) =>
        handle(async () => {
          const record = await createPlan(await body(request));
          return json(
            {
              ...record,
              planUrl: `${process.env.APP_URL || new URL(request.url).origin}/plans/${record.id}`,
            },
            201,
          );
        }),
    },
  },
});
