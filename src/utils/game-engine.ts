import INTERACTION_TYPES from "@/utils/interaction-types.json";
import {
  CONFIG,
  EffectContext,
  EntityState,
  GameContext,
  Vec,
} from "./game-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function resolveInitialPosition(
  anchor: string,
  canvas: { width: number; height: number },
  x?: number,
  y?: number
): Vec {
  if (anchor === "center") return { x: canvas.width / 2, y: canvas.height / 2 };
  if (anchor === "fixed" && x !== undefined && y !== undefined) return { x, y };
  return { x: 0, y: 0 };
}

export function randomInCanvas(margin: number, canvas: { width: number; height: number }): Vec {
  return {
    x: margin + Math.random() * (canvas.width - margin * 2),
    y: margin + Math.random() * (canvas.height - margin * 2),
  };
}

export function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  label: string
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x, y);
}

// ---------------------------------------------------------------------------
// Build initial states
// ---------------------------------------------------------------------------

export function buildInitialStates(config: CONFIG): Record<string, EntityState[]> {
  const canvas = config.meta.canvas;
  const spawnedEntities = new Set(
    config.behaviors
      .filter((b: CONFIG) => b.type === "spawn_on_timer")
      .map((b: CONFIG) => b.entity)
  );
  const states: Record<string, EntityState[]> = {};

  for (const eDef of config.entities) {
    if (spawnedEntities.has(eDef.id)) {
      states[eDef.id] = [];
      continue;
    }
    const pos = resolveInitialPosition(
      eDef.initialPosition.anchor,
      canvas,
      eDef.initialPosition.x,
      eDef.initialPosition.y
    );
    const size = eDef.initialSize ?? eDef.size ?? 20;
    states[eDef.id] = [
      { id: eDef.id, instanceId: 0, x: pos.x, y: pos.y, size, speed: eDef.speed ?? 0, inventory: {} },
    ];
  }
  return states;
}

// ---------------------------------------------------------------------------
// Behavior handlers
// ---------------------------------------------------------------------------

export function handlePlayerControlled(behavior: CONFIG, ctx: GameContext): void {
  const entity = ctx.states[behavior.entity]?.[0];
  if (!entity) return;
  const k = ctx.keys;
  let dx = 0, dy = 0;
  if (k["w"] || k["arrowup"])    dy -= 1;
  if (k["s"] || k["arrowdown"])  dy += 1;
  if (k["a"] || k["arrowleft"])  dx -= 1;
  if (k["d"] || k["arrowright"]) dx += 1;
  const len = Math.hypot(dx, dy) || 1;
  entity.x += (dx / len) * entity.speed * ctx.delta;
  entity.y += (dy / len) * entity.speed * ctx.delta;
  const clamp = behavior.clampToCanvas ?? behavior.properties?.clampToCanvas ?? true;
  if (clamp) {
    entity.x = Math.max(entity.size, Math.min(ctx.canvas.width - entity.size, entity.x));
    entity.y = Math.max(entity.size, Math.min(ctx.canvas.height - entity.size, entity.y));
  }
}

export function handleChase(behavior: CONFIG, ctx: GameContext): void {
  const target = ctx.states[behavior.properties?.target]?.[0];
  if (!target) return;
  ctx.states[behavior.entity] = ctx.states[behavior.entity].map((e) => {
    const angle = Math.atan2(target.y - e.y, target.x - e.x);
    return { ...e, x: e.x + Math.cos(angle) * e.speed * ctx.delta, y: e.y + Math.sin(angle) * e.speed * ctx.delta };
  });
}

export function resolveSpawnPosition(p: CONFIG, ctx: GameContext): { x: number; y: number } {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const anchor = p.spawnAt?.anchor;

  if (anchor === "near_entity") {
    const ref = ctx.states[p.spawnAt.entity]?.[0];
    const angle = Math.random() * Math.PI * 2;
    return {
      x: (ref?.x ?? w / 2) + Math.cos(angle) * p.spawnAt.offsetRadius,
      y: (ref?.y ?? h / 2) + Math.sin(angle) * p.spawnAt.offsetRadius,
    };
  }

  if (anchor === "random_canvas") {
    const margin = p.spawnAt?.margin ?? 20;
    return {
      x: margin + Math.random() * (w - margin * 2),
      y: margin + Math.random() * (h - margin * 2),
    };
  }

  if (anchor === "random_edge") {
    const offset = p.spawnAt?.offset ?? 30;
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) return { x: Math.random() * w, y: -offset };
    if (edge === 1) return { x: Math.random() * w, y: h + offset };
    if (edge === 2) return { x: -offset,            y: Math.random() * h };
    return                 { x: w + offset,          y: Math.random() * h };
  }

  return { x: w / 2, y: h / 2 };
}

