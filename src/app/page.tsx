"use client";

import { useState, useCallback } from "react";
import type { GameState, StepResponse } from "@/lib/game/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

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
        <Box
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: "#2563eb",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {stepNumber}
        </Box>
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
    <Box
      component="main"
      sx={{
        maxWidth: 720,
        mx: "auto",
        px: 2,
        pt: 5,
        pb: 10,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#1a1a2e",
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: "white" }}>
          Game-Authoring-Tool
        </Typography>
        <Typography sx={{ mt: 1, color: "white", fontSize: 15 }}>
          Transform a news article into a playable arcade game configuration
        </Typography>
      </Box>

      {/* Input section (only shown before starting) */}
      {currentStep === 0 && (
        <Box component="section" sx={{ mb: 3 }}>
          <Typography
            component="label"
            htmlFor="concept-input"
            sx={{ display: "block", fontWeight: 600, mb: 1, fontSize: 14, color: "white" }}
          >
            Paste a news article or describe your concept in plain language
          </Typography>
          {/* <Typography sx={{ mb: 1.25, fontSize: 13, color: "#aaa" }}>
            Article example: &quot;On the six month anniversary of the Occupy Wall Street movement, protesters returned to New York&apos;s Zuccotti Park and several were arrested. The occupiers are obstructing Wall Street and are being arrested by police, but Wall Street is also growing the occupy movement.&quot;
          </Typography>
          <Typography sx={{ mb: 1.25, fontSize: 13, color: "#aaa" }}>
            Short concept map also works: &quot;Police arrests Occupier. Occupier obstructs WallStreet. WallStreet grows Occupier.&quot;
          </Typography> */}
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
          <Button
            variant="contained"
            onClick={handleStart}
            disabled={!inputText.trim() || isLoading}
            sx={{
              mt: 1.5,
              fontWeight: 600,
              bgcolor: "#2563eb",
              "&:hover": { bgcolor: "#1d4ed8" },
              "&:disabled": { bgcolor: "#a0aec0" },
            }}
          >
            {isLoading
              ? `Running Step 1 of ${TOTAL_STEPS}...`
              : `Start — Step 1 of ${TOTAL_STEPS}: ${STEP_LABELS[1]?.title ?? ""}`}
          </Button>
        </Box>
      )}

      {/* Progress bar (shown once started) */}
      {currentStep >= 1 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>
              {isLoading
                ? `Running Step ${currentStep + 1} of ${TOTAL_STEPS}...`
                : currentStep < TOTAL_STEPS
                ? `Step ${currentStep} of ${TOTAL_STEPS} complete`
                : "All steps complete"}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleReset}
              sx={{ fontSize: 12, color: "#666", borderColor: "#ccc", "&:hover": { borderColor: "#aaa" } }}
            >
              Start over
            </Button>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(currentStep / TOTAL_STEPS) * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: "#e0e0e0",
              "& .MuiLinearProgress-bar": { bgcolor: "#2563eb", borderRadius: 3, transition: "transform 0.4s ease" },
            }}
          />
          {!isLoading && currentStep < TOTAL_STEPS && (
            <Typography sx={{ mt: 1, fontSize: 13, color: "#666" }}>
              Next: Step {currentStep + 1} — {STEP_LABELS[currentStep + 1]?.description}
            </Typography>
          )}
        </Box>
      )}

      {/* Original article display */}
      {currentStep >= 1 && gameState.initialInput && (
        <Box
          sx={{
            mb: 2.5,
            p: "10px 14px",
            bgcolor: "#f9fafb",
            borderRadius: 1.5,
            border: "1px solid #e5e7eb",
            fontSize: 13,
            color: "#444",
          }}
        >
          <strong>Input:</strong> {gameState.initialInput}
        </Box>
      )}

      {/* Step cards */}
      <Box sx={{ mb: 3 }}>
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
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  bgcolor: "#16a34a",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                5
              </Box>
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
            <Box
              sx={{
                p: "10px 14px",
                bgcolor: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: 1,
              }}
            >
              <Button
                variant="contained"
                onClick={handleCopyJson}
                sx={{ fontSize: 13, fontWeight: 600, bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
              >
                Copy JSON
              </Button>
              <Button
                variant="contained"
                onClick={handleDownloadJson}
                sx={{ fontSize: 13, fontWeight: 600, bgcolor: "#16a34a", "&:hover": { bgcolor: "#15803d" } }}
              >
                Download JSON
              </Button>
            </Box>
          </details>
        )}
      </Box>

      {/* "Next Step" button */}
      {currentStep >= 1 && currentStep < TOTAL_STEPS && (
        <Box sx={{ mb: 2.5 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleNextStep}
            disabled={isLoading}
            sx={{
              py: 1.5,
              fontSize: 15,
              fontWeight: 700,
              bgcolor: "#2563eb",
              "&:hover": { bgcolor: "#1d4ed8" },
              "&:disabled": { bgcolor: "#a0aec0" },
            }}
          >
            {isLoading
              ? `Running Step ${currentStep + 1} of ${TOTAL_STEPS}: ${STEP_LABELS[currentStep + 1]?.title ?? ""}...`
              : `Next — Step ${currentStep + 1} of ${TOTAL_STEPS}: ${STEP_LABELS[currentStep + 1]?.title ?? ""}`}
          </Button>
        </Box>
      )}

      {/* Error display */}
      {errorMessage && (
        <Alert
          severity="error"
          onClose={() => setErrorMessage(null)}
          sx={{ mb: 2, fontSize: 13 }}
        >
          {errorMessage}
        </Alert>
      )}
    </Box>
  );
}
