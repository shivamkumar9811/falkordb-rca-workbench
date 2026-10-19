from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from lib.falkor import (
    GraphStore,
    GraphStoreError,
    serialize_edge,
    serialize_node,
    serialize_path,
)
from models.graph import (
    CypherRequest,
    CypherResult,
    FalkorStatus,
    GraphEdge,
    GraphNode,
    GraphSnapshot,
    IncidentRecord,
    MemoryWriteResult,
    PathRequest,
    PathResult,
    SeedResult,
    SessionMemory,
    SessionMemoryWrite,
)


router = APIRouter()
logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).resolve().parents[2]
INCIDENT_ID = "INC-8821"


def store(request: Request) -> GraphStore:
    return request.app.state.graph


def http_error(exc: Exception, *, not_found: bool = False) -> HTTPException:
    logger.exception("FalkorDB request failed: %s", exc)
    missing = not_found or (
        isinstance(exc, GraphStoreError) and exc.not_found
    )
    status = 404 if missing else 400
    return HTTPException(
        status_code=status,
        detail=f"{type(exc).__name__}: {exc}",
    )


def as_node(row: dict) -> GraphNode:
    payload = row.get("n", row)
    return GraphNode.model_validate(serialize_node(payload))


def as_edge(row: dict) -> GraphEdge:
    if "a" in row and "b" in row:
        start = serialize_node(row["a"])["id"]
        end = serialize_node(row["b"])["id"]
        edge = row.get("r", {})
        relation = (
            edge.get("type")
            if isinstance(edge, dict)
            else getattr(edge, "relation", "")
        )
        properties = (
            edge.get("properties")
            if isinstance(edge, dict)
            else getattr(edge, "properties", {})
        )

        return GraphEdge(
            type=str(relation or ""),
            start=start,
            end=end,
            properties=properties or {},
        )

    return GraphEdge.model_validate(serialize_edge(row.get("r", row)))


async def graph_counts(
    graph: GraphStore,
) -> tuple[int, int, dict[str, int]]:
    node_rows = await graph.rows(
        "MATCH (n) RETURN count(n) AS count"
    )
    edge_rows = await graph.rows(
        "MATCH ()-[r]->() RETURN count(r) AS count"
    )
    label_rows = await graph.rows(
        "MATCH (n) "
        "UNWIND labels(n) AS label "
        "RETURN label, count(*) AS count"
    )

    node_count = (
        int(node_rows[0].get("count", 0))
        if node_rows
        else 0
    )
    edge_count = (
        int(edge_rows[0].get("count", 0))
        if edge_rows
        else 0
    )
    labels = {
        str(row["label"]): int(row["count"])
        for row in label_rows
        if row.get("label")
    }

    return node_count, edge_count, labels


@router.get("/status", response_model=FalkorStatus)
async def get_status(request: Request) -> FalkorStatus:
    graph = store(request)

    try:
        latency = await graph.ping()
        node_count, edge_count, labels = await graph_counts(graph)

        return FalkorStatus(
            connected=True,
            graph_name=graph.graph_name,
            host=graph.host,
            port=graph.port,
            latency_ms=latency,
            node_count=node_count,
            edge_count=edge_count,
            labels=labels,
        )

    except Exception as exc:
        logger.warning("FalkorDB status check failed: %s", exc)
        return FalkorStatus(
            connected=False,
            graph_name=graph.graph_name,
            host=graph.host,
            port=graph.port,
            error=f"{type(exc).__name__}: {exc}",
        )


