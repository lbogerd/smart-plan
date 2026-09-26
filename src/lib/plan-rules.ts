import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import type { Root, Nodes } from "mdast";
import type { Parameter } from "./schema";

export type Scalar = string | number | boolean;
export type Passage = {
  id: string;
  parameter: string;
  cases: { value: Scalar; content: string }[];
  fallback?: string;
};
type RulePlan = {
  content: string;
  parameters: Parameter[];
  passages?: Passage[];
};
export type RuleIssue = { path: (string | number)[]; message: string };
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
export function parsePlanMarkdown(content: string) {
  const tree = parser.parse(content);
  const definitions = new Map<string, { url: string; title?: string | null }>();
  function definitionsIn(node: Nodes) {
    if (
      node.type === "definition" &&
      !definitions.has(node.identifier.toLowerCase())
    )
      definitions.set(node.identifier.toLowerCase(), node);
    if ("children" in node) node.children.forEach(definitionsIn);
  }
  definitionsIn(tree);
  function links(node: Nodes) {
    if ("children" in node) {
      node.children = node.children.map((child) => {
        if (child.type === "linkReference") {
          const definition = definitions.get(child.identifier.toLowerCase());
          if (definition)
            return {
              type: "link",
              url: definition.url,
              title: definition.title,
              children: child.children,
              position: child.position,
            };
        }
        links(child);
        return child;
      }) as typeof node.children;
    }
  }
  links(tree);
  return tree;
}
export function isDirective(node: Nodes) {
  return (
    node.type === "leafDirective" ||
    node.type === "containerDirective" ||
    node.type === "textDirective"
  );
}
export function scalarKind(p: Pick<Parameter, "type">) {
  if (p.type === "toggle") return "boolean";
  if (p.type === "slider" || p.type === "number") return "number";
  if (
    [
      "text",
      "textarea",
      "select",
      "radio",
      "choice-cards",
      "date",
      "url",
    ].includes(p.type)
  )
    return "string";
}
export function conditionValue(
  p: Pick<Parameter, "type">,
  text: string,
): Scalar {
  const kind = scalarKind(p);
  if (kind === "string") return text;
  if (kind === "boolean" && (text === "true" || text === "false"))
    return text === "true";
  if (
    kind === "number" &&
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) &&
    Number.isFinite(Number(text))
  )
    return Number(text);
  throw new Error("Condition value must match its parameter’s scalar type");
}
export function selectPassage(passage: Passage, value: unknown) {
  return (
    passage.cases.find((entry) => entry.value === value)?.content ??
    passage.fallback
  );
}
function domain(p: Parameter): Scalar[] | undefined {
  if (p.type === "toggle") return [true, false];
  if (["select", "radio", "choice-cards"].includes(p.type)) return p.options;
  if (p.type === "slider") {
    const min = p.min ?? 0,
      max = p.max ?? 5,
      step = p.step ?? 1;
    const count = (max - min) / step;
    if (Number.isInteger(count) && count >= 0 && count <= 1000)
      return Array.from({ length: count + 1 }, (_, i) =>
        Number((min + i * step).toPrecision(12)),
      );
  }
}
const key = (value: Scalar) => `${typeof value}:${JSON.stringify(value)}`;

