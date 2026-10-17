import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  Clipboard,
  Database,
  GitBranch,
  LockKeyhole,
  Radio,
  Search,
  ShieldAlert,
  Terminal,
  Waypoints,
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
import type {
  FalkorStatus,
  OrchestrationResponse,
} from "@/lib/types";

const DEFAULT_QUERY =
  "Trace the root cause of the payment gateway outage and verify the dependency chain.";
const DEFAULT_INCIDENT = "INC-8821";
const DEFAULT_SESSION = "sess_rca_8821";

const presets = [
  {
    label: "Payment gateway 504s",
    query: DEFAULT_QUERY,
    incident: DEFAULT_INCIDENT,
  },
  {
    label: "Database connection exhaustion",
    query: "Which commit and service dependency led to the database connection exhaustion?",
    incident: DEFAULT_INCIDENT,
  },
  {
    label: "Auth-service latency spike",
    query: "Investigate the connected entities behind the authentication latency incident without guessing.",
    incident: DEFAULT_INCIDENT,
  },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Orchestration request failed";
}

function modeLabel(mode?: string, connected?: boolean): string {
  if (mode === "mock") return "MOCK FALLBACK";
  if (mode === "mcp") return "MCP LIVE";
  if (mode === "local" && connected) return "FALKORDB LIVE";
  return mode ? mode.toUpperCase() : "STANDBY";
}

function Header({ mode, connected }: { mode?: string; connected?: boolean }) {
  return (
    <header
      className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-white/[0.08] bg-[#0a0d14]/90 px-5 backdrop-blur-xl md:px-8"
      data-testid="orchestrator-header"
    >
      <div className="flex items-center gap-3" data-testid="brand-lockup">
        <div className="relative flex size-10 items-center justify-center border border-cyan-400/40 bg-cyan-400/[0.08] text-cyan-300 shadow-[0_0_22px_rgba(0,229,255,0.12)]" data-testid="brand-mark">
          <Waypoints size={20} />
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]" />
        </div>
        <div>
          <p className="font-heading text-lg font-extrabold uppercase tracking-[0.14em] text-slate-100" data-testid="brand-name">
            FALKOR / ORCHESTRA
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500" data-testid="brand-caption">
            multi-agent incident command
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2" data-testid="header-status-cluster">
        <Badge className="hidden border border-cyan-400/20 bg-cyan-400/[0.07] font-mono text-[9px] tracking-[0.14em] text-cyan-300 sm:flex" data-testid="agent-system-badge">
          <Activity size={11} className="mr-1.5" />
          3 AGENTS ARMED
        </Badge>
        <Badge className={mode === "mock" ? "border border-amber-400/30 bg-amber-400/10 font-mono text-[9px] tracking-[0.12em] text-amber-300" : "border border-emerald-400/30 bg-emerald-400/10 font-mono text-[9px] tracking-[0.12em] text-emerald-300"} data-testid="connection-mode-badge">
          <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-current" />
          {modeLabel(mode, connected)}
        </Badge>
      </div>
    </header>
  );
}

