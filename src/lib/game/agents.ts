import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";
import {
  formatBehaviorRhetoricsForPrompt,
  formatInteractionRhetoricsForPrompt,
} from "@/data/micro-rhetorics";
import { formatWinRecipesForPrompt, formatLoseRecipesForPrompt } from "@/data/recipes";
import {
  formatBehaviorPropertySpecsForPrompt,
  formatInteractionPropertySpecsForPrompt,
} from "@/data/behavior-property-specs";

/**
 * Step 1 — Concept Extraction Agent
 *
 * Takes a raw news article (or any freeform text) and produces:
 * - 2–6 plain-English concept sentences (SVO form)
 * - a deduplicated list of entity names
 * - a structured list of subject-verb-object relations
 */
export function buildConceptExtractionAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });

  const systemPrompt = `You are a concept-extraction agent for the Game-Authoring-Tool system.
Your task is to read a news article (or any descriptive text) and distill it into a structured concept map.

RULES:
- Produce 2-6 short subject-verb-object concept sentences, one per line, that capture the key relationships.
- Each sentence must follow the pattern: "Subject verb Object." (e.g. "Police arrests Occupier.")
- Use simple present-tense verbs. Capitalize entity names (e.g. "Police", "WallStreet", "Occupier").
- Entities must be 2-6 unique proper nouns or capitalised common nouns.
- All entities that appear in relations must be in the entities list.
- Extract only the most important relationships; omit commentary, adjectives, and details.

OUTPUT: Respond ONLY with valid JSON — no prose, no markdown fences, no extra text:
{
  "conceptSentences": ["Subject verb Object.", "..."],
  "entities": ["EntityName", "..."],
  "relations": [
    { "subject": "string", "verb": "string", "object": "string" }
  ]
}

EXAMPLE INPUT:
On the six month anniversary of the Occupy Wall Street movement, protesters returned to New York's Zuccotti Park and several were arrested. The occupiers are obstructing Wall Street and are being arrested by police, but Wall Street is also growing the occupy movement.

EXAMPLE OUTPUT:
{
  "conceptSentences": ["Police arrests Occupier.", "Occupier obstructs WallStreet.", "WallStreet grows Occupier."],
  "entities": ["Police", "Occupier", "WallStreet"],
  "relations": [
    { "subject": "Police", "verb": "arrests", "object": "Occupier" },
    { "subject": "Occupier", "verb": "obstructs", "object": "WallStreet" },
    { "subject": "WallStreet", "verb": "grows", "object": "Occupier" }
  ]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Step 2 — Rhetoric Assignment Agent
 *
 * Takes the structured concept data (entities + SVO relations) and assigns:
 * - One behavior rhetoric per entity (from BEHAVIOR_RHETORICS)
 * - One interaction rhetoric per SVO relation (from INTERACTION_RHETORICS)
 * - Automatically selects which entity is the player based on concept semantics
 *
 * Does NOT assign numeric parameters — that is Step 5's responsibility.
 */
export function buildRhetoricAssignmentAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const behaviorList = formatBehaviorRhetoricsForPrompt();
  const interactionList = formatInteractionRhetoricsForPrompt();

  const systemPrompt = `Assign behavior and interaction rhetorics to a concept map (entities + SVO relations).
Your only job is to choose the most semantically fitting rhetoric type for each entity and relation.
Do NOT assign numeric values, speeds, sizes, or configuration properties — those are handled later.

BEHAVIOR RHETORICS:
${behaviorList}

INTERACTION RHETORICS:
${interactionList}

RULES:
- CRITICAL: Exactly one behavior across ALL entityBehaviors must have isPlayer=true. Pick the entity the player most naturally controls (the one taking action or being controlled in the concept).
- Assign exactly one behaviorType per entity based on its conceptual role.
- Assign exactly one interactionType per SVO relation; entityA = subject, entityB = object.
- Match verb semantics to the closest rhetoric using the tags and descriptions above.
- Output only the type identifiers — no properties, no numeric values.

