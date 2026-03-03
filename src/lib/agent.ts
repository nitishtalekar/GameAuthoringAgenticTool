import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { GraphState, NodeFunction } from "./types";

export interface AgentNodeOptions {
  /**
   * A pre-built ChatPromptTemplate. Its messages are prepended before
   * the current state messages on every invocation.
   * If omitted, `systemPrompt` is used as a shorthand.
   */
  prompt?: ChatPromptTemplate;
  /**
   * A plain system prompt string. Ignored if `prompt` is provided.
   */
  systemPrompt?: string;
}

/**
 * Creates a LangGraph-compatible node function that invokes an LLM.
 *
 * The returned function can be passed directly to buildGraph() as a node.
 *
 * @example
 * const llm = createOpenAIModel({ temperature: 0 });
 * const agentNode = buildAgentNode(llm, {
 *   systemPrompt: "You are a creative game designer.",
 * });
 *
 * const graph = buildGraph({
 *   nodes: [{ name: "designer", fn: agentNode }],
 *   edges: [{ from: "designer", to: "END" }],
 *   entryPoint: "designer",
 * });
 */
export function buildAgentNode(
  llm: BaseChatModel,
  options: AgentNodeOptions = {}
): NodeFunction {
  return async (
    state: GraphState,
    _config?: RunnableConfig
  ): Promise<Partial<GraphState>> => {
    let messages: BaseMessage[] = state.messages;

    if (options.prompt) {
      const formatted = await options.prompt.formatMessages({});
      messages = [...formatted, ...state.messages];
    } else if (options.systemPrompt) {
      const { SystemMessage } = await import("@langchain/core/messages");
      messages = [new SystemMessage(options.systemPrompt), ...state.messages];
    }

    const response = await llm.invoke(messages);

    return { messages: [response] };
  };
}

/**
 * Creates a chain from a prompt template and an LLM — the `prompt.pipe(llm)` pattern.
 *
 * Use this for single invocations outside of a LangGraph workflow.
 *
 * @example
 * const chain = buildChain(prompt, llm);
 * const result = await chain.invoke({ input: "Design a puzzle mechanic" });
 */
export function buildChain(prompt: ChatPromptTemplate, llm: BaseChatModel) {
  return prompt.pipe(llm);
}
