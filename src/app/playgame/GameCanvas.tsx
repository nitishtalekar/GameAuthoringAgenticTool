"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { ParsedGame, ParsedEntity, ParsedSpawn } from "@/lib/game/xml-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameCanvasProps {
  parsedGame: ParsedGame;
  onStatusChange: (status: "playing" | "won" | "lost", message: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_W = 800;
const CANVAS_H = 500;

const COLORS = {
  player: 0x3498db,
  chaser: 0xe74c3c,
  obstacle: 0x95a5a6,
  absorb: 0x2ecc71,
  other: 0x9b59b6,
  bg: 0x1a1a2e,
};

// Zone → spawn coordinates
function zoneCoords(
  zone: ParsedSpawn["zone"],
  size: number
): { x: number; y: number } {
  const s = size / 2;
  switch (zone) {
    case "left":
      return { x: s + 10, y: s + Math.random() * (CANVAS_H - size) };
    case "right":
      return { x: CANVAS_W - s - 10, y: s + Math.random() * (CANVAS_H - size) };
    case "top":
      return { x: s + Math.random() * (CANVAS_W - size), y: s + 10 };
    case "bottom":
      return { x: s + Math.random() * (CANVAS_W - size), y: CANVAS_H - s - 10 };
    case "center":
    default:
      return {
        x: CANVAS_W / 2 - 100 + Math.random() * 200,
        y: CANVAS_H / 2 - 75 + Math.random() * 150,
      };
  }
}

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------

class GameScene extends Phaser.Scene {
  private pg: ParsedGame;
  private onStatus: (status: "playing" | "won" | "lost", msg: string) => void;

  private player!: Phaser.GameObjects.Rectangle;
  private chaseGroups: Phaser.Physics.Arcade.Group[] = [];
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;
  private absorbGroups: Phaser.Physics.Arcade.Group[] = [];
  private otherGroups: Phaser.Physics.Arcade.Group[] = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private playerEntity!: ParsedEntity;
  private surviveTimer = 0;
  private health = 3;
  private score = 0;
  private totalEnemies = 0;
  private deadEnemies = 0;
  private gameOver = false;
  private invincible = false;

  private hudHealth!: Phaser.GameObjects.Text;
  private hudTimer!: Phaser.GameObjects.Text;
  private hudScore!: Phaser.GameObjects.Text;
  private hudWinTarget!: Phaser.GameObjects.Text;

  constructor(
    pg: ParsedGame,
    onStatus: (status: "playing" | "won" | "lost", msg: string) => void
  ) {
    super({ key: "GameScene" });
    this.pg = pg;
    this.onStatus = onStatus;
  }

  preload() {
    // Nothing to load — using colored rectangles only
  }

  create() {
    const { entities, winCondition, loseCondition, layout } = this.pg;

    // World bounds
    this.physics.world.setBounds(0, 0, CANVAS_W, CANVAS_H);

    // ---------- Player ----------
    const playerEnt = entities.find((e) => e.isPlayer) ?? entities[0];
    this.playerEntity = playerEnt;
    const playerSize = playerEnt.params.size ?? 32;

    // Find player spawn zone
    const playerSpawn = layout.spawns.find(
      (s) => s.entity === playerEnt.name
    );
    const playerZone = playerSpawn?.zone ?? "center";
    const { x: px, y: py } = zoneCoords(playerZone, playerSize);

    this.player = this.add.rectangle(px, py, playerSize, playerSize, COLORS.player);
    this.physics.add.existing(this.player);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);

    // ---------- Input ----------
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // ---------- Obstacle static group ----------
    this.obstacleGroup = this.physics.add.staticGroup();

    // ---------- Non-player entity groups ----------
    entities
      .filter((e) => !e.isPlayer)
      .forEach((ent) => {
        const isStatic = this.isObstacle(ent) && !this.isChaser(ent) && !this.isAbsorber(ent);

        if (isStatic) {
          // Static obstacles — spawn all at once from their spawn entries
          const spawnsForEnt = layout.spawns.filter((s) => s.entity === ent.name);
          if (spawnsForEnt.length === 0) {
            // Scatter a few in center
            for (let i = 0; i < 3; i++) {
              this.spawnObstacle(ent, "center");
            }
          } else {
            spawnsForEnt.forEach((sp) => {
              // Spawn initial batch immediately
              this.spawnObstacle(ent, sp.zone);
              // Recurring spawns
              if (sp.interval > 0) {
                this.time.addEvent({
                  delay: sp.interval * 1000,
                  callback: () => this.spawnObstacle(ent, sp.zone),
                  loop: true,
                });
              }
            });
          }
        } else {
          // Dynamic enemy group
          const color = this.entityColor(ent);
          const group = this.physics.add.group();

          const spawnsForEnt = layout.spawns.filter((s) => s.entity === ent.name);
          if (spawnsForEnt.length === 0) {
            // Spawn one immediately if no spawn entry
            this.spawnEnemy(group, ent, "right");
            this.totalEnemies++;
          } else {
            spawnsForEnt.forEach((sp) => {
              // Spawn one now
              this.spawnEnemy(group, ent, sp.zone);
              this.totalEnemies++;

              // Then repeat
              if (sp.interval > 0) {
                this.time.addEvent({
                  delay: sp.interval * 1000,
                  callback: () => {
                    this.spawnEnemy(group, ent, sp.zone);
                    this.totalEnemies++;
                  },
                  loop: true,
                });
              }
            });
          }

          if (this.isAbsorber(ent)) {
            this.absorbGroups.push(group);
          } else if (this.isChaser(ent)) {
            this.chaseGroups.push(group);
          } else {
            this.otherGroups.push(group);
          }

          // Suppress unused variable warning
          void color;
        }
      });

    // ---------- Colliders ----------

    // Player vs obstacles (block movement)
    this.physics.add.collider(this.player, this.obstacleGroup);

    // All enemy groups vs obstacles (they also collide)
    [...this.chaseGroups, ...this.absorbGroups, ...this.otherGroups].forEach((g) => {
      this.physics.add.collider(g, this.obstacleGroup);
    });

    // Player vs chasers (health loss)
    this.chaseGroups.forEach((g) => {
      this.physics.add.overlap(this.player, g, () => {
        this.onEnemyContact();
      });
    });

    // Player vs absorbers (grow + remove)
    this.absorbGroups.forEach((g) => {
      this.physics.add.overlap(
        this.player,
        g,
        (_player, enemy) => {
          this.onAbsorb(enemy as Phaser.GameObjects.Rectangle);
        }
      );
    });

    // ---------- Survive timer event ----------
    if (
      winCondition.recipe === "Survive Duration" ||
      winCondition.recipe === "Score Threshold"
    ) {
      this.time.addEvent({
        delay: 1000,
        callback: () => {
          if (!this.gameOver) this.surviveTimer++;
        },
        loop: true,
      });
    }

    // ---------- HUD ----------
    const hudStyle = { fontSize: "13px", color: "#ffffff", fontFamily: "monospace" };
    this.hudHealth = this.add
      .text(10, 10, `HP: ${this.health}`, hudStyle)
      .setDepth(10);
    this.hudTimer = this.add
      .text(10, 28, `Time: 0s`, hudStyle)
      .setDepth(10);
    this.hudScore = this.add
      .text(10, 46, `Score: 0`, hudStyle)
      .setDepth(10);

    const winTarget = this.winTargetLabel();
    this.hudWinTarget = this.add
      .text(CANVAS_W - 10, 10, winTarget, { ...hudStyle, align: "right" })
      .setOrigin(1, 0)
      .setDepth(10);
  }

  // ---------------------------------------------------------------------------
  // Helpers — entity role detection
  // ---------------------------------------------------------------------------

  private isChaser(ent: ParsedEntity): boolean {
    return ent.components.some(
      (c) => c === "ChaseTargetComponent" || c === "FleeTargetComponent"
    );
  }

  private isObstacle(ent: ParsedEntity): boolean {
    return ent.components.includes("StaticObstacleComponent");
  }

  private isAbsorber(ent: ParsedEntity): boolean {
    return ent.components.includes("RemoveTargetAndGrowComponent");
  }

  private entityColor(ent: ParsedEntity): number {
    if (this.isAbsorber(ent)) return COLORS.absorb;
    if (this.isChaser(ent)) return COLORS.chaser;
    if (this.isObstacle(ent)) return COLORS.obstacle;
    return COLORS.other;
  }

  // ---------------------------------------------------------------------------
  // Spawn helpers
  // ---------------------------------------------------------------------------

  private spawnObstacle(ent: ParsedEntity, zone: ParsedSpawn["zone"]) {
    const size = ent.params.size ?? 48;
    const { x, y } = zoneCoords(zone, size);
    const rect = this.add.rectangle(x, y, size, size, COLORS.obstacle);
    this.physics.add.existing(rect, true); // true = static body
    this.obstacleGroup.add(rect);
  }

  private spawnEnemy(
    group: Phaser.Physics.Arcade.Group,
    ent: ParsedEntity,
    zone: ParsedSpawn["zone"]
  ): Phaser.GameObjects.Rectangle {
    const size = ent.params.size ?? 32;
    const { x, y } = zoneCoords(zone, size);
    const color = this.entityColor(ent);
    const rect = this.add.rectangle(x, y, size, size, color);
    this.physics.add.existing(rect);
    const body = rect.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    group.add(rect);
    return rect;
  }

  // ---------------------------------------------------------------------------
  // Collision handlers
  // ---------------------------------------------------------------------------

  private onEnemyContact() {
    if (this.invincible || this.gameOver) return;
    this.health = Math.max(0, this.health - 1);
    this.hudHealth.setText(`HP: ${this.health}`);

    // Flash player red
    this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 3,
    });

    // Invincibility frames (1.5s)
    this.invincible = true;
    this.time.delayedCall(1500, () => {
      this.invincible = false;
    });

    if (this.health <= 0) {
      this.triggerLose("You were caught!");
    }
  }

  private onAbsorb(enemy: Phaser.GameObjects.Rectangle) {
    if (this.gameOver) return;
    enemy.destroy();
    this.score++;
    this.deadEnemies++;
    this.hudScore.setText(`Score: ${this.score}`);

    // Grow player slightly
    const newW = (this.player.width as number) + 4;
    const newH = (this.player.height as number) + 4;
    this.player.setSize(newW, newH);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(newW, newH);
  }

  // ---------------------------------------------------------------------------
  // Win / Lose
  // ---------------------------------------------------------------------------

  private winTargetLabel(): string {
    const { winCondition } = this.pg;
    switch (winCondition.recipe) {
      case "Survive Duration":
        return `Survive ${winCondition.thresholdScore ?? 30}s`;
      case "Score Threshold":
        return `Score ${winCondition.thresholdScore ?? 10}`;
      case "Eliminate All":
        return "Eliminate all enemies";
      case "Reach Goal":
        return "Reach the goal";
      default:
        return winCondition.recipe;
    }
  }

  private triggerWin(msg: string) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    this.showEndText("YOU WIN!", 0x2ecc71);
    this.onStatus("won", msg);
  }

  private triggerLose(msg: string) {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    this.showEndText("GAME OVER", 0xe74c3c);
    this.onStatus("lost", msg);
  }

  private showEndText(text: string, color: number) {
    // Dark overlay
    this.add
      .rectangle(CANVAS_W / 2, CANVAS_H / 2, CANVAS_W, CANVAS_H, 0x000000, 0.55)
      .setDepth(20);

    this.add
      .text(CANVAS_W / 2, CANVAS_H / 2, text, {
        fontSize: "48px",
        color: `#${color.toString(16).padStart(6, "0")}`,
        fontFamily: "system-ui, sans-serif",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(21);
  }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number) {
    if (this.gameOver) return;

    const playerEnt = this.playerEntity;
    const speed = playerEnt.params.speed ?? 150;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // --- Player movement ---
    const left =
      this.cursors.left.isDown || this.wasdKeys.left.isDown;
    const right =
      this.cursors.right.isDown || this.wasdKeys.right.isDown;
    const up = this.cursors.up.isDown || this.wasdKeys.up.isDown;
    const down = this.cursors.down.isDown || this.wasdKeys.down.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx -= speed;
    if (right) vx += speed;
    if (up) vy -= speed;
    if (down) vy += speed;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      const factor = 1 / Math.SQRT2;
      vx *= factor;
      vy *= factor;
    }

    body.setVelocity(vx, vy);

    // --- Chase AI ---
    this.chaseGroups.forEach((g) => {
      g.getChildren().forEach((child) => {
        const enemy = child as Phaser.GameObjects.Rectangle;
        const ent = this.entityForGameObject(enemy);
        const s = ent?.params.speed ?? 80;
        this.physics.moveToObject(enemy, this.player, s);
      });
    });

    // --- Also move other groups with a gentle wander ---
    // (simplified: they drift toward player slowly)
    this.otherGroups.forEach((g) => {
      g.getChildren().forEach((child) => {
        const enemy = child as Phaser.GameObjects.Rectangle;
        const ent = this.entityForGameObject(enemy);
        const s = (ent?.params.speed ?? 40) * 0.5;
        this.physics.moveToObject(enemy, this.player, s);
      });
    });

    // --- HUD update ---
    this.hudTimer.setText(`Time: ${this.surviveTimer}s`);

    // Invincibility flash
    if (this.invincible) {
      this.player.setAlpha(Math.sin(Date.now() / 80) > 0 ? 1 : 0.3);
    } else {
      this.player.setAlpha(1);
    }

    // --- Win / Lose condition checks ---
    void delta; // delta unused after removal of delta-based timer (using Phaser timer events instead)

    const { winCondition, loseCondition } = this.pg;

    // Win checks
    if (winCondition.recipe === "Survive Duration") {
      const target = winCondition.thresholdScore ?? 30;
      this.hudWinTarget.setText(`Survive ${target - this.surviveTimer}s more`);
      if (this.surviveTimer >= target) {
        this.triggerWin(`Survived ${target} seconds!`);
      }
    } else if (winCondition.recipe === "Score Threshold") {
      const target = winCondition.thresholdScore ?? 10;
      this.hudWinTarget.setText(`Score ${this.score}/${target}`);
      if (this.score >= target) {
        this.triggerWin(`Reached score ${target}!`);
      }
    } else if (winCondition.recipe === "Eliminate All") {
      const allGroups = [
        ...this.chaseGroups,
        ...this.absorbGroups,
        ...this.otherGroups,
      ];
      const remaining = allGroups.reduce(
        (acc, g) => acc + g.getChildren().length,
        0
      );
      this.hudWinTarget.setText(`Enemies left: ${remaining}`);
      if (remaining === 0 && this.totalEnemies > 0) {
        this.triggerWin("All enemies eliminated!");
      }
    }

    // Lose checks
    if (loseCondition.recipe === "Run Out Of Time" || loseCondition.recipe === "Health Depletion") {
      const timerSecs = loseCondition.timerSeconds;
      if (timerSecs !== undefined && this.surviveTimer >= timerSecs) {
        this.triggerLose("Time ran out!");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  // Best-effort: match a game object back to its ParsedEntity by size heuristic
  private entityForGameObject(
    _obj: Phaser.GameObjects.Rectangle
  ): ParsedEntity | undefined {
    // Since we can't tag game objects easily without extending the class,
    // we return the first non-player entity whose components suggest chasing.
    // This is used only for speed lookup in chase AI, so returning first chaser
    // entity's params is acceptable for this simple implementation.
    return this.pg.entities.find((e) => !e.isPlayer && this.isChaser(e));
  }
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function GameCanvas({ parsedGame, onStatusChange }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy previous Phaser instance (handles React StrictMode double-invoke)
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const scene = new GameScene(parsedGame, onStatusChange);

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: CANVAS_W,
      height: CANVAS_H,
      parent: containerRef.current,
      backgroundColor: "#1a1a2e",
      physics: {
        default: "arcade",
        arcade: { debug: false },
      },
      scene,
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [parsedGame, onStatusChange]);

  return (
    <div
      ref={containerRef}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        borderRadius: 4,
        overflow: "hidden",
        border: "2px solid #2563eb",
        maxWidth: "100%",
      }}
    />
  );
}
