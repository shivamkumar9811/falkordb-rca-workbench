import { useEffect, useMemo, useRef, useState } from "react";

import type { OrchestrationResponse } from "@/lib/types";

export type StreamTone =
  | "info"
  | "tool"
  | "hop"
  | "success"
  | "warn";

export type StreamAgent =
  | "Memory Agent"
  | "Investigator Agent"
  | "Explainer Agent"
  | "System";

export interface StreamEvent {
  id: string;
  agent: StreamAgent;
  tone: StreamTone;
  text: string;
  detail?: string;
  /** Node revealed on the Cytoscape canvas when this event fires. */
  nodeId?: string;
  /** Directed edge revealed alongside nodeId, as `${start}->${end}`. */
  edgeKey?: string;
}

const TOOL_LABEL: Record<string, string> = {
  tool_read_session_memory: "Reading session memory",
  tool_execute_cypher: "Executing Cypher query",
  tool_find_shortest_path: "Traversing shortest path",
  tool_write_session_memory: "Committing session memory",
};

/**
 * Converts one complete /api/orchestrate response into an ordered log
 * timeline. Nothing is invented: every line is derived from tool_log,
 * agents, trace_path or previous_memory on the response itself.
 */
export function buildStreamEvents(
  result: OrchestrationResponse,
): StreamEvent[] {
  const events: StreamEvent[] = [];

  const push = (event: Omit<StreamEvent, "id">) => {
    events.push({ ...event, id: `evt-${events.length}` });
  };

  push({
    agent: "System",
    tone: "info",
    text: `Orchestrating ${result.incident_id} across 3 sequential agents`,
    detail: `session ${result.session_id} · adapter ${result.mcp_mode}`,
  });

  const priorCount = result.previous_memory.length;

  push({
    agent: "Memory Agent",
    tone: "tool",
    text: "Reading session memory...",
    detail: priorCount
      ? `${priorCount} prior decision(s) recovered for ${result.session_id}`
      : `No prior trace stored for ${result.session_id}`,
  });

  const cypherCall = result.tool_log.find(
    (entry) => entry.tool === "tool_execute_cypher",
  );

  push({
    agent: "Investigator Agent",
    tone: "tool",
    text: "Agent executing Cypher query...",
    detail: cypherCall
      ? `${cypherCall.tool} → ${cypherCall.status} (${cypherCall.mode})`
      : "tool_execute_cypher",
  });

  push({
    agent: "Investigator Agent",
    tone: "tool",
    text: "Resolving bounded multi-hop path...",
    detail: `tool_find_shortest_path · ${result.trace_path.length} hop(s) returned`,
  });

  result.trace_path.forEach((step, index) => {
    const previous = result.trace_path[index - 1];

    push({
      agent: "Investigator Agent",
      tone: "hop",
      text:
        index === 0
          ? `Hop ${step.step} · entering [${step.node_id}]`
          : `Hop ${step.step} · ${step.relation_from_previous} → [${step.node_id}]`,
      detail: `${step.label}${
        Object.keys(step.properties).length
          ? ` · ${Object.entries(step.properties)
              .map(([key, value]) => `${key}=${String(value)}`)
              .join(" · ")}`
          : ""
      }`,
      nodeId: step.node_id,
      edgeKey: previous
        ? `${previous.node_id}->${step.node_id}`
        : undefined,
    });
  });

  if (!result.trace_path.length) {
    push({
      agent: "Investigator Agent",
      tone: "warn",
      text: "No connected graph path returned",
      detail: "No root-cause claim will be made without graph evidence",
    });
  }

  push({
    agent: "Explainer Agent",
    tone: "info",
    text: "Composing human-readable audit trail...",
    detail: `${result.visited_nodes.length} visited node(s) formatted`,
  });

  const writeCall = result.tool_log.find(
    (entry) => entry.tool === "tool_write_session_memory",
  );

  push({
    agent: "Memory Agent",
    tone: result.memory_updated ? "success" : "warn",
    text: result.memory_updated
      ? "Session memory committed to FalkorDB"
      : "Session memory NOT persisted (mock adapter)",
    detail: writeCall
      ? `${writeCall.tool} → ${writeCall.status} (${writeCall.mode})`
      : TOOL_LABEL.tool_write_session_memory,
  });

  push({
    agent: "System",
    tone: "success",
    text: "Orchestration complete · final answer ready",
  });

  return events;
}

export interface AgentReplayState {
  events: StreamEvent[];
  revealed: StreamEvent[];
  visitedNodes: string[];
  visitedEdgeKeys: string[];
  activeNodeId?: string;
  activeAgent?: StreamAgent;
  isStreaming: boolean;
  isComplete: boolean;
  skip: () => void;
}

/**
 * Replays the derived timeline on a fixed cadence so the operator sees
 * the traversal build up hop by hop instead of appearing at once.
 */
export function useAgentReplay(
  result: OrchestrationResponse | undefined,
  stepMs = 620,
): AgentReplayState {
  const events = useMemo(
    () => (result ? buildStreamEvents(result) : []),
    [result],
  );

  const [count, setCount] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearInterval(timer.current);
    setCount(0);

    if (!events.length) {
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      setCount(events.length);
      return;
    }

    setCount(1);

    timer.current = window.setInterval(() => {
      setCount((current) => {
        if (current >= events.length) {
          window.clearInterval(timer.current);
          return current;
        }
        return current + 1;
      });
    }, stepMs);

    return () => window.clearInterval(timer.current);
  }, [events, stepMs]);

  const revealed = events.slice(0, count);

  const visitedNodes: string[] = [];
  const visitedEdgeKeys: string[] = [];

  for (const event of revealed) {
    if (event.nodeId && !visitedNodes.includes(event.nodeId)) {
      visitedNodes.push(event.nodeId);
    }
    if (event.edgeKey && !visitedEdgeKeys.includes(event.edgeKey)) {
      visitedEdgeKeys.push(event.edgeKey);
    }
  }

  return {
    events,
    revealed,
    visitedNodes,
    visitedEdgeKeys,
    activeNodeId: visitedNodes[visitedNodes.length - 1],
    activeAgent: revealed[revealed.length - 1]?.agent,
    isStreaming: Boolean(events.length) && count < events.length,
    isComplete: Boolean(events.length) && count >= events.length,
    skip: () => {
      window.clearInterval(timer.current);
      setCount(events.length);
    },
  };
}