// Validate all authored alternatives, not just the branch selected at upload.
export function validatePlanRules(
  plan: RulePlan,
  validValue: (p: Parameter, value: Scalar) => boolean,
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const add = (path: (string | number)[], message: string) => {
    if (issues.length < 50) issues.push({ path, message });
  };
  const parameters = new Map(plan.parameters.map((p) => [p.id, p]));
  const passages = new Map((plan.passages ?? []).map((p) => [p.id, p]));
  const trees = new Map<string, Root>();
  const parse = (text: string) => {
    if (!trees.has(text)) trees.set(text, parsePlanMarkdown(text));
    return trees.get(text)!;
  };
  const controllers = new Set<string>();

  function inspect(text: string, path: (string | number)[]) {
    function visit(node: Nodes, depth: number) {
      if (depth > 64) {
        add(path, "Markdown nesting is too deep");
        return;
      }
      if (
        node.type === "link" &&
        node.url.startsWith("input:") &&
        !parameters.has(node.url.slice(6))
      )
        add(path, `Unknown input reference: ${node.url.slice(6)}`);
      // CommonMark recovers malformed directives as text. Reject reserved rule
      // markers outside code so a typo cannot silently turn a rule into prose.
      if (node.type === "text") {
        const raw = text.slice(
          node.position?.start.offset,
          node.position?.end.offset,
        );
        if (/(?:^|\n)\s*:{1,}(?:passage|when)\b/.test(raw))
          add(
            path,
            'Malformed plan directive; use ::passage{id="…"} or a closed :::when block',
          );
      }
      if (isDirective(node)) {
        const attrs = node.attributes ?? {};
        if (node.name === "passage" && node.type === "leafDirective") {
          if (
            Object.keys(attrs).some((k) => k !== "id") ||
            !attrs.id ||
            node.children.length
          )
            add(path, "A passage directive needs only an id and no label");
          if (!passages.has(attrs.id ?? ""))
            add(path, `Unknown passage: ${attrs.id ?? "(missing id)"}`);
        } else if (node.name === "when" && node.type === "containerDirective") {
          const p = parameters.get(attrs.parameter ?? "");
          if (
            Object.keys(attrs).some(
              (k) => !["parameter", "equals"].includes(k),
            ) ||
            !attrs.parameter ||
            attrs.equals === undefined ||
            node.children.some(
              (c) =>
                c.data && "directiveLabel" in c.data && c.data.directiveLabel,
            )
          )
            add(
              path,
              "A when block needs only parameter and equals attributes",
            );
          if (!p)
            add(
              path,
              `Unknown condition parameter: ${attrs.parameter ?? "(missing parameter)"}`,
            );
          else {
            controllers.add(p.id);
            try {
              const value = conditionValue(p, attrs.equals ?? "");
              if (!validValue(p, value))
                add(
                  path,
                  `Condition for ${p.id} uses a value outside its allowed values`,
                );
            } catch {
              add(
                path,
                `Condition for ${p.id} must use a valid ${scalarKind(p) ?? "scalar"} value`,
              );
            }
          }
          const raw = text.slice(
            node.position?.start.offset,
            node.position?.end.offset,
          );
          const opening = raw.match(/^(:{3,})/)?.[1].length ?? 3;
          const closing =
            raw
              .trimEnd()
              .split("\n")
              .at(-1)
              ?.match(/^[\s>]*(:{3,})\s*$/)?.[1].length ?? 0;
          const lastLine = raw.trimEnd().split("\n").at(-1)!;
          const closingStart =
            (node.position?.end.offset ?? 0) - lastLine.length;
          if (
            closing < opening ||
            !raw.includes("\n") ||
            (node.children.at(-1)?.position?.end.offset ?? 0) > closingStart
          )
            add(path, "Every when block needs its own closing ::: fence");
        } else
          add(
            path,
            `Unsupported directive: ${node.name}; use ::passage or :::when`,
          );
      }
      if ("children" in node)
        node.children.forEach((child) => visit(child, depth + 1));
    }
    visit(parse(text), 0);
  }

  const seen = new Set<string>();
  (plan.passages ?? []).forEach((passage, index) => {
    const path = ["passages", index];
    if (seen.has(passage.id)) add(path, `Duplicate passage ID: ${passage.id}`);
    seen.add(passage.id);
    const p = parameters.get(passage.parameter);
    if (!p) add(path, `Unknown passage parameter: ${passage.parameter}`);
    else {
      const values = new Set<string>();
      passage.cases.forEach((entry, i) => {
        if (typeof entry.value !== scalarKind(p) || !validValue(p, entry.value))
          add(
            [...path, "cases", i],
            `Case for ${p.id} must match its type and allowed values`,
          );
        if (values.has(key(entry.value)))
          add([...path, "cases", i], `Duplicate case value for ${p.id}`);
        values.add(key(entry.value));
      });
      const possible = domain(p);
      const complete = possible && possible.every((v) => values.has(key(v)));
      if (
        ["toggle", "select", "radio", "choice-cards"].includes(p.type) &&
        !complete
      )
        add(
          path,
          `Passage ${passage.id} needs a case for every value of ${p.id}`,
        );
      if (!complete && passage.fallback === undefined)
        add(path, `Passage ${passage.id} needs an explicit fallback`);
      if (!scalarKind(p))
        add(path, `Passage ${passage.id} must reference a scalar input`);
      if (selectPassage(passage, p.value) === undefined)
        add(
          path,
          `Passage ${passage.id} has no case or fallback for the current value`,
        );
    }
    passage.cases.forEach((entry, i) =>
      inspect(entry.content, [...path, "cases", i, "content"]),
    );
    if (passage.fallback !== undefined)
      inspect(passage.fallback, [...path, "fallback"]);
  });
  inspect(plan.content, ["content"]);
  if (issues.length) return issues;

  // Bound recursion and expansion, including repeated references to shared
  // passages. Never execute author-supplied expressions.
  const costCache = new Map<string, number>();
  function cost(text: string, stack: string[]): number {
    let total = 0;
    function visit(node: Nodes) {
      total++;
      if (isDirective(node) && node.name === "passage") {
        const id = node.attributes!.id!;
        if (stack.includes(id))
          throw new Error(
            `Recursive passage reference: ${[...stack, id].join(" → ")}`,
          );
        if (stack.length >= 8)
          throw new Error("Passage nesting exceeds 8 levels");
        const passage = passages.get(id)!;
        // Depth still needs checking for paths reached through shared nodes.
        const alternatives = [
          ...passage.cases.map((c) => c.content),
          ...(passage.fallback === undefined ? [] : [passage.fallback]),
        ];
        const cacheKey = `${id}/${stack.join("/")}`;
        if (!costCache.has(cacheKey))
          costCache.set(
            cacheKey,
            Math.max(...alternatives.map((s) => cost(s, [...stack, id])), 0),
          );
        total += costCache.get(cacheKey)!;
      }
      if (total > 20000)
        throw new Error("Expanded plan exceeds 20,000 Markdown nodes");
      if ("children" in node) node.children.forEach(visit);
    }
    visit(parse(text));
    return total;
  }
  try {
    cost(plan.content, []);
    for (const passage of passages.values())
      for (const entry of [
        ...passage.cases,
        ...(passage.fallback === undefined
          ? []
          : [{ content: passage.fallback }]),
      ])
        cost(entry.content, [passage.id]);
  } catch (error) {
    add(["passages"], (error as Error).message);
    return issues;
  }

  // A controller must be present outside conditions in every alternative of
  // its containing passage. This conservative rule is independent of the
  // current values and prevents hidden-controller cycles across decisions.
  const guaranteed = new Map<string, Set<string>>();
  function stableInputs(text: string): Set<string> {
    const result = new Set<string>();
    function visit(node: Nodes) {
      if (isDirective(node) && node.name === "when") return;
      if (node.type === "link" && node.url.startsWith("input:"))
        result.add(node.url.slice(6));
      if (isDirective(node) && node.name === "passage") {
        const passage = passages.get(node.attributes!.id!)!;
        controllers.add(passage.parameter);
        if (!guaranteed.has(passage.id)) {
          const variants = passage.cases.map((c) => c.content);
          if (passage.fallback !== undefined) variants.push(passage.fallback);
          const refs = variants.map(stableInputs);
          guaranteed.set(
            passage.id,
            new Set(
              [...(refs[0] ?? [])].filter((id) => refs.every((s) => s.has(id))),
            ),
          );
        }
        guaranteed.get(passage.id)!.forEach((id) => result.add(id));
      }
      if ("children" in node) node.children.forEach(visit);
    }
    visit(parse(text));
    return result;
  }
  // Include passage controllers referenced inside conditional branches too.
  function collectControllers(text: string, visited = new Set<string>()) {
    function visit(node: Nodes) {
      if (isDirective(node) && node.name === "passage") {
        const p = passages.get(node.attributes!.id!)!;
        controllers.add(p.parameter);
        if (!visited.has(p.id)) {
          visited.add(p.id);
          p.cases.forEach((c) => collectControllers(c.content, visited));
          if (p.fallback !== undefined) collectControllers(p.fallback, visited);
        }
      }
      if ("children" in node) node.children.forEach(visit);
    }
    visit(parse(text));
  }
  collectControllers(plan.content);
  const visible = stableInputs(plan.content);
  for (const id of controllers)
    if (!visible.has(id))
      add(
        ["content"],
        `Keep an input:${id} control outside conditions and present in every passage alternative so the decision always remains reachable`,
      );
  return issues;
}

// The Markdown renderer keeps directive wrappers stable while their contents
// change. Only these two known directives can introduce custom components.
export function planDirectives({ scope = "plan" } = {}) {
  return (tree: Root) => {
    const occurrences = new Map<string, number>();
    function visit(node: Nodes) {
      if (isDirective(node)) {
        const attrs = node.attributes ?? {};
        const identity = `${node.name}-${encodeURIComponent(attrs.id ?? attrs.parameter ?? "")}`;
        const occurrence = occurrences.get(identity) ?? 0;
        occurrences.set(identity, occurrence + 1);
        const data = (node.data ??= {});
        data.hName =
          node.name === "passage" ? "plan-passage" : "plan-condition";
        data.hProperties = {
          "data-passage": attrs.id ?? "",
          "data-parameter": attrs.parameter ?? "",
          "data-equals": attrs.equals ?? "",
          "data-scope": `${scope}/${identity}-${occurrence}`,
        };
      }
      if ("children" in node) node.children.forEach(visit);
    }
    visit(tree);
  };
}
