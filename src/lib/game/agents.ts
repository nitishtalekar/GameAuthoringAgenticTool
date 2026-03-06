import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";
import { formatMicroRhetoricsForPrompt } from "@/data/micro-rhetorics";
import { formatRecipesForPrompt } from "@/data/recipes";
import { formatEntityAttributesForPrompt } from "@/data/entity-attributes";

/**
 * Agent 1 — Authoring Agent
 *
 * Converts natural language concept map descriptions into a structured
 * ConceptGraph with entities and relations.
 */
export function buildAuthoringAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });

  const systemPrompt = `You are a structured concept-map extraction agent for the Game-O-Matic system.
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
 * Agent 2 — Micro-Rhetoric Selection Agent
 *
 * Maps each verb relation in the concept graph to the most appropriate
 * micro-rhetoric from the static library.
 */
export function buildMicroRhetoricAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const library = formatMicroRhetoricsForPrompt();

  const systemPrompt = `You are a micro-rhetoric selection agent for the Game-O-Matic system.
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
 * Agent 3 — Entity Attribute Agent
 *
 * Reads the concept graph and micro-rhetoric selections, then assigns
 * values for every predefined attribute to every entity in the game.
 * Produces the EntityAttributeState used by downstream agents.
 */
export function buildEntityAttributeAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.2 });
  const attributeList = formatEntityAttributesForPrompt();

  const systemPrompt = `You are an entity attribute assignment agent for the Game-O-Matic system.
Given the original user concept, a concept graph, and micro-rhetoric selections, assign values for every predefined attribute to every entity.

PREDEFINED ATTRIBUTES (assign ALL of these for every entity — do not omit any key):
${attributeList}

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
5. Use the concept graph relations as secondary evidence to confirm or resolve ambiguities in entity-ref attributes.
6. Use the original user concept as the highest-level semantic guide — attributes must reflect the intended meaning of the concept, not just mechanical defaults.
7. Exactly one entity should have isPlayer: true. If unclear, pick the entity the player would most naturally control.
8. Do NOT set an attribute to true or a non-null entity ref unless it is clearly supported by a micro-rhetoric selection or the concept graph relation.

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
      "stopsBy": null
    }
  }
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Agent 4 — Recipe Selection Agent
 *
 * Selects win, lose, structure, and patch recipes based on the current
 * entity and component state.
 */
export function buildRecipeAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.3 });
  const winRecipes = formatRecipesForPrompt("win");
  const loseRecipes = formatRecipesForPrompt("lose");
  const structureRecipes = formatRecipesForPrompt("structure");
  const patchRecipes = formatRecipesForPrompt("patch");

  const systemPrompt = `You are a recipe selection agent for the Game-O-Matic system.
Given the entity and component state, select one win recipe, one lose recipe, one structure recipe, and any relevant patch recipes.

WIN RECIPES:
${winRecipes}

LOSE RECIPES:
${loseRecipes}

STRUCTURE RECIPES:
${structureRecipes}

PATCH RECIPES:
${patchRecipes}

RULES:
- Select exactly one win_recipe, one lose_recipe, and one structure_recipe
- Select zero or more patch_recipes (use an empty array if none needed)
- All selected names must come from the lists above exactly as written
- Choose recipes that match the mechanics that are already present in the entity components

CRITICAL — WIN AND LOSE CONDITIONS MUST BE MUTUALLY EXCLUSIVE:
The win and lose conditions must describe opposite, non-contradictory outcomes for the same game state.
Ask yourself: "Can both the win condition and the lose condition trigger for the same event?" If yes, you have chosen conflicting recipes — pick different ones.

Forbidden combinations (these pairs directly contradict each other and must NEVER be used together):
- "Eliminate All Of Type" (win) + "Protected Entity Removed" (lose): removing entities cannot simultaneously be both the goal and the failure state for the same entity type.
- "Escort Entity Safely" (win) + "Protected Entity Removed" (lose) against the SAME entity: keeping an entity alive cannot be the win trigger and its death the lose trigger at the same time unless they refer to different entities.
- Any win recipe that requires removing entity X + any lose recipe that requires preserving entity X.

