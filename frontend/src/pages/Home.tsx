import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  Check,
  CircleDot,
  Code2,
  Copy,
  Database,
  Download,
  GitCommitHorizontal,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  Terminal,
  UserRound,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost } from "@/lib/api";
import {
  MCP_PREVIEW,
  SEED_PREVIEW,
} from "@/lib/artifacts";
import type {
  CypherResult,
  FalkorStatus,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  MemoryWriteResult,
  PathResult,
  SeedResult,
  SessionMemory,
} from "@/lib/types";

const INCIDENT_ID = "INC-8821";

const DEFAULT_QUERY =
  "MATCH (i:Incident {id: 'INC-8821'})-" +
  "[:HAS_INCIDENT]-(n) " +
  "RETURN i.id AS incident, " +
  "labels(n) AS labels, " +
  "n.id AS node_id";

const nodeColors: Record<string, string> = {
  Developer: "#38BDF8",
  CodeCommit: "#F43F5E",
  Microservice: "#A855F7",
  Database: "#F59E0B",
  APIRoute: "#10B981",
  Incident: "#F43F5E",
  SessionMemory: "#818CF8",
};

const nodeIcons: Record<
  string,
  typeof UserRound
> = {
  Developer: UserRound,
  CodeCommit: GitCommitHorizontal,
  Microservice: Server,
  Database,
  APIRoute: Webhook,
  Incident: AlertTriangle,
  SessionMemory: BrainCircuit,
};

const referenceNodes: GraphNode[] = [
  {
    id: "c-9041",
    labels: ["CodeCommit"],
    properties: {
      message: "Unauthorized token commit",
    },
  },
  {
    id: "route-charge",
    labels: ["APIRoute"],
    properties: {
      path: "/v1/charges",
    },
  },
  {
    id: "svc-payment",
    labels: ["Microservice"],
    properties: {
      name: "payment-service",
    },
  },
  {
    id: "payment-db-primary",
    labels: ["Database"],
    properties: {
      cluster_state: "connection_exhausted",
    },
  },
  {
    id: INCIDENT_ID,
    labels: ["Incident"],
    properties: {
      severity: "SEV-1",
    },
  },
  {
    id: "dev-dave",
    labels: ["Developer"],
    properties: {
      name: "Dave Chen",
    },
  },
  {
    id: "sess_rca_8821",
    labels: ["SessionMemory"],
    properties: {
      decision: "Revoke and rollback",
    },
  },
];

const referenceEdges: GraphEdge[] = [
  {
    start: "c-9041",
    end: "dev-dave",
    type: "COMMITTED_BY",
    properties: {},
  },
  {
    start: "c-9041",
    end: "route-charge",
    type: "AFFECTS",
    properties: {},
  },
  {
    start: "route-charge",
    end: "svc-payment",
    type: "DEPENDS_ON",
    properties: {},
  },
  {
    start: "svc-payment",
    end: "payment-db-primary",
    type: "DEPENDS_ON",
    properties: {},
  },
  {
    start: "svc-payment",
    end: INCIDENT_ID,
    type: "HAS_INCIDENT",
    properties: {},
  },
  {
    start: "sess_rca_8821",
    end: INCIDENT_ID,
    type: "STORED_MEMORY_FOR",
    properties: {},
  },
];

const timeline = [
  {
    time: "02:14:00",
    label: "c-9041 merged",
    detail: "Partner token validation relaxed",
    color: "#F43F5E",
  },
  {
    time: "02:19:12",
    label: "Token replay begins",
    detail: "High-volume charge requests fan out",
    color: "#F59E0B",
  },
  {
    time: "02:27:44",
    label: "Pool pressure rises",
    detail: "payment-db-primary reaches 120 connections",
    color: "#F59E0B",
  },
  {
    time: "02:31:00",
    label: "INC-8821 declared",
    detail: "Checkout returns 504s · SEV-1",
    color: "#F43F5E",
  },
];

type ConsoleMode =
  | "graph"
  | "rca"
  | "mcp"
  | "artifacts";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Request unavailable";
}

