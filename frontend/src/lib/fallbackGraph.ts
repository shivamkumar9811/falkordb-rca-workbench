import type { GraphSnapshot } from "@/lib/types";

/**
 * Mirrors /app/seed.cypher exactly. Used only when /api/graph is
 * unreachable (FalkorDB offline) so the canvas still renders the same
 * topology the deterministic mock adapter reasons over.
 */
export const FALLBACK_GRAPH: GraphSnapshot = {
  nodes: [
    {
      id: "dev-dave",
      labels: ["Developer"],
      properties: {
        name: "Dave Chen",
        team: "Payments Platform",
        role: "Senior Backend Engineer",
      },
    },
    {
      id: "dev-maya",
      labels: ["Developer"],
      properties: {
        name: "Maya Singh",
        team: "SRE",
        role: "Incident Commander",
      },
    },
    {
      id: "c-9041",
      labels: ["CodeCommit"],
      properties: {
        sha: "c-9041",
        message: "Relax checkout token validation for partner replay",
        unauthorized_token_leak: true,
        risk: "critical",
      },
    },
    {
      id: "c-9038",
      labels: ["CodeCommit"],
      properties: {
        sha: "c-9038",
        message: "Add payment gateway timeout telemetry",
        unauthorized_token_leak: false,
        risk: "low",
      },
    },
    {
      id: "svc-payment",
      labels: ["Microservice"],
      properties: {
        name: "payment-service",
        runtime: "Python 3.12",
        replicas: 6,
        status: "degraded",
      },
    },
    {
      id: "svc-checkout",
      labels: ["Microservice"],
      properties: {
        name: "checkout-api",
        runtime: "Node 22",
        replicas: 8,
        status: "healthy",
      },
    },
    {
      id: "payment-db-primary",
      labels: ["Database"],
      properties: {
        name: "payment-db-primary",
        engine: "PostgreSQL 16",
        cluster_state: "connection_exhausted",
        port: 5432,
      },
    },
    {
      id: "ledger-db-replica",
      labels: ["Database"],
      properties: {
        name: "ledger-db-replica",
        engine: "PostgreSQL 16",
        cluster_state: "healthy",
        port: 5432,
      },
    },
    {
      id: "route-charge",
      labels: ["APIRoute"],
      properties: {
        path: "/v1/charges",
        method: "POST",
        rate_limit: "1200/min",
        auth_required: true,
      },
    },
    {
      id: "route-checkout",
      labels: ["APIRoute"],
      properties: {
        path: "/v1/checkout",
        method: "POST",
        rate_limit: "800/min",
        auth_required: true,
      },
    },
    {
      id: "INC-8821",
      labels: ["Incident"],
      properties: {
        ticket_id: "INC-8821",
        severity: "SEV-1",
        status: "investigating",
        root_cause_summary:
          "Unauthorized partner token committed in c-9041 exhausted payment DB connections",
      },
    },
    {
      id: "mem-8821",
      labels: ["SessionMemory"],
      properties: {
        session_id: "sess_rca_8821",
        decision:
          "Revoke leaked token, rollback c-9041, and drain payment workers",
        timestamp: "2026-02-18T03:02:00Z",
      },
    },
  ],
  edges: [
    {
      type: "COMMITTED_BY",
      start: "c-9041",
      end: "dev-dave",
      properties: {},
    },
    {
      type: "COMMITTED_BY",
      start: "c-9038",
      end: "dev-maya",
      properties: {},
    },
    {
      type: "AFFECTS",
      start: "c-9041",
      end: "route-charge",
      properties: { reason: "bypassed token scope validation" },
    },
    {
      type: "AFFECTS",
      start: "c-9041",
      end: "svc-payment",
      properties: { reason: "introduced unauthorized token" },
    },
    {
      type: "DEPENDS_ON",
      start: "route-charge",
      end: "svc-payment",
      properties: { criticality: "tier-0" },
    },
    {
      type: "DEPENDS_ON",
      start: "route-checkout",
      end: "svc-checkout",
      properties: { criticality: "tier-0" },
    },
    {
      type: "DEPENDS_ON",
      start: "svc-payment",
      end: "payment-db-primary",
      properties: { pool_size: 120 },
    },
    {
      type: "DEPENDS_ON",
      start: "svc-payment",
      end: "ledger-db-replica",
      properties: { pool_size: 40 },
    },
    {
      type: "DEPENDS_ON",
      start: "svc-checkout",
      end: "svc-payment",
      properties: { criticality: "tier-1" },
    },
    {
      type: "HAS_INCIDENT",
      start: "svc-payment",
      end: "INC-8821",
      properties: { impact: "connection exhaustion" },
    },
    {
      type: "HAS_INCIDENT",
      start: "payment-db-primary",
      end: "INC-8821",
      properties: { impact: "deadlocks and 504s" },
    },
    {
      type: "STORED_MEMORY_FOR",
      start: "mem-8821",
      end: "INC-8821",
      properties: {},
    },
  ],
};

export const LABEL_COLORS: Record<string, string> = {
  Developer: "#38BDF8",
  CodeCommit: "#EF4444",
  Microservice: "#00E5FF",
  Database: "#F59E0B",
  APIRoute: "#10B981",
  Incident: "#EF4444",
  SessionMemory: "#818CF8",
};

export const NODE_FALLBACK_COLOR = "#94A3B8";

export function colorForLabels(labels: string[]): string {
  const label = labels[0] ?? "";
  return LABEL_COLORS[label] ?? NODE_FALLBACK_COLOR;
}
