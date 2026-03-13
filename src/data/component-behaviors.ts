// component-behaviors.ts
// Maps entity-attribute keys (from entity-attributes.ts) and interaction
// attribute names (from <interaction attribute="...">) directly to runtime
// behavior flags consumed by GameCanvas and the UI legend.
//
// There is NO indirection through component name strings anymore.
// The XML <behavior> element attributes and <interaction attribute="...">
// values map 1-to-1 to the keys in ATTRIBUTE_BEHAVIORS below.

// ── Runtime behavior descriptor ───────────────────────────────────────────────

export interface EntityBehavior {
  /** Phaser hex color for this entity in the canvas. */
  color: number;
  /** One-line label shown in the in-game entity legend. */
  description: string;

  // ── Movement flags (from <behavior> attributes) ───────────────────────────
  /** Entity is added to a StaticGroup and never moves. */
  isStatic: boolean;
  /** Entity moves (player-controlled, chasing, fleeing, wandering, patrolling). */
  movesAnyWay: boolean;
  /** Entity moves directly away from the player every frame. */
  isFleeing: boolean;
  /** Entity grows by 0.02 px each frame continuously. */
  growsOverTime: boolean;
  /** Entity shrinks by 0.03 px each frame; auto-destroyed when width < 4 px. */
  shrinksOverTime: boolean;

  // ── Interaction / collision flags (from <interaction attribute="..."> values) ─

  /** This entity is destroyed when it overlaps the colliding entity (isRemovedBy). */
  isRemovedBy: boolean;
  /** This entity grows by 6 px on overlap with the colliding entity (growsBy). */
  growsBy: boolean;
  /** The player (or colliding entity) shrinks by 6 px on overlap (shrinksBy). */
  shrinksBy: boolean;
  /** This entity's velocity is zeroed for 1.2 s on overlap (stopsBy). */
  stopsBy: boolean;
  /** This entity loses 1 HP on overlap; destroyed at 0 HP (isDamagedBy). */
  isDamagedBy: boolean;
  /** The chasing entity homes toward this entity every frame (chasedBy — adds HomingMovement to chaser). */
  chasedBy: boolean;
}

// ── Behavior per boolean <behavior> attribute ─────────────────────────────────
// These describe what a SINGLE attribute being true means for rendering/AI.

export const BEHAVIOR_ATTRIBUTE_META: Record<string, { color: number; description: string }> = {
  isStatic:       { color: 0x7f8c8d, description: "Never moves — position is fixed" },
  movesAnyWay:    { color: 0x9b59b6, description: "Moves around the arena (chasing, wandering, or player-controlled)" },
  isFleeing:      { color: 0xf39c12, description: "Flees — moves directly away from the player" },
  growsOverTime:  { color: 0x27ae60, description: "Grows continuously over time" },
  shrinksOverTime:{ color: 0x636e72, description: "Shrinks continuously; destroyed when too small" },

  // interaction attributes
  isRemovedBy:    { color: 0xe67e22, description: "Removed on contact with its actor" },
  growsBy:        { color: 0x2ecc71, description: "Grows by 6 px on contact with its actor" },
  shrinksBy:      { color: 0xbdc3c7, description: "Causes the player to shrink by 6 px on contact" },
  stopsBy:        { color: 0x74b9ff, description: "Freezes this entity for 1.2 s on contact" },
  isDamagedBy:    { color: 0xc0392b, description: "Loses 1 HP on contact; destroyed at 0 HP" },
  chasedBy:       { color: 0xc0392b, description: "Chased by another entity" },
};

// Priority order for picking the dominant color/description when multiple
// attributes are active (most gameplay-significant first).
const ATTRIBUTE_PRIORITY: string[] = [
  "isStatic",
  "isDamagedBy",
  "isRemovedBy",
  "chasedBy",
  "isFleeing",
  "growsBy",
  "shrinksBy",
  "stopsBy",
  "growsOverTime",
  "shrinksOverTime",
  "movesAnyWay",
];

// ── Helpers consumed by GameCanvas and page.tsx ───────────────────────────────

/**
 * Builds an EntityBehavior from a parsed entity's behavior attributes map
 * plus the interaction attribute names that apply to this entity.
 *
 * Attribute ownership rules (which entity "owns" the flag):
 *   isRemovedBy  → TARGET owns it  (Deer isRemovedBy Lion  → Deer.isRemovedBy = true)
 *   isDamagedBy  → TARGET owns it  (Player isDamagedBy Enemy → Player.isDamagedBy = true)
 *   chasedBy     → TARGET owns it  (Deer chasedBy Lion → Deer.chasedBy = true; Lion gets homing)
 *   stopsBy      → TARGET owns it  (Entity stopsBy Wall → Entity's velocity is zeroed on contact)
 *   growsBy      → ACTOR owns it   (actor="Entity" growsBy → Entity grows on contact)
 *   shrinksBy    → ACTOR owns it   (actor="Entity" shrinksBy → player shrinks on contact)
 *
 * @param behaviorAttrs  — key/value pairs from <behavior> element
 * @param asTargetAttrs  — attribute names where this entity is the TARGET
 *                         (e.g. Deer in actor="Lion" target="Deer" attribute="isRemovedBy")
 * @param asActorAttrs   — attribute names where this entity is the ACTOR
 *                         (e.g. Entity in actor="Entity" target="Player" attribute="growsBy")
 */
export function buildBehavior(
  behaviorAttrs: Record<string, boolean | string | null>,
  asTargetAttrs: string[],
  asActorAttrs: string[] = []
): EntityBehavior {
  const targetSet = new Set(asTargetAttrs.map((a) => a.toLowerCase()));
  const actorSet  = new Set(asActorAttrs.map((a) => a.toLowerCase()));

  const behavior: EntityBehavior = {
    color: 0x9b59b6,
    description: "Entity",
    isStatic:        behaviorAttrs["isStatic"]        === true,
    movesAnyWay:     behaviorAttrs["movesAnyWay"]     === true,
    isFleeing:       behaviorAttrs["isFleeing"]       === true,
    growsOverTime:   behaviorAttrs["growsOverTime"]   === true,
    shrinksOverTime: behaviorAttrs["shrinksOverTime"] === true,
    // target-owned: this entity IS the one receiving these effects
    isRemovedBy: targetSet.has("isremovedby"),
    isDamagedBy: targetSet.has("isdamagedby"),
    chasedBy:    targetSet.has("chasedby"),
    stopsBy:     targetSet.has("stopsby"),
    // actor-owned: this entity IS the one applying these effects
    growsBy:   actorSet.has("growsby"),
    shrinksBy: actorSet.has("shrinksby"),
  };

  // Pick dominant color/description
  for (const key of ATTRIBUTE_PRIORITY) {
    if (behavior[key as keyof EntityBehavior] === true) {
      const meta = BEHAVIOR_ATTRIBUTE_META[key];
      if (meta) {
        behavior.color = meta.color;
        behavior.description = meta.description;
        break;
      }
    }
  }

  return behavior;
}

/**
 * Returns the color for a given interaction attribute name.
 * Used by page.tsx to color interaction chips.
 */
export function interactionColor(attribute: string): number {
  return BEHAVIOR_ATTRIBUTE_META[attribute]?.color ?? 0x9b59b6;
}

/**
 * Returns the description for a given interaction attribute name.
 */
export function interactionDescription(attribute: string): string {
  return BEHAVIOR_ATTRIBUTE_META[attribute]?.description ?? attribute;
}
