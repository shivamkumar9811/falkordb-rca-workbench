from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OrchestrationRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2400)
    incident_id: str = Field(
        default="INC-8821",
        min_length=1,
        max_length=120,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    session_id: str = Field(
        default="sess_rca_8821",
        min_length=1,
        max_length=120,
        pattern=r"^[A-Za-z0-9_-]+$",
    )


class TraceStep(BaseModel):
    step: int
    node_id: str
    label: str
    relation_from_previous: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class ToolLogEntry(BaseModel):
    agent: str
    tool: str
    status: str
    mode: str


class AgentStatus(BaseModel):
    name: str
    status: str
    detail: str


class OrchestrationResponse(BaseModel):
    answer: str
    trace_path: list[TraceStep]
    visited_nodes: list[str]
    memory_updated: bool
    incident_id: str
    session_id: str
    query: str
    mcp_mode: str
    root_cause_analysis: str
    raw_graph_path: dict[str, Any] = Field(default_factory=dict)
    previous_memory: list[dict[str, Any]] = Field(default_factory=list)
    tool_log: list[ToolLogEntry] = Field(default_factory=list)
    agents: list[AgentStatus] = Field(default_factory=list)
    