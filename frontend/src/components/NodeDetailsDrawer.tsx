import {
  AlertTriangle,
  BrainCircuit,
  Database,
  GitCommitHorizontal,
  Server,
  UserRound,
  Webhook,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { colorForLabels } from "@/lib/fallbackGraph";
import type { GraphNode } from "@/lib/types";

const ICONS: Record<string, typeof UserRound> = {
  Developer: UserRound,
  CodeCommit: GitCommitHorizontal,
  Microservice: Server,
  Database,
  APIRoute: Webhook,
  Incident: AlertTriangle,
  SessionMemory: BrainCircuit,
};

interface NodeDetailsDrawerProps {
  node?: GraphNode;
  visited: boolean;
  onClose: () => void;
}

export default function NodeDetailsDrawer({
  node,
  visited,
  onClose,
}: NodeDetailsDrawerProps) {
  if (!node) {
    return null;
  }

  const label = node.labels[0] ?? "Node";
  const Icon = ICONS[label] ?? Server;
  const color = colorForLabels(node.labels);
  const entries = Object.entries(node.properties);

  return (
    <aside
      className="node-drawer absolute bottom-0 right-0 top-0 z-20 flex w-full max-w-[320px] flex-col border-l border-white/[0.08] bg-[#0a0e17]/95 backdrop-blur-xl"
      data-testid="node-details-drawer"
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded border"
            style={{
              borderColor: `${color}66`,
              backgroundColor: `${color}1A`,
              color,
            }}
          >
            <Icon size={16} />
          </div>

          <div className="min-w-0">
            <p
              className="truncate font-mono text-sm text-slate-100"
              data-testid="drawer-node-id"
            >
              {node.id}
            </p>
            <p
              className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500"
              data-testid="drawer-node-label"
            >
              {label}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close node details"
          className="shrink-0 text-slate-500 hover:bg-white/5 hover:text-slate-100"
          data-testid="drawer-close-button"
        >
          <X size={15} />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge
            className={
              visited
                ? "border border-amber-400/30 bg-amber-400/10 font-mono text-[9px] tracking-[0.12em] text-amber-300"
                : "border border-white/10 bg-white/[0.03] font-mono text-[9px] tracking-[0.12em] text-slate-500"
            }
            data-testid="drawer-visited-badge"
          >
            {visited ? "VISITED BY AGENT" : "NOT ON TRACE"}
          </Badge>
        </div>

        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-600">
          Node properties
        </p>

        {entries.length ? (
          <dl className="space-y-2">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="rounded border border-white/[0.06] bg-[#111622] px-2.5 py-2"
                data-testid={`drawer-property-${key}`}
              >
                <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
                  {key}
                </dt>
                <dd className="mt-1 break-words font-mono text-[11px] leading-relaxed text-slate-200">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p
            className="font-mono text-[10px] text-slate-600"
            data-testid="drawer-no-properties"
          >
            This node carries no properties.
          </p>
        )}
      </div>
    </aside>
  );
}
