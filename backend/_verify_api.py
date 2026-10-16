import asyncio
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from lib.falkor import GraphStore  # noqa: E402
from server import app  # noqa: E402


async def probe_store() -> None:
    store = GraphStore()
    latency = await store.ping()
    print("ping", latency, "graph", store.graph_name, f"{store.host}:{store.port}")
    snapshot_nodes = await store.rows("MATCH (n) RETURN n LIMIT 3")
    print("sample nodes", snapshot_nodes)
    await store.close()


def probe_http() -> None:
    with TestClient(app) as client:
        status = client.get("/api/status")
        print("GET /api/status", status.status_code, status.json())

        graph = client.get("/api/graph")
        payload = graph.json()
        print(
            "GET /api/graph",
            graph.status_code,
            "nodes",
            len(payload.get("nodes", [])),
            "edges",
            len(payload.get("edges", [])),
            "sample",
            payload.get("nodes", [])[:1],
            payload.get("edges", [])[:1],
        )

        path = client.post(
            "/api/shortest-path",
            json={
                "start_node": "c-9041",
                "end_node": "payment-db-primary",
            },
        )
        print("POST /api/shortest-path", path.status_code, path.json())

        missing = client.post(
            "/api/shortest-path",
            json={
                "start_node": "missing-a",
                "end_node": "missing-b",
            },
        )
        print("POST /api/shortest-path missing", missing.status_code, missing.json())

        cypher = client.post(
            "/api/execute-cypher",
            json={
                "query": (
                    "MATCH (i:Incident {id: 'INC-8821'})-"
                    "[:HAS_INCIDENT]-(n) "
                    "RETURN i.id AS incident, labels(n) AS labels, n.id AS node_id"
                )
            },
        )
        print("POST /api/execute-cypher", cypher.status_code, cypher.json())

        memory = client.get("/api/session-memory/sess_rca_8821")
        print("GET /api/session-memory", memory.status_code, memory.json())


if __name__ == "__main__":
    asyncio.run(probe_store())
    probe_http()
