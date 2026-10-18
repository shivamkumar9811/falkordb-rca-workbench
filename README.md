# 🧠 FalkorMind — Graph-Driven Multi-Agent RCA Console

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind_v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![FalkorDB](https://img.shields.io/badge/Graph_Database-FalkorDB-FF4500?style=flat)](https://www.falkordb.com/)

> **FalkorMind** is a unified, single-page observability console and root-cause analysis (RCA) workbench powered by multi-agent AI orchestration and FalkorDB knowledge graphs. Designed for SREs and DevOps teams, it transforms complex incident logs into interactive visual graph traces and actionable remediation steps in real time.

---

![FalkorMind Dashboard](https://raw.githubusercontent.com/shivamkumar9811/falkordb-rca-workbench/main/frontend/public/dashboard-preview.png)

---

## ✨ Key Features

### 🔍 Multi-Agent RCA Engine
* **Sequential Reasoning Pipeline:** Multi-agent pipeline consisting of **Memory Agent** $\rightarrow$ **Investigator Agent** $\rightarrow$ **Explainer Agent**.
* **Trace-Backed Root Cause Identification:** Maps code commits (`CodeCommit`), microservices (`Microservice`), databases (`Database`), and infrastructure dependencies into a deterministic execution graph.
* **Actionable Remediation:** Generates precise, prioritized recommended steps to stabilize affected blast radii.

### 🎨 High-Impact SRE Observability Console
* **Interactive Cytoscape.js Graph Canvas:** Real-time graph visualization with full panning, smooth zooming, fit-to-view, and interactive node details drawer.
* **Glowing Root-Cause Nodes:** Dynamic red pulsing glow effect on critical anomaly nodes for immediate visual contrast.
* **Live Agent Status Badges:** Visual pipeline indicators (Pending, Running with animated pulse, Completed with checkmark, or Failed).
* **Clickable Visited-Node Chips:** Click on any node chip in the answer section to smoothly pan and zoom the Cytoscape canvas directly to that component.
* **Glassmorphic Dark UI:** Modern observability theme engineered with Tailwind v4, dark mode glassmorphic panels, and high-contrast typography.

### 🛡️ Resilient Architecture & Fallback
* **Seamless Dual-Mode Support:** Automatically connects to live **FalkorDB** graph instances via MCP. If the graph database is offline, it gracefully switches to an internal deterministic **Mock Fallback Mode** without breaking execution.
* **Live Header Status Indicator:** Displays `🟢 FALKORDB: LIVE` or `🟡 FALKORDB: MOCK MODE` dynamically based on backend health checks.

---

## 🏗️ System Architecture


```

```
                              +-------------------------------------------------+
                              |         FalkorMind React Frontend (Vite)        |
                              |   (Cytoscape.js Canvas | Glassmorphic Console) |
                              +------------------------+------------------------+
                                                       |
                                            HTTP / REST API Proxy
                                                       |
                                                       v
                              +-------------------------------------------------+
                              |            FastAPI Backend Engine               |
                              +------------------------+------------------------+
                                                       |
                                  +--------------------+--------------------+
                                  |                                         |
                                  v                                         v
                     +-------------------------+               +-------------------------+
                     |     FalkorDB Graph      |               |      Mock Adapter       |
                     |  (Live MCP Connection)  |               |  (Resilient Fallback)   |
                     +-------------------------+               +-------------------------+

```

```

---

## 📁 Repository Structure

```text
falkordb-rca-workbench/
├── backend/
│   ├── main.py / server.py     # FastAPI application & REST routing
│   ├── requirements.txt        # Python backend dependencies
│   └── ...                     # Agent orchestration & FalkorDB adapters
├── frontend/
│   ├── src/
│   │   ├── components/         # Cytoscape GraphCanvas, AgentLogStream, AnswerCard, etc.
│   │   ├── pages/              # Main single-page RCA Dashboard
│   │   ├── App.tsx             # Application route configuration
│   │   └── main.tsx            # React root & Query Client setup
│   ├── package.json            # Frontend NPM dependencies & scripts
│   └── vite.config.ts          # Vite configuration with API proxy rules
└── README.md                   # Project documentation

```

---

## 🚀 Quickstart Guide

### Prerequisites

* **Node.js** (v18 or higher) & **npm**
* **Python** (3.10 or higher) & **pip**
* *(Optional)* **Docker** (if running a live FalkorDB container)

---

### Step 1: Clone the Repository

```bash
git clone [https://github.com/shivamkumar9811/falkordb-rca-workbench.git](https://github.com/shivamkumar9811/falkordb-rca-workbench.git)
cd falkordb-rca-workbench

```

---

### Step 2: Start Backend Server (FastAPI)

1. Navigate to the `backend` directory:
```bash
cd backend

```


2. Create and activate a virtual environment *(optional but recommended)*:
```bash
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

```


3. Install backend dependencies:
```bash
pip install -r requirements.txt

```


4. Run the FastAPI server (runs on port 3000 / 5000):
```bash
uvicorn server:app --host 127.0.0.1 --port 3000 --reload

```


*Verify backend status at: `http://127.0.0.1:3000/api/status*`

---

### Step 3: Start Frontend Client (React + Vite)

1. Open a new terminal window and navigate to the `frontend` directory:
```bash
cd frontend

```


2. Install frontend packages:
```bash
npm install

```


3. Launch the Vite development server:
```bash
npm run dev

```


4. Access the **FalkorMind Console** in your browser at:
```text
http://localhost:5173

```



---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/status` | Health check endpoint returning backend status & active FalkorDB mode |
| `POST` | `/api/investigate` | Triggers multi-agent RCA orchestration with graph traces & root cause answer |
| `GET` | `/api/graph/full` | Fetches full graph topology (nodes and edges) for Cytoscape canvas initialization |

---

## 🛠️ Built With

* **Frontend:** React 18, TypeScript, Tailwind CSS v4, Cytoscape.js, Lucide Icons, Radix UI / shadcn/ui
* **Backend:** Python 3.10+, FastAPI, Uvicorn, Pydantic
* **Graph & Knowledge Representation:** FalkorDB, Cypher Query Language, Model Context Protocol (MCP)

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
