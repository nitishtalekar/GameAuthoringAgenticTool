"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ParsedGame } from "@/lib/game/xml-parser";
import { parseGameXml } from "@/lib/game/xml-parser";
import { mergeBehaviors, getBehavior } from "@/data/component-behaviors";

// GameCanvas imports Phaser at module level — must never be server-rendered
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type GameStatus = "idle" | "playing" | "won" | "lost";

/** Convert a hex number like 0xe74c3c to a CSS color string */
function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

function GameInfoPanel({ game }: { game: ParsedGame }) {
  const playerEnt = game.entities.find((e) => e.isPlayer) ?? game.entities[0];
  const enemies = game.entities.filter((e) => !e.isPlayer);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        marginBottom: 12,
        fontSize: 13,
      }}
    >
      {/* How to Play */}
      {game.howToPlay && (
        <div
          style={{
            gridColumn: "1 / -1",
            padding: "10px 14px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 6,
            color: "#1e40af",
          }}
        >
          <strong style={{ display: "block", marginBottom: 4 }}>How to Play</strong>
          {game.howToPlay}
        </div>
      )}

      {/* Win condition */}
      <div
        style={{
          padding: "10px 14px",
          background: "#f0fdf4",
          border: "1px solid #86efac",
          borderRadius: 6,
        }}
      >
        <strong style={{ display: "block", marginBottom: 4, color: "#15803d" }}>
          Win Condition
        </strong>
        <span style={{ color: "#166534" }}>{game.winCondition.recipe}</span>
        {game.winCondition.thresholdScore !== undefined && (
          <span style={{ color: "#4ade80", marginLeft: 6 }}>
            (target: {game.winCondition.thresholdScore})
          </span>
        )}
      </div>

      {/* Lose condition */}
      <div
        style={{
          padding: "10px 14px",
          background: "#fef2f2",
          border: "1px solid #fca5a5",
          borderRadius: 6,
        }}
      >
        <strong style={{ display: "block", marginBottom: 4, color: "#991b1b" }}>
          Lose Condition
        </strong>
        <span style={{ color: "#7f1d1d" }}>{game.loseCondition.recipe}</span>
        {game.loseCondition.timerSeconds !== undefined && (
          <span style={{ color: "#f87171", marginLeft: 6 }}>
            ({game.loseCondition.timerSeconds}s timer)
          </span>
        )}
      </div>

      {/* Entity legend */}
      <div
        style={{
          gridColumn: "1 / -1",
          padding: "10px 14px",
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
        }}
      >
        <strong style={{ display: "block", marginBottom: 8, color: "#111827" }}>
          Entities
        </strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
          {/* Player */}
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "#3498db",
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            <span>
              <strong>{playerEnt.displayName}</strong>
              <span style={{ color: "#6b7280", marginLeft: 4 }}>(you)</span>
            </span>
          </span>

          {/* Enemies */}
          {enemies.map((ent) => {
            const relComponents = game.relations
              .filter((r) => r.from === ent.name)
              .map((r) => r.component);
            const behavior = mergeBehaviors([...ent.components, ...relComponents]);
            return (
              <span
                key={ent.name}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    background: hexToCss(behavior.color),
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong>{ent.displayName}</strong>
                  <span style={{ color: "#6b7280", marginLeft: 4 }}>
                    — {behavior.description}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
        <p style={{ margin: "8px 0 0", color: "#9ca3af", fontSize: 12 }}>
          Move: Arrow keys or WASD
        </p>
      </div>
    </div>
  );
}

function GameStructurePanel({ game }: { game: ParsedGame }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        marginTop: 12,
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        overflow: "hidden",
        fontSize: 13,
      }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "#f9fafb",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          textAlign: "left",
        }}
      >
        <span>Game Structure</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{open ? "▲ hide" : "▼ show"}</span>
      </button>

      {open && (
        <div style={{ padding: "14px 16px", background: "#fff" }}>
          {/* Entities */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Entities
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {game.entities.map((ent) => {
                const relComponents = game.relations
                  .filter((r) => r.from === ent.name)
                  .map((r) => r.component);
                const dominant = mergeBehaviors([...ent.components, ...relComponents]);
                return (
                  <div
                    key={ent.name}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: 6,
                      background: "#fafafa",
                    }}
                  >
                    {/* Entity header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          background: ent.isPlayer ? "#3498db" : hexToCss(dominant.color),
                          borderRadius: 2,
                          flexShrink: 0,
                        }}
                      />
                      <strong style={{ fontSize: 14 }}>{ent.displayName}</strong>
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>({ent.name})</span>
                      {ent.isPlayer && (
                        <span
                          style={{
                            marginLeft: 4,
                            padding: "1px 6px",
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          player
                        </span>
                      )}
                    </div>

                    {/* Component chips */}
                    {ent.components.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {ent.components.map((comp) => {
                          const beh = getBehavior(comp);
                          return (
                            <span
                              key={comp}
                              title={beh.description}
                              style={{
                                padding: "2px 8px",
                                background: hexToCss(beh.color) + "22",
                                border: `1px solid ${hexToCss(beh.color)}66`,
                                color: "#1a1a2e",
                                borderRadius: 10,
                                fontSize: 11,
                                fontFamily: "monospace",
                              }}
                            >
                              {comp}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Params */}
                    <div style={{ display: "flex", gap: 12, color: "#6b7280", fontSize: 12 }}>
                      {Object.entries(ent.params).map(([k, v]) => (
                        <span key={k}>
                          <span style={{ fontWeight: 500 }}>{k}:</span> {v}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Relations */}
          {game.relations.length > 0 && (
            <div>
              <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Relations
              </h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    {["From", "Verb", "To", "Micro-Rhetoric", "Component"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "6px 10px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#374151",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {game.relations.map((rel, i) => {
                    const beh = getBehavior(rel.component);
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}
                      >
                        <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                          {game.entities.find((e) => e.name === rel.from)?.displayName ?? rel.from}
                        </td>
                        <td style={{ padding: "6px 10px", color: "#6b7280", fontStyle: "italic" }}>{rel.verb}</td>
                        <td style={{ padding: "6px 10px", fontWeight: 500 }}>
                          {game.entities.find((e) => e.name === rel.to)?.displayName ?? rel.to}
                        </td>
                        <td style={{ padding: "6px 10px", color: "#6b7280" }}>{rel.microRhetoric}</td>
                        <td style={{ padding: "6px 10px" }}>
                          <span
                            title={beh.description}
                            style={{
                              padding: "2px 7px",
                              background: hexToCss(beh.color) + "22",
                              border: `1px solid ${hexToCss(beh.color)}66`,
                              borderRadius: 10,
                              fontSize: 11,
                              fontFamily: "monospace",
                            }}
                          >
                            {rel.component}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayGamePage() {
  const [xmlInput, setXmlInput] = useState("");
  const [parsedGame, setParsedGame] = useState<ParsedGame | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleLoadGame = () => {
    if (!xmlInput.trim()) return;
    const result = parseGameXml(xmlInput);
    if (!result) {
      setParseError(
        "Could not parse the XML. Make sure it contains <entities>, <winCondition>, <loseCondition>, and <layout> elements."
      );
      setParsedGame(null);
      return;
    }
    setParseError(null);
    setParsedGame(result);
    setGameStatus("playing");
    setStatusMessage("");
  };

  const handleStatusChange = useCallback(
    (status: "playing" | "won" | "lost", message: string) => {
      setGameStatus(status);
      setStatusMessage(message);
    },
    []
  );

  const handleReset = () => {
    setParsedGame(null);
    setGameStatus("idle");
    setStatusMessage("");
    setParseError(null);
  };

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "40px 16px 80px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a2e",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}>
          Play Game
        </h1>
        <p style={{ margin: "6px 0 0", color: "#666", fontSize: 15 }}>
          Paste your Game-O-Matic XML below and click &ldquo;Load Game&rdquo; to play.
        </p>
        <a
          href="/"
          style={{
            fontSize: 13,
            color: "#2563eb",
            textDecoration: "none",
            marginTop: 4,
            display: "inline-block",
          }}
        >
          &larr; Back to Game-O-Matic
        </a>
      </div>

      {/* XML Input — shown only when idle */}
      {gameStatus === "idle" && (
        <section style={{ marginBottom: 24 }}>
          <label
            htmlFor="xml-input"
            style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}
          >
            Game XML Specification
          </label>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666" }}>
            Copy the XML output from the authoring tool and paste it here.
          </p>
          <textarea
            id="xml-input"
            value={xmlInput}
            onChange={(e) => setXmlInput(e.target.value)}
            placeholder='<game version="1.0">&#10;  ...&#10;</game>'
            rows={14}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 12,
              fontFamily: "monospace",
              border: "1px solid #ccc",
              borderRadius: 6,
              resize: "vertical",
              boxSizing: "border-box",
              lineHeight: 1.5,
              color: "#1a1a2e",
            }}
          />
          {parseError && (
            <p
              style={{
                margin: "8px 0 0",
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: 6,
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {parseError}
            </p>
          )}
          <button
            onClick={handleLoadGame}
            disabled={!xmlInput.trim()}
            style={{
              marginTop: 12,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 600,
              background: xmlInput.trim() ? "#2563eb" : "#a0aec0",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: xmlInput.trim() ? "pointer" : "not-allowed",
            }}
          >
            Load Game
          </button>
        </section>
      )}

      {/* Game area */}
      {parsedGame && (
        <section style={{ marginBottom: 24 }}>
          {/* Title + reset button */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                {parsedGame.title}
              </h2>
              {parsedGame.description && (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
                  {parsedGame.description}
                </p>
              )}
              {parsedGame.rhetoricTheme && (
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>
                  Theme: {parsedGame.rhetoricTheme}
                </p>
              )}
            </div>
            <button
              onClick={handleReset}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                background: "transparent",
                border: "1px solid #ccc",
                borderRadius: 5,
                cursor: "pointer",
                color: "#666",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Change XML
            </button>
          </div>

          {/* Info panel: how to play, win/lose, entity legend */}
          <GameInfoPanel game={parsedGame} />

          {/* Canvas */}
          <GameCanvas parsedGame={parsedGame} onStatusChange={handleStatusChange} />

          {/* Parsed game structure — entities, components, relations */}
          <GameStructurePanel game={parsedGame} />
        </section>
      )}

      {/* Win / Lose banner */}
      {(gameStatus === "won" || gameStatus === "lost") && (
        <div
          style={{
            marginTop: 16,
            padding: "20px 24px",
            background: gameStatus === "won" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${gameStatus === "won" ? "#86efac" : "#fca5a5"}`,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <strong
              style={{
                fontSize: 18,
                color: gameStatus === "won" ? "#15803d" : "#991b1b",
              }}
            >
              {gameStatus === "won" ? "You Win!" : "Game Over"}
            </strong>
            {statusMessage && (
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "#444" }}>
                {statusMessage}
              </p>
            )}
          </div>
          <button
            onClick={handleReset}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              background: gameStatus === "won" ? "#16a34a" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Play Again
          </button>
        </div>
      )}

      {/* Controls reminder */}
      {gameStatus === "playing" && (
        <p style={{ marginTop: 8, fontSize: 12, color: "#888", textAlign: "center" }}>
          Use Arrow Keys or WASD to move your character
        </p>
      )}
    </main>
  );
}
