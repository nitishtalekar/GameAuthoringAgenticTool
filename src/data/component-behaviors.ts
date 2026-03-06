// component-behaviors.ts
// Runtime behavior descriptors consumed by GameCanvas and the UI legend.
//
// PLACEMENT RULES (enforced by the XML generator):
//   "entity"   → individual component  → goes inside <entity><components>
//   "relation" → relational component  → goes inside <relations> only, NEVER in <entity><components>
//
// GameCanvas merges both sets via mergeBehaviors() to drive AI movement,
// time-based effects, collision handling, and visual color.

// ── Category ────────────────────────────────────────────────────────────────

export type ComponentPlacement = "entity" | "relation";

// ── Behavior descriptor ──────────────────────────────────────────────────────

export interface ComponentBehavior {
  /** Where this component is placed in the XML output. */
  placement: ComponentPlacement;

  /** Phaser hex color for entities whose dominant component is this one. */
  color: number;

  /** One-line label shown in the in-game entity legend. */
  description: string;

  // ── Individual (intrinsic) flags — only set on placement="entity" ──────────

  /** Entity is added to a StaticGroup and never moves. */
  isStatic: boolean;
  /** AI moves toward the player every frame at entity speed. */
  movesTowardPlayer: boolean;
  /** AI moves directly away from the player every frame. */
  movesAwayFromPlayer: boolean;
  /** AI moves randomly, changing direction every ~1.5–2.5 s. */
  wandersRandomly: boolean;
  /** AI moves back-and-forth on a fixed horizontal range. */
  patrolsBackAndForth: boolean;
  /** Entity speed increases by ~5 px/s each second (capped at 400). */
  acceleratesOverTime: boolean;
  /** Entity grows by 0.02 px each frame until destroyed externally. */
  growsOverTime: boolean;
  /** Entity shrinks by 0.03 px each frame; auto-destroyed when width < 4 px. */
  shrinksOverTime: boolean;
  /** Spawns a clone of itself at its spawnRate parameter interval (seconds). */
  spawnsOnInterval: boolean;

  // ── Relational (collision) flags — only set on placement="relation" ────────

  /** Entity is destroyed when it overlaps the player. */
  removeOnContact: boolean;
  /** Player loses 1 HP on overlap (1.5 s invincibility window applied). */
  damagesPlayer: boolean;
  /** Player gains +1 score on overlap. */
  scoreOnContact: boolean;
  /** Entity grows by 6 px each time it overlaps the player. */
  growsOnContact: boolean;
  /** Player shrinks by 6 px on overlap (minimum 10 px). */
  shrinksPlayerOnContact: boolean;
  /** Player is knocked back at 350 px/s away from the entity on overlap. */
  pushesPlayerOnContact: boolean;
  /** Player velocity is zeroed for 1.2 s on overlap. */
  freezesPlayerOnContact: boolean;
  /** This entity's velocity is zeroed for 1.2 s when it overlaps the player. */
  freezesSelfOnContact: boolean;
  /** This entity loses 1 HP on overlap with the player; destroyed at 0 HP. */
  damagesEntityOnContact: boolean;
}

// ── Component registry ───────────────────────────────────────────────────────

