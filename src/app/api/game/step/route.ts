import { NextRequest, NextResponse } from "next/server";
import { buildGraph, runGraph } from "@/lib/graph";
import { human, getLastMessageContent } from "@/utils/messages";
import {
  buildConceptExtractionAgent,
  buildRhetoricAssignmentAgent,
  buildRecipeSelectionAgent,
  buildAlignmentRatingAgent,
  buildGameJsonAgent,
} from "@/lib/game/agents";
import type {
  StepRequest,
  StepResponse,
  GameState,
  ConceptData,
  RhetoricAssignment,
  RecipeOutput,
  AlignmentRating,
} from "@/lib/game/types";

// Required: LangChain uses Node.js built-ins incompatible with the Edge runtime.
export const runtime = "nodejs";

// --- Pipeline definition ---

type StepDefinition = {
  name: string;
  requires: (keyof GameState)[];
  run: (state: GameState) => Promise<GameState>;
};

const PIPELINE: StepDefinition[] = [
  {
    name: "Concept Extraction",
    requires: [],
    run: runConceptExtraction,
  },
  {
    name: "Rhetoric Assignment",
    requires: ["conceptData"],
    run: runRhetoricAssignment,
  },
  {
    name: "Recipe Selection",
    requires: ["conceptData", "rhetoricAssignment"],
    run: runRecipeSelection,
  },
  {
    name: "Alignment Rating",
    requires: ["conceptData", "rhetoricAssignment", "recipeOutput"],
    run: runAlignmentRating,
  },
  {
    name: "Game JSON Generation",
    requires: ["conceptData", "rhetoricAssignment", "recipeOutput"],
    run: runGameJsonGeneration,
  },
];

/**
 * POST /api/game/step
 *
 * Body:    { step: number, state: GameState }
 * Returns: { state: GameState, error?: string }
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
    throw new Error(
      `${def.name} requires the following fields from previous steps: ${missing.join(", ")}.`
    );
  }

  const updated = await def.run(state);
  return { ...updated, step };
}

// --- Per-step runners ---

async function runConceptExtraction(state: GameState): Promise<GameState> {
  const agentNode = buildConceptExtractionAgent();
  const graph = buildGraph({
    nodes: [{ name: "conceptExtraction", fn: agentNode }],
    edges: [{ from: "conceptExtraction", to: "END" }],
    entryPoint: "conceptExtraction",
  });

  const source = state.initialInput ?? "";
  const finalState = await runGraph(graph, {
    messages: [human(source)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const conceptData = parseJson<ConceptData>(raw, "Step 1 (Concept Extraction)");

  return { ...state, conceptData };
}

async function runRhetoricAssignment(state: GameState): Promise<GameState> {
  const agentNode = buildRhetoricAssignmentAgent();
  const graph = buildGraph({
    nodes: [{ name: "rhetoricAssignment", fn: agentNode }],
    edges: [{ from: "rhetoricAssignment", to: "END" }],
    entryPoint: "rhetoricAssignment",
  });

  const humanMsg = `Original user concept:
"${state.initialInput}"

Concept data extracted in Step 1:
${JSON.stringify(state.conceptData, null, 2)}

Assign one behavior rhetoric per entity and one interaction rhetoric per SVO relation.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const rhetoricAssignment = parseJson<RhetoricAssignment>(raw, "Step 2 (Rhetoric Assignment)");

  return { ...state, rhetoricAssignment };
}

async function runRecipeSelection(state: GameState): Promise<GameState> {
  const agentNode = buildRecipeSelectionAgent();
  const graph = buildGraph({
    nodes: [{ name: "recipeSelection", fn: agentNode }],
    edges: [{ from: "recipeSelection", to: "END" }],
    entryPoint: "recipeSelection",
  });

  const humanMsg = `Original user concept:
"${state.initialInput}"

Concept data (entities and SVO relations):
${JSON.stringify(state.conceptData, null, 2)}

Rhetoric assignment (entity behaviors and interactions):
${JSON.stringify(state.rhetoricAssignment, null, 2)}

Select at least one win condition and at least one lose condition for this game.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const recipeOutput = parseJson<RecipeOutput>(raw, "Step 3 (Recipe Selection)");

  return { ...state, recipeOutput };
}

async function runAlignmentRating(state: GameState): Promise<GameState> {
  const agentNode = buildAlignmentRatingAgent();
  const graph = buildGraph({
    nodes: [{ name: "alignmentRating", fn: agentNode }],
    edges: [{ from: "alignmentRating", to: "END" }],
    entryPoint: "alignmentRating",
  });

  const humanMsg = `Original user concept (intended meaning):
"${state.initialInput}"

Concept data (SVO relations defining the intended meaning):
${JSON.stringify(state.conceptData, null, 2)}

Rhetoric assignment (entity behaviors and interactions selected):
${JSON.stringify(state.rhetoricAssignment, null, 2)}

Recipe output (win/lose conditions selected):
${JSON.stringify(state.recipeOutput, null, 2)}

Rate how well the selected rhetorics and recipes express the intended rhetorical meaning of the concept.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const alignmentRating = parseJson<AlignmentRating>(raw, "Step 4 (Alignment Rating)");

  return { ...state, alignmentRating };
}

async function runGameJsonGeneration(state: GameState): Promise<GameState> {
  const agentNode = buildGameJsonAgent();
  const graph = buildGraph({
    nodes: [{ name: "gameJsonGen", fn: agentNode }],
    edges: [{ from: "gameJsonGen", to: "END" }],
    entryPoint: "gameJsonGen",
  });

  const humanMsg = `Original user concept:
"${state.initialInput}"

Concept data:
${JSON.stringify(state.conceptData, null, 2)}

Rhetoric assignment (entity behaviors and interactions):
${JSON.stringify(state.rhetoricAssignment, null, 2)}

Recipe output (win/lose conditions):
${JSON.stringify(state.recipeOutput, null, 2)}

Alignment rating (for metadata context only — do not alter the above):
${JSON.stringify(state.alignmentRating, null, 2)}

Generate the complete game config JSON now.`;

  const finalState = await runGraph(graph, {
    messages: [human(humanMsg)],
  });

  const raw = getLastMessageContent(finalState.messages);
  const cleaned = stripJsonFences(raw);

  // Validate it is parseable JSON
  try {
    JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Step 5 (Game JSON Generation) produced invalid JSON. First 300 chars: ${cleaned.slice(0, 300)}`
    );
  }

  return { ...state, gameJsonOutput: cleaned };
}

// --- Utilities ---

function parseJson<T>(raw: string, agentLabel: string): T {
  const cleaned = stripJsonFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(
      `${agentLabel} returned invalid JSON. First 300 chars: ${cleaned.slice(0, 300)}`
    );
  }
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
