import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import cytoscape from "cytoscape";
import type {
  Core,
  ElementDefinition,
  LayoutOptions,
} from "cytoscape";
import {
  Crosshair,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LABEL_COLORS,
  NODE_FALLBACK_COLOR,
} from "@/lib/fallbackGraph";
import type { GraphNode, GraphSnapshot } from "@/lib/types";

interface GraphCanvasProps {
  snapshot: GraphSnapshot;
  visitedNodes: string[];
  visitedEdgeKeys: string[];
  activeNodeId?: string;
  rootCauseId?: string;
  onSelect: (node: GraphNode | undefined) => void;
  selectedId?: string;
}

const LAYOUT: LayoutOptions = {
  name: "cose",
  animate: false,
  padding: 42,
  nodeDimensionsIncludeLabels: true,
  // cose tuning for a readable, non-overlapping topology
  idealEdgeLength: () => 118,
  nodeRepulsion: () => 12000,
  gravity: 0.6,
  numIter: 1400,
} as LayoutOptions;

function toElements(
  snapshot: GraphSnapshot,
): ElementDefinition[] {
  const ids = new Set(snapshot.nodes.map((node) => node.id));

  const nodes: ElementDefinition[] = snapshot.nodes.map((node) => ({
    group: "nodes",
    data: {
      id: node.id,
      label: node.id,
      kind: node.labels[0] ?? "Node",
      color: LABEL_COLORS[node.labels[0] ?? ""] ?? NODE_FALLBACK_COLOR,
    },
  }));

  const edges: ElementDefinition[] = snapshot.edges
    .filter((edge) => ids.has(edge.start) && ids.has(edge.end))
    .map((edge) => ({
      group: "edges",
      data: {
        id: `${edge.start}__${edge.type}__${edge.end}`,
        source: edge.start,
        target: edge.end,
        label: edge.type,
        key: `${edge.start}->${edge.end}`,
      },
    }));

  return [...nodes, ...edges];
}

