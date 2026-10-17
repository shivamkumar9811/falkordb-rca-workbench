from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from agents import FalkorToolAdapter, IncidentOrchestrator
from models.agents import OrchestrationRequest, OrchestrationResponse


router = APIRouter()


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

