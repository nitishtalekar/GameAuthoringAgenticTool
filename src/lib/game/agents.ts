import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";
import {
  formatMicroRhetoricsForPrompt,
  formatBehaviorRhetoricsForPrompt,
  formatInteractionRhetoricsForPrompt,
} from "@/data/micro-rhetorics";
import { formatWinRecipesForPrompt, formatLoseRecipesForPrompt, formatRecipesForPrompt } from "@/data/recipes";

/**
 * News → Concept Map Agent
 *
 * Takes a raw news article (or any freeform text) and distills it into a
 * compact, structured concept map: 2–6 subject-verb-object sentences that
 * capture the key relationships described in the article.
 */
export function buildNewsToConceptAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });

  const systemPrompt = `You are a concept-map extraction agent for the Game-Authoring-Tool system.
Your task is to read a news article (or any descriptive text) and distill it into a compact concept map expressed as plain English sentences.

RULES:
- Output ONLY 2–6 short subject-verb-object sentences, one per line.
- Each sentence must follow the pattern: "Subject verb Object." (e.g. "Police arrests Occupier.")
- Use simple present-tense verbs.
- Entity names must be proper nouns or capitalised common nouns (e.g. "Police", "WallStreet", "Occupier").
- Capture only the most important relationships from the text — omit details, adjectives, and commentary.
- Do NOT output any prose, explanation, numbering, or markdown — only the sentences.

EXAMPLE INPUT:
On the six month anniversary of the Occupy Wall Street movement, protesters returned to New York's Zuccotti Park and several were arrested. The occupiers are obstructing Wall Street and are being arrested by police, but Wall Street is also growing the occupy movement.

EXAMPLE OUTPUT:
Police arrests Occupier. Occupier obstructs WallStreet. WallStreet grows Occupier.`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Authoring Agent
 *
 * Converts natural language concept map descriptions into a structured
 * ConceptGraph with entities and relations.
 */
export function buildAuthoringAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });

  const systemPrompt = `You are a structured concept-map extraction agent for the Game-Authoring-Tool system.
Your sole task is to parse a natural language description and extract entities (nouns) and relations (subject-verb-object triples).

RULES:
- Relations must be binary (exactly two nouns per relation)
- Use simple present-tense verbs
- Extract 2–6 entities maximum
- All entities mentioned in relations must appear in the entities list
- confidence is a float 0.0–1.0 reflecting your certainty in the extraction

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "entities": ["string"],
  "relations": [
    { "subject": "string", "verb": "string", "object": "string" }
  ],
  "confidence": 0.0
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Micro-Rhetoric Selection Agent
 *
 * Maps each verb relation in the concept graph to the most appropriate
 * micro-rhetoric from the static library.
 */
export function buildMicroRhetoricAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const library = formatMicroRhetoricsForPrompt();

  const systemPrompt = `You are a micro-rhetoric selection agent for the Game-Authoring-Tool system.
For each verb relation in the concept graph, select the most appropriate micro-rhetoric from the library below.

MICRO-RHETORIC LIBRARY:
${library}

RULES:
- Pick exactly one micro-rhetoric per relation
- Selection must be a name that exists in the library above
- The component field must be copied exactly from the library entry you selected
- Provide a one-sentence justification grounded in the verb's semantic meaning

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "selections": [
    {
      "relation": "Subject verb Object",
      "micro_rhetoric": "Name from library",
      "component": "ComponentName",
      "justification": "one sentence"
    }
  ]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Entity Attribute Agent
 *
 * Reads the concept graph and micro-rhetoric selections, then assigns
 * values for every predefined attribute to every entity in the game.
 * Produces the EntityAttributeState used by downstream agents.
 */
