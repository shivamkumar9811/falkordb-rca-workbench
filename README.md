# Falkor / Orchestra

Graph-driven incident investigation console connecting the React workspace to the existing FastAPI multi-agent orchestrator and FalkorDB adapter.

## Project structure

```text
/backend
├── agents.py                 # Memory, Investigator, and Explainer workflow
├── lib/falkor.py             # FalkorDB and graph serialization adapter
├── models/                   # Pydantic request and response contracts
├── routers/                  # /api/graph*, /api/investigate, and /api/orchestrate
├── requirements.txt
└── server.py                 # FastAPI application entrypoint
/frontend
├── src/pages/Orchestrator.tsx # Investigation console
├── src/components/            # Agent log, answer, Cytoscape canvas, drawer
├── src/lib/api.ts             # Relative /api typed fetch boundary
├── src/lib/types.ts           # Hand-written API interfaces
└── vite.config.ts             # React dev server and /api proxy
/scripts
└── README.md                 # Local startup notes
/seed.cypher                  # Repeatable FalkorDB incident scenario
