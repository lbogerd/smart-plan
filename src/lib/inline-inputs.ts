import type { Element, Root } from "hast";
import type { Parameter } from "./schema";

export function inputSummary(p: Parameter): string {
  const summary = p.summaries?.[String(p.value)];
  if (summary) return summary;
  if (p.type === "toggle") return p.value ? "enabled" : "disabled";
  if (p.type === "file") {
    const files = p.value as { name: string }[];
    return files.length
      ? files.map((f) => f.name).join(", ")
      : "no attachments";
  }
  if (p.type === "date-range") {
    const range = p.value as { start: string; end: string };
    return `${range.start || "…"} – ${range.end || "…"}`;
  }
  if (Array.isArray(p.value))
    return p.value.join(p.type === "range" ? " – " : ", ") || "none selected";
  return String(p.value || (p.value === 0 ? "0" : "not set"));
}

// Rule wrappers keep their place in the tree. Passage controls live outside
// replaceable prose; normal controls precede their containing Markdown block.
export function inlineInputs({ scope = "plan", grouped = false } = {}) {
  return (tree: Root) => {
    function blocks(parent: Root | Element) {
      parent.children = parent.children.flatMap((block) => {
        const panels = new Map<string, string>();
        function walk(node: Root["children"][number]) {
          if (node.type === "element" && node.tagName === "plan-passage")
            return;
          if (node.type === "element" && node.tagName === "plan-condition") {
            blocks(node);
            return;
          }
          if (
            node.type === "element" &&
            node.tagName === "a" &&
            typeof node.properties.href === "string" &&
            node.properties.href.startsWith("input:")
          ) {
            const id = node.properties.href.slice(6);
            const panel = `${scope}/${grouped ? "passage" : `block-${block.position?.start.offset ?? 0}`}/${encodeURIComponent(id)}`;
            panels.set(id, panel);
            node.properties["data-input-id"] = id;
            node.properties["data-panel-id"] = panel;
          }
          if ("children" in node) node.children.forEach(walk);
        }
        walk(block);
        return [
          ...(grouped
            ? []
            : Array.from(panels, ([id, panel]): Element => ({
                type: "element",
                tagName: "input-panel",
                properties: { "data-input-id": id, "data-panel-id": panel },
                children: [],
              }))),
          block,
        ];
      });
    }
    blocks(tree);
  };
}
