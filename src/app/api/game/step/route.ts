import { NextRequest, NextResponse } from "next/server";
import { buildGraph, runGraph } from "@/lib/graph";
import { human, getLastMessageContent } from "@/utils/messages";
import {
  buildNewsToConceptAgent,
  buildAuthoringAgent,
  buildMicroRhetoricAgent,
  buildEntityAttributeAgent,
  buildRecipeAgent,
  buildVerifierAgent,
  buildRhetoricCriticAgent,
  buildXmlGenerationAgent,
} from "@/lib/game/agents";
import { validateXml, extractXml } from "@/lib/game/xml-generator";
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

// --- Pipeline definition ---
// To add, remove, or reorder steps: edit ONLY this array.
// Step numbers are derived from array position (index + 1).
// Runner functions are declared below and hoisted, so forward references are safe.

type StepDefinition = {
  name: string;
  requires: (keyof GameState)[];
  run: (state: GameState) => Promise<GameState>;
};

const PIPELINE: StepDefinition[] = [
  {
    name: "News → Concept Map",
    requires: [],
    run: runNewsToConceptMap,
  },
  {
    name: "Authoring",
    requires: [],
    run: runAuthoring,
  },
  {
    name: "Micro-Rhetoric",
    requires: ["conceptGraph"],
    run: runMicroRhetoric,
  },
  {
    name: "Entity Attributes",
    requires: ["conceptGraph", "microRhetoricsSelection"],
    run: runEntityAttributes,
  },
  {
    name: "Recipe Selection",
    requires: ["conceptGraph", "microRhetoricsSelection"],
    run: runRecipeSelection,
  },
  {
    name: "Verifier",
    requires: ["conceptGraph", "microRhetoricsSelection", "entityAttributeState", "recipeSelection"],
    run: runVerifier,
  },
  {
    name: "Rhetoric Critic",
    requires: ["entityAttributeState", "recipeSelection", "verifierReport"],
    run: runRhetoricCritic,
  },
  {
    name: "XML Generation",
    requires: ["entityAttributeState", "recipeSelection"],
    run: runXmlGeneration,
  },
];

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

    if (!step || step < 1 || step > PIPELINE.length) {
      return NextResponse.json(
        { state, error: `Invalid step number. Must be between 1 and ${PIPELINE.length}.` },
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
  const def = PIPELINE[step - 1];
  if (!def) throw new Error(`Unhandled step: ${step}`);

  const missing = def.requires.filter((k) => state[k] == null);
  if (missing.length > 0) {
    throw new Error(`${def.name} requires the following fields from previous steps: ${missing.join(", ")}.`);
  }

  const updated = await def.run(state);
  return { ...updated, step };
}

// --- Per-step runners ---

async function runNewsToConceptMap(state: GameState): Promise<GameState> {
  const agentNode = buildNewsToConceptAgent();
  const graph = buildGraph({
    nodes: [{ name: "newsToConcept", fn: agentNode }],
    edges: [{ from: "newsToConcept", to: "END" }],
    entryPoint: "newsToConcept",
  });

  const source = state.initialInput ?? state.input;
  const finalState = await runGraph(graph, {
    messages: [human(source)],
  });

  const conceptMapText = getLastMessageContent(finalState.messages).trim();
  return { ...state, input: conceptMapText };
}

async function runAuthoring(state: GameState): Promise<GameState> {
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

  return { ...state, conceptGraph };
}

async function runMicroRhetoric(state: GameState): Promise<GameState> {
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

  return { ...state, microRhetoricsSelection };
}

async function runEntityAttributes(state: GameState): Promise<GameState> {
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

  return { ...state, entityAttributeState: parsed.entityAttributeState };
}

async function runRecipeSelection(state: GameState): Promise<GameState> {
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

  return { ...state, recipeSelection };
}

async function runVerifier(state: GameState): Promise<GameState> {
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
    state.entityAttributeState!,
    state.recipeSelection,
    verifierReport
  );

  return {
    ...state,
    entityAttributeState,
    recipeSelection,
    verifierReport,
  };
}

async function runRhetoricCritic(state: GameState): Promise<GameState> {
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

  return { ...state, rhetoricCritique };
}

async function runXmlGeneration(state: GameState): Promise<GameState> {
  const agentNode = buildXmlGenerationAgent();
  const graph = buildGraph({
    nodes: [{ name: "xmlGen", fn: agentNode }],
    edges: [{ from: "xmlGen", to: "END" }],
    entryPoint: "xmlGen",
  });

  const humanMsg = `Original user concept: ${state.input}

Entity attribute state (all entities and their mechanics — derive all components and behaviors from this):
${JSON.stringify(state.entityAttributeState, null, 2)}

Recipe selection:
${JSON.stringify(state.recipeSelection, null, 2)}

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
  const cleaned = extractXml(raw);

  if (!validateXml(cleaned)) {
    throw new Error("XML generation agent produced invalid output.");
  }

  return { ...state, xmlOutput: cleaned };
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

  if (repairs.length === 0) {
    return { entityAttributeState, recipeSelection };
  }

  return applyActions(entityAttributeState, recipeSelection, repairs);
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
