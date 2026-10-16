from falkordb import FalkorDB

db = FalkorDB(host="localhost", port=6379)
g = db.select_graph("rca_graph")

print("=== neo4j-style MATCH path = shortestPath ===")
try:
    r = g.query(
        """
        MATCH (start {id: $start_node}),
              (finish {id: $end_node}),
              path = shortestPath((start)-[*..8]-(finish))
        RETURN path
        """,
        {"start_node": "c-9041", "end_node": "payment-db-primary"},
    )
    print("ok", r.result_set)
except Exception as exc:
    print(type(exc).__name__, exc)

print("=== falkor WITH shortestPath ===")
try:
    r = g.query(
        """
        MATCH (start {id: $start_node}), (finish {id: $end_node})
        WITH shortestPath((start)-[*..8]-(finish)) AS path
        RETURN path
        """,
        {"start_node": "c-9041", "end_node": "payment-db-primary"},
    )
    print("ok", r.header, r.result_set)
    path = r.result_set[0][0] if r.result_set else None
    print("path type", type(path), path)
    if path is not None:
        print("nodes", [n.properties.get("id") for n in path.nodes()])
        print("edges", [(e.relation, e.src_node, e.dest_node) for e in path.edges()])
except Exception as exc:
    print(type(exc).__name__, exc)

print("=== map list comprehension ===")
try:
    r = g.query(
        """
        MATCH (start {id: $start_node}), (finish {id: $end_node})
        WITH shortestPath((start)-[*..8]-(finish)) AS path
        RETURN
            [n IN nodes(path) | {
                id: n.id,
                labels: labels(n),
                properties: properties(n)
            }] AS nodes,
            [rel IN relationships(path) | {
                type: type(rel),
                start: startNode(rel).id,
                end: endNode(rel).id,
                properties: properties(rel)
            }] AS edges,
            length(path) AS hops
        """,
        {"start_node": "c-9041", "end_node": "payment-db-primary"},
    )
    print("ok", r.header)
    print(r.result_set)
except Exception as exc:
    print(type(exc).__name__, exc)

print("=== datetime toString ===")
try:
    r = g.query(
        "RETURN toString(datetime()) AS timestamp"
    )
    print("ok", r.result_set)
except Exception as exc:
    print(type(exc).__name__, exc)

print("=== directed shortestPath ===")
try:
    r = g.query(
        """
        MATCH (start {id: $start_node}), (finish {id: $end_node})
        WITH shortestPath((start)-[*..8]->(finish)) AS path
        RETURN path
        """,
        {"start_node": "c-9041", "end_node": "payment-db-primary"},
    )
    path = r.result_set[0][0] if r.result_set else None
    print("path", path)
    if path is not None:
        print("nodes", [n.properties.get("id") for n in path.nodes()])
        print("edges", [e.relation for e in path.edges()])
        print("src dest", [(e.src_node, e.dest_node, type(e.src_node)) for e in path.edges()])
except Exception as exc:
    print(type(exc).__name__, exc)

print("=== reverse directed ===")
try:
    r = g.query(
        """
        MATCH (start {id: $start_node}), (finish {id: $end_node})
        WITH shortestPath((start)-[*..8]->(finish)) AS fwd,
             shortestPath((finish)-[*..8]->(start)) AS rev
        RETURN CASE WHEN fwd IS NOT NULL THEN fwd ELSE rev END AS path
        """,
        {"start_node": "payment-db-primary", "end_node": "c-9041"},
    )
    path = r.result_set[0][0] if r.result_set else None
    print("path", path)
    if path is not None:
        print("nodes", [n.properties.get("id") for n in path.nodes()])
except Exception as exc:
    print(type(exc).__name__, exc)

print("=== timestamp string ===")
try:
    r = g.query(
        "RETURN $ts AS timestamp",
        {"ts": "2026-10-16T12:00:00+00:00"},
    )
    print("ok", r.result_set)
except Exception as exc:
    print(type(exc).__name__, exc)
