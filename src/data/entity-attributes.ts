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
  // ── Intrinsic / movement attributes ──────────────────────────────────────

  {
    key: "isStatic",
    type: "boolean",
    description:
      "True if the entity never moves; acts as an immovable obstacle or barrier.",
    default: false,
  },
  {
    key: "isPlayer",
    type: "boolean",
    description:
      "True if this entity is controlled by the human player via keyboard/gamepad input.",
    default: false,
  },
  {
    key: "movesTowardPlayer",
    type: "boolean",
    description:
      "True if this entity actively homes in on / chases the player character.",
    default: false,
  },
  {
    key: "movesAwayFromPlayer",
    type: "boolean",
    description:
      "True if this entity actively flees or runs away from the player character.",
    default: false,
  },
  {
    key: "wandersRandomly",
    type: "boolean",
    description:
      "True if this entity moves in random, unpredictable directions with no fixed target.",
    default: false,
  },
  {
    key: "patrolsBackAndForth",
    type: "boolean",
    description:
      "True if this entity moves back and forth along a fixed path or area.",
    default: false,
  },
  {
    key: "acceleratesOverTime",
    type: "boolean",
    description:
      "True if this entity's movement speed increases progressively over time.",
    default: false,
  },

  // ── Size / lifecycle attributes ───────────────────────────────────────────

  {
    key: "canGrow",
    type: "boolean",
    description:
      "True if this entity can increase in size — either continuously over time or when it contacts another entity.",
    default: false,
  },
  {
    key: "canShrink",
    type: "boolean",
    description:
      "True if this entity can decrease in size — either continuously over time or when it contacts another entity.",
    default: false,
  },
  {
    key: "canSpawn",
    type: "boolean",
    description:
      "True if this entity periodically creates new copies (clones) of itself at a set interval.",
    default: false,
  },

  // ── Relational / collision attributes (value = entity name or null) ───────

  {
    key: "isRemovedBy",
    type: "entity",
    description:
      "The name of the entity that causes this entity to be removed (destroyed) upon collision. Set to null if no entity removes it.",
    default: null,
  },
  {
    key: "damagesOn",
    type: "entity",
    description:
      "The name of the entity that this entity deals damage to upon collision. Set to null if it does not damage anything.",
    default: null,
  },
  {
    key: "scoresOn",
    type: "entity",
    description:
      "The name of the entity that this entity awards score to when they collide. Set to null if no score is awarded.",
    default: null,
  },
  {
    key: "growsOnContactWith",
    type: "entity",
    description:
      "The name of the entity that causes this entity to grow in size on collision. Set to null if contact with nothing makes it grow.",
    default: null,
  },
  {
    key: "shrinksOnContactWith",
    type: "entity",
    description:
      "The name of the entity that causes this entity to shrink on collision. Set to null if contact with nothing makes it shrink.",
    default: null,
  },
  {
    key: "pushesOnContact",
    type: "entity",
    description:
      "The name of the entity that this entity applies a knockback / repulsive force to on collision. Set to null if it pushes nothing.",
    default: null,
  },
  {
    key: "freezesOnContact",
    type: "entity",
    description:
      "The name of the entity that this entity temporarily immobilizes (stops movement of) on collision. Set to null if it freezes nothing.",
    default: null,
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
