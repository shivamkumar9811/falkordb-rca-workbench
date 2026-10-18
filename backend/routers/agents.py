from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from agents import FalkorToolAdapter, IncidentOrchestrator
from models.agents import (
    InvestigateRequest,
    InvestigationResponse,
    OrchestrationRequest,
    OrchestrationResponse,
)
from models.graph import GraphSnapshot
from routers.graph import get_full_graph


router = APIRouter()


async def _investigation_graph(
    request: Request,
    result: dict,
) -> GraphSnapshot:
    """Prefer the full live graph and retain useful path data in fallback mode."""
    try:
        snapshot = await get_full_graph(request)
        if snapshot.nodes or snapshot.edges:
            return snapshot
    except Exception:
        pass

    raw_path = result.get("raw_graph_path") or {}
    return GraphSnapshot(
        nodes=raw_path.get("nodes", []),
        edges=raw_path.get("edges", []),
    )


@router.post("/orchestrate", response_model=OrchestrationResponse)
async def orchestrate_incident(
    body: OrchestrationRequest,
    request: Request,
) -> OrchestrationResponse:
    adapter = FalkorToolAdapter(request.app.state.graph)
    orchestrator = IncidentOrchestrator(adapter)

    try:
        result = await orchestrator.run(
            query=body.query,
            incident_id=body.incident_id,
            session_id=body.session_id,
        )
        return OrchestrationResponse.model_validate(result)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="FalkorDB orchestration unavailable",
        ) from exc


@router.post("/investigate", response_model=InvestigationResponse)
async def investigate(
    body: InvestigateRequest,
    request: Request,
) -> InvestigationResponse:
    """Run the existing sequential agents and return a Cytoscape graph snapshot."""
    adapter = FalkorToolAdapter(request.app.state.graph)
    orchestrator = IncidentOrchestrator(adapter)

    try:
        result = await orchestrator.run(
            query=body.prompt,
            incident_id=body.incident_id,
            session_id=body.session_id,
        )
        graph = await _investigation_graph(request, result)
        return InvestigationResponse.model_validate({**result, "graph": graph})
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="FalkorDB investigation unavailable",
        ) from exc
    