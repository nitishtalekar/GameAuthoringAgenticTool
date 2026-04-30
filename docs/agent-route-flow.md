# Game Authoring Tool — Agent Pipeline Flow

This document describes the full 8-step agent pipeline that converts a raw news article (or concept text) into a playable XML game specification.

**Route:** `POST /api/game/step` — [src/app/api/game/step/route.ts](../src/app/api/game/step/route.ts)
**Agents:** [src/lib/game/agents.ts](../src/lib/game/agents.ts)
**Types:** [src/lib/game/types.ts](../src/lib/game/types.ts)

---

## Overview

The client calls the route **once per step**, passing `{ step: number, state: GameState }`. The route runs exactly one agent and returns the updated `GameState`. The client accumulates state and triggers the next step.

```
Client
  │
  │  POST /api/game/step  { step: 1, state: { input: "Police arrests Occupier..." } }
  ▼
┌──────────────────────────────────────────────────────────────┐
│  PIPELINE (8 steps)                                          │
│                                                              │
│  Step 1 ── News → Concept Map Agent                          │
│  Step 2 ── Authoring Agent          → ConceptGraph           │
│  Step 3 ── Micro-Rhetoric Agent     → MicroRhetoricsSelection│
│  Step 4 ── Entity Attribute Agent   → EntityAttributeState   │
│  Step 5 ── Recipe Selection Agent   → RecipeSelection        │
│  Step 6 ── Verifier Agent           → VerifierReport + Repairs│
│  Step 7 ── Rhetoric Critic Agent    → RhetoricCritique       │
│  Step 8 ── XML Generation Agent     → xmlOutput              │
└──────────────────────────────────────────────────────────────┘
  │
  │  { state: GameState }   (client calls step N+1 next)
  ▼
Client
```

Each step validates that its required `GameState` fields are already populated before running.

---

## GameState — the shared accumulator

```ts
{
  step: number,
  initialInput?: string,          // raw article text (before Step 1)
  input: string,                  // distilled concept map (after Step 1)
  conceptGraph?: ConceptGraph,    // set by Step 2
  microRhetoricsSelection?: ...,  // set by Step 3
  entityAttributeState?: ...,     // set by Step 4, repaired by Step 6
  recipeSelection?: ...,          // set by Step 5, repaired by Step 6
  verifierReport?: VerifierReport,// set by Step 6
  rhetoricCritique?: ...,         // set by Step 7
  xmlOutput?: string,             // set by Step 8
}
```

---

## Step 1 — News → Concept Map

**Agent:** `buildNewsToConceptAgent()` | **Requires:** nothing (uses `state.input` or `state.initialInput`)

Distils a raw news article into 2–6 subject-verb-object sentences.

```
INPUT (state.initialInput):
"On the six month anniversary of Occupy Wall Street, protesters returned to
Zuccotti Park and several were arrested. Police are arresting occupiers who
are blocking Wall Street, but Wall Street is also growing the movement."

                    ▼  NewsToConceptAgent (gpt-4o, temp 0.2)

OUTPUT (state.input):
"Police arrests Occupier.
 Occupier obstructs WallStreet.
 WallStreet grows Occupier."
```

**What changes in GameState:**
- `state.input` ← distilled concept sentences

---

## Step 2 — Authoring

**Agent:** `buildAuthoringAgent()` | **Requires:** nothing (uses `state.input`)

Parses the concept sentences into a structured `ConceptGraph` with entities and relations.

```
INPUT:
"Police arrests Occupier. Occupier obstructs WallStreet. WallStreet grows Occupier."

                    ▼  AuthoringAgent (gpt-4o, temp 0.2)

OUTPUT (state.conceptGraph):
{
  "entities": ["Police", "Occupier", "WallStreet"],
  "relations": [
    { "subject": "Police",     "verb": "arrests",   "object": "Occupier"   },
    { "subject": "Occupier",   "verb": "obstructs", "object": "WallStreet" },
    { "subject": "WallStreet", "verb": "grows",     "object": "Occupier"   }
  ],
  "confidence": 0.95
}
```

**What changes in GameState:**
- `state.conceptGraph` ← `ConceptGraph`

---

## Step 3 — Micro-Rhetoric Selection

**Agent:** `buildMicroRhetoricAgent()` | **Requires:** `conceptGraph`

Maps each verb relation to the most appropriate game mechanic component from the static micro-rhetoric library.

