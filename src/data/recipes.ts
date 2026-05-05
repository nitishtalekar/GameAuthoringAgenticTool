import { PropertySpec } from "./micro-rhetorics";

export interface RecipeConditionSpec {
  conditionType: "entity_property_threshold" | "entity_count_threshold" | "timer_elapsed";
  properties: PropertySpec[];
}

export interface WinRecipe {
  name: string;
  description: string;
  requires: string | null;
  condition: RecipeConditionSpec;
}

export interface LoseRecipe {
  name: string;
  description: string;
  requires: string | null;
  condition: RecipeConditionSpec;
}

export const WIN_RECIPES: WinRecipe[] = [
  {
    name: "Survive Duration",
    description: "Win by staying alive until a timer runs out.",
    requires: null,
    condition: {
      conditionType: "timer_elapsed",
      properties: [
        { key: "properties.seconds", type: "number", required: true, description: "Total game duration in seconds" },
      ],
    },
  },
  {
    name: "Grow Beyond Size",
    description: "Win by growing the player entity beyond a threshold size via consuming other entities.",
    requires: "consume",
    condition: {
      conditionType: "entity_property_threshold",
      properties: [
        { key: "properties.entity", type: "string", required: true, description: "Entity id to observe (the player)" },
        { key: "properties.property", type: "string", required: true, description: 'Property to compare — must be "size"', default: "size" },
        { key: "properties.operator", type: "string", required: true, description: 'Comparison operator — use ">=" to trigger when size reaches the threshold' },
        { key: "properties.value", type: "number", required: true, description: "Size threshold value the player must reach or exceed" },
      ],
    },
  },
  {
    name: "Neutralize Threat",
    description: "Win by reducing a threat entity's size (or count) to zero using a collected resource (e.g. extinguish fire with water).",
    requires: "damage_on_item",
    condition: {
      conditionType: "entity_count_threshold",
      properties: [
        { key: "properties.entity", type: "string", required: true, description: "Entity id whose live instance count is observed (the threat)" },
        { key: "properties.operator", type: "string", required: true, description: 'Comparison operator — use "<=" to trigger when count drops to the threshold' },
        { key: "properties.value", type: "number", required: true, description: "Count threshold (typically 0)", default: "0" },
      ],
    },
  },
  {
    name: "Protect All Assets",
    description: "Win by keeping all protected entities alive until the timer expires.",
    requires: null,
    condition: {
      conditionType: "timer_elapsed",
      properties: [
        { key: "properties.seconds", type: "number", required: true, description: "Total game duration in seconds the player must survive" },
      ],
    },
  },
];

export const LOSE_RECIPES: LoseRecipe[] = [
  {
    name: "Size Depleted",
    description: "Lose when the player's size drops below a minimum threshold from taking damage.",
    requires: "damage",
    condition: {
      conditionType: "entity_property_threshold",
      properties: [
        { key: "properties.entity", type: "string", required: true, description: "Entity id to observe (the player)" },
        { key: "properties.property", type: "string", required: true, description: 'Property to compare — must be "size"', default: "size" },
        { key: "properties.operator", type: "string", required: true, description: 'Comparison operator — use "<=" to trigger when size falls to the threshold' },
        { key: "properties.value", type: "number", required: true, description: "Minimum size before losing (e.g. 10)" },
      ],
    },
  },
  {
    name: "Timer Expired",
    description: "Lose when the countdown timer reaches zero.",
    requires: null,
    condition: {
      conditionType: "timer_elapsed",
      properties: [
        { key: "properties.seconds", type: "number", required: true, description: "Total game duration in seconds" },
      ],
    },
  },
  {
    name: "Assets Destroyed",
    description: "Lose when all instances of a protected entity are destroyed by a threat (e.g. all houses burned down).",
    requires: "destroy",
    condition: {
      conditionType: "entity_count_threshold",
      properties: [
        { key: "properties.entity", type: "string", required: true, description: "Entity id whose live instance count is observed (the protected asset)" },
        { key: "properties.operator", type: "string", required: true, description: 'Comparison operator — use "<=" to trigger when all instances are gone' },
        { key: "properties.value", type: "number", required: true, description: "Count threshold (typically 0)", default: "0" },
      ],
    },
  },
  {
    name: "Player Overwhelmed",
    description: "Lose when the player entity's size falls to its minimum due to contact with a growing threat.",
    requires: null,
    condition: {
      conditionType: "entity_property_threshold",
      properties: [
        { key: "properties.entity", type: "string", required: true, description: "Entity id to observe (the player)" },
        { key: "properties.property", type: "string", required: true, description: 'Property to compare — must be "size"', default: "size" },
        { key: "properties.operator", type: "string", required: true, description: 'Comparison operator — use "<=" to trigger when size falls to minSize' },
        { key: "properties.value", type: "number", required: true, description: "Minimum size before losing — should match the entity's minSize" },
      ],
    },
  },
];

function formatConditionSpec(spec: RecipeConditionSpec): string {
  const props = spec.properties
    .map(
      (p) =>
        `      - ${p.key} (${p.type}${p.required ? ", required" : ", optional"}${p.default ? `, default: ${p.default}` : ""}): ${p.description}`
    )
    .join("\n");
  return `\n  Condition type: ${spec.conditionType}\n  Condition fields:\n${props}`;
}

export function formatWinRecipesForPrompt(): string {
  return WIN_RECIPES.map(
    (r) =>
      `- ${r.name}: ${r.description}${r.requires ? ` [Requires interaction type: ${r.requires}]` : ""}${formatConditionSpec(r.condition)}`
  ).join("\n");
}

export function formatLoseRecipesForPrompt(): string {
  return LOSE_RECIPES.map(
    (r) =>
      `- ${r.name}: ${r.description}${r.requires ? ` [Requires interaction type: ${r.requires}]` : ""}${formatConditionSpec(r.condition)}`
  ).join("\n");
}

// Combined helper for agents that need both lists
export function formatRecipesForPrompt(): string {
  return [
    "WIN RECIPES:",
    formatWinRecipesForPrompt(),
    "",
    "LOSE RECIPES:",
    formatLoseRecipesForPrompt(),
  ].join("\n");
}
