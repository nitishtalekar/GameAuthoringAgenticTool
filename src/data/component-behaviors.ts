// component-behaviors.ts
// Maps every micro-rhetoric component type → its runtime behavior descriptor.
// Used by GameCanvas to determine AI movement, collision effects, and visual identity.
//
// Behavior design notes:
//   - "movesTowardPlayer" / "movesAwayFromPlayer" govern AI locomotion each frame.
//   - "removeOnContact"  → the non-player entity is destroyed when it touches the player.
//   - "damagesPlayer"    → player loses 1 HP when touching this entity.
//   - "scoreOnContact"   → player gains +1 score when touching this entity.
//   - "growsOnContact"   → the entity grows in size when it collides with its target.
//   - "isStatic"         → placed as a StaticGroup obstacle; never moves.
//
// Each component maps to exactly one dominant BehaviorRole used for bucketing in GameCanvas.

export type BehaviorRole =
  | "chaser"            // SeekTargetComponent, HomingMovementComponent
  | "fleeer"            // FleeTargetComponent
  | "obstacle"          // StaticObstacleComponent
  | "absorber"          // RemoveTargetAndGrowComponent
  | "damager"           // DamageOnCollideComponent
  | "collector"         // AddScoreOnCollideComponent
  | "remover"           // RemoveOnCollideComponent
  | "wanderer"          // RandomMovementComponent
  | "patrol"            // PatrolBetweenPointsComponent
  | "spawner"           // SpawnPeriodicallyComponent
  | "grower"            // GrowOnCollideComponent
  | "shrinker"          // ShrinkOnCollideComponent
  | "reflector"         // ReflectOnCollideComponent
  | "pusher"            // ApplyForceOnCollideComponent
  | "freezer"           // StopMovementOnCollideComponent
  | "stopper"           // StopOnCollideComponent — captures player (stops it)
  | "converter"         // TransformTargetIntoSelfComponent
  | "swapper"           // ExchangeMovementOrStateComponent
  | "empowerer"         // IncreaseSizeOrSpeedComponent
  | "weakener"          // ReduceCapabilitiesComponent
  | "disabler"          // TimedDisableComponent
  | "watcher"           // TriggerEventOnProximityComponent
  | "influencer"        // ModifyTargetParametersComponent
  | "decayer"           // ShrinkOverTimeComponent
  | "accelerator"       // IncreaseSpeedOverTimeComponent
  | "spawner_on_remove" // SpawnEntityOnRemoveComponent
  | "meter_drainer"     // DecreaseMeterOverTimeComponent
  | "meter_charger"     // IncreaseMeterOnEventComponent
  | "resource_consumer" // RemoveResourceOnUseComponent
  | "passive";          // unknown / no mapped effect

export interface ComponentBehavior {
  role: BehaviorRole;
  /** Phaser hex color used for entities whose dominant behavior is this role */
  color: number;
  /** If true, treated as a StaticGroup obstacle (immovable) */
  isStatic: boolean;
  /** If true, AI moves toward the player each frame */
  movesTowardPlayer: boolean;
  /** If true, AI moves away from the player each frame */
  movesAwayFromPlayer: boolean;
  /** If true, this entity is removed on contact with the player */
  removeOnContact: boolean;
  /** If true, the player loses health on contact */
  damagesPlayer: boolean;
  /** If true, the player gains score on contact */
  scoreOnContact: boolean;
  /** If true, this entity grows in size when it contacts its target */
  growsOnContact: boolean;
  /** Human-readable summary shown in the entity legend */
  description: string;
}

