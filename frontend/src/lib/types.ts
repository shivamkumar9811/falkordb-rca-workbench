export interface GraphNode {
    id: string;
    labels: string[];
    properties: Record<string, unknown>;
  }
  
  export interface GraphEdge {
    type: string;
    start: string;
    end: string;
    properties: Record<string, unknown>;
  }
  
  export interface GraphSnapshot {
    nodes: GraphNode[];
    edges: GraphEdge[];
  }
  
  export interface FalkorStatus {
    connected: boolean;
    graph_name: string;
    host: string;
    port: number;
    latency_ms: number | null;
    node_count: number;
    edge_count: number;
    labels: Record<string, number>;
    error?: string | null;
  }
  
  export interface SeedResult {
    seeded: boolean;
    graph_name: string;
    node_count: number;
    edge_count: number;
  }
  
  export interface CypherResult {
    columns: string[];
    rows: Array<Record<string, unknown>>;
    result_count: number;
    elapsed_ms: number;
  }
  
  export interface PathResult {
    start_node: string;
    end_node: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    hops: number | null;
    found: boolean;
  }
  
  export interface SessionMemory {
    session_id: string;
    decision: string;
    visited_nodes: string[];
    timestamp: string;
    incident_id?: string | null;
  }
  
  export interface MemoryWriteResult {
    saved: boolean;
    memory: SessionMemory;
  }

  export interface TraceStep {
    step: number;
    node_id: string;
    label: string;
    relation_from_previous: string | null;
    properties: Record<string, unknown>;
  }

  export interface ToolLogEntry {
    agent: string;
    tool: string;
    status: string;
    mode: string;
  }

  export interface AgentStatus {
    name: string;
    status: string;
    detail: string;
  }

  export interface OrchestrationResponse {
    answer: string;
    trace_path: TraceStep[];
    visited_nodes: string[];
    memory_updated: boolean;
    incident_id: string;
    session_id: string;
    query: string;
    mcp_mode: string;
    root_cause_analysis: string;
    raw_graph_path: Record<string, unknown>;
    previous_memory: Array<Record<string, unknown>>;
    tool_log: ToolLogEntry[];
    agents: AgentStatus[];
  }
  