OUTPUT: valid JSON only — no prose, no markdown fences:
{
  "entityBehaviors": [
    {
      "entity": "string",
      "isPlayer": true,
      "behaviorType": "string",
      "clampToCanvas": true
    }
  ],
  "entityInteractions": [
    {
      "entityA": "string",
      "entityB": "string",
      "interactionType": "string"
    }
  ]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Step 3 — Recipe Selection Agent
 *
 * Selects at least one win recipe and at least one lose recipe based on concept semantics.
 * Does NOT populate condition field values — that is Step 5's responsibility.
 */
export function buildRecipeSelectionAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const winRecipes = formatWinRecipesForPrompt();
  const loseRecipes = formatLoseRecipesForPrompt();

  const systemPrompt = `Select win and lose end conditions for a game given its concept, behaviors, and interactions.
Your only job is to pick the most thematically fitting recipe name and condition type.
Do NOT assign entity ids, property names, operators, or numeric values — those are handled later.

WIN RECIPES:
${winRecipes}

LOSE RECIPES:
${loseRecipes}

RULES:
- Select at least one win and at least one lose condition; any single condition firing ends the game.
- Win and lose conditions must not logically fire on the same game state.
- If a recipe lists a required interaction type, only select it when that interaction type is present in the rhetoric assignment.
- id must be a unique snake_case string.

OUTPUT: valid JSON only — no prose, no markdown fences:
{
  "winConditions": [
    {
      "id": "string",
      "recipe": "string",
      "type": "entity_property_threshold | entity_count_threshold | timer_elapsed",
      "message": "string"
    }
  ],
  "loseConditions": [
    {
      "id": "string",
      "recipe": "string",
      "type": "entity_property_threshold | entity_count_threshold | timer_elapsed",
      "message": "string"
    }
  ],
  "justification": "one paragraph explaining the choices"
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Step 4 — Alignment Rating Agent
 *
 * Evaluates how well the selected rhetorics and recipes express the original concept.
 * Produces a numeric alignment score (0.0–1.0) and critique.
 * Does NOT repair or alter any state.
 */
export function buildAlignmentRatingAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.7 });

  const systemPrompt = `Score how well the assigned rhetorics and recipes express the original concept's SVO relations.

alignmentScore: float 0.0–1.0 (avoid round numbers). 0 = contradicts meaning, 1 = perfect expression.
mismatches: specific divergences between mechanics and concept. Critique only — no fixes.
interpretation: 1–2 paragraphs on what the game rhetorically expresses vs. the original concept.

OUTPUT: valid JSON only — no prose, no markdown fences:
{
  "alignmentScore": 0.0,
  "interpretation": "string",
  "mismatches": ["string"]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Step 5 — Game JSON Generation Agent
 *
 * Assembles the final game config JSON from all prior pipeline state.
 * Responsible for assigning ALL numeric values (speeds, sizes, timers, thresholds, etc.)
 * using the property reference below. Output matches the game-config-samples/ schema exactly.
 */
export function buildGameJsonAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });
  const behaviorPropertySpecs = formatBehaviorPropertySpecsForPrompt();
  const interactionPropertySpecs = formatInteractionPropertySpecsForPrompt();

  const systemPrompt = `Convert the final game specification into a complete game-config JSON. Output valid JSON only — no prose, no markdown fences.

You receive the concept, rhetoric assignment (behavior/interaction types only), and recipe selection (condition types only).
YOUR JOB: populate all numeric values, entity sizes, speeds, spawn parameters, condition thresholds, and inventory fields
using the PROPERTY REFERENCE below. Pick values within the stated ranges to make the game feel balanced and playable.

NUMERIC CONSTRAINTS (non-negotiable):
- All speeds (speed, speedMin, speedMax): 50–200
- Spawn intervalMs: 1000–4000
- Spawn max (live instances): 3–10
- SpawnAt offset / margin: 20–40
- Player initialSize: 50–120 | minSize: 10–30 | maxSize: 200–400
- Grow rate: 5–20 (size units per second)
- Inventory slot max: 5–20
- Timer durations: 30–120 seconds
- Win/lose size thresholds must fall within the entity's minSize–maxSize range

PROPERTY REFERENCE — BEHAVIORS:
${behaviorPropertySpecs}

PROPERTY REFERENCE — INTERACTIONS:
${interactionPropertySpecs}

SCHEMA:
{
  "meta": {
    "title": "string",                          // short thematic title
    "instructions": "string",                   // 1–2 sentences reflecting actual win/lose conditions
    "canvas": { "width": 900, "height": 600, "background": "#hex" }  // dark thematic bg
  },
  "entities": [
    {
      "id": "lowercased_entity_name",
      "label": "1–4 char symbol",
      "color": "#hex",                          // distinct vivid color per entity
      // player entity: initialSize, minSize, maxSize, speed, initialPosition.anchor="center"
      // spawned/chase entities: size, speedMin, speedMax, initialPosition.anchor="none"
      // grow entities: initialSize, minSize, maxSize, initialPosition.anchor="fixed" + x/y
      // if entity uses "collect" interaction: maxInventory: { "itemName": N }
    }
  ],
  "behaviors": [
    // player_controlled: { entity, type, clampToCanvas: true }
    // chase: { entity, type, clampToCanvas: false, properties: { target: "playerEntityId" } }
    // spawn_on_timer (enemy): { entity, type, properties: { intervalMs, max, spawnAt: { anchor: "random_edge", offset: 30 }, speedMin, speedMax } }
    // spawn_on_timer (collectible): { entity, type, properties: { intervalMs, max, spawnAt: { anchor: "random_canvas", margin: 30 }, speedMin: 0, speedMax: 0 } }
    // spawn_on_start (static/fixed-count): { entity, type, properties: { count: N, spawnAt: { anchor: "random_canvas", margin: 30 } } }
    // grow_over_time: { entity, type, properties: { property: "size", rate: N, clampToMax: true } }
    // emit one behavior object per behavior per entity
  ],
  "interactions": [
    { "entityA": "string", "entityB": "string", "type": "interactionType" }
    // damage_on_item: add "options": { "item": "itemName", "amount": 1 }
  ],
  "endConditions": [
    // winConditions → result: "won", loseConditions → result: "lost"
    // entity_property_threshold: { id, type, properties: { entity, property, operator, value }, result, message }
    // entity_count_threshold: { id, type, properties: { entity, operator, value }, result, message }
    // timer_elapsed: { id, type, properties: { seconds }, result, message }
    // Derive entity ids and threshold values from the concept data and entity definitions above
    // operator: ">=" or ">" for reach/exceed thresholds; "<=" or "<" for fall-to thresholds
  ],
  "ui": {
    "statusBars": [
      // player size: { label, source: "entity_size", entity, color, displayMode: "percent", min, max }
      // timer: { label: "Time Left", source: "timer_remaining", color: "#ef4444", displayMode: "seconds", total }
      // inventory: { label, source: "entity_inventory_item", entity, item, min: 0, max }
      // include a bar for every meaningful metric visible to the player
    ]
  }
}`;

  return buildAgentNode(llm, { systemPrompt });
}
