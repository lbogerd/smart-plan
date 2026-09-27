# Smart Plan

A quiet Markdown reader with optional inline decisions. Read and adjust in the same document: select an underlined value, change its control, and collapse it to keep reading. Built with TanStack Start, Tailwind CSS, locally hosted Inter, and Radix primitives styled in the spirit of shadcn/ui.

<img src="public/icon.svg" width="64" height="64" alt="Smart Plan icon: a document with an adjustable line on a purple tile" />

The project icon lives in [`public/icon.svg`](public/icon.svg). Its document and inline adjustment mark use the app’s purple accent (`#5753b8`). The shared header and browser favicon use this same scalable asset.

## Run

```sh
npm ci
npm run dev
```

Development uses `http://127.0.0.1:3801`. `npm run build && npm start` serves the production build on port 3000. Set `PLAN_DATA_DIR` to change the JSON storage directory (default `./data`), and `APP_URL` to set the canonical browser-write origin.

```sh
sudo docker compose up --build --detach --wait
```

Compose binds only `127.0.0.1:3800`, uses `https://smart-plan.tainer.run`, and persists plans in the `smart-plan_plan-data` volume. The current deployment is a public research workspace. Writes are serialized within a single process, use atomic file replacement, and reject stale revisions. This is not a multi-worker storage system.

## Author a plan

Upload a `.md` file for a plain reading experience, or upload JSON / use the API for inline decisions. Markdown supports headings, lists, quotes, tables, code, images, and fenced Mermaid diagrams. Raw HTML is disabled. Diagrams are display-only and can be expanded.

```json
{
  "title": "Project map",
  "brief": "Explore project dependencies.",
  "content": "## Validation\n\nRun [essential checks](input:testing) before shipping.",
  "parameters": [
    {
      "id": "testing",
      "label": "Testing effort",
      "type": "slider",
      "value": 1,
      "min": 0,
      "max": 2,
      "summaries": {
        "0": "manual checks",
        "1": "essential checks",
        "2": "integration tests"
      },
      "previews": {
        "0": "Verify by hand.",
        "1": "Build and core-flow smoke test.",
        "2": "Test persistence and graph interactions."
      }
    }
  ]
}
```

`[label](input:id)` references a parameter by ID. The rendered link text is the current value, or its short `summaries` entry. `previews` supplies the longer explanation shown with the expanded control; `description` is its fallback. Each control appears below the containing Markdown block. References in lists, quotes, headings, and tables work too. Repeated references share a value. Unresolved references render their label as plain text, and parameters without references do not appear. Code samples are never interpreted as controls.

Only one adjustment is open at a time. Enter/Space opens it, Escape or the close button collapses it and restores focus. Adjustments stay local until **Save draft** or **Mark ready**. Reset restores a value from the immutable original. Failed saves preserve the local draft; leaving with unsaved changes prompts the browser’s normal confirmation. Marking ready does not call an agent.

Plan content is Markdown text. There is no source editor, JSON editor, feature-card system, or separate editing mode. Custom metadata on plans and parameters is preserved, but legacy structured content and editor behavior are intentionally unsupported.

### Inputs

Supported types: `slider`, `number`, `text`, `textarea`, `select`, `toggle`, `multi-select`, `radio`, `choice-cards`, `list`, `ranking`, `range`, `date`, `date-range`, `url`, and `file`.

- All inputs have unique `id`, `label`, `type`, and `value` fields. Optional `summaries`, `previews`, `description`, and `suggested` describe values.
- Sliders default to 0–5, step 1. Numeric controls accept `min`, `max`, and `step`.
- Select and choice controls require `options`; select accepts `presentation: "dropdown" | "radio" | "cards"`.
- Multi-select values are unique option strings. Rankings contain every option in the chosen order. Lists contain strings and support adding, removal, and keyboard-accessible reordering.
- Ranges use `[lower, upper]`. Dates use `YYYY-MM-DD` or an empty string. Date ranges use `{ "start": "", "end": "" }` with ordered endpoints.
- URLs use HTTP(S) or an empty string. Attachments use arrays of `{ name, type, size, data }`, where data is raw base64 and size is decoded bytes. Limits: 256 KiB per file, 512 KiB total. Attachments share the plan’s visibility and remain in the original even after removal from the current plan.

See `examples/plan.json`, `examples/inputs-plan.json`, and `examples/mermaid-plan.json`. The library seeds a persistent example without overwriting its edits.

## API

1. `POST /api/plans` with a plan → HTTP 201, complete record and `planUrl`.
2. Share `planUrl` and wait for the user to complete their review.
3. `GET /api/plans/{id}` → `{ id, revision, status, base: "original", changes }`.
4. Use the saved decisions to revise or implement the plan.

`changes` contains JSON Patch add/replace/remove operations relative to the immutable original, never the previous retrieval. Paths use JSON Pointer escaping and zero-based array indices. An unchanged plan returns `[]`.

- `GET /api/plans`: summaries ordered by last update, with `planUrl` and `isExample`.
- `GET /api/plans/{id}?full=true`: original, current plan, status, revision, and timestamps. Omit `full` or use `false` for the compact diff. Other values return 400.
- `PATCH /api/plans/{id}`: `{ "revision": 1, "plan": { ... }, "status": "ready" }`. Plan and status are optional. Send the **complete** plan, retaining metadata: it replaces rather than merges. Plan updates default to draft; every accepted update increments revision.
- `GET /health`: process health.

Errors: 400 malformed/invalid payload, 403 cross-origin browser writes, 404 missing plan, 409 stale revision, 413 request over 1 MB, 415 non-JSON body. Storage filenames are UUIDs. Responses are not cached. There is no automatic agent notification.

## Verify

```sh
npm run check
npm test
npm run build
# Run against an isolated local data directory; these tests create plans.
PLAN_DATA_DIR=/tmp/smart-plan-tests npm run dev -- --port 3802
node tests/browser.smoke.mjs
node tests/inputs.smoke.mjs
node tests/mermaid.smoke.mjs
# Read-only production verification
node tests/deployed.smoke.mjs
```

Set `BASE_URL` to test another origin. Browser tests use Playwright Chromium (`npx playwright install chromium`). They cover disclosures, keyboard focus, resets, all input families, file upload/download, save/reload, ready status, real revision conflicts, plain Markdown uploads, diagram rendering, and mobile overflow. Screenshots are written to ignored `test-results/`.

Approved visual references are in `docs/design/`. CSS uses Tailwind’s [Vite integration](https://tailwindcss.com/docs/installation/using-vite); Markdown rendering uses [react-markdown](https://github.com/remarkjs/react-markdown).