export const COMPONENT_BEHAVIORS: Record<string, ComponentBehavior> = {

  // ── Control / Movement ────────────────────────────────────────────────────

  /** Actively seeks and chases the player. Damages on contact (touch = threat). */
  SeekTargetComponent: {
    role: "chaser", color: 0xe74c3c, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Chases the player — avoid contact",
  },

  /** Homes in on the player; faster and more aggressive. Damages on contact. */
  HomingMovementComponent: {
    role: "chaser", color: 0xc0392b, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Locks onto player and chases relentlessly",
  },

  /** Flees from the player — catch it for a reward. Does not damage. */
  FleeTargetComponent: {
    role: "fleeer", color: 0xf39c12, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: true,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true, growsOnContact: false,
    description: "Runs away — catch it for points",
  },

  /** An immovable wall or barrier placed in the arena. */
  StaticObstacleComponent: {
    role: "obstacle", color: 0x7f8c8d, isStatic: true,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Immovable obstacle — blocks movement",
  },

  /** Wanders unpredictably. Harmless unless it carries another component. */
  RandomMovementComponent: {
    role: "wanderer", color: 0x9b59b6, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Drifts in random directions",
  },

  /** Patrols a fixed route — can block passage. Damages on contact. */
  PatrolBetweenPointsComponent: {
    role: "patrol", color: 0x1abc9c, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Patrols a fixed route — stay clear",
  },

  // ── Interaction / Collision ───────────────────────────────────────────────

  /** Absorbs the player's target: entity grows and target is removed. Scores. */
  RemoveTargetAndGrowComponent: {
    role: "absorber", color: 0x2ecc71, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true, growsOnContact: true,
    description: "Absorbs on contact — collect for score",
  },

  /** Pure damage dealer — player loses HP on contact, entity persists. */
  DamageOnCollideComponent: {
    role: "damager", color: 0xc0392b, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Damages the player on contact",
  },

  /** Collectible — player gains score and the entity is removed. */
  AddScoreOnCollideComponent: {
    role: "collector", color: 0xf1c40f, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true, growsOnContact: false,
    description: "Collectible — touch for points",
  },

  /** Removes itself and damages the player on contact (mutual destruction). */
  RemoveOnCollideComponent: {
    role: "remover", color: 0xe67e22, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: true, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Destroys itself and hurts player on contact",
  },

  /** Stops the player on contact (capture mechanic) — player takes damage. */
  StopOnCollideComponent: {
    role: "stopper", color: 0xd35400, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Pursues and captures the player",
  },

  /** Grows when touching its target. Chases to absorb — threatens player. */
  GrowOnCollideComponent: {
    role: "grower", color: 0x27ae60, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: true,
    description: "Grows larger on every contact",
  },

  /** Shrinks the player on contact. Wanders or chases. */
  ShrinkOnCollideComponent: {
    role: "shrinker", color: 0xbdc3c7, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Shrinks the player on contact",
  },

  /** Reverses the player's direction on contact. Does not damage directly. */
  ReflectOnCollideComponent: {
    role: "reflector", color: 0x3498db, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Bounces the player back on contact",
  },

  /** Pushes the player away on contact. Does not deal direct HP damage. */
  ApplyForceOnCollideComponent: {
    role: "pusher", color: 0xe67e22, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Pushes the player away on contact",
  },

  /** Freezes / halts the player's movement temporarily on contact. */
  StopMovementOnCollideComponent: {
    role: "freezer", color: 0x74b9ff, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Halts player movement on contact",
  },

  // ── Transformation ────────────────────────────────────────────────────────

  /** Spreads its type — converts other entities on contact. Chases targets. */
  TransformTargetIntoSelfComponent: {
    role: "converter", color: 0x6c5ce7, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Converts touched entities into its own kind",
  },

  /** Swaps movement/state with touched entity. Neutral — neither helps nor harms. */
  ExchangeMovementOrStateComponent: {
    role: "swapper", color: 0xa29bfe, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Swaps behavior with touched entity",
  },

  /** Boosts the player's size or speed on contact. Beneficial pick-up. */
  IncreaseSizeOrSpeedComponent: {
    role: "empowerer", color: 0x00b894, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true, growsOnContact: false,
    description: "Power-up — boosts size or speed on contact",
  },

  /** Weakens the player on contact (reduces speed/size). Harmful. */
  ReduceCapabilitiesComponent: {
    role: "weakener", color: 0x636e72, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Weakens the player on contact",
  },

  /** Temporarily stuns / disables the player on contact. */
  TimedDisableComponent: {
    role: "disabler", color: 0xfdcb6e, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Disables player movement temporarily",
  },

  // ── Proximity / Passive ───────────────────────────────────────────────────

  /** Triggers an event when player is nearby. Wanderer — does not actively chase. */
  TriggerEventOnProximityComponent: {
    role: "watcher", color: 0x55efc4, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Reacts when the player gets close",
  },

  /** Modifies nearby entity parameters. Neutral wanderer. */
  ModifyTargetParametersComponent: {
    role: "influencer", color: 0xb2bec3, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Alters behavior of nearby entities",
  },

  // ── Time-based ────────────────────────────────────────────────────────────

  /** Shrinks over time and disappears — harmless but creates urgency. */
  ShrinkOverTimeComponent: {
    role: "decayer", color: 0x636e72, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Fades and disappears over time",
  },

  /** Speeds up over time and chases — escalating threat. */
  IncreaseSpeedOverTimeComponent: {
    role: "accelerator", color: 0xff7675, isStatic: false,
    movesTowardPlayer: true, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: true, scoreOnContact: false, growsOnContact: false,
    description: "Accelerates over time — growing threat",
  },

  /** Spawns new entities periodically. Wanderer, does not chase. */
  SpawnPeriodicallyComponent: {
    role: "spawner", color: 0x8e44ad, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Periodically creates more of its kind",
  },

  /** When destroyed, spawns child entities. Does not chase. */
  SpawnEntityOnRemoveComponent: {
    role: "spawner_on_remove", color: 0x6d4c41, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Spawns entities when destroyed",
  },

  // ── Resource / Meter ─────────────────────────────────────────────────────

  /** Drains a resource meter over time. Passive — no contact effect. */
  DecreaseMeterOverTimeComponent: {
    role: "meter_drainer", color: 0xe17055, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Drains a resource meter over time",
  },

  /** Fills a meter on a triggering event. Beneficial pick-up. */
  IncreaseMeterOnEventComponent: {
    role: "meter_charger", color: 0x00cec9, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: true, growsOnContact: false,
    description: "Charges a meter — collect it",
  },

  /** Consumed and removed when the player interacts with it. */
  RemoveResourceOnUseComponent: {
    role: "resource_consumer", color: 0xfab1a0, isStatic: false,
    movesTowardPlayer: false, movesAwayFromPlayer: false,
    removeOnContact: true, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
    description: "Consumed on use",
  },
};

