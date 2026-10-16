from falkordb import FalkorDB

# FalkorDB local instance se connect karein
db = FalkorDB(host='localhost', port=6379)
graph = db.select_graph('it_infrastructure_rca')


# seed.cypher file read karein
with open('seed.cypher', 'r', encoding='utf-8') as f:
    cypher_text = f.read()

# Comments ('//') hatayein
lines = [line for line in cypher_text.splitlines() if not line.strip().startswith('//')]
clean_cypher = '\n'.join(lines)

# Queries execute karein
for query in clean_cypher.split(';'):
    query = query.strip()
    if query:
        graph.query(query)

print("✅ FalkorDB me seed data successfully load ho gaya hai!")