To avoid contradictions, follow this decision logic:
1. If the player wins by removing a specific entity type → the lose condition must NOT be triggered by that same entity type being removed (e.g., use "Run Out Of Time" or "Health Depletion" instead).
2. If the player wins by keeping an entity alive → the lose condition SHOULD be triggered by that entity being removed (this is consistent, not contradictory).
3. If the lose condition is "Protected Entity Removed", the win condition must NOT involve removing that protected entity.

Verify your selection before outputting: state which entity type triggers win and which triggers lose, and confirm they are different events or different entity types.

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "win_recipe": "recipe name",
  "lose_recipe": "recipe name",
  "structure_recipe": "recipe name",
  "patch_recipes": ["recipe name"],
  "justifications": {
    "win": "one sentence explaining which mechanic/entity triggers the win",
    "lose": "one sentence explaining which mechanic/entity triggers the lose — must NOT reference the same entity or event as the win justification",
    "structure": "one sentence"
  }
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Agent 4 — Verifier / Repair Agent
 *
 * Analyzes the assembled game spec for playability issues and proposes
 * targeted repairs using a restricted set of operators.
 */
export function buildVerifierAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });
  const componentLibrary = formatMicroRhetoricsForPrompt();
  const recipeLibrary = formatRecipesForPrompt();

  const systemPrompt = `You are a playability verifier and repair agent for the Game-O-Matic system.
Analyze the assembled game specification and identify issues that would prevent a player from engaging or winning.

ALLOWED REPAIR OPERATORS: AddComponent, RemoveComponent, ReplaceComponent, AdjustParameter, AssignPlayer

PLAYABILITY CHECKLIST:
1. At least one entity is player-controlled (has InputComponent or isPlayer=true)
2. Player has a way to affect other entities (remove, collide, collect)
3. Win condition is achievable given current mechanics
4. Lose condition is distinct from win condition
5. At least one entity has a movement component

AVAILABLE COMPONENTS (repairs must only reference component names from this list):
${componentLibrary}

If all checks pass, set playable to true and return empty issues/repairs arrays.
If issues exist, list them and propose the minimal repairs needed to fix them.

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "issues": ["description of issue"],
  "repairs": [
    {
      "operator": "OperatorName",
      "target": "EntityName",
      "from": "OldComponent",
      "to": "NewComponent"
    }
  ],
  "playable": true
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Agent 5 — Rhetoric Critic Agent
 *
 * Evaluates whether the final mechanics express the intended rhetorical
 * meaning from the original concept map.
 */
export function buildRhetoricCriticAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.4 });
  const componentLibrary = formatMicroRhetoricsForPrompt();
  const recipeLibrary = formatRecipesForPrompt();

  const systemPrompt = `You are a rhetoric critic agent for the Game-O-Matic system.
Compare the original concept graph (what the author intended) against the final mechanics graph (what the game actually simulates).
Evaluate how well the gameplay mechanics express the intended rhetorical meaning.

SCORING GUIDE:
- alignment_score 0.0 = mechanics completely contradict the intended meaning
- alignment_score 0.5 = mechanics are neutral or loosely related to the concept
- alignment_score 1.0 = mechanics perfectly and clearly express the intended concept

mismatches: specific places where mechanics contradict or miss the intended idea
suggested_swaps: minimal component-level changes to improve alignment

AVAILABLE COMPONENTS (suggested_swaps must only reference component names from this list):
${componentLibrary}

AVAILABLE RECIPES (for context):
${recipeLibrary}

