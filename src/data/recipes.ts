export interface RecipeConditionSpec {
  conditionType: "entity_property_threshold" | "entity_count_threshold" | "timer_elapsed";
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
    condition: { conditionType: "timer_elapsed" },
  },
  {
    name: "Grow Beyond Size",
    description: "Win by growing the player entity beyond a threshold size via consuming other entities.",
    requires: "consume",
    condition: { conditionType: "entity_property_threshold" },
  },
  {
    name: "Neutralize Threat",
    description: "Win by reducing a threat entity's count to zero using a collected resource (e.g. extinguish fire with water).",
    requires: "damage_on_item",
    condition: { conditionType: "entity_count_threshold" },
  },
  {
    name: "Protect All Assets",
    description: "Win by keeping all protected entities alive until the timer expires.",
    requires: null,
    condition: { conditionType: "timer_elapsed" },
  },
];

export const LOSE_RECIPES: LoseRecipe[] = [
  {
    name: "Size Depleted",
    description: "Lose when the player's size drops below a minimum threshold from taking damage.",
    requires: "damage",
    condition: { conditionType: "entity_property_threshold" },
  },
  {
    name: "Timer Expired",
    description: "Lose when the countdown timer reaches zero.",
    requires: null,
    condition: { conditionType: "timer_elapsed" },
  },
  {
    name: "Assets Destroyed",
    description: "Lose when all instances of a protected entity are destroyed by a threat (e.g. all houses burned down).",
    requires: "destroy",
    condition: { conditionType: "entity_count_threshold" },
  },
  {
    name: "Player Overwhelmed",
    description: "Lose when the player entity's size falls to its minimum due to contact with a growing threat.",
    requires: null,
    condition: { conditionType: "entity_property_threshold" },
  },
];

function formatConditionSpec(spec: RecipeConditionSpec): string {
  return `\n  Condition type: ${spec.conditionType}`;
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
