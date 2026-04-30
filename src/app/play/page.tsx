"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { GAME_CONFIG_SAMPLES } from "@/lib/game-config-samples";
import { GameRenderer } from "@/utils/GameRenderer";
import { CONFIG } from "@/utils/game-types";

// ---------------------------------------------------------------------------
// Editor — JSON input with sample picker
// ---------------------------------------------------------------------------

function JsonEditor({ onPlay }: { onPlay: (config: CONFIG) => void }) {
  const [jsonInput, setJsonInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState("");

  const handleSampleSelect = (sampleId: string) => {
    setSelectedSample(sampleId);
    if (!sampleId) return;
    const sample = GAME_CONFIG_SAMPLES.find((s) => s.id === sampleId);
    if (sample) {
      setJsonInput(JSON.stringify(sample.config, null, 2));
      setParseError(null);
    }
  };

  const handlePlay = () => {
    if (!jsonInput.trim()) return;
    try {
      const parsed = JSON.parse(jsonInput);
      setParseError(null);
      onPlay(parsed);
    } catch (e) {
      setParseError(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  return (
    <Box sx={{ maxWidth: 860, mx: "auto", width: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h5" sx={{ color: "#fff", fontWeight: "bold" }}>
          Play Game
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ color: "#94a3b8", fontSize: 13, flexShrink: 0 }}>
            Load sample:
          </Typography>
          <Select
            value={selectedSample}
            onChange={(e) => handleSampleSelect(e.target.value)}
            displayEmpty
            size="small"
            sx={{
              color: "#fff",
              fontSize: 13,
              minWidth: 180,
              ".MuiOutlinedInput-notchedOutline": { borderColor: "#334155" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#64748b" },
              ".MuiSvgIcon-root": { color: "#94a3b8" },
              ".MuiSelect-select": { py: "6px" },
            }}
          >
            <MenuItem value="" sx={{ color: "#94a3b8", fontSize: 13 }}>
              — choose a sample —
            </MenuItem>
            {GAME_CONFIG_SAMPLES.map((s) => (
              <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <Typography sx={{ color: "#94a3b8", fontSize: 13, mb: 1 }}>
        Paste or edit a game-config JSON below, then click Play.
      </Typography>

      <textarea
        value={jsonInput}
        onChange={(e) => { setJsonInput(e.target.value); setParseError(null); }}
        placeholder='{ "meta": { "title": "My Game", ... }, "entities": [...], ... }'
        rows={20}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 12,
          fontFamily: "monospace",
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #334155",
          borderRadius: 8,
          resize: "vertical",
          boxSizing: "border-box",
          lineHeight: 1.6,
          outline: "none",
        }}
      />

      {parseError && (
        <Box sx={{ mt: 1, p: "10px 14px", bgcolor: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 1 }}>
          <Typography sx={{ color: "#fca5a5", fontSize: 13 }}>{parseError}</Typography>
        </Box>
      )}

      <Button
        variant="contained"
        onClick={handlePlay}
        disabled={!jsonInput.trim()}
        sx={{ mt: 2, fontWeight: "bold", bgcolor: "#2563eb", "&:hover": { bgcolor: "#1d4ed8" } }}
      >
        Play
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlayPage() {
  const [config, setConfig] = useState<CONFIG | null>(null);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: config ? "center" : "flex-start",
        p: 3,
        boxSizing: "border-box",
        gap: 2,
      }}
    >
      {config ? (
        <GameRenderer config={config} onExit={() => setConfig(null)} />
      ) : (
        <JsonEditor onPlay={(parsed) => setConfig(parsed)} />
      )}
    </Box>
  );
}
