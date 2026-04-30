export interface WinRecipe {
  name: string;
  description: string;
  // Interaction type that must be present (null = no interaction required)
  requires: string | null;
}

export interface LoseRecipe {
  name: string;
  description: string;
  // Interaction type that must be present (null = no interaction required)
  requires: string | null;
}

export const WIN_RECIPES: WinRecipe[] = [
  {
    name: "Survive Duration",
    description: "Win by staying alive until a timer runs out.",
    requires: null,
  },
  {
    name: "Grow Beyond Size",
    description: "Win by growing the player entity beyond a threshold size via consuming other entities.",
    requires: "consume",
  },
  {
    name: "Neutralize Threat",
    description: "Win by reducing a threat entity's size (or count) to zero using a collected resource (e.g. extinguish fire with water).",
    requires: "damage_on_item",
  },
  {
    name: "Protect All Assets",
    description: "Win by keeping all protected entities alive until the timer expires.",
    requires: null,
  },
];

export const LOSE_RECIPES: LoseRecipe[] = [
  {
    name: "Size Depleted",
    description: "Lose when the player's size drops below a minimum threshold from taking damage.",
    requires: "damage",
  },
  {
    name: "Timer Expired",
    description: "Lose when the countdown timer reaches zero.",
    requires: null,
  },
  {
    name: "Assets Destroyed",
    description: "Lose when all instances of a protected entity are destroyed by a threat (e.g. all houses burned down).",
    requires: "destroy",
  },
  {
    name: "Player Overwhelmed",
    description: "Lose when the player entity's size falls to its minimum due to contact with a growing threat.",
    requires: null,
  },
];

export function formatWinRecipesForPrompt(): string {
  return WIN_RECIPES.map(
    (r) =>
      `- ${r.name}: ${r.description}${r.requires ? ` [Requires interaction type: ${r.requires}]` : ""}`
  ).join("\n");
}

export function formatLoseRecipesForPrompt(): string {
  return LOSE_RECIPES.map(
    (r) =>
      `- ${r.name}: ${r.description}${r.requires ? ` [Requires interaction type: ${r.requires}]` : ""}`
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