export function buildEntityAttributeAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });
  const behaviorList = formatBehaviorRhetoricsForPrompt();
  const interactionList = formatInteractionRhetoricsForPrompt();

  const systemPrompt = `You are an entity attribute assignment agent for the Game-Authoring-Tool system.
Given the original user concept, a concept graph, and micro-rhetoric selections, assign values for every predefined attribute to every entity.

AVAILABLE BEHAVIOR TYPES (single-entity):
${behaviorList}

AVAILABLE INTERACTION TYPES (two-entity collision effects):
${interactionList}

ASSIGNMENT RULES:
1. Every entity must have an entry with ALL attributes above — omitting a key is invalid.
2. boolean attributes: set to true or false only. Do not use strings or null.
3. entity-ref attributes: set to the exact name of another entity as it appears in the entities list, or null if the relationship does not apply.
4. Base your decisions PRIMARILY on the micro-rhetoric selections:
   - GrowOverTimeComponent   → growsOverTime: true
   - ShrinkOverTimeComponent → shrinksOverTime: true
   - StaticObstacleComponent → isStatic: true, movesAnyWay: false
   - Any movement component (HomingMovementComponent, FleeTargetComponent, RandomMovementComponent, PatrolBetweenPointsComponent, IncreaseSpeedOverTimeComponent) → movesAnyWay: true
   - Player-controlled entity → isPlayer: true, movesAnyWay: true
   - RemoveOnCollideComponent on subject S toward object O → O.isRemovedBy = "S"
   - GrowOnCollideComponent on subject S toward object O  → S.growsBy = "O"
   - ShrinkOnCollideComponent on subject S toward object O → S.shrinksBy = "O"
   - StopMovementOnCollideComponent on subject S toward object O → O.stopsBy = "S"
   - DamageOnCollideComponent on subject S toward object O → O.isDamagedBy = "S"
   - HomingMovementComponent on subject S targeting object O → O.chasedBy = "S"
   - FleeTargetComponent on subject S → S.isFleeing = true
5. Use the concept graph relations as secondary evidence to confirm or resolve ambiguities in entity-ref attributes.
6. Use the original user concept as the highest-level semantic guide — attributes must reflect the intended meaning of the concept, not just mechanical defaults.
7. Exactly one entity should have isPlayer: true. If unclear, pick the entity the player would most naturally control.
8. Do NOT set an attribute to true or a non-null entity ref unless it is clearly supported by a micro-rhetoric selection or the concept graph relation.

NUMERIC PARAMETER RULES (assign for every entity):
- speed (px/s): how fast the entity moves. Range 50–250. Player entities are typically slower (80–150) for controllability. Fast enemies/projectiles 150–250. Static entities use 0.
- size (px): visual/collision size. Range 16–64. Player ~32. Large obstacles ~48–64. Small collectibles/projectiles ~16–24.
- spawnRate (per/s): how often new instances of this entity spawn. Range 0.5–5.0. Player is unique, use 0. Rare heavy enemies ~0.5–1.0. Frequent small enemies ~2.0–5.0.
- Choose values that reflect the entity's role and the game concept — do NOT just use defaults.

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "entityAttributeState": {
    "EntityName": {
      "isPlayer": false,
      "isStatic": false,
      "movesAnyWay": false,
      "growsOverTime": false,
      "shrinksOverTime": false,
      "isRemovedBy": null,
      "growsBy": null,
      "shrinksBy": null,
      "stopsBy": null,
      "isDamagedBy": null,
      "chasedBy": null,
      "isFleeing": false,
      "speed": 100,
      "size": 32,
      "spawnRate": 1.5
    }
  }
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Recipe Selection Agent
 *
 * Selects win, lose, structure, and patch recipes based on the current
 * entity and component state.
 */
export function buildRecipeAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const winRecipes = formatWinRecipesForPrompt();
  const loseRecipes = formatLoseRecipesForPrompt();

  const systemPrompt = `You are a recipe selection agent for the Game-Authoring-Tool system.