const PASSIVE_BEHAVIOR: ComponentBehavior = {
  role: "passive", color: 0x9b59b6, isStatic: false,
  movesTowardPlayer: false, movesAwayFromPlayer: false,
  removeOnContact: false, damagesPlayer: false, scoreOnContact: false, growsOnContact: false,
  description: "Unknown component — no runtime effect",
};

/** Returns the behavior descriptor for a given component type string. */
export function getBehavior(componentType: string): ComponentBehavior {
  return COMPONENT_BEHAVIORS[componentType] ?? PASSIVE_BEHAVIOR;
}

/**
 * Given a list of component types, returns the single most gameplay-significant
 * behavior using a fixed priority order.
 *
 * Priority: obstacle > chaser > absorber > collector > damager > remover >
 *           stopper > converter > grower > fleeer > wanderer > patrol >
 *           accelerator > spawner > shrinker > disabler > weakener >
 *           empowerer > reflector > pusher > freezer > swapper >
 *           spawner_on_remove > decayer > watcher > influencer >
 *           meter_drainer > meter_charger > resource_consumer > passive
 */
const ROLE_PRIORITY: BehaviorRole[] = [
  "obstacle", "chaser", "absorber", "collector", "damager", "remover",
  "stopper", "converter", "grower", "fleeer", "wanderer", "patrol",
  "accelerator", "spawner", "shrinker", "disabler", "weakener",
  "empowerer", "reflector", "pusher", "freezer", "swapper",
  "spawner_on_remove", "decayer", "watcher", "influencer",
  "meter_drainer", "meter_charger", "resource_consumer", "passive",
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
