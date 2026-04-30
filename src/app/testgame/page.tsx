"use client";

import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import CONFIG from "./game-config.json";
import INTERACTION_TYPES from "./interaction-types.json";

// ---------------------------------------------------------------------------
// Types derived from the JSON schema
// ---------------------------------------------------------------------------

type Vec = { x: number; y: number };

interface EntityState {
  id: string;
  instanceId: number;
  x: number;
  y: number;
  size: number;
  speed: number;
}

// ---------------------------------------------------------------------------
// Context types passed into handlers — keeps handlers pure and module-level
// ---------------------------------------------------------------------------

interface GameContext {
  states: Record<string, EntityState[]>;
  delta: number;
  now: number;
  elapsed: number;
  remaining: number;
  canvas: typeof CONFIG.meta.canvas;
  keys: Record<string, boolean>;
  instanceCounter: { current: number };
  lastSpawn: { current: number };
  onSizeChange: (entityId: string, newSize: number) => void;
}

interface EffectContext {
  self: EntityState;
  other: EntityState;
  effect: Record<string, unknown>;
  selfDef: (typeof CONFIG.entities)[number];
  destroySet: Set<number>;
  ctx: GameContext;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

function resolveInitialPosition(
  anchor: string,
  canvas: { width: number; height: number },
  x?: number,
  y?: number
): Vec {
  if (anchor === "center") return { x: canvas.width / 2, y: canvas.height / 2 };
  if (anchor === "fixed" && x !== undefined && y !== undefined) return { x, y };
  return { x: 0, y: 0 };
}

function randomInCanvas(margin: number, canvas: { width: number; height: number }): Vec {
  return {
    x: margin + Math.random() * (canvas.width - margin * 2),
    y: margin + Math.random() * (canvas.height - margin * 2),
  };
}

function drawCircle(
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
// Build initial entity states from config
// ---------------------------------------------------------------------------

const spawnedEntities = new Set(
  CONFIG.behaviors.filter((b) => b.type === "spawn_on_timer").map((b) => b.entity)
);

function buildInitialStates(): Record<string, EntityState[]> {
  const canvas = CONFIG.meta.canvas;
  const states: Record<string, EntityState[]> = {};

  for (const eDef of CONFIG.entities) {
    if (spawnedEntities.has(eDef.id)) {
      states[eDef.id] = [];
      continue;
    }

    const pos = resolveInitialPosition(
      eDef.initialPosition.anchor,
      canvas,
      (eDef.initialPosition as { anchor: string; x?: number; y?: number }).x,
      (eDef.initialPosition as { anchor: string; x?: number; y?: number }).y
    );

    const size =
      "initialSize" in eDef ? (eDef.initialSize as number) : (eDef.size as number);

    states[eDef.id] = [
      {
        id: eDef.id,
        instanceId: 0,
        x: pos.x,
        y: pos.y,
        size,
        speed: (eDef as { speed?: number }).speed ?? 0,
      },
    ];
  }

  return states;
}

// ---------------------------------------------------------------------------
// Behavior handlers
// To add a new behavior: write a function here, then add it to behaviorRegistry.
// ---------------------------------------------------------------------------

function handlePlayerControlled(
  behavior: (typeof CONFIG.behaviors)[number],
  ctx: GameContext
): void {
  const entity = ctx.states[behavior.entity]?.[0];
  if (!entity) return;

  const k = ctx.keys;
  let dx = 0;
  let dy = 0;
  if (k["w"] || k["arrowup"])    dy -= 1;
  if (k["s"] || k["arrowdown"])  dy += 1;
  if (k["a"] || k["arrowleft"])  dx -= 1;
  if (k["d"] || k["arrowright"]) dx += 1;

  const len = Math.hypot(dx, dy) || 1;
  entity.x += (dx / len) * entity.speed * ctx.delta;
  entity.y += (dy / len) * entity.speed * ctx.delta;

  const clamp = (behavior as { clampToCanvas?: boolean; properties?: { clampToCanvas?: boolean } })
    .clampToCanvas ??
    (behavior as { properties?: { clampToCanvas?: boolean } }).properties?.clampToCanvas ??
    true;

  if (clamp) {
    entity.x = Math.max(entity.size, Math.min(ctx.canvas.width - entity.size, entity.x));
    entity.y = Math.max(entity.size, Math.min(ctx.canvas.height - entity.size, entity.y));
  }
}

function handleChase(
  behavior: (typeof CONFIG.behaviors)[number],
  ctx: GameContext
): void {
  const props = behavior.properties as { target: string };
  const target = ctx.states[props.target]?.[0];
  if (!target) return;

  ctx.states[behavior.entity] = ctx.states[behavior.entity].map((e) => {
    const angle = Math.atan2(target.y - e.y, target.x - e.x);
    return {
      ...e,
      x: e.x + Math.cos(angle) * e.speed * ctx.delta,
      y: e.y + Math.sin(angle) * e.speed * ctx.delta,
    };
  });
}

function handleSpawnOnTimer(
  behavior: (typeof CONFIG.behaviors)[number],
  ctx: GameContext
): void {
  const p = behavior.properties as {
    intervalMs: number;
    spawnAt: { anchor: string; entity: string; offsetRadius: number };
    speedMin: number;
    speedMax: number;
  };

  if (ctx.now - ctx.lastSpawn.current <= p.intervalMs) return;

  const enemyDef = CONFIG.entities.find((e) => e.id === behavior.entity)!;
  let spawnX = ctx.canvas.width / 2;
  let spawnY = ctx.canvas.height / 2;

  if (p.spawnAt.anchor === "near_entity") {
    const anchor = ctx.states[p.spawnAt.entity]?.[0];
    const angle = Math.random() * Math.PI * 2;
    spawnX = (anchor?.x ?? spawnX) + Math.cos(angle) * p.spawnAt.offsetRadius;
    spawnY = (anchor?.y ?? spawnY) + Math.sin(angle) * p.spawnAt.offsetRadius;
  }
  // Add new spawn anchors here (e.g. "random_edge", "fixed") without touching the loop

  ctx.states[behavior.entity].push({
    id: behavior.entity,
    instanceId: ctx.instanceCounter.current++,
    x: spawnX,
    y: spawnY,
    size: enemyDef.size as number,
    speed: p.speedMin + Math.random() * (p.speedMax - p.speedMin),
  });

  ctx.lastSpawn.current = ctx.now;
}

// ---------------------------------------------------------------------------
// Effect handlers
// To add a new action effect: write a function here, then add it to effectRegistry.
// To add support for a new entity property delta: it's automatic — handleEffectPropertyDelta
// reads effect.property as a key into EntityState, so any numeric field works.
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

function handleEffectPropertyDelta(ec: EffectContext): void {
  const property = ec.effect.property as keyof EntityState;
  const delta = ec.effect.delta as number;
  const clampToMax = ec.effect.clampToMax as boolean | undefined;
  const clampToMin = ec.effect.clampToMin as boolean | undefined;

  let newVal = (ec.self[property] as number) + delta;

  if (clampToMax && delta > 0) {
    const maxVal = (ec.selfDef as Record<string, unknown>)[`max${property.charAt(0).toUpperCase() + property.slice(1)}`] as number | undefined;
    if (maxVal !== undefined) newVal = Math.min(maxVal, newVal);
  }
  if (clampToMin && delta < 0) {
    const minVal = (ec.selfDef as Record<string, unknown>)[`min${property.charAt(0).toUpperCase() + property.slice(1)}`] as number | undefined;
    if (minVal !== undefined) newVal = Math.max(minVal, newVal);
  }

  (ec.self as unknown as Record<string, unknown>)[property as string] = newVal;
  ec.ctx.onSizeChange(ec.self.id, newVal);
}

// ---------------------------------------------------------------------------
// End condition checkers
// To add a new condition type: write a function here, then add it to endConditionRegistry.
// ---------------------------------------------------------------------------

function checkTimerElapsed(
  _cond: (typeof CONFIG.endConditions)[number],
  ctx: GameContext
): boolean {
  return ctx.remaining <= 0;
}

function checkEntityPropertyThreshold(
  cond: (typeof CONFIG.endConditions)[number],
  ctx: GameContext
): boolean {
  const p = cond.properties as { entity: string; property: string; operator: string; value: number };
  const target = ctx.states[p.entity]?.[0];
  if (!target) return false;

  const val = target[p.property as keyof EntityState] as number;
  const op = p.operator;
  return (
    op === "<=" ? val <= p.value :
    op === "<"  ? val <  p.value :
    op === ">=" ? val >= p.value :
    op === ">"  ? val >  p.value :
    val === p.value
  );
}

// ---------------------------------------------------------------------------
// UI bar source handlers
// To add a new bar source type: write a function here, then add it to barSourceRegistry.
// ---------------------------------------------------------------------------

function computeEntitySizeBar(
  bar: (typeof CONFIG.ui.statusBars)[number],
  states: Record<string, EntityState[]>,
  _timeLeft: number
): { pct: number; display: string } {
  const b = bar as { entity?: string; min?: number; max?: number };
  const size = states[b.entity ?? ""]?.[0]?.size ?? b.min ?? 0;
  const pct = ((Math.max(b.min!, size) - b.min!) / (b.max! - b.min!)) * 100;
  return { pct, display: `${Math.max(0, Math.round(pct))}%` };
}

function computeTimerRemainingBar(
  bar: (typeof CONFIG.ui.statusBars)[number],
  _states: Record<string, EntityState[]>,
  timeLeft: number
): { pct: number; display: string } {
  const b = bar as { total?: number };
  const pct = (timeLeft / b.total!) * 100;
  return { pct, display: `${Math.ceil(timeLeft)}s` };
}

// ---------------------------------------------------------------------------
// Registries — the only place that needs to change when adding new types
// ---------------------------------------------------------------------------

type BehaviorHandler = (behavior: (typeof CONFIG.behaviors)[number], ctx: GameContext) => void;
const behaviorRegistry: Record<string, BehaviorHandler> = {
  player_controlled: handlePlayerControlled,
  chase: handleChase,
  spawn_on_timer: handleSpawnOnTimer,
};

type EffectHandler = (ec: EffectContext) => void;
const effectRegistry: Record<string, EffectHandler> = {
  respawn_random: handleEffectRespawnRandom,
  destroy: handleEffectDestroy,
};

type EndConditionChecker = (cond: (typeof CONFIG.endConditions)[number], ctx: GameContext) => boolean;
const endConditionRegistry: Record<string, EndConditionChecker> = {
  timer_elapsed: checkTimerElapsed,
  entity_property_threshold: checkEntityPropertyThreshold,
};

type BarSourceHandler = (
  bar: (typeof CONFIG.ui.statusBars)[number],
  states: Record<string, EntityState[]>,
  timeLeft: number
) => { pct: number; display: string };
const barSourceRegistry: Record<string, BarSourceHandler> = {
  entity_size: computeEntitySizeBar,
  timer_remaining: computeTimerRemainingBar,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Page() {
  const canvas = CONFIG.meta.canvas;
  const playerBehavior = CONFIG.behaviors.find((b) => b.type === "player_controlled")!;
  const playerDef = CONFIG.entities.find((e) => e.id === playerBehavior.entity)!;
  const WIN_TIME = (CONFIG.endConditions.find((c) => c.type === "timer_elapsed")!.properties as { seconds: number }).seconds;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const animRef = useRef<number | null>(null);

  const statesRef = useRef<Record<string, EntityState[]>>(buildInitialStates());
  const lastSpawnRef = useRef(0);
  const instanceCounterRef = useRef(1);
  const startTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverRef = useRef(false);

  const [playerSize, setPlayerSize] = useState(playerDef.initialSize as number);
  const [timeLeft, setTimeLeft] = useState(WIN_TIME);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = true);
    const up = (e: KeyboardEvent) => (keysRef.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const resetGame = () => {
    statesRef.current = buildInitialStates();
    lastSpawnRef.current = 0;
    instanceCounterRef.current = 1;
    startTimeRef.current = null;
    lastTimeRef.current = null;
    gameOverRef.current = false;
    setPlayerSize(playerDef.initialSize as number);
    setTimeLeft(WIN_TIME);
    setStatus("playing");
  };

  // ---------------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    const loop = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;
      if (!lastTimeRef.current) lastTimeRef.current = now;

      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const elapsed = (now - startTimeRef.current) / 1000;
      const remaining = Math.max(0, WIN_TIME - elapsed);

      if (!gameOverRef.current) {
        const states = statesRef.current;

        const gameCtx: GameContext = {
          states,
          delta,
          now,
          elapsed,
          remaining,
          canvas,
          keys: keysRef.current,
          instanceCounter: instanceCounterRef,
          lastSpawn: lastSpawnRef,
          onSizeChange: (id, val) => {
            if (id === playerDef.id) setPlayerSize(val);
          },
        };

        // ── Behavior dispatch ─────────────────────────────────────────────
        // To add a new behavior: write a handler function above, add to behaviorRegistry.
        for (const behavior of CONFIG.behaviors) {
          behaviorRegistry[behavior.type as string]?.(behavior, gameCtx);
        }

        // ── Interaction dispatch ──────────────────────────────────────────
        // Fully data-driven: effect actions and property deltas are resolved
        // from interaction-types.json via effectRegistry / handleEffectPropertyDelta.
        for (const interaction of CONFIG.interactions) {
          const interactionDef =
            INTERACTION_TYPES[interaction.type as keyof typeof INTERACTION_TYPES];
          if (!interactionDef) continue;

          const groupA = states[interaction.entityA];
          const groupB = states[interaction.entityB];
          if (!groupA || !groupB) continue;

          const destroyB = new Set<number>();

          for (const a of groupA) {
            for (const b of groupB) {
              if (destroyB.has(b.instanceId)) continue;
              if (dist(a, b) >= a.size + b.size * interactionDef.hitRadiusMultiplierB) continue;

              for (const effect of interactionDef.effects) {
                const self = effect.target === "entityA" ? a : b;
                const other = effect.target === "entityA" ? b : a;
                const selfDef = CONFIG.entities.find((e) => e.id === self.id)!;
                const ec: EffectContext = {
                  self,
                  other,
                  effect: effect as Record<string, unknown>,
                  selfDef,
                  destroySet: destroyB,
                  ctx: gameCtx,
                };

                if ("action" in effect) {
                  effectRegistry[effect.action as string]?.(ec);
                } else if ("delta" in effect) {
                  handleEffectPropertyDelta(ec);
                }
              }
            }
          }

          if (destroyB.size > 0) {
            states[interaction.entityB] = states[interaction.entityB].filter(
              (e) => !destroyB.has(e.instanceId)
            );
          }
        }

        // ── End condition dispatch ────────────────────────────────────────
        // To add a new condition type: write a checker above, add to endConditionRegistry.
        for (const cond of CONFIG.endConditions) {
          if (endConditionRegistry[cond.type as string]?.(cond, gameCtx)) {
            gameOverRef.current = true;
            setStatus(cond.result as "won" | "lost");
          }
        }

        setTimeLeft(remaining);
      }

      // ── Draw ────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = canvas.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const states = statesRef.current;
      for (const eDef of CONFIG.entities) {
        const instances = states[eDef.id] ?? [];
        for (const inst of instances) {
          drawCircle(ctx, inst.x, inst.y, inst.size, eDef.color, eDef.label);
        }
      }

      if (gameOverRef.current) {
        const outcome =
          CONFIG.endConditions.find((c) => c.result === status) ??
          CONFIG.endConditions.find((c) => c.result !== "playing");
        const msg = outcome?.message ?? (status === "won" ? "You Won!" : "Game Over");

        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(msg, canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "20px Arial";
        ctx.fillText("Press Restart to play again", canvas.width / 2, canvas.height / 2 + 35);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // UI bar computation — data-driven via barSourceRegistry
  // To add a new bar source type: write a handler above, add to barSourceRegistry.
  // ---------------------------------------------------------------------------
  const bars = CONFIG.ui.statusBars.map((bar) => {
    const result = barSourceRegistry[bar.source as string]?.(bar, statesRef.current, timeLeft)
      ?? { pct: 0, display: "?" };
    return { label: bar.label, color: bar.color, ...result };
  });

  // playerSize is only used to trigger re-renders when entity size changes
  void playerSize;

  return (
    <Box
      sx={{
        height: "100vh",
        overflow: "hidden",
        bgcolor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        p: 2,
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          width: canvas.width,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#fff", lineHeight: 1.2 }}>
            {CONFIG.meta.title}
          </Typography>
          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
            {CONFIG.meta.instructions}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={resetGame}
          sx={{
            bgcolor: "#fff",
            color: "#0f172a",
            fontWeight: "bold",
            "&:hover": { bgcolor: "#e2e8f0" },
          }}
        >
          Restart
        </Button>
      </Box>

      <canvas
        ref={canvasRef}
        width={canvas.width}
        height={canvas.height}
        style={{
          borderRadius: 12,
          border: "1px solid #334155",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          maxHeight: "calc(100vh - 120px)",
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          width: "auto",
        }}
      />

      <Box sx={{ width: canvas.width, display: "flex", flexDirection: "column", gap: 1 }}>
        {bars.map((bar) => (
          <Box key={bar.label} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography
              sx={{
                width: 100,
                flexShrink: 0,
                color: "#fff",
                fontWeight: "bold",
                fontSize: 13,
              }}
            >
              {bar.label}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={bar.pct}
              sx={{
                flex: 1,
                height: 14,
                borderRadius: 7,
                bgcolor: "#1e293b",
                "& .MuiLinearProgress-bar": { bgcolor: bar.color, borderRadius: 7 },
              }}
            />
            <Typography
              sx={{
                width: 44,
                flexShrink: 0,
                textAlign: "right",
                color: bar.color,
                fontWeight: "bold",
                fontSize: 13,
              }}
            >
              {bar.display}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
