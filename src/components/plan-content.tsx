import {
  createContext,
  useLayoutEffect,
  memo,
  useMemo,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import {
  conditionValue,
  planDirectives,
  selectPassage,
} from "../lib/plan-rules";
import { ChevronDown, X, RotateCcw } from "lucide-react";
import type { Plan, Parameter } from "../lib/schema";
import { inlineInputs, inputSummary } from "../lib/inline-inputs";
import { MermaidDiagram } from "./mermaid-diagram";
import { ParameterControl } from "./parameter-control";
import { Button, proseClass } from "./ui";

type ReadingContext = {
  plan: Plan;
  parameters: Parameter[];
  original: Parameter[];
  active: string | null;
  open: (panel: string, trigger: HTMLButtonElement) => void;
  close: () => void;
  change: (id: string, value: Parameter["value"]) => void;
  onReadingChange: (reading: boolean) => void;
};
const Context = createContext<ReadingContext>(null!);
function Value({
  id,
  panel,
  children,
}: {
  id: string;
  panel: string;
  children: ReactNode;
}) {
  const ctx = useContext(Context);
  const p = ctx.parameters.find((p) => p.id === id);
  if (!p) return <>{children}</>;
  const expanded = ctx.active === panel;
  return (
    <button
      type="button"
      className="inline-value"
      data-parameter={id}
      data-panel={panel}
      aria-label={`Adjust ${p.label}: ${inputSummary(p)}`}
      aria-expanded={expanded}
      aria-controls={expanded ? panel : undefined}
      onClick={(e) =>
        expanded ? ctx.close() : ctx.open(panel, e.currentTarget)
      }
    >
      {inputSummary(p)}
      <ChevronDown
        aria-hidden="true"
        size={12}
        className={`ml-1 inline align-baseline transition-transform ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}
function Panel({ id, panel }: { id: string; panel: string }) {
  const ctx = useContext(Context);
  const p = ctx.parameters.find((p) => p.id === id);
  if (!p || ctx.active !== panel) return null;
  const original = ctx.original.find((p) => p.id === id);
  const changed =
    original && JSON.stringify(original.value) !== JSON.stringify(p.value);
  const guidance = p.previews?.[String(p.value)] || p.description;
  return (
    <section
      id={panel}
      role="region"
      aria-label={`${p.label} adjustment`}
      className="input-panel not-prose my-5 rounded-r-lg border-l-2 border-accent/60 bg-accent/[0.035] px-4 py-4 text-sm leading-relaxed sm:px-5"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          ctx.close();
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <label
          htmlFor={`param-${p.id}`}
          className="font-medium text-foreground"
        >
          {p.label}
        </label>
        <Button
          variant="ghost"
          className="-mr-2 size-8 min-h-8 p-0"
          aria-label={`Close ${p.label}`}
          onClick={ctx.close}
        >
          <X size={15} />
        </Button>
      </div>
      <ParameterControl
        p={p}
        change={(value) => ctx.change(p.id, value)}
        onReadingChange={ctx.onReadingChange}
      />
      {guidance && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {guidance}
        </p>
      )}
      {changed && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-accent/10 pt-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            Original: {inputSummary(original)}
          </span>
          <Button
            variant="ghost"
            className="min-h-7 py-1 text-xs"
            aria-label={`Reset ${p.label}`}
            onClick={() => ctx.change(p.id, original.value)}
          >
            <RotateCcw size={12} />
            Reset
          </Button>
        </div>
      )}
    </section>
  );
}
type CustomProps = {
  node?: { properties: Record<string, unknown> };
  children?: ReactNode;
};
function Passage({ id, scope }: { id: string; scope: string }) {
  const { plan } = useContext(Context);
  const passage = plan.passages?.find((p) => p.id === id);
  const parameter = plan.parameters.find((p) => p.id === passage?.parameter);
  const content = passage && selectPassage(passage, parameter?.value);
  return (
    <div data-passage={id}>
      <Document
        source={content ?? "Passage unavailable."}
        scope={scope}
        grouped
      />
      {plan.parameters.map((p) => (
        <Panel
          key={p.id}
          id={p.id}
          panel={`${scope}/passage/${encodeURIComponent(p.id)}`}
        />
      ))}
    </div>
  );
}
function Conditional({
  parameter,
  equals,
  children,
}: {
  parameter: string;
  equals: string;
  children?: ReactNode;
}) {
  const { plan } = useContext(Context);
  const p = plan.parameters.find((p) => p.id === parameter);
  let visible = false;
  try {
    visible = !!p && p.value === conditionValue(p, equals);
  } catch {
    /* Invalid persisted rules remain hidden. */
  }
  return (
    <div hidden={!visible} data-condition-parameter={parameter}>
      {children}
    </div>
  );
}
const components = {
  "plan-passage"({ node }: CustomProps) {
    return (
      <Passage
        id={String(node?.properties["data-passage"])}
        scope={String(node?.properties["data-scope"])}
      />
    );
  },
  "plan-condition"({ node, children }: CustomProps) {
    return (
      <Conditional
        parameter={String(node?.properties["data-parameter"])}
        equals={String(node?.properties["data-equals"])}
      >
        {children}
      </Conditional>
    );
  },
  a({ node, href, children, ...props }) {
    const id = node?.properties["data-input-id"];
    const panel = node?.properties["data-panel-id"];
    if (typeof id === "string" && typeof panel === "string")
      return (
        <Value id={id} panel={panel}>
          {children}
        </Value>
      );
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
  "input-panel"({ node }: { node?: { properties: Record<string, unknown> } }) {
    return (
      <Panel
        id={String(node?.properties["data-input-id"])}
        panel={String(node?.properties["data-panel-id"])}
      />
    );
  },
  pre({ node, children, ...props }) {
    const code = node?.children[0];
    if (
      code?.type === "element" &&
      code.tagName === "code" &&
      (code.properties.className as string[] | undefined)?.includes(
        "language-mermaid",
      )
    ) {
      const source = code.children
        .map((c) => (c.type === "text" ? c.value : ""))
        .join("")
        .trimEnd();
      return <MermaidDiagram source={source} />;
    }
    return <pre {...props}>{children}</pre>;
  },
} satisfies Components & Record<string, unknown>;

const Document = memo(function Document({
  source,
  scope,
  grouped = false,
}: {
  source: string;
  scope: string;
  grouped?: boolean;
}) {
  const remarkPlugins = useMemo(
    () =>
      [
        remarkGfm,
        remarkDirective,
        [planDirectives, { scope }],
      ] as import("unified").PluggableList,
    [scope],
  );
  const rehypePlugins = useMemo(
    () =>
      [[inlineInputs, { scope, grouped }]] as import("unified").PluggableList,
    [scope, grouped],
  );
  return (
    <Markdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
      urlTransform={(url) =>
        url.startsWith("input:") ? url : defaultUrlTransform(url)
      }
    >
      {source}
    </Markdown>
  );
});

export function PlanContent({
  plan,
  original,
  change,
  onReadingChange,
}: {
  plan: Plan;
  original: Plan;
  change: ReadingContext["change"];
  onReadingChange: ReadingContext["onReadingChange"];
}) {
  const [active, setActive] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const visibleTriggers = () =>
    Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>("button[data-panel]") ??
        [],
    ).filter((button) => !button.closest("[hidden]"));
  const restoreFocus = () => {
    const buttons = visibleTriggers();
    const target =
      buttons.find((b) => b.dataset.panel === active) ??
      buttons.find(
        (b) => b.dataset.parameter === trigger.current?.dataset.parameter,
      );
    (target ?? buttons[0])?.focus();
  };
  useLayoutEffect(() => {
    if (!active) return;
    const buttons = visibleTriggers();
    if (buttons.some((button) => button.dataset.panel === active)) return;
    const hidden = trigger.current?.closest<HTMLElement>(
      "[hidden][data-condition-parameter]",
    );
    setActive(null);
    const controller = buttons.find(
      (b) => b.dataset.parameter === hidden?.dataset.conditionParameter,
    );
    if (controller) controller.focus();
    else restoreFocus();
  }, [plan, active]);
  const close = () => {
    setActive(null);
    restoreFocus();
  };
  return (
    <Context.Provider
      value={{
        plan,
        parameters: plan.parameters,
        original: original.parameters,
        active,
        open: (panel, button) => {
          trigger.current = button;
          setActive(panel);
        },
        close,
        change,
        onReadingChange,
      }}
    >
      <div ref={root} className={proseClass}>
        <Document
          source={typeof plan.content === "string" ? plan.content : ""}
          scope="plan"
        />
      </div>
    </Context.Provider>
  );
}
