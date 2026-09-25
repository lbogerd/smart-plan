import { useEffect, useRef, useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import DOMPurify from "dompurify";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Maximize, MoreHorizontal } from "lucide-react";
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
          primaryColor: "#eef5ef",
          primaryTextColor: "#243530",
          primaryBorderColor: "#57896c",
          lineColor: "#57896c",
          secondaryColor: "#f8faf9",
          tertiaryColor: "#ffffff",
          fontFamily: "Arial, sans-serif",
        },
      });
      return mermaid;
    })
    .catch((error) => {
      renderer = undefined;
      throw error;
    }));
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function png(svg: string): Promise<Blob> {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = document.documentElement;
  const box = root.getAttribute("viewBox")?.split(/[ ,]+/).map(Number);
  const width = box?.[2] || parseFloat(root.getAttribute("width") || "800");
  const height = box?.[3] || parseFloat(root.getAttribute("height") || "600");
  const scale = Math.min(
    2,
    8192 / Math.max(width, height),
    Math.sqrt(16000000 / (width * height)),
  );
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));
  root.style.maxWidth = "none";
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(root)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
function DiagramView({ svg, title }: { svg: string; title: string }) {
  return (
    <TransformWrapper
      minScale={0.25}
      maxScale={8}
      limitToBounds={false}
      wheel={{ disabled: true }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <div className="diagram-zoom">
            <Button onClick={() => zoomOut()} aria-label="Zoom out">
              −
            </Button>
            <Button onClick={() => resetTransform()}>Reset view</Button>
            <Button onClick={() => zoomIn()} aria-label="Zoom in">
              +
            </Button>
          </div>
          <div className="diagram-viewport">
            <TransformComponent
              wrapperStyle={{ width: "100%" }}
              contentStyle={{ width: "100%" }}
            >
              <div
                className="diagram-svg"
                role="img"
                aria-label={title}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </TransformComponent>
          </div>
        </>
      )}
    </TransformWrapper>
  );
}
export function MermaidDiagram({
  source,
  title = "Mermaid diagram",
  onChange,
}: {
  source: string;
  title?: string;
  onChange?: (source: string) => void;
}) {
  const [draft, setDraft] = useState(source),
    [editing, setEditing] = useState(false);
  const [svg, setSvg] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(true);
  const [notice, setNotice] = useState(""),
    [expanded, setExpanded] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const value = editing ? draft : source;
  useEffect(() => {
    let cancelled = false;
    setPending(true);
    setSvg("");
    setError("");
    const timer = setTimeout(
      async () => {
        let container: HTMLDivElement | undefined;
        try {
          const mermaid = await loadRenderer();
          if (cancelled) return;
          container = document.createElement("div");
          container.className = "mermaid-render-target";
          document.body.append(container);
          const result = await mermaid.render(
            `diagram-${crypto.randomUUID()}`,
            value,
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
          if (!cancelled)
            setError("Cannot render this diagram. Check the source.");
        } finally {
          container?.remove();
          if (!cancelled) setPending(false);
        }
      },
      editing ? 300 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, editing]);
  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const filename =
    title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 70) || "diagram";
  async function exportImage(type: "svg" | "png") {
    try {
      download(
        type === "svg"
          ? new Blob([svg], { type: "image/svg+xml" })
          : await png(svg),
        `${filename}.${type}`,
      );
      setNotice(`${type.toUpperCase()} downloaded.`);
    } catch {
      setNotice("Download failed. Try SVG or copy the source.");
    }
  }
  function editSource() {
    setDraft(source);
    setEditing(!editing);
  }
  async function copySource() {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Source copied.");
    } catch {
      setNotice("Copy failed. Select the text under Show source.");
    }
  }
  return (
    <section className="mermaid-card" aria-label={title}>
      <div className="diagram-toolbar">
        <strong>{title}</strong>
        <div className="diagram-desktop-actions">
          {onChange && (
            <Button onClick={editSource}>
              {editing ? "Cancel edit" : "Edit source"}
            </Button>
          )}
          <Button onClick={copySource}>Copy source</Button>
          <Button disabled={!svg || pending} onClick={() => setExpanded(true)}>
            Fullscreen
          </Button>
          <Button disabled={!svg || pending} onClick={() => exportImage("svg")}>
            SVG
          </Button>
          <Button disabled={!svg || pending} onClick={() => exportImage("png")}>
            PNG
          </Button>
        </div>
        <div className="diagram-mobile-actions">
          <Button
            className="diagram-icon-button"
            aria-label="Fullscreen"
            title="Fullscreen"
            disabled={!svg || pending}
            onClick={() => setExpanded(true)}
          >
            <Maximize size={19} aria-hidden="true" />
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              className="button diagram-icon-button"
              aria-label="Diagram actions"
              title="Diagram actions"
            >
              <MoreHorizontal size={21} aria-hidden="true" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="diagram-action-menu"
                align="end"
                sideOffset={6}
                collisionPadding={12}
              >
                {onChange && (
                  <DropdownMenu.Item
                    className="diagram-menu-item"
                    onSelect={editSource}
                  >
                    {editing ? "Cancel edit" : "Edit source"}
                  </DropdownMenu.Item>
                )}
                <DropdownMenu.Item
                  className="diagram-menu-item"
                  onSelect={() => {
                    void copySource();
                  }}
                >
                  Copy source
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="diagram-menu-separator" />
                <DropdownMenu.Item
                  className="diagram-menu-item"
                  disabled={!svg || pending}
                  onSelect={() => {
                    void exportImage("svg");
                  }}
                >
                  Download SVG
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="diagram-menu-item"
                  disabled={!svg || pending}
                  onSelect={() => {
                    void exportImage("png");
                  }}
                >
                  Download PNG
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
      {editing && (
        <div className="diagram-editor">
          <label>
            Mermaid source
            <textarea
              aria-label="Mermaid source"
              spellCheck={false}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={7}
            />
          </label>
          <Button
            className="primary"
            onClick={() => {
              onChange?.(draft);
              setEditing(false);
            }}
          >
            Apply to plan
          </Button>
          <span>Then save the plan.</span>
        </div>
      )}
      {pending ? (
        <p className="diagram-message" role="status">
          Rendering diagram…
        </p>
      ) : error ? (
        <div className="diagram-message">
          <p role="alert">{error}</p>
          <pre>{value}</pre>
        </div>
      ) : (
        !expanded && <DiagramView svg={svg} title={title} />
      )}
      <details className="diagram-source">
        <summary>Show source</summary>
        <pre>{value}</pre>
      </details>
      {notice && (
        <p className="diagram-message" role="status">
          {notice}
        </p>
      )}
      <dialog
        ref={dialog}
        className="diagram-dialog"
        onClose={() => setExpanded(false)}
        onCancel={() => setExpanded(false)}
        aria-label={`${title} fullscreen`}
      >
        <div className="diagram-toolbar">
          <strong>{title}</strong>
          <Button onClick={() => setExpanded(false)}>Close fullscreen</Button>
        </div>
        {expanded && <DiagramView svg={svg} title={title} />}
      </dialog>
    </section>
  );
}
