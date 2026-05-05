import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";
import {
  formatBehaviorRhetoricsForPrompt,
  formatInteractionRhetoricsForPrompt,
} from "@/data/micro-rhetorics";
import { formatWinRecipesForPrompt, formatLoseRecipesForPrompt } from "@/data/recipes";
import { GAME_SCHEMA } from "@/data/game-schema";

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

  const systemPrompt = `You are a game-design agent. Assign behavior and interaction rhetorics to a concept map for a playable 2-D game.
You must think like a game designer, not just a semantic matcher — your selections determine whether the game is fun, balanced, and winnable.
Do NOT assign numeric values, speeds, sizes, or configuration properties — those are handled later.

BEHAVIOR RHETORICS (single-entity movement / lifecycle patterns):
${behaviorList}

INTERACTION RHETORICS (collision effects between two entities):
${interactionList}

=== SEMANTIC RULES ===
- Assign exactly one behaviorType per entity based on its conceptual role in the narrative.
- Assign exactly one interactionType per SVO relation; entityA = subject, entityB = object.
- Match verb semantics to the closest rhetoric using the tags and descriptions above.
- Output only the type identifiers — no properties, no numeric values.

=== GAME-DESIGN RULES (must ALL be satisfied) ===
1. PLAYER ENTITY: Exactly one entityBehavior must have isPlayer=true. Choose the entity the player most naturally controls — the one that takes action or is the protagonist in the concept.
   - The player entity MUST use behaviorType "player_controlled".
   - The player entity's clampToCanvas MUST be true.

2. PLAYER AGENCY: At least one interaction must have the player entity as entityA (the actor), giving the player something meaningful to do.

3. THREAT / CHALLENGE: At least one entity must pose a threat to the player (e.g., it chases the player or damages the player on contact), otherwise the game has no tension.

4. COLLECT → DAMAGE_ON_ITEM LOOP: If any interaction uses "collect", there MUST also be a "damage_on_item" interaction that spends that collected resource. A collect with no outlet creates an endless loop with no win path. Conversely, "damage_on_item" requires "collect" to obtain the resource first.

5. SPAWNER PAIRING: Entities with behavior "spawn_on_timer" or "spawn_on_start" must appear as entityA or entityB in at least one interaction, otherwise they are inert decorations.

6. GROW_OVER_TIME EXCLUSIVITY: An entity with "grow_over_time" behavior must NOT also be assigned "spawn_on_timer" or "spawn_on_start" — pick one lifecycle pattern only.

7. SINGLE-INSTANCE BEHAVIORS: "player_controlled" and "grow_over_time" create exactly one instance. Do not use "entity_count_threshold" conditions on these later (the recipe agent will see this output). Flag them with a rationale note if relevant.

8. CHASE TARGET: If any entity uses "chase", it must logically chase another entity (typically the player). Note the intended target in the rationale.

=== RATIONALE ===
After making your selections, produce one short sentence per entity/interaction explaining the game-design reason for your choice (not just the semantic match — explain how it creates fun, tension, or progression).

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
  ],
  "rhetoricsRationale": [
    "EntityName → behaviorType: <one sentence game-design reason>",
    "EntityA + EntityB → interactionType: <one sentence game-design reason>"
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
 * Step 4 — Game JSON Generation Agent
 *
 * Assembles the final playable game config JSON from all prior pipeline state.
 * Uses GAME_SCHEMA as its single authoritative reference for valid types,
 * required fields, numeric ranges, and playability constraints.
 */
export function buildGameJsonAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });

  const systemPrompt = `Convert the game specification into a complete, playable game-config JSON.
Output valid JSON only — no prose, no markdown fences, no code blocks.

You will receive the concept, rhetoric assignment (behavior/interaction types), and recipe selection (end condition types).
YOUR JOB: populate every field — entity sizes, speeds, spawn parameters, condition thresholds, inventory keys, status bars —
strictly following the GAME SCHEMA below. Every constraint in that schema is a hard rule; violating any of them produces a broken game.

${GAME_SCHEMA}`;

  return buildAgentNode(llm, { systemPrompt });
}
