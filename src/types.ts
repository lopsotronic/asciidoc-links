export type EdgeType = "link" | "include" | "include-partial";

export type Edge = {
  source: string;
  target: string;
  type: EdgeType;  // NEW: Add edge type
};

export type Node = {
  id: string;
  path: string;
  label: string;
};

export type Graph = {
  nodes: Node[];
  edges: Edge[];
};


// Simplified - no longer need MarkdownNode since we're using regex parsing
export type AsciidocLink = {
  target: string;
  type: EdgeType;
};
