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
- Produce 2–6 short subject-verb-object concept sentences, one per line, that capture the key relationships.
- Each sentence must follow the pattern: "Subject verb Object." (e.g. "Police arrests Occupier.")
- Use simple present-tense verbs. Capitalize entity names (e.g. "Police", "WallStreet", "Occupier").
- Entities must be 2–6 unique proper nouns or capitalised common nouns.
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

  const systemPrompt = `You are a rhetoric assignment agent for the Game-Authoring-Tool system.
Given a concept map (entities + SVO relations), assign one behavior rhetoric to each entity and one interaction rhetoric to each SVO relation.

AVAILABLE BEHAVIOR RHETORICS (assign exactly one per entity):
${behaviorList}

AVAILABLE INTERACTION RHETORICS (assign exactly one per SVO relation):
${interactionList}

BEHAVIOR ASSIGNMENT RULES:
1. Exactly one entity must have isPlayer=true — choose the entity the reader most naturally identifies with or controls.
2. The player entity must receive behaviorType="player_controlled".
3. Entities that chase the player → behaviorType="chase", set target to the player entity name.
4. Entities that grow autonomously → behaviorType="grow_over_time".
5. Entities that appear periodically → behaviorType="spawn_on_timer".
6. An entity may have BOTH a behavior (e.g. "chase") AND a spawn_on_timer behavior — list it twice in entityBehaviors if needed.

NUMERIC PARAMETER RULES — choose values that fit the entity's role:
- speed (player): 200–260 px/s. Use "speed" field.
- speedMin/speedMax (chasing enemies): 100–200 px/s range.
- initialSize (player): 22–36 px. minSize: 8–16 px. maxSize: 60–90 px.
- size (static/spawned entities): 14–36 px.
- spawnIntervalMs: 1000–4000 ms. spawnMax: 2–8.
- growRate (grow_over_time): 1.0–3.0 px/s.
- clampToCanvas: true for the player entity, false for enemies.

INTERACTION ASSIGNMENT RULES:
- Match the SVO verb semantics to the closest interaction rhetoric.
- entityA is the subject of the relation (the actor), entityB is the object.
- For "damage_on_item" interactions, include item (inventory item name) and amount=1.
- If a verb is ambiguous, prefer the simpler interaction (e.g. "consume" over "collect").

OUTPUT: Respond ONLY with valid JSON — no prose, no markdown fences, no extra text:
{
  "entityBehaviors": [
    {
      "entity": "string",
      "isPlayer": true,
      "behaviorType": "player_controlled",
      "speed": 230,
      "initialSize": 22,
      "minSize": 10,
      "maxSize": 80,
      "clampToCanvas": true
    },
    {
      "entity": "string",
      "isPlayer": false,
      "behaviorType": "chase",
      "target": "PlayerEntityName",
      "speedMin": 140,
      "speedMax": 185,
      "size": 20,
      "clampToCanvas": false
    },
    {
      "entity": "string",
      "isPlayer": false,
      "behaviorType": "spawn_on_timer",
      "size": 32,
      "spawnIntervalMs": 1800,
      "spawnMax": 4
    }
  ],
  "entityInteractions": [
    { "entityA": "string", "entityB": "string", "interactionType": "consume" },
    { "entityA": "string", "entityB": "string", "interactionType": "damage" }
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

  const systemPrompt = `You are a recipe selection agent for the Game-Authoring-Tool system.
Given the concept, entity behaviors, and entity interactions, select at least one win condition and at least one lose condition.
You may select multiple win or lose conditions — any ONE firing ends the game.

WIN RECIPES:
${winRecipes}

LOSE RECIPES:
${loseRecipes}

END CONDITION TYPES AND FIELDS:
- "entity_property_threshold": { entity, property ("size"), operator (">="|"<="), value (number) }
- "entity_count_threshold": { entity, operator ("<="), value (number) } — use for counting alive instances
- "timer_elapsed": { seconds (number) }

RECIPE-TO-CONDITION MAPPING:
- "Grow Beyond Size" → type="entity_property_threshold", property="size", operator=">=", value=player maxSize
- "Neutralize Threat" → type="entity_property_threshold", property="size", operator="<=", value=0 (on threat entity)
- "Protect All Assets" → type="entity_count_threshold", operator="<=", value=0 (on protected entity), result=lost
- "Survive Duration" → type="timer_elapsed", seconds=60 or 90
- "Size Depleted" → type="entity_property_threshold", property="size", operator="<=", value=player minSize
- "Timer Expired" → type="timer_elapsed", seconds=60 or 90
- "Assets Destroyed" → type="entity_count_threshold", operator="<=", value=0 (on protected entity)
- "Player Overwhelmed" → type="entity_property_threshold", property="size", operator="<=", value=player minSize

