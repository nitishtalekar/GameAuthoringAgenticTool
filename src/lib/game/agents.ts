import { createOpenAIModel } from "@/lib/models";
import { buildAgentNode } from "@/lib/agent";
import type { NodeFunction } from "@/lib/types";
import { formatMicroRhetoricsForPrompt } from "@/data/micro-rhetorics";
import { formatRecipesForPrompt } from "@/data/recipes";

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
 * Agent 3 — Recipe Selection Agent
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

OUTPUT: Respond ONLY with valid JSON matching this exact schema — no prose, no markdown fences, no extra text:
{
  "win_recipe": "recipe name",
  "lose_recipe": "recipe name",
  "structure_recipe": "recipe name",
  "patch_recipes": ["recipe name"],
  "justifications": {
    "win": "one sentence",
    "lose": "one sentence",
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
<!-- Game-O-Matic Generated Game Specification
     Generated: {ISO timestamp}
     Concept: {original user input}
     Alignment Score: {alignment score from rhetoric critic}
-->
<game version="1.0">

  <metadata
    title="{short title derived from entity names}"
    description="{one-line game premise}"
    generatedFrom="{original concept map text}"
  />

  <entities>
    <entity name="{EntityName}" isPlayer="{true|false}">
      <components>
        <component type="{ComponentType}" target="{optional: target entity name}" />
      </components>
      <parameters>
        <param name="speed" value="100" unit="px/s" />
        <param name="size" value="32" unit="px" />
        <param name="spawnRate" value="1.5" unit="per/s" />
      </parameters>
    </entity>
  </entities>

  <winCondition recipe="{Win Recipe Name}">
    <threshold score="10" />
  </winCondition>

  <loseCondition recipe="{Lose Recipe Name}">
    <timer seconds="60" />
  </loseCondition>

  <layout structure="{Structure Recipe Name}">
    <spawn entity="{EntityName}" zone="left|center|right" interval="2.0" />
  </layout>

  <designTrace>
    <rhetoricAlignmentScore value="{float}" />
    <interpretation>{interpretation text}</interpretation>
    <microRhetoricSelections>
      <selection relation="{Subject verb Object}" microRhetoric="{name}" component="{type}" />
    </microRhetoricSelections>
    <repairsApplied>
      <repair operator="{operator}" target="{entity}" from="{old}" to="{new}" />
    </repairsApplied>
  </designTrace>

</game>

RULES:
- Include ALL entities from the specification
- Mark exactly one entity as isPlayer="true"
- Include all components assigned to each entity
- Use realistic parameter values: speed 50–250, size 16–64, spawnRate 0.5–5.0
- The designTrace section must include all micro-rhetoric selections and any repairs applied
- Assign parameter values that reflect the entity's role (e.g., player is slower but controlled)`;

  return buildAgentNode(llm, { systemPrompt });
}
