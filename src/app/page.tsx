"use client";

import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setResponse(null);

    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    const lastMsg = data.messages?.at(-1);
    setResponse(
      typeof lastMsg?.content === "string"
        ? lastMsg.content
        : JSON.stringify(lastMsg?.content)
    );
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 600, margin: "80px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <h1>Pirate Agent</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the pirate..."
          style={{ flex: 1, padding: "8px 12px", fontSize: 16 }}
        />
        <button type="submit" disabled={loading} style={{ padding: "8px 16px", fontSize: 16 }}>
          {loading ? "..." : "Send"}
        </button>
      </form>
      {response && (
        <div style={{ marginTop: 24, padding: 16, background: "transparent", borderRadius: 8 }}>
          <strong>Pirate says:</strong>
          <p style={{ marginTop: 8 }}>{response}</p>
        </div>
      )}
    </main>
  );
}
