// ---------------------------------------------------------------------------
// Shared types for the game engine
// ---------------------------------------------------------------------------

export type Vec = { x: number; y: number };

export interface EntityState {
  id: string;
  instanceId: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  inventory: Record<string, number>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CONFIG = any;

export interface GameContext {
  states: Record<string, EntityState[]>;
  delta: number;
  now: number;
  elapsed: number;
  remaining: number;
  canvas: { width: number; height: number; background: string };
  keys: Record<string, boolean>;
  instanceCounter: { current: number };
  lastSpawnMap: { current: Record<number, number> };
  onSizeChange: (entityId: string, newSize: number) => void;
  onInventoryChange: (entityId: string, inventory: Record<string, number>) => void;
}

export interface EffectContext {
  self: EntityState;
  other: EntityState;
  effect: Record<string, unknown>;
  selfDef: CONFIG;
  destroySet: Set<number>;
  ctx: GameContext;
  options: Record<string, unknown>;
}