export const COMPONENT_BEHAVIORS: Record<string, ComponentBehavior> = {

  // ── Individual: placed in <entity><components> ────────────────────────────

  RandomMovementComponent: {
    placement: "entity", color: 0x9b59b6,
    description: "Drifts in random directions, changing course every 1.5–2.5 s",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: true, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  PatrolBetweenPointsComponent: {
    placement: "entity", color: 0x1abc9c,
    description: "Moves back and forth horizontally within a fixed 240 px range",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: true,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  HomingMovementComponent: {
    placement: "entity", color: 0xc0392b,
    description: "Steers directly toward the player every frame at entity speed",
    isStatic: false, movesTowardPlayer: true, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  FleeTargetComponent: {
    placement: "entity", color: 0xf39c12,
    description: "Moves directly away from the player every frame at entity speed",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: true,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  GrowOverTimeComponent: {
    placement: "entity", color: 0x27ae60,
    description: "Expands by 0.02 px per frame continuously; only stops if destroyed by another component",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: true, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  ShrinkOverTimeComponent: {
    placement: "entity", color: 0x636e72,
    description: "Shrinks by 0.03 px per frame; auto-destroyed when width drops below 4 px",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: true, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  IncreaseSpeedOverTimeComponent: {
    placement: "entity", color: 0xff7675,
    description: "Chases the player and gains +5 px/s every second (cap 400 px/s); combine with HomingMovementComponent",
    isStatic: false, movesTowardPlayer: true, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: true, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  SpawnPeriodicallyComponent: {
    placement: "entity", color: 0x8e44ad,
    description: "Spawns a clone of itself at the interval defined by the entity's spawnRate parameter (seconds)",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: true,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  StaticObstacleComponent: {
    placement: "entity", color: 0x7f8c8d,
    description: "Placed in a Phaser StaticGroup — never moves; blocks both player and enemy physics bodies",
    isStatic: true, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  // ── Relational: placed in <relations> only, NEVER in <entity><components> ──

  AddScoreOnCollideComponent: {
    placement: "relation", color: 0xf1c40f,
    description: "On player overlap: awards +1 score and removes this entity",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  DamageOnCollideComponent: {
    placement: "relation", color: 0xc0392b,
    description: "On player overlap: reduces player HP by 1 (1.5 s invincibility window prevents rapid hits)",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  RemoveOnCollideComponent: {
    placement: "relation", color: 0xe67e22,
    description: "On player overlap: removes this entity and deals 1 HP damage to the player",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: true, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  GrowOnCollideComponent: {
    placement: "relation", color: 0x2ecc71,
    description: "On player overlap: this entity grows by 6 px (width and height); player is unaffected",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: true, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  ShrinkOnCollideComponent: {
    placement: "relation", color: 0xbdc3c7,
    description: "On player overlap: player shrinks by 6 px (minimum 10 px); entity is unaffected",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: true, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  SpawnEntityOnRemoveComponent: {
    placement: "relation", color: 0x6d4c41,
    description: "When this entity is removed, spawns new entities at its last position",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  ApplyForceOnCollideComponent: {
    placement: "relation", color: 0xe67e22,
    description: "On player overlap: knocks the player back at 350 px/s in the direction away from this entity",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: true,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  StopMovementOnCollideComponent: {
    placement: "relation", color: 0x74b9ff,
    description: "On player overlap: sets player velocity to (0, 0) for 1.2 s; entity is unaffected",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: true, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  TransformTargetIntoSelfComponent: {
    placement: "relation", color: 0x6c5ce7,
    description: "On player overlap: replaces the contacted entity with a new copy of this entity's type",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
  },

  // ── New: entity-perspective collision components ───────────────────────────

  FreezeOnCollideComponent: {
    placement: "relation", color: 0x00cec9,
    description: "On player overlap: this entity's velocity is zeroed for 1.2 s (entity is stopped, not the player)",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: true, damagesEntityOnContact: false,
  },

  EntityDamageOnCollideComponent: {
    placement: "relation", color: 0xd63031,
    description: "On player overlap: this entity loses 1 HP; destroyed at 0 HP",
    isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
    wandersRandomly: false, patrolsBackAndForth: false,
    acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
    freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: true,
  },
};

// ── Fallback ─────────────────────────────────────────────────────────────────

const PASSIVE_BEHAVIOR: ComponentBehavior = {
  placement: "entity", color: 0x9b59b6,
  description: "Unknown component — no runtime effect",
  isStatic: false, movesTowardPlayer: false, movesAwayFromPlayer: false,
  wandersRandomly: false, patrolsBackAndForth: false,
  acceleratesOverTime: false, growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
  removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
  growsOnContact: false, shrinksPlayerOnContact: false, pushesPlayerOnContact: false,
  freezesPlayerOnContact: false, freezesSelfOnContact: false, damagesEntityOnContact: false,
};

// ── Lookup ───────────────────────────────────────────────────────────────────

/** Returns the behavior descriptor for a given component type string. */
export function getBehavior(componentType: string): ComponentBehavior {
  return COMPONENT_BEHAVIORS[componentType] ?? PASSIVE_BEHAVIOR;
}

// ── Priority-ordered role resolution ─────────────────────────────────────────
// Used to pick the dominant color/description when multiple components are merged.
// Order: most visually significant / gameplay-defining first.

const PRIORITY_ORDER: string[] = [
  "StaticObstacleComponent",
  "HomingMovementComponent",
  "AddScoreOnCollideComponent",
  "DamageOnCollideComponent",
  "RemoveOnCollideComponent",
  "TransformTargetIntoSelfComponent",
  "GrowOnCollideComponent",
  "FreezeOnCollideComponent",
  "EntityDamageOnCollideComponent",
  "FleeTargetComponent",
  "RandomMovementComponent",
  "PatrolBetweenPointsComponent",
  "IncreaseSpeedOverTimeComponent",
  "SpawnPeriodicallyComponent",
  "ShrinkOnCollideComponent",
  "StopMovementOnCollideComponent",
  "ApplyForceOnCollideComponent",
  "SpawnEntityOnRemoveComponent",
  "ShrinkOverTimeComponent",
  "GrowOverTimeComponent",
];

/**
 * Merges all component behaviors into one object by OR-ing every boolean flag.
 * color and description are taken from the highest-priority component in the list.
 * Use this in GameCanvas to combine intrinsic + relational components per entity.
 */
export function mergeBehaviors(componentTypes: string[]): ComponentBehavior {
  if (componentTypes.length === 0) return PASSIVE_BEHAVIOR;
  const behaviors = componentTypes.map(getBehavior);

  // Pick primary for color/description based on priority order
  let primary = PASSIVE_BEHAVIOR;
  for (const name of PRIORITY_ORDER) {
    if (componentTypes.includes(name)) {
      primary = getBehavior(name);
      break;
    }
  }

  return {
    placement: primary.placement,
    color: primary.color,
    description: primary.description,
    isStatic:               behaviors.some((b) => b.isStatic),
    movesTowardPlayer:      behaviors.some((b) => b.movesTowardPlayer),
    movesAwayFromPlayer:    behaviors.some((b) => b.movesAwayFromPlayer),
    wandersRandomly:        behaviors.some((b) => b.wandersRandomly),
    patrolsBackAndForth:    behaviors.some((b) => b.patrolsBackAndForth),
    acceleratesOverTime:    behaviors.some((b) => b.acceleratesOverTime),
    growsOverTime:          behaviors.some((b) => b.growsOverTime),
    shrinksOverTime:        behaviors.some((b) => b.shrinksOverTime),
    spawnsOnInterval:       behaviors.some((b) => b.spawnsOnInterval),
    removeOnContact:        behaviors.some((b) => b.removeOnContact),
    damagesPlayer:          behaviors.some((b) => b.damagesPlayer),
    scoreOnContact:         behaviors.some((b) => b.scoreOnContact),
    growsOnContact:         behaviors.some((b) => b.growsOnContact),
    shrinksPlayerOnContact: behaviors.some((b) => b.shrinksPlayerOnContact),
    pushesPlayerOnContact:  behaviors.some((b) => b.pushesPlayerOnContact),
    freezesPlayerOnContact: behaviors.some((b) => b.freezesPlayerOnContact),
    freezesSelfOnContact:   behaviors.some((b) => b.freezesSelfOnContact),
    damagesEntityOnContact: behaviors.some((b) => b.damagesEntityOnContact),
  };
}

/**
 * Returns the single highest-priority behavior from a list of component types.
 * Used by page.tsx for the UI legend.
 */
export function dominantBehavior(componentTypes: string[]): ComponentBehavior {
  if (componentTypes.length === 0) return PASSIVE_BEHAVIOR;
  for (const name of PRIORITY_ORDER) {
    if (componentTypes.includes(name)) return getBehavior(name);
  }
  return PASSIVE_BEHAVIOR;
}
