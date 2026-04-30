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
  instanceId: number; // for multi-instance entities (e.g. hunger)
  x: number;
  y: number;
  size: number;
  speed: number;
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
  // "none" / "near_entity" handled at spawn time
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
// Component
// ---------------------------------------------------------------------------

export default function Page() {
  const canvas = CONFIG.meta.canvas;
  const playerBehavior = CONFIG.behaviors.find((b) => b.type === "player_controlled")!;
  const playerDef = CONFIG.entities.find((e) => e.id === playerBehavior.entity)!;
  const winTimer = CONFIG.endConditions.find((w) => w.type === "timer_elapsed")!;
  const WIN_TIME = (winTimer.properties as { seconds: number }).seconds;
  const MAX_SIZE = playerDef.maxSize as number;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const animRef = useRef<number | null>(null);

  // All live entity instances
  const statesRef = useRef<Record<string, EntityState[]>>(buildInitialStates());
  const lastSpawnRef = useRef(0);
  const instanceCounterRef = useRef(1);
  const startTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const gameOverRef = useRef(false);

  // React state for UI bars and overlay
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

        // ── Player movement ──────────────────────────────────────────────
        const player = states[playerDef.id][0];
        const k = keysRef.current;

        let dx = 0;
        let dy = 0;
        if (k["w"] || k["arrowup"])    dy -= 1;
        if (k["s"] || k["arrowdown"])  dy += 1;
        if (k["a"] || k["arrowleft"])  dx -= 1;
        if (k["d"] || k["arrowright"]) dx += 1;

        const len = Math.hypot(dx, dy) || 1;
        player.x += (dx / len) * player.speed * delta;
        player.y += (dy / len) * player.speed * delta;
        player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
        player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));

        // ── Spawn enemies ────────────────────────────────────────────────
        const spawnBehavior = CONFIG.behaviors.find((b) => b.type === "spawn_on_timer");
        if (spawnBehavior) {
          const p = spawnBehavior.properties as {
            intervalMs: number;
            spawnAt: { anchor: string; entity: string; offsetRadius: number };
            speedMin: number;
            speedMax: number;
          };
          if (now - lastSpawnRef.current > p.intervalMs) {
            const anchorEntity = states[p.spawnAt.entity]?.[0];
            const angle = Math.random() * Math.PI * 2;
            const enemyDef = CONFIG.entities.find((e) => e.id === spawnBehavior.entity)!;

            states[spawnBehavior.entity].push({
              id: spawnBehavior.entity,
              instanceId: instanceCounterRef.current++,
              x: (anchorEntity?.x ?? canvas.width / 2) + Math.cos(angle) * p.spawnAt.offsetRadius,
              y: (anchorEntity?.y ?? canvas.height / 2) + Math.sin(angle) * p.spawnAt.offsetRadius,
              size: enemyDef.size as number,
              speed: p.speedMin + Math.random() * (p.speedMax - p.speedMin),
            });
            lastSpawnRef.current = now;
          }
        }

        // ── Chase behavior ────────────────────────────────────────────────
        const chaseBehavior = CONFIG.behaviors.find((b) => b.type === "chase");

        if (chaseBehavior) {
          const chaseProps = chaseBehavior.properties as { target: string };
          const target = states[chaseProps.target]?.[0];
          if (target) {
            states[chaseBehavior.entity] = states[chaseBehavior.entity].map((e) => {
              const angle = Math.atan2(target.y - e.y, target.x - e.x);
              return {
                ...e,
                x: e.x + Math.cos(angle) * e.speed * delta,
                y: e.y + Math.sin(angle) * e.speed * delta,
              };
            });
          }
        }

        // ── Interactions ─────────────────────────────────────────────────
        for (const interaction of CONFIG.interactions) {
          const groupA = states[interaction.entityA];
          const groupB = states[interaction.entityB];
          if (!groupA || !groupB) continue;

          const interactionDef =
            INTERACTION_TYPES[interaction.type as keyof typeof INTERACTION_TYPES];
          if (!interactionDef) continue;

          const destroyB = new Set<number>();

          for (const a of groupA) {
            for (const b of groupB) {
              if (destroyB.has(b.instanceId)) continue;

              const hit = dist(a, b) < a.size + b.size * interactionDef.hitRadiusMultiplierB;
              if (!hit) continue;

              for (const effect of interactionDef.effects) {
                if (effect.target === "entityA") {
                  if (effect.action === "respawn_random") {
                    const margin =
                      (effect as { target: string; action: string; margin?: number }).margin ?? 40;
                    const pos = randomInCanvas(margin, canvas);
                    a.x = pos.x;
                    a.y = pos.y;
                  } else if ("delta" in effect && effect.property === "size") {
                    const d = effect.delta as number;
                    const clampMax =
                      (effect as { clampToMax?: boolean }).clampToMax && d > 0;
                    a.size = clampMax
                      ? Math.min(MAX_SIZE, a.size + d)
                      : a.size + d;
                    setPlayerSize(a.size);
                  }
                } else if (effect.target === "entityB") {
                  if (effect.action === "respawn_random") {
                    const margin =
                      (effect as { target: string; action: string; margin?: number }).margin ?? 40;
                    const pos = randomInCanvas(margin, canvas);
                    b.x = pos.x;
                    b.y = pos.y;
                  } else if (effect.action === "destroy") {
                    destroyB.add(b.instanceId);
                  } else if ("delta" in effect && effect.property === "size") {
                    b.size += effect.delta as number;
                    setPlayerSize(b.size);
                  }
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

        // ── Win/lose checks ───────────────────────────────────────────────
        for (const cond of CONFIG.endConditions) {
          if (cond.type === "timer_elapsed" && remaining <= 0) {
            gameOverRef.current = true;
            setStatus(cond.result as "won" | "lost");
          }
          if (cond.type === "entity_property_threshold") {
            const p = cond.properties as { entity: string; property: string; operator: string; value: number };
            const target = states[p.entity]?.[0];
            if (target) {
              const val = target[p.property as keyof EntityState] as number;
              const threshold = p.value;
              const op = p.operator;
              const triggered =
                op === "<=" ? val <= threshold :
                op === "<"  ? val < threshold :
                op === ">=" ? val >= threshold :
                op === ">"  ? val > threshold :
                val === threshold;
              if (triggered) {
                gameOverRef.current = true;
                setStatus(cond.result as "won" | "lost");
              }
            }
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
        const outcome = CONFIG.endConditions.find((c) => c.result === status) ??
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
  }, [status]);

  // ---------------------------------------------------------------------------
  // UI bar computations from config
  // ---------------------------------------------------------------------------
  const bars = CONFIG.ui.statusBars.map((bar) => {
    if (bar.source === "entity_size") {
      const pct =
        ((Math.max(bar.min!, playerSize) - bar.min!) / (bar.max! - bar.min!)) * 100;
      const display = `${Math.max(0, Math.round(pct))}%`;
      return { label: bar.label, color: bar.color, pct, display };
    } else {
      const pct = (timeLeft / (bar.total!)) * 100;
      const display = `${Math.ceil(timeLeft)}s`;
      return { label: bar.label, color: bar.color, pct, display };
    }
  });

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
