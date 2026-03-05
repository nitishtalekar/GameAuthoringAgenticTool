// component-behaviors.ts
// Maps every micro-rhetoric component type → its runtime behavior descriptor.
// Used by GameCanvas to determine AI movement, collision effects, and visual identity.

export type BehaviorRole =
  | "wanderer"          // RandomMovementComponent
  | "patrol"            // PatrolBetweenPointsComponent
  | "chaser"            // HomingMovementComponent
  | "fleeer"            // FleeTargetComponent
  | "grower_over_time"  // GrowOverTimeComponent
  | "decayer"           // ShrinkOverTimeComponent
  | "accelerator"       // IncreaseSpeedOverTimeComponent
  | "spawner"           // SpawnPeriodicallyComponent
  | "obstacle"          // StaticObstacleComponent
  | "collector"         // AddScoreOnCollideComponent
  | "damager"           // DamageOnCollideComponent
  | "remover"           // RemoveOnCollideComponent
  | "grower"            // GrowOnCollideComponent
  | "shrinker"          // ShrinkOnCollideComponent
  | "spawner_on_remove" // SpawnEntityOnRemoveComponent
  | "pusher"            // ApplyForceOnCollideComponent
  | "freezer"           // StopMovementOnCollideComponent
  | "converter"         // TransformTargetIntoSelfComponent
  | "passive";          // unknown / no mapped effect

export interface ComponentBehavior {
  role: BehaviorRole;
  /** Phaser hex color used for entities whose dominant behavior is this role */
  color: number;

  // ── Intrinsic / movement flags ─────────────────────────────────────────────
  /** Placed as a StaticGroup obstacle — never moves */
  isStatic: boolean;
  /** AI moves toward the player each frame */
  movesTowardPlayer: boolean;
  /** AI moves away from the player each frame */
  movesAwayFromPlayer: boolean;
  /** Moves back-and-forth between two X patrol points */
  patrolsBackAndForth: boolean;
  /** Speed increases each second */
  acceleratesOverTime: boolean;
  /** Entity size grows each frame */
  growsOverTime: boolean;
  /** Entity size shrinks each frame; destroyed when below minimum */
  shrinksOverTime: boolean;
  /** Periodically spawns a clone of itself */
  spawnsOnInterval: boolean;

  // ── Collision-triggered effect flags ──────────────────────────────────────
  /** Entity is removed when it contacts the player */
  removeOnContact: boolean;
  /** Player loses 1 HP on contact */
  damagesPlayer: boolean;
  /** Player gains +1 score on contact */
  scoreOnContact: boolean;
  /** This entity grows larger on contact with the player */
  growsOnContact: boolean;
  /** Player shrinks on contact */
  shrinksPlayerOnContact: boolean;
  /** Player is knocked back on contact */
  pushesPlayerOnContact: boolean;
  /** Player velocity is zeroed briefly on contact */
  freezesPlayerOnContact: boolean;

  /** Human-readable summary shown in the entity legend */
  description: string;
}

export const COMPONENT_BEHAVIORS: Record<string, ComponentBehavior> = {

  // ── Individual: self-contained behaviors ─────────────────────────────────

  RandomMovementComponent: {
    role: "wanderer", color: 0x9b59b6, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Drifts in random directions",
  },

  PatrolBetweenPointsComponent: {
    role: "patrol", color: 0x1abc9c, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: true,
    acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Patrols a fixed route — stay clear",
  },

  HomingMovementComponent: {
    role: "chaser", color: 0xc0392b, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Locks onto player and chases relentlessly",
  },

  FleeTargetComponent: {
    role: "fleeer", color: 0xf39c12, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: true,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Runs away — catch it for points",
  },

  GrowOverTimeComponent: {
    role: "grower_over_time", color: 0x27ae60, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: true,
    shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Grows larger over time",
  },

  ShrinkOverTimeComponent: {
    role: "decayer", color: 0x636e72, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false,
    shrinksOverTime: true,
    spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Fades and disappears over time",
  },

  IncreaseSpeedOverTimeComponent: {
    role: "accelerator", color: 0xff7675, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    patrolsBackAndForth: false,
    acceleratesOverTime: true,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Accelerates over time — growing threat",
  },

  SpawnPeriodicallyComponent: {
    role: "spawner", color: 0x8e44ad, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false,
    spawnsOnInterval: true,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Periodically creates more of its kind",
  },

  StaticObstacleComponent: {
    role: "obstacle", color: 0x7f8c8d, isStatic: true,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Immovable obstacle — blocks movement",
  },

  // ── Relational: collision-triggered effects ───────────────────────────────

  AddScoreOnCollideComponent: {
    role: "collector", color: 0xf1c40f, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Collectible — touch for points",
  },

  DamageOnCollideComponent: {
    role: "damager", color: 0xc0392b, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Damages the player on contact",
  },

  RemoveOnCollideComponent: {
    role: "remover", color: 0xe67e22, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: true, damagesPlayer: true, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Destroys itself and hurts player on contact",
  },

  GrowOnCollideComponent: {
    role: "grower", color: 0x2ecc71, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: true,
    shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Grows larger on every contact",
  },

  ShrinkOnCollideComponent: {
    role: "shrinker", color: 0xbdc3c7, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false,
    shrinksPlayerOnContact: true,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Shrinks the player on contact",
  },

  SpawnEntityOnRemoveComponent: {
    role: "spawner_on_remove", color: 0x6d4c41, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Spawns entities when destroyed",
  },

  ApplyForceOnCollideComponent: {
    role: "pusher", color: 0xe67e22, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: true,
    freezesPlayerOnContact: false,
    description: "Pushes the player away on contact",
  },

  StopMovementOnCollideComponent: {
    role: "freezer", color: 0x74b9ff, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false,
    freezesPlayerOnContact: true,
    description: "Halts player movement on contact",
  },

  TransformTargetIntoSelfComponent: {
    role: "converter", color: 0x6c5ce7, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    patrolsBackAndForth: false, acceleratesOverTime: false,
    growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
    growsOnContact: false, shrinksPlayerOnContact: false,
    pushesPlayerOnContact: false, freezesPlayerOnContact: false,
    description: "Converts touched entities into its own kind",
  },
};

