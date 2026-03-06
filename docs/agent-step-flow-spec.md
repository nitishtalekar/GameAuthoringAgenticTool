# Agent Step Flow Spec

> Short summary of what each step does, what it receives, and what it outputs.
> **Update this doc as the pipeline changes.**

---

## Overview

`POST /api/game/step` accepts `{ step, state }` and returns `{ state }`.
The client calls it once per step, passing back the full accumulated state each time.
Steps must run in order: 1 → 2 → 3 → 4 → 5 → (optionally 55) → 6.

---

## Step 1 — Authoring Agent

**Receives:** `state.input` (raw user text)

**Does:** Extracts entities (nouns) and subject-verb-object relations from the concept. Assigns a confidence score.

**Outputs → `state.conceptGraph`:**
```json
{
  "entities": ["Player", "Enemy", "Coin"],
  "relations": [
    { "subject": "Player", "verb": "collects", "object": "Coin" },
    { "subject": "Enemy", "verb": "chases", "object": "Player" }
  ],
  "confidence": 0.95
}
```

---

## Step 2 — Micro-Rhetoric Agent

**Receives:** `state.input` + `state.conceptGraph`

**Does:** For each relation, picks one component from the 16-item micro-rhetoric library whose semantic meaning matches the verb (e.g. "chases" → `HomingMovementComponent`).

**Outputs → `state.microRhetoricsSelection`:**
```json
{
  "selections": [
    {
      "relation": "Player collects Coin",
      "micro_rhetoric": "Add Score on Collide",
      "component": "AddScoreOnCollideComponent",
      "justification": "collecting implies gaining points"
    }
  ]
}
```

---

## Step 3 — Recipe Selection Agent

**Receives:** `state.input` + `state.conceptGraph` + `state.microRhetoricsSelection`

**Does:** Picks one win recipe, one lose recipe, one structure/layout recipe, and zero or more patch recipes from the predefined library.

**Outputs → `state.recipeSelection`:**
```json
{
  "win_recipe": "Score Threshold Win",
  "lose_recipe": "Run Out Of Time",
  "structure_recipe": "Arena Layout",
  "patch_recipes": ["Ensure Player Assigned"],
  "justifications": { "win": "...", "lose": "...", "structure": "..." }
}
```

---

## Step 4 — Verifier Agent

**Receives:** `state.input` + `state.conceptGraph` + `state.microRhetoricsSelection` + `state.recipeSelection`

**Pre-LLM assembly:** Builds `EntitySpec[]` from the concept graph and micro-rhetoric selections — each entity gets a name, `isPlayer` flag, component list, and default parameters.

**Does:** Checks the assembled spec for playability (player assigned, win/lose conditions achievable, movement exists, etc.). Proposes minimal repairs (AddComponent, AssignPlayer, AdjustParameter, etc.).

**Post-LLM:** Applies all repairs to the entity list in-place.

**Outputs → `state.entities` (repaired) + `state.verifierReport`:**
```json
{
  "issues": ["No player entity assigned"],
  "repairs": [
    { "operator": "AssignPlayer", "target": "Player" },
    { "operator": "AddComponent", "target": "Player", "to": "InputComponent" }
  ],
  "playable": true
}
```

---

## Step 5 — Rhetoric Critic Agent

**Receives:** `state.input` + `state.conceptGraph` + `state.entities` + `state.recipeSelection` + `state.verifierReport`

**Does:** Compares the original intent (concept) against the mechanical reality (entities + recipes). Scores alignment (0–1), identifies semantic mismatches, and suggests component swaps to better express the original meaning.

**Outputs → `state.rhetoricCritique`:**
```json
{
  "alignment_score": 0.75,
  "interpretation": "The game simulates resource-collection...",
  "mismatches": ["Enemy behavior doesn't match 'threat' semantics"],
  "suggested_swaps": [
    { "entity": "Enemy", "replace": "RandomMovementComponent", "with": "HomingMovementComponent" }
  ]
}
```

---

## Step 55 (Optional) — Rhetoric Swap + Re-Critique

**Receives:** `state.entities` + `state.rhetoricCritique.suggested_swaps`

**Does (two sub-steps):**
1. **Swap Agent** — applies the suggested component swaps to the entity list.
2. **Re-Critique Agent** — re-runs the rhetoric critic on the updated entities.

**Outputs → `state.entities` (updated) + `state.rhetoricSwapApplied: true` + `state.postSwapRhetoricCritique`**

---

## Step 6 — XML Generation Agent

**Receives:** full state — `input`, `entities`, `recipeSelection`, `microRhetoricsSelection`, `verifierReport`, `rhetoricCritique` (or `postSwapRhetoricCritique`)

**Does:** Serializes the entire game spec into Game-O-Matic XML with `<metadata>`, `<entities>`, `<relations>`, `<winCondition>`, `<loseCondition>`, `<layout>`. Falls back to deterministic `serializeToXml()` if LLM output fails XML validation.

**Outputs → `state.xmlOutput`:** valid XML string

---

## Component Inventory

### Intrinsic (entity-level)
`RandomMovementComponent`, `PatrolBetweenPointsComponent`, `HomingMovementComponent`, `FleeTargetComponent`, `GrowOverTimeComponent`, `ShrinkOverTimeComponent`, `IncreaseSpeedOverTimeComponent`, `SpawnPeriodicallyComponent`, `StaticObstacleComponent`

### Relational (collision-based)
`AddScoreOnCollideComponent`, `DamageOnCollideComponent`, `RemoveOnCollideComponent`, `GrowOnCollideComponent`, `ShrinkOnCollideComponent`, `SpawnEntityOnRemoveComponent`, `ApplyForceOnCollideComponent`, `StopMovementOnCollideComponent`, `TransformTargetIntoSelfComponent`

---

## Recipe Inventory

| Category  | Options |
|-----------|---------|
| Win       | Score Threshold Win, Eliminate All Of Type, Survive Duration, Reach Goal Zone, Grow Beyond Size, Collect All Items, Escort Entity Safely |
| Lose      | Run Out Of Time, Health Depletion, Protected Entity Removed, Enemy Reaches Goal, Meter Overflow |
| Structure | Frogger Layout, Asteroids Layout, Space Invaders Layout, Arena Layout, Chase Layout, Tower Defense Layout |
| Patch     | Ensure Movement Exists, Ensure Collisions Enabled, Ensure Player Assigned, Ensure Spawn Loop, Clamp Parameters |
