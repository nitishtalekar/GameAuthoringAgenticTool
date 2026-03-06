import { NextRequest, NextResponse } from "next/server";
import { buildGraph, runGraph } from "@/lib/graph";
import { human, getLastMessageContent } from "@/utils/messages";
import {
  buildAuthoringAgent,
  buildMicroRhetoricAgent,
  buildEntityAttributeAgent,
  buildRecipeAgent,
  buildVerifierAgent,
  buildRhetoricCriticAgent,
  buildXmlGenerationAgent,
} from "@/lib/game/agents";
import { validateXml, serializeToXml } from "@/lib/game/xml-generator";
import type {
  StepRequest,
  StepResponse,
  GameState,
  EntityAttributeState,
  ConceptGraph,
  MicroRhetoricsSelection,
} from "@/lib/game/types";

// Required: LangChain uses Node.js built-ins incompatible with the Edge runtime.
export const runtime = "nodejs";

/**
 * POST /api/game/step
 *
 * Body:    { step: number, state: GameState }
 * Returns: { state: GameState, error?: string }
 *
 * Runs exactly one agent step and returns the updated GameState.
 * The client is responsible for accumulating state and triggering the next step.
 */
export async function POST(req: NextRequest): Promise<NextResponse<StepResponse>> {
  try {
    const body = (await req.json()) as StepRequest;
    const { step, state } = body;

    if (!step || step < 1 || step > 7) {
      return NextResponse.json(
        { state, error: "Invalid step number. Must be between 1 and 7." },
        { status: 400 }
      );
    }

    const updatedState = await runStep(step, state);
    return NextResponse.json({ state: updatedState });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[/api/game/step]`, message);
    return NextResponse.json(
      { state: {} as GameState, error: message },
      { status: 500 }
    );
  }
}

// --- Step dispatcher ---

async function runStep(step: number, state: GameState): Promise<GameState> {
  switch (step) {
    case 1:
      return runAgent1(state);
    case 2:
      return runAgent2(state);
    case 3:
      return runAgent3(state);   // Entity Attribute Agent (new)
    case 4:
      return runAgent4(state);   // Recipe Selection (was 3)
    case 5:
      return runAgent5(state);   // Verifier (was 4)
    case 6:
      return runAgent6(state);   // Rhetoric Critic (was 5)
    // case 65:
    //   return runAgent6b(state);  // Rhetoric Swap + Re-Critique (was 55)
    case 7:
      return runAgent7(state);   // XML Generation (was 6)
    default:
      throw new Error(`Unhandled step: ${step}`);
  }
}

// --- Per-step runners ---

async function runAgent1(state: GameState): Promise<GameState> {
  const agentNode = buildAuthoringAgent();
  const graph = buildGraph({
    nodes: [{ name: "authoring", fn: agentNode }],
    edges: [{ from: "authoring", to: "END" }],
    entryPoint: "authoring",
  });

  const finalState = await runGraph(graph, {
    messages: [human(state.input)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const conceptGraph = parseJson<ConceptGraph>(raw, "Agent 1 (Authoring)");

  return { ...state, step: 1, conceptGraph };
}

async function runAgent2(state: GameState): Promise<GameState> {
  if (!state.conceptGraph) {
    throw new Error("Agent 2 requires conceptGraph from step 1. Run step 1 first.");
  }

  const agentNode = buildMicroRhetoricAgent();
  const graph = buildGraph({
    nodes: [{ name: "microRhetoric", fn: agentNode }],
    edges: [{ from: "microRhetoric", to: "END" }],
    entryPoint: "microRhetoric",
  });

  const humanMsg = `Original user concept: ${state.input}

Concept graph extracted by the Authoring Agent:
${JSON.stringify(state.conceptGraph, null, 2)}

Select the best micro-rhetoric for each relation listed above.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const microRhetoricsSelection = parseJson<MicroRhetoricsSelection>(
    raw,
    "Agent 2 (Micro-Rhetoric Selection)"
  );

  return { ...state, step: 2, microRhetoricsSelection };
}

async function runAgent3(state: GameState): Promise<GameState> {
  if (!state.conceptGraph || !state.microRhetoricsSelection) {
    throw new Error("Agent 3 requires conceptGraph and microRhetoricsSelection. Run steps 1–2 first.");
  }

  const agentNode = buildEntityAttributeAgent();
  const graph = buildGraph({
    nodes: [{ name: "entityAttributes", fn: agentNode }],
    edges: [{ from: "entityAttributes", to: "END" }],
    entryPoint: "entityAttributes",
  });

  const humanMsg = `Original user concept (the intended rhetorical meaning — use this as your primary semantic guide):
"${state.input}"

Concept graph (entities and relations extracted from the concept above):
${JSON.stringify(state.conceptGraph, null, 2)}

Micro-rhetoric selections (the component assigned to each relation — these are your primary mechanical evidence):
${JSON.stringify(state.microRhetoricsSelection, null, 2)}

Using the concept, concept graph, and micro-rhetoric selections together, assign the correct attribute values for every entity listed above. Only set an attribute to true or a non-null entity name when clearly supported by the micro-rhetoric selections or the concept graph relations.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const parsed = parseJson<{ entityAttributeState: EntityAttributeState }>(raw, "Agent 3 (Entity Attributes)");

  return { ...state, step: 3, entityAttributeState: parsed.entityAttributeState };
}

async function runAgent4(state: GameState): Promise<GameState> {
  if (!state.conceptGraph || !state.microRhetoricsSelection) {
    throw new Error("Agent 4 requires conceptGraph and microRhetoricsSelection. Run steps 1–3 first.");
  }

  const agentNode = buildRecipeAgent();
  const graph = buildGraph({
    nodes: [{ name: "recipe", fn: agentNode }],
    edges: [{ from: "recipe", to: "END" }],
    entryPoint: "recipe",
  });

  const humanMsg = `Original user concept: ${state.input}

Concept graph:
${JSON.stringify(state.conceptGraph, null, 2)}

Micro-rhetoric selections (entity components assigned so far):
${JSON.stringify(state.microRhetoricsSelection, null, 2)}

Entity attribute state (use this to derive win_condition and lose_condition):
${JSON.stringify(state.entityAttributeState, null, 2)}

Select the most appropriate win, lose, structure, and patch recipes for this game.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recipeSelection = parseJson<any>(raw, "Agent 4 (Recipe Selection)");

  return { ...state, step: 4, recipeSelection };
}

async function runAgent5(state: GameState): Promise<GameState> {
  if (!state.conceptGraph || !state.microRhetoricsSelection || !state.recipeSelection || !state.entityAttributeState) {
    throw new Error("Agent 5 requires steps 1–4 to be completed first.");
  }

  const agentNode = buildVerifierAgent();
  const graph = buildGraph({
    nodes: [{ name: "verifier", fn: agentNode }],
    edges: [{ from: "verifier", to: "END" }],
    entryPoint: "verifier",
  });

  const humanMsg = `Original user concept: ${state.input}

Concept graph (use this to check concept consistency of entityAttributeState):
${JSON.stringify(state.conceptGraph, null, 2)}

Micro-rhetoric selections:
${JSON.stringify(state.microRhetoricsSelection, null, 2)}

Entity attribute state (this is what you must verify and may repair):
${JSON.stringify(state.entityAttributeState, null, 2)}

Recipe selection — win and lose conditions (this is what you must verify and may repair):
${JSON.stringify(state.recipeSelection, null, 2)}

Verify playability, propose minimal repairs, and check concept graph consistency.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verifierReport = parseJson<any>(raw, "Agent 5 (Verifier)");

  // Apply repairs back to entityAttributeState and recipeSelection
  const { entityAttributeState, recipeSelection } = applyVerifierRepairs(
    state.entityAttributeState,
    state.recipeSelection,
    verifierReport
  );

  return {
    ...state,
    step: 5,
    entityAttributeState,
    recipeSelection,
    verifierReport,
  };
}

async function runAgent6(state: GameState): Promise<GameState> {
  if (!state.entityAttributeState || !state.recipeSelection || !state.verifierReport) {
    throw new Error("Agent 6 requires steps 1–5 to be completed first.");
  }

  const agentNode = buildRhetoricCriticAgent();
  const graph = buildGraph({
    nodes: [{ name: "critic", fn: agentNode }],
    edges: [{ from: "critic", to: "END" }],
    entryPoint: "critic",
  });

  const humanMsg = `Original user concept (intended meaning): ${state.input}

Original concept graph:
${JSON.stringify(state.conceptGraph, null, 2)}

Entity attribute state (the game mechanics):
${JSON.stringify(state.entityAttributeState, null, 2)}

Recipe selection (win/lose conditions):
${JSON.stringify(state.recipeSelection, null, 2)}

Evaluate how well the game mechanics express the intended rhetorical meaning.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rhetoricCritique = parseJson<any>(raw, "Agent 6 (Rhetoric Critic)");

  return { ...state, step: 6, rhetoricCritique };
}


async function runAgent7(state: GameState): Promise<GameState> {
  if (!state.entityAttributeState || !state.recipeSelection) {
    throw new Error("Agent 7 requires steps 1–6 to be completed first.");
  }

  const agentNode = buildXmlGenerationAgent();
  const graph = buildGraph({
    nodes: [{ name: "xmlGen", fn: agentNode }],
    edges: [{ from: "xmlGen", to: "END" }],
    entryPoint: "xmlGen",
  });

  const humanMsg = `Original user concept: ${state.input}

Entity attribute state (all entities and their mechanics):
${JSON.stringify(state.entityAttributeState, null, 2)}

Recipe selection:
${JSON.stringify(state.recipeSelection, null, 2)}

Micro-rhetoric selections:
${JSON.stringify(state.microRhetoricsSelection?.selections, null, 2)}

Verifier repairs applied:
${JSON.stringify(state.verifierReport?.repairs, null, 2)}

Rhetoric critique:
Alignment score: ${state.rhetoricCritique?.alignment_score ?? "N/A"}
Interpretation: ${state.rhetoricCritique?.interpretation ?? "N/A"}

Generate the complete XML game specification now.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);

  // Strip markdown fences if LLM added them despite instructions
  const cleaned = raw
    .replace(/^```xml\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const xmlOutput = validateXml(cleaned) ? cleaned : serializeToXml(state);

  return { ...state, step: 7, xmlOutput };
}

// --- Pure helper: apply a list of repair/suggestion actions to entityAttributeState and recipeSelection ---

function applyActions(
  entityAttributeState: EntityAttributeState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recipeSelection: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: any[]
): { entityAttributeState: EntityAttributeState; recipeSelection: typeof recipeSelection } {
  let updatedAttrs: EntityAttributeState = { ...entityAttributeState };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updatedRecipe: any = { ...recipeSelection };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const action of actions as any[]) {
    switch (action.operator) {
      case "AlterAttribute": {
        if (action.conditionField && action.conditionValue) {
          updatedRecipe = { ...updatedRecipe, [action.conditionField]: action.conditionValue };
        } else if (action.target && action.attribute !== undefined) {
          updatedAttrs = {
            ...updatedAttrs,
            [action.target]: {
              ...(updatedAttrs[action.target] ?? {}),
              [action.attribute]: action.attributeValue,
            },
          };
        }
        break;
      }
      case "AdjustParameter": {
        if (action.target && action.parameter !== undefined) {
          updatedAttrs = {
            ...updatedAttrs,
            [action.target]: {
              ...(updatedAttrs[action.target] ?? {}),
              [action.parameter]: action.value,
            },
          };
        }
        break;
      }
      case "AssignPlayer": {
        if (action.target) {
          const cleared: EntityAttributeState = {};
          for (const [entity, attrs] of Object.entries(updatedAttrs)) {
            cleared[entity] = { ...attrs, isPlayer: entity === action.target };
          }
          if (cleared[action.target]) {
            cleared[action.target] = { ...cleared[action.target], movesAnyWay: true };
          }
          updatedAttrs = cleared;
        }
        break;
      }
    }
  }

  return { entityAttributeState: updatedAttrs, recipeSelection: updatedRecipe };
}

function applyVerifierRepairs(
  entityAttributeState: EntityAttributeState,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recipeSelection: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verifierReport: any
): { entityAttributeState: EntityAttributeState; recipeSelection: typeof recipeSelection } {
  const repairs: unknown[] = verifierReport?.repairs ?? [];
  const suggestions: unknown[] = verifierReport?.suggestions ?? [];
  const allActions = [...repairs, ...suggestions];

  if (allActions.length === 0) {
    return { entityAttributeState, recipeSelection };
  }

  return applyActions(entityAttributeState, recipeSelection, allActions);
}

// --- Utility: safe JSON parse with descriptive error ---

function parseJson<T>(raw: string, agentLabel: string): T {
  // Strip any accidental markdown fences
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
