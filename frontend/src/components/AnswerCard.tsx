import { useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Clipboard,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrchestrationResponse } from "@/lib/types";

/**
 * Action recommendations are derived from verified graph evidence on the
 * response: the commit that starts the trace and the terminal node it
 * reaches. No remediation is invented for an empty trace.
 */
function recommendations(
  result: OrchestrationResponse,
): string[] {
  const steps = result.trace_path;

  if (!steps.length) {
    return [
      "No graph path was returned — widen the incident scope or seed the graph before acting.",
    ];
  }

  const first = steps[0];
  const last = steps[steps.length - 1];
  const actions = [
    `Roll back ${first.node_id} (${first.label}) and revoke any credentials it exposed.`,
    `Stabilise ${last.node_id} (${last.label}) — it is the terminal node of the verified blast radius.`,
  ];

  if (steps.length > 2) {
    const middle = steps
      .slice(1, -1)
      .map((step) => step.node_id)
      .join(", ");
    actions.push(
      `Drain and health-check the intermediate hop(s): ${middle}.`,
    );
  }

  return actions;
}

interface AnswerCardProps {
  result: OrchestrationResponse;
  onVisitNode?: (nodeId: string) => void;
}

export default function AnswerCard({ result, onVisitNode }: AnswerCardProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    await navigator.clipboard?.writeText(
      JSON.stringify(result, null, 2),
    );
    setCopied(true);
    toast.success("Response JSON copied");
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section
      className="answer-card shrink-0 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-md transition-all hover:border-slate-700/80"
      data-testid="final-answer-card"
    >
      <header className="flex items-center justify-between gap-2 border-b border-cyan-400/15 bg-cyan-400/[0.05] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-cyan-300" />
          <p
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300"
            data-testid="answer-card-title"
          >
            Final answer
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={copyJson}
          aria-label="Copy response JSON"
          className="text-slate-500 hover:bg-white/5 hover:text-cyan-300"
          data-testid="copy-answer-json-button"
        >
          {copied ? <Check size={13} /> : <Clipboard size={13} />}
        </Button>
      </header>

      <div className="space-y-3 px-4 py-3">
        <p
          className="text-sm leading-relaxed text-slate-200"
          data-testid="answer-text"
        >
          {result.answer}
        </p>

        <div>
          <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
            Root cause analysis
          </p>
          <p
            className="text-xs leading-relaxed text-rose-200"
            data-testid="answer-root-cause"
          >
            {result.root_cause_analysis}
          </p>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
            <Wrench size={10} />
            Recommended actions
          </p>

          <ul className="space-y-1.5" data-testid="answer-recommendations">
            {recommendations(result).map((action, index) => (
              <li
                key={action}
                className="flex items-start gap-2 text-xs leading-relaxed text-slate-300"
                data-testid={`answer-recommendation-${index}`}
              >
                <ArrowRight
                  size={12}
                  className="mt-0.5 shrink-0 text-amber-300"
                />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
          <div className="flex items-center gap-1.5">
            <BrainCircuit
              size={12}
              className={
                result.memory_updated
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
              memory commit
            </span>
          </div>

          <Badge
            className={
              result.memory_updated
                ? "border border-emerald-400/30 bg-emerald-400/10 font-mono text-[9px] tracking-[0.12em] text-emerald-300"
                : "border border-amber-400/30 bg-amber-400/10 font-mono text-[9px] tracking-[0.12em] text-amber-300"
            }
            data-testid="memory-commit-status"
          >
            {result.memory_updated
              ? "PERSISTED TO FALKORDB"
              : "NOT PERSISTED · MOCK"}
          </Badge>
        </div>

        <div
          className="grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3"
          data-testid="answer-metrics"
        >
          <div>
            <p className="font-mono text-base text-amber-200" data-testid="metric-visited-nodes">
              {result.visited_nodes.length}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
              visited nodes
            </p>
          </div>

          <div>
            <p className="font-mono text-base text-cyan-200" data-testid="metric-tool-calls">
              {result.tool_log.length}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
              tool calls
            </p>
          </div>

          <div>
            <p className="font-mono text-base text-slate-200" data-testid="metric-mcp-mode">
              {result.mcp_mode.toUpperCase()}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">
              adapter mode
            </p>
          </div>
        </div>

        {result.visited_nodes.length > 0 && (
          <div className="border-t border-white/[0.07] pt-3">
            <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
              Visited graph nodes · click to locate
            </p>
            <div
              className="flex flex-wrap gap-1.5"
              data-testid="answer-visited-chips"
            >
              {result.visited_nodes.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onVisitNode?.(id)}
                  className="cursor-pointer rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-slate-700 hover:text-cyan-200"
                  data-testid={`answer-visited-chip-${id}`}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
