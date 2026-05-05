export interface PropertySpec {
  key: string;       // dot-notation path within the behavior/interaction config object
  type: string;      // "number" | "boolean" | "string" | "SpawnPosition"
  required: boolean;
  description: string;
  default?: string;
}

// Behaviors: self-contained, single-entity behaviors defined in the game-config schema
export interface BehaviorRhetoric {
  name: string;
  behaviorType: string;
  description: string;
  tags: string[];
  applicableVerbs: string[];
  properties: PropertySpec[];
}

// Interactions: collision-based effects between two entities, defined in the game-config schema
export interface InteractionRhetoric {
  name: string;
  interactionType: string;
  description: string;
  tags: string[];
  applicableVerbs: string[];
  properties: PropertySpec[];
}

export const BEHAVIOR_RHETORICS: BehaviorRhetoric[] = [
  {
    name: "Player Controlled",
    behaviorType: "player_controlled",
    description: "Entity is moved by the player via keyboard input (WASD / arrow keys). Optionally clamped to canvas bounds.",
    tags: ["player", "controlled", "input", "move", "keyboard"],
    applicableVerbs: ["controls", "moves", "steers", "navigates", "drives"],
    properties: [
      { key: "clampToCanvas", type: "boolean", required: false, description: "Prevent entity from leaving canvas bounds", default: "true" },
    ],
  },
  {
    name: "Chase",
    behaviorType: "chase",
    description: "Entity continuously moves toward a target entity.",
    tags: ["chase", "hunt", "pursue", "follow", "track"],
    applicableVerbs: ["chases", "hunts", "pursues", "follows", "tracks", "stalks"],
    properties: [
      { key: "clampToCanvas", type: "boolean", required: false, description: "Clamp movement to canvas", default: "false" },
      { key: "properties.target", type: "string", required: true, description: "Entity id to chase" },
    ],
  },
  {
    name: "Spawn On Timer",
    behaviorType: "spawn_on_timer",
    description: "Periodically spawns new instances of an entity at a configurable rate and position.",
    tags: ["spawn", "create", "generate", "produce", "appear"],
    applicableVerbs: ["spawns", "creates", "generates", "produces", "appears"],
    properties: [
      { key: "properties.intervalMs", type: "number", required: true, description: "Milliseconds between spawns" },
      { key: "properties.max", type: "number", required: false, description: "Maximum live instances allowed" },
      { key: "properties.speedMin", type: "number", required: true, description: "Minimum speed for spawned instances" },
      { key: "properties.speedMax", type: "number", required: true, description: "Maximum speed for spawned instances" },
      {
        key: "properties.spawnAt",
        type: "SpawnPosition",
        required: true,
        description: 'Where to place each new instance. anchor: "center" | "top" (offset?) | "bottom" (offset?) | "left" (offset?) | "right" (offset?) | "xy" (x, y) | "random_canvas" (margin?) | "random_edge" (offset?) | "near_entity" (entity, offsetRadius)',
      },
    ],
  },
  {
    name: "Grow Over Time",
    behaviorType: "grow_over_time",
    description: "Entity's size increases automatically at a fixed rate per second, optionally clamped to its maxSize.",
    tags: ["grow", "expand", "spread", "increase", "escalate"],
    applicableVerbs: ["grows", "expands", "spreads", "escalates", "increases"],
    properties: [
      { key: "properties.property", type: "string", required: true, description: 'Property to grow — must be "size"', default: "size" },
      { key: "properties.rate", type: "number", required: true, description: "Amount added per second" },
      { key: "properties.clampToMax", type: "boolean", required: false, description: "Stop growing at entity maxSize", default: "true" },
    ],
  },
];

export const INTERACTION_RHETORICS: InteractionRhetoric[] = [
  {
    name: "Consume",
    interactionType: "consume",
    description: "Entity A grows in size when it contacts entity B; B is teleported to a random position.",
    tags: ["consume", "eat", "absorb", "grow", "collect"],
    applicableVerbs: ["consumes", "eats", "absorbs", "collects", "grows from"],
    properties: [],
  },
  {
    name: "Damage",
    interactionType: "damage",
    description: "Entity A shrinks when it contacts entity B; B is destroyed on contact.",
    tags: ["damage", "hurt", "shrink", "destroy", "attack"],
    applicableVerbs: ["damages", "hurts", "attacks", "shrinks", "injures"],
    properties: [],
  },
  {
    name: "Collect",
    interactionType: "collect",
    description: "Entity A picks up entity B, adding it to A's inventory. B is removed on contact. Requires maxInventory defined on A.",
    tags: ["collect", "pick up", "gather", "inventory", "resource"],
    applicableVerbs: ["collects", "picks up", "gathers", "retrieves", "obtains"],
    properties: [],
  },
  {
    name: "Damage On Item",
    interactionType: "damage_on_item",
    description: "Entity A damages entity B by consuming a specific inventory item. B is destroyed; A loses the configured item amount. Requires A to carry the item.",
    tags: ["use item", "consume item", "conditional damage", "inventory", "extinguish"],
    applicableVerbs: ["uses", "deploys", "applies", "expends", "consumes"],
    properties: [
      { key: "options.item", type: "string", required: true, description: "Inventory item id that must be present on entity A" },
      { key: "options.amount", type: "number", required: true, description: "Units of the item consumed per hit" },
    ],
  },
  {
    name: "Destroy",
    interactionType: "destroy",
    description: "Entity A destroys entity B on contact. No effect on A.",
    tags: ["destroy", "eliminate", "burn", "kill", "remove"],
    applicableVerbs: ["destroys", "eliminates", "burns", "kills", "removes"],
    properties: [],
  },
];

function formatProperties(props: PropertySpec[]): string {
  if (props.length === 0) return "";
  return (
    "\n  Properties:\n" +
    props
      .map(
        (p) =>
          `    - ${p.key} (${p.type}${p.required ? ", required" : ", optional"}${p.default ? `, default: ${p.default}` : ""}): ${p.description}`
      )
      .join("\n")
  );
}

export function formatBehaviorRhetoricsForPrompt(): string {
  return BEHAVIOR_RHETORICS.map(
    (b) =>
      `- ${b.name} | behaviorType: ${b.behaviorType} | tags: ${b.tags.join(", ")} | ${b.description}${formatProperties(b.properties)}`
  ).join("\n");
}

export function formatInteractionRhetoricsForPrompt(): string {
  return INTERACTION_RHETORICS.map(
    (i) =>
      `- ${i.name} | interactionType: ${i.interactionType} | tags: ${i.tags.join(", ")} | ${i.description}${formatProperties(i.properties)}`
  ).join("\n");
}

// Combined helper for agents that need both lists
export function formatMicroRhetoricsForPrompt(): string {
  return [
    "BEHAVIOR RHETORICS (single-entity):",
    formatBehaviorRhetoricsForPrompt(),
    "",
    "INTERACTION RHETORICS (two-entity collision effects):",
    formatInteractionRhetoricsForPrompt(),
  ].join("\n");
}
