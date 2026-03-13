// xml-parser.ts — Browser-only XML parsing utility (uses DOMParser)
// Must only be called in client-side contexts (event handlers, useEffect, etc.)
//
// Schema (v2 — canonical):
//   <entities>/<entity behavior/>, <interactions>, <win>, <lose>, <layout>
//
// <behavior> attributes map directly to entity-attributes.ts keys:
//   isPlayer, isStatic, movesAnyWay, growsOverTime, shrinksOverTime, isFleeing
//
// <interaction attribute="..."> values map directly to entity-attributes.ts
//   entity-ref keys: isRemovedBy, growsBy, shrinksBy, stopsBy, isDamagedBy, chasedBy

export interface ParsedInteraction {
  /** Entity that performs the action (actor). */
  actor: string;
  /** Entity that receives the action (target). */
  target: string;
  /**
   * The entity-attribute key this interaction represents.
   * Matches keys in entity-attributes.ts: isRemovedBy | growsBy | shrinksBy |
   * stopsBy | isDamagedBy | chasedBy
   */
  attribute: string;
}

/** Behavior attributes parsed directly from the <behavior> element. */
export interface ParsedBehavior {
  isPlayer: boolean;
  isStatic: boolean;
  movesAnyWay: boolean;
  growsOverTime: boolean;
  shrinksOverTime: boolean;
  isFleeing: boolean;
}

export interface ParsedEntity {
  name: string;
  displayName: string;
  isPlayer: boolean;
  behavior: ParsedBehavior;
  params: Record<string, number>;
}

export interface ParsedSpawn {
  entity: string;
  zone: "left" | "right" | "center" | "top" | "bottom" | "edges" | "random";
}

