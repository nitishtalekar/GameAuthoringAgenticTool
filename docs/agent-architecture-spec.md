# Agent Architecture Spec

This document describes the base layer used to define, configure, and invoke LLM agents in this project. A second instance of Claude Code should be able to replicate the exact structure from this spec alone.

---

## Stack

- **Next.js** (App Router) — all agent code lives in API routes
- **LangGraph** (`@langchain/langgraph`) — graph orchestration
- **LangChain** (`@langchain/core`, `@langchain/openai`, `@langchain/google-genai`) — LLM wrappers and message types
- **TypeScript** — strict mode; path alias `@/*` maps to `./src/*`
- **Runtime**: all agent routes must declare `export const runtime = "nodejs"` (LangChain is incompatible with the Edge runtime)

---

## File Map

```
src/
  lib/
    types.ts          — shared TypeScript interfaces
    models.ts         — LLM factory functions (OpenAI + Google)
    agent.ts          — buildAgentNode(), buildChain()
    graph.ts          — buildGraph(), runGraph(), streamGraph()
  utils/
    messages.ts       — message constructors and serialization helpers
    prompts.ts        — ChatPromptTemplate builders
  app/
    api/
      agent/route.ts  — demo POST route wiring everything end-to-end
```

---

## 1. Types — `src/lib/types.ts`

All shared interfaces live here. Import from `@/lib/types`.

```ts
import type { BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";

export type LLMProvider = "openai" | "google";

export interface ModelOptions {
  modelName?: string;
  temperature?: number;
  streaming?: boolean;
}

// The state object passed between graph nodes.
// Always contains a messages array; extend with additional fields as needed.
export interface GraphState {
  messages: BaseMessage[];
  [key: string]: unknown;
}

// A node function receives state (and an optional RunnableConfig) and returns
// a partial state update. LangGraph merges the partial back into the full state.
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

// Passed to buildGraph() to describe the full graph topology.
export interface GraphConfig {
  nodes: NodeDefinition[];
  edges: Array<{ from: string; to: string }>;
  conditionalEdges?: ConditionalEdgeDefinition[];
  entryPoint: string;
}

// One chunk yielded by streamGraph() — the node name and its state update.
export interface StreamChunk {
  node: string;
  state: Partial<GraphState>;
}
```

---

## 2. Models — `src/lib/models.ts`

Two factory functions, one convenience dispatcher. All read API keys from environment variables.

```ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { ModelOptions, LLMProvider } from "./types";

// Reads OPENAI_API_KEY and OPENAI_MODEL from the environment.
// Default model: "gpt-4o"
export function createOpenAIModel(options: ModelOptions = {}): ChatOpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY. Add it to .env.local.");

  return new ChatOpenAI({
    apiKey,
    modelName: options.modelName ?? process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature: options.temperature ?? 0.7,
    streaming: options.streaming ?? false,
  });
}

// Reads GOOGLE_API_KEY and GOOGLE_MODEL from the environment.
// Default model: "gemini-2.0-flash"
export function createGoogleModel(options: ModelOptions = {}): ChatGoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_API_KEY. Add it to .env.local.");

  return new ChatGoogleGenerativeAI({
    apiKey,
    model: options.modelName ?? process.env.GOOGLE_MODEL ?? "gemini-2.0-flash",
    temperature: options.temperature ?? 0.7,
    streaming: options.streaming ?? false,
  });
}

// Provider dispatcher — use this when the provider may change at runtime.
export function createModel(
  provider: LLMProvider,
  options: ModelOptions = {}
): ChatOpenAI | ChatGoogleGenerativeAI {
  return provider === "google"
    ? createGoogleModel(options)
    : createOpenAIModel(options);
}
```

### Switching models / providers

| Goal | How |
|---|---|
| Change OpenAI model | Pass `modelName: "gpt-4o-mini"` to `createOpenAIModel()` |
| Change Google model | Pass `modelName: "gemini-1.5-pro"` to `createGoogleModel()` |
| Override via env | Set `OPENAI_MODEL` or `GOOGLE_MODEL` in `.env.local` |
| Switch provider dynamically | Use `createModel("google", { ... })` |
| Use Google for one agent, OpenAI for another | Call each factory separately in the agent builder |

---

## 3. Agent Node — `src/lib/agent.ts`

`buildAgentNode` wraps an LLM into a `NodeFunction` compatible with LangGraph. It prepends a system prompt or a full `ChatPromptTemplate` to the current state messages before calling the LLM.

```ts
import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { GraphState, NodeFunction } from "./types";

export interface AgentNodeOptions {
  // A pre-built ChatPromptTemplate. Its messages are prepended before state.messages.
  prompt?: ChatPromptTemplate;
  // Plain system prompt string. Ignored if `prompt` is provided.
  systemPrompt?: string;
}

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

// For single-turn chains outside of a LangGraph workflow.
export function buildChain(prompt: ChatPromptTemplate, llm: BaseChatModel) {
  return prompt.pipe(llm);
}
```

