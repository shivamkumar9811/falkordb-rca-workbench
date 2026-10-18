import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  Database,
  Send,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";

import AgentLogStream from "@/components/AgentLogStream";
import AnswerCard from "@/components/AnswerCard";
import GraphCanvas from "@/components/GraphCanvas";
import NodeDetailsDrawer from "@/components/NodeDetailsDrawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAgentReplay } from "@/lib/agentStream";
import { apiGet, apiPost } from "@/lib/api";
import { FALLBACK_GRAPH } from "@/lib/fallbackGraph";
import type {
  FalkorStatus,
  GraphNode,
  GraphSnapshot,
  InvestigationResponse,
} from "@/lib/types";

const DEFAULT_QUERY = "Why is Checkout Service failing?";
const DEFAULT_INCIDENT = "INC-8821";
const DEFAULT_SESSION = "sess_rca_8821";

const PRESETS = [
  "Why is Checkout Service failing?",
  "Trace the root cause of the payment gateway outage.",
  "Which commit exhausted the payment database connections?",
];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Orchestration request failed";
}

function isMockMode(result: InvestigationResponse | undefined, connected: boolean): boolean {
  if (result?.mcp_mode === "mock") return true;
  if (result?.mcp_mode && result.mcp_mode !== "mock") return false;
  return !connected;
}

function focusGraphNode(id: string) {
  const win = window as unknown as { __cyFocusNode?: (id: string) => void };
  win.__cyFocusNode?.(id);
}

function modeLabel(mode?: string, connected?: boolean): string {
  if (mode === "mock") return "MOCK FALLBACK";
  if (mode === "mcp") return "MCP LIVE";
  if (mode === "local" && connected) return "FALKORDB LIVE";
  if (connected) return "FALKORDB LIVE";
  return "MOCK FALLBACK";
}

