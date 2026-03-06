"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { ParsedGame, ParsedEntity, ParsedSpawn } from "@/lib/game/xml-parser";
import { mergeBehaviors, type ComponentBehavior } from "@/data/component-behaviors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameCanvasProps {
  parsedGame: ParsedGame;
  onStatusChange: (status: "playing" | "won" | "lost", message: string) => void;
}

// Per-instance state stored directly on each spawned rectangle
type EnemyRect = Phaser.GameObjects.Rectangle & {
  _label?: Phaser.GameObjects.Text;
  /** Patrol direction: +1 = right, -1 = left */
  _patrolDir: number;
  _patrolMinX: number;
  _patrolMaxX: number;
  /** Current speed (grows for accelerator entities) */
  _currentSpeed: number;
  /** Wanderer: seconds until next direction change */
  _wanderTimer: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_W = 800;
const CANVAS_H = 500;
const PLAYER_COLOR = 0x3498db;

// Zone → spawn coordinates
function zoneCoords(zone: ParsedSpawn["zone"], size: number): { x: number; y: number } {
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
// Entity group entry
// ---------------------------------------------------------------------------

interface EntityGroup {
  entity: ParsedEntity;
  /** Merged behavior from ALL components (intrinsic + relational) */
  behavior: ComponentBehavior;
  group: Phaser.Physics.Arcade.Group;
}

// ---------------------------------------------------------------------------
// GameScene
// ---------------------------------------------------------------------------

class GameScene extends Phaser.Scene {
  private pg: ParsedGame;
  private onStatus: (status: "playing" | "won" | "lost", msg: string) => void;

  private player!: Phaser.GameObjects.Rectangle;
  private playerLabel!: Phaser.GameObjects.Text;

  private entityGroups: EntityGroup[] = [];
  private obstacleGroup!: Phaser.Physics.Arcade.StaticGroup;

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
  private playerFrozen = false;

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

  preload() {}

  create() {
    const { entities, relations, winCondition, loseCondition, layout } = this.pg;

    this.physics.world.setBounds(0, 0, CANVAS_W, CANVAS_H);

    // ---------- Player ----------
    const playerEnt = entities.find((e) => e.isPlayer) ?? entities[0];
    this.playerEntity = playerEnt;
    const playerSize = playerEnt.params.size ?? 32;

    const playerSpawn = layout.spawns.find((s) => s.entity === playerEnt.name);
    const { x: px, y: py } = zoneCoords(playerSpawn?.zone ?? "center", playerSize);

    this.player = this.add.rectangle(px, py, playerSize, playerSize, PLAYER_COLOR);
    this.physics.add.existing(this.player);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    this.playerLabel = this.add
      .text(px, py - playerSize / 2 - 10, playerEnt.displayName, {
        fontSize: "10px",
        color: "#ffffff",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(5);

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

    // ---------- Non-player entities ----------
    entities
      .filter((e) => !e.isPlayer)
      .forEach((ent) => {
        // Merge ALL components: intrinsic (entity.components) + relational (relations)
        const intrinsicComponents = ent.components;
        const relComponents = relations
          .filter((r) => r.from === ent.name)
          .map((r) => r.component);
        const behavior = mergeBehaviors([...intrinsicComponents, ...relComponents]);

        if (behavior.isStatic) {
          const spawnsForEnt = layout.spawns.filter((s) => s.entity === ent.name);
          if (spawnsForEnt.length === 0) {
            for (let i = 0; i < 3; i++) this.spawnObstacle(ent, "center");
          } else {
            spawnsForEnt.forEach((sp) => {
              this.spawnObstacle(ent, sp.zone);
              if (sp.interval > 0) {
                this.time.addEvent({
                  delay: sp.interval * 1000,
                  callback: () => this.spawnObstacle(ent, sp.zone),
                  loop: true,
                });
              }
            });
          }
          return;
        }

        const group = this.physics.add.group();

        const spawnsForEnt = layout.spawns.filter((s) => s.entity === ent.name);
        const spawnZone: ParsedSpawn["zone"] =
          spawnsForEnt.length > 0 ? spawnsForEnt[0].zone : "right";

        if (spawnsForEnt.length === 0) {
          this.spawnEnemy(group, ent, behavior, "right");
          this.totalEnemies++;
        } else {
          spawnsForEnt.forEach((sp) => {
            this.spawnEnemy(group, ent, behavior, sp.zone);
            this.totalEnemies++;
            if (sp.interval > 0) {
              this.time.addEvent({
                delay: sp.interval * 1000,
                callback: () => {
                  this.spawnEnemy(group, ent, behavior, sp.zone);
                  this.totalEnemies++;
                },
                loop: true,
              });
            }
          });
        }

        // Spawner: create clones on interval (driven by spawnRate param)
        if (behavior.spawnsOnInterval) {
          const spawnRateMs = (ent.params.spawnRate ?? 3.0) * 1000;
          this.time.addEvent({
            delay: spawnRateMs,
            callback: () => {
              if (this.gameOver) return;
              this.spawnEnemy(group, ent, behavior, spawnZone);
              this.totalEnemies++;
            },
            loop: true,
          });
        }

        this.entityGroups.push({ entity: ent, behavior, group });
      });

    // ---------- Colliders ----------
    this.physics.add.collider(this.player, this.obstacleGroup);
    this.entityGroups.forEach(({ group }) => {
      this.physics.add.collider(group, this.obstacleGroup);
    });

    // Player vs each entity group — driven by behavior flags
    this.entityGroups.forEach(({ behavior, group }) => {
      if (
        behavior.removeOnContact ||
        behavior.damagesPlayer ||
        behavior.scoreOnContact ||
        behavior.growsOnContact ||
        behavior.shrinksPlayerOnContact ||
        behavior.pushesPlayerOnContact ||
        behavior.freezesPlayerOnContact
      ) {
        this.physics.add.overlap(
          this.player,
          group,
          (_player, obj) => {
            const rect = obj as EnemyRect;
            this.onEntityContact(rect, behavior);
          }
        );
      }
    });

    // ---------- Survive timer ----------
    if (
      winCondition.recipe === "Survive Duration" ||
      loseCondition.recipe === "Run Out Of Time"
    ) {
      this.time.addEvent({
        delay: 1000,
        callback: () => { if (!this.gameOver) this.surviveTimer++; },
        loop: true,
      });
    }

    // ---------- HUD ----------
    const hudStyle = { fontSize: "13px", color: "#ffffff", fontFamily: "monospace" };
    this.hudHealth = this.add.text(10, 10, `HP: ${this.health}`, hudStyle).setDepth(10);
    this.hudTimer = this.add.text(10, 28, `Time: 0s`, hudStyle).setDepth(10);
    this.hudScore = this.add.text(10, 46, `Score: 0`, hudStyle).setDepth(10);

    this.hudWinTarget = this.add
      .text(CANVAS_W - 10, 10, this.winTargetLabel(), {
        ...hudStyle,
        align: "right",
      })
      .setOrigin(1, 0)
      .setDepth(10);
  }

  // ---------------------------------------------------------------------------
  // Spawn helpers
  // ---------------------------------------------------------------------------

  private spawnObstacle(ent: ParsedEntity, zone: ParsedSpawn["zone"]) {
    const size = ent.params.size ?? 48;
    const { x, y } = zoneCoords(zone, size);
    const rect = this.add.rectangle(x, y, size, size, 0x7f8c8d);
    this.physics.add.existing(rect, true);
    this.obstacleGroup.add(rect);
    this.add
      .text(x, y, ent.displayName, {
        fontSize: "9px",
        color: "#ffffff",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(5);
  }

  private spawnEnemy(
    group: Phaser.Physics.Arcade.Group,
    ent: ParsedEntity,
    behavior: ComponentBehavior,
    zone: ParsedSpawn["zone"]
  ): EnemyRect {
    const size = ent.params.size ?? 32;
    const { x, y } = zoneCoords(zone, size);
    const rect = this.add.rectangle(x, y, size, size, behavior.color) as EnemyRect;
    this.physics.add.existing(rect);
    (rect.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    group.add(rect);

    // Per-instance state
    rect._patrolDir = Math.random() > 0.5 ? 1 : -1;
    rect._patrolMinX = Math.max(size / 2, x - 120);
    rect._patrolMaxX = Math.min(CANVAS_W - size / 2, x + 120);
    rect._currentSpeed = ent.params.speed ?? 80;
    rect._wanderTimer = 1.5 + Math.random(); // seconds until first direction change

    const label = this.add
      .text(x, y - size / 2 - 10, ent.displayName, {
        fontSize: "10px",
        color: "#ffffff",
        fontFamily: "monospace",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(5);

    rect._label = label;
    return rect;
  }

  // ---------------------------------------------------------------------------
  // Collision handler
  // ---------------------------------------------------------------------------

  private onEntityContact(entity: EnemyRect, behavior: ComponentBehavior) {
    if (this.gameOver) return;

    // Damage player — gated by invincibility window
    if (behavior.damagesPlayer && !this.invincible) {
      this.health = Math.max(0, this.health - 1);
      this.hudHealth.setText(`HP: ${this.health}`);
      this.tweens.add({
        targets: this.player,
        alpha: 0.2,
        duration: 100,
        yoyo: true,
        repeat: 3,
      });
      this.invincible = true;
      this.time.delayedCall(1500, () => { this.invincible = false; });
      if (this.health <= 0) this.triggerLose("You were defeated!");
    }

    // Score
    if (behavior.scoreOnContact) {
      this.score++;
      this.hudScore.setText(`Score: ${this.score}`);
    }

    // Entity grows (NOT the player)
    if (behavior.growsOnContact) {
      const newW = (entity.width as number) + 6;
      const newH = (entity.height as number) + 6;
      entity.setSize(newW, newH);
      (entity.body as Phaser.Physics.Arcade.Body).setSize(newW, newH);
    }

    // Player shrinks
    if (behavior.shrinksPlayerOnContact) {
      const minSize = 10;
      const newW = Math.max(minSize, (this.player.width as number) - 6);
      const newH = Math.max(minSize, (this.player.height as number) - 6);
      this.player.setSize(newW, newH);
      (this.player.body as Phaser.Physics.Arcade.Body).setSize(newW, newH);
    }

    // Knockback
    if (behavior.pushesPlayerOnContact) {
      const dx = this.player.x - entity.x;
      const dy = this.player.y - entity.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const knockback = 350;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(
        (dx / len) * knockback,
        (dy / len) * knockback
      );
    }

    // Freeze player
    if (behavior.freezesPlayerOnContact && !this.playerFrozen) {
      this.playerFrozen = true;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      this.time.delayedCall(1200, () => { this.playerFrozen = false; });
    }

    // Remove entity
    if (behavior.removeOnContact) {
      entity._label?.destroy();
      entity.destroy();
      this.deadEnemies++;
    }
  }

  // ---------------------------------------------------------------------------
  // Win / Lose helpers
  // ---------------------------------------------------------------------------

  private winTargetLabel(): string {
    const { winCondition } = this.pg;
    switch (winCondition.recipe) {
      case "Survive Duration":
        return `Survive ${winCondition.thresholdScore ?? 30}s`;
      case "Score Threshold Win":
        return `Score ${winCondition.thresholdScore ?? 10}`;
      case "Eliminate All Of Type":
        return "Eliminate all enemies";
      case "Reach Goal Zone":
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

    const speed = this.playerEntity.params.speed ?? 150;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // --- Player movement (blocked while frozen) ---
    if (this.playerFrozen) {
      body.setVelocity(0, 0);
    } else {
      const left = this.cursors.left.isDown || this.wasdKeys.left.isDown;
      const right = this.cursors.right.isDown || this.wasdKeys.right.isDown;
      const up = this.cursors.up.isDown || this.wasdKeys.up.isDown;
      const down = this.cursors.down.isDown || this.wasdKeys.down.isDown;

      let vx = 0;
      let vy = 0;
      if (left) vx -= speed;
      if (right) vx += speed;
      if (up) vy -= speed;
      if (down) vy += speed;

      if (vx !== 0 && vy !== 0) {
        const f = 1 / Math.SQRT2;
        vx *= f;
        vy *= f;
      }
      body.setVelocity(vx, vy);
    }

    // Sync player label
    this.playerLabel.setPosition(this.player.x, this.player.y - this.player.height / 2 - 10);

    // --- AI movement and time-based effects ---
    this.entityGroups.forEach(({ behavior, group }) => {
      group.getChildren().forEach((child) => {
        const enemy = child as EnemyRect;
        if (!enemy.active) return;
        const eb = enemy.body as Phaser.Physics.Arcade.Body;

        // Accelerate over time — increase stored speed each second
        if (behavior.acceleratesOverTime) {
          enemy._currentSpeed = Math.min(enemy._currentSpeed + (5 * delta / 1000), 400);
        }
        const entSpeed = enemy._currentSpeed;

        // Movement (priority order: chase > flee > patrol > wander)
        if (behavior.movesTowardPlayer) {
          this.physics.moveToObject(enemy, this.player, entSpeed);

        } else if (behavior.movesAwayFromPlayer) {
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          eb.setVelocity((dx / len) * entSpeed, (dy / len) * entSpeed);

        } else if (behavior.patrolsBackAndForth) {
          // Reverse direction at patrol bounds
          if (
            (enemy._patrolDir > 0 && enemy.x >= enemy._patrolMaxX) ||
            (enemy._patrolDir < 0 && enemy.x <= enemy._patrolMinX)
          ) {
            enemy._patrolDir *= -1;
          }
          eb.setVelocity(enemy._patrolDir * entSpeed, 0);

        } else if (behavior.wandersRandomly) {
          // Timer-based direction change (every 1.5–2.5 seconds)
          enemy._wanderTimer -= delta / 1000;
          if (enemy._wanderTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            eb.setVelocity(Math.cos(angle) * entSpeed * 0.6, Math.sin(angle) * entSpeed * 0.6);
            enemy._wanderTimer = 1.5 + Math.random();
          }
        }

        // Grow over time
        if (behavior.growsOverTime) {
          const newW = enemy.width + 0.02;
          const newH = enemy.height + 0.02;
          enemy.setSize(newW, newH);
          eb.setSize(newW, newH);
        }

        // Shrink over time — destroy at min size
        if (behavior.shrinksOverTime) {
          const newW = enemy.width - 0.03;
          const newH = enemy.height - 0.03;
          if (newW < 4) {
            this.time.delayedCall(0, () => {
              if (enemy.active) {
                enemy._label?.destroy();
                enemy.destroy();
                this.deadEnemies++;
              }
            });
          } else {
            enemy.setSize(newW, newH);
            eb.setSize(newW, newH);
          }
        }

        // Sync label position
        if (enemy._label && enemy.active) {
          enemy._label.setPosition(enemy.x, enemy.y - enemy.height / 2 - 10);
        }
      });
    });

    // --- HUD update ---
    this.hudTimer.setText(`Time: ${this.surviveTimer}s`);

    if (this.invincible) {
      this.player.setAlpha(Math.sin(Date.now() / 80) > 0 ? 1 : 0.3);
    } else if (!this.playerFrozen) {
      this.player.setAlpha(1);
    } else {
      // Frozen: pulse blue tint effect via alpha
      this.player.setAlpha(0.6);
    }

    // --- Win / Lose condition checks ---
    const { winCondition, loseCondition } = this.pg;

    if (winCondition.recipe === "Survive Duration") {
      const target = winCondition.thresholdScore ?? 30;
      this.hudWinTarget.setText(`Survive ${target - this.surviveTimer}s more`);
      if (this.surviveTimer >= target) this.triggerWin(`Survived ${target} seconds!`);
    } else if (winCondition.recipe === "Score Threshold Win") {
      const target = winCondition.thresholdScore ?? 10;
      this.hudWinTarget.setText(`Score ${this.score}/${target}`);
      if (this.score >= target) this.triggerWin(`Reached score ${target}!`);
    } else if (winCondition.recipe === "Eliminate All Of Type") {
      const remaining = this.entityGroups.reduce(
        (acc, { group }) => acc + group.getChildren().length,
        0
      );
      this.hudWinTarget.setText(`Enemies left: ${remaining}`);
      if (remaining === 0 && this.totalEnemies > 0) this.triggerWin("All enemies eliminated!");
    }

    if (loseCondition.recipe === "Run Out Of Time" || loseCondition.recipe === "Health Depletion") {
      const timerSecs = loseCondition.timerSeconds;
      if (timerSecs !== undefined && this.surviveTimer >= timerSecs) {
        this.triggerLose("Time ran out!");
      }
    }
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
