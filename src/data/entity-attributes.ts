// entity-attributes.ts
// Canonical list of entity attributes used to build the entity attribute state.
//
// Each attribute has:
//   key         — the JSON/state field name
//   type        — "boolean" (true/false) or "entity" (entity name or null)
//   description — LLM-facing explanation; edit these to guide the agent
//   default     — initial value: false for booleans, null for entity-refs
//
// The LLM Entity Attribute Agent (step 3) reads this list and assigns
// a value to every attribute for every entity in the game.

export type AttributeValueType = "boolean" | "entity";

export interface EntityAttribute {
  key: string;
  type: AttributeValueType;
  description: string;
  default: boolean | null;
}

export const ENTITY_ATTRIBUTES: EntityAttribute[] = [
  // ── Identity ────────────────────────────────────────────────────────────────

  {
    key: "isPlayer",
    type: "boolean",
    description:
      "True if this entity is controlled by the human player. Exactly one entity should have this set to true.",
    default: false,
  },
  {
    key: "isStatic",
    type: "boolean",
    description:
      "True if the entity never moves; acts as an immovable obstacle or barrier (maps to StaticObstacleComponent).",
    default: false,
  },

  // ── Movement ─────────────────────────────────────────────────────────────────

  {
    key: "movesAnyWay",
    type: "boolean",
    description:
      "True if the entity moves in any way — chasing, fleeing, wandering, patrolling, or player-controlled. Set to false only for fully static entities.",
    default: false,
  },

  // ── Size / lifecycle ─────────────────────────────────────────────────────────

  {
    key: "growsOverTime",
    type: "boolean",
    description:
      "True if this entity continuously grows larger over time on its own, independent of collisions (maps to GrowOverTimeComponent).",
    default: false,
  },
  {
    key: "shrinksOverTime",
    type: "boolean",
    description:
      "True if this entity continuously shrinks over time on its own, independent of collisions (maps to ShrinkOverTimeComponent).",
    default: false,
  },

  // ── Relational / collision attributes (value = entity name or null) ──────────

  {
    key: "isRemovedBy",
    type: "entity",
    description:
      "The name of the entity that causes this entity to be removed (destroyed) upon collision (maps to RemoveOnCollideComponent on the remover). Set to null if no entity removes it.",
    default: null,
  },
  {
    key: "growsBy",
    type: "entity",
    description:
      "The name of the entity that causes this entity to grow on collision (maps to GrowOnCollideComponent). Set to null if contact with nothing makes it grow.",
    default: null,
  },
  {
    key: "shrinksBy",
    type: "entity",
    description:
      "The name of the entity that causes this entity to shrink on collision (maps to ShrinkOnCollideComponent). Set to null if contact with nothing makes it shrink.",
    default: null,
  },
  {
    key: "stopsBy",
    type: "entity",
    description:
      "The name of the entity that temporarily freezes / halts this entity's movement on collision (maps to StopMovementOnCollideComponent). Set to null if nothing stops it.",
    default: null,
  },
  {
    key: "isDamagedBy",
    type: "entity",
    description:
      "The name of the entity that deals damage to this entity on collision (maps to DamageOnCollideComponent on the damager). Set to null if nothing damages it.",
    default: null,
  },
  {
    key: "chasedBy",
    type: "entity",
    description:
      "The name of the entity that actively homes in on and pursues this entity (maps to HomingMovementComponent on the chaser). Set to null if nothing chases it.",
    default: null,
  },
  {
    key: "isFleeing",
    type: "boolean",
    description:
      "True if this entity moves away from the player or a threat (maps to FleeTargetComponent).",
    default: false,
  },
];

// ── Formatting helper for LLM prompts ────────────────────────────────────────

/**
 * Returns a bullet-list string of all attribute keys, types, and descriptions.
 * Inject this into the Entity Attribute Agent's system prompt.
 */
export function formatEntityAttributesForPrompt(): string {
  return ENTITY_ATTRIBUTES.map(
    (a) => `- ${a.key} [${a.type}]: ${a.description}`
  ).join("\n");
}

/**
 * Returns a blank attribute map (all defaults) for a single entity.
 * Used to initialise the state structure before the LLM fills in real values.
 */
export function defaultAttributeMap(): Record<string, boolean | null> {
  return Object.fromEntries(ENTITY_ATTRIBUTES.map((a) => [a.key, a.default]));
}