export interface ParsedGame {
  title: string;
  description: string;
  howToPlay: string;
  rhetoricTheme: string;
  entities: ParsedEntity[];
  interactions: ParsedInteraction[];
  winCondition: {
    recipe: string;
    thresholdScore?: number;
  };
  loseCondition: {
    recipe: string;
    timerSeconds?: number;
  };
  layout: {
    structure: string;
    spawns: ParsedSpawn[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_ZONES = new Set(["left", "right", "center", "top", "bottom", "edges", "random"]);

function toZone(raw: string | null): ParsedSpawn["zone"] {
  if (raw && VALID_ZONES.has(raw)) return raw as ParsedSpawn["zone"];
  return "center";
}

function parseDuration(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(raw.replace(/s$/i, ""));
  return isNaN(n) ? fallback : n;
}

function boolAttr(el: Element, name: string): boolean {
  return el.getAttribute(name) === "true";
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseGameXml(xml: string): ParsedGame | null {
  if (typeof window === "undefined") return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml.trim(), "application/xml");
  if (doc.querySelector("parsererror")) return null;

  // --- metadata ---
  const meta = doc.querySelector("metadata");
  const title = meta?.getAttribute("title") ?? "Untitled Game";
  const description =
    meta?.getAttribute("description") ?? meta?.getAttribute("concept") ?? "";
  const howToPlay = meta?.getAttribute("howToPlay") ?? "";
  const rhetoricTheme = meta?.getAttribute("rhetoricTheme") ?? "";

  // --- entities ---
  const entityNodes = doc.querySelectorAll("entities > entity");
  if (entityNodes.length === 0) return null;

  const entities: ParsedEntity[] = Array.from(entityNodes).map((el) => {
    const name = el.getAttribute("name") ?? "Unknown";
    const displayName = el.getAttribute("displayName") ?? name;
    const isPlayer = el.getAttribute("isPlayer") === "true";

    // Parse <behavior> element — all attributes are taken as-is
    const behaviorEl = el.querySelector("behavior");
    const behavior: ParsedBehavior = {
      isPlayer:        behaviorEl ? boolAttr(behaviorEl, "isPlayer")        : isPlayer,
      isStatic:        behaviorEl ? boolAttr(behaviorEl, "isStatic")        : false,
      movesAnyWay:     behaviorEl ? boolAttr(behaviorEl, "movesAnyWay")     : !isPlayer,
      growsOverTime:   behaviorEl ? boolAttr(behaviorEl, "growsOverTime")   : false,
      shrinksOverTime: behaviorEl ? boolAttr(behaviorEl, "shrinksOverTime") : false,
      isFleeing:       behaviorEl ? boolAttr(behaviorEl, "isFleeing")       : false,
    };

    // Numeric params — defaults, then v1 <parameters><param>, then entity attributes
    const params: Record<string, number> = { speed: 100, size: 32, spawnRate: 1.5 };

    el.querySelectorAll("parameters > param").forEach((p) => {
      const k = p.getAttribute("name");
      const v = parseFloat(p.getAttribute("value") ?? "");
      if (k && !isNaN(v)) params[k] = v;
    });

    ["speed", "size", "spawnRate"].forEach((key) => {
      const val = parseFloat(el.getAttribute(key) ?? "");
      if (!isNaN(val)) params[key] = val;
    });

    return { name, displayName, isPlayer, behavior, params };
  });

  // --- interactions ---
  // <interactions><interaction actor="..." target="..." attribute="..." />
  const interactions: ParsedInteraction[] = Array.from(
    doc.querySelectorAll("interactions > interaction")
  )
    .map((el) => ({
      actor:     el.getAttribute("actor")     ?? "",
      target:    el.getAttribute("target")    ?? "",
      attribute: el.getAttribute("attribute") ?? "",
    }))
    .filter((i) => i.actor && i.target && i.attribute);

  // --- win condition ---
  const winElV1 = doc.querySelector("winCondition");
  const winElV2 = doc.querySelector("win");
  let winCondition: ParsedGame["winCondition"];

  if (winElV1) {
    winCondition = { recipe: winElV1.getAttribute("recipe") ?? "" };
    const threshold = winElV1.querySelector("threshold");
    if (threshold) winCondition.thresholdScore = parseFloat(threshold.getAttribute("score") ?? "10");
    const timer = winElV1.querySelector("timer");
    if (timer) winCondition.thresholdScore = parseFloat(timer.getAttribute("seconds") ?? "30");
  } else if (winElV2) {
    winCondition = { recipe: winElV2.getAttribute("recipe") ?? "" };
    const duration = winElV2.getAttribute("duration");
    if (duration) winCondition.thresholdScore = parseDuration(duration, 30);
    const score = winElV2.getAttribute("score") ?? winElV2.getAttribute("threshold");
    if (score) winCondition.thresholdScore = parseFloat(score);
  } else {
    return null;
  }

  // --- lose condition ---
  const loseElV1 = doc.querySelector("loseCondition");
  const loseElV2 = doc.querySelector("lose");
  let loseCondition: ParsedGame["loseCondition"];

  if (loseElV1) {
    loseCondition = { recipe: loseElV1.getAttribute("recipe") ?? "" };
    const timer = loseElV1.querySelector("timer");
    if (timer) loseCondition.timerSeconds = parseFloat(timer.getAttribute("seconds") ?? "60");
  } else if (loseElV2) {
    loseCondition = { recipe: loseElV2.getAttribute("recipe") ?? "" };
    const duration = loseElV2.getAttribute("duration");
    if (duration) loseCondition.timerSeconds = parseDuration(duration, 60);
  } else {
    return null;
  }

  // --- layout ---
  const layoutEl = doc.querySelector("layout");
  const structure = layoutEl?.getAttribute("structure") ?? "Arena";

  const spawns: ParsedSpawn[] = Array.from(
    layoutEl?.querySelectorAll("spawn") ?? []
  ).map((s) => ({
    entity: s.getAttribute("entity") ?? "",
    zone:   toZone(s.getAttribute("zone")),
  }));

  return {
    title,
    description,
    howToPlay,
    rhetoricTheme,
    entities,
    interactions,
    winCondition,
    loseCondition,
    layout: { structure, spawns },
  };
}
