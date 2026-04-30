"use client";

import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import INTERACTION_TYPES from "./interaction-types.json";
import { GAME_CONFIG_SAMPLES } from "@/lib/game-config-samples";

// ---------------------------------------------------------------------------
// Types
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CONFIG = any;

interface GameContext {
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
}

interface EffectContext {
  self: EntityState;
  other: EntityState;
  effect: Record<string, unknown>;
  selfDef: CONFIG;
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
// Build initial states
// ---------------------------------------------------------------------------

function buildInitialStates(config: CONFIG): Record<string, EntityState[]> {
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
      { id: eDef.id, instanceId: 0, x: pos.x, y: pos.y, size, speed: eDef.speed ?? 0 },
    ];
  }
  return states;
}

// ---------------------------------------------------------------------------
// Behavior handlers
// ---------------------------------------------------------------------------

function handlePlayerControlled(behavior: CONFIG, ctx: GameContext): void {
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

function handleChase(behavior: CONFIG, ctx: GameContext): void {
  const target = ctx.states[behavior.properties?.target]?.[0];
  if (!target) return;
  ctx.states[behavior.entity] = ctx.states[behavior.entity].map((e) => {
    const angle = Math.atan2(target.y - e.y, target.x - e.x);
    return { ...e, x: e.x + Math.cos(angle) * e.speed * ctx.delta, y: e.y + Math.sin(angle) * e.speed * ctx.delta };
  });
}

function resolveSpawnPosition(
  p: CONFIG,
  ctx: GameContext
): { x: number; y: number } {
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
    if (edge === 0) return { x: Math.random() * w, y: -offset };        // top
    if (edge === 1) return { x: Math.random() * w, y: h + offset };     // bottom
    if (edge === 2) return { x: -offset,            y: Math.random() * h }; // left
    return                 { x: w + offset,          y: Math.random() * h }; // right
  }

  return { x: w / 2, y: h / 2 };
}

function handleSpawnOnTimer(behavior: CONFIG, behaviorIndex: number, ctx: GameContext, config: CONFIG): void {
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
  });
  ctx.lastSpawnMap.current[behaviorIndex] = ctx.now;
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

