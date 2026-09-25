import { createFileRoute } from "@tanstack/react-router";
import { Brand } from "../components/editor";
export const Route = createFileRoute("/api-docs")({ component: Docs });
function Docs() {
  return (
    <>
      <header className="topbar">
        <Brand />
        <a href="/">Back to workspace</a>
      </header>
      <main className="docs">
        <div className="eyebrow">FOR YOUR CODING AGENT</div>
        <h1>The proposal → review → build loop</h1>
        <p>
          Submit a plan, give the user its editor URL, and retrieve the saved
          decisions after they tell you they’re done. No API key is required for
          this public prototype.
        </p>
        <h2>Browse saved plans</h2>
        <pre>GET /api/plans</pre>
        <p>
          Returns an array of summaries ordered by most recently updated: id,
          title, status, updatedAt, editorUrl, and isExample. The list includes
          one persistent, editable example.
        </p>
        <h2>1. Create a proposal</h2>
        <pre>{`POST /api/plans\nContent-Type: application/json\n\n${JSON.stringify({ title: "My web project", brief: "Build the smallest useful version.", content: { steps: ["Use an existing graph library", "Implement the core flow"] }, parameters: [{ id: "testing", label: "Testing effort", type: "slider", value: 1, suggested: 1, min: 0, max: 5, previews: { "0": "Manual check", "1": "Build check and core-flow smoke test.", "2": "Core API checks", "3": "Common workflow tests", "4": "Edge-case coverage", "5": "Broad browser regression coverage" } }], features: [{ id: "graph", title: "Interactive graph", strength: 2, suggested: 2, levels: { "0": "Omit graphs", "1": "Static graph", "2": "Nodes, edges, and dragging using a library.", "3": "Editing and saving", "4": "Automatic layout", "5": "Advanced grouping and collaboration" } }], customMetadata: { anything: "is preserved" } }, null, 2)}`}</pre>
        <p>
          Returns HTTP 201 with <code>id</code>, <code>editorUrl</code>,{" "}
          <code>revision</code>, <code>original</code>, and <code>plan</code>.
          Keep the ID and give the user the editor URL.
        </p>
        <h2>2. Retrieve adjustments</h2>
        <pre>{"GET /api/plans/{id}"}</pre>
        <p>
          By default, returns only id, revision, status, and changes against the
          original proposal. No unchanged plan content is repeated.
        </p>
        <pre>
          {JSON.stringify(
            {
              id: "…",
              revision: 2,
              status: "ready",
              base: "original",
              changes: [
                { op: "replace", path: "/parameters/0/value", value: 0 },
                { op: "replace", path: "/features/1/strength", value: 1 },
              ],
            },
            null,
            2,
          )}
        </pre>
        <p>
          Changes use JSON Patch add, replace, and remove operations. Apply them
          in order to the original plan. Paths use zero-based array indices; ~0
          escapes a tilde and ~1 escapes a slash in field names. New values are
          included; old values are omitted. An unchanged plan returns an empty
          changes array. The comparison is always against the original, not your
          previous retrieval.
        </p>
        <pre>{"GET /api/plans/{id}?full=true"}</pre>
        <p>
          Use full=true for the complete record, including original, plan,
          timestamps, status, and revision. Omitting full or setting full=false
          returns the diff. Other values return HTTP 400. Ready means review is
          complete; it does not automatically trigger an agent.
        </p>
        <h2>3. Save a revised plan</h2>
        <pre>
          {
            'PATCH /api/plans/{id}\nContent-Type: application/json\n\n{\n  "revision": 2,\n  "status": "draft",\n  "plan": { "title": "Revised proposal", "content": "…" }\n}'
          }
        </pre>
        <p>
          Fetch the latest record with <code>?full=true</code> and send its full{" "}
          <code>plan</code> with your changes applied. The plan field replaces
          the current plan, so retain unknown fields. A stale revision returns
          HTTP 409. Every accepted update increments the revision. Updating a
          plan defaults its status back to draft.
        </p>
        <h2>A flexible envelope</h2>
        <ul>
          <li>
            <code>content</code> accepts any JSON: Markdown text, objects,
            arrays, or nested steps.
          </li>
          <li>
            Plan, feature, and parameter objects preserve additional fields.
          </li>
          <li>
            Known controls: slider, number, text, textarea, select, toggle,
            multi-select, radio, choice-cards, list, ranking, range, date,
            date-range, url, and file. Unknown control types use a JSON editor.
          </li>
          <li>
            Feature strength runs from 0 to 5. Optional <code>levels</code> and
            parameter <code>previews</code> map values to agent-written scope
            descriptions.
          </li>
          <li>
            Optional envelope fields get defaults. IDs within each collection
            must be unique.
          </li>
          <li>
            Requests are limited to 1 MB. JSON files persist in the service’s
            data volume.
          </li>
        </ul>
        <h2>Input value formats</h2>
        <pre>
          {JSON.stringify(
            [
              { type: "multi-select", options: ["A", "B"], value: ["A"] },
              { type: "radio", options: ["A", "B"], value: "A" },
              {
                type: "choice-cards",
                options: ["A", "B"],
                value: "A",
                previews: {
                  A: "Option A description",
                  B: "Option B description",
                },
              },
              {
                type: "select",
                presentation: "cards",
                options: ["A", "B"],
                value: "A",
              },
              { type: "list", value: ["Item"] },
              { type: "ranking", options: ["A", "B"], value: ["B", "A"] },
              { type: "range", min: 0, max: 10, step: 1, value: [2, 8] },
              { type: "date", value: "2026-10-01" },
              {
                type: "date-range",
                value: { start: "2026-10-01", end: "2026-10-15" },
              },
              { type: "url", value: "https://example.com" },
              {
                type: "file",
                value: [
                  {
                    name: "sample.txt",
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
          Each parameter also needs an id and label. Multi-select values are
          unique members of options. Rankings contain every option exactly once,
          in order. Radio, choice-cards, multi-select, and ranking require
          nonempty unique options. Select presentation can be dropdown
          (default), radio, or cards. Option descriptions use previews. Lists
          contain editable strings. Numeric ranges contain two ordered values
          within min and max (defaults 0 and 5). Dates use YYYY-MM-DD without a
          time zone and may be empty strings; date ranges allow either endpoint
          to be empty. URLs use HTTP(S) or an empty string.
        </p>
        <p>
          File data is raw base64, with its decoded byte length in size. Limits
          are 256 KiB per file and 512 KiB across the current plan; the 1 MB
          request limit also applies. Files persist in plan JSON and share its
          public visibility. Downloads are not rendered inline. Files in the
          immutable original remain there even if removed from the current plan.
        </p>
        <h2>Mermaid diagrams</h2>
        <p>
          Put a fenced mermaid block in Markdown content. The plan review page
          renders it with source editing, fullscreen, zoom/pan, and SVG or PNG
          downloads. Apply source edits to the plan, then save.
        </p>
        <pre>
          {JSON.stringify(
            {
              title: "Diagram example",
              content:
                "```mermaid\nflowchart LR\n  A[Idea] --> B[Plan]\n  B --> C[Build]\n```",
            },
            null,
            2,
          )}
        </pre>
        <p>
          For structured plans, add an optional top-level diagrams array. Give
          each entry a stable id, an optional title, and Mermaid source. The
          content field remains free-form JSON. Unknown fields remain intact.
        </p>
        <pre>
          {JSON.stringify(
            {
              title: "Structured example",
              content: { steps: ["Build the core flow"] },
              diagrams: [
                {
                  id: "workflow",
                  title: "Workflow",
                  source:
                    "sequenceDiagram\n  User->>Agent: Review complete\n  Agent-->>User: Build result",
                },
              ],
            },
            null,
            2,
          )}
        </pre>
        <p>
          Invalid diagrams show their source and an error without blocking the
          plan. Rendering uses strict mode. Raw HTML, embedded images, and
          diagram links are disabled.
        </p>
        <h2>Optional value descriptions</h2>
        <p>
          Descriptions can be supplied for discrete values: each slider step,
          select option, toggle value (keys <code>true</code> and{" "}
          <code>false</code>), and feature level from 0 to 5. Use parameter{" "}
          <code>previews</code> and feature <code>levels</code>.
        </p>
        <p>
          For open-ended text, numbers, and custom controls, put a description
          in <code>description</code>.
        </p>
        <p>
          Guidance is optional. Missing, partial, and empty maps remain valid.
          The editor shows guidance for the selected value and offers
          non-blocking suggestions for missing discrete-value guidance.
        </p>
        <h2>Inline scope explanations</h2>
        <p>
          Changing controls updates inline scope explanations, not the submitted
          plan body. Read the settings, comments, and new features, then revise
          the implementation plan yourself.
        </p>
        <h2>Public prototype</h2>
        <p>
          Anyone can browse, read, and edit plans in this public workspace.
          Storage is designed for one server process.
        </p>
      </main>
    </>
  );
}
