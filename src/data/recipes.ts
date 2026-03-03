export type RecipeCategory = "win" | "lose" | "structure" | "patch";

export interface Recipe {
  name: string;
  category: RecipeCategory;
  description: string;
  preconditions: string[];
  components_added: string[];
  components_required: string[];
}

export const RECIPES: Recipe[] = [
  // --- Win Recipes ---
  {
    name: "Score Threshold Win",
    category: "win",
    description: "Win by reaching a target point score through entity removal or collection.",
    preconditions: ["at least one removal or collection mechanic exists"],
    components_added: ["WinConditionComponent", "ScoreRemovalOfComponent"],
    components_required: [],
  },
  {
    name: "Eliminate All Of Type",
    category: "win",
    description: "Win by removing every instance of a specific entity type from the field.",
    preconditions: ["at least one entity can be removed"],
    components_added: ["WinConditionComponent", "RemoveOnCollideComponent"],
    components_required: [],
  },
  {
    name: "Survive Duration",
    category: "win",
    description: "Win by staying alive until a timer runs out.",
    preconditions: ["player entity exists"],
    components_added: ["WinConditionComponent", "TimerComponent"],
    components_required: ["InputComponent"],
  },
  {
    name: "Reach Goal Zone",
    category: "win",
    description: "Win by navigating the player to a designated goal area.",
    preconditions: ["player entity exists", "movement component exists"],
    components_added: ["WinConditionComponent", "GoalZoneComponent"],
    components_required: ["InputComponent", "MovementComponent"],
  },
  {
    name: "Grow Beyond Size",
    category: "win",
    description: "Win by growing the player entity beyond a threshold size.",
    preconditions: ["GrowOnCollideComponent or RemoveTargetAndGrowComponent exists"],
    components_added: ["WinConditionComponent"],
    components_required: ["GrowOnCollideComponent"],
  },
  {
    name: "Collect All Items",
    category: "win",
    description: "Win by collecting every collectible entity on the field.",
    preconditions: ["collectible entities exist"],
    components_added: ["WinConditionComponent", "AddScoreOnCollideComponent"],
    components_required: [],
  },
  {
    name: "Escort Entity Safely",
    category: "win",
    description: "Win by keeping a critical entity alive until a timer ends.",
    preconditions: ["player entity exists", "timer mechanic possible"],
    components_added: ["WinConditionComponent", "TimerComponent"],
    components_required: [],
  },
  // --- Lose Recipes ---
  {
    name: "Run Out Of Time",
    category: "lose",
    description: "Lose when the countdown timer reaches zero.",
    preconditions: [],
    components_added: ["LoseConditionComponent", "TimerComponent"],
    components_required: [],
  },
  {
    name: "Health Depletion",
    category: "lose",
    description: "Lose when the player's health reaches zero.",
    preconditions: ["DamageOnCollideComponent or hazard entity exists"],
    components_added: ["LoseConditionComponent", "HealthComponent"],
    components_required: [],
  },
  {
    name: "Protected Entity Removed",
    category: "lose",
    description: "Lose if a critical non-player entity is destroyed.",
    preconditions: ["at least two entity types exist"],
    components_added: ["LoseConditionComponent"],
    components_required: [],
  },
  {
    name: "Enemy Reaches Goal",
    category: "lose",
    description: "Lose if an enemy entity reaches a boundary or target zone.",
    preconditions: ["enemy entity with movement exists"],
    components_added: ["LoseConditionComponent", "GoalZoneComponent"],
    components_required: ["MovementComponent"],
  },
  {
    name: "Meter Overflow",
    category: "lose",
    description: "Lose when a negative resource meter reaches a critical threshold.",
    preconditions: ["meter mechanic exists"],
    components_added: ["LoseConditionComponent", "MeterComponent"],
    components_required: [],
  },
  // --- Structure Recipes ---
  {
    name: "Frogger Layout",
    category: "structure",
    description: "Player starts left side, hazards move across horizontal lanes.",
    preconditions: [],
    components_added: ["HorizontalOnlyMovement"],
    components_required: [],
  },
  {
    name: "Asteroids Layout",
    category: "structure",
    description: "Player centered, enemies spawn from edges and move inward.",
    preconditions: [],
    components_added: ["RandomMovementComponent"],
    components_required: [],
  },
  {
    name: "Space Invaders Layout",
    category: "structure",
    description: "Player at bottom, enemies arranged in grid formation at top.",
    preconditions: [],
    components_added: ["HorizontalOnlyMovement"],
    components_required: [],
  },
  {
    name: "Arena Layout",
    category: "structure",
    description: "Player in center, enemies spawn from all edges and converge.",
    preconditions: [],
    components_added: ["SeekTargetComponent"],
    components_required: [],
  },
  {
    name: "Chase Layout",
    category: "structure",
    description: "One entity pursues the player; player tries to evade.",
    preconditions: ["SeekTargetComponent or HomingMovementComponent exists"],
    components_added: ["HomingMovementComponent"],
    components_required: [],
  },
  {
    name: "Tower Defense Layout",
    category: "structure",
    description: "Enemies follow a fixed path; player must intercept them.",
    preconditions: [],
    components_added: ["PatrolBetweenPointsComponent", "SpawnPeriodicallyComponent"],
    components_required: [],
  },
  // --- Patch Recipes ---
  {
    name: "Ensure Movement Exists",
    category: "patch",
    description: "Add default random movement if no movement component is present.",
    preconditions: ["no movement component on any entity"],
    components_added: ["RandomMovementComponent"],
    components_required: [],
  },
  {
    name: "Ensure Collisions Enabled",
    category: "patch",
    description: "Add collider components to entities missing them.",
    preconditions: ["ColliderComponent missing"],
    components_added: ["ColliderComponent"],
    components_required: [],
  },
  {
    name: "Ensure Player Assigned",
    category: "patch",
    description: "Assign InputComponent to the most suitable entity as player.",
    preconditions: ["no entity has InputComponent"],
    components_added: ["InputComponent"],
    components_required: [],
  },
  {
    name: "Ensure Spawn Loop",
    category: "patch",
    description: "Add respawn behavior if the win condition requires repeated removal.",
    preconditions: ["win condition requires removal", "no RespawnOnRemoveComponent exists"],
    components_added: ["RespawnOnRemoveComponent"],
    components_required: [],
  },
  {
    name: "Clamp Parameters",
    category: "patch",
    description: "Enforce valid speed, size, and spawn rate ranges across all entities.",
    preconditions: [],
    components_added: [],
    components_required: [],
  },
];

export function formatRecipesForPrompt(category?: RecipeCategory): string {
  const list = category ? RECIPES.filter((r) => r.category === category) : RECIPES;
  return list
    .map(
      (r) =>
        `- ${r.name} (${r.category}): ${r.description}${
          r.preconditions.length > 0
            ? ` [Preconditions: ${r.preconditions.join("; ")}]`
            : ""
        }`
    )
    .join("\n");
}
