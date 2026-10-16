export const SEED_PREVIEW = `// FalkorDB RCA seed • graph: it_infrastructure_rca
// Stable IDs make the scenario safe to MERGE repeatedly.

MERGE (dave:Developer {id:'dev-dave'})
SET dave.name='Dave Chen',
    dave.team='Payments Platform'

MERGE (commit:CodeCommit {id:'c-9041'})
SET commit.message='Relax checkout token validation',
    commit.unauthorized_token_leak=true

MERGE (route:APIRoute {id:'route-charge'})
SET route.path='/v1/charges',
    route.method='POST'

MERGE (service:Microservice {id:'svc-payment'})
SET service.name='payment-service',
    service.status='degraded'

MERGE (database:Database {id:'payment-db-primary'})
SET database.name='payment-db-primary',
    database.cluster_state='connection_exhausted'

MERGE (incident:Incident {id:'INC-8821'})
SET incident.severity='SEV-1',
    incident.status='investigating'

MERGE (memory:SessionMemory {
  id:'mem-8821',
  session_id:'sess_rca_8821'
})
SET memory.decision='Revoke leaked token and rollback c-9041'

MERGE (commit)-[:COMMITTED_BY]->(dave)
MERGE (commit)-[:AFFECTS]->(route)
MERGE (route)-[:DEPENDS_ON]->(service)
MERGE (service)-[:DEPENDS_ON]->(database)
MERGE (service)-[:HAS_INCIDENT]->(incident)
MERGE (database)-[:HAS_INCIDENT]->(incident)
MERGE (memory)-[:STORED_MEMORY_FOR]->(incident)`;

export const MCP_PREVIEW = `@mcp.tool()
async def tool_find_shortest_path(
    start_node: str,
    end_node: str,
) -> str:
    """Traverse up to eight hops between stable FalkorDB node IDs."""

    rows = await (await graph()).rows(
        PATH_QUERY,
        {
            "start_node": start_node,
            "end_node": end_node,
        },
    )

    return json.dumps({
        "ok": True,
        "path": rows[0] if rows else None,
    })

@mcp.tool()
async def tool_write_session_memory(
    session_id: str,
    decision: str,
    visited_nodes: list[str],
) -> str:
    """Persist the agent decision and traversal trace."""

    return await write_memory(
        session_id,
        decision,
        visited_nodes,
    )`;
    