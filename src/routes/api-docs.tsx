import { createFileRoute } from "@tanstack/react-router";
import { Header, proseClass } from "../components/ui";
export const Route = createFileRoute("/api-docs")({ component: Docs });
function Docs() {
  return (
    <>
      <Header>
        <a href="/">Plans</a>
      </Header>
      <main id="main" className="mx-auto max-w-[790px] px-6 py-16 sm:px-8">
        <article className={proseClass}>
          <h1>Plan API</h1>
          <p>
            Submit Markdown, let someone adjust the decisions, then retrieve the
            changes.
          </p>
          <h2>Create</h2>
          <pre>{`POST /api/plans\nContent-Type: application/json\n\n${JSON.stringify({ title: "Project map", brief: "Explore project dependencies.", content: "## Validation\n\nRun [essential checks](input:testing) before shipping.", parameters: [{ id: "testing", label: "Testing effort", type: "slider", value: 1, min: 0, max: 2, summaries: { "0": "manual checks", "1": "essential checks", "2": "integration tests" }, previews: { "0": "Verify the core flow by hand.", "1": "Build and core-flow smoke test.", "2": "Test persistence and graph interactions." } }] }, null, 2)}`}</pre>
          <p>
            Returns the record and <code>planUrl</code>. Share that URL for
            review.
          </p>
          <h2>Inline decisions</h2>
          <p>
            Place a Markdown link with an <code>input:</code> destination
            wherever a value belongs:{" "}
            <code>[essential checks](input:testing)</code>. Its ID matches a
            parameter. The current value replaces the link text; optional{" "}
            <code>summaries</code> provide short labels, while{" "}
            <code>previews</code> explain values inside the expanded control.
            References in paragraphs, headings, lists, quotes, and tables expand
            below their containing block. Repeated references share one value.
            Only referenced parameters appear.
          </p>
          <p>
            Markdown without inputs is a plain reading experience. Fenced
            Mermaid diagrams render as diagrams. Raw HTML is disabled.
          </p>
          <h2>Inputs</h2>
          <p>
            Supported types: slider, number, text, textarea, select, toggle,
            multi-select, radio, choice-cards, list, ranking, range, date,
            date-range, url, and file.
          </p>
          <p>
            Every input needs an <code>id</code>, <code>label</code>,{" "}
            <code>type</code>, and <code>value</code>. Select and choice inputs
            use <code>options</code>. Numeric controls accept <code>min</code>,{" "}
            <code>max</code>, and <code>step</code>. Sliders default to 0–5. A
            select can use <code>presentation: "radio"</code> or{" "}
            <code>"cards"</code>.
          </p>
          <pre>
            {JSON.stringify(
              [
                { type: "multi-select", value: ["A"], options: ["A", "B"] },
                { type: "ranking", value: ["B", "A"], options: ["A", "B"] },
                { type: "list", value: ["First", "Second"] },
                { type: "range", value: [1, 4] },
                { type: "date", value: "2026-10-01" },
                {
                  type: "date-range",
                  value: { start: "2026-10-01", end: "2026-10-15" },
                },
                {
                  type: "file",
                  value: [
                    {
                      name: "note.txt",
                      type: "text/plain",
                      size: 3,
                      data: "YWJj",
                    },
                  ],
                },
              ],
              null,
              2,
            )}
          </pre>
          <p>
            Dates may be empty. URLs must use HTTP(S) or be empty. Attachments
            are base64 with matching byte sizes: 256 KiB per file, 512 KiB
            total. Uploads remain in the immutable original even if removed from
            the current plan.
          </p>
          <h2>Retrieve</h2>
          <pre>
            {
              "GET /api/plans\nGET /api/plans/{id}\nGET /api/plans/{id}?full=true"
            }
          </pre>
          <p>
            The list returns summaries. An individual plan returns JSON Patch
            changes against the immutable original; <code>?full=true</code>{" "}
            returns the complete record. Read <code>status</code> to distinguish
            draft from ready. Marking ready does not notify an agent.
          </p>
          <h2>Update</h2>
          <pre>
            {
              'PATCH /api/plans/{id}\nContent-Type: application/json\n\n{ "revision": 1, "plan": { "title": "Project map", "content": "…" }, "status": "draft" }'
            }
          </pre>
          <p>
            Send the latest revision and the complete plan, retaining custom
            metadata. A plan update replaces the plan and defaults to draft.
            Every save increments revision; a stale revision returns 409.
            Browser writes must match the configured origin.
          </p>
          <p>
            Plans have a title, brief, Markdown content, and optional
            parameters. Extra metadata is preserved. Requests are limited to 1
            MB. This public research workspace uses single-process JSON storage.
          </p>
        </article>
      </main>
    </>
  );
}
