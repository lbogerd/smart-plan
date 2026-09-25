import { createContext, useContext } from "react";
import Markdown, { type Components } from "react-markdown";
import type { Plan } from "../lib/schema";
import { MermaidDiagram } from "./mermaid-diagram";

const ContentContext = createContext<{
  content: string;
  change: (content: string) => void;
}>({ content: "", change: () => {} });
const components: Components = {
  pre({ node, children, ...props }) {
    const { content, change } = useContext(ContentContext);
    const code = node?.children[0];
    if (
      code?.type !== "element" ||
      code.tagName !== "code" ||
      !(code.properties.className as string[] | undefined)?.includes(
        "language-mermaid",
      )
    )
      return <pre {...props}>{children}</pre>;
    const source = code.children
      .map((child) => (child.type === "text" ? child.value : ""))
      .join("")
      .replace(/\n$/, "");
    const start = node?.position?.start.offset,
      end = node?.position?.end.offset;
    return (
      <MermaidDiagram
        source={source}
        onChange={
          start !== undefined && end !== undefined
            ? (updated) => {
                const fence = "`".repeat(
                  Math.max(
                    3,
                    ...Array.from(
                      updated.matchAll(/`+/g),
                      (match) => match[0].length + 1,
                    ),
                  ),
                );
                change(
                  content.slice(0, start) +
                    `${fence}mermaid\n${updated}\n${fence}` +
                    content.slice(end),
                );
              }
            : undefined
        }
      />
    );
  },
};
export function PlanContent({
  plan,
  onChange,
}: {
  plan: Plan;
  onChange: (plan: Plan) => void;
}) {
  return (
    <>
      {typeof plan.content === "string" ? (
        <ContentContext.Provider
          value={{
            content: plan.content,
            change: (content) => onChange({ ...plan, content }),
          }}
        >
          <Markdown components={components}>
            {plan.content || "No plan body supplied yet."}
          </Markdown>
        </ContentContext.Provider>
      ) : (
        <pre>{JSON.stringify(plan.content, null, 2)}</pre>
      )}
      {Array.isArray(plan.diagrams) &&
        plan.diagrams.map((diagram: unknown, index: number) => {
          if (
            !diagram ||
            typeof diagram !== "object" ||
            !("source" in diagram) ||
            typeof diagram.source !== "string"
          )
            return null;
          const entry = diagram as {
            id?: string;
            title?: string;
            source: string;
          };
          return (
            <MermaidDiagram
              key={typeof entry.id === "string" ? entry.id : index}
              source={entry.source}
              title={
                typeof entry.title === "string"
                  ? entry.title
                  : `Diagram ${index + 1}`
              }
              onChange={(source) =>
                onChange({
                  ...plan,
                  diagrams: (plan.diagrams as unknown[]).map((item, i) =>
                    i === index ? { ...diagram, source } : item,
                  ),
                })
              }
            />
          );
        })}
    </>
  );
}
