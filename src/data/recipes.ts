export type RecipeCategory = "win" | "lose" | "structure" | "patch";

export interface Recipe {
  name: string;
  category: RecipeCategory;
  description: string;
  preconditions: string[]; // names of MicroRhetorics that must be present
}

export const RECIPES: Recipe[] = [
  // --- Win Recipes ---
  {
    name: "Score Threshold Win",
    category: "win",
    description: "Win by reaching a target point score through entity removal or collection.",
    preconditions: ["Add Score on Collide"],
  },
  {
    name: "Eliminate All Of Type",
    category: "win",
    description: "Win by removing every instance of a specific entity type from the field.",
    preconditions: ["Remove on Collide"],
  },
  {
    name: "Survive Duration",
    category: "win",
    description: "Win by staying alive until a timer runs out.",
    preconditions: [],
  },
  {
    name: "Reach Goal Zone",
    category: "win",
    description: "Win by navigating the player to a designated goal area.",
    preconditions: [],
  },
  {
    name: "Grow Beyond Size",
    category: "win",
    description: "Win by growing the player entity beyond a threshold size.",
    preconditions: ["Grow on Collide"],
  },
  // --- Lose Recipes ---
  {
    name: "Run Out Of Time",
    category: "lose",
    description: "Lose when the countdown timer reaches zero.",
    preconditions: [],
  },
  {
    name: "Health Depletion",
    category: "lose",
    description: "Lose when the player's health reaches zero.",
    preconditions: ["Damage on Collide"],
  },
  {
    name: "Protected Entity Removed",
    category: "lose",
    description: "Lose if a critical non-player entity is destroyed.",
    preconditions: ["Remove on Collide"],
  },
  // --- Structure Recipes ---
  {
    name: "Frogger Layout",
    category: "structure",
    description: "Player starts left side, hazards move across horizontal lanes.",
    preconditions: [],
  },
  {
    name: "Asteroids Layout",
    category: "structure",
    description: "Player centered, enemies spawn from edges and move inward.",
    preconditions: ["Wander"],
  },
  {
    name: "Space Invaders Layout",
    category: "structure",
    description: "Player at bottom, enemies arranged in grid formation at top.",
    preconditions: ["Patrol"],
  },
  {
    name: "Arena Layout",
    category: "structure",
    description: "Player in center, enemies spawn from all edges and converge.",
    preconditions: ["Chase Player"],
  },
  {
    name: "Chase Layout",
    category: "structure",
    description: "One entity pursues the player; player tries to evade.",
    preconditions: ["Chase Player"],
  },
  {
    name: "Tower Defense Layout",
    category: "structure",
    description: "Enemies follow a fixed path; player must intercept them.",
    preconditions: ["Patrol", "Spawn Periodically"],
  },
  // --- Patch Recipes ---
  {
    name: "Ensure Movement Exists",
    category: "patch",
    description: "Add default random movement if no movement component is present.",
    preconditions: [],
  },
  {
    name: "Ensure Collisions Enabled",
    category: "patch",
    description: "Add collider components to entities missing them.",
    preconditions: [],
  },
  {
    name: "Ensure Player Assigned",
    category: "patch",
    description: "Assign input control to the most suitable entity as player.",
    preconditions: [],
  },
  {
    name: "Ensure Spawn Loop",
    category: "patch",
    description: "Add respawn behavior if the win condition requires repeated removal.",
    preconditions: ["Remove on Collide"],
  },
  {
    name: "Clamp Parameters",
    category: "patch",
    description: "Enforce valid speed, size, and spawn rate ranges across all entities.",
    preconditions: [],
  },
];

export function formatRecipesForPrompt(category?: RecipeCategory): string {
  const list = category ? RECIPES.filter((r) => r.category === category) : RECIPES;
  return list
    .map(
      (r) =>
        `- ${r.name} (${r.category}): ${r.description}${
          r.preconditions.length > 0
            ? ` [Requires micro-rhetorics: ${r.preconditions.join(", ")}]`
            : ""
        }`
    )
    .join("\n");
}
