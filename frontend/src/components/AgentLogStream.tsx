import { useEffect, useRef } from "react";
import {
  BrainCircuit,
  ChevronsRight,
  GitBranch,
  Search,
  Terminal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  StreamAgent,
  StreamEvent,
  StreamTone,
} from "@/lib/agentStream";

const TONE_COLOR: Record<StreamTone, string> = {
  info: "text-slate-400",
  tool: "text-cyan-300",
  hop: "text-amber-300",
  success: "text-emerald-300",
  warn: "text-rose-300",
};

const TONE_DOT: Record<StreamTone, string> = {
  info: "bg-slate-500",
  tool: "bg-cyan-400",
  hop: "bg-amber-400",
  success: "bg-emerald-400",
  warn: "bg-rose-400",
};

const AGENT_ICON: Record<StreamAgent, typeof Terminal> = {
  "Memory Agent": BrainCircuit,
  "Investigator Agent": Search,
  "Explainer Agent": GitBranch,
  System: Terminal,
};

interface AgentLogStreamProps {
  revealed: StreamEvent[];
  total: number;
  isStreaming: boolean;
  activeAgent?: StreamAgent;
  onSkip: () => void;
  pending: boolean;
}

export default function AgentLogStream({
  revealed,
  total,
  isStreaming,
  activeAgent,
  onSkip,
  pending,
}: AgentLogStreamProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [revealed.length]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0f19]"
      data-testid="agent-log-stream"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-slate-500" />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Agent reasoning stream
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isStreaming && (
            <Badge
              className="border border-cyan-400/25 bg-cyan-400/[0.08] font-mono text-[9px] tracking-[0.12em] text-cyan-300"
              data-testid="stream-live-badge"
            >
              <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-cyan-300" />
              STREAMING
            </Badge>
          )}

          <span
            className="font-mono text-[9px] text-slate-600"
            data-testid="stream-progress"
          >
            {revealed.length}/{total || 0}
          </span>

          {isStreaming && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onSkip}
              className="font-mono text-[9px] uppercase tracking-wider text-slate-500 hover:bg-white/5 hover:text-cyan-300"
              data-testid="stream-skip-button"
            >
              Skip
              <ChevronsRight size={12} />
            </Button>
          )}
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        data-testid="stream-log-body"
      >
        {!revealed.length && !pending && (
          <div
            className="flex h-full flex-col items-center justify-center gap-2 text-center"
            data-testid="stream-log-empty"
          >
            <Terminal size={20} className="text-slate-700" />
            <p className="font-mono text-[10px] leading-relaxed text-slate-600">
              Ask a question to stream the agent&apos;s
              <br />
              reasoning steps in real time.
            </p>
          </div>
        )}

        {pending && !revealed.length && (
          <p
            className="font-mono text-[10px] text-cyan-300"
            data-testid="stream-log-pending"
          >
            <span className="mr-2 inline-block size-1.5 animate-pulse rounded-full bg-cyan-300" />
            Dispatching orchestration request...
          </p>
        )}

        <ol className="space-y-2">
          {revealed.map((event, index) => {
            const Icon = AGENT_ICON[event.agent];
            const isLast = index === revealed.length - 1;

            return (
              <li
                key={event.id}
                className={`log-line rounded border px-2.5 py-2 ${
                  isLast && isStreaming
                    ? "border-cyan-400/30 bg-cyan-400/[0.05]"
                    : "border-white/[0.06] bg-[#111622]"
                }`}
                data-testid={`stream-log-entry-${index}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      TONE_DOT[event.tone]
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon size={10} className="shrink-0 text-slate-600" />
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
                        {event.agent}
                      </span>
                    </div>

                    <p
                      className={`mt-1 break-words font-mono text-[11px] leading-relaxed ${
                        TONE_COLOR[event.tone]
                      }`}
                    >
                      {event.text}
                    </p>

                    {event.detail && (
                      <p className="mt-1 break-words font-mono text-[9px] leading-relaxed text-slate-600">
                        {event.detail}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <div ref={endRef} />
      </div>

      {activeAgent && (
        <footer
          className="shrink-0 border-t border-white/[0.08] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600"
          data-testid="stream-active-agent"
        >
          active / {activeAgent}
        </footer>
      )}
    </section>
  );
}