Given the entity attribute state, select one win recipe and one lose recipe.
Then produce a concrete win_condition and lose_condition that reference the actual entities and interaction types from the entity attribute state.

WIN RECIPES:
${winRecipes}

LOSE RECIPES:
${loseRecipes}

RULES:
- Select exactly one win_recipe and one lose_recipe
- All selected names must come from the lists above exactly as written
- Choose recipes that match the interaction types present in the entity config

WIN_CONDITION AND LOSE_CONDITION RULES:
- Both must be derived directly from the entityAttributeState passed in the user message
- entity: must be an exact entity name from the entityAttributeState
- interactionType: the interaction type driving the condition — "consume", "damage", or null for timer-based
- value: a numeric threshold with unit suffix — size in pixels (e.g. "256px") for grow/shrink, seconds (e.g. "60s") for timers
- description: a plain-English constraint string (e.g. "Player grows to 256px by consuming Food", "Player size drops below 10px", "Player survives for 60s")
- Recipe-to-condition mapping:
    • "Grow Beyond Size" (win): entity = player entity, interactionType = "consume", value = size threshold in pixels (e.g. "256px")
    • "Survive Duration" (win): entity = player entity, interactionType = null, value = duration in seconds (e.g. "60s")
    • "Size Depleted" (lose): entity = player entity, interactionType = "damage", value = minimum size threshold in pixels (e.g. "10px")
    • "Timer Expired" (lose): entity = player entity, interactionType = null, value = timer duration in seconds (e.g. "60s")

CRITICAL — WIN AND LOSE CONDITIONS MUST BE MUTUALLY EXCLUSIVE:
The win and lose conditions must describe opposite outcomes. Verify before outputting that the win and lose events cannot both trigger for the same game state.

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "win_recipe": "recipe name",
  "lose_recipe": "recipe name",
  "win_condition": {
    "description": "Player grows to 256px by consuming Food",
    "entity": "Player",
    "interactionType": "consume",
    "value": "256px"
  },
  "lose_condition": {
    "description": "Player size drops below 10px",
    "entity": "Player",
    "interactionType": "damage",
    "value": "10px"
  },
  "justifications": {
    "win": "one sentence explaining which mechanic/entity triggers the win",
    "lose": "one sentence explaining which mechanic/entity triggers the lose"
  }
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Verifier / Repair Agent
 *
 * Verifies playability by checking entity attributes and win/lose conditions
 * against the original concept. Proposes and applies minimal repairs to
 * entityAttributeState and recipeSelection to ensure the game is playable.
 */