function handleEffectPropertyDelta(ec: EffectContext): void {
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

const effectRegistry: Record<string, (ec: EffectContext) => void> = {
  respawn_random: handleEffectRespawnRandom,
  destroy: handleEffectDestroy,
};

// ---------------------------------------------------------------------------
// Game component — receives a validated config
// ---------------------------------------------------------------------------

function GameRenderer({ config, onExit }: { config: CONFIG; onExit: () => void }) {
  const canvas = config.meta.canvas;
  const playerBehavior = config.behaviors.find((b: CONFIG) => b.type === "player_controlled");
  const playerDef = playerBehavior
    ? config.entities.find((e: CONFIG) => e.id === playerBehavior.entity)
    : null;

  const WIN_TIME =
    (config.endConditions.find((c: CONFIG) => c.type === "timer_elapsed")?.properties as { seconds?: number })
      ?.seconds ?? 60;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const animRef = useRef<number | null>(null);
  const statesRef = useRef<Record<string, EntityState[]>>(buildInitialStates(config));
  const lastSpawnMapRef = useRef<Record<number, number>>({});
  const instanceCounterRef = useRef(1);
  const startTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverRef = useRef(false);

  const [playerSize, setPlayerSize] = useState<number>(playerDef?.initialSize ?? playerDef?.size ?? 20);
  const [timeLeft, setTimeLeft] = useState(WIN_TIME);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

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

  const resetGame = () => {
    statesRef.current = buildInitialStates(config);
    lastSpawnMapRef.current = {};
    instanceCounterRef.current = 1;
    startTimeRef.current = null;
    lastTimeRef.current = null;
    gameOverRef.current = false;
    setPlayerSize(playerDef?.initialSize ?? playerDef?.size ?? 20);
    setTimeLeft(WIN_TIME);
    setStatus("playing");
  };

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
          states, delta, now, elapsed, remaining, canvas,
          keys: keysRef.current,
          instanceCounter: instanceCounterRef,
          lastSpawnMap: lastSpawnMapRef,
          onSizeChange: (id, val) => {
            if (playerDef && id === playerDef.id) setPlayerSize(val);
          },
        };

        config.behaviors.forEach((behavior: CONFIG, i: number) => {
          if (behavior.type === "player_controlled") handlePlayerControlled(behavior, gameCtx);
          else if (behavior.type === "chase") handleChase(behavior, gameCtx);
          else if (behavior.type === "spawn_on_timer") handleSpawnOnTimer(behavior, i, gameCtx, config);
        });

        for (const interaction of config.interactions) {
          const interactionDef = INTERACTION_TYPES[interaction.type as keyof typeof INTERACTION_TYPES];
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
                const selfDef = config.entities.find((e: CONFIG) => e.id === self.id);
                const ec: EffectContext = {
                  self, other,
                  effect: effect as Record<string, unknown>,
                  selfDef,
                  destroySet: destroyB,
                  ctx: gameCtx,
                };
                if ("action" in effect) effectRegistry[effect.action as string]?.(ec);
                else if ("delta" in effect) handleEffectPropertyDelta(ec);
              }
            }
          }
          if (destroyB.size > 0) {
            states[interaction.entityB] = states[interaction.entityB].filter(
              (e) => !destroyB.has(e.instanceId)
            );
          }
        }

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
          }
          if (triggered) {
            gameOverRef.current = true;
            setStatus(cond.result as "won" | "lost");
          }
        }

        setTimeLeft(remaining);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = canvas.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const states = statesRef.current;
      for (const eDef of config.entities) {
        const instances = states[eDef.id] ?? [];
        for (const inst of instances) {
          drawCircle(ctx, inst.x, inst.y, inst.size, eDef.color, eDef.label);
        }
      }

      if (gameOverRef.current) {
        const outcome =
          config.endConditions.find((c: CONFIG) => c.result === status) ??
          config.endConditions.find((c: CONFIG) => c.result !== "playing");
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
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  void playerSize;

  const bars = (config.ui?.statusBars ?? []).map((bar: CONFIG) => {
    let pct = 0;
    let display = "?";
    if (bar.source === "entity_size") {
      const size = statesRef.current[bar.entity ?? ""]?.[0]?.size ?? bar.min ?? 0;
      pct = ((Math.max(bar.min, size) - bar.min) / (bar.max - bar.min)) * 100;
      display = `${Math.max(0, Math.round(pct))}%`;
    } else if (bar.source === "timer_remaining") {
      pct = (timeLeft / bar.total) * 100;
      display = `${Math.ceil(timeLeft)}s`;
    }
    return { label: bar.label, color: bar.color, pct, display };
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Box sx={{ width: canvas.width, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#fff", lineHeight: 1.2 }}>
            {config.meta.title}
          </Typography>
          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
            {config.meta.instructions}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            onClick={onExit}
            sx={{ color: "#94a3b8", borderColor: "#334155", "&:hover": { borderColor: "#64748b" } }}
          >
            Edit JSON
          </Button>
          <Button
            variant="contained"
            onClick={resetGame}
            sx={{ bgcolor: "#fff", color: "#0f172a", fontWeight: "bold", "&:hover": { bgcolor: "#e2e8f0" } }}
          >
            Restart
          </Button>
        </Box>
      </Box>

      <canvas
        ref={canvasRef}
        width={canvas.width}
        height={canvas.height}
        style={{
          borderRadius: 12,
          border: "1px solid #334155",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          maxHeight: "calc(100vh - 180px)",
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          width: "auto",
        }}
      />

      <Box sx={{ width: canvas.width, display: "flex", flexDirection: "column", gap: 1 }}>
        {bars.map((bar: { label: string; color: string; pct: number; display: string }) => (
          <Box key={bar.label} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography sx={{ width: 120, flexShrink: 0, color: "#fff", fontWeight: "bold", fontSize: 13 }}>
              {bar.label}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, bar.pct))}
              sx={{
                flex: 1,
                height: 14,
                borderRadius: 7,
                bgcolor: "#1e293b",
                "& .MuiLinearProgress-bar": { bgcolor: bar.color, borderRadius: 7 },
              }}
            />
            <Typography sx={{ width: 44, flexShrink: 0, textAlign: "right", color: bar.color, fontWeight: "bold", fontSize: 13 }}>
              {bar.display}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Editor — JSON input with sample picker
// ---------------------------------------------------------------------------

function JsonEditor({ onPlay }: { onPlay: (config: CONFIG) => void }) {
  const [jsonInput, setJsonInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState("");

  const handleSampleSelect = (sampleId: string) => {
    setSelectedSample(sampleId);
    if (!sampleId) return;
    const sample = GAME_CONFIG_SAMPLES.find((s) => s.id === sampleId);
    if (sample) {
      setJsonInput(JSON.stringify(sample.config, null, 2));
      setParseError(null);
    }
  };

  const handlePlay = () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput);
      setParseError(null);
      onPlay(parsed);
    } catch (e) {
      setParseError(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <Box sx={{ maxWidth: 860, mx: "auto", width: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ color: "#fff", fontWeight: "bold" }}>
          Play Game
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ color: "#94a3b8", fontSize: 13, flexShrink: 0 }}>
            Load sample:
          </Typography>
          <Select
            value={selectedSample}
            onChange={(e) => handleSampleSelect(e.target.value)}
            displayEmpty
            size="small"
            sx={{
              color: "#fff",
              fontSize: 13,
              minWidth: 180,
              ".MuiOutlinedInput-notchedOutline": { borderColor: "#334155" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#64748b" },
              ".MuiSvgIcon-root": { color: "#94a3b8" },
              ".MuiSelect-select": { py: "6px" },
            }}
          >
            <MenuItem value="" sx={{ color: "#94a3b8", fontSize: 13 }}>
              — choose a sample —
            </MenuItem>
            {GAME_CONFIG_SAMPLES.map((s) => (
              <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>
        Paste or edit a game-config JSON below, then click Play.
      </Typography>

      <textarea
        value={jsonInput}
        onChange={(e) => { setJsonInput(e.target.value); setParseError(null); }}
        placeholder='{ "meta": { "title": "My Game", ... }, "entities": [...], ... }'
        rows={20}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 12,
          fontFamily: "monospace",
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 8,
          resize: "vertical",
          boxSizing: "border-box",
          lineHeight: 1.6,
          outline: "none",
        }}
      />

      {parseError && (
        <Box sx={{ mt: 1, p: "10px 14px", bgcolor: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 1 }}>
          <Typography sx={{ color: "#fca5a5", fontSize: 13 }}>{parseError}</Typography>
        </Box>
      )}

      <Button
        variant="contained"
        onClick={handlePlay}
        disabled={!jsonInput.trim()}
        sx={{ mt: 2, fontWeight: "bold", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
      >
        Play
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlayPage() {
  const [config, setConfig] = useState<CONFIG | null>(null);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: config ? "center" : "flex-start",
        p: 3,
        boxSizing: "border-box",
        gap: 2,
      }}
    >
      {config ? (
        <GameRenderer config={config} onExit={() => setConfig(null)} />
      ) : (
        <JsonEditor onPlay={(parsed) => setConfig(parsed)} />
      )}
    </Box>
  );
}