export function handleSpawnOnTimer(behavior: CONFIG, behaviorIndex: number, ctx: GameContext, config: CONFIG): void {
  const p = behavior.properties;
  const lastSpawn = ctx.lastSpawnMap.current[behaviorIndex] ?? 0;
  if (ctx.now - lastSpawn <= p.intervalMs) return;

  const enemyDef = config.entities.find((e: CONFIG) => e.id === behavior.entity);
  if (!enemyDef) return;
  if (p.max !== undefined && ctx.states[behavior.entity].length >= p.max) return;

  const { x: spawnX, y: spawnY } = resolveSpawnPosition(p, ctx);

  ctx.states[behavior.entity].push({
    id: behavior.entity,
    instanceId: ctx.instanceCounter.current++,
    x: spawnX,
    y: spawnY,
    size: enemyDef.size ?? 20,
    speed: p.speedMin + Math.random() * (p.speedMax - p.speedMin),
    inventory: {},
  });
  ctx.lastSpawnMap.current[behaviorIndex] = ctx.now;
}

export function handleGrowOverTime(behavior: CONFIG, ctx: GameContext, config: CONFIG): void {
  const p = behavior.properties;
  const property = p.property as string;
  const rate = p.rate as number;
  const clampToMax = p.clampToMax as boolean | undefined;
  const entityDef = config.entities.find((e: CONFIG) => e.id === behavior.entity);

  ctx.states[behavior.entity] = ctx.states[behavior.entity].map((e) => {
    let newVal = (e[property as keyof EntityState] as number) + rate * ctx.delta;
    if (clampToMax) {
      const key = `max${property.charAt(0).toUpperCase() + property.slice(1)}`;
      const maxVal = (entityDef as Record<string, unknown>)?.[key] as number | undefined;
      if (maxVal !== undefined) newVal = Math.min(maxVal, newVal);
    }
    return { ...e, [property]: newVal };
  });
}

// ---------------------------------------------------------------------------
// Effect handlers
// ---------------------------------------------------------------------------

function handleEffectRespawnRandom(ec: EffectContext): void {
  const margin = (ec.effect.margin as number | undefined) ?? 40;
  const pos = randomInCanvas(margin, ec.ctx.canvas);
  ec.self.x = pos.x;
  ec.self.y = pos.y;
}

function handleEffectDestroy(ec: EffectContext): void {
  ec.destroySet.add(ec.self.instanceId);
}

export function handleEffectPropertyDelta(ec: EffectContext): void {
  const property = ec.effect.property as keyof EntityState;
  const delta = ec.effect.delta as number;
  const clampToMax = ec.effect.clampToMax as boolean | undefined;
  const clampToMin = ec.effect.clampToMin as boolean | undefined;
  let newVal = (ec.self[property] as number) + delta;
  if (clampToMax && delta > 0) {
    const key = `max${String(property).charAt(0).toUpperCase() + String(property).slice(1)}`;
    const maxVal = (ec.selfDef as Record<string, unknown>)[key] as number | undefined;
    if (maxVal !== undefined) newVal = Math.min(maxVal, newVal);
  }
  if (clampToMin && delta < 0) {
    const key = `min${String(property).charAt(0).toUpperCase() + String(property).slice(1)}`;
    const minVal = (ec.selfDef as Record<string, unknown>)[key] as number | undefined;
    if (minVal !== undefined) newVal = Math.max(minVal, newVal);
  }
  (ec.self as unknown as Record<string, unknown>)[property as string] = newVal;
  ec.ctx.onSizeChange(ec.self.id, newVal);
}

function handleEffectCollectItem(ec: EffectContext): void {
  const itemKey = ec.other.id;
  const amount = (ec.effect.amount as number | undefined) ?? 1;
  const inv = ec.self.inventory;
  const maxInv = (ec.selfDef as Record<string, unknown>)?.maxInventory as Record<string, number> | undefined;
  const cap = maxInv?.[itemKey];
  const current = inv[itemKey] ?? 0;
  inv[itemKey] = cap !== undefined ? Math.min(cap, current + amount) : current + amount;
  ec.ctx.onInventoryChange(ec.self.id, { ...inv });
}