export function buildVerifierAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });
  const rhetoricLibrary = formatMicroRhetoricsForPrompt();

  const systemPrompt = `You are a playability verifier and repair agent for the Game-Authoring-Tool system.
You receive the original concept, entity attribute state, and recipe selection (win/lose conditions).
Your job is to verify the game is playable and propose targeted repairs if not.

ALLOWED REPAIR OPERATORS:
- AlterAttribute: change an attribute value on an entity in entityAttributeState
- AdjustParameter: change a numeric parameter on an entity (speed, size, spawnRate)
- AssignPlayer: mark an entity as the player (sets isPlayer=true on that entity's attributes)

AVAILABLE BEHAVIORS AND INTERACTIONS:
${rhetoricLibrary}

CONDITION VALUE TYPES — understand these before checking conditions:
All condition values are numeric thresholds with a unit suffix — pixels (e.g. "256px") for size-based conditions, seconds (e.g. "60s") for timer-based conditions. These are runtime thresholds evaluated by the game engine. Always treat well-formed threshold values as valid.

PLAYABILITY CHECKLIST — verify ALL of the following:
1. Exactly one entity has isPlayer=true in entityAttributeState
2. The player entity has a behavior of type "player_controlled"
3. The win_condition.entity exists in entityAttributeState
4. The win_condition.value is a valid threshold (ends with "px" or "s")
5. The lose_condition.entity exists in entityAttributeState
6. The lose_condition.value is a valid threshold (ends with "px" or "s")
7. Win and lose conditions do not trigger for the same game event (they must be distinct)
8. At least one non-player entity exists in the game
9. Numeric parameters are within reasonable ranges for every entity:
   - speed: 0–250 (0 for static; moving entities ≥ 50)
   - size: 16–64
   - spawnRate: 0–5.0 (0 for player; non-player entities ≥ 0.5)

REPAIR RULES:
- Propose ONLY the minimum repairs necessary
- AlterAttribute repairs: set "attribute" to the key and "attributeValue" to the new value
- AssignPlayer repairs: set "target" to the entity name
- Win/lose condition repairs: use operator="AlterAttribute" with conditionField="win_condition" or "lose_condition" and conditionValue containing the full updated condition object

If all checks pass, set isPlayable=true and return an empty repairs array.

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "isPlayable": true,
  "issues": ["description of each issue found"],
  "repairs": [
    {
      "operator": "AlterAttribute",
      "target": "EntityName",
      "attribute": "attributeKey",
      "attributeValue": true
    },
    {
      "operator": "AssignPlayer",
      "target": "EntityName"
    },
    {
      "operator": "AlterAttribute",
      "target": "win_condition",
      "conditionField": "win_condition",
      "conditionValue": {
        "description": "Player grows to 256px",
        "entity": "Player",
        "interactionType": "consume",
        "value": "256px"
      }
    },
    {
      "operator": "AdjustParameter",
      "target": "EntityName",
      "parameter": "speed",
      "value": 150
    }
  ],
  "repairsSummary": "Plain-English summary of all repairs applied (or 'No repairs needed' if none)."
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Rhetoric Critic Agent
 *
 * Evaluates whether the final mechanics express the intended rhetorical
 * meaning from the original concept map.
 */
export function buildRhetoricCriticAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.7 });
  const recipeLibrary = formatRecipesForPrompt();

  const systemPrompt = `You are a rhetoric critic agent for the Game-Authoring-Tool system.
Compare the original concept graph (what the author intended) against the final game mechanics (what the game actually simulates via entityAttributeState and recipeSelection).
Evaluate how well the gameplay mechanics express the intended rhetorical meaning.

SCORING:
- alignment_score is a float between 0.0 and 1.0, inclusive.
- Do NOT default to round numbers. Choose a precise, arbitrary value that reflects your nuanced assessment (e.g. 0.37, 0.61, 0.84).
- 0.0 = mechanics completely contradict the intended meaning
- 0.5 = mechanics are neutral or loosely related to the concept
- 1.0 = mechanics perfectly and clearly express the intended concept
- Use the full range. Most games should score between 0.2 and 0.9.

INPUTS YOU WILL RECEIVE:
- Original user concept (the intended rhetorical meaning)
- Original concept graph: entities and subject-verb-object relations that define the intended message
- entityAttributeState: per-entity attribute map reflecting the actual game mechanics
- recipeSelection: win/lose/structure recipes and concrete conditions

WHAT TO EVALUATE — ground every judgment in the concept graph:
1. For each relation in the concept graph (subject verb object), check whether the entityAttributeState encodes that relationship as a mechanical attribute (e.g. "A isRemovedBy B", "A isDamagedBy B"). Missing or inverted relationships are mismatches.
2. Do the win/lose conditions match the rhetorical arc implied by the concept graph? (e.g. if the concept says "Player destroys Asteroid", the win condition should reflect removal of Asteroids by the Player.)
3. Are there entity attributes set that have no corresponding relation in the concept graph? These dilute or distort the intended meaning.
4. Does the overall game mechanic convey the same message the author intended with the original concept?

mismatches: specific places where mechanics contradict or miss the intended idea — critique only, do NOT suggest fixes.

