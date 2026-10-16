from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        return [value]

    return [str(item) for item in value if item is not None]


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value

    return {}


class GraphNode(BaseModel):
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str
    labels: list[str] = Field(default_factory=list)
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, value: Any) -> str:
        return "" if value is None else str(value)

    @field_validator("labels", mode="before")
    @classmethod
    def coerce_labels(cls, value: Any) -> list[str]:
        return _as_str_list(value)

    @field_validator("properties", mode="before")
    @classmethod
    def coerce_properties(cls, value: Any) -> dict[str, Any]:
        return _as_dict(value)


class GraphEdge(BaseModel):
    type: str
    start: str
    end: str
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("type", "start", "end", mode="before")
    @classmethod
    def coerce_str(cls, value: Any) -> str:
        return "" if value is None else str(value)

    @field_validator("properties", mode="before")
    @classmethod
    def coerce_properties(cls, value: Any) -> dict[str, Any]:
        return _as_dict(value)


class GraphSnapshot(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class FalkorStatus(BaseModel):
    connected: bool
    graph_name: str
    host: str
    port: int
    latency_ms: float | None = None
    node_count: int = 0
    edge_count: int = 0
    labels: dict[str, int] = Field(default_factory=dict)
    error: str | None = None


class SeedResult(BaseModel):
    seeded: bool
    graph_name: str
    node_count: int = 0
    edge_count: int = 0


class CypherRequest(BaseModel):
    query: str = Field(min_length=1, max_length=20000)


class CypherResult(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    result_count: int
    elapsed_ms: float


class PathRequest(BaseModel):
    start_node: str = Field(min_length=1, max_length=200)
    end_node: str = Field(min_length=1, max_length=200)


class PathResult(BaseModel):
    start_node: str
    end_node: str
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    hops: int | None = None
    found: bool


class SessionMemoryWrite(BaseModel):
    session_id: str = Field(min_length=1, max_length=200)
    decision: str = Field(min_length=1, max_length=5000)
    visited_nodes: list[str] = Field(
        default_factory=list,
        max_length=100,
    )


class SessionMemory(BaseModel):
    session_id: str
    decision: str
    visited_nodes: list[str]
    timestamp: str
    incident_id: str | None = None

    @field_validator("visited_nodes", mode="before")
    @classmethod
    def coerce_visited(cls, value: Any) -> list[str]:
        return _as_str_list(value)


class MemoryWriteResult(BaseModel):
    saved: bool
    memory: SessionMemory


class IncidentRecord(BaseModel):
    id: str
    properties: dict[str, Any] = Field(default_factory=dict)

    @field_validator("properties", mode="before")
    @classmethod
    def coerce_properties(cls, value: Any) -> dict[str, Any]:
        return _as_dict(value)
