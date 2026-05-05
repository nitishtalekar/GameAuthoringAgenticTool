import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";
import {
  formatBehaviorRhetoricsForPrompt,
  formatInteractionRhetoricsForPrompt,
} from "@/data/micro-rhetorics";
import { formatWinRecipesForPrompt, formatLoseRecipesForPrompt } from "@/data/recipes";

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
 * - Numeric parameters for each entity (speed, size, spawnRate, etc.)
 * - Automatically selects which entity is the player based on concept semantics
 */
export function buildRhetoricAssignmentAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const behaviorList = formatBehaviorRhetoricsForPrompt();
  const interactionList = formatInteractionRhetoricsForPrompt();

  const systemPrompt = `Assign behavior and interaction rhetorics to a concept map (entities + SVO relations).

BEHAVIOR RHETORICS (each lists its required and optional properties):
${behaviorList}

INTERACTION RHETORICS (each lists its required and optional properties):
${interactionList}

RULES:
- CRITICAL: Exactly one behavior across ALL entityBehaviors must have behaviorType="player_controlled". No more, no less. Pick the entity the player most naturally controls (the one taking action or being controlled in the concept).
- Assign one or more behaviors per entity based on its role; every entity except the player-controlled one gets a non-player behavior.
- For every assigned behavior, populate ALL required properties listed for that behaviorType. Use reasonable thematic values for optional properties.
  - chase → properties.target must be the id of the entity being chased.
  - spawn_on_timer → properties.spawnAt must be an object with an anchor field. Supported anchors: "center" (no extras), "top"/"bottom"/"left"/"right" (optional offset), "xy" (required x and y numbers), "random_canvas" (optional margin), "random_edge" (optional offset), "near_entity" (required entity string and offsetRadius number).
  - grow_over_time → properties.property must be "size".
- Assign one or more interactions per SVO relation; entityA = subject, entityB = object.
- For every assigned interaction, populate ALL required properties listed for that interactionType.
  - damage_on_item → options.item (inventory item id) and options.amount (number) are required.
- Match verb semantics to the closest rhetoric using the tags and descriptions.

OUTPUT: valid JSON only — no prose, no markdown fences:
{
  "entityBehaviors": [
    {
      "entity": "string",
      "behaviorType": "string",
      "clampToCanvas": true,
      "properties": {}
    }
  ],
  "entityInteractions": [
    {
      "entityA": "string",
      "entityB": "string",
      "interactionType": "string",
      "options": {}
    }
  ]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Step 3 — Recipe Selection Agent
 *
 * Selects at least one win recipe and at least one lose recipe.
 * Can select multiple conditions; ANY ONE triggers the outcome.
 */
export function buildRecipeSelectionAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const winRecipes = formatWinRecipesForPrompt();
  const loseRecipes = formatLoseRecipesForPrompt();

  const systemPrompt = `Select win and lose end conditions for a game given its concept, behaviors, and interactions.

Each recipe below lists its condition type and ALL required fields you must populate.

WIN RECIPES:
${winRecipes}

LOSE RECIPES:
${loseRecipes}

RULES:
- Select at least one win and at least one lose condition; any single condition firing ends the game.
- Win and lose conditions must not fire on the same game state.
- For every selected recipe, populate ALL required condition fields listed under "Condition fields". Use entity ids from the concept map.
- operator values: use ">=" or ">" for "must reach or exceed", "<=" or "<" for "must fall to or below".
- id must be a unique snake_case string.

OUTPUT: valid JSON only — no prose, no markdown fences:
{
  "winConditions": [
    {
      "id": "string",
      "recipe": "string",
      "type": "entity_property_threshold | entity_count_threshold | timer_elapsed",
      "properties": { "entity": "string", "property": "size", "operator": "string", "value": 0 },
      "message": "string"
    }
  ],
  "loseConditions": [
    {
      "id": "string",
      "recipe": "string",
      "type": "entity_property_threshold | entity_count_threshold | timer_elapsed",
      "properties": { "entity": "string", "property": "size", "operator": "string", "value": 0 },
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
 * Output matches the game-config-samples/ schema exactly.
 */
export function buildGameJsonAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });

  const systemPrompt = `Convert the final game specification into a complete game-config JSON. Output valid JSON only — no prose, no markdown fences.

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
