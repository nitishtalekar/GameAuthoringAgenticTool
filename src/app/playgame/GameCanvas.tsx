"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { ParsedGame, ParsedEntity, ParsedSpawn } from "@/lib/game/xml-parser";
import { dominantBehavior, type ComponentBehavior } from "@/data/component-behaviors";

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
// Entity group entry — keeps entity metadata alongside its Phaser group
// ---------------------------------------------------------------------------

interface EntityGroup {
  entity: ParsedEntity;
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

  // All dynamic non-player groups with their metadata
  private entityGroups: EntityGroup[] = [];

  // Static obstacles
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

    // Player name label
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
        // Collect all component types from relations where this entity is "from"
        const relComponents = relations
          .filter((r) => r.from === ent.name)
          .map((r) => r.component);
        const behavior = dominantBehavior(relComponents);

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

        this.entityGroups.push({ entity: ent, behavior, group });
      });

    // ---------- Colliders ----------
    this.physics.add.collider(this.player, this.obstacleGroup);
    this.entityGroups.forEach(({ group }) => {
      this.physics.add.collider(group, this.obstacleGroup);
    });

    // Player vs each entity group — driven by behavior flags
    this.entityGroups.forEach(({ behavior, group }) => {
      if (behavior.removeOnContact || behavior.damagesPlayer || behavior.scoreOnContact) {
        this.physics.add.overlap(
          this.player,
          group,
          (_player, obj) => {
            const rect = obj as Phaser.GameObjects.Rectangle;
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
    // Name label on obstacle
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
  ): Phaser.GameObjects.Rectangle {
    const size = ent.params.size ?? 32;
    const { x, y } = zoneCoords(zone, size);
    const rect = this.add.rectangle(x, y, size, size, behavior.color);
    this.physics.add.existing(rect);
    (rect.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    group.add(rect);

    // Name label above the entity
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

    // Store label reference on the rect so we can track it in update
    (rect as Phaser.GameObjects.Rectangle & { _label?: Phaser.GameObjects.Text })._label = label;

    return rect;
  }

  // ---------------------------------------------------------------------------
  // Collision handler — driven entirely by ComponentBehavior flags
  // ---------------------------------------------------------------------------

  private onEntityContact(
    entity: Phaser.GameObjects.Rectangle,
    behavior: ComponentBehavior
  ) {
    if (this.gameOver) return;

    if (behavior.damagesPlayer) {
      if (this.invincible) return;
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

    if (behavior.scoreOnContact) {
      this.score++;
      this.hudScore.setText(`Score: ${this.score}`);
    }

    if (behavior.growsOnContact) {
      const newW = (this.player.width as number) + 4;
      const newH = (this.player.height as number) + 4;
      this.player.setSize(newW, newH);
      (this.player.body as Phaser.Physics.Arcade.Body).setSize(newW, newH);
    }

    if (behavior.removeOnContact) {
      // Clean up the floating label if present
      const labeled = entity as Phaser.GameObjects.Rectangle & { _label?: Phaser.GameObjects.Text };
      labeled._label?.destroy();
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

  update(_time: number, _delta: number) {
    if (this.gameOver) return;

    const speed = this.playerEntity.params.speed ?? 150;
    const body = this.player.body as Phaser.Physics.Arcade.Body;

    // --- Player movement ---
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

    // Sync player label
    this.playerLabel.setPosition(this.player.x, this.player.y - this.player.height / 2 - 10);

    // --- AI movement driven by behavior flags ---
    this.entityGroups.forEach(({ entity: ent, behavior, group }) => {
      group.getChildren().forEach((child) => {
        const enemy = child as Phaser.GameObjects.Rectangle & { _label?: Phaser.GameObjects.Text };
        const entSpeed = ent.params.speed ?? 80;

        if (behavior.movesTowardPlayer) {
          this.physics.moveToObject(enemy, this.player, entSpeed);
        } else if (behavior.movesAwayFromPlayer) {
          const dx = enemy.x - this.player.x;
          const dy = enemy.y - this.player.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          (enemy.body as Phaser.Physics.Arcade.Body).setVelocity(
            (dx / len) * entSpeed,
            (dy / len) * entSpeed
          );
        } else if (behavior.role === "wanderer") {
          // Re-randomize direction occasionally
          const eb = enemy.body as Phaser.Physics.Arcade.Body;
          if (Math.abs(eb.velocity.x) < 5 && Math.abs(eb.velocity.y) < 5) {
            const angle = Math.random() * Math.PI * 2;
            eb.setVelocity(Math.cos(angle) * entSpeed * 0.6, Math.sin(angle) * entSpeed * 0.6);
          }
        }
        // Sync label position
        if (enemy._label) {
          enemy._label.setPosition(enemy.x, enemy.y - enemy.height / 2 - 10);
        }
      });
    });

    // --- HUD update ---
    this.hudTimer.setText(`Time: ${this.surviveTimer}s`);

    if (this.invincible) {
      this.player.setAlpha(Math.sin(Date.now() / 80) > 0 ? 1 : 0.3);
    } else {
      this.player.setAlpha(1);
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