```
INPUT:
- state.input (concept)
- state.conceptGraph (3 relations above)
- micro-rhetoric library (from src/data/micro-rhetorics.ts)

                    ▼  MicroRhetoricAgent (gpt-4o, temp 0.3)

OUTPUT (state.microRhetoricsSelection):
{
  "selections": [
    {
      "relation": "Police arrests Occupier",
      "micro_rhetoric": "RemoveOnCollide",
      "component": "RemoveOnCollideComponent",
      "justification": "Arrest removes the occupier from the space on contact."
    },
    {
      "relation": "Occupier obstructs WallStreet",
      "micro_rhetoric": "StaticObstacle",
      "component": "StaticObstacleComponent",
      "justification": "Obstruction implies a static blocking presence."
    },
    {
      "relation": "WallStreet grows Occupier",
      "micro_rhetoric": "GrowOnCollide",
      "component": "GrowOnCollideComponent",
      "justification": "Growing the movement means the entity gains size on contact."
    }
  ]
}
```

**What changes in GameState:**
- `state.microRhetoricsSelection` ← `MicroRhetoricsSelection`

---

## Step 4 — Entity Attributes

**Agent:** `buildEntityAttributeAgent()` | **Requires:** `conceptGraph`, `microRhetoricsSelection`

Assigns every predefined boolean, entity-ref, and numeric attribute to every entity, driven primarily by the micro-rhetoric component selections.

```
INPUT:
- state.input, state.conceptGraph, state.microRhetoricsSelection
- predefined attribute schema (from src/data/entity-attributes.ts)

                    ▼  EntityAttributeAgent (gpt-4o, temp 0.2)

OUTPUT (state.entityAttributeState):
{
  "entityAttributeState": {
    "Police": {
      "isPlayer": true,  "isStatic": false, "movesAnyWay": true,
      "growsOverTime": false, "shrinksOverTime": false,
      "isRemovedBy": null, "growsBy": null, "shrinksBy": null,
      "stopsBy": null, "isDamagedBy": null, "chasedBy": null,
      "isFleeing": false,
      "speed": 120, "size": 32, "spawnRate": 0
    },
    "Occupier": {
      "isPlayer": false, "isStatic": true,  "movesAnyWay": false,
      "isRemovedBy": "Police", "growsBy": "WallStreet",
      ...
      "speed": 0, "size": 32, "spawnRate": 2.0
    },
    "WallStreet": {
      "isPlayer": false, "isStatic": true,  "movesAnyWay": false,
      ...
      "speed": 0, "size": 48, "spawnRate": 0.5
    }
  }
}
```

**Attribute derivation rules (examples):**
| Component | Attribute set |
|---|---|
| `RemoveOnCollideComponent` on Police→Occupier | `Occupier.isRemovedBy = "Police"` |
| `StaticObstacleComponent` on Occupier | `Occupier.isStatic = true`, `movesAnyWay = false` |
| `GrowOnCollideComponent` on WallStreet→Occupier | `Occupier.growsBy = "WallStreet"` |
| Player entity | `isPlayer = true`, `movesAnyWay = true` |

**What changes in GameState:**
- `state.entityAttributeState` ← `EntityAttributeState`

---

## Step 5 — Recipe Selection

**Agent:** `buildRecipeAgent()` | **Requires:** `conceptGraph`, `microRhetoricsSelection`

Selects win, lose, structure, and patch recipes, then derives concrete win/lose conditions referencing actual entities and attributes.

```
INPUT:
- state.input, state.conceptGraph, state.microRhetoricsSelection
- state.entityAttributeState
- recipe library (from src/data/recipes.ts)

                    ▼  RecipeAgent (gpt-4o, temp 0.3)

OUTPUT (state.recipeSelection):
{
  "win_recipe":       "Eliminate All Of Type",
  "lose_recipe":      "Run Out Of Time",
  "structure_recipe": "Arena Layout",
  "patch_recipes":    [],
  "win_condition": {
    "description": "All Occupier isRemovedBy Police",
    "entity":      "Occupier",
    "attribute":   "isRemovedBy",
    "value":       "Police"
  },
  "lose_condition": {
    "description": "Police survives for 60s",
    "entity":      "Police",
    "attribute":   "movesAnyWay",
    "value":       "60s"
  },
  "justifications": {
    "win":       "Police removes all Occupiers by arresting (colliding with) them.",
    "lose":      "Police fails the mission if time expires before all arrests.",
    "structure": "All entities converge in an arena-style field."
  }
}
```

**Win/lose mutual exclusion rule:** the agent is instructed to verify the two conditions cannot trigger for the same game event before outputting.

**What changes in GameState:**
- `state.recipeSelection` ← `RecipeSelection`

---

## Step 6 — Verifier

**Agent:** `buildVerifierAgent()` | **Requires:** `conceptGraph`, `microRhetoricsSelection`, `entityAttributeState`, `recipeSelection`

