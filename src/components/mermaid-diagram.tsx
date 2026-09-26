import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Maximize2, X } from "lucide-react";
import { Button } from "./ui";

let renderer: Promise<(typeof import("mermaid"))["default"]> | undefined;
function loadRenderer() {
  return (renderer ??= import("mermaid")
    .then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        htmlLabels: false,
        suppressErrorRendering: true,
        maxTextSize: 50000,
        maxEdges: 500,
        secure: [
          "securityLevel",
          "startOnLoad",
          "maxTextSize",
          "maxEdges",
          "suppressErrorRendering",
          "htmlLabels",
          "flowchart",
          "theme",
          "themeVariables",
        ],
        flowchart: { htmlLabels: false },
        theme: "base",
        themeVariables: {
          primaryColor: "#f4f3fb",
          primaryTextColor: "#202126",
          primaryBorderColor: "#8985b6",
          lineColor: "#8985b6",
          fontFamily: "Inter Variable, sans-serif",
        },
      });
      return mermaid;
    })
    .catch((error) => {
      renderer = undefined;
      throw error;
    }));
}
export function MermaidDiagram({ source }: { source: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let cancelled = false;
    setSvg("");
    setError(false);
    void (async () => {
      let container: HTMLDivElement | undefined;
      try {
        const mermaid = await loadRenderer();
        if (cancelled) return;
        container = document.createElement("div");
        container.style.cssText = "position:absolute;left:-100000px;top:0";
        document.body.append(container);
        const result = await mermaid.render(
          `diagram-${crypto.randomUUID()}`,
          source,
          container,
        );
        if (!cancelled)
          setSvg(
            DOMPurify.sanitize(result.svg, {
              USE_PROFILES: { svg: true, svgFilters: true },
              FORBID_TAGS: ["foreignObject", "image", "a"],
            }),
          );
      } catch {
        if (!cancelled) setError(true);
      } finally {
        container?.remove();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);
  const drawing = (
    <div
      role="img"
      aria-label="Plan diagram"
      className="min-w-0 [&>svg]:mx-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
  return (
    <figure className="not-prose group relative my-8 rounded-lg border border-border bg-white/50 px-4 py-6">
      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Diagram unavailable.
        </p>
      ) : svg ? (
        <>
          {drawing}
          <Button
            variant="ghost"
            className="absolute top-2 right-2 size-8 min-h-8 bg-background/80 p-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            aria-label="Expand diagram"
            onClick={() => dialog.current?.showModal()}
          >
            <Maximize2 size={14} />
          </Button>
        </>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Loading diagram…
        </p>
      )}
      <dialog
        ref={dialog}
        aria-label="Expanded diagram"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[90vw] max-w-6xl overflow-auto rounded-xl border border-border bg-background p-6 shadow-lg backdrop:bg-foreground/30"
      >
        <div className="mb-4 flex justify-end">
          <Button
            variant="ghost"
            aria-label="Close diagram"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        {drawing}
      </dialog>
    </figure>
  );
}
