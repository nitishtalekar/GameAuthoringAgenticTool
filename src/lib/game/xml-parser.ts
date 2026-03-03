// xml-parser.ts — Browser-only XML parsing utility (uses DOMParser)
// Must only be called in client-side contexts (event handlers, useEffect, etc.)

export interface ParsedEntity {
  name: string;
  isPlayer: boolean;
  components: string[];
  params: Record<string, number>;
}

export interface ParsedSpawn {
  entity: string;
  zone: "left" | "right" | "center" | "top" | "bottom";
  interval: number;
}

export interface ParsedGame {
  title: string;
  description: string;
  entities: ParsedEntity[];
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

const VALID_ZONES = new Set(["left", "right", "center", "top", "bottom"]);

function toZone(raw: string | null): ParsedSpawn["zone"] {
  if (raw && VALID_ZONES.has(raw)) return raw as ParsedSpawn["zone"];
  return "center";
}

export function parseGameXml(xml: string): ParsedGame | null {
  if (typeof window === "undefined") return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml.trim(), "application/xml");

  if (doc.querySelector("parsererror")) return null;

  // --- metadata ---
  const meta = doc.querySelector("metadata");
  const title = meta?.getAttribute("title") ?? "Untitled Game";
  const description = meta?.getAttribute("description") ?? "";

  // --- entities ---
  const entityNodes = doc.querySelectorAll("entities > entity");
  if (entityNodes.length === 0) return null;

  const entities: ParsedEntity[] = Array.from(entityNodes).map((el) => {
    const name = el.getAttribute("name") ?? "Unknown";
    const isPlayer = el.getAttribute("isPlayer") === "true";

    const components: string[] = Array.from(
      el.querySelectorAll("components > component")
    ).map((c) => c.getAttribute("type") ?? "");

    const params: Record<string, number> = { speed: 100, size: 32, spawnRate: 1.5 };
    el.querySelectorAll("parameters > param").forEach((p) => {
      const paramName = p.getAttribute("name");
      const paramValue = parseFloat(p.getAttribute("value") ?? "");
      if (paramName && !isNaN(paramValue)) {
        params[paramName] = paramValue;
      }
    });

    return { name, isPlayer, components, params };
  });

  // --- win condition ---
  const winEl = doc.querySelector("winCondition");
  if (!winEl) return null;
  const winRecipe = winEl.getAttribute("recipe") ?? "";
  const winThreshold = winEl.querySelector("threshold");
  const winTimer = winEl.querySelector("timer");
  const winCondition: ParsedGame["winCondition"] = { recipe: winRecipe };
  if (winThreshold) {
    winCondition.thresholdScore = parseFloat(winThreshold.getAttribute("score") ?? "10");
  }
  if (winTimer) {
    winCondition.thresholdScore = parseFloat(winTimer.getAttribute("seconds") ?? "30");
  }

  // --- lose condition ---
  const loseEl = doc.querySelector("loseCondition");
  if (!loseEl) return null;
  const loseRecipe = loseEl.getAttribute("recipe") ?? "";
  const loseTimer = loseEl.querySelector("timer");
  const loseCondition: ParsedGame["loseCondition"] = { recipe: loseRecipe };
  if (loseTimer) {
    loseCondition.timerSeconds = parseFloat(loseTimer.getAttribute("seconds") ?? "60");
  }

  // --- layout ---
  const layoutEl = doc.querySelector("layout");
  const structure = layoutEl?.getAttribute("structure") ?? "Arena";

  const spawns: ParsedSpawn[] = Array.from(
    layoutEl?.querySelectorAll("spawn") ?? []
  ).map((s) => ({
    entity: s.getAttribute("entity") ?? "",
    zone: toZone(s.getAttribute("zone")),
    interval: parseFloat(s.getAttribute("interval") ?? "2.0"),
  }));

  return {
    title,
    description,
    entities,
    winCondition,
    loseCondition,
    layout: { structure, spawns },
  };
}