function downloadText(
  filename: string,
  content: string,
) {
  const url = URL.createObjectURL(
    new Blob([content], {
      type: "text/plain",
    }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function Header({
  status,
  onSeed,
  seeding,
}: {
  status?: FalkorStatus;
  onSeed: () => void;
  seeding: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#0a0e17]/95 px-5 backdrop-blur-xl"
      data-testid="workbench-header"
    >
      <div
        className="flex items-center gap-3"
        data-testid="brand-lockup"
      >
        <div
          className="flex size-8 items-center justify-center rounded border border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
          data-testid="brand-mark"
        >
          <Network size={17} />
        </div>

        <div>
          <p
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-100"
            data-testid="brand-name"
          >
            FALKOR / RCA
          </p>

          <p
            className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500"
            data-testid="brand-caption"
          >
            graph intelligence console
          </p>
        </div>
      </div>

      <div
        className="hidden items-center gap-2 md:flex"
        data-testid="header-context"
      >
        <Badge
          className="border border-rose-400/25 bg-rose-400/10 font-mono text-[10px] tracking-[0.14em] text-rose-300"
          data-testid="active-incident-badge"
        >
          <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-rose-400" />
          {INCIDENT_ID} · SEV-1
        </Badge>

        <Badge
          className={
            status?.connected
              ? "border border-emerald-400/25 bg-emerald-400/10 font-mono text-[10px] tracking-[0.12em] text-emerald-300"
              : "border border-amber-400/25 bg-amber-400/10 font-mono text-[10px] tracking-[0.12em] text-amber-300"
          }
          data-testid="status-badge-falkordb"
        >
          {status?.connected ? (
            <Check size={11} />
          ) : (
            <CircleDot size={11} />
          )}

          {status?.connected
            ? `FALKORDB · ${status.latency_ms}MS`
            : "FALKORDB · OFFLINE"}
        </Badge>
      </div>

      <Button
        data-testid="button-seed-database"
        onClick={onSeed}
        disabled={seeding}
        className="border border-cyan-300/40 bg-cyan-300/10 font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200 hover:bg-cyan-300/20"
        size="sm"
      >
        {seeding ? (
          <RefreshCw className="animate-spin" />
        ) : (
          <Play />
        )}

        {seeding ? "Seeding" : "Seed scenario"}
      </Button>
    </header>
  );
}

function GraphCanvas({
  snapshot,
  selectedNode,
  onSelect,
  path,
}: {
  snapshot: GraphSnapshot;
  selectedNode: GraphNode | undefined;
  onSelect: (node: GraphNode) => void;
  path: PathResult | undefined;
}) {
  const nodes = snapshot.nodes.length
    ? snapshot.nodes
    : referenceNodes;

  const edges = snapshot.edges.length
    ? snapshot.edges
    : referenceEdges;

  const positions: Record<
    string,
    [number, number]
  > = {
    "c-9041": [105, 72],
    "dev-dave": [105, 286],
    "route-charge": [275, 150],
    "svc-payment": [452, 150],
    "payment-db-primary": [635, 82],
    [INCIDENT_ID]: [635, 274],
    "sess_rca_8821": [452, 300],
  };

  const pathIds = new Set(
    path?.nodes.map((node) => node.id) ?? [],
  );

  return (
    <div
      className="graph-grid relative min-h-[390px] flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#080c14]"
      data-testid="graph-canvas-container"
    >
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <Badge
          className="border border-cyan-400/25 bg-cyan-400/[0.08] font-mono text-[9px] tracking-[0.15em] text-cyan-300"
          data-testid="graph-mode-badge"
        >
          <Network size={11} />
          LIVE TOPOLOGY
        </Badge>

        <span
          className="font-mono text-[10px] text-slate-600"
          data-testid="graph-hint"
        >
          click a node to inspect
        </span>
      </div>

      <svg
        viewBox="0 0 740 390"
        className="absolute inset-0 size-full"
        role="img"
        aria-label="Interactive FalkorDB incident topology"
        data-testid="graph-svg"
      >
        <defs>
          <filter id="cyan-glow">
            <feGaussianBlur
              stdDeviation="4"
              result="coloredBlur"
            />

            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {edges.map((edge) => {
          const start = positions[edge.start];
          const end = positions[edge.end];

          if (!start || !end) {
            return null;
          }

          const highlighted =
            pathIds.has(edge.start) &&
            pathIds.has(edge.end);

          return (
            <line
              key={`${edge.start}-${edge.end}-${edge.type}`}
              x1={start[0]}
              y1={start[1]}
              x2={end[0]}
              y2={end[1]}
              stroke={
                highlighted ? "#F59E0B" : "#334155"
              }
              strokeWidth={highlighted ? 2.5 : 1.2}
              strokeDasharray={
                highlighted ? "0" : "4 5"
              }
              opacity={highlighted ? 1 : 0.8}
              filter={
                highlighted
                  ? "url(#cyan-glow)"
                  : undefined
              }
            />
          );
        })}

        {nodes.map((node) => {
          const position = positions[node.id] ?? [
            370,
            200,
          ];

          const label = node.labels[0] ?? "Node";
          const color =
            nodeColors[label] ?? "#94A3B8";

          const selected =
            selectedNode?.id === node.id ||
            pathIds.has(node.id);

          return (
            <g
              key={node.id}
              transform={`translate(${position[0]}, ${position[1]})`}
              onClick={() => onSelect(node)}
              className="cursor-pointer"
              data-testid={`graph-node-${node.id}`}
            >
              <circle
                r={selected ? 25 : 20}
                fill={
                  selected
                    ? `${color}24`
                    : "#0f1522"
                }
                stroke={
                  selected ? color : `${color}80`
                }
                strokeWidth={selected ? 2 : 1}
                className="node-ring"
              />

              <circle r="4" fill={color} />

              <text
                y="38"
                textAnchor="middle"
                className="fill-slate-300 font-mono text-[10px]"
              >
                {node.id}
              </text>

              <text
                y="51"
                textAnchor="middle"
                className="fill-slate-600 font-mono text-[8px] uppercase"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        className="absolute bottom-3 left-4 flex flex-wrap gap-3"
        data-testid="graph-legend"
      >
        {Object.entries(nodeColors)
          .slice(0, 6)
          .map(([label, color]) => (
            <span
              key={label}
              className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500"
            >
              <span
                className="size-1.5 rounded-full"
                style={{
                  backgroundColor: color,
                }}
              />

              {label}
            </span>
          ))}
      </div>
    </div>
  );
}

function NodeInspector({
  node,
}: {
  node?: GraphNode;
}) {
  const label = node?.labels[0] ?? "Incident";
  const Icon = nodeIcons[label] ?? CircleDot;

  return (
    <Card
      className="border-white/[0.08] bg-[#0f1522] py-3"
      size="sm"
      data-testid="node-inspector-panel"
    >
      <CardHeader className="px-3 pb-2">
        <CardTitle
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400"
          data-testid="node-inspector-title"
        >
          <Icon
            size={13}
            style={{
              color: nodeColors[label],
            }}
          />

          Selected entity
        </CardTitle>
      </CardHeader>

      <CardContent className="px-3">
        {node ? (
          <>
            <p
              className="font-mono text-sm text-slate-100"
              data-testid="selected-node-id"
            >
              {node.id}
            </p>

            <Badge
              className="mt-2 border border-white/10 bg-white/[0.04] font-mono text-[9px] text-slate-400"
              data-testid="selected-node-label"
            >
              {label}
            </Badge>

            <div className="mt-3 space-y-1.5">
              {Object.entries(node.properties)
                .slice(0, 3)
                .map(([key, value]) => (
                  <div
                    className="flex justify-between gap-3 font-mono text-[10px]"
                    key={key}
                    data-testid={`selected-property-${key}`}
                  >
                    <span className="text-slate-600">
                      {key}
                    </span>

                    <span className="max-w-[160px] truncate text-right text-slate-300">
                      {String(value)}
                    </span>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <p
            className="text-xs text-slate-500"
            data-testid="node-inspector-empty"
          >
            Select a graph node to inspect properties.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const queryClient = useQueryClient();

  const [mode, setMode] =
    useState<ConsoleMode>("graph");

  const [query, setQuery] =
    useState(DEFAULT_QUERY);

  const [startNode, setStartNode] =
    useState("c-9041");

  const [endNode, setEndNode] =
    useState("payment-db-primary");

  const [selectedNode, setSelectedNode] =
    useState<GraphNode | undefined>(
      referenceNodes[4],
    );

  const [sessionId, setSessionId] =
    useState("sess_rca_8821");

  const [decision, setDecision] =
    useState(
      "Revoke leaked partner token and rollback c-9041 before draining payment workers.",
    );

  const [memoryNodes, setMemoryNodes] =
    useState(
      "c-9041, route-charge, svc-payment, payment-db-primary",
    );

  const [memoryHistory, setMemoryHistory] =
    useState<SessionMemory[]>([]);

  const statusQuery = useQuery({
    queryKey: ["falkor-status"],
    queryFn: () =>
      apiGet<FalkorStatus>("/status"),
    retry: false,
    refetchInterval: 15000,
  });

  const graphQuery = useQuery({
    queryKey: ["graph-snapshot"],
    queryFn: () =>
      apiGet<GraphSnapshot>("/graph"),
    retry: false,
    enabled: Boolean(statusQuery.data?.connected),
  });

  const seedMutation = useMutation({
    mutationFn: () =>
      apiPost<SeedResult>("/seed"),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["falkor-status"],
      });

      queryClient.invalidateQueries({
        queryKey: ["graph-snapshot"],
      });

      toast.success(
        `Seeded ${result.node_count} nodes into ${result.graph_name}`,
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const cypherMutation = useMutation({
    mutationFn: () =>
      apiPost<CypherResult>(
        "/execute-cypher",
        { query },
      ),
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const pathMutation = useMutation({
    mutationFn: () =>
      apiPost<PathResult>(
        "/shortest-path",
        {
          start_node: startNode,
          end_node: endNode,
        },
      ),
    onSuccess: (result) => {
      toast.success(
        result.found
          ? `Path found in ${result.hops} hops`
          : "No connected path found",
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const writeMemoryMutation = useMutation({
    mutationFn: () =>
      apiPost<MemoryWriteResult>(
        "/session-memory",
        {
          session_id: sessionId,
          decision,
          visited_nodes: memoryNodes
            .split(",")
            .map((node) => node.trim())
            .filter(Boolean),
        },
      ),
    onSuccess: (result) => {
      setMemoryHistory([result.memory]);
      toast.success(
        "Session memory written to FalkorDB",
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const readMemoryMutation = useMutation({
    mutationFn: () =>
      apiGet<SessionMemory[]>(
        `/session-memory/${encodeURIComponent(sessionId)}`,
      ),
    onSuccess: setMemoryHistory,
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  });

  const snapshot =
    graphQuery.data ?? {
      nodes: referenceNodes,
      edges: referenceEdges,
    };

  const activePath = pathMutation.data;

  const availableNodes = useMemo(
    () =>
      snapshot.nodes.length
        ? snapshot.nodes
        : referenceNodes,
    [snapshot.nodes],
  );

  const handleCopy = async (content: string) => {
    await navigator.clipboard?.writeText(content);
    toast.success("Copied to clipboard");
  };

  return (
    <div
      className="min-h-svh bg-[#07090e] text-slate-100"
      data-testid="rca-workbench"
    >
      <Header
        status={statusQuery.data}
        onSeed={() => seedMutation.mutate()}
        seeding={seedMutation.isPending}
      />

      <div className="flex min-h-[calc(100svh-56px)] flex-col lg:flex-row">
        <aside
          className="flex w-full shrink-0 flex-col gap-4 border-b border-white/[0.08] bg-[#0a0e17] p-4 lg:w-[330px] lg:border-r lg:border-b-0"
          data-testid="incident-rail"
        >
          <section data-testid="connection-summary">
            <div className="mb-2 flex items-center justify-between">
              <p className="section-kicker">
                Connection / topology
              </p>

              <Activity
                size={14}
                className={
                  statusQuery.data?.connected
                    ? "text-emerald-300"
                    : "text-amber-300"
                }
              />
            </div>

            <Card
              className="border-white/[0.08] bg-[#0f1522] py-3"
              size="sm"
            >
              <CardContent className="grid grid-cols-3 gap-2 px-3">
                <div>
                  <p className="metric-value">
                    {statusQuery.data?.node_count ?? 7}
                  </p>
                  <p className="metric-label">
                    nodes
                  </p>
                </div>

                <div>
                  <p className="metric-value">
                    {statusQuery.data?.edge_count ?? 6}
                  </p>
                  <p className="metric-label">
                    edges
                  </p>
                </div>

                <div>
                  <p className="metric-value text-cyan-300">
                    {statusQuery.data?.latency_ms
                      ? `${statusQuery.data.latency_ms}`
                      : "—"}
                  </p>
                  <p className="metric-label">
                    ms ping
                  </p>
                </div>
              </CardContent>
            </Card>

            <p
              className="mt-2 font-mono text-[10px] text-slate-500"
              data-testid="graph-connection-copy"
            >
              {statusQuery.data?.connected
                ? `${statusQuery.data.graph_name} · ${statusQuery.data.host}:${statusQuery.data.port}`
                : "Connect FalkorDB at localhost:6379 to execute graph tools"}
            </p>
          </section>

          <section data-testid="incident-timeline">
            <div className="mb-3 flex items-center justify-between">
              <p className="section-kicker">
                Blast radius / timeline
              </p>

              <Badge className="border border-rose-400/20 bg-rose-400/10 font-mono text-[9px] text-rose-300">
                SEV-1
              </Badge>
            </div>

            <div className="relative ml-1 border-l border-white/10 pl-4">
              {timeline.map((event) => (
                <div
                  className="relative mb-4 last:mb-0"
                  key={event.time}
                >
                  <span
                    className="absolute -left-[21px] top-1 size-2 rounded-full border-2 border-[#0a0e17]"
                    style={{
                      backgroundColor: event.color,
                      boxShadow: `0 0 9px ${event.color}`,
                    }}
                  />

                  <p className="font-mono text-[10px] text-slate-500">
                    {event.time} UTC
                  </p>

                  <p className="mt-0.5 text-xs font-medium text-slate-200">
                    {event.label}
                  </p>

                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {event.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-auto">
            <div className="mb-2 flex items-center justify-between">
              <p className="section-kicker">
                Session memory
              </p>

              <BrainCircuit
                size={14}
                className="text-indigo-300"
              />
            </div>

            <div className="rounded-lg border border-indigo-400/20 bg-indigo-400/[0.06] p-3">
              {memoryHistory[0] ? (
                <>
                  <p className="font-mono text-[10px] text-indigo-200">
                    {memoryHistory[0].session_id}
                  </p>

                  <p className="mt-2 text-xs leading-relaxed text-slate-300">
                    {memoryHistory[0].decision}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  No trace loaded for sess_rca_8821.
                </p>
              )}

              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setMode("mcp");
                  readMemoryMutation.mutate();
                }}
                className="mt-2 px-0 font-mono text-[10px] uppercase tracking-wider text-indigo-300 hover:bg-transparent hover:text-indigo-200"
              >
                Read trace
                <ArrowRight />
              </Button>
            </div>
          </section>
        </aside>

        <main
          className="flex min-w-0 flex-1 flex-col p-4 lg:p-5"
          data-testid="main-workbench"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-kicker text-cyan-300">
                Incident RCA / graph trace
              </p>

              <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-100">
                Payment Gateway 504 Outage
              </h1>

              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
                Follow the unauthorized token commit through the API dependency chain to the exhausted payment database.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="border border-white/10 bg-white/[0.03] font-mono text-[10px] text-slate-400">
                <Database size={11} />
                it_infrastructure_rca
              </Badge>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  statusQuery.refetch();
                  graphQuery.refetch();
                }}
                className="text-slate-500 hover:text-cyan-300"
              >
                <RefreshCw size={14} />
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_230px]">
            <section className="flex min-w-0 flex-col gap-3">
              <GraphCanvas
                snapshot={snapshot}
                selectedNode={selectedNode}
                onSelect={setSelectedNode}
                path={activePath}
              />

              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0d111a] p-2">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
                  Trace path
                </span>

                <select
                  aria-label="Start entity"
                  value={startNode}
                  onChange={(event) =>
                    setStartNode(event.target.value)
                  }
                  className="h-7 min-w-32 rounded border border-white/10 bg-[#131926] px-2 font-mono text-[10px] text-slate-300 outline-none"
                >
                  <option value="c-9041">
                    c-9041
                  </option>

                  {availableNodes
                    .filter(
                      (node) => node.id !== "c-9041",
                    )
                    .map((node) => (
                      <option
                        value={node.id}
                        key={node.id}
                      >
                        {node.id}
                      </option>
                    ))}
                </select>

                <ArrowRight
                  size={13}
                  className="text-slate-600"
                />

                <select
                  aria-label="End entity"
                  value={endNode}
                  onChange={(event) =>
                    setEndNode(event.target.value)
                  }
                  className="h-7 min-w-36 rounded border border-white/10 bg-[#131926] px-2 font-mono text-[10px] text-slate-300 outline-none"
                >
                  <option value="payment-db-primary">
                    payment-db-primary
                  </option>

                  {availableNodes
                    .filter(
                      (node) =>
                        node.id !==
                        "payment-db-primary",
                    )
                    .map((node) => (
                      <option
                        value={node.id}
                        key={node.id}
                      >
                        {node.id}
                      </option>
                    ))}
                </select>

                <Button
                  onClick={() =>
                    pathMutation.mutate()
                  }
                  disabled={pathMutation.isPending}
                  size="sm"
                  className="ml-auto border border-amber-400/30 bg-amber-400/10 font-mono text-[10px] uppercase tracking-wider text-amber-200 hover:bg-amber-400/20"
                >
                  <Search size={13} />
                  {pathMutation.isPending
                    ? "Tracing"
                    : "Find shortest path"}
                </Button>
              </div>
            </section>

            <aside className="space-y-3">
              <NodeInspector node={selectedNode} />

              <Card
                className="border-white/[0.08] bg-[#0f1522] py-3"
                size="sm"
              >
                <CardHeader className="px-3 pb-2">
                  <CardTitle className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    Incident facts
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 px-3">
                  <div>
                    <p className="fact-label">
                      root cause
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-rose-200">
                      Unauthorized token in c-9041
                    </p>
                  </div>

                  <div>
                    <p className="fact-label">
                      blast radius
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      /v1/charges → payment-service → payment-db-primary
                    </p>
                  </div>

                  <div>
                    <p className="fact-label">
                      current state
                    </p>

                    <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-200">
                      <span className="size-1.5 rounded-full bg-amber-300" />
                      investigating
                    </p>
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>

          <section
            className="mt-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0f19]"
            data-testid="bottom-console"
          >
            <div className="flex flex-wrap items-center gap-1 border-b border-white/[0.08] px-2 py-2">
              <p className="mr-3 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">
                Tool console
              </p>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("graph")}
                className={
                  mode === "graph"
                    ? "bg-cyan-400/10 font-mono text-[10px] uppercase tracking-wider text-cyan-300"
                    : "font-mono text-[10px] uppercase tracking-wider text-slate-500"
                }
              >
                <Network size={13} />
                Graph Explorer
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("rca")}
                className={
                  mode === "rca"
                    ? "bg-cyan-400/10 font-mono text-[10px] uppercase tracking-wider text-cyan-300"
                    : "font-mono text-[10px] uppercase tracking-wider text-slate-500"
                }
              >
                <Terminal size={13} />
                Cypher
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("mcp")}
                className={
                  mode === "mcp"
                    ? "bg-cyan-400/10 font-mono text-[10px] uppercase tracking-wider text-cyan-300"
                    : "font-mono text-[10px] uppercase tracking-wider text-slate-500"
                }
              >
                <BrainCircuit size={13} />
                MCP tools
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("artifacts")}
                className={
                  mode === "artifacts"
                    ? "bg-cyan-400/10 font-mono text-[10px] uppercase tracking-wider text-cyan-300"
                    : "font-mono text-[10px] uppercase tracking-wider text-slate-500"
                }
              >
                <Code2 size={13} />
                Artifacts
              </Button>
            </div>

            {mode === "graph" && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-xs text-slate-300">
                    Topology loaded from FalkorDB
                  </p>

                  <p className="mt-1 text-xs text-slate-600">
                    Select an entity above, then run a bounded shortest-path traversal.
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                  <span className="text-cyan-300">
                    {snapshot.nodes.length}
                  </span>
                  nodes

                  <span className="text-slate-700">
                    /
                  </span>

                  <span className="text-cyan-300">
                    {snapshot.edges.length}
                  </span>
                  edges
                </div>
              </div>
            )}

            {mode === "rca" && (
              <div className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="section-kicker">
                      tool_execute_cypher / raw query
                    </p>

                    <span className="font-mono text-[10px] text-slate-600">
                      parameterize in production
                    </span>
                  </div>

                  <Textarea
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value)
                    }
                    className="min-h-20 resize-y border-white/10 bg-[#080c14] font-mono text-xs leading-relaxed text-cyan-200"
                  />
                </div>

                <Button
                  onClick={() =>
                    cypherMutation.mutate()
                  }
                  disabled={cypherMutation.isPending}
                  className="self-end border border-cyan-400/30 bg-cyan-400/10 font-mono text-[10px] uppercase tracking-wider text-cyan-200 hover:bg-cyan-400/20"
                >
                  <Play size={13} />
                  Run query
                </Button>

                {cypherMutation.data && (
                  <div className="overflow-auto lg:col-span-2">
                    <div className="mb-2 flex items-center gap-3 font-mono text-[10px] text-slate-500">
                      <span>
                        {cypherMutation.data.result_count} rows
                      </span>

                      <span>
                        {cypherMutation.data.elapsed_ms} ms
                      </span>
                    </div>

                    <pre className="max-h-28 overflow-auto rounded border border-white/10 bg-[#080c14] p-3 font-mono text-[10px] text-slate-300">
                      {JSON.stringify(
                        cypherMutation.data.rows,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {mode === "mcp" && (
              <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="section-kicker">
                      tool_write_session_memory
                    </p>

                    <Badge className="border border-indigo-400/20 bg-indigo-400/10 font-mono text-[9px] text-indigo-300">
                      SessionMemory
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    <Input
                      value={sessionId}
                      onChange={(event) =>
                        setSessionId(event.target.value)
                      }
                      placeholder="session id"
                      className="border-white/10 bg-[#080c14] font-mono text-xs"
                    />

                    <Textarea
                      value={decision}
                      onChange={(event) =>
                        setDecision(event.target.value)
                      }
                      className="min-h-16 border-white/10 bg-[#080c14] text-xs"
                      placeholder="Decision / reasoning state"
                    />

                    <Input
                      value={memoryNodes}
                      onChange={(event) =>
                        setMemoryNodes(event.target.value)
                      }
                      placeholder="visited node IDs, comma separated"
                      className="border-white/10 bg-[#080c14] font-mono text-xs"
                    />

                    <Button
                      onClick={() =>
                        writeMemoryMutation.mutate()
                      }
                      disabled={
                        writeMemoryMutation.isPending
                      }
                      size="sm"
                      className="w-fit border border-indigo-400/30 bg-indigo-400/10 font-mono text-[10px] uppercase tracking-wider text-indigo-200 hover:bg-indigo-400/20"
                    >
                      <BrainCircuit size={13} />
                      {writeMemoryMutation.isPending
                        ? "Writing"
                        : "Write memory"}
                    </Button>
                  </div>
                </div>

                <div className="border-l border-white/[0.08] pl-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="section-kicker">
                      tool_read_session_memory
                    </p>

                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        readMemoryMutation.mutate()
                      }
                      className="font-mono text-[10px] text-indigo-300"
                    >
                      Read
                      <ArrowRight />
                    </Button>
                  </div>

                  {memoryHistory.length ? (
                    <div className="space-y-2">
                      {memoryHistory.map(
                        (memory, index) => (
                          <div
                            key={`${memory.session_id}-${index}`}
                            className="rounded border border-indigo-400/15 bg-indigo-400/[0.05] p-2"
                          >
                            <p className="font-mono text-[10px] text-indigo-200">
                              {memory.session_id} ·{" "}
                              {memory.timestamp || "trace"}
                            </p>

                            <p className="mt-1 text-xs leading-relaxed text-slate-300">
                              {memory.decision}
                            </p>

                            <p className="mt-2 font-mono text-[10px] text-slate-600">
                              visited:{" "}
                              {memory.visited_nodes.join(
                                " → ",
                              )}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-slate-600">
                      Read the current session to load its persisted trace.
                    </p>
                  )}
                </div>
              </div>
            )}

            {mode === "artifacts" && (
              <div className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="section-kicker">
                      Generated source artifacts
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Run these files with the local FalkorDB graph at localhost:6379.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        downloadText(
                          "seed.cypher",
                          SEED_PREVIEW,
                        )
                      }
                      variant="ghost"
                      size="sm"
                      className="font-mono text-[10px] uppercase text-slate-400"
                    >
                      <Download size={13} />
                      seed.cypher
                    </Button>

                    <Button
                      onClick={() =>
                        downloadText(
                          "mcp_falkordb_server.py",
                          MCP_PREVIEW,
                        )
                      }
                      variant="ghost"
                      size="sm"
                      className="font-mono text-[10px] uppercase text-slate-400"
                    >
                      <Download size={13} />
                      MCP server
                    </Button>

                    <Button
                      onClick={() =>
                        handleCopy(SEED_PREVIEW)
                      }
                      variant="ghost"
                      size="icon-sm"
                      className="text-slate-500 hover:text-cyan-300"
                    >
                      <Copy size={13} />
                    </Button>
                  </div>
                </div>

                <pre className="max-h-44 overflow-auto rounded border border-white/10 bg-[#080c14] p-3 font-mono text-[10px] leading-relaxed text-cyan-200">
                  {SEED_PREVIEW}
                </pre>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
