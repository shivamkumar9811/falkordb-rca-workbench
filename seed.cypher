// FalkorDB graph seed for IT Infrastructure & Codebase Root Cause Analysis.
// Safe to run repeatedly: MERGE keys the scenario by stable application IDs.

MERGE (dave:Developer {id:'dev-dave'})
SET dave.name='Dave Chen',
    dave.email='dave.chen@example.com',
    dave.team='Payments Platform',
    dave.role='Senior Backend Engineer'

MERGE (maya:Developer {id:'dev-maya'})
SET maya.name='Maya Singh',
    maya.email='maya.singh@example.com',
    maya.team='SRE',
    maya.role='Incident Commander'

MERGE (commit:CodeCommit {id:'c-9041'})
SET commit.sha='c-9041',
    commit.message='Relax checkout token validation for partner replay',
    commit.timestamp='2026-02-18T02:14:00Z',
    commit.unauthorized_token_leak=true,
    commit.risk='critical'

MERGE (safeCommit:CodeCommit {id:'c-9038'})
SET safeCommit.sha='c-9038',
    safeCommit.message='Add payment gateway timeout telemetry',
    safeCommit.timestamp='2026-02-17T18:22:00Z',
    safeCommit.unauthorized_token_leak=false,
    safeCommit.risk='low'

MERGE (payments:Microservice {id:'svc-payment'})
SET payments.name='payment-service',
    payments.runtime='Python 3.12',
    payments.replicas=6,
    payments.status='degraded'

MERGE (checkout:Microservice {id:'svc-checkout'})
SET checkout.name='checkout-api',
    checkout.runtime='Node 22',
    checkout.replicas=8,
    checkout.status='healthy'

MERGE (paymentDb:Database {id:'payment-db-primary'})
SET paymentDb.name='payment-db-primary',
    paymentDb.engine='PostgreSQL 16',
    paymentDb.cluster_state='connection_exhausted',
    paymentDb.port=5432

MERGE (ledgerDb:Database {id:'ledger-db-replica'})
SET ledgerDb.name='ledger-db-replica',
    ledgerDb.engine='PostgreSQL 16',
    ledgerDb.cluster_state='healthy',
    ledgerDb.port=5432

MERGE (charge:APIRoute {id:'route-charge'})
SET charge.path='/v1/charges',
    charge.method='POST',
    charge.rate_limit='1200/min',
    charge.auth_required=true

MERGE (checkoutRoute:APIRoute {id:'route-checkout'})
SET checkoutRoute.path='/v1/checkout',
    checkoutRoute.method='POST',
    checkoutRoute.rate_limit='800/min',
    checkoutRoute.auth_required=true

MERGE (incident:Incident {id:'INC-8821'})
SET incident.ticket_id='INC-8821',
    incident.severity='SEV-1',
    incident.status='investigating',
    incident.started_at='2026-02-18T02:31:00Z',
    incident.root_cause_summary='Unauthorized partner token committed in c-9041 exhausted payment DB connections'

MERGE (memory:SessionMemory {id:'mem-8821', session_id:'sess_rca_8821'})
SET memory.decision='Revoke leaked token, rollback c-9041, and drain payment workers',
    memory.visited_nodes=[
      'c-9041',
      'route-charge',
      'svc-payment',
      'payment-db-primary'
    ],
    memory.timestamp='2026-02-18T03:02:00Z'

MERGE (commit)-[:COMMITTED_BY]->(dave)
MERGE (safeCommit)-[:COMMITTED_BY]->(maya)

MERGE (commit)-[:AFFECTS {
  reason:'bypassed token scope validation'
}]->(charge)

MERGE (charge)-[:DEPENDS_ON {
  criticality:'tier-0'
}]->(payments)

MERGE (checkoutRoute)-[:DEPENDS_ON {
  criticality:'tier-0'
}]->(checkout)

MERGE (payments)-[:DEPENDS_ON {
  pool_size:120
}]->(paymentDb)

MERGE (payments)-[:DEPENDS_ON {
  pool_size:40
}]->(ledgerDb)

MERGE (checkout)-[:DEPENDS_ON {
  criticality:'tier-1'
}]->(payments)

MERGE (payments)-[:HAS_INCIDENT {
  impact:'connection exhaustion'
}]->(incident)

MERGE (paymentDb)-[:HAS_INCIDENT {
  impact:'deadlocks and 504s'
}]->(incident)

MERGE (commit)-[:AFFECTS {
  reason:'introduced unauthorized token'
}]->(payments)

MERGE (memory)-[:STORED_MEMORY_FOR]->(incident)