function handleEffectConsumeInventoryItem(ec: EffectContext): void {
  const itemKey = (ec.options?.item as string | undefined) ?? ec.other.id;
  const amount = (ec.options?.amount as number | undefined) ?? (ec.effect.amount as number | undefined) ?? 1;
  const inv = ec.self.inventory;
  if ((inv[itemKey] ?? 0) >= amount) {
    inv[itemKey] = (inv[itemKey] ?? 0) - amount;
    ec.ctx.onInventoryChange(ec.self.id, { ...inv });
  }
}

export const effectRegistry: Record<string, (ec: EffectContext) => void> = {
  respawn_random: handleEffectRespawnRandom,
  destroy: handleEffectDestroy,
  collect_item: handleEffectCollectItem,
  consume_inventory_item: handleEffectConsumeInventoryItem,
};

// ---------------------------------------------------------------------------
// Interaction processing (runs one tick)
// ---------------------------------------------------------------------------

export function processInteractions(config: CONFIG, states: Record<string, EntityState[]>, gameCtx: GameContext): void {
  for (const interaction of config.interactions) {
    const interactionDef = INTERACTION_TYPES[interaction.type as keyof typeof INTERACTION_TYPES] as CONFIG;
    if (!interactionDef) continue;
    const groupA = states[interaction.entityA];
    const groupB = states[interaction.entityB];
    if (!groupA || !groupB) continue;
    const destroyA = new Set<number>();
    const destroyB = new Set<number>();
    const interactionOptions = (interaction.options ?? {}) as Record<string, unknown>;

    for (const a of groupA) {
      for (const b of groupB) {
        if (destroyA.has(a.instanceId) || destroyB.has(b.instanceId)) continue;
        if (dist(a, b) >= a.size + b.size * interactionDef.hitRadiusMultiplierB) continue;

        let effectList: CONFIG[];
        if ("effects_with_item" in interactionDef) {
          const item = (interactionOptions.item as string | undefined) ?? "";
          const amount = (interactionOptions.amount as number | undefined) ?? 1;
          const hasItem = (a.inventory[item] ?? 0) >= amount;
          effectList = hasItem ? interactionDef.effects_with_item : interactionDef.effects_without_item;
        } else {
          effectList = interactionDef.effects;
        }

        for (const effect of effectList) {
          const self = effect.target === "entityA" ? a : b;
          const other = effect.target === "entityA" ? b : a;
          const selfDef = config.entities.find((e: CONFIG) => e.id === self.id);
          const destroySet = effect.target === "entityA" ? destroyA : destroyB;
          const ec: EffectContext = {
            self, other,
            effect: effect as Record<string, unknown>,
            selfDef,
            destroySet,
            ctx: gameCtx,
            options: interactionOptions,
          };
          if ("action" in effect) effectRegistry[effect.action as string]?.(ec);
          else if ("delta" in effect) handleEffectPropertyDelta(ec);
        }
      }
    }
    if (destroyB.size > 0) {
      states[interaction.entityB] = states[interaction.entityB].filter((e) => !destroyB.has(e.instanceId));
    }
    if (destroyA.size > 0) {
      states[interaction.entityA] = states[interaction.entityA].filter((e) => !destroyA.has(e.instanceId));
    }
  }
}

// ---------------------------------------------------------------------------
// End-condition evaluation
// ---------------------------------------------------------------------------

export function evaluateEndConditions(
  config: CONFIG,
  states: Record<string, EntityState[]>,
  remaining: number
): { triggered: boolean; result: "won" | "lost" } {
  for (const cond of config.endConditions) {
    let triggered = false;
    if (cond.type === "timer_elapsed") {
      triggered = remaining <= 0;
    } else if (cond.type === "entity_property_threshold") {
      const p = cond.properties as { entity: string; property: string; operator: string; value: number };
      const target = states[p.entity]?.[0];
      if (target) {
        const val = target[p.property as keyof EntityState] as number;
        triggered =
          p.operator === "<=" ? val <= p.value :
          p.operator === "<"  ? val <  p.value :
          p.operator === ">=" ? val >= p.value :
          p.operator === ">"  ? val >  p.value :
          val === p.value;
      }
    } else if (cond.type === "entity_count_threshold") {
      const p = cond.properties as { entity: string; operator: string; value: number };
      const count = states[p.entity]?.length ?? 0;
      triggered =
        p.operator === "<=" ? count <= p.value :
        p.operator === "<"  ? count <  p.value :
        p.operator === ">=" ? count >= p.value :
        p.operator === ">"  ? count >  p.value :
        count === p.value;
    }
    if (triggered) return { triggered: true, result: cond.result as "won" | "lost" };
  }
  return { triggered: false, result: "lost" };
}