export default function GraphCanvas({
  snapshot,
  visitedNodes,
  visitedEdgeKeys,
  activeNodeId,
  rootCauseId,
  onSelect,
  selectedId,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [ready, setReady] = useState(false);

  const elements = useMemo(
    () => toElements(snapshot),
    [snapshot],
  );

  // Mount the Cytoscape instance once.
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      minZoom: 0.25,
      maxZoom: 2.5,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#111622",
            "border-color": "data(color)",
            "border-width": 2,
            width: 42,
            height: 42,
            label: "data(label)",
            color: "#94A3B8",
            "font-family": "JetBrains Mono, monospace",
            "font-size": 9,
            "text-valign": "bottom",
            "text-margin-y": 7,
            "text-wrap": "wrap",
            "text-max-width": "110px",
            "transition-property":
              "border-color, background-color, width, height",
            "transition-duration": 220,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.2,
            "line-color": "#334155",
            "line-style": "dashed",
            "target-arrow-color": "#334155",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.75,
            "curve-style": "bezier",
            label: "data(label)",
            color: "#475569",
            "font-family": "JetBrains Mono, monospace",
            "font-size": 7,
            "text-rotation": "autorotate",
            "text-background-color": "#07090e",
            "text-background-opacity": 0.85,
            "text-background-padding": "2px",
            "transition-property": "line-color, width, target-arrow-color",
            "transition-duration": 220,
          },
        },
        {
          selector: "node.visited",
          style: {
            "background-color": "#422006",
            "border-color": "#F59E0B",
            "border-width": 3,
            color: "#FCD34D",
            width: 50,
            height: 50,
          },
        },
        {
          selector: "edge.visited",
          style: {
            "line-color": "#F59E0B",
            "target-arrow-color": "#F59E0B",
            "line-style": "solid",
            width: 3,
            color: "#FCD34D",
          },
        },
        {
          selector: "node.active",
          style: {
            "background-color": "#450a0a",
            "border-color": "#EF4444",
            "border-width": 4,
            color: "#FCA5A5",
            width: 58,
            height: 58,
          },
        },
        {
          selector: "node.root-cause",
          style: {
            "border-color": "#EF4444",
            "background-color": "#450a0a",
            color: "#FCA5A5",
            "border-width": 4,
            width: 56,
            height: 56,
            "underlay-color": "#ef4444",
            "underlay-padding": 10,
            "underlay-opacity": 0.55,
          },
        },
        {
          selector: "node.root-pulse",
          style: {
            "underlay-opacity": 0.15,
            "underlay-padding": 16,
          },
        },
        {
          selector: "node.picked",
          style: {
            "border-color": "#00E5FF",
            "border-width": 4,
            color: "#67E8F9",
          },
        },
        {
          selector: "node.faded",
          style: { opacity: 0.35 },
        },
        {
          selector: "edge.faded",
          style: { opacity: 0.18 },
        },
      ],
    });

    cyRef.current = cy;
    setReady(true);

    // Canvas has no DOM nodes to target, so expose the core for
    // automated checks that need a node's rendered position.
    const win = window as unknown as {
      __cy?: Core;
      __cyFocusNode?: (id: string) => void;
    };
    win.__cy = cy;
    win.__cyFocusNode = (id: string) => {
      const target = cy.getElementById(id);
      if (!target || target.empty()) return;
      cy.animate(
        { center: { eles: target }, zoom: 1.5, duration: 500 } as any,
        { duration: 500 } as any,
      );
      target.removeClass("faded").addClass("picked");
      window.setTimeout(() => target.removeClass("picked"), 900);
    };

    return () => {
      cy.destroy();
      cyRef.current = null;
      delete win.__cy;
      delete win.__cyFocusNode;
    };
  }, []);

  // Push graph data whenever the snapshot changes.
  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || !ready) {
      return;
    }

    cy.elements().remove();
    cy.add(elements);
    cy.layout(LAYOUT).run();
    cy.fit(undefined, 42);
  }, [elements, ready]);

  // Bind node clicks once the instance exists.
  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || !ready) {
      return;
    }

    const onTapNode = (event: cytoscape.EventObject) => {
      const id = event.target.id() as string;
      const node = snapshot.nodes.find((item) => item.id === id);
      onSelect(node);
    };

    const onTapBackground = (event: cytoscape.EventObject) => {
      if (event.target === cy) {
        onSelect(undefined);
      }
    };

    cy.on("tap", "node", onTapNode);
    cy.on("tap", onTapBackground);

    return () => {
      cy.removeListener("tap", "node", onTapNode);
      cy.removeListener("tap", onTapBackground);
    };
  }, [onSelect, snapshot.nodes, ready]);

  // Repaint traversal highlights as the replay advances.
  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || !ready) {
      return;
    }

    cy.batch(() => {
      cy.nodes().removeClass("visited active root-cause picked faded");
      cy.edges().removeClass("visited faded");

      const hasTrace = visitedNodes.length > 0;

      if (hasTrace) {
        cy.nodes().addClass("faded");
        cy.edges().addClass("faded");
      }

      visitedNodes.forEach((id) => {
        cy.getElementById(id).removeClass("faded").addClass("visited");
      });

      visitedEdgeKeys.forEach((key) => {
        cy.edges()
          .filter((edge) => edge.data("key") === key)
          .removeClass("faded")
          .addClass("visited");
      });

      if (rootCauseId) {
        cy.getElementById(rootCauseId)
          .removeClass("faded")
          .addClass("root-cause");
      }

      if (activeNodeId) {
        cy.getElementById(activeNodeId)
          .removeClass("faded")
          .addClass("active");
      }

      if (selectedId) {
        cy.getElementById(selectedId)
          .removeClass("faded")
          .addClass("picked");
      }
    });
  }, [
    visitedNodes,
    visitedEdgeKeys,
    activeNodeId,
    rootCauseId,
    selectedId,
    ready,
  ]);

  // Pulse the root-cause node's red underlay so it reads as an active alarm.
  useEffect(() => {
    if (!ready || !rootCauseId) return;
    const cy = cyRef.current;
    if (!cy) return;
    const node = cy.getElementById(rootCauseId);
    if (node.empty()) return;

    let on = false;
    const interval = window.setInterval(() => {
      on = !on;
      if (on) node.addClass("root-pulse");
      else node.removeClass("root-pulse");
    }, 650);

    return () => window.clearInterval(interval);
  }, [rootCauseId, ready]);

  const zoomBy = (factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({
      level: cy.zoom() * factor,
      renderedPosition: {
        x: cy.width() / 2,
        y: cy.height() / 2,
      },
    });
  };

  const fit = () => {
    cyRef.current?.fit(undefined, 42);
  };

  const reset = () => {
    const cy = cyRef.current;
    if (!cy) return;
    onSelect(undefined);
    cy.layout(LAYOUT).run();
    cy.fit(undefined, 42);
  };

  const focusTrace = () => {
    const cy = cyRef.current;
    if (!cy || !visitedNodes.length) return;
    const traced = cy
      .nodes()
      .filter((node) => visitedNodes.includes(node.id()));
    if (traced.length) {
      cy.fit(traced, 80);
    }
  };

  return (
    <div
      className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-800/80 bg-[#080c14]/90 shadow-2xl backdrop-blur-md"
      data-testid="graph-canvas-container"
    >
      <div className="graph-grid pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
        <Badge
          className="border border-cyan-400/25 bg-cyan-400/[0.08] font-mono text-[9px] tracking-[0.15em] text-cyan-300"
          data-testid="graph-mode-badge"
        >
          <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-cyan-300" />
          LIVE GRAPH CANVAS
        </Badge>

        <span
          className="font-mono text-[10px] text-slate-600"
          data-testid="graph-node-count"
        >
          {snapshot.nodes.length} nodes / {snapshot.edges.length} edges
        </span>
      </div>

      <div
        className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0a0e17]/90 p-1 backdrop-blur-xl"
        data-testid="graph-controls"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => zoomBy(1.25)}
          aria-label="Zoom in"
          className="text-slate-400 hover:bg-white/5 hover:text-cyan-300"
          data-testid="graph-zoom-in-button"
        >
          <Plus size={14} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => zoomBy(0.8)}
          aria-label="Zoom out"
          className="text-slate-400 hover:bg-white/5 hover:text-cyan-300"
          data-testid="graph-zoom-out-button"
        >
          <Minus size={14} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={fit}
          aria-label="Fit graph to view"
          className="text-slate-400 hover:bg-white/5 hover:text-cyan-300"
          data-testid="graph-fit-button"
        >
          <Maximize2 size={13} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={focusTrace}
          disabled={!visitedNodes.length}
          aria-label="Focus traversed path"
          className="text-slate-400 hover:bg-white/5 hover:text-amber-300"
          data-testid="graph-focus-trace-button"
        >
          <Crosshair size={13} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={reset}
          aria-label="Reset graph layout"
          className="text-slate-400 hover:bg-white/5 hover:text-cyan-300"
          data-testid="graph-reset-button"
        >
          <RotateCcw size={13} />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-0"
        data-testid="cytoscape-mount"
      />

      <div
        className="pointer-events-none absolute bottom-3 left-4 z-10 flex flex-wrap gap-3"
        data-testid="graph-legend"
      >
        {Object.entries(LABEL_COLORS).map(([label, color]) => (
          <span
            key={label}
            className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500"
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </div>

      <div
        className="pointer-events-none absolute bottom-3 right-4 z-10 flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-slate-500"
        data-testid="graph-trace-legend"
      >
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-400" />
          visited
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-rose-500" />
          active hop
        </span>
      </div>
    </div>
  );
}
