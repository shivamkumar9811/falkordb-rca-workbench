"""Deterministic multi-agent orchestration over the FalkorDB tool contract."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx

from lib.falkor import GraphStore, serialize_path


logger = logging.getLogger(__name__)


memory_prompt = """You are the Memory Agent in a sequential incident RCA system.
Your goal is to preserve cross-session investigation context without inventing facts.
Before any investigation begins, invoke tool_read_session_memory with the supplied
session_id and surface prior decisions and visited node IDs to the Investigator.
After the Explainer produces a verified answer, invoke tool_write_session_memory with
the final decision and the exact graph path visited. Never claim a mock write was
persisted; report memory_updated=false when the adapter is in mock mode.
"""

investigator_prompt = """You are the Investigator Agent for incident and system-failure queries.
Never guess a root cause. Use FalkorDB evidence only: invoke tool_execute_cypher to
identify the incident, candidate source/target entities, and their properties, then
invoke tool_find_shortest_path for bounded multi-hop reasoning over connected nodes.
Return the raw graph path traversed, visited nodes, and a root-cause analysis that
clearly distinguishes verified graph evidence from missing evidence. A query that
returns no path must not become a speculative answer.
"""

explainer_prompt = """You are the Explainer Agent. Transform the Investigator's raw multi-hop
graph output into a human-readable, step-by-step audit trail. Preserve node IDs and
relationship types exactly, using a format such as [Incident] -> AFFECTS -> [Service].
Explain why each hop matters, state the verified root cause, and call out uncertainty
when the graph does not provide enough evidence. Do not add entities not in the path.
"""


@dataclass(frozen=True)
class AgentDefinition:
    name: str
    system_prompt: str


AGENTS = (
    AgentDefinition("Memory Agent", memory_prompt),
    AgentDefinition("Investigator Agent", investigator_prompt),
    AgentDefinition("Explainer Agent", explainer_prompt),
)

TOOL_NAMES = {
    "execute": "tool_execute_cypher",
    "path": "tool_find_shortest_path",
    "read_memory": "tool_read_session_memory",
    "write_memory": "tool_write_session_memory",
}


class FalkorToolAdapter:
    """MCP-compatible adapter with local FalkorDB and deterministic mock modes."""

    def __init__(self, graph: GraphStore | None = None) -> None:
        self.graph = graph
        self.url = os.environ.get("FALKOR_MCP_URL", "").strip() or None
        self.api_key = os.environ.get("FALKOR_MCP_API_KEY", "").strip() or None
        self.mode = os.environ.get("FALKOR_MCP_MODE", "auto").strip().lower()
        if self.mode not in {"auto", "live", "mock"}:
            self.mode = "auto"
        self.timeout = float(
            os.environ.get("FALKOR_MCP_TIMEOUT_SECONDS", "8")
        )
        self.mode_used = "mock" if self.mode == "mock" else "local"

    async def call(
        self,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        if tool_name not in TOOL_NAMES.values():
            raise ValueError(f"Unsupported FalkorDB tool: {tool_name}")

        if self.mode == "mock":
            self.mode_used = "mock"
            return self._mock(tool_name, arguments)

        if self.url:
            try:
                result = await self._call_http(tool_name, arguments)
                self.mode_used = "mcp"
                return result
            except Exception:
                if self.mode == "live":
                    raise
                logger.warning(
                    "MCP endpoint unavailable; using deterministic mock mode",
                    exc_info=True,
                )

        if self.mode == "live":
            raise RuntimeError("FALKOR_MCP_MODE=live requires FALKOR_MCP_URL")

        try:
            result = await self._call_local(tool_name, arguments)
            self.mode_used = "local"
            return result
        except Exception:
            logger.warning(
                "Local FalkorDB unavailable; using deterministic mock mode",
                exc_info=True,
            )
            self.mode_used = "mock"
            return self._mock(tool_name, arguments)

    async def _call_http(
        self,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        headers = {"Accept": "application/json, text/event-stream"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }

        timeout = httpx.Timeout(self.timeout, connect=self.timeout)
        async with httpx.AsyncClient(
            timeout=timeout,
            headers=headers,
        ) as client:
            response = await client.post(self.url, json=payload)
            response.raise_for_status()
            body = self._decode_http_body(response)

        if body.get("error"):
            raise RuntimeError(str(body["error"]))

        result = body.get("result", body)
        if result.get("isError"):
            raise RuntimeError("MCP tool returned an error")

        structured = result.get("structuredContent")
        if isinstance(structured, dict):
            return structured

        content = result.get("content")
        if isinstance(content, list):
            for item in content:
                text = item.get("text") if isinstance(item, dict) else None
                if text:
                    try:
                        decoded = json.loads(text)
                        if isinstance(decoded, dict):
                            return decoded
                    except json.JSONDecodeError:
                        return {"ok": True, "text": text}

        return result if isinstance(result, dict) else {"ok": True}

    @staticmethod
    def _decode_http_body(response: httpx.Response) -> dict[str, Any]:
        try:
            body = response.json()
            return body if isinstance(body, dict) else {}
        except ValueError:
            lines = [
                line.removeprefix("data: ").strip()
                for line in response.text.splitlines()
                if line.strip().startswith("data:")
            ]
            for line in reversed(lines):
                try:
                    body = json.loads(line)
                    if isinstance(body, dict):
                        return body
                except json.JSONDecodeError:
                    continue
        raise ValueError("MCP response was not valid JSON")

    async def _call_local(
        self,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        graph = self.graph or GraphStore()

        if tool_name == TOOL_NAMES["execute"]:
            columns, rows, elapsed_ms = await graph.tabular(
                str(arguments["query"])
            )
            return {
                "ok": True,
                "columns": columns,
                "rows": rows,
                "result_count": len(rows),
                "elapsed_ms": elapsed_ms,
            }

        if tool_name == TOOL_NAMES["path"]:
            rows = await graph.rows(
                """
                MATCH (start {id: $start_node}), (finish {id: $end_node})
                WITH shortestPath((start)-[*..8]->(finish)) AS fwd,
                     shortestPath((finish)-[*..8]->(start)) AS rev
                RETURN fwd, rev
                """,
                {
                    "start_node": arguments["start_node"],
                    "end_node": arguments["end_node"],
                },
            )
            return {
                "ok": True,
                "start_node": arguments["start_node"],
                "end_node": arguments["end_node"],
                "path": rows[0] if rows else None,
            }

        if tool_name == TOOL_NAMES["read_memory"]:
            rows = await graph.rows(
                """
                MATCH (memory:SessionMemory {session_id: $session_id})
                RETURN memory
                ORDER BY memory.timestamp DESC
                """,
                {"session_id": arguments["session_id"]},
            )
            return {
                "ok": True,
                "session_id": arguments["session_id"],
                "history": rows,
            }

        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        rows = await graph.rows(
            """
            MERGE (memory:SessionMemory {session_id: $session_id})
            SET memory.decision = $decision,
                memory.visited_nodes = $visited_nodes,
                memory.timestamp = $timestamp
            RETURN memory
            """,
            {
                "session_id": arguments["session_id"],
                "decision": arguments["decision"],
                "visited_nodes": arguments["visited_nodes"],
                "timestamp": timestamp,
            },
        )
        return {
            "ok": True,
            "written": bool(rows),
            "memory": rows[0] if rows else None,
        }

    def _mock(
        self,
        tool_name: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        incident_id = str(arguments.get("incident_id", "INC-8821"))
        digest = hashlib.sha256(incident_id.encode()).hexdigest()[:8]
        if tool_name == TOOL_NAMES["execute"]:
            return {
                "ok": True,
                "mock": True,
                "columns": [
                    "incident_id",
                    "root_cause",
                    "source_id",
                    "target_id",
                    "source_message",
                    "target_state",
                ],
                "rows": [{
                    "incident_id": incident_id,
                    "root_cause": (
                        "Unauthorized partner token committed in c-9041 "
                        "exhausted payment DB connections"
                    ),
                    "source_id": "c-9041",
                    "target_id": "payment-db-primary",
                    "source_message": "Relax checkout token validation for partner replay",
                    "target_state": "connection_exhausted",
                }],
                "result_count": 1,
                "elapsed_ms": 0.4,
                "trace": digest,
            }

        if tool_name == TOOL_NAMES["path"]:
            start = str(arguments.get("start_node", "c-9041"))
            end = str(arguments.get("end_node", "payment-db-primary"))
            nodes = [
                {
                    "id": start,
                    "labels": ["CodeCommit"],
                    "properties": {
                        "message": "Relax checkout token validation for partner replay",
                    },
                },
                {
                    "id": "svc-payment",
                    "labels": ["Microservice"],
                    "properties": {"name": "payment-service", "status": "degraded"},
                },
                {
                    "id": end,
                    "labels": ["Database"],
                    "properties": {"cluster_state": "connection_exhausted"},
                },
            ]
            return {
                "ok": True,
                "mock": True,
                "start_node": start,
                "end_node": end,
                "path": {
                    "nodes": nodes,
                    "edges": [
                        {
                            "type": "AFFECTS",
                            "start": start,
                            "end": "svc-payment",
                            "properties": {},
                        },
                        {
                            "type": "DEPENDS_ON",
                            "start": "svc-payment",
                            "end": end,
                            "properties": {"pool_size": 120},
                        },
                    ],
                    "hops": 2,
                },
            }

        if tool_name == TOOL_NAMES["read_memory"]:
            session_id = str(arguments.get("session_id", "sess_rca_8821"))
            history = []
            if session_id == "sess_rca_8821":
                history = [{
                    "session_id": session_id,
                    "decision": "Revoke leaked token, rollback c-9041, and drain payment workers",
                    "visited_nodes": [
                        "c-9041",
                        "svc-payment",
                        "payment-db-primary",
                    ],
                    "timestamp": "2026-02-18T03:02:00Z",
                }]
            return {
                "ok": True,
                "mock": True,
                "session_id": session_id,
                "history": history,
            }

        return {
            "ok": True,
            "mock": True,
            "written": False,
            "session_id": arguments.get("session_id", incident_id),
        }


def _path_payload(result: dict[str, Any]) -> dict[str, Any]:
    raw = result.get("path")
    if isinstance(raw, dict) and isinstance(raw.get("nodes"), list):
        return raw
    if isinstance(raw, dict):
        for key in ("fwd", "rev"):
            candidate = raw.get(key)
            if isinstance(candidate, dict) and isinstance(candidate.get("nodes"), list):
                return candidate
    if isinstance(result.get("nodes"), list):
        return {
            "nodes": result["nodes"],
            "edges": result.get("edges", []),
            "hops": result.get("hops"),
        }
    return {"nodes": [], "edges": [], "hops": 0}


def _trace_steps(path: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = path.get("nodes", [])
    edges = path.get("edges", [])
    steps: list[dict[str, Any]] = []
    for index, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        edge = edges[index - 1] if index > 0 and index - 1 < len(edges) else None
        labels = node.get("labels") or []
        steps.append({
            "step": len(steps) + 1,
            "node_id": str(node.get("id", "")),
            "label": str(labels[0] if labels else "Entity"),
            "relation_from_previous": (
                str(edge.get("type")) if isinstance(edge, dict) and edge.get("type") else None
            ),
            "properties": node.get("properties") or {},
        })
    return steps


class IncidentOrchestrator:
    """Run the three agents in the required sequential order."""

    def __init__(self, adapter: FalkorToolAdapter) -> None:
        self.adapter = adapter
        self.tool_log: list[dict[str, str]] = []

    async def _call(
        self,
        agent: str,
        tool: str,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            result = await self.adapter.call(tool, arguments)
            self.tool_log.append({
                "agent": agent,
                "tool": tool,
                "status": "complete",
                "mode": self.adapter.mode_used,
            })
            return result
        except Exception:
            self.tool_log.append({
                "agent": agent,
                "tool": tool,
                "status": "failed",
                "mode": self.adapter.mode_used,
            })
            raise

    async def run(
        self,
        *,
        query: str,
        incident_id: str,
        session_id: str,
    ) -> dict[str, Any]:
        # Memory is intentionally first: its output is available to investigation.
        memory_result = await self._call(
            "Memory Agent",
            TOOL_NAMES["read_memory"],
            {"session_id": session_id, "incident_id": incident_id},
        )

        safe_incident = incident_id.replace("'", "")
        cypher = (
            "MATCH (i:Incident {id: '"
            + safe_incident
            + "'}) "
            "OPTIONAL MATCH (source:CodeCommit)-[*..4]->(i) "
            "OPTIONAL MATCH (source)-[*..4]->(target:Database) "
            "RETURN i.id AS incident_id, "
            "i.root_cause_summary AS root_cause, "
            "source.id AS source_id, target.id AS target_id, "
            "source.message AS source_message, "
            "target.cluster_state AS target_state LIMIT 1"
        )
        evidence = await self._call(
            "Investigator Agent",
            TOOL_NAMES["execute"],
            {"query": cypher, "incident_id": incident_id},
        )
        rows = evidence.get("rows") if isinstance(evidence, dict) else []
        row = rows[0] if rows and isinstance(rows[0], dict) else {}
        source_id = str(row.get("source_id") or "c-9041")
        target_id = str(row.get("target_id") or "payment-db-primary")

        path_result = await self._call(
            "Investigator Agent",
            TOOL_NAMES["path"],
            {
                "start_node": source_id,
                "end_node": target_id,
                "incident_id": incident_id,
            },
        )
        raw_path = _path_payload(path_result)
        trace_path = _trace_steps(raw_path)
        visited_nodes = [step["node_id"] for step in trace_path if step["node_id"]]
        root_cause = str(row.get("root_cause") or "").strip()

        if trace_path and root_cause:
            audit_chain = ""
            for step in trace_path:
                if audit_chain and step["relation_from_previous"]:
                    audit_chain += f" -> {step['relation_from_previous']} -> "
                audit_chain += f"[{step['node_id']}]"
            answer = (
                f"Verified graph evidence traces {audit_chain}. {root_cause}."
            )
        else:
            answer = (
                "No verified connected graph path was returned; no root cause "
                "claim was made."
            )
            root_cause = answer

        # The Explainer Agent is deterministic here: it formats only evidence returned above.
        agents = [
            {
                "name": "Memory Agent",
                "status": "complete",
                "detail": "Prior session context loaded before investigation",
            },
            {
                "name": "Investigator Agent",
                "status": "complete" if trace_path else "needs-evidence",
                "detail": "Cypher evidence and bounded shortest path evaluated",
            },
            {
                "name": "Explainer Agent",
                "status": "complete",
                "detail": "Graph hops converted into an audit trail",
            },
        ]

        write_result = await self._call(
            "Memory Agent",
            TOOL_NAMES["write_memory"],
            {
                "session_id": session_id,
                "decision": answer,
                "visited_nodes": visited_nodes,
                "incident_id": incident_id,
            },
        )
        memory_updated = bool(
            write_result.get("written")
            and not write_result.get("mock")
        )

        history = memory_result.get("history", [])
        return {
            "answer": answer,
            "trace_path": trace_path,
            "visited_nodes": visited_nodes,
            "memory_updated": memory_updated,
            "incident_id": incident_id,
            "session_id": session_id,
            "query": query,
            "mcp_mode": self.adapter.mode_used,
            "root_cause_analysis": root_cause,
            "raw_graph_path": raw_path,
            "previous_memory": history if isinstance(history, list) else [],
            "tool_log": self.tool_log,
            "agents": agents,
        }
    