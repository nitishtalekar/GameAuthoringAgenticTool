export type MicroRhetoricCategory = "individual" | "relational";

export interface MicroRhetoric {
  name: string;
  component: string;
  category: MicroRhetoricCategory;
  tags: string[];
  description: string;
  applicableVerbs: string[];
}

export const MICRO_RHETORICS: MicroRhetoric[] = [
  // --- Individual: self-contained behaviors that need no collision partner ---
  {
    name: "Wander",
    component: "RandomMovementComponent",
    category: "individual",
    tags: ["wander", "roam", "drift", "move randomly"],
    description: "Moves in random, unpredictable directions.",
    applicableVerbs: ["wanders", "roams", "drifts", "moves randomly", "floats"],
  },
  {
    name: "Patrol",
    component: "PatrolBetweenPointsComponent",
    category: "individual",
    tags: ["patrol", "guard", "cycle", "pace"],
    description: "Moves back and forth on a fixed path.",
    applicableVerbs: ["patrols", "guards", "paces", "cycles", "watches over"],
  },
  {
    name: "Chase Player",
    component: "HomingMovementComponent",
    category: "individual",
    tags: ["chase", "hunt", "pursue", "track", "follow"],
    description: "Homes in on the player.",
    applicableVerbs: ["chases", "hunts", "pursues", "tracks", "follows", "stalks"],
  },
  {
    name: "Flee Player",
    component: "FleeTargetComponent",
    category: "individual",
    tags: ["flee", "evade", "run", "escape", "avoid"],
    description: "Moves away from the player.",
    applicableVerbs: ["flees", "evades", "runs from", "escapes", "avoids"],
  },
  {
    name: "Grow Over Time",
    component: "GrowOverTimeComponent",
    category: "individual",
    tags: ["grow", "expand", "inflate", "swell"],
    description: "Gradually increases in size over time.",
    applicableVerbs: ["grows", "expands", "inflates", "swells", "enlarges"],
  },
  {
    name: "Shrink Over Time",
    component: "ShrinkOverTimeComponent",
    category: "individual",
    tags: ["shrink", "decay", "fade", "wither", "deplete"],
    description: "Gradually decreases in size and eventually disappears.",
    applicableVerbs: ["shrinks", "decays", "fades", "withers", "depletes", "erodes"],
  },
  {
    name: "Accelerate Over Time",
    component: "IncreaseSpeedOverTimeComponent",
    category: "individual",
    tags: ["accelerate", "speed up", "escalate", "intensify"],
    description: "Increases movement speed as time passes.",
    applicableVerbs: ["accelerates", "speeds up", "escalates", "intensifies"],
  },
  {
    name: "Spawn Periodically",
    component: "SpawnPeriodicallyComponent",
    category: "individual",
    tags: ["spawn", "multiply", "replicate", "reproduce", "proliferate"],
    description: "Periodically creates new copies of itself.",
    applicableVerbs: ["spawns", "multiplies", "replicates", "reproduces", "proliferates"],
  },
  {
    name: "Static Obstacle",
    component: "StaticObstacleComponent",
    category: "individual",
    tags: ["block", "obstacle", "wall", "barrier", "immovable"],
    description: "Does not move; acts as an immovable barrier.",
    applicableVerbs: ["blocks", "bars", "obstructs", "stands in the way of"],
  },

  // --- Relational: effects triggered when subject contacts the object ---
  {
    name: "Add Score on Collide",
    component: "AddScoreOnCollideComponent",
    category: "relational",
    tags: ["collect", "score", "reward", "gain", "pickup"],
    description: "Player gains score on contact; entity is removed.",
    applicableVerbs: ["collects", "scores", "rewards", "gains", "earns", "picks up"],
  },
  {
    name: "Damage on Collide",
    component: "DamageOnCollideComponent",
    category: "relational",
    tags: ["damage", "hurt", "harm", "injure", "attack"],
    description: "Reduces the target's health on contact.",
    applicableVerbs: ["damages", "hurts", "harms", "injures", "attacks", "poisons"],
  },
  {
    name: "Remove on Collide",
    component: "RemoveOnCollideComponent",
    category: "relational",
    tags: ["remove", "destroy", "eliminate", "defeat", "kill"],
    description: "Removes the object from the game on contact.",
    applicableVerbs: ["kills", "destroys", "eliminates", "removes", "defeats", "erases"],
  },
  {
    name: "Grow on Collide",
    component: "GrowOnCollideComponent",
    category: "relational",
    tags: ["grow", "absorb", "expand", "consume"],
    description: "Subject grows larger each time it contacts the object.",
    applicableVerbs: ["absorbs", "consumes", "grows from", "expands by eating"],
  },
  {
    name: "Shrink on Collide",
    component: "ShrinkOnCollideComponent",
    category: "relational",
    tags: ["shrink", "reduce", "diminish", "weaken"],
    description: "Subject shrinks when it contacts the object.",
    applicableVerbs: ["shrinks", "reduces", "diminishes", "weakens", "deflates"],
  },
  {
    name: "Spawn on Remove",
    component: "SpawnEntityOnRemoveComponent",
    category: "relational",
    tags: ["spawn", "release", "hatch", "produce"],
    description: "When the object is removed, spawns new entities.",
    applicableVerbs: ["spawns from", "releases", "hatches from", "produces when destroyed"],
  },
  {
    name: "Push on Collide",
    component: "ApplyForceOnCollideComponent",
    category: "relational",
    tags: ["push", "repel", "shove", "displace", "force back"],
    description: "Applies a repulsive force pushing the object away on contact.",
    applicableVerbs: ["pushes", "repels", "shoves", "displaces", "forces back"],
  },
  {
    name: "Freeze on Collide",
    component: "StopMovementOnCollideComponent",
    category: "relational",
    tags: ["freeze", "stop", "halt", "immobilize", "stun"],
    description: "Halts the object's movement temporarily on contact.",
    applicableVerbs: ["freezes", "stops", "halts", "immobilizes", "stuns"],
  },
  {
    name: "Convert on Collide",
    component: "TransformTargetIntoSelfComponent",
    category: "relational",
    tags: ["convert", "infect", "spread", "transform", "recruit"],
    description: "Transforms the object into the subject's type on contact.",
    applicableVerbs: ["converts", "infects", "spreads to", "transforms", "recruits"],
  },
];

export function formatMicroRhetoricsForPrompt(): string {
  return MICRO_RHETORICS.map(
    (mr) =>
      `- ${mr.name} | component: ${mr.component} | category: ${mr.category} | tags: ${mr.tags.join(", ")} | ${mr.description}`
  ).join("\n");
}
