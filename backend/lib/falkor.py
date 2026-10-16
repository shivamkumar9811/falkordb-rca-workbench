"""Async-friendly FalkorDB access shared by the API and MCP server."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Mapping
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from falkordb import FalkorDB
from falkordb.edge import Edge
from falkordb.node import Node
from falkordb.path import Path


load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)

DEFAULT_GRAPH_NAME = "it_infrastructure_rca"
DEFAULT_HOST = "localhost"
DEFAULT_PORT = 6379


class GraphStoreError(Exception):
    """Raised when a FalkorDB command cannot be completed."""

    def __init__(
        self,
        message: str,
        *,
        not_found: bool = False,
    ) -> None:
        super().__init__(message)
        self.not_found = not_found


def _headers(result: Any) -> list[str]:
    headers = getattr(result, "header", None) or []
    names: list[str] = []

    for item in headers:
        if isinstance(item, (list, tuple)) and item:
            names.append(str(item[-1]))
        else:
            names.append(str(item))

    return names


def _app_id(node: Any) -> str:
    if node is None:
        return ""

    if isinstance(node, Mapping):
        value = node.get("id", "")
        return "" if value is None else str(value)

    properties = getattr(node, "properties", None) or {}

    if isinstance(properties, Mapping) and properties.get("id") is not None:
        return str(properties["id"])

    node_id = getattr(node, "id", None)
    return "" if node_id is None else str(node_id)


def _labels(node: Any) -> list[str]:
    labels = getattr(node, "labels", None)

    if labels is None and isinstance(node, Mapping):
        labels = node.get("labels")

    if labels is None:
        return []

    if isinstance(labels, str):
        return [labels]

    return [str(label) for label in labels if label]


def _properties(value: Any) -> dict[str, Any]:
    raw = getattr(value, "properties", None)

    if raw is None and isinstance(value, Mapping):
        raw = value.get("properties", value)

    if not isinstance(raw, Mapping):
        return {}

    return {
        str(key): _jsonable(item)
        for key, item in raw.items()
    }


def serialize_node(node: Any) -> dict[str, Any]:
    if isinstance(node, Mapping) and "properties" in node:
        return {
            "id": str(node.get("id") or ""),
            "labels": _labels(node),
            "properties": _properties(node),
        }

    return {
        "id": _app_id(node),
        "labels": _labels(node),
        "properties": _properties(node),
    }


def serialize_edge(
    edge: Any,
    start: Any | None = None,
    end: Any | None = None,
) -> dict[str, Any]:
    if isinstance(edge, Mapping) and {"type", "start", "end"} <= set(edge):
        return {
            "type": str(edge.get("type") or ""),
            "start": str(edge.get("start") or ""),
            "end": str(edge.get("end") or ""),
            "properties": _properties(edge) if "properties" in edge else {},
        }

    start_id = _app_id(start) if start is not None else ""
    end_id = _app_id(end) if end is not None else ""

    if not start_id:
        src = getattr(edge, "src_node", None)
        start_id = _app_id(src) if not isinstance(src, int) else str(src)

    if not end_id:
        dest = getattr(edge, "dest_node", None)
        end_id = _app_id(dest) if not isinstance(dest, int) else str(dest)

    relation = getattr(edge, "relation", None) or getattr(edge, "type", "")

    return {
        "type": str(relation or ""),
        "start": start_id,
        "end": end_id,
        "properties": _properties(edge),
    }


def serialize_path(path: Path) -> dict[str, Any]:
    nodes = list(path.nodes() or [])
    edges = list(path.edges() or [])
    serialized_nodes = [serialize_node(node) for node in nodes]
    serialized_edges = [
        serialize_edge(
            edge,
            nodes[index] if index < len(nodes) else None,
            nodes[index + 1] if index + 1 < len(nodes) else None,
        )
        for index, edge in enumerate(edges)
    ]

    return {
        "nodes": serialized_nodes,
        "edges": serialized_edges,
        "hops": len(serialized_edges),
    }


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, Path):
        return serialize_path(value)

    if isinstance(value, Node):
        return serialize_node(value)

    if isinstance(value, Edge):
        return serialize_edge(value)

    if isinstance(value, Mapping):
        return {
            str(key): _jsonable(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [_jsonable(item) for item in value]

    if hasattr(value, "properties") and hasattr(value, "labels"):
        return serialize_node(value)

    if hasattr(value, "properties") and hasattr(value, "relation"):
        return serialize_edge(value)

    return str(value)


class GraphStore:
    """FalkorDB adapter that moves sync SDK work off the event loop."""

    def __init__(self) -> None:
        self.host = os.environ.get("FALKOR_HOST") or DEFAULT_HOST
        self.port = int(os.environ.get("FALKOR_PORT") or DEFAULT_PORT)
        self.password = os.environ.get("FALKOR_PASSWORD") or None
        self.graph_name = (
            os.environ.get("FALKOR_GRAPH") or DEFAULT_GRAPH_NAME
        )

        self.client: FalkorDB | None = None
        self.graph: Any | None = None

    def _resolve_graph_name(self, client: FalkorDB) -> str:
        configured = (
            os.environ.get("FALKOR_GRAPH") or DEFAULT_GRAPH_NAME
        )

        try:
            available = list(client.list_graphs() or [])
        except Exception as exc:
            logger.warning("Could not list FalkorDB graphs: %s", exc)
            return configured

        if configured in available:
            return configured

        if DEFAULT_GRAPH_NAME in available:
            return DEFAULT_GRAPH_NAME

        if "rca_graph" in available:
            logger.warning(
                "Graph %s was not found; using existing graph rca_graph",
                configured,
            )
            return "rca_graph"

        return configured

    def _connect(self) -> FalkorDB:
        if self.client is None:
            self.client = FalkorDB(
                host=self.host,
                port=self.port,
                password=self.password,
            )
            self.graph_name = self._resolve_graph_name(self.client)
            self.graph = self.client.select_graph(self.graph_name)
            logger.info(
                "Connected to FalkorDB graph %s at %s:%s",
                self.graph_name,
                self.host,
                self.port,
            )

        return self.client

    def graph_or_connect(self) -> Any:
        self._connect()
        return self.graph

    def _query_sync(
        self,
        cypher: str,
        params: dict[str, Any] | None,
    ) -> Any:
        graph = self.graph_or_connect()

        try:
            if params:
                return graph.query(cypher, params)

            return graph.query(cypher)

        except Exception as exc:
            logger.exception(
                "FalkorDB query failed (%s): %s\nCypher: %s\nParams: %s",
                type(exc).__name__,
                exc,
                cypher,
                params,
            )
            raise GraphStoreError(
                f"{type(exc).__name__}: {exc}",
            ) from exc

    async def ping(self) -> float:
        started = time.perf_counter()

        def _ping() -> None:
            client = self._connect()
            client.connection.ping()

        await asyncio.to_thread(_ping)

        return round(
            (time.perf_counter() - started) * 1000,
            1,
        )

    async def close(self) -> None:
        close = (
            getattr(self.client, "close", None)
            if self.client
            else None
        )

        if close:
            await asyncio.to_thread(close)

        self.client = None
        self.graph = None

    async def query(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> Any:
        return await asyncio.to_thread(
            self._query_sync,
            cypher,
            params,
        )

    async def rows(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        result = await self.query(cypher, params)
        names = _headers(result)

        return [
            {
                name: _jsonable(row[index])
                if index < len(row)
                else None
                for index, name in enumerate(names)
            }
            for row in (getattr(result, "result_set", []) or [])
        ]

    async def tabular(
        self,
        cypher: str,
        params: dict[str, Any] | None = None,
    ) -> tuple[list[str], list[dict[str, Any]], float]:
        started = time.perf_counter()
        result = await self.query(cypher, params)
        names = _headers(result)

        rows = [
            {
                name: _jsonable(row[index])
                if index < len(row)
                else None
                for index, name in enumerate(names)
            }
            for row in (getattr(result, "result_set", []) or [])
        ]

        elapsed_ms = round(
            (time.perf_counter() - started) * 1000,
            1,
        )

        return names, rows, elapsed_ms
