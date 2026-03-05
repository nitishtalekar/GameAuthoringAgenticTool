"use client";

import { useState, useCallback } from "react";
import type { GameState, StepResponse } from "@/lib/game/types";

// --- Step metadata ---

const STEP_LABELS: Record<number, { title: string; description: string }> = {
  1: {
    title: "Authoring",
    description: "Extracting entities and relations from your concept map",
  },
  2: {
    title: "Micro-Rhetoric Selection",
    description: "Mapping each verb relationship to a gameplay mechanic",
  },
  3: {
    title: "Recipe Selection",
    description: "Choosing win condition, lose condition, and layout structure",
  },
  4: {
    title: "Verification & Repair",
    description: "Checking playability and applying fixes if needed",
  },
  5: {
    title: "Rhetoric Critique",
    description: "Evaluating whether mechanics express your intended meaning",
  },
  6: {
    title: "XML Generation",
    description: "Generating the final game engine specification",
  },
};

const TOTAL_STEPS = 6;

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
  const [gameState, setGameState] = useState<GameState>({ step: 0, input: "" });
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
    const initialState: GameState = { step: 0, input: inputText.trim() };
    setGameState(initialState);
    await advanceStep(1, initialState);
  }, [inputText, advanceStep]);

  const handleNextStep = useCallback(async () => {
    await advanceStep(currentStep + 1, gameState);
  }, [currentStep, gameState, advanceStep]);

  const handleCopyXml = () => {
    if (gameState.xmlOutput) {
      navigator.clipboard.writeText(gameState.xmlOutput);
    }
  };

  const handleDownloadXml = () => {
    if (!gameState.xmlOutput) return;
    const blob = new Blob([gameState.xmlOutput], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "game-spec.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setGameState({ step: 0, input: "" });
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
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#1a1a2e" }}>
          Game-O-Matic
        </h1>
        <p style={{ margin: "6px 0 0", color: "#666", fontSize: 15 }}>
          Transform a concept map into a playable arcade game specification
        </p>
      </div>

      {/* Input section (only shown before starting) */}
      {currentStep === 0 && (
        <section style={{ marginBottom: 24 }}>
          <label
            htmlFor="concept-input"
            style={{ display: "block", fontWeight: 600, marginBottom: 8, fontSize: 14 }}
          >
            Describe your concept map in plain language
          </label>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666" }}>
            Example: "Police arrests Occupier. Occupier obstructs WallStreet. WallStreet grows Occupier."
          </p>
          <textarea
            id="concept-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter your concept map as sentences describing how entities relate to each other..."
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
            {isLoading ? "Running Step 1..." : "Start — Step 1 of 6: Authoring"}
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

      {/* Original concept display */}
      {currentStep >= 1 && (
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
          <strong>Concept:</strong> {gameState.input}
        </div>
      )}

      {/* Step cards — each completed step's output */}
      <div style={{ marginBottom: 24 }}>
        {gameState.conceptGraph && (
          <StepCard
            stepNumber={1}
            title="Authoring — Concept Graph"
            data={gameState.conceptGraph}
            isLatest={currentStep === 1 && !isLoading}
          />
        )}
        {gameState.microRhetoricsSelection && (
          <StepCard
            stepNumber={2}
            title="Micro-Rhetoric Selection"
            data={gameState.microRhetoricsSelection}
            isLatest={currentStep === 2 && !isLoading}
          />
        )}
        {gameState.recipeSelection && (
          <StepCard
            stepNumber={3}
            title="Recipe Selection"
            data={gameState.recipeSelection}
            isLatest={currentStep === 3 && !isLoading}
          />
        )}
        {gameState.verifierReport && (
          <StepCard
            stepNumber={4}
            title="Verification & Repair"
            data={gameState.verifierReport}
            isLatest={currentStep === 4 && !isLoading}
          />
        )}
        {gameState.rhetoricCritique && (
          <StepCard
            stepNumber={5}
            title="Rhetoric Critique"
            data={gameState.rhetoricCritique}
            isLatest={currentStep === 5 && !isLoading && !gameState.postSwapRhetoricCritique}
          />
        )}

        {/* Step 5.5 — swap button (shown when alignment < 1 and swap not yet applied) */}
        {gameState.rhetoricCritique &&
          gameState.rhetoricCritique.alignment_score < 1 &&
          !gameState.rhetoricSwapApplied && (
            <div
              style={{
                marginBottom: 12,
                padding: "12px 14px",
                background: "#fffbeb",
                border: "1px solid #f59e0b",
                borderRadius: 6,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#92400e" }}>
                Alignment score:{" "}
                <strong>{gameState.rhetoricCritique.alignment_score.toFixed(2)}</strong> —{" "}
                {gameState.rhetoricCritique.suggested_swaps?.length ?? 0} component swap(s)
                suggested to improve rhetorical alignment.
              </p>
              <button
                onClick={() => advanceStep(55, gameState)}
                disabled={isLoading}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  background: isLoading ? "#a0aec0" : "#d97706",
                  color: "#fff",
                  border: "none",
                  borderRadius: 5,
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? "Applying swaps..." : "Apply Rhetoric Swaps"}
              </button>
            </div>
          )}

        {/* Step 5.5 — post-swap critique result */}
        {gameState.postSwapRhetoricCritique && (
          <StepCard
            stepNumber={5.5}
            title="Rhetoric Swap & Re-Critique"
            data={gameState.postSwapRhetoricCritique}
            isLatest={!isLoading && !gameState.xmlOutput}
          />
        )}

        {/* XML output (step 6) */}
        {gameState.xmlOutput && (
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
                6
              </span>
              XML Game Specification — Final Output
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
              {gameState.xmlOutput}
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
                onClick={handleCopyXml}
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
                Copy XML
              </button>
              <button
                onClick={handleDownloadXml}
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
                Download XML
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
