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
  