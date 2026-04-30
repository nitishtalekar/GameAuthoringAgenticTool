"use client";

import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

type Vec = { x: number; y: number };
type Hunger = { id: number; x: number; y: number; size: number; speed: number };

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;

const WIN_TIME = 60;
const MIN_MAN_SIZE = 16;
const MAX_MAN_SIZE = 70;
const START_MAN_SIZE = 36;

const FOOD_SIZE = 18;
const TIME_SIZE = 34;

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const animationRef = useRef<number | null>(null);

  const manRef = useRef({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    size: START_MAN_SIZE,
    speed: 260,
  });

  const foodRef = useRef<Vec>({ x: 150, y: 150 });
  const timeRef = useRef<Vec>({ x: CANVAS_WIDTH / 2, y: 90 });
  const hungerRef = useRef<Hunger[]>([]);
  const lastSpawnRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const hungerIdRef = useRef(0);
  const gameOverRef = useRef(false);

  const [manSize, setManSize] = useState(START_MAN_SIZE);
  const [timeLeft, setTimeLeft] = useState(WIN_TIME);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  const spawnFood = () => {
    foodRef.current = {
      x: 40 + Math.random() * (CANVAS_WIDTH - 80),
      y: 40 + Math.random() * (CANVAS_HEIGHT - 80),
    };
  };

  const spawnHunger = () => {
    const time = timeRef.current;
    const angle = Math.random() * Math.PI * 2;
    const x = time.x + Math.cos(angle) * TIME_SIZE * 0.5;
    const y = time.y + Math.sin(angle) * TIME_SIZE * 0.5;

    hungerRef.current.push({
      id: hungerIdRef.current++,
      x,
      y,
      size: 24,
      speed: 110 + Math.random() * 45,
    });
  };

  const resetGame = () => {
    manRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      size: START_MAN_SIZE,
      speed: 260,
    };
    hungerRef.current = [];
    lastSpawnRef.current = 0;
    startTimeRef.current = null;
    lastTimeRef.current = null;
    gameOverRef.current = false;
    spawnFood();
    setManSize(START_MAN_SIZE);
    setTimeLeft(WIN_TIME);
    setStatus("playing");
  };

  const drawCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    color: string,
    label: string
  ) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
  };

  const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now;
      if (!lastTimeRef.current) lastTimeRef.current = now;

      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      const elapsed = (now - startTimeRef.current) / 1000;
      const remaining = Math.max(0, WIN_TIME - elapsed);

      if (!gameOverRef.current) {
        const man = manRef.current;
        const keys = keysRef.current;

        let dx = 0;
        let dy = 0;
        if (keys.w || keys.arrowup) dy -= 1;
        if (keys.s || keys.arrowdown) dy += 1;
        if (keys.a || keys.arrowleft) dx -= 1;
        if (keys.d || keys.arrowright) dx += 1;

        const length = Math.hypot(dx, dy) || 1;
        man.x += (dx / length) * man.speed * delta;
        man.y += (dy / length) * man.speed * delta;
        man.x = Math.max(man.size, Math.min(CANVAS_WIDTH - man.size, man.x));
        man.y = Math.max(man.size, Math.min(CANVAS_HEIGHT - man.size, man.y));

        if (now - lastSpawnRef.current > 1400) {
          spawnHunger();
          lastSpawnRef.current = now;
        }

        hungerRef.current = hungerRef.current.filter((hunger) => {
          const angle = Math.atan2(man.y - hunger.y, man.x - hunger.x);
          hunger.x += Math.cos(angle) * hunger.speed * delta;
          hunger.y += Math.sin(angle) * hunger.speed * delta;

          const hitMan = distance(man, hunger) < man.size + hunger.size * 0.65;
          if (hitMan) {
            man.size -= 5;
            setManSize(man.size);
            return false;
          }
          return true;
        });

        const ateFood = distance(man, foodRef.current) < man.size + FOOD_SIZE * 0.8;
        if (ateFood) {
          man.size = Math.min(MAX_MAN_SIZE, man.size + 6);
          setManSize(man.size);
          spawnFood();
        }

        if (man.size <= MIN_MAN_SIZE) {
          gameOverRef.current = true;
          setStatus("lost");
        }
        if (remaining <= 0) {
          gameOverRef.current = true;
          setStatus("won");
        }

        setTimeLeft(remaining);
      }

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      drawCircle(ctx, timeRef.current.x, timeRef.current.y, TIME_SIZE, "#7c3aed", "Time");
      drawCircle(ctx, foodRef.current.x, foodRef.current.y, FOOD_SIZE, "#22c55e", "Food");
      hungerRef.current.forEach((hunger) => {
        drawCircle(ctx, hunger.x, hunger.y, hunger.size, "#ef4444", "Hunger");
      });
      drawCircle(ctx, manRef.current.x, manRef.current.y, manRef.current.size, "#38bdf8", "Man");

      if (gameOverRef.current) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          status === "won" ? "You Survived!" : "Man Got Too Small!",
          CANVAS_WIDTH / 2,
          CANVAS_HEIGHT / 2 - 20
        );
        ctx.font = "20px Arial";
        ctx.fillText("Press Restart to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 35);
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [status]);

  const sizePercent =
    ((Math.max(MIN_MAN_SIZE, manSize) - MIN_MAN_SIZE) / (MAX_MAN_SIZE - MIN_MAN_SIZE)) * 100;
  const timePercent = (timeLeft / WIN_TIME) * 100;

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
      <Box sx={{ width: CANVAS_WIDTH, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#fff", lineHeight: 1.2 }}>
            Man vs Hunger
          </Typography>
          <Typography variant="caption" sx={{ color: "#94a3b8" }}>
            Move with WASD or arrow keys. Eat Food. Avoid Hunger. Survive Time.
          </Typography>
        </Box>
        <Button variant="contained" onClick={resetGame} sx={{ bgcolor: "#fff", color: "#0f172a", fontWeight: "bold", "&:hover": { bgcolor: "#e2e8f0" } }}>
          Restart
        </Button>
      </Box>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          borderRadius: 12,
          border: "1px solid #334155",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          maxHeight: "calc(100vh - 120px)",
          aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
          width: "auto",
        }}
      />

      <Box sx={{ width: CANVAS_WIDTH, display: "flex", flexDirection: "column", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography sx={{ width: 100, flexShrink: 0, color: "#fff", fontWeight: "bold", fontSize: 13 }}>
            Man Size
          </Typography>
          <LinearProgress
            variant="determinate"
            value={sizePercent}
            sx={{
              flex: 1,
              height: 14,
              borderRadius: 7,
              bgcolor: "#1e293b",
              "& .MuiLinearProgress-bar": { bgcolor: "#38bdf8", borderRadius: 7 },
            }}
          />
          <Typography sx={{ width: 44, flexShrink: 0, textAlign: "right", color: "#38bdf8", fontWeight: "bold", fontSize: 13 }}>
            {Math.max(0, Math.round(sizePercent))}%
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography sx={{ width: 100, flexShrink: 0, color: "#fff", fontWeight: "bold", fontSize: 13 }}>
            Time To Win
          </Typography>
          <LinearProgress
            variant="determinate"
            value={timePercent}
            sx={{
              flex: 1,
              height: 14,
              borderRadius: 7,
              bgcolor: "#1e293b",
              "& .MuiLinearProgress-bar": { bgcolor: "#a855f7", borderRadius: 7 },
            }}
          />
          <Typography sx={{ width: 44, flexShrink: 0, textAlign: "right", color: "#a855f7", fontWeight: "bold", fontSize: 13 }}>
            {Math.ceil(timeLeft)}s
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
