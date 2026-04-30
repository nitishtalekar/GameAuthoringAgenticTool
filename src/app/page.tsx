"use client";

import { useState, useCallback } from "react";
import type { GameState, StepResponse } from "@/lib/game/types";

// --- Step metadata ---

const STEP_LABELS: Record<number, { title: string; description: string }> = {
  1: {
    title: "Concept Extraction",
    description: "Breaking the article into concept sentences and SVO relations",
  },
  2: {
    title: "Rhetoric Assignment",
    description: "Assigning behavior and interaction rhetorics to entities",
  },
  3: {
    title: "Recipe Selection",
    description: "Choosing win and lose end conditions",
  },
  4: {
    title: "Alignment Rating",
    description: "Rating how well the mechanics express the original concept",
  },
  5: {
    title: "Game JSON Generation",
    description: "Generating the final game engine configuration",
  },
};

const TOTAL_STEPS = 5;

// --- StepCard: collapsible result display ---

function StepCard({
  stepNumber,
  title,
  data,
  isLatest,
}: {
  stepNumber: number;
  title: string;
  data: unknown;
  isLatest: boolean;
}) {
  return (
    <details
      open={isLatest}
      style={{
        marginBottom: 12,
        border: "1px solid #e0e0e0",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          padding: "10px 14px",
          cursor: "pointer",
          background: isLatest ? "#f0f7ff" : "#fafafa",
          fontWeight: 600,
          fontSize: 14,
          userSelect: "none",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#2563eb",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {stepNumber}
        </span>
        {title}
      </summary>
      <pre
        style={{
          margin: 0,
          padding: "12px 14px",
          fontSize: 12,
          lineHeight: 1.6,
          overflowX: "auto",
          background: "#fff",
          color: "#1a1a2e",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

// --- Main page component ---

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [gameState, setGameState] = useState<GameState>({ step: 0 });
  const [uiStatus, setUiStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLoading = uiStatus === "loading";
  const currentStep = gameState.step;

  const advanceStep = useCallback(async (nextStep: number, state: GameState) => {
    setUiStatus("loading");
    setErrorMessage(null);

    try {
      const res = await fetch("/api/game/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep, state }),
      });

      const data: StepResponse = await res.json();

      if (data.error) {
        setErrorMessage(data.error);
        setUiStatus("error");
        return;
      }

      setGameState(data.state);
      setUiStatus("idle");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setErrorMessage(msg);
      setUiStatus("error");
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!inputText.trim()) return;
    const initialState: GameState = { step: 0, initialInput: inputText.trim() };
    setGameState(initialState);
    await advanceStep(1, initialState);
  }, [inputText, advanceStep]);

  const handleNextStep = useCallback(async () => {
    await advanceStep(currentStep + 1, gameState);
  }, [currentStep, gameState, advanceStep]);

  const handleCopyJson = () => {
    if (gameState.gameJsonOutput) {
      navigator.clipboard.writeText(gameState.gameJsonOutput);
    }
  };

  const handleDownloadJson = () => {
    if (!gameState.gameJsonOutput) return;
    const blob = new Blob([gameState.gameJsonOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "game-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setGameState({ step: 0 });
    setInputText("");
    setUiStatus("idle");
    setErrorMessage(null);
  };

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "40px 16px 80px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a2e",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "white" }}>
          Game-Authoring-Tool
        </h1>
        <p style={{ margin: "6px 0 0", color: "white", fontSize: 15 }}>
          Transform a news article into a playable arcade game configuration
        </p>
      </div>

      {/* Input section (only shown before starting) */}
      {currentStep === 0 && (
        <section style={{ marginBottom: 24 }}>
          <label
            htmlFor="concept-input"
            style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14, color: "white" }}
          >
            Paste a news article or describe your concept in plain language
          </label>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#aaa" }}>
            Article example: &quot;On the six month anniversary of the Occupy Wall Street movement, protesters returned to New York&apos;s Zuccotti Park and several were arrested. The occupiers are obstructing Wall Street and are being arrested by police, but Wall Street is also growing the occupy movement.&quot;
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#aaa" }}>
            Short concept map also works: &quot;Police arrests Occupier. Occupier obstructs WallStreet. WallStreet grows Occupier.&quot;
          </p>
          <textarea
            id="concept-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter your concept as sentences describing how entities relate to each other..."
            rows={5}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              border: "1px solid #ccc",
              borderRadius: 6,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
              lineHeight: 1.5,
            }}
          />
          <button
            onClick={handleStart}
            disabled={!inputText.trim() || isLoading}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              background: inputText.trim() && !isLoading ? "#2563eb" : "#a0aec0",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: inputText.trim() && !isLoading ? "pointer" : "not-allowed",
            }}
          >
            {isLoading
              ? `Running Step 1 of ${TOTAL_STEPS}...`
              : `Start — Step 1 of ${TOTAL_STEPS}: ${STEP_LABELS[1]?.title ?? ""}`}
          </button>
        </section>
      )}

      {/* Progress bar (shown once started) */}
      {currentStep >= 1 && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>
              {isLoading
                ? `Running Step ${currentStep + 1} of ${TOTAL_STEPS}...`
                : currentStep < TOTAL_STEPS
                ? `Step ${currentStep} of ${TOTAL_STEPS} complete`
                : "All steps complete"}
            </span>
            <button
              onClick={handleReset}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: "transparent",
                border: "1px solid #ccc",
                borderRadius: 4,
                cursor: "pointer",
                color: "#666",
              }}
            >
              Start over
            </button>
          </div>
          <div
            style={{
              height: 6,
              background: "#e0e0e0",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "#2563eb",
                borderRadius: 3,
                width: `${(currentStep / TOTAL_STEPS) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          {!isLoading && currentStep < TOTAL_STEPS && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>
              Next: Step {currentStep + 1} — {STEP_LABELS[currentStep + 1]?.description}
            </p>
          )}
        </div>
      )}

      {/* Original article display */}
      {currentStep >= 1 && gameState.initialInput && (
        <div
          style={{
            marginBottom: 20,
            padding: "10px 14px",
            background: "#f9fafb",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            color: "#444",
          }}
        >
          <strong>Input:</strong> {gameState.initialInput}
        </div>
      )}

      {/* Step cards */}
      <div style={{ marginBottom: 24 }}>
        {gameState.conceptData && (
          <StepCard
            stepNumber={1}
            title="Concept Extraction"
            data={gameState.conceptData}
            isLatest={currentStep === 1 && !isLoading}
          />
        )}
        {gameState.rhetoricAssignment && (
          <StepCard
            stepNumber={2}
            title="Rhetoric Assignment"
            data={gameState.rhetoricAssignment}
            isLatest={currentStep === 2 && !isLoading}
          />
        )}
        {gameState.recipeOutput && (
          <StepCard
            stepNumber={3}
            title="Recipe Selection"
            data={gameState.recipeOutput}
            isLatest={currentStep === 3 && !isLoading}
          />
        )}
        {gameState.alignmentRating && (
          <StepCard
            stepNumber={4}
            title="Alignment Rating"
            data={gameState.alignmentRating}
            isLatest={currentStep === 4 && !isLoading}
          />
        )}

        {/* Game JSON output (step 5) */}
        {gameState.gameJsonOutput && (
          <details
            open
            style={{
              marginBottom: 12,
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                background: "#f0fdf4",
                fontWeight: 600,
                fontSize: 14,
                userSelect: "none",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#16a34a",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                5
              </span>
              Game Configuration JSON — Final Output
            </summary>
            <pre
              style={{
                margin: 0,
                padding: "12px 14px",
                fontSize: 12,
                lineHeight: 1.6,
                overflowX: "auto",
                background: "#fff",
                color: "#1a1a2e",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {gameState.gameJsonOutput}
            </pre>
            <div
              style={{
                padding: "10px 14px",
                background: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: 8,
              }}
            >
              <button
                onClick={handleCopyJson}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                Copy JSON
              </button>
              <button
                onClick={handleDownloadJson}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#16a34a",
                  color: "#fff",
                  border: "none",
                  borderRadius: 5,
                  cursor: "pointer",
                }}
              >
                Download JSON
              </button>
            </div>
          </details>
        )}
      </div>

      {/* "Next Step" button */}
      {currentStep >= 1 && currentStep < TOTAL_STEPS && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={handleNextStep}
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              fontSize: 15,
              fontWeight: 700,
              background: isLoading ? "#a0aec0" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              cursor: isLoading ? "not-allowed" : "pointer",
              width: "100%",
            }}
          >
            {isLoading
              ? `Running Step ${currentStep + 1} of ${TOTAL_STEPS}: ${STEP_LABELS[currentStep + 1]?.title ?? ""}...`
              : `Next — Step ${currentStep + 1} of ${TOTAL_STEPS}: ${STEP_LABELS[currentStep + 1]?.title ?? ""}`}
          </button>
        </div>
      )}

      {/* Error display */}
      {errorMessage && (
        <div
          style={{
            padding: "12px 16px",
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            color: "#991b1b",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          <strong>Error:</strong> {errorMessage}
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              marginLeft: 12,
              fontSize: 12,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#991b1b",
              textDecoration: "underline",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </main>
  );
}
