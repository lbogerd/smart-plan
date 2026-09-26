import { planSchema } from "./schema";
export const example = planSchema.parse({
  title: "Interactive project map",
  brief:
    "A focused way to explore project dependencies and understand how the pieces fit together.",
  content: `## The approach

Build a lightweight graph of files and dependencies. Make the relationships easy to follow.

> Make the relationships clear before adding ways to edit them.

## Exploring the graph

Use [React Flow](input:library) to render the graph.

::passage{id="graph-interactions"}

## Validation

Before shipping, run [essential checks](input:testing) against the selected scope. Verify that the graph loads and the chosen interactions behave as described.

## Remembering the layout

::passage{id="persistence-explanation"}

:::when{parameter="persistence" equals="true"}

### A small, durable model

Store positions by project ID, separate from the graph data. If a file disappears, discard its saved position; leave the rest of the layout intact.
:::

## Boundaries

[Use an existing library for layout.](input:constraints) Keep the graph model separate from rendering so each can be tested independently.
`,
  passages: [
    {
      id: "persistence-explanation",
      parameter: "persistence",
      cases: [
        {
          value: true,
          content:
            "Keep layout persistence [enabled](input:persistence). Save the current node positions and restore them when the project is reopened.",
        },
        {
          value: false,
          content:
            "Keep layout persistence [disabled](input:persistence). Node positions last only while the view is open. Reopening the project restores the default layout.",
        },
      ],
    },
    {
      id: "graph-interactions",
      parameter: "interaction",
      cases: [
        {
          value: 0,
          content:
            "Start with [a static overview](input:interaction). Show files and dependency edges in a fixed layout. Label each file so its connections can be understood without moving the graph.",
        },
        {
          value: 1,
          content:
            "Start with [pan and zoom](input:interaction). Let people explore the graph at different scales while keeping the node arrangement fixed.",
        },
        {
          value: 2,
          content:
            "Start with [pan, zoom, and drag](input:interaction) so people can arrange the map as they explore.\n\n1. **Render the project.** Show files and dependencies as a readable network of nodes and edges.\n2. **Make it explorable.** Follow connections without losing your place in the project.\n3. **Keep the context.** Label files and their immediate dependencies.",
        },
        {
          value: 3,
          content:
            "Start with [selection and filtering](input:interaction). Include pan, zoom, and drag, then let people narrow the map to selected files and relationships.",
        },
        {
          value: 4,
          content:
            "Start with [search and automatic layouts](input:interaction). Include basic graph interactions and filtering, then add file search and automatic arrangements.",
        },
        {
          value: 5,
          content:
            "Start with [grouping and collaboration](input:interaction). Include search and automatic layouts, then let people group related files and explore shared project maps together. Keep shared graph state separate from the optional saved node arrangement.",
        },
      ],
      fallback:
        "Set the interaction depth to [the chosen level](input:interaction). Confirm the intended interactions before implementing this custom level.",
    },
  ],
  parameters: [
    {
      id: "library",
      label: "Graph library",
      type: "select",
      value: "React Flow",
      options: ["React Flow", "Cytoscape.js", "Sigma.js"],
      previews: {
        "React Flow": "Nodes, edges, and familiar interactions out of the box.",
        "Cytoscape.js": "Graph analysis with a broad choice of layouts.",
        "Sigma.js": "WebGL rendering for larger networks.",
      },
    },
    {
      id: "interaction",
      label: "Interaction depth",
      type: "slider",
      value: 2,
      summaries: {
        "0": "a static overview",
        "1": "pan and zoom",
        "2": "pan, zoom, and drag",
        "3": "selection and filtering",
        "4": "search and automatic layouts",
        "5": "grouping and collaboration",
      },
      previews: {
        "0": "A read-only picture of the project.",
        "1": "Explore the graph without rearranging it.",
        "2": "Pan, zoom, and move nodes into a useful arrangement.",
        "3": "Focus the map on selected files and relationships.",
        "4": "Find files and arrange the graph automatically.",
        "5": "Organize related files and work on the map together.",
      },
    },
    {
      id: "testing",
      label: "Testing effort",
      type: "slider",
      value: 1,
      summaries: {
        "0": "manual checks",
        "1": "essential checks",
        "2": "core integration tests",
        "3": "workflow tests",
        "4": "browser regression tests",
        "5": "comprehensive tests",
      },
      previews: {
        "0": "Verify the main workflow by hand.",
        "1": "Build and core-flow smoke test.",
        "2": "Test persistence and graph interactions.",
        "3": "Automate the common user workflows.",
        "4": "Cover edge cases and browser regressions.",
        "5": "Include integration, accessibility, and performance coverage.",
      },
    },
    {
      id: "persistence",
      label: "Layout persistence",
      type: "toggle",
      value: true,
      description:
        "Choose whether node positions survive reopening the project.",
    },
    {
      id: "constraints",
      label: "Constraints",
      type: "textarea",
      value: "Use an existing library for layout.",
      description: "Keep the implementation focused.",
    },
  ],
});