export default function Orchestrator() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [incidentId, setIncidentId] = useState(DEFAULT_INCIDENT);
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION);
  const [selectedNode, setSelectedNode] = useState<
    GraphNode | undefined
  >(undefined);

  const statusQuery = useQuery({
    queryKey: ["falkor-status"],
    queryFn: () => apiGet<FalkorStatus>("/status"),
    retry: false,
    refetchInterval: 20000,
  });

  const connected = statusQuery.data?.connected ?? false;

  // /api/graph only answers when FalkorDB is reachable; the seeded
  // topology stands in so the canvas is never blank.
  const graphQuery = useQuery({
    queryKey: ["graph-snapshot"],
    queryFn: () => apiGet<GraphSnapshot>("/graph/full"),
    retry: false,
    enabled: connected,
  });

  const orchestration = useMutation({
    mutationFn: () =>
      apiPost<InvestigationResponse>("/investigate", {
        prompt: query,
        incident_id: incidentId,
        session_id: sessionId,
      }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: (result) => {
      setSelectedNode(undefined);
      toast.success(
        result.mcp_mode === "mock"
          ? "RCA complete · deterministic mock evidence"
          : "RCA complete · graph evidence verified",
      );
    },
  });

  const result = orchestration.data;
  const replay = useAgentReplay(result);

  const snapshot = useMemo<GraphSnapshot>(() => {
    const responseGraph = result?.graph;

    if (responseGraph && responseGraph.nodes.length) {
      return responseGraph;
    }

    const live = graphQuery.data;

    if (live && live.nodes.length) {
      return live;
    }

    return FALLBACK_GRAPH;
  }, [graphQuery.data, result]);

  const rootCauseId = result?.trace_path[0]?.node_id;
  const mockMode = isMockMode(result, connected);
  const failedAgents = result?.tool_log
    ? Array.from(
        new Set(
          result.tool_log
            .filter((entry) => entry.status === "failed")
            .map((entry) => entry.agent),
        ),
      )
    : [];

  const run = () => {
    if (!query.trim()) {
      toast.error("Enter an incident question first");
      return;
    }

    if (!incidentId.trim() || !sessionId.trim()) {
      toast.error("Incident ID and session ID are required");
      return;
    }

    orchestration.mutate();
  };

  return (
    <div
      className="flex h-svh flex-col overflow-hidden bg-[#07090e] text-slate-100"
      data-testid="agent-dashboard"
    >
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/80 px-5 py-3 shadow-2xl backdrop-blur-md"
        data-testid="dashboard-header"
      >
        <div className="flex items-center gap-3" data-testid="brand-lockup">
          <div className="relative flex size-9 items-center justify-center border border-cyan-400/40 bg-cyan-400/[0.08] text-cyan-300">
            <Waypoints size={18} />
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-400" />
          </div>

          <div>
            <p
              className="font-heading text-base font-extrabold uppercase tracking-[0.14em] text-slate-100"
              data-testid="brand-name"
            >
              FalkorMind
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
              graph-driven agent console
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="border border-white/10 bg-white/[0.03] font-mono text-[9px] tracking-[0.12em] text-slate-400"
            data-testid="graph-name-badge"
          >
            <Database size={10} className="mr-1.5" />
            {statusQuery.data?.graph_name ?? "it_infrastructure_rca"}
          </Badge>

          <Badge
            className={
              mockMode
                ? "border border-amber-500/30 bg-amber-950/80 font-mono text-[9px] tracking-[0.12em] text-amber-300"
                : "border border-emerald-500/30 bg-emerald-950/80 font-mono text-[9px] tracking-[0.12em] text-emerald-300"
            }
            data-testid="backend-mode-badge"
          >
            <span className="mr-1.5 inline-flex size-1.5">
              {mockMode ? (
                <span className="inline-flex size-1.5 rounded-full bg-amber-400" />
              ) : (
                <span className="inline-flex size-1.5 animate-pulse rounded-full bg-emerald-400" />
              )}
            </span>
            FALKORDB: {mockMode ? "MOCK MODE" : "LIVE"}
          </Badge>

          <Badge
            className="border border-white/10 bg-white/[0.03] font-mono text-[9px] tracking-[0.12em] text-slate-400"
            data-testid="connection-mode-badge"
          >
            <Activity size={10} className="mr-1.5" />
            {modeLabel(result?.mcp_mode, connected)}
          </Badge>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left — Agent Workspace (40%) */}
        <section
          className="flex min-h-0 flex-col gap-3 overflow-y-auto border-white/[0.08] p-4 lg:border-r"
          data-testid="agent-workspace-panel"
        >
          <div
            className="shrink-0 rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 shadow-2xl backdrop-blur-md transition-all hover:border-slate-700/80"
            data-testid="chat-input-card"
          >
            <label
              className="mb-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
              htmlFor="agent-question-input"
            >
              Ask the agent
            </label>

            <Textarea
              id="agent-question-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey)
                ) {
                  event.preventDefault();
                  run();
                }
              }}
              placeholder="Why is Checkout Service failing?"
              className="min-h-20 resize-y border-white/10 bg-[#080c14] text-sm leading-relaxed text-slate-200 placeholder:text-slate-700 focus:border-cyan-400/50"
              data-testid="incident-query-input"
            />

            <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid="query-presets">
              {PRESETS.map((preset, index) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setQuery(preset)}
                  className="preset-chip rounded"
                  data-testid={`query-preset-${index}`}
                >
                  {preset.length > 34
                    ? `${preset.slice(0, 34)}...`
                    : preset}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600"
                  htmlFor="incident-id-input"
                >
                  Incident ID
                </label>
                <Input
                  id="incident-id-input"
                  value={incidentId}
                  onChange={(event) =>
                    setIncidentId(event.target.value)
                  }
                  className="h-8 border-white/10 bg-[#080c14] font-mono text-xs text-cyan-200 focus:border-cyan-400/50"
                  data-testid="incident-id-input"
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600"
                  htmlFor="session-id-input"
                >
                  Session memory
                </label>
                <Input
                  id="session-id-input"
                  value={sessionId}
                  onChange={(event) =>
                    setSessionId(event.target.value)
                  }
                  className="h-8 border-white/10 bg-[#080c14] font-mono text-xs text-indigo-200 focus:border-cyan-400/50"
                  data-testid="session-id-input"
                />
              </div>
            </div>

            <Button
              onClick={run}
              disabled={orchestration.isPending}
              className="mt-3 h-10 w-full border border-cyan-300/40 bg-cyan-300/10 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100 hover:-translate-y-0.5 hover:bg-cyan-300/20 hover:text-white"
              data-testid="submit-query-button"
            >
              <Send size={14} />
              {orchestration.isPending
                ? "Running agents..."
                : "Run orchestration"}
            </Button>
          </div>

          <AgentLogStream
            revealed={replay.revealed}
            total={replay.events.length}
            isStreaming={replay.isStreaming}
            activeAgent={replay.activeAgent}
            failedAgents={failedAgents}
            onSkip={replay.skip}
            pending={orchestration.isPending}
          />

          {result && replay.isComplete && (
            <AnswerCard result={result} onVisitNode={focusGraphNode} />
          )}
        </section>

        {/* Right — Live Graph Canvas (60%) */}
        <section
          className="relative flex min-h-[420px] flex-col p-4 lg:min-h-0"
          data-testid="graph-panel"
        >
          <GraphCanvas
            snapshot={snapshot}
            visitedNodes={replay.visitedNodes}
            visitedEdgeKeys={replay.visitedEdgeKeys}
            activeNodeId={replay.activeNodeId}
            rootCauseId={rootCauseId}
            selectedId={selectedNode?.id}
            onSelect={setSelectedNode}
          />

          <NodeDetailsDrawer
            node={selectedNode}
            visited={
              selectedNode
                ? replay.visitedNodes.includes(selectedNode.id)
                : false
            }
            onClose={() => setSelectedNode(undefined)}
          />
        </section>
      </main>
    </div>
  );
}