AVAILABLE RECIPES (for context):
${recipeLibrary}

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "alignment_score": 0.0,
  "interpretation": "one to two paragraph summary of what the game currently expresses rhetorically",
  "mismatches": ["description of mismatch"]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Rhetoric Swap Agent
 *
 * Applies suggested component swaps from the Rhetoric Critic to the entity
 * list, producing an updated EntitySpec[] with improved rhetorical alignment.
 */
export function buildRhetoricSwapAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });
  const componentLibrary = formatMicroRhetoricsForPrompt();

  const systemPrompt = `You are a rhetoric swap agent for the Game-Authoring-Tool system.
You are given a list of entities with their current components, and a list of suggested_swaps from the rhetoric critic.
Apply each swap: for the specified entity, replace the component named in "replace" with the component named in "with".
Only modify the components listed in the swaps. Preserve all other entity data (name, isPlayer, parameters) exactly as given.

AVAILABLE COMPONENTS (the "with" values must be exact component names from this list):
${componentLibrary}

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "entities": [
    {
      "name": "string",
      "isPlayer": true,
      "components": ["string"],
      "parameters": { "speed": 100, "size": 32, "spawnRate": 1.5 }
    }
  ]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * XML Generation Agent
 *
 * Converts the fully verified and critiqued game specification into a
 * well-formed XML document following the Game-Authoring-Tool schema.
 */
export function buildXmlGenerationAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });

  const systemPrompt = `You are an XML generation agent for the Game-Authoring-Tool engine.
Convert the final verified game specification into well-formed XML following the schema below.
Output ONLY the XML document — no prose, no code fences, no markdown, no additional commentary.

INPUTS YOU WILL RECEIVE:
- Original user concept (the rhetorical meaning of the game)
- entityAttributeState: map of entity name → attribute map (the sole source of truth for all entities and mechanics)
- recipeSelection: win/lose/structure/patch recipes plus concrete win_condition and lose_condition objects
- verifierReport: repairs that were applied (for audit trail only — do NOT re-apply them)
- rhetoricCritique: alignment_score and interpretation (for metadata only)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — EMIT ENTITY BEHAVIORS
For each entity in entityAttributeState, emit one <entity> element containing a self-closing <behavior> element.
The <behavior> element carries every boolean and entity-ref attribute from that entity's attribute map directly as XML attributes.
Include ALL of the following attributes on <behavior>, using the exact values from entityAttributeState:

  isPlayer="{true|false}"
  isStatic="{true|false}"
  movesAnyWay="{true|false}"
  growsOverTime="{true|false}"
  shrinksOverTime="{true|false}"
  isFleeing="{true|false}"

STEP 2 — DERIVE INTERACTIONS
For each non-null entity-ref attribute across all entities, emit one <interaction> element.
Map each attribute to its interaction type:

  A.isRemovedBy = B  → <interaction actor="B" target="A" attribute="isRemovedBy" />
  A.growsBy = B      → <interaction actor="A" target="B" attribute="growsBy" />
  A.shrinksBy = B    → <interaction actor="A" target="B" attribute="shrinksBy" />
  A.stopsBy = B      → <interaction actor="B" target="A" attribute="stopsBy" />
  A.isDamagedBy = B  → <interaction actor="B" target="A" attribute="isDamagedBy" />

STEP 3 — DERIVE WIN/LOSE CONDITIONS
Map recipeSelection.win_condition and lose_condition to XML using these rules:

  win_condition.attribute = "isRemovedBy"
    → <win recipe="{win_recipe}" trigger="score" threshold="10" entity="{win_condition.entity}" />
  win_condition.attribute = "growsOverTime" OR "growsBy"
    → <win recipe="{win_recipe}" trigger="size" threshold="{win_condition.value}" entity="{win_condition.entity}" />
  win_condition.attribute = "movesAnyWay" AND value ends in "s"
    → <win recipe="{win_recipe}" trigger="survive" duration="{win_condition.value}" entity="{win_condition.entity}" />

  lose_condition.attribute = "isDamagedBy"
    → <lose recipe="{lose_recipe}" trigger="health" points="3" entity="{lose_condition.entity}" />
  lose_condition.attribute = "isRemovedBy"
    → <lose recipe="{lose_recipe}" trigger="eliminated" entity="{lose_condition.entity}" />
  lose_condition.attribute = "movesAnyWay" AND value ends in "s"
    → <lose recipe="{lose_recipe}" trigger="timeout" duration="{lose_condition.value}" entity="{lose_condition.entity}" />

