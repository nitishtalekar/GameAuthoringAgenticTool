// Behaviors: self-contained, single-entity behaviors defined in the game-config schema
export interface BehaviorRhetoric {
  name: string;
  behaviorType: string; // maps to config.behaviors[].type
  description: string;
  tags: string[];
  applicableVerbs: string[];
}

// Interactions: collision-based effects between two entities, defined in the game-config schema
export interface InteractionRhetoric {
  name: string;
  interactionType: string; // maps to config.interactions[].type
  description: string;
  tags: string[];
  applicableVerbs: string[];
}

export const BEHAVIOR_RHETORICS: BehaviorRhetoric[] = [
  {
    name: "Player Controlled",
    behaviorType: "player_controlled",
    description: "Entity is moved by the player via keyboard input (WASD / arrow keys). Optionally clamped to canvas bounds.",
    tags: ["player", "controlled", "input", "move", "keyboard"],
    applicableVerbs: ["controls", "moves", "steers", "navigates", "drives"],
  },
  {
    name: "Chase",
    behaviorType: "chase",
    description: "Entity continuously moves toward a target entity.",
    tags: ["chase", "hunt", "pursue", "follow", "track"],
    applicableVerbs: ["chases", "hunts", "pursues", "follows", "tracks", "stalks"],
  },
  {
    name: "Spawn On Timer",
    behaviorType: "spawn_on_timer",
    description: "Periodically spawns new instances of an entity at a configurable rate and position.",
    tags: ["spawn", "create", "generate", "produce", "appear"],
    applicableVerbs: ["spawns", "creates", "generates", "produces", "appears"],
  },
];

export const INTERACTION_RHETORICS: InteractionRhetoric[] = [
  {
    name: "Consume",
    interactionType: "consume",
    description: "Entity A grows in size when it contacts entity B; B is teleported to a random position.",
    tags: ["consume", "eat", "absorb", "grow", "collect"],
    applicableVerbs: ["consumes", "eats", "absorbs", "collects", "grows from"],
  },
  {
    name: "Damage",
    interactionType: "damage",
    description: "Entity A shrinks when it contacts entity B; B is destroyed on contact.",
    tags: ["damage", "hurt", "shrink", "destroy", "attack"],
    applicableVerbs: ["damages", "hurts", "attacks", "shrinks", "injures"],
  },
];

export function formatBehaviorRhetoricsForPrompt(): string {
  return BEHAVIOR_RHETORICS.map(
    (b) =>
      `- ${b.name} | behaviorType: ${b.behaviorType} | tags: ${b.tags.join(", ")} | ${b.description}`
  ).join("\n");
}

export function formatInteractionRhetoricsForPrompt(): string {
  return INTERACTION_RHETORICS.map(
    (i) =>
      `- ${i.name} | interactionType: ${i.interactionType} | tags: ${i.tags.join(", ")} | ${i.description}`
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
