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

