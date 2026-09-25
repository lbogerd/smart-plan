# Smart Plan

A small TanStack Start app for reviewing an agent’s plan before building it. JSON files store each proposal and its adjustments. The interface uses Radix primitives with understated, shadcn/ui-inspired styling.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3801. For a production build, run `npm run build` then `npm start` (port 3000). Set `PLAN_DATA_DIR` to change the storage directory; it defaults to `./data`. Set `APP_URL` to the canonical external origin behind a proxy.

```sh
sudo docker compose up --build --detach --wait
```

Compose exposes only `127.0.0.1:3800`. Plans persist in the `smart-plan_plan-data` Docker volume as individual JSON files. Keep a backup of that volume. This prototype uses a single process: updates are serialized per plan and written via atomic rename. It is not intended for multiple workers sharing the directory.

## Review interface

The review page combines global parameters, the plan body and diagrams, editable feature cards, and notes in one continuous view. Changed controls show original values and individual resets. The change count compares the current plan with the original using JSON Patch, including content and diagram edits; unsaved status separately compares against the last save. JSON and optional authoring guidance are collapsed. A persistent action bar saves a draft or marks the review ready for the agent.

## Agent workflow

1. POST a proposal to `https://smart-plan.tainer.run/api/plans`.
2. Give the user the returned `editorUrl` and retain the plan ID.
3. Wait until the user says their adjustments are done.
4. GET `/api/plans/{id}` for a compact diff against the original proposal. Request `?full=true` when you need the complete record.
5. Use the current parameters, feature strengths, comments, and added features to revise the plan or implement it. Optionally PATCH a revised plan for another review.

The service does not call an LLM or automatically notify an agent. Inline scope explanations use agent-supplied descriptions; the submitted plan body stays unchanged until explicitly replaced.

```sh
curl https://smart-plan.tainer.run/api/plans \
  -H 'Content-Type: application/json' \
  --data-binary @examples/plan.json
```

### Flexible schema

`src/lib/schema.ts` exports `planSchema`, `parameterSchema`, `featureSchema`, and `updateSchema`.

The editor envelope has optional `title`, `brief`, `parameters`, `features`, `comments`, and `content`, all with defaults. `content` accepts **any JSON value**: Markdown, nested steps, graphs, arrays, or a custom document. `.passthrough()` preserves extra fields on plans, features, and parameters. Only recognized editor fields are constrained.

Parameter types: `slider`, `number`, `text`, `textarea`, `select`, `toggle`, `multi-select`, `radio`, `choice-cards`, `list`, `ranking`, `range`, `date`, `date-range`, `url`, and `file`. Unknown types get a JSON editor. Use `suggested` and `description` to explain defaults, and `previews` to map values to scope descriptions. Slider defaults are 0–5 with step 1; override `min`, `max`, and `step` as needed. Select controls require `options`. IDs must be unique within their collection.

New input formats (see `examples/inputs-plan.json`):

| Type | `value` | Configuration |
| --- | --- | --- |
| `multi-select` | Array of unique selected strings | Nonempty unique `options` |
| `radio`, `choice-cards` | One option string | Nonempty unique `options`; `previews` supplies option descriptions |
| `list` | Array of strings | Add, edit, remove, and reorder items |
| `ranking` | All option strings in order | Nonempty unique `options`; each appears exactly once |
| `range` | `[lower, upper]` | `min`, `max`, `step`; defaults 0, 5, 1 |
| `date` | `"YYYY-MM-DD"` or `""` | Calendar date without a time zone |
| `date-range` | `{ "start": "", "end": "" }` | Each date is empty or YYYY-MM-DD; start cannot follow end |
| `url` | HTTP(S) URL or `""` | Editable URL field |
| `file` | Array of `{ name, type, size, data }` | `data` is raw base64; `size` is decoded bytes |

Existing `select` parameters also accept `presentation: "dropdown" | "radio" | "cards"` (default dropdown), retaining their string value and options. Choice controls display optional `previews` beside each option. Ordering controls support keyboard-accessible up/down buttons.