**Key behaviour**: the node returns `{ messages: [response] }`. LangGraph's `MessagesAnnotation` reducer appends this to the existing messages array.

---

## 4. Graph — `src/lib/graph.ts`

`buildGraph` compiles a `StateGraph` from a `GraphConfig` descriptor. The graph uses `MessagesAnnotation` as its state schema, which automatically handles message accumulation.

```ts
import { StateGraph, END, MessagesAnnotation } from "@langchain/langgraph";
import type { GraphConfig, GraphState, StreamChunk } from "./types";

export function buildGraph(config: GraphConfig) {
  const graph = new StateGraph(MessagesAnnotation);
  const g = graph as any; // cast needed — addEdge/addNode have strict literal types

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

// Run a compiled graph to completion; returns the final accumulated state.
export async function runGraph(
  graph: ReturnType<typeof buildGraph>,
  initialState: Partial<GraphState>
): Promise<GraphState> {
  const result = await graph.invoke(initialState);
  return result as GraphState;
}

// Stream a compiled graph; yields one StreamChunk per node execution.
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
```

**Graph topology rules**:
- The entry point is automatically connected from `"__start__"`.
- Use `"END"` (the string) in `edges[].to`; `buildGraph` translates it to the LangGraph `END` sentinel.
- Conditional edges use a `pathMap` that maps return values of the condition function to node names.

---

## 5. Message Utilities — `src/utils/messages.ts`

Constructors and serialization helpers for `BaseMessage` types. Always import from `@/utils/messages`.

```ts
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

// Constructors
export const human = (content: string) => new HumanMessage({ content });
export const ai    = (content: string) => new AIMessage({ content });
export const system = (content: string) => new SystemMessage({ content });

// Swaps Human <-> AI roles. Pass-through for SystemMessages.
// Use when building conversation history from another agent's perspective.
export function swapRoles(messages: BaseMessage[]): BaseMessage[];

// Returns the string content of the last message in an array (or "" if empty).
export function getLastMessageContent(messages: BaseMessage[]): string;

// Deserialize from plain { role, content } objects (e.g. incoming API request body).
export function deserializeMessages(
  raw: Array<{ role: "human" | "ai" | "system"; content: string }>
): BaseMessage[];

// Serialize to plain { role, content } objects for JSON API responses.
export function serializeMessages(
  messages: BaseMessage[]
): Array<{ role: string; content: unknown }>;
```

---

## 6. Prompt Utilities — `src/utils/prompts.ts`

Builders for `ChatPromptTemplate`. Use `{variable_name}` syntax in content strings for interpolation.

```ts
export interface PromptMessage {
  role: "system" | "human" | "ai";
  content: string; // may contain {variable} placeholders
}

// Async — supports pre-filling partial variables via the second argument.
export async function buildPrompt(
  messages: PromptMessage[],
  partials: Record<string, string> = {}
): Promise<ChatPromptTemplate>;

// Synchronous — no partial fill support.
export function buildPromptSync(messages: PromptMessage[]): ChatPromptTemplate;
```

**Example**:
```ts
const prompt = await buildPrompt(
  [
    { role: "system", content: "You are a {role} assistant." },
    { role: "human",  content: "{input}" },
  ],
  { role: "game designer" } // partially fill "role" now; "input" left for later
);
const chain = prompt.pipe(llm);
const result = await chain.invoke({ input: "Design a puzzle mechanic" });
```

---

## 7. Defining an Agent

An agent is a plain TypeScript function that returns a `NodeFunction`. The pattern is:

```ts
// src/lib/game/agents.ts (or any file — keep domain agents together)
import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";

export function buildMyAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });

  const systemPrompt = `You are a specialized agent. Your task is ...

OUTPUT: Respond ONLY with valid JSON matching this schema:
{ "result": "..." }`;

  return buildAgentNode(llm, { systemPrompt });
}
```

To use Google instead of OpenAI:

```ts
import { createGoogleModel } from "@/lib/models";

export function buildMyAgent(): NodeFunction {
  const llm = createGoogleModel({ modelName: "gemini-1.5-pro", temperature: 0.3 });
  return buildAgentNode(llm, { systemPrompt: "..." });
}
```

To select a provider at runtime:

```ts
import { createModel } from "@/lib/models";

export function buildMyAgent(provider: "openai" | "google"): NodeFunction {
  const llm = createModel(provider, { temperature: 0.2 });
  return buildAgentNode(llm, { systemPrompt: "..." });
}
```

---

## 8. Wiring an Agent into an API Route

Every agent route follows the same pattern: validate input → build agent → build graph → run graph → extract output → return JSON.