function AgentPipeline({ result, running }: { result?: OrchestrationResponse; running: boolean }) {
  const statuses = result?.agents ?? [
    { name: "Memory Agent", status: running ? "active" : "ready", detail: "Reads prior session context" },
    { name: "Investigator Agent", status: running ? "active" : "ready", detail: "Runs Cypher + bounded path" },
    { name: "Explainer Agent", status: running ? "queued" : "ready", detail: "Builds the audit trail" },
  ];
  const icons = [BrainCircuit, Search, GitBranch];
  const colors = ["text-emerald-300", "text-amber-300", "text-cyan-300"];

  return (
    <Card className="console-card h-full" data-testid="agent-pipeline-card">
      <CardHeader className="border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="console-kicker" data-testid="pipeline-title">Sequential agent run</CardTitle>
          <Badge className="border border-white/10 bg-white/[0.03] font-mono text-[9px] text-slate-500" data-testid="pipeline-order-badge">01 → 02 → 03</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {statuses.map((agent, index) => {
          const Icon = icons[index];
          const isComplete = agent.status === "complete";
          const isActive = agent.status === "active" || (running && index === 0);
          return (
            <div className={`agent-row ${isActive ? "agent-row-active" : ""}`} key={agent.name} data-testid={`agent-status-${index === 0 ? "memory" : index === 1 ? "investigator" : "explainer"}`}>
              <div className={`flex size-9 shrink-0 items-center justify-center border ${isComplete ? "border-emerald-400/30 bg-emerald-400/10" : isActive ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}>
                {isComplete ? <Check size={15} className="text-emerald-300" /> : <Icon size={15} className={colors[index]} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-heading text-base font-bold uppercase tracking-[0.08em] text-slate-200">{agent.name}</p>
                  <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${isComplete ? "text-emerald-300" : isActive ? "text-cyan-300" : "text-slate-600"}`}>{agent.status}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{agent.detail}</p>
              </div>
              {index < 2 && <ChevronRight size={14} className="hidden text-slate-700 md:block" />}
            </div>
          );
        })}
        <div className="mt-4 rounded border border-white/[0.07] bg-[#0a0d14] p-3" data-testid="tool-log-summary">
          <div className="mb-2 flex items-center justify-between">
            <span className="console-kicker">Tool sequence</span>
            <Terminal size={13} className="text-slate-600" />
          </div>
          {(result?.tool_log ?? []).length ? (
            result?.tool_log.map((log, index) => (
              <div className="flex items-center gap-2 py-1 font-mono text-[10px]" key={`${log.tool}-${index}`} data-testid={`tool-log-entry-${index}`}>
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <span className="text-slate-500">{log.agent.replace(" Agent", "")}</span>
                <span className="text-cyan-300">{log.tool}</span>
              </div>
            ))
          ) : (
            <p className="font-mono text-[10px] leading-relaxed text-slate-600" data-testid="tool-log-empty">Submit a query to stream the four required FalkorDB tool calls.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTrail({ result }: { result?: OrchestrationResponse }) {
  return (
    <Card className="console-card" data-testid="audit-trail-container">
      <CardHeader className="border-b border-white/[0.07] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="console-kicker" data-testid="audit-trail-title">Multi-hop audit trail</CardTitle>
            <p className="mt-1 text-xs text-slate-500">Raw traversal reformatted by the Explainer Agent. No graph hop is inferred.</p>
          </div>
          <GitBranch size={17} className="text-cyan-300" />
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {result?.trace_path.length ? (
          <div className="overflow-x-auto pb-2" data-testid="trace-path-visualizer">
            <div className="flex min-w-[650px] items-stretch">
              {result.trace_path.map((step, index) => (
                <div className="flex items-center" key={`${step.node_id}-${step.step}`} data-testid={`trace-node-${step.step}`}>
                  {index > 0 && (
                    <div className="flex w-24 flex-col items-center px-2">
                      <span className="mb-1 font-mono text-[9px] uppercase tracking-wider text-amber-300">{step.relation_from_previous}</span>
                      <div className="flex w-full items-center"><div className="h-px flex-1 bg-amber-400/50" /><ArrowRight size={13} className="text-amber-300" /></div>
                    </div>
                  )}
                  <div className="trace-node w-44 rounded border border-cyan-400/20 bg-[#111827] p-3">
                    <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] text-cyan-300">0{step.step}</span><span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#00e5ff]" /></div>
                    <p className="truncate font-mono text-xs font-semibold text-slate-100">{step.node_id}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-slate-500">{step.label}</p>
                    {Object.entries(step.properties).slice(0, 1).map(([key, value]) => <p className="mt-3 truncate text-[10px] text-slate-400" key={key}>{key}: {String(value)}</p>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state" data-testid="audit-trail-empty"><Waypoints size={20} className="text-slate-600" /><p>Awaiting a verified path from Investigator Agent.</p></div>
        )}
        {result && <div className="mt-5 border-t border-white/[0.07] pt-4" data-testid="explainer-answer"><p className="console-kicker text-cyan-300">Explainer output</p><p className="mt-2 text-sm leading-relaxed text-slate-300">{result.answer}</p></div>}
      </CardContent>
    </Card>
  );
}

function JsonPanel({ result }: { result?: OrchestrationResponse }) {
  const [copied, setCopied] = useState(false);
  const json = result ? JSON.stringify(result, null, 2) : "// JSON response will appear here";
  const copy = async () => {
    await navigator.clipboard?.writeText(json);
    setCopied(true);
    toast.success("JSON response copied");
    window.setTimeout(() => setCopied(false), 1400);
  };
  return (
    <Card className="console-card" data-testid="json-response-card">
      <CardHeader className="flex flex-row items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <CardTitle className="console-kicker" data-testid="json-response-title">Response JSON</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={copy} className="text-slate-500 hover:bg-white/5 hover:text-cyan-300" data-testid="copy-json-button" disabled={!result}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</Button>
      </CardHeader>
      <CardContent className="p-0"><pre className="max-h-[360px] overflow-auto p-4 font-mono text-[10px] leading-relaxed text-cyan-100/80" data-testid="json-response-content">{json}</pre></CardContent>
    </Card>
  );
}

export default function Orchestrator() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [incidentId, setIncidentId] = useState(DEFAULT_INCIDENT);
  const [sessionId, setSessionId] = useState(DEFAULT_SESSION);
  const statusQuery = useQuery({ queryKey: ["falkor-status"], queryFn: () => apiGet<FalkorStatus>("/status"), retry: false, refetchInterval: 15000 });
  const orchestration = useMutation({
    mutationFn: () => apiPost<OrchestrationResponse>("/orchestrate", { query, incident_id: incidentId, session_id: sessionId }),
    onError: (error) => toast.error(errorMessage(error)),
    onSuccess: (result) => toast.success(result.mcp_mode === "mock" ? "RCA complete · deterministic mock evidence" : "RCA complete · graph evidence verified"),
  });
  const result = orchestration.data;
  const connected = statusQuery.data?.connected;

  const run = () => {
    if (!query.trim() || !incidentId.trim()) {
      toast.error("Add an incident query and incident ID");
      return;
    }
    orchestration.mutate();
  };

  return (
    <div className="min-h-svh bg-[#0a0d14] text-slate-100" data-testid="incident-orchestrator-console">
      <Header mode={result?.mcp_mode} connected={connected} />
      <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end" data-testid="console-intro">
          <div><div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300"><Radio size={12} /> Incident intelligence / orchestration</div><h1 className="font-heading text-4xl font-extrabold uppercase leading-none tracking-[0.02em] text-slate-100 md:text-6xl">Find the failure chain.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">Three agents. One bounded graph trace. Every conclusion backed by FalkorDB evidence.</p></div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500" data-testid="console-telemetry"><span className="size-1.5 rounded-full bg-cyan-300" /> session telemetry online <span className="text-slate-700">/</span> {statusQuery.data?.graph_name ?? "graph standby"}</div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="lg:col-span-5" data-testid="incident-query-panel">
            <Card className="console-card query-card h-full overflow-hidden">
              <CardHeader className="relative border-b border-white/[0.07] px-5 py-5"><div className="absolute inset-0 tactical-grid opacity-50" /><div className="relative flex items-center justify-between"><div><CardTitle className="font-heading text-xl font-bold uppercase tracking-[0.1em] text-slate-100" data-testid="query-panel-title">Incident query</CardTitle><p className="mt-1 text-xs text-slate-500">Ask for a connected failure explanation.</p></div><ShieldAlert className="text-rose-300" size={21} /></div></CardHeader>
              <CardContent className="relative space-y-4 p-5">
                <div><label className="console-kicker mb-2 block" htmlFor="incident-query">Natural language brief</label><Textarea id="incident-query" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-28 resize-y border-white/10 bg-[#0a0d14] font-sans text-sm leading-relaxed text-slate-200 placeholder:text-slate-700 focus:border-cyan-400/50 focus:ring-cyan-400/20" data-testid="incident-query-input" placeholder="Describe the incident you want traced..." /></div>
                <div className="grid gap-3 sm:grid-cols-2"><div><label className="console-kicker mb-2 block" htmlFor="incident-id">Incident ID</label><Input id="incident-id" value={incidentId} onChange={(event) => setIncidentId(event.target.value)} className="border-white/10 bg-[#0a0d14] font-mono text-xs text-cyan-200 focus:border-cyan-400/50" data-testid="incident-id-input" /></div><div><label className="console-kicker mb-2 block" htmlFor="session-id">Session memory</label><Input id="session-id" value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="border-white/10 bg-[#0a0d14] font-mono text-xs text-indigo-200 focus:border-cyan-400/50" data-testid="session-id-input" /></div></div>
                <div><p className="console-kicker mb-2">Quick briefs</p><div className="flex flex-wrap gap-2" data-testid="query-presets">{presets.map((preset) => <button type="button" key={preset.label} onClick={() => { setQuery(preset.query); setIncidentId(preset.incident); }} className="preset-chip" data-testid={`preset-${preset.label.toLowerCase().replace(/ /g, "-")}`}>{preset.label}</button>)}</div></div>
                <Button onClick={run} disabled={orchestration.isPending} className="h-11 w-full border border-cyan-300/40 bg-cyan-300/10 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100 shadow-[0_0_24px_rgba(0,229,255,0.08)] hover:-translate-y-0.5 hover:bg-cyan-300/20 hover:text-white" data-testid="submit-query-button"><Search size={15} />{orchestration.isPending ? "Running agents..." : "Run orchestration"}<ArrowRight size={15} /></Button>
                <div className="flex items-center justify-between border-t border-white/[0.07] pt-3 font-mono text-[9px] uppercase tracking-wider text-slate-600"><span className="flex items-center gap-1.5"><LockKeyhole size={11} /> server-side tools only</span><span data-testid="query-mode-copy">{result ? modeLabel(result.mcp_mode, connected) : "auto / mock fallback"}</span></div>
              </CardContent>
            </Card>
          </section>
          <section className="lg:col-span-7"><AgentPipeline result={result} running={orchestration.isPending} /></section>
          <section className="lg:col-span-8"><AuditTrail result={result} /></section>
          <aside className="space-y-5 lg:col-span-4">
            <Card className="console-card" data-testid="memory-summary-card"><CardHeader className="border-b border-white/[0.07] px-5 py-4"><div className="flex items-center justify-between"><CardTitle className="console-kicker">Session memory</CardTitle><BrainCircuit size={16} className="text-emerald-300" /></div></CardHeader><CardContent className="space-y-3 p-5">{result?.previous_memory.length ? <div className="rounded border border-emerald-400/20 bg-emerald-400/[0.05] p-3" data-testid="previous-memory-entry"><p className="font-mono text-[10px] text-emerald-300">{result.session_id} / prior trace</p><p className="mt-2 text-xs leading-relaxed text-slate-300">{String(result.previous_memory[0].decision ?? "Prior decision loaded")}</p></div> : <div className="empty-state py-5" data-testid="memory-empty"><BrainCircuit size={18} /><p>No prior trace loaded yet.</p></div>}<div className="flex items-center justify-between border-t border-white/[0.07] pt-3"><span className="console-kicker">Write status</span><span className={result?.memory_updated ? "status-good" : "status-muted"} data-testid="memory-updated-status">{result ? result.memory_updated ? "PERSISTED" : "MOCKED" : "PENDING"}</span></div></CardContent></Card>
            <JsonPanel result={result} />
          </aside>
        </div>

        {result && <div className="mt-5 grid gap-3 border border-white/[0.07] bg-[#111622] p-4 sm:grid-cols-3" data-testid="result-metrics"><div><p className="console-kicker">Visited nodes</p><p className="mt-1 font-mono text-lg text-cyan-200">{result.visited_nodes.length}</p></div><div><p className="console-kicker">Tool calls</p><p className="mt-1 font-mono text-lg text-amber-200">{result.tool_log.length}</p></div><div><p className="console-kicker">Memory updated</p><p className="mt-1 font-mono text-lg text-emerald-200">{result.memory_updated ? "YES" : "NO · MOCK"}</p></div></div>}
      </main>
    </div>
  );
}
