export type MicroRhetoricCategory =
  | "interaction"
  | "growth"
  | "control"
  | "resource"
  | "state";

export interface MicroRhetoric {
  name: string;
  component: string;
  category: MicroRhetoricCategory;
  tags: string[];
  description: string;
  applicableVerbs: string[];
}

export const MICRO_RHETORICS: MicroRhetoric[] = [
  // --- Interaction ---
  {
    name: "Take Custody",
    component: "StopOnCollideComponent",
    category: "interaction",
    tags: ["arrest", "capture", "stop", "immobilize"],
    description: "The subject stops the object's movement on collision, taking custody of it.",
    applicableVerbs: ["arrests", "captures", "detains", "holds", "imprisons"],
  },
  {
    name: "Remove On Contact",
    component: "RemoveOnCollideComponent",
    category: "interaction",
    tags: ["remove", "destroy", "eliminate", "defeat"],
    description: "The subject removes the object from the game world on contact.",
    applicableVerbs: ["kills", "destroys", "eliminates", "removes", "defeats", "erases"],
  },
  {
    name: "Damage Overlap",
    component: "DamageOnCollideComponent",
    category: "interaction",
    tags: ["damage", "hurt", "harm", "injure"],
    description: "The subject reduces the object's health on collision.",
    applicableVerbs: ["damages", "hurts", "harms", "injures", "attacks", "poisons"],
  },
  {
    name: "Freeze Target",
    component: "StopMovementOnCollideComponent",
    category: "interaction",
    tags: ["freeze", "stop", "block", "obstruct"],
    description: "The subject halts the object's movement on collision.",
    applicableVerbs: ["freezes", "stops", "blocks", "obstructs", "immobilizes", "stalls"],
  },
  {
    name: "Reflect Target",
    component: "ReflectOnCollideComponent",
    category: "interaction",
    tags: ["reflect", "bounce", "deflect", "redirect"],
    description: "The subject reverses the object's direction on collision.",
    applicableVerbs: ["reflects", "bounces", "deflects", "redirects", "repels"],
  },
  {
    name: "Push Back",
    component: "ApplyForceOnCollideComponent",
    category: "interaction",
    tags: ["push", "force", "shove", "displace"],
    description: "The subject applies a repulsive force to the object on collision.",
    applicableVerbs: ["pushes", "shoves", "displaces", "repels", "forces back"],
  },
  {
    name: "Absorb",
    component: "RemoveTargetAndGrowComponent",
    category: "interaction",
    tags: ["absorb", "consume", "eat", "assimilate", "incorporate"],
    description: "The subject removes the object and grows in size on contact.",
    applicableVerbs: ["absorbs", "consumes", "eats", "assimilates", "incorporates"],
  },
  {
    name: "Convert",
    component: "TransformTargetIntoSelfComponent",
    category: "interaction",
    tags: ["convert", "transform", "recruit", "persuade"],
    description: "The subject transforms the object into an entity of its own type.",
    applicableVerbs: ["converts", "transforms", "recruits", "persuades", "spreads to", "infects"],
  },
  {
    name: "Swap Roles",
    component: "ExchangeMovementOrStateComponent",
    category: "interaction",
    tags: ["swap", "exchange", "switch", "reverse"],
    description: "The subject and object exchange movement patterns or states on contact.",
    applicableVerbs: ["swaps with", "exchanges with", "switches with", "reverses with"],
  },
  // --- Growth / Decay ---
  {
    name: "Grow On Contact",
    component: "GrowOnCollideComponent",
    category: "growth",
    tags: ["grow", "expand", "increase", "enlarge"],
    description: "The subject increases in size when it contacts the object.",
    applicableVerbs: ["grows", "expands", "increases", "enlarges", "inflates"],
  },
  {
    name: "Shrink On Contact",
    component: "ShrinkOnCollideComponent",
    category: "growth",
    tags: ["shrink", "decrease", "reduce", "diminish"],
    description: "The subject decreases in size when it contacts the object.",
    applicableVerbs: ["shrinks", "decreases", "reduces", "diminishes", "deflates"],
  },
  {
    name: "Spawn On Event",
    component: "SpawnEntityOnRemoveComponent",
    category: "growth",
    tags: ["spawn", "produce", "create", "generate"],
    description: "When the object is removed, the subject spawns new entities.",
    applicableVerbs: ["spawns from", "produces", "generates", "creates", "breeds"],
  },
  {
    name: "Multiply Over Time",
    component: "SpawnPeriodicallyComponent",
    category: "growth",
    tags: ["multiply", "replicate", "reproduce", "proliferate"],
    description: "The subject periodically spawns new instances of itself.",
    applicableVerbs: ["multiplies", "replicates", "reproduces", "proliferates", "spreads"],
  },
  {
    name: "Decay Over Time",
    component: "ShrinkOverTimeComponent",
    category: "growth",
    tags: ["decay", "shrink", "wither", "deplete"],
    description: "The subject gradually shrinks and eventually disappears.",
    applicableVerbs: ["decays", "withers", "depletes", "fades", "erodes"],
  },
  {
    name: "Escalate Speed",
    component: "IncreaseSpeedOverTimeComponent",
    category: "growth",
    tags: ["accelerate", "speed up", "escalate", "intensify"],
    description: "The subject increases in speed over time.",
    applicableVerbs: ["accelerates", "speeds up", "escalates", "intensifies"],
  },
  // --- Control / Constraint ---
  {
    name: "Follow Target",
    component: "SeekTargetComponent",
    category: "control",
    tags: ["follow", "seek", "chase", "pursue", "track"],
    description: "The subject actively moves toward the object.",
    applicableVerbs: ["follows", "seeks", "chases", "pursues", "tracks", "stalks"],
  },
  {
    name: "Avoid Target",
    component: "FleeTargetComponent",
    category: "control",
    tags: ["avoid", "flee", "evade", "escape"],
    description: "The subject actively moves away from the object.",
    applicableVerbs: ["avoids", "flees", "evades", "escapes", "runs from"],
  },
  {
    name: "Block Path",
    component: "StaticObstacleComponent",
    category: "control",
    tags: ["block", "obstruct", "bar", "prevent"],
    description: "The subject acts as a static obstacle that cannot be passed through.",
    applicableVerbs: ["blocks", "bars", "obstructs", "prevents passage of"],
  },
  {
    name: "Chase Player",
    component: "HomingMovementComponent",
    category: "control",
    tags: ["chase", "hunt", "target", "home in"],
    description: "The subject homes in on the player-controlled entity.",
    applicableVerbs: ["chases", "hunts", "targets", "homes in on"],
  },
  {
    name: "Wander",
    component: "RandomMovementComponent",
    category: "control",
    tags: ["wander", "roam", "drift", "move randomly"],
    description: "The subject moves in a random, unpredictable pattern.",
    applicableVerbs: ["wanders", "roams", "drifts", "moves randomly"],
  },
  {
    name: "Guard Zone",
    component: "PatrolBetweenPointsComponent",
    category: "control",
    tags: ["guard", "patrol", "protect", "defend"],
    description: "The subject patrols between fixed points, guarding a zone.",
    applicableVerbs: ["guards", "patrols", "protects", "defends", "watches over"],
  },
  // --- Resource ---
  {
    name: "Collect For Score",
    component: "AddScoreOnCollideComponent",
    category: "resource",
    tags: ["collect", "score", "reward", "gain"],
    description: "Collecting the object increases the player's score.",
    applicableVerbs: ["collects", "scores", "rewards", "gains", "earns"],
  },
  {
    name: "Consume Resource",
    component: "RemoveResourceOnUseComponent",
    category: "resource",
    tags: ["consume", "use", "spend", "exhaust"],
    description: "Using the object removes it from the game.",
    applicableVerbs: ["consumes", "uses up", "spends", "exhausts", "depletes"],
  },
  {
    name: "Waste Resource",
    component: "DecreaseMeterOverTimeComponent",
    category: "resource",
    tags: ["waste", "drain", "deplete", "consume passively"],
    description: "The subject causes a resource meter to drain over time.",
    applicableVerbs: ["wastes", "drains", "depletes passively"],
  },
  {
    name: "Charge Meter",
    component: "IncreaseMeterOnEventComponent",
    category: "resource",
    tags: ["charge", "fill", "build up", "accumulate"],
    description: "The subject causes a meter to increase on a triggering event.",
    applicableVerbs: ["charges", "fills", "builds up", "accumulates"],
  },
  // --- State Change ---
  {
    name: "Empower",
    component: "IncreaseSizeOrSpeedComponent",
    category: "state",
    tags: ["empower", "strengthen", "boost", "enhance"],
    description: "The subject increases the object's size or speed.",
    applicableVerbs: ["empowers", "strengthens", "boosts", "enhances", "supports"],
  },
  {
    name: "Weaken",
    component: "ReduceCapabilitiesComponent",
    category: "state",
    tags: ["weaken", "reduce", "diminish", "impair"],
    description: "The subject reduces the object's capabilities.",
    applicableVerbs: ["weakens", "reduces", "diminishes", "impairs", "undermines"],
  },
  {
    name: "Immobilize Temporarily",
    component: "TimedDisableComponent",
    category: "state",
    tags: ["immobilize", "disable", "stun", "pause"],
    description: "The subject disables the object for a limited time.",
    applicableVerbs: ["immobilizes", "disables", "stuns", "paralyzes temporarily"],
  },
  {
    name: "Reveal / Watch",
    component: "TriggerEventOnProximityComponent",
    category: "state",
    tags: ["reveal", "watch", "observe", "monitor"],
    description: "The subject triggers an event when it comes near the object.",
    applicableVerbs: ["reveals", "watches", "observes", "monitors", "detects"],
  },
  {
    name: "Influence",
    component: "ModifyTargetParametersComponent",
    category: "state",
    tags: ["influence", "affect", "modify", "change"],
    description: "The subject modifies the object's behavior parameters.",
    applicableVerbs: ["influences", "affects", "modifies", "changes", "shapes"],
  },
];

export function formatMicroRhetoricsForPrompt(): string {
  return MICRO_RHETORICS.map(
    (mr) =>
      `- ${mr.name} | component: ${mr.component} | category: ${mr.category} | tags: ${mr.tags.join(", ")} | ${mr.description}`
  ).join("\n");
}