@router.post("/seed", response_model=SeedResult)
async def seed_graph(request: Request) -> SeedResult:
    graph = store(request)
    seed_path = ROOT_DIR / "seed.cypher"

    if not seed_path.exists():
        raise HTTPException(
            status_code=400,
            detail="seed.cypher is missing",
        )

    try:
        statements = [
            statement.strip()
            for statement in re.split(
                r";\s*(?:\n|$)",
                seed_path.read_text(encoding="utf-8"),
            )
            if statement.strip()
            and not statement.strip().startswith("//")
        ]

        for statement in statements:
            await graph.query(statement)

        nodes, edges, _ = await graph_counts(graph)

        return SeedResult(
            seeded=True,
            graph_name=graph.graph_name,
            node_count=nodes,
            edge_count=edges,
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise http_error(exc) from exc


@router.get("/graph", response_model=GraphSnapshot)
async def get_graph(request: Request) -> GraphSnapshot:
    try:
        node_rows = await store(request).rows(
            "MATCH (n) RETURN n LIMIT 120"
        )
        edge_rows = await store(request).rows(
            "MATCH (a)-[r]->(b) "
            "RETURN a, r, b "
            "LIMIT 240"
        )

        return GraphSnapshot(
            nodes=[as_node(row) for row in node_rows],
            edges=[as_edge(row) for row in edge_rows],
        )

    except Exception as exc:
        raise http_error(exc) from exc


@router.get("/graph/full", response_model=GraphSnapshot)
async def get_full_graph(request: Request) -> GraphSnapshot:
    """Return the complete current graph for the initial Cytoscape render."""
    try:
        node_rows = await store(request).rows("MATCH (n) RETURN n")
        edge_rows = await store(request).rows(
            "MATCH (a)-[r]->(b) RETURN a, r, b"
        )

        return GraphSnapshot(
            nodes=[as_node(row) for row in node_rows],
            edges=[as_edge(row) for row in edge_rows],
        )

    except Exception as exc:
        logger.warning(
            "FalkorDB full graph unavailable; returning an empty snapshot: %s",
            exc,
        )
        return GraphSnapshot(nodes=[], edges=[])


@router.get(
    "/incidents",
    response_model=list[IncidentRecord],
)
async def get_incidents(
    request: Request,
) -> list[IncidentRecord]:
    try:
        rows = await store(request).rows(
            "MATCH (i:Incident) "
            "RETURN i "
            "ORDER BY i.started_at DESC"
        )

        incidents: list[IncidentRecord] = []

        for row in rows:
            node = serialize_node(row.get("i", row))

            if not node["id"]:
                continue

            incidents.append(
                IncidentRecord(
                    id=node["id"],
                    properties=node["properties"],
                )
            )

        return incidents

    except Exception as exc:
        raise http_error(exc) from exc


@router.post(
    "/execute-cypher",
    response_model=CypherResult,
)
async def execute_cypher(
    body: CypherRequest,
    request: Request,
) -> CypherResult:
    try:
        columns, rows, elapsed = await store(request).tabular(
            body.query
        )

        return CypherResult(
            columns=columns,
            rows=rows,
            result_count=len(rows),
            elapsed_ms=elapsed,
        )

    except Exception as exc:
        raise http_error(exc) from exc


@router.post(
    "/shortest-path",
    response_model=PathResult,
)
async def shortest_path(
    body: PathRequest,
    request: Request,
) -> PathResult:
    graph = store(request)

    # FalkorDB only allows shortestPath() in WITH/RETURN, and only
    # directed variable-length patterns.
    query = """
    MATCH (start {id: $start_node}), (finish {id: $end_node})
    WITH start, finish,
         shortestPath((start)-[*..8]->(finish)) AS fwd,
         shortestPath((finish)-[*..8]->(start)) AS rev
    RETURN start, finish, fwd, rev
    """

    try:
        existing = await graph.rows(
            "MATCH (n) "
            "WHERE n.id = $start_node OR n.id = $end_node "
            "RETURN n.id AS id",
            {
                "start_node": body.start_node,
                "end_node": body.end_node,
            },
        )
        found_ids = {str(row.get("id")) for row in existing}
        missing = [
            node_id
            for node_id in (body.start_node, body.end_node)
            if node_id not in found_ids
        ]

        if missing:
            raise GraphStoreError(
                "Node(s) not found: " + ", ".join(missing),
                not_found=True,
            )

        rows = await graph.rows(
            query,
            {
                "start_node": body.start_node,
                "end_node": body.end_node,
            },
        )

        if not rows:
            return PathResult(
                start_node=body.start_node,
                end_node=body.end_node,
                found=False,
            )

        row = rows[0]
        path = row.get("fwd") or row.get("rev")

        if not path:
            return PathResult(
                start_node=body.start_node,
                end_node=body.end_node,
                found=False,
            )

        serialized = (
            path
            if isinstance(path, dict) and "nodes" in path
            else serialize_path(path)
        )
        nodes = [
            GraphNode.model_validate(node)
            for node in serialized.get("nodes", [])
        ]
        edges = [
            GraphEdge.model_validate(edge)
            for edge in serialized.get("edges", [])
        ]

        if row.get("fwd") is None and nodes:
            nodes = list(reversed(nodes))
            edges = [
                GraphEdge(
                    type=edge.type,
                    start=edge.end,
                    end=edge.start,
                    properties=edge.properties,
                )
                for edge in reversed(edges)
            ]

        return PathResult(
            start_node=body.start_node,
            end_node=body.end_node,
            nodes=nodes,
            edges=edges,
            hops=len(edges),
            found=True,
        )

    except HTTPException:
        raise

    except Exception as exc:
        raise http_error(exc) from exc


@router.post(
    "/session-memory",
    response_model=MemoryWriteResult,
)
async def write_session_memory(
    body: SessionMemoryWrite,
    request: Request,
) -> MemoryWriteResult:
    graph = store(request)
    timestamp = datetime.now(timezone.utc).isoformat()
    params = {
        **body.model_dump(),
        "timestamp": timestamp,
        "incident_id": INCIDENT_ID,
    }

    write_query = """
    MERGE (memory:SessionMemory {session_id: $session_id})
    SET memory.decision = $decision,
        memory.visited_nodes = $visited_nodes,
        memory.timestamp = $timestamp
    RETURN memory
    """
    link_query = """
    MATCH (memory:SessionMemory {session_id: $session_id})
    MATCH (incident:Incident {id: $incident_id})
    MERGE (memory)-[:STORED_MEMORY_FOR]->(incident)
    RETURN memory.session_id AS session_id
    """

    try:
        rows = await graph.rows(write_query, params)

        if not rows:
            raise GraphStoreError("memory write returned no row")

        try:
            await graph.query(link_query, params)
        except Exception as exc:
            logger.warning(
                "Could not link session memory to %s: %s",
                INCIDENT_ID,
                exc,
            )

        node = serialize_node(rows[0].get("memory", rows[0]))
        properties = node["properties"]
        visited = properties.get("visited_nodes") or body.visited_nodes

        memory = SessionMemory(
            session_id=str(
                properties.get("session_id") or body.session_id
            ),
            decision=str(properties.get("decision") or body.decision),
            visited_nodes=[str(item) for item in visited],
            timestamp=str(properties.get("timestamp") or timestamp),
            incident_id=INCIDENT_ID,
        )

        return MemoryWriteResult(saved=True, memory=memory)

    except HTTPException:
        raise

    except Exception as exc:
        raise http_error(exc) from exc


@router.get(
    "/session-memory/{session_id}",
    response_model=list[SessionMemory],
)
async def read_session_memory(
    session_id: str,
    request: Request,
) -> list[SessionMemory]:
    query = """
    MATCH (memory:SessionMemory {session_id: $session_id})
    RETURN memory
    ORDER BY memory.timestamp DESC
    """

    try:
        rows = await store(request).rows(
            query,
            {"session_id": session_id},
        )

        memories: list[SessionMemory] = []

        for row in rows:
            node = serialize_node(row.get("memory", row))
            properties = node["properties"]
            visited = properties.get("visited_nodes") or []

            memories.append(
                SessionMemory(
                    session_id=str(
                        properties.get("session_id") or session_id
                    ),
                    decision=str(properties.get("decision") or ""),
                    visited_nodes=[str(item) for item in visited],
                    timestamp=str(properties.get("timestamp") or ""),
                    incident_id=INCIDENT_ID,
                )
            )

        return memories

    except Exception as exc:
        raise http_error(exc) from exc
    