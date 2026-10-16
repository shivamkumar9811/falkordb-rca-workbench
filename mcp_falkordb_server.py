"""Standalone MCP server exposing RCA tools backed exclusively by FalkorDB."""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from lib.falkor import GraphStore


mcp = FastMCP("falkordb-rca")

_graph: GraphStore | None = None
_graph_lock = asyncio.Lock()


async def graph() -> GraphStore:
    global _graph

    async with _graph_lock:
        if _graph is None:
            _graph = GraphStore()
            await _graph.ping()

    return _graph


def payload(data: Any) -> str:
    return json.dumps(data, indent=2, default=str)


@mcp.tool()
async def tool_execute_cypher(query: str) -> str:
    """Execute a raw Cypher query against the configured FalkorDB graph."""

    if not query.strip():
        return payload({
            "ok": False,
            "error": "query must not be empty",
        })

    try:
        columns, rows, elapsed_ms = await (await graph()).tabular(query)

        return payload({
            "ok": True,
            "columns": columns,
            "rows": rows,
            "result_count": len(rows),
            "elapsed_ms": elapsed_ms,
        })

    except Exception as exc:
        return payload({
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        })


@mcp.tool()
async def tool_find_shortest_path(
    start_node: str,
    end_node: str,
) -> str:
    """Find the bounded multi-hop path between two stable node IDs."""

    query = """
    MATCH (start {id: $start_node}), (finish {id: $end_node})
    WITH shortestPath((start)-[*..8]->(finish)) AS fwd,
         shortestPath((finish)-[*..8]->(start)) AS rev
    RETURN fwd, rev
    """

    try:
        rows = await (await graph()).rows(
            query,
            {
                "start_node": start_node,
                "end_node": end_node,
            },
        )

        return payload({
            "ok": True,
            "start_node": start_node,
            "end_node": end_node,
            "path": rows[0] if rows else None,
        })

    except Exception as exc:
        return payload({
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        })


@mcp.tool()
async def tool_write_session_memory(
    session_id: str,
    decision: str,
    visited_nodes: list[str],
) -> str:
    """Persist an RCA decision and visited-node trace as SessionMemory."""

    query = """
    MERGE (memory:SessionMemory {
        session_id: $session_id
    })
    SET memory.decision = $decision,
        memory.visited_nodes = $visited_nodes,
        memory.timestamp = $timestamp
    RETURN memory
    """

    try:
        rows = await (await graph()).rows(
            query,
            {
                "session_id": session_id,
                "decision": decision,
                "visited_nodes": visited_nodes,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        return payload({
            "ok": True,
            "memory": rows[0] if rows else None,
        })

    except Exception as exc:
        return payload({
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        })


@mcp.tool()
async def tool_read_session_memory(session_id: str) -> str:
    """Read the stored RCA trace for a session ID."""

    query = """
    MATCH (memory:SessionMemory {
        session_id: $session_id
    })
    RETURN memory
    ORDER BY memory.timestamp DESC
    """

    try:
        rows = await (await graph()).rows(
            query,
            {
                "session_id": session_id,
            },
        )

        return payload({
            "ok": True,
            "session_id": session_id,
            "history": rows,
        })

    except Exception as exc:
        return payload({
            "ok": False,
            "error": f"{type(exc).__name__}: {exc}",
        })


if __name__ == "__main__":
    mcp.run()
    