Verifies playability against a 9-point checklist and proposes minimal repairs. Repairs are automatically applied to `entityAttributeState` and `recipeSelection` before returning.

```
INPUT:
- All accumulated state fields

                    ▼  VerifierAgent (gpt-4o, temp 0.1)

OUTPUT (state.verifierReport):
{
  "isPlayable": true,
  "issues": [],
  "repairs": [
    {
      "operator": "AdjustParameter",
      "target":   "WallStreet",
      "parameter": "spawnRate",
      "value":    1.0,
      "description": "spawnRate was 0 for a non-player entity"
    }
  ],
  "repairsSummary": "Adjusted WallStreet spawnRate from 0 to 1.0."
}
```

**Playability checklist:**
1. Exactly one entity has `isPlayer = true`
2. Player entity has `movesAnyWay = true`
3. Win condition entity/attribute exist in `entityAttributeState`
4. Win condition value is valid (entity-ref match, or threshold ending in `px`/`s`)
5. Lose condition entity/attribute exist in `entityAttributeState`
6. Lose condition value is valid
7. Win and lose conditions are mutually exclusive
8. At least one non-player entity exists
9. Numeric params in range (`speed` 0–250, `size` 16–64, `spawnRate` 0–5.0)

**Repair operators:** `AlterAttribute`, `AdjustParameter`, `AssignPlayer`, `AddComponent`, `RemoveComponent`, `ReplaceComponent`

**What changes in GameState:**
- `state.verifierReport` ← `VerifierReport`
- `state.entityAttributeState` ← repaired in-place via `applyVerifierRepairs()`
- `state.recipeSelection` ← win/lose conditions may be repaired

---

## Step 7 — Rhetoric Critic

**Agent:** `buildRhetoricCriticAgent()` | **Requires:** `entityAttributeState`, `recipeSelection`, `verifierReport`

Evaluates how well the final game mechanics express the intended rhetorical meaning of the original concept.

```
INPUT:
- state.input (intended meaning)
- state.conceptGraph
- state.entityAttributeState (post-repair)
- state.recipeSelection (post-repair)

                    ▼  RhetoricCriticAgent (gpt-4o, temp 0.7)

OUTPUT (state.rhetoricCritique):
{
  "alignment_score": 0.74,
  "interpretation": "The game expresses the power dynamic of law enforcement
    removing protesters, but the growing mechanic for WallStreet's influence
    on Occupiers is only partially encoded — the win condition focuses solely
    on arrest rather than the reciprocal growth relationship.",
  "mismatches": [
    "WallStreet.growsBy = Occupier is encoded but has no mechanical consequence on win/lose conditions.",
    "The concept implies WallStreet benefits from the conflict, but the game only represents Police as the active agent."
  ]
}
```

**Scoring guide:** 0.0 = contradicts concept, 0.5 = neutral, 1.0 = perfect alignment. Agent is instructed to use the full range with non-round values.

**What changes in GameState:**
- `state.rhetoricCritique` ← `RhetoricCritique`

---

## Step 8 — XML Generation

**Agent:** `buildXmlGenerationAgent()` | **Requires:** `entityAttributeState`, `recipeSelection`

Converts the fully verified and critiqued game spec into a well-formed XML document. Output is validated; an invalid XML throws a 500.

```
INPUT:
- state.input, state.entityAttributeState, state.recipeSelection
- state.verifierReport.repairs (audit trail only)
- state.rhetoricCritique.alignment_score + interpretation (metadata)

                    ▼  XmlGenerationAgent (gpt-4o, temp 0.1)
                    ▼  validateXml() + extractXml()

OUTPUT (state.xmlOutput):
<?xml version="1.0" encoding="UTF-8"?>
<game version="1.0">

  <metadata
    title="Police vs Occupier"
    concept="Police arrests Occupier. Occupier obstructs WallStreet. WallStreet grows Occupier."
    howToPlay="Move Police to arrest all Occupiers before time runs out."
    rhetoricTheme="Law enforcement suppressing protest"
    alignmentScore="0.74"
  />

  <entities>
    <entity name="Police" isPlayer="true" speed="120" size="32" spawnRate="0">
      <behavior isPlayer="true" isStatic="false" movesAnyWay="true"
                growsOverTime="false" shrinksOverTime="false" isFleeing="false" />
    </entity>
    <entity name="Occupier" isPlayer="false" speed="0" size="32" spawnRate="2.0">
      <behavior isPlayer="false" isStatic="true" movesAnyWay="false"
                growsOverTime="false" shrinksOverTime="false" isFleeing="false" />
    </entity>
    <entity name="WallStreet" isPlayer="false" speed="0" size="48" spawnRate="1.0">
      <behavior isPlayer="false" isStatic="true" movesAnyWay="false"
                growsOverTime="false" shrinksOverTime="false" isFleeing="false" />
    </entity>
  </entities>

  <interactions>
    <interaction actor="Police"     target="Occupier" attribute="isRemovedBy" />
    <interaction actor="WallStreet" target="Occupier" attribute="growsBy"     />
  </interactions>

  <win recipe="Eliminate All Of Type" trigger="score" threshold="10" entity="Occupier" />
  <lose recipe="Run Out Of Time"      trigger="timeout" duration="60s" entity="Police" />

  <layout structure="Arena Layout">
    <spawn entity="Occupier"   zone="edges" interval="0.5s" />
    <spawn entity="WallStreet" zone="edges" interval="1.0s" />
  </layout>

</game>
```