Attachments persist inside the plan JSON and are included in API responses and diffs. Limits are 256 KiB per file and 512 KiB of decoded file data across the current plan; the overall 1 MB request limit still applies. Downloaded files use a binary Blob; they are not rendered inline. Files share the plan's public visibility. Removing a file from the current plan does not remove it from the immutable original if it was submitted there.

Features have `id`, `title`, optional `description`, a 0–5 `strength`, optional `suggested`, `comments`, and optional `levels` mapping strength values to scope descriptions. Strength 0 excludes a feature. When guidance is absent, the UI shows the value or its short level label. Guidance is recommended, never required: missing, partial, and empty maps remain valid. Supply an example or explanation for every slider step, select option, toggle value (`true`/`false`), and feature strength. For open-ended text, number, and custom controls, use `description` for a representative example. Optional authoring hints identify gaps without blocking saves.

### API

- `GET /api/plans`: summaries sorted by most recently updated (`id`, `title`, `status`, `updatedAt`, `editorUrl`, `isExample`). Initializes one persistent example on first use, without overwriting edits.
- `POST /api/plans`: raw plan document → HTTP 201, record plus `editorUrl`.
- `GET /api/plans/{id}` (or `?full=false`): `{ id, revision, status, base: "original", changes }`. Changes are JSON Patch `add`, `replace`, or `remove` operations, with JSON Pointer paths relative to the original plan. Apply them in order to `original` to obtain the current plan. Only new/changed values are included; no old values or unchanged content. Unchanged plans return `changes: []`. The diff is always against the immutable original, not the last GET or previous revision. Array indices are zero-based and reflect earlier operations; `~0` escapes `~` and `~1` escapes `/` in keys.
- `GET /api/plans/{id}?full=true`: complete record including immutable original, current plan, status, revision, and timestamps. Other `full` values return HTTP 400. POST and PATCH responses remain complete records.
- `PATCH /api/plans/{id}`: `{ "revision": 1, "plan": { ... }, "status": "ready" }` → updated record. `plan` and `status` are optional. The plan is replaced, not deep-merged: first fetch with `?full=true`, modify, and resend the complete current plan to preserve custom fields. Updates to a plan default back to draft unless status is explicitly supplied.
- `GET /health`: process health.

Errors: 400 invalid JSON/schema, 404 unknown ID, 409 stale revision, 413 request over 1 MB, 415 non-JSON content type. Every successful PATCH increments revision. File paths are restricted to UUIDs. Browser writes require the configured same origin. Responses are not cached.

The public prototype has no authentication. The landing page lists all plans, including one reusable example; anyone can browse, create, read, and edit plans. Rate limits, storage quotas, accounts, and multi-process locking are outside this proof of concept.

More examples and guidance are available at `/api-docs`.

## Checks

```sh
npm run check
npm test
npm run build
```

Tests cover arbitrary JSON round-trips, immutable originals, persistent writes, concurrent revision conflicts, invalid paths, and control validation. `tests/browser.smoke.mjs` exercises the create/edit/save/retrieve flow against `BASE_URL` (defaults to the public URL; use a local origin when APP_URL is unset). Run it with `node tests/browser.smoke.mjs` after installing Playwright’s Chromium.

Framework setup follows the official [TanStack Start setup](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch) and [Nitro hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting).

## Mermaid diagrams

Use fenced `mermaid` code blocks in Markdown `content`. The plan review page renders diagrams with live source editing, source copy, fullscreen, zoom/pan, and SVG/PNG exports. Select **Apply to plan**, then save the plan to persist source changes. PNG export has a white background and caps image dimensions to avoid excessive memory use.

For arbitrary JSON content, add a top-level `diagrams` array of `{ "id": "flow", "title": "Workflow", "source": "flowchart LR\n  A --> B" }` entries. This is an optional convention, not a required content structure. Entries with no string source stay preserved as data but do not render. The API retains source text; the existing diff format also covers diagram edits.

Mermaid loads only when a diagram is shown. Strict mode and SVG sanitization disable HTML, external images, and links. Invalid source shows an inline error. See `examples/mermaid-plan.json` for a complete example.
