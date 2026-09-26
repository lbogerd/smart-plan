# Smart Plan

A quiet Markdown reader with optional inline decisions. Read and adjust in the same document: select an underlined value, change its control, and collapse it to keep reading. Built with TanStack Start, Tailwind CSS, locally hosted Inter, and Radix primitives styled in the spirit of shadcn/ui.

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

## Agent skill

The [Smart Plan skill](skills/smart-plan/SKILL.md) contains the instructions for agents to prepare plans and read user changes. Copy `skills/smart-plan` into your agent's skills directory to install it.

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

`[label](input:id)` references a parameter by ID. The rendered link text is the current value, or its short `summaries` entry. `previews` supplies the longer explanation shown with the expanded control; `description` is its fallback. Each control appears above the containing Markdown block. References in lists, quotes, headings, and tables work too. Repeated references share a value. Unknown input references are rejected on create/update; parameters without references do not appear. Code samples are never interpreted as controls.

Only one adjustment is open at a time. Enter/Space opens it, Escape or the close button collapses it and restores focus. Adjustments stay local until **Save draft** or **Mark ready**. Reset restores a value from the immutable original. Failed saves preserve the local draft; leaving with unsaved changes prompts the browser’s normal confirmation. Marking ready does not call an agent.

Plan content is Markdown text. There is no source editor, JSON editor, feature-card system, or separate editing mode. Custom metadata on plans and parameters is preserved, but legacy structured content and editor behavior are intentionally unsupported.

### Coherent passages and sections

Keep surrounding prose valid for every value of a value-only input. When the explanation depends on a decision, insert `::passage{id="persistence"}` and add a named entry to `passages`:

```json
{
  "id": "persistence",
  "parameter": "save",
  "cases": [
    {
      "value": true,
      "content": "Keep persistence [enabled](input:save). Restore the saved layout on reopening."
    },
    {
      "value": false,
      "content": "Keep persistence [disabled](input:save). Start with the default layout on reopening."
    }
  ]
}
```

The corresponding parameter is `{ "id": "save", "label": "Persistence", "type": "toggle", "value": true }`. Values match by strict typed equality. Toggles and choice controls require a case for every option, even when a fallback is supplied. Numeric and open-ended inputs need a `fallback` Markdown string unless a slider’s bounded step values are fully covered (up to 1,001 values). Empty fallback text is explicit and allowed. Array, range, and file inputs remain value-only controls.

Use a conditional container to show dependent instructions:

```markdown
:::when{parameter="save" equals="true"}

### Storage

Save positions by project ID.
:::
```

The parameter’s type determines how `equals` is parsed: exact text, a numeric literal, or `true`/`false`. No expressions or all/any operators run. Conditions can be nested with longer outer fences (`::::`). Each fence must close explicitly. Unknown directives are rejected; literal syntax belongs in inline code or fenced code blocks.

A controlling input must be reachable outside conditions and in every alternative of its containing passages. Place it outside a passage if some cases intentionally omit it. Validation checks every authored branch, regardless of current values, and rejects unknown references, duplicate IDs/cases, impossible case values, missing fallbacks/coverage, recursive passages, and unreachable controllers. Passage nesting is limited to eight levels and expanded plans to 20,000 Markdown nodes.

Passage controls remain mounted above the replaceable passage. A value change can replace a sentence with a list or headings while retaining the open control and cursor. Hidden sections keep their values; if the active control becomes hidden, focus returns to an available controller. There is no added rule-authoring UI.

**For agents:** fetch `?full=true`, use each current `parameters[].value` to select the matching passage case (or its explicit fallback), and include `when` contents only when the typed equality matches. Recursively apply the same rules to nested passages and sections, then substitute inline values. Only those resolved instructions apply. Authored Markdown and rules remain unchanged when a user adjusts a value; the API diff contains parameter changes, not a second generated document.

See `examples/choice-passages.json` for a three-way choice and `examples/plan.json` for persistence and interaction variants.

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
BASE_URL=http://127.0.0.1:3802 node tests/rules.smoke.mjs
# Read-only production verification
node tests/deployed.smoke.mjs
```

Set `BASE_URL` to test another origin. Browser tests use Playwright Chromium (`npx playwright install chromium`). They cover passage/condition combinations, typed validation, nested Markdown and passages, text-cursor preservation, repeated controls, hidden-control focus recovery, disclosures, keyboard focus, resets, all input families, file upload/download, save/reload, ready status, real revision conflicts, plain Markdown uploads, diagram rendering, and mobile overflow. Screenshots are written to ignored `test-results/`.

Approved visual references are in `docs/design/`. CSS uses Tailwind’s [Vite integration](https://tailwindcss.com/docs/installation/using-vite); Markdown rendering uses [react-markdown](https://github.com/remarkjs/react-markdown).
