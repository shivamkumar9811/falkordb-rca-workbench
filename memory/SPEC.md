# Falkor / Orchestra

## Purpose

An incident command console that coordinates three deterministic agents over the existing FalkorDB MCP tool contract. Users submit a natural-language incident query plus an incident and session ID, then receive a verified graph trace, root-cause analysis, readable audit trail, and raw JSON.

## Data model

- `OrchestrationRequest`: `query`, `incident_id`, and `session_id`.
- `OrchestrationResponse`: `answer`, `trace_path`, `visited_nodes`, `memory_updated`, `raw_graph_path`, `previous_memory`, `tool_log`, `agents`, and execution metadata.
- FalkorDB graph nodes/edges and `SessionMemory` remain compatible with `backend/models/graph.py` and the existing seed scenario.

## Key flow

1. Memory Agent calls `tool_read_session_memory` before investigation.
2. Investigator Agent calls `tool_execute_cypher`, then `tool_find_shortest_path` for bounded multi-hop reasoning.
3. Explainer Agent converts returned hops into the audit trail without adding unsupported entities.
4. Memory Agent calls `tool_write_session_memory` after the explanation. Mock mode explicitly reports `memory_updated: false`.

## Connectivity

`FALKOR_MCP_MODE=auto|live|mock` and optional `FALKOR_MCP_URL` configure the adapter. Auto mode tries the configured MCP endpoint, then the existing local GraphStore, then a deterministic mock fallback. Live mode fails safely when no endpoint is configured.

## Auth

There is no login or role gate. MCP credentials, when used, are server-side environment values and never reach the browser.

## Frontend dashboard (`/`)

`src/pages/Orchestrator.tsx` is the single-page Graph-Driven Agent dashboard, split 40/60:

- **Left — Agent Workspace**: chat input (`incident-query-input`) with presets plus incident/session IDs, a live
  reasoning log (`AgentLogStream`), and the final answer card (`AnswerCard`) carrying root cause, derived action
  recommendations, and memory-commit status.
- **Right — Live Graph Canvas**: `GraphCanvas` renders the topology with Cytoscape.js (`cose` layout) and supports
  pan, zoom, fit, focus-trace, reset, and click-to-open `NodeDetailsDrawer`.

`src/pages/Home.tsx` (the older tool workbench) remains routed at `/workbench`.

### Streaming model

`/api/orchestrate` returns one complete JSON document, not a token stream. `src/lib/agentStream.ts`
(`buildStreamEvents` + `useAgentReplay`) replays that response as a timed timeline (~620ms/step) derived strictly
from `tool_log`, `agents`, `previous_memory` and `trace_path` — nothing is invented. Each `trace_path` hop reveals
its node and incoming edge, so the canvas highlights the traversal progressively: amber `.visited`, red `.active`
for the current hop, and non-path elements faded. `prefers-reduced-motion` renders the timeline instantly.

### Graph data source

The canvas prefers `/api/graph`, which only answers when FalkorDB is reachable. When it is not,
`src/lib/fallbackGraph.ts` supplies a topology mirroring `seed.cypher` exactly, so the canvas is never blank and
still matches the node IDs the deterministic mock adapter traverses.

### Testing hook

Cytoscape draws to `<canvas>`, so there are no DOM nodes to target. `GraphCanvas` assigns the Cytoscape core to
`window.__cy` on mount (removed on unmount) so browser checks can resolve a node's `renderedPosition()` and click
it, and assert `.visited` / `.active` classes.