```ts
// src/app/api/my-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import { buildGraph, runGraph } from "@/lib/graph";
import { human, serializeMessages } from "@/utils/messages";

export const runtime = "nodejs"; // required — do not remove

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { message?: string };
    const userMessage = body.message?.trim();

    if (!userMessage) {
      return NextResponse.json(
        { error: "Request body must include a non-empty `message` string." },
        { status: 400 }
      );
    }

    const llm = createOpenAIModel({ temperature: 0.7 });

    const agentNode = buildAgentNode(llm, {
      systemPrompt: "You are a helpful assistant.",
    });

    const graph = buildGraph({
      nodes: [{ name: "agent", fn: agentNode }],
      edges: [{ from: "agent", to: "END" }],
      entryPoint: "agent",
    });

    const finalState = await runGraph(graph, {
      messages: [human(userMessage)],
    });

    return NextResponse.json({
      messages: serializeMessages(finalState.messages),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/my-feature]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

---

## 9. Multi-Agent Step Pattern

For pipelines where multiple agents run sequentially (each depending on the previous step's output), the project uses a **stateful step dispatcher** pattern rather than a single large graph. This keeps each agent isolated and lets the client accumulate state step by step.

```
POST /api/game/step
Body:    { step: number, state: GameState }
Returns: { state: GameState, error?: string }
```

Each step runner:
1. Validates that prior steps have populated the required state fields.
2. Builds its agent node and a single-node graph.
3. Constructs a human message that inlines the relevant prior state as JSON.
4. Runs the graph and parses the JSON response from `getLastMessageContent`.
5. Merges the parsed output back into `GameState` and returns it.

```ts
async function runAgentN(state: GameState): Promise<GameState> {
  if (!state.requiredFieldFromPreviousStep) {
    throw new Error("AgentN requires step N-1 to be completed first.");
  }

  const agentNode = buildMyAgent();
  const graph = buildGraph({
    nodes: [{ name: "myAgent", fn: agentNode }],
    edges: [{ from: "myAgent", to: "END" }],
    entryPoint: "myAgent",
  });

  const humanMsg = `Context from prior steps:
${JSON.stringify(state.requiredFieldFromPreviousStep, null, 2)}

Instruction for this step.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const parsed = parseJson<MyOutputType>(raw, "AgentN");
  return { ...state, step: N, myNewField: parsed };
}
```

**JSON parsing helper** (include in the route file):

```ts
function parseJson<T>(raw: string, agentLabel: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `${agentLabel} returned invalid JSON. First 300 chars: ${cleaned.slice(0, 300)}`
    );
  }
}
```

---

## 10. Multi-Node Graphs (Conditional Routing)

For graphs where execution should branch based on agent output:

```ts
import type { GraphState, EdgeCondition } from "@/lib/types";

const routerCondition: EdgeCondition = (state: GraphState): string => {
  const last = state.messages[state.messages.length - 1];
  const content = typeof last.content === "string" ? last.content : "";
  return content.includes("DONE") ? "end" : "continue";
};

const graph = buildGraph({
  nodes: [
    { name: "agentA", fn: agentANode },
    { name: "agentB", fn: agentBNode },
  ],
  edges: [
    { from: "agentA", to: "END" }, // fallback — overridden by conditional edge below
  ],
  conditionalEdges: [
    {
      from: "agentA",
      condition: routerCondition,
      pathMap: {
        continue: "agentB",
        end: "__end__",
      },
    },
  ],
  entryPoint: "agentA",
});
```

---

## 11. Environment Variables

Add to `.env.local` (never commit this file):

```
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AI...

# Optional — override the default model for each provider
OPENAI_MODEL=gpt-4o-mini
GOOGLE_MODEL=gemini-1.5-pro
```

---

## 12. Next.js Config Requirements

`next.config.ts` must exclude LangChain from client bundles:

```ts
const nextConfig = {
  serverExternalPackages: [
    "@langchain/core",
    "@langchain/openai",
    "@langchain/google-genai",
    "@langchain/langgraph",
  ],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@langchain/core": false,
        "@langchain/openai": false,
        "@langchain/google-genai": false,
        "@langchain/langgraph": false,
      };
    }
    return config;
  },
};
```

---

## 13. Quick-Start Checklist

To add a new agent from scratch:

- [ ] Create a builder function in `src/lib/game/agents.ts` (or a new domain file)
- [ ] Choose `createOpenAIModel`, `createGoogleModel`, or `createModel(provider, ...)` for the LLM
- [ ] Write the system prompt — end with an explicit JSON output schema if structured output is needed
- [ ] Return `buildAgentNode(llm, { systemPrompt })`
- [ ] In the API route, call your builder, wrap in `buildGraph`, run with `runGraph`
- [ ] Parse the last message content with `getLastMessageContent` + `parseJson`
- [ ] Add `export const runtime = "nodejs"` to the route file
- [ ] Add the required API key to `.env.local`