const PASSIVE_BEHAVIOR: ComponentBehavior = {
  role: "passive", color: 0x9b59b6, isStatic: false,
  movesTowardPlayer: false, movesAwayFromPlayer: false,
  patrolsBackAndForth: false, acceleratesOverTime: false,
  growsOverTime: false, shrinksOverTime: false, spawnsOnInterval: false,
  removeOnContact: false, damagesPlayer: false, scoreOnContact: false,
  growsOnContact: false, shrinksPlayerOnContact: false,
  pushesPlayerOnContact: false, freezesPlayerOnContact: false,
  description: "Unknown component — no runtime effect",
};

/** Returns the behavior descriptor for a given component type string. */
export function getBehavior(componentType: string): ComponentBehavior {
  return COMPONENT_BEHAVIORS[componentType] ?? PASSIVE_BEHAVIOR;
}

/**
 * Given a list of component types, returns the single most gameplay-significant
 * behavior using a fixed priority order. Used by page.tsx for the UI legend.
 */
const ROLE_PRIORITY: BehaviorRole[] = [
  "obstacle", "chaser", "collector", "damager", "remover",
  "converter", "grower", "fleeer", "wanderer", "patrol",
  "accelerator", "spawner", "shrinker", "freezer", "pusher",
  "spawner_on_remove", "decayer", "grower_over_time", "passive",
];

export function dominantBehavior(componentTypes: string[]): ComponentBehavior {
  if (componentTypes.length === 0) return PASSIVE_BEHAVIOR;
  const behaviors = componentTypes.map(getBehavior);
  for (const role of ROLE_PRIORITY) {
    const match = behaviors.find((b) => b.role === role);
    if (match) return match;
  }
  return PASSIVE_BEHAVIOR;
}

/**
 * Merges all component behaviors into one object by OR-ing all boolean flags.
 * Color, role, and description are taken from the highest-priority behavior.
 * Use this in GameCanvas to correctly combine intrinsic + relational components.
 */
export function mergeBehaviors(componentTypes: string[]): ComponentBehavior {
  if (componentTypes.length === 0) return PASSIVE_BEHAVIOR;
  const behaviors = componentTypes.map(getBehavior);

  // Priority-ordered color/role/description selection
  let primary = PASSIVE_BEHAVIOR;
  for (const role of ROLE_PRIORITY) {
    const match = behaviors.find((b) => b.role === role);
    if (match) { primary = match; break; }
  }

  return {
    role: primary.role,
    color: primary.color,
    description: primary.description,
    isStatic: behaviors.some((b) => b.isStatic),
    movesTowardPlayer: behaviors.some((b) => b.movesTowardPlayer),
    movesAwayFromPlayer: behaviors.some((b) => b.movesAwayFromPlayer),
    patrolsBackAndForth: behaviors.some((b) => b.patrolsBackAndForth),
    acceleratesOverTime: behaviors.some((b) => b.acceleratesOverTime),
    growsOverTime: behaviors.some((b) => b.growsOverTime),
    shrinksOverTime: behaviors.some((b) => b.shrinksOverTime),
    spawnsOnInterval: behaviors.some((b) => b.spawnsOnInterval),
    removeOnContact: behaviors.some((b) => b.removeOnContact),
    damagesPlayer: behaviors.some((b) => b.damagesPlayer),
    scoreOnContact: behaviors.some((b) => b.scoreOnContact),
    growsOnContact: behaviors.some((b) => b.growsOnContact),
    shrinksPlayerOnContact: behaviors.some((b) => b.shrinksPlayerOnContact),
    pushesPlayerOnContact: behaviors.some((b) => b.pushesPlayerOnContact),
    freezesPlayerOnContact: behaviors.some((b) => b.freezesPlayerOnContact),
  };
}