**What changes in GameState:**
- `state.xmlOutput` ← validated XML string

---

## Full Pipeline Dependency Graph

```
state.input / state.initialInput
        │
        ▼
┌──────────────────┐
│ Step 1           │  News → Concept Map
│ (optional)       │  → state.input (distilled)
└──────────┬───────┘
           │
           ▼
┌──────────────────┐
│ Step 2           │  Authoring
│ requires: –      │  → state.conceptGraph
└──────┬───┬───────┘
       │   │
       │   └──────────────────────────────────┐
       ▼                                      ▼
┌──────────────────┐                ┌─────────────────────────┐
│ Step 3           │                │ (Step 3 output needed   │
│ requires:        │                │  before Steps 4 & 5)    │
│ conceptGraph     │                └─────────────────────────┘
│ → microRhetoric  │
└──────┬───────────┘
       │
       ├──────────────────────────────────────┐
       ▼                                      ▼
┌──────────────────┐              ┌───────────────────────────┐
│ Step 4           │              │ Step 5                    │
│ requires:        │              │ requires:                 │
│ conceptGraph     │              │ conceptGraph              │
│ microRhetoric    │              │ microRhetoric             │
│ → entityAttrs    │              │ → recipeSelection         │
└──────┬───────────┘              └───────────┬───────────────┘
       │                                      │
       └──────────────────┬───────────────────┘
                          ▼
              ┌───────────────────────┐
              │ Step 6 — Verifier     │
              │ requires:             │
              │ conceptGraph          │
              │ microRhetoric         │
              │ entityAttrs           │
              │ recipeSelection       │
              │ → verifierReport      │
              │ (repairs entityAttrs  │
              │  & recipeSelection)   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Step 7 — Critic       │
              │ requires:             │
              │ entityAttrs           │
              │ recipeSelection       │
              │ verifierReport        │
              │ → rhetoricCritique    │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Step 8 — XML Gen      │
              │ requires:             │
              │ entityAttrs           │
              │ recipeSelection       │
              │ → xmlOutput           │
              └───────────────────────┘
```

---

## Error Handling

| Condition | HTTP Status | Response |
|---|---|---|
| `step` out of range 1–8 | 400 | `{ state, error: "Invalid step number..." }` |
| Required `GameState` field missing | 500 | `{ state: {}, error: "<StepName> requires: <fields>" }` |
| Agent returns invalid JSON | 500 | `{ state: {}, error: "<AgentLabel> returned invalid JSON. First 300 chars: ..." }` |
| XML output fails validation | 500 | `{ state: {}, error: "XML generation agent produced invalid output." }` |
| Any other thrown error | 500 | `{ state: {}, error: "<message>" }` |

---

## Type Reference

| Type | File | Description |
|---|---|---|
| `GameState` | [src/lib/game/types.ts](../src/lib/game/types.ts) | Client-side accumulator passed on every request |
| `StepRequest` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `{ step: number, state: GameState }` |
| `StepResponse` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `{ state: GameState, error?: string }` |
| `ConceptGraph` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `{ entities, relations, confidence }` |
| `MicroRhetoricsSelection` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `{ selections: [...] }` — one per relation |
| `EntityAttributeState` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `Record<entityName, EntityAttributeMap>` |
| `RecipeSelection` | [src/lib/game/types.ts](../src/lib/game/types.ts) | Win/lose/structure recipes + concrete conditions |
| `VerifierReport` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `{ isPlayable, issues, repairs, repairsSummary }` |
| `RepairAction` | [src/lib/game/types.ts](../src/lib/game/types.ts) | One repair operation applied by the verifier |
| `RhetoricCritique` | [src/lib/game/types.ts](../src/lib/game/types.ts) | `{ alignment_score, interpretation, mismatches }` |
