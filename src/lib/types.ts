import type { BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

export type LLMProvider = "openai" | "google";

export interface ModelOptions {
  modelName?: string;
  temperature?: number;
  streaming?: boolean;
}

export interface GraphState {
  messages: BaseMessage[];
  [key: string]: unknown;
}

export type NodeFunction = (
  state: GraphState,
  config?: RunnableConfig
) => Promise<Partial<GraphState>>;

export type EdgeCondition = (state: GraphState) => string;

export interface NodeDefinition {
  name: string;
  fn: NodeFunction;
}

export interface ConditionalEdgeDefinition {
  from: string;
  condition: EdgeCondition;
  pathMap: Record<string, string>;
}

export interface GraphConfig {
  nodes: NodeDefinition[];
  edges: Array<{ from: string; to: string }>;
  conditionalEdges?: ConditionalEdgeDefinition[];
  entryPoint: string;
}

export interface StreamChunk {
  node: string;
  state: Partial<GraphState>;
}
