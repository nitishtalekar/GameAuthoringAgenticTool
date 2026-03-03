import { NextRequest, NextResponse } from "next/server";
import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import { buildGraph, runGraph } from "@/lib/graph";
import { human, serializeMessages } from "@/utils/messages";

// Required: LangChain uses Node.js built-ins incompatible with the Edge runtime.
export const runtime = "nodejs";

/**
 * POST /api/agent
 *
 * Body:    { message: string }
 * Returns: { messages: Array<{ role: string; content: unknown }> }
 *
 * Minimal demo route that wires the base layer together end-to-end.
 * Replace or extend the graph definition as the project grows.
 */
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
      systemPrompt: "Respond as a pirate",
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
    console.error("[/api/agent]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
