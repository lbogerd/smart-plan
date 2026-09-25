import { planSchema } from "./schema";
export const example = planSchema.parse({
  title: "A calmer project planner",
  brief:
    "Review a plan, tune its scope, and leave feedback on one page. Try the controls, reset a change, and explore the workflow diagram before handing it back to your agent.",
  parameters: [
    {
      id: "testing",
      label: "Testing effort",
      type: "slider",
      value: 1,
      suggested: 1,
      description:
        "Start with essential checks. Add coverage when the risk calls for it.",
      previews: {
        "0": "Manual verification only.",
        "1": "Build checks and a smoke test of the core flow.",
        "2": "Tests for critical storage and API behavior.",
        "3": "Automated coverage of common workflows.",
        "4": "Edge cases and browser regression tests.",
        "5": "Broad integration, accessibility, and performance coverage.",
      },
    },
    {
      id: "libraries",
      label: "Implementation approach",
      type: "select",
      value: "Prefer existing libraries",
      suggested: "Prefer existing libraries",
      options: [
        "Prefer existing libraries",
        "Balanced",
        "Custom where justified",
      ],
      description: "Use established components for complex interactions.",
      previews: {
        "Prefer existing libraries":
          "Use established libraries for graphs, forms, and other complex interactions.",
        Balanced:
          "Use libraries for complex behavior and small custom components for simple UI.",
        "Custom where justified":
          "Build custom behavior only when existing libraries cannot meet the requirements.",
      },
    },
    {
      id: "polish",
      label: "Visual polish",
      type: "slider",
      value: 2,
      suggested: 2,
      description: "A coherent interface without a full design-system project.",
      previews: {
        "0": "Default browser styling.",
        "1": "Readable typography and spacing.",
        "2": "Consistent colors, controls, and a responsive layout.",
        "3": "Refined loading, empty, and error states.",
        "4": "Custom visual details and subtle transitions.",
        "5": "A comprehensive visual system and polished interactions.",
      },
    },
    {
      id: "persistence",
      label: "Save between visits",
      type: "toggle",
      value: true,
      suggested: true,
      description: "Keep plans in JSON files on the server.",
      previews: {
        true: "Save plans as JSON so they survive a restart.",
        false: "Keep plans only for the current session.",
      },
    },
    {
      id: "constraints",
      label: "Build constraints",
      type: "textarea",
      value: "Keep it small. Use TanStack Start and JSON files.",
      description:
        "For example: use a graph library and skip custom layout logic.",
    },
  ],
  features: [
    {
      id: "editor",
      title: "Parameter editor",
      description:
        "Tune the scope with sliders, selections, and notes. Changed controls show the original value and a reset action.",
      strength: 3,
      suggested: 3,
      levels: {
        "0": "Leave the editor out.",
        "1": "A single slider for overall scope.",
        "2": "Sliders, text fields, selects, and switches with clear defaults.",
        "3": "Group controls, show original values, and reset individual adjustments.",
        "4": "Add presets and undo support.",
        "5": "Reusable templates and advanced conditional controls.",
      },
    },
    {
      id: "preview",
      title: "Unified plan review",
      description:
        "Read the plan and diagrams alongside editable feature cards. Scope explanations update as you adjust each control.",
      strength: 2,
      suggested: 2,
      levels: {
        "0": "Leave the plan display out.",
        "1": "Display the original plan.",
        "2": "One review page with plan content, diagrams, and editable feature cards.",
        "3": "Add navigation between sections of long plans.",
        "4": "Interactive dependency visualization using a library.",
        "5": "Live agent regeneration with revision history.",
      },
    },
    {
      id: "handoff",
      title: "Agent handoff",
      description: "Create a plan, review it, and retrieve your decisions.",
      strength: 2,
      suggested: 2,
      levels: {
        "0": "No API handoff.",
        "1": "Manual JSON export.",
        "2": "Create, retrieve, and update plans through an API.",
        "3": "Add revision history and review comments.",
        "4": "Add webhook notifications.",
        "5": "Multiple agents and collaborative review workflows.",
      },
    },
  ],
  content: `## The smallest useful workflow

1. Read the proposal and its diagram on this page.
2. Adjust the parameters above and feature strengths below. The explanation next to each control describes the selected scope.
3. Changed controls show their original value. Use Reset to undo an individual adjustment, or add a note to explain a tradeoff.
4. Save a draft to keep your work. When the review is complete, select Ready for agent and tell your agent you are done.

## Review flow

\`\`\`mermaid
flowchart LR
  A[Agent proposes] --> B[Read and adjust]
  B --> C[Save draft]
  C --> B
  B --> D[Ready for agent]
  D --> E[Agent retrieves decisions]
  E --> F[Build the agreed scope]
\`\`\`

Use the diagram toolbar to zoom, open fullscreen, or export an image. Edit source and select Apply to plan, then save to keep diagram changes.

## What changes immediately?

Controls update the scope explanations and change count. They do not automatically rewrite this plan text or diagram. Your agent uses the saved settings, feature notes, and overall note to revise the implementation.

The change count compares with the original proposal. The save bar separately tells you whether your latest edits have been saved. JSON and optional authoring guidance are available at the bottom of the page.

## Implementation notes

Use TanStack Start for the interface and API routes, JSON files for persistence, and existing UI primitives for controls. Keep the plan, feature adjustments, and feedback in one continuous responsive page.

## Validation

Check keyboard controls, individual resets, save and reload, revision conflicts, diagram editing and exports, and the layout on a phone.
`,
});
