import { StateGraph, END, MessagesAnnotation } from "@langchain/langgraph";
import type { GraphConfig, GraphState, StreamChunk } from "./types";

/**
 * Builds and compiles a LangGraph StateGraph from a GraphConfig descriptor.
 *
 * @example
 * const graph = buildGraph({
 *   nodes: [{ name: "agent", fn: myAgentNode }],
 *   edges: [{ from: "agent", to: "END" }],
 *   entryPoint: "agent",
 * });
 * const result = await runGraph(graph, { messages: [human("Hello")] });
 */
export function buildGraph(config: GraphConfig) {
  const graph = new StateGraph(MessagesAnnotation);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = graph as any;

  for (const node of config.nodes) {
    g.addNode(node.name, node.fn);
  }

  g.addEdge("__start__", config.entryPoint);

  for (const edge of config.edges) {
    const target = edge.to === "END" ? END : edge.to;
    g.addEdge(edge.from, target);
  }

  if (config.conditionalEdges) {
    for (const ce of config.conditionalEdges) {
      g.addConditionalEdges(ce.from, ce.condition, ce.pathMap);
    }
  }

  return graph.compile();
}

/**
 * Invokes a compiled graph with an initial state and returns the final state.
 */
export async function runGraph(
  graph: ReturnType<typeof buildGraph>,
  initialState: Partial<GraphState>
): Promise<GraphState> {
  const result = await graph.invoke(initialState);
  return result as GraphState;
}

/**
 * Streams a compiled graph run, yielding one StreamChunk per node execution.
 *
 * @example
 * for await (const chunk of streamGraph(graph, { messages: [] })) {
 *   console.log(chunk.node, chunk.state);
 * }
 */
export async function* streamGraph(
  graph: ReturnType<typeof buildGraph>,
  initialState: Partial<GraphState>
): AsyncGenerator<StreamChunk> {
  const stream = await graph.stream(initialState);

  for await (const chunk of stream) {
    for (const [node, state] of Object.entries(chunk)) {
      yield { node, state: state as Partial<GraphState> };
    }
  }
}