STEP 4 — DERIVE LAYOUT
For each non-player entity with spawnRate > 0, emit one <spawn> element.
interval: compute as 1 / spawnRate, rounded to 1 decimal place, with unit "s".

Assign zone based on the structure_recipe selected AND the entity's attributes, using these rules:

"Frogger Layout":
  - Player entity: zone="left"
  - All non-player entities: zone="right" (hazards enter from the right and move left across lanes)

"Asteroids Layout":
  - All non-player entities: zone="edges" (spawn from all four edges and drift inward)

"Space Invaders Layout":
  - All non-player entities: zone="top" (enemies arranged in grid at top)
  - Player entity spawns at: zone="bottom" (implicit, no <spawn> needed for player)

"Arena Layout":
  - All non-player entities: zone="edges" (converge from all sides toward center)

"Chase Layout":
  - Entity with chasedBy set (i.e. it is being chased): zone="center"
  - Entity that is doing the chasing (has movesAnyWay=true and isPlayer=false): zone="edges"
  - If isFleeing=true: zone="random"

"Tower Defense Layout":
  - All non-player entities following a path: zone="left" (enter from left, traverse to right)
  - Player-controlled interceptors: no spawn element

FALLBACK (if structure_recipe does not match any above):
  - isFleeing=true or chasedBy is not null → zone="random"
  - Otherwise → zone="top"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
XML SCHEMA (fill every placeholder — no comments in output):

<?xml version="1.0" encoding="UTF-8"?>
<game version="1.0">

  <metadata
    title="{short title derived from entity names and concept}"
    concept="{original concept map text verbatim}"
    howToPlay="{1–2 sentence player instruction based on player entity and win/lose conditions}"
    rhetoricTheme="{≤ 40 char label from rhetoric critique interpretation}"
    alignmentScore="{rhetoric critique alignment_score as a decimal, e.g. 0.74}"
  />

  <entities>
    <entity name="{EntityName}" isPlayer="{true|false}" speed="{speed}" size="{size}" spawnRate="{spawnRate}">
      <behavior isPlayer="{true|false}" isStatic="{true|false}" movesAnyWay="{true|false}" growsOverTime="{true|false}" shrinksOverTime="{true|false}" isFleeing="{true|false}" />
    </entity>
  </entities>

  <interactions>
    <interaction actor="{EntityName}" target="{EntityName}" attribute="{attributeName}" />
  </interactions>

  <win recipe="{win_recipe}" trigger="{trigger}" threshold="{value if applicable}" duration="{value if applicable}" entity="{entity}" />

  <lose recipe="{lose_recipe}" trigger="{trigger}" points="{value if applicable}" duration="{value if applicable}" entity="{entity}" />

  <layout structure="{structure_recipe}">
    <spawn entity="{EntityName}" zone="{zone}" interval="{interval}" />
  </layout>

</game>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES:
- Include ALL entities from entityAttributeState — none may be omitted
- Exactly one entity has isPlayer="true"
- Use speed, size, spawnRate values exactly as given in entityAttributeState
- Omit XML attributes that are not applicable (e.g. omit threshold= on a survive win, omit duration= on a score win)
- Every non-null entity-ref attribute must produce exactly one <interaction> element
- Do NOT output XML comments, only elements and attributes`;

  return buildAgentNode(llm, { systemPrompt });
}