CONSTRAINT: The "replace" and "with" fields in suggested_swaps must be exact component names from the AVAILABLE COMPONENTS list above.

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "alignment_score": 0.0,
  "interpretation": "one to two paragraph summary of what the game currently expresses",
  "mismatches": ["description of mismatch"],
  "suggested_swaps": [
    { "entity": "EntityName", "replace": "OldComponent", "with": "NewComponent" }
  ]
}`;

  return buildAgentNode(llm, { systemPrompt });
}

/**
 * Agent 5b — Rhetoric Swap Agent
 *
 * Applies suggested component swaps from the Rhetoric Critic to the entity
 * list, producing an updated EntitySpec[] with improved rhetorical alignment.
 */
export function buildRhetoricSwapAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });
  const componentLibrary = formatMicroRhetoricsForPrompt();

  const systemPrompt = `You are a rhetoric swap agent for the Game-O-Matic system.
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
 * Agent 6 — XML Generation Agent
 *
 * Converts the fully verified and critiqued game specification into a
 * well-formed XML document following the Game-O-Matic schema.
 */
export function buildXmlGenerationAgent(): NodeFunction {
  const llm = createOpenAIModel({ temperature: 0.1 });

  const systemPrompt = `You are an XML generation agent for the Game-O-Matic engine.
Convert the final verified game specification into well-formed XML following the schema below.
Output ONLY the XML document — no prose, no code fences, no markdown, no additional commentary.

XML SCHEMA:
<?xml version="1.0" encoding="UTF-8"?>
<game version="1.0">

  <metadata
    title="{short title derived from entity names}"
    description="{one-line game premise}"
    generatedFrom="{original concept map text}"
    howToPlay="{1-2 sentence player instruction, e.g. 'Control the Player to collect Coins. Avoid running out of time.'}"
    rhetoricTheme="{high-level rhetoric theme from the alignment interpretation, max 40 chars, e.g. 'predator-prey'}"
  />

  <entities>
    <entity name="{EntityName}" isPlayer="{true|false}" displayName="{human-readable display name}">
      <components>
        <!-- ONLY intrinsic/behavioral components (movement, spawning, self-state). Do NOT put relational/collision components here — those go in <relations>. -->
        <component type="{ComponentType}" />
      </components>
      <parameters>
        <param name="speed" value="100" unit="px/s" />
        <param name="size" value="32" unit="px" />
        <param name="spawnRate" value="1.5" unit="per/s" />
      </parameters>
    </entity>
  </entities>

  <relations>
    <!-- Derived from micro-rhetoric selections. At least one relation per entity pair. -->
    <relation from="{EntityName}" to="{EntityName}" microRhetoric="{micro-rhetoric name}" component="{ComponentType}" verb="{action verb}" />
  </relations>

  <winCondition recipe="{Win Recipe Name}">
    <threshold score="10" />
  </winCondition>

  <loseCondition recipe="{Lose Recipe Name}">
    <timer seconds="60" />
  </loseCondition>

  <layout structure="{Structure Recipe Name}">
    <spawn entity="{EntityName}" zone="left|center|right|any" interval="2.0" />
  </layout>

</game>

RULES:
- Include ALL entities from the specification
- Mark exactly one entity as isPlayer="true"
- Entity <components> must only contain intrinsic behavioral components (e.g. RandomMovementComponent, SpawnPeriodicallyComponent). Relational components (collision, seek, damage) belong in <relations> only.
- <relations> must be derived from the micro-rhetoric selections. Each selection maps to one <relation> element with from/to entity names, the micro-rhetoric name, component type, and a short verb describing the interaction.
- Ensure at least one <relation> exists for every entity pair in the game.
- Use realistic parameter values: speed 50–250, size 16–64, spawnRate 0.5–5.0
- Assign parameter values that reflect the entity's role (e.g., player is slower but controlled)
- howToPlay must be a clear player-facing instruction derived from the player entity and the win/lose recipes
- rhetoricTheme must be a concise label (≤ 40 chars) summarizing the conceptual theme from the rhetoric critique`;

  return buildAgentNode(llm, { systemPrompt });
}
