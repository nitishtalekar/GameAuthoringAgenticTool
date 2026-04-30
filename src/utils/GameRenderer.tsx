"use client";

import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import {
  buildInitialStates,
  drawCircle,
  evaluateEndConditions,
  handleChase,
  handleGrowOverTime,
  handlePlayerControlled,
  handleSpawnOnTimer,
  processInteractions,
} from "./game-engine";
import { CONFIG, EntityState, GameContext } from "./game-types";

export function GameRenderer({ config, onExit }: { config: CONFIG; onExit: () => void }) {
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
  const [inventoryState, setInventoryState] = useState<Record<string, Record<string, number>>>({});

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
    setInventoryState({});
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
          onInventoryChange: (id, inv) => {
            setInventoryState((prev) => ({ ...prev, [id]: inv }));
          },
        };

        config.behaviors.forEach((behavior: CONFIG, i: number) => {
          if (behavior.type === "player_controlled") handlePlayerControlled(behavior, gameCtx);
          else if (behavior.type === "chase") handleChase(behavior, gameCtx);
          else if (behavior.type === "spawn_on_timer") handleSpawnOnTimer(behavior, i, gameCtx, config);
          else if (behavior.type === "grow_over_time") handleGrowOverTime(behavior, gameCtx, config);
        });

        processInteractions(config, states, gameCtx);

        const end = evaluateEndConditions(config, states, remaining);
        if (end.triggered) {
          gameOverRef.current = true;
          setStatus(end.result);
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
    } else if (bar.source === "entity_inventory_item") {
      const inv = inventoryState[bar.entity ?? ""] ?? statesRef.current[bar.entity ?? ""]?.[0]?.inventory ?? {};
      const count = inv[bar.item ?? ""] ?? 0;
      pct = bar.max > 0 ? (count / bar.max) * 100 : 0;
      display = `${count}`;
    }
    return { label: bar.label, color: bar.color, pct, display };
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
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

        {bars.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1, minWidth: 180 }}>
            {bars.map((bar: { label: string; color: string; pct: number; display: string }) => (
              <Box key={bar.label} sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Typography sx={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>
                    {bar.label}
                  </Typography>
                  <Typography sx={{ color: bar.color, fontWeight: "bold", fontSize: 12 }}>
                    {bar.display}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, bar.pct))}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    bgcolor: "#1e293b",
                    "& .MuiLinearProgress-bar": { bgcolor: bar.color, borderRadius: 5 },
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
