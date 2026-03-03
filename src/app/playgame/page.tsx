"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { ParsedGame } from "@/lib/game/xml-parser";
import { parseGameXml } from "@/lib/game/xml-parser";

// GameCanvas imports Phaser at module level — must never be server-rendered
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

type GameStatus = "idle" | "playing" | "won" | "lost";

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
          style={{ fontSize: 13, color: "#2563eb", textDecoration: "none", marginTop: 4, display: "inline-block" }}
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

      {/* Game canvas */}
      {parsedGame && (
        <section style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
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
              }}
            >
              Change XML
            </button>
          </div>

          <div
            style={{
              marginBottom: 12,
              padding: "8px 12px",
              background: "#f9fafb",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              fontSize: 12,
              color: "#555",
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <span>
              <strong style={{ color: "#3498db" }}>&#9632;</strong> You (player)
            </span>
            <span>
              <strong style={{ color: "#e74c3c" }}>&#9632;</strong> Chaser
            </span>
            <span>
              <strong style={{ color: "#95a5a6" }}>&#9632;</strong> Obstacle
            </span>
            <span>
              <strong style={{ color: "#2ecc71" }}>&#9632;</strong> Absorb/Grow
            </span>
            <span>
              <strong style={{ color: "#9b59b6" }}>&#9632;</strong> Other
            </span>
            <span style={{ marginLeft: "auto" }}>Move: Arrow keys or WASD</span>
          </div>

          <GameCanvas parsedGame={parsedGame} onStatusChange={handleStatusChange} />
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
