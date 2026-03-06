/**
 * XML validation utilities for Game-O-Matic.
 *
 * The XML document is produced by buildXmlGenerationAgent.
 * This module only validates and sanitizes the agent output — it does NOT
 * reconstruct or re-serialize the XML from structured state.
 */

/**
 * Strips markdown code fences (```xml ... ```) if the agent wrapped its output.
 */
export function extractXml(raw: string): string {
  const fenced = raw.match(/```(?:xml)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * Basic well-formedness check against the Game-O-Matic schema produced by
 * buildXmlGenerationAgent.
 *
 * Returns true when the document contains the required top-level elements.
 */
export function validateXml(xml: string): boolean {
  const t = xml.trim();
  return (
    (t.startsWith("<?xml") || t.startsWith("<game")) &&
    t.includes("</game>") &&
    t.includes("<entities>") &&
    t.includes("<interactions>") &&
    t.includes("<win ") &&
    t.includes("<lose ")
  );
}