RULES:
- Select at least one winCondition and at least one loseCondition.
- Win and lose conditions must be for DIFFERENT events — they cannot both fire at the same game state.
- Choose timer durations (60s or 90s) consistently — if a win uses 90s, a lose timer must differ.
- message must be a short, thematically fitting outcome string (e.g. "The Movement Won!").
- Each condition must have an "id" field: a short snake_case identifier (e.g. "movement_wins", "too_small").

OUTPUT: Respond ONLY with valid JSON — no prose, no markdown fences, no extra text:
{
  "winConditions": [
    {
      "id": "string",
      "recipe": "recipe name from WIN RECIPES",
      "type": "entity_property_threshold",
      "entity": "EntityName",
      "property": "size",
      "operator": ">=",
      "value": 80,
      "message": "string"
    }
  ],
  "loseConditions": [
    {
      "id": "string",
      "recipe": "recipe name from LOSE RECIPES",
      "type": "timer_elapsed",
      "seconds": 90,
      "message": "string"
    },
    {
      "id": "string",
      "recipe": "recipe name from LOSE RECIPES",
      "type": "entity_property_threshold",
      "entity": "EntityName",
      "property": "size",
      "operator": "<=",
      "value": 10,
      "message": "string"
    }
  ],
  "justification": "one paragraph explaining why these conditions fit the concept"
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

  const systemPrompt = `You are a rhetoric alignment critic for the Game-Authoring-Tool system.
Compare the original concept (what the author intended) against the selected rhetorics and recipes (what the game will simulate).
Evaluate how well the gameplay mechanics express the intended rhetorical meaning of the concept.

SCORING:
- alignmentScore is a float between 0.0 and 1.0, inclusive.
- Do NOT use round numbers — choose a precise value (e.g. 0.37, 0.61, 0.84).
- 0.0 = mechanics completely contradict the intended meaning
- 0.5 = mechanics are neutral or loosely related
- 1.0 = mechanics perfectly express the intended concept
- Most games should score between 0.2 and 0.9.

WHAT TO EVALUATE — ground every judgment in the concept's SVO relations:
1. Does each SVO relation map to a matching interaction rhetoric? (e.g. "arrests" → damage, "grows" → consume)
2. Do the win/lose conditions reflect the rhetorical arc the concept implies?
3. Are entity behaviors (player, chase, spawn) consistent with the roles described in the concept?
4. Does anything in the mechanics distort or contradict what the original text meant?

mismatches: specific places where mechanics diverge from the concept. Critique only — do NOT suggest fixes.
interpretation: a 1–2 paragraph summary of what the game currently expresses rhetorically, compared to the original concept.

OUTPUT: Respond ONLY with valid JSON — no prose, no markdown fences, no extra text:
{
  "alignmentScore": 0.0,
  "interpretation": "one to two paragraph summary",
  "mismatches": ["description of mismatch"]
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

  const systemPrompt = `You are a game-config JSON generation agent for the Game-Authoring-Tool system.
Convert the final game specification into a complete JSON config matching the schema below.
Output ONLY the JSON object — no prose, no markdown fences, no comments.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHEMA REFERENCE (from occupy-wall-street.json example):
{
  "meta": {
    "title": "Occupy Wall Street",
    "instructions": "Move with WASD or arrow keys. Collect Wall Street money to grow. Avoid the Police. Grow big enough to win!",
    "canvas": { "width": 900, "height": 600, "background": "#1a1a2e" }
  },
  "entities": [
    {
      "id": "occupier",
      "label": "OWS",
      "color": "#f59e0b",
      "initialSize": 22,
      "minSize": 10,
      "maxSize": 80,
      "initialPosition": { "anchor": "center" },
      "speed": 230
    },
    {
      "id": "wallstreet",
      "label": "$",
      "color": "#22c55e",
      "size": 32,
      "initialPosition": { "anchor": "none" },
      "speedMin": 0,
      "speedMax": 0
    },
    {
      "id": "police",
      "label": "PD",
      "color": "#3b82f6",
      "size": 20,
      "initialPosition": { "anchor": "none" },
      "speedMin": 140,
      "speedMax": 185
    }
  ],
  "behaviors": [
    { "entity": "occupier", "type": "player_controlled", "clampToCanvas": true },
    { "entity": "police", "type": "chase", "clampToCanvas": false, "properties": { "target": "occupier" } },
    { "entity": "wallstreet", "type": "spawn_on_timer", "properties": { "intervalMs": 1800, "max": 2, "spawnAt": { "anchor": "random_canvas", "margin": 30 }, "speedMin": 0, "speedMax": 0 } },
    { "entity": "police", "type": "spawn_on_timer", "properties": { "intervalMs": 3500, "max": 6, "spawnAt": { "anchor": "random_edge", "offset": 30 }, "speedMin": 140, "speedMax": 185 } }
  ],
  "interactions": [
    { "entityA": "occupier", "entityB": "wallstreet", "type": "consume" },
    { "entityA": "occupier", "entityB": "police", "type": "damage" }
  ],
  "endConditions": [
    { "id": "movement_wins", "type": "entity_property_threshold", "properties": { "entity": "occupier", "property": "size", "operator": ">=", "value": 80 }, "result": "won", "message": "The Movement Won!" },
    { "id": "time_runs_out", "type": "timer_elapsed", "properties": { "seconds": 90 }, "result": "lost", "message": "The Movement Was Crushed." },
    { "id": "too_small", "type": "entity_property_threshold", "properties": { "entity": "occupier", "property": "size", "operator": "<=", "value": 10 }, "result": "lost", "message": "The Movement Was Dispersed!" }
  ],
  "ui": {
    "statusBars": [
      { "label": "Movement", "source": "entity_size", "entity": "occupier", "color": "#f59e0b", "displayMode": "percent", "min": 10, "max": 80 },
      { "label": "Time Left", "source": "timer_remaining", "color": "#ef4444", "displayMode": "seconds", "total": 90 }
    ]
  }
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENERATION RULES:

META:
- title: short name derived from the concept entities and theme
- instructions: 1–2 sentences of player instruction reflecting the actual win/lose conditions
- canvas.background: a dark hex color thematically appropriate for the concept

ENTITIES:
- id: lowercased entity name (e.g. "occupier")
- label: 1–4 character abbreviation or symbol that fits the entity's theme
- color: a vivid, thematically appropriate hex color — each entity must have a DISTINCT color
- Player entity: use initialSize, minSize, maxSize, initialPosition.anchor="center", speed
- Chase/spawn entities: use size, initialPosition.anchor="none", speedMin/speedMax
- Static/grow entities: use initialSize, minSize, maxSize, initialPosition.anchor="fixed" with x/y coords
- Include maxInventory if the entity uses "collect" interaction (e.g. { "water": 5 })

BEHAVIORS:
- player_controlled: { entity, type: "player_controlled", clampToCanvas: true }
- chase: { entity, type: "chase", clampToCanvas: false, properties: { target: playerEntityId } }
- spawn_on_timer (for spawned enemies): { entity, type: "spawn_on_timer", properties: { intervalMs, max, spawnAt: { anchor: "random_edge", offset: 30 }, speedMin, speedMax } }
- spawn_on_timer (for collectibles): { entity, type: "spawn_on_timer", properties: { intervalMs, max, spawnAt: { anchor: "random_canvas", margin: 30 }, speedMin: 0, speedMax: 0 } }
- grow_over_time: { entity, type: "grow_over_time", properties: { property: "size", rate: N, clampToMax: true } }
- If an entity has BOTH chase and spawn_on_timer behaviors, emit BOTH behavior objects for that entity

INTERACTIONS:
- { entityA, entityB, type } where type is the interactionType from the rhetoric assignment
- For "damage_on_item": add options: { item: "itemName", amount: 1 }

END CONDITIONS:
- Emit all winConditions as result="won" and all loseConditions as result="lost"
- entity_property_threshold: wrap threshold fields in "properties": { entity, property, operator, value }
- entity_count_threshold: wrap in "properties": { entity, operator, value }
- timer_elapsed: wrap in "properties": { seconds }
- Each endCondition must have: id, type, properties, result, message

UI STATUS BARS:
- For player entity size: { label, source: "entity_size", entity: playerId, color: playerColor, displayMode: "percent", min: playerMinSize, max: playerMaxSize }
- For timers: { label: "Time Left", source: "timer_remaining", color: "#ef4444", displayMode: "seconds", total: timerSeconds }
- For inventory: { label, source: "entity_inventory_item", entity, item, min: 0, max: maxInventoryValue }
- For a threat entity size: { label, source: "entity_size", entity: threatId, color: threatColor, displayMode: "percent", min: 0, max: threatMaxSize }
- Include status bars for all meaningful game metrics visible to the player

IMPORTANT:
- Every entity from the rhetoric assignment must appear in the entities and behaviors arrays
- Entity IDs in behaviors/interactions must exactly match the entity "id" field (lowercased)
- Do NOT output XML comments or JavaScript comments — only valid JSON`;

  return buildAgentNode(llm, { systemPrompt });
}
