---
name: smart-plan
description: Use Smart Plan to prepare plans for user review and read user changes before implementation.
---

# Smart Plan

Use `https://smart-plan.tainer.run` as the base URL.
Read `/api-docs` before you prepare a request.

## Prepare the full plan

Complete the full plan before you convert it to Smart Plan.
Base the plan on the user's requirements.
Do not limit its scope or detail to fit the Smart Plan schema.
Include the necessary steps, decisions, reasons, dependencies, and checks.
Keep unresolved questions in the plan.

## Convert the plan to Smart Plan

Preserve the full plan during conversion.
Use inputs only where they help the user review a decision.
If an input cannot represent a decision, explain it in Markdown.
Do not remove or simplify a requirement to fit an input type.
Compare the Smart Plan content with the full plan before you send it.
Make sure that the conversion keeps all necessary information.

Write the plan for the user to read as one document.
Use a Markdown string for `content`.
Use short headings, paragraphs, and lists.
Keep labels and explanations short.
Use only the inputs that the plan needs.
A plan can contain no inputs.

Reading and adjustment use the same page.
The page first shows the plan with input values in the text.
The user selects a value to open its control.
The control opens above the related Markdown block or passage.
The control stays open above the text when the text changes.
There is no separate editor.

1. Set the plan title and brief.
2. Write the implementation steps in `content`.
3. Add each input to `parameters`.
4. Set its `id`, `label`, `type`, and initial `value`.
5. Put a reference to the input where its value belongs.
   Use `[label](input:id)`.
   The reference ID must equal the parameter ID.
6. If necessary, add short value labels in `summaries`.
7. If necessary, add value explanations in `previews`.
   Use `description` for a general explanation.
8. Check the text for each possible value.

The current value replaces the reference label.
A `summaries` entry replaces the displayed value when that entry exists.
The keys in `summaries` and `previews` are strings.
For toggle values, use the keys `"true"` and `"false"`.
The page shows explanations inside the open control.
Repeated references use the same parameter value.
The page shows only parameters that have references.

Use neutral explanations for the options.
Do not add a separate feature list or feature strength fields.
Use parameters for decisions about scope and effort.

## Keep the text correct

If all values fit the same sentence, use a simple input reference.
If a value changes the instructions, use a passage with alternatives.
Do not change only a value label when the remaining text becomes incorrect.

1. Put `::passage{id="layout"}` on its own line in `content`.
2. Add the passage to `passages`.
3. Set its `id` and `parameter`.
4. Add a case for each required value.
5. Write complete Markdown instructions in each case.

Example request:

```json
{
  "title": "Project map",
  "brief": "Control how the project map saves node positions.",
  "content": "## Layout\n\n::passage{id=\"layout\"}\n\n:::when{parameter=\"save\" equals=\"true\"}\n### Storage\n\nSave node positions by project ID.\n:::",
  "parameters": [
    {
      "id": "save",
      "label": "Save layout",
      "type": "toggle",
      "value": true,
      "description": "Choose if the application saves node positions."
    }
  ],
  "passages": [
    {
      "id": "layout",
      "parameter": "save",
      "cases": [
        {
          "value": true,
          "content": "Keep layout storage [enabled](input:save). Save node positions after each drag. Restore them when the project opens again."
        },
        {
          "value": false,
          "content": "Keep layout storage [disabled](input:save). Keep node positions only while the view is open. Start with the default layout when the project opens again."
        }
      ]
    }
  ]
}
```

Use string, number, or boolean values in cases.
The value and its type must equal the parameter value and type.
For toggles and choice inputs, supply a case for every option.
For numeric and text inputs, supply a `fallback` Markdown string.
A slider does not need `fallback` if cases cover all its permitted step values.
An empty fallback is permitted if the control remains available elsewhere.
Arrays, ranges, and files cannot control passages or conditional sections.

Use a `when` section for instructions that apply only to one value.
The example shows the required syntax.
The application hides the section when the value does not match.
The application keeps the parameter values in hidden sections.

Keep each rule's control available outside conditional sections.
Keep the control available in every passage alternative.
Do not make a passage refer to itself, directly or through another passage.
For nested sections, use more colons in the outer fence.
The API permits a maximum of eight passage levels and 20,000 expanded Markdown nodes.
Put literal directive examples in code blocks.
The application does not display raw HTML.

## Send the plan for review

1. Send the plan to `POST /api/plans`.
   Use `Content-Type: application/json`.
2. Keep the returned `id` and `original`.
3. Give the user the returned `planUrl`.
4. Wait for the user to finish the review.

The user can select "Save draft" or "Mark ready".
The "Mark ready" action does not send a message to the agent.

## Read user changes

1. When the user finishes, request `GET /api/plans/{id}?full=true`.
2. Read the current `plan` and `status`.
3. Use the current parameter values to select the applicable instructions.
4. For each passage, select the case with the same value and type.
   If no case matches, use its `fallback`.
5. Include a conditional section only when its comparison matches.
6. Apply these rules to passages and sections inside other passages or sections.
7. Replace input references with their current values or summaries.
8. Use the resulting instructions for the work that the user requests.

Do not implement instructions from cases or sections that do not apply.
User changes take priority over conflicting instructions in the original plan.
A value change does not change the stored Markdown or passage rules.

For a change list, request `GET /api/plans/{id}`.
Apply its JSON Patch `changes` in order to the saved `original`.
The changes always refer to the original plan.
They do not refer to the previous request.

## Update a plan

1. Request `GET /api/plans/{id}?full=true`.
2. Change the current `plan`.
3. Keep unknown fields.
4. Send `revision` and the complete `plan` to `PATCH /api/plans/{id}`.
5. If the service returns HTTP 409, read the latest record before another update.

A plan update replaces the current plan.
Its status defaults to `draft`.
Each save increases `revision`.
The service does not change `original`.

## Input formats

- `slider` and `number`: a number within the specified limits.
  Use `min`, `max`, and `step` where necessary.
  Sliders use limits of 0 and 5 unless you specify other limits.
- `text` and `textarea`: a string.
- `toggle`: a boolean.
- `select`, `radio`, and `choice-cards`: one string from `options`.
- `multi-select`: a string array with no repeated members of `options`.
- `list`: a string array in the required order.
- `ranking`: a string array with each member of `options` once, in the required order.
- `range`: `[lower, upper]`.
  The default `min`, `max`, and `step` values are 0, 5, and 1.
- `date`: a YYYY-MM-DD string or an empty string.
- `date-range`: `{ "start": "", "end": "" }`.
  Each date is empty or uses YYYY-MM-DD.
  If both dates have values, the start date must not follow the end date.
- `url`: an HTTP(S) URL or an empty string.
- `file`: an array of attachment objects.
  Example: `{ "name": "sample.txt", "type": "text/plain", "size": 3, "data": "YWJj" }`.
  The `data` field contains raw base64.
  The `size` field gives the decoded size in bytes.

For choice inputs, supply a nonempty `options` array with no repeated strings.
A `select` can use `presentation: "dropdown"`, `"radio"`, or `"cards"`.
This setting does not change the value format.

Each file must be 256 KiB or less.
The files in the current plan must total 512 KiB or less.
The API request limit is 1 MB.
Files have the same visibility as the plan.
The API includes files in the plan JSON.
Files from the initial request remain in `original`, even after removal from the current plan.
