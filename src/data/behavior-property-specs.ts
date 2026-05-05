// Canonical property reference for the Game JSON Generation Agent (Step 5).
// Describes what fields to emit in the final game-config JSON per behavior/interaction type,
// and what numeric ranges produce a playable game.

export interface BehaviorJsonSpec {
  entityFields: string[];
  behaviorFields: string[];
}

export interface InteractionJsonSpec {
  notes: string;
  entityAFields?: string[];
  interactionFields?: string[];
}

export const BEHAVIOR_PROPERTY_SPECS: Record<string, BehaviorJsonSpec> = {
  player_controlled: {
    entityFields: [
      "initialSize: 50–120",
      "minSize: 10–30",
      "maxSize: 200–400",
      "speed: 50–200",
      "initialPosition: { anchor: 'center' }",
    ],
    behaviorFields: ["clampToCanvas: true"],
  },
  chase: {
    entityFields: [
      "size: 30–80",
      "speedMin: 50–150",
      "speedMax: 80–200",
      "initialPosition: { anchor: 'none' }",
    ],
    behaviorFields: [
      "clampToCanvas: false",
      "properties.target: <id of the entity being chased — usually the player>",
    ],
  },
  spawn_on_start: {
    entityFields: [
      "size: 20–60",
      "initialPosition: { anchor: 'none' }",
    ],
    behaviorFields: [
      "properties.count: 1–10 (number of instances to place at game start)",
      "properties.spawnAt: { anchor: 'random_canvas', margin: 20–60 }",
    ],
  },
  spawn_on_timer: {
    entityFields: [
      "size: 20–60",
      "speedMin: 50–150",
      "speedMax: 100–200",
      "initialPosition: { anchor: 'none' }",
    ],
    behaviorFields: [
      "properties.intervalMs: 1000–4000 (ms between spawns)",
      "properties.max: 3–10 (max live instances)",
      "properties.spawnAt: { anchor: 'random_edge', offset: 20–40 } for enemies  |  { anchor: 'random_canvas', margin: 20–40 } for collectibles",
      "properties.speedMin: 50–150",
      "properties.speedMax: 100–200",
    ],
  },
  grow_over_time: {
    entityFields: [
      "initialSize: 40–120",
      "minSize: 10",
      "maxSize: 400–600",
      "initialPosition: { anchor: 'fixed', x: <canvas_x>, y: <canvas_y> }",
    ],
    behaviorFields: [
      "properties.property: 'size'",
      "properties.rate: 5–20 (size units added per second)",
      "properties.clampToMax: true",
    ],
  },
};

export const INTERACTION_PROPERTY_SPECS: Record<string, InteractionJsonSpec> = {
  consume: {
    notes: "No extra options. EntityA grows by contact with EntityB; EntityB teleports to a random position.",
  },
  damage: {
    notes: "No extra options. EntityA shrinks on contact with EntityB; EntityB is destroyed.",
  },
  collect: {
    notes: "EntityA picks up EntityB into its inventory. EntityA must have maxInventory defined on its entity object.",
    entityAFields: ["maxInventory: { <itemName>: 5–20 }"],
  },
  damage_on_item: {
    notes: "EntityA uses an inventory item to damage EntityB. EntityB is destroyed; EntityA spends the item.",
    interactionFields: [
      "options.item: <inventory item id — must match a key in EntityA's maxInventory>",
      "options.amount: 1 (units consumed per hit)",
    ],
  },
  destroy: {
    notes: "No extra options. EntityA destroys EntityB on contact. No effect on EntityA.",
  },
};

function formatBehaviorSpec(type: string, spec: BehaviorJsonSpec): string {
  const entity = spec.entityFields.map((f) => `      - ${f}`).join("\n");
  const behavior = spec.behaviorFields.map((f) => `      - ${f}`).join("\n");
  return `  ${type}:\n    Entity fields:\n${entity}\n    Behavior fields:\n${behavior}`;
}

function formatInteractionSpec(type: string, spec: InteractionJsonSpec): string {
  const lines: string[] = [`  ${type}: ${spec.notes}`];
  if (spec.entityAFields) {
    lines.push("    EntityA entity fields:");
    spec.entityAFields.forEach((f) => lines.push(`      - ${f}`));
  }
  if (spec.interactionFields) {
    lines.push("    Interaction fields:");
    spec.interactionFields.forEach((f) => lines.push(`      - ${f}`));
  }
  return lines.join("\n");
}

export function formatBehaviorPropertySpecsForPrompt(): string {
  return Object.entries(BEHAVIOR_PROPERTY_SPECS)
    .map(([type, spec]) => formatBehaviorSpec(type, spec))
    .join("\n\n");
}

export function formatInteractionPropertySpecsForPrompt(): string {
  return Object.entries(INTERACTION_PROPERTY_SPECS)
    .map(([type, spec]) => formatInteractionSpec(type, spec))
    .join("\n\n");
}
