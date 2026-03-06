// xml-parser.ts — Browser-only XML parsing utility (uses DOMParser)
// Must only be called in client-side contexts (event handlers, useEffect, etc.)
//
// Supports two XML schemas:
//   v1 (legacy): <entities>/<entity><components>/<parameters>, <relations>, <winCondition>, <loseCondition>
//   v2 (new):    <entities>/<entity behavior/>, <interactions>, <win>, <lose>

export interface ParsedRelation {
  from: string;
  to: string;
  microRhetoric: string;
  component: string;
  verb: string;
}

export interface ParsedEntity {
  name: string;
  displayName: string;
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
  howToPlay: string;
  rhetoricTheme: string;
  entities: ParsedEntity[];
  relations: ParsedRelation[];
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

/** Parse a duration string like "60s", "30", etc. into a number of seconds. */
function parseDuration(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const cleaned = raw.replace(/s$/i, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? fallback : n;
}

/**
 * Maps v2 <interaction attribute="..."> to a component name.
 *
 * Attributes are from the TARGET's perspective (e.g. deer.isRemovedBy = lion),
 * but the interaction element uses actor/target, so `from` = actor = the one
 * that does the action.  The component is placed on the actor (from) entity.
 *
 * Attribute key → what the ACTOR does to the target (or itself) on collision:
 *   isRemovedBy  → actor removes (damages) the target (player)      → DamageOnCollideComponent
 *   isDamagedBy  → actor damages the target (player)                 → DamageOnCollideComponent
 *   stopsBy      → actor stops itself on contact with player         → FreezeOnCollideComponent
 *   growsBy      → actor grows on contact with player                → GrowOnCollideComponent
 *   shrinksBy    → actor shrinks (player) on contact                 → ShrinkOnCollideComponent
 *   chasedBy     → handled separately: gives HomingMovementComponent to chaser entity
 */
function interactionAttributeToComponent(attribute: string): string {
  switch (attribute.toLowerCase()) {
    case "isremovedby":
    case "removedby":
    case "kills":
    case "eliminates":
    case "isdamagedby":
    case "damagedby":
    case "damages":
    case "hurts":
      return "DamageOnCollideComponent";
    case "stopsby":
    case "blocks":
    case "blocksby":
    case "stops":
    case "freezes":
      return "FreezeOnCollideComponent";
    case "scoresby":
    case "scores":
    case "collectscore":
      return "AddScoreOnCollideComponent";
    case "growsby":
    case "grows":
      return "GrowOnCollideComponent";
    case "shrinksby":
    case "shrinks":
      return "ShrinkOnCollideComponent";
    case "pushes":
    case "knocksback":
      return "ApplyForceOnCollideComponent";
    default:
      return "DamageOnCollideComponent";
  }
}

/**
 * Derives entity-level component names from a v2 <behavior> element.
 * Returns an array of component type strings.
 */
function behaviorElementToComponents(el: Element, isPlayerEnt: boolean): string[] {
  if (isPlayerEnt) return []; // player has no AI components

  const isStatic = el.getAttribute("isStatic") === "true";
  if (isStatic) return ["StaticObstacleComponent"];

  const components: string[] = [];

  const movesAnyWay = el.getAttribute("movesAnyWay") === "true";
  const isFleeing = el.getAttribute("isFleeing") === "true";
  const growsOverTime = el.getAttribute("growsOverTime") === "true";
  const shrinksOverTime = el.getAttribute("shrinksOverTime") === "true";

  if (isFleeing) {
    components.push("FleeTargetComponent");
  } else if (!movesAnyWay) {
    // Default non-player, non-static, non-fleeing → chases player
    components.push("HomingMovementComponent");
  } else {
    components.push("RandomMovementComponent");
  }

  if (growsOverTime) components.push("GrowOverTimeComponent");
  if (shrinksOverTime) components.push("ShrinkOverTimeComponent");

  return components;
}

export function parseGameXml(xml: string): ParsedGame | null {
  if (typeof window === "undefined") return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml.trim(), "application/xml");

  if (doc.querySelector("parsererror")) return null;

  // --- metadata ---
  const meta = doc.querySelector("metadata");
  const title = meta?.getAttribute("title") ?? "Untitled Game";
  const description = meta?.getAttribute("description") ?? meta?.getAttribute("concept") ?? "";
  const howToPlay = meta?.getAttribute("howToPlay") ?? "";
  const rhetoricTheme = meta?.getAttribute("rhetoricTheme") ?? "";

  // --- entities ---
  const entityNodes = doc.querySelectorAll("entities > entity");
  if (entityNodes.length === 0) return null;

  const entities: ParsedEntity[] = Array.from(entityNodes).map((el) => {
    const name = el.getAttribute("name") ?? "Unknown";
    const displayName = el.getAttribute("displayName") ?? name;
    const isPlayer = el.getAttribute("isPlayer") === "true";

    // v1: <components><component type="..."> inside entity
    // v2: <behavior> element inside entity
    const behaviorEl = el.querySelector("behavior");
    let components: string[];

    if (behaviorEl) {
      // v2 format
      components = behaviorElementToComponents(behaviorEl, isPlayer);
    } else {
      // v1 format
      components = Array.from(el.querySelectorAll("components > component"))
        .map((c) => c.getAttribute("type") ?? "")
        .filter(Boolean);
    }

    // params: v1 uses <parameters><param name="..." value="...">
    //         v2 uses attributes directly on <entity>
    const params: Record<string, number> = { speed: 100, size: 32, spawnRate: 1.5 };

    // v1 params
    el.querySelectorAll("parameters > param").forEach((p) => {
      const paramName = p.getAttribute("name");
      const paramValue = parseFloat(p.getAttribute("value") ?? "");
      if (paramName && !isNaN(paramValue)) params[paramName] = paramValue;
    });

    // v2 params (attributes directly on entity, override defaults if present)
    ["speed", "size", "spawnRate"].forEach((key) => {
      const val = parseFloat(el.getAttribute(key) ?? "");
      if (!isNaN(val)) params[key] = val;
    });

    return { name, displayName, isPlayer, components, params };
  });

  // --- relations ---
  // v1: <relations><relation from to microRhetoric component verb>
  // v2: <interactions><interaction actor target attribute>
  let relations: ParsedRelation[] = [];

  const relationNodes = doc.querySelectorAll("relations > relation");
  if (relationNodes.length > 0) {
    // v1
    relations = Array.from(relationNodes).map((el) => ({
      from: el.getAttribute("from") ?? "",
      to: el.getAttribute("to") ?? "",
      microRhetoric: el.getAttribute("microRhetoric") ?? "",
      component: el.getAttribute("component") ?? "",
      verb: el.getAttribute("verb") ?? "",
    })).filter((r) => r.from && r.to && r.component);
  } else {
    // v2 — process all interactions; chasedBy is handled separately below
    const interactionEls = Array.from(doc.querySelectorAll("interactions > interaction"));

    // chasedBy: <interaction actor="prey" target="chaser" attribute="chasedBy">
    // OR:       <interaction actor="chaser" target="prey" attribute="chasedBy">
    // Meaning: the chaser entity should get HomingMovementComponent.
    // Convention used by entity-attributes.ts: deer.chasedBy = lion
    // so actor = deer (the one with the attribute), target = lion (the chaser).
    // We inject HomingMovementComponent onto the TARGET entity.
    interactionEls
      .filter((el) => el.getAttribute("attribute")?.toLowerCase() === "chasedby")
      .forEach((el) => {
        const chaser = el.getAttribute("target") ?? "";
        if (!chaser) return;
        const entIdx = entities.findIndex((e) => e.name === chaser);
        if (entIdx === -1) return;
        if (!entities[entIdx].components.includes("HomingMovementComponent")) {
          entities[entIdx].components.push("HomingMovementComponent");
        }
      });

    relations = interactionEls
      .filter((el) => el.getAttribute("attribute")?.toLowerCase() !== "chasedby")
      .map((el) => {
        const actor = el.getAttribute("actor") ?? "";
        const target = el.getAttribute("target") ?? "";
        const attribute = el.getAttribute("attribute") ?? "";
        const component = interactionAttributeToComponent(attribute);
        return {
          from: actor,
          to: target,
          microRhetoric: attribute,
          component,
          verb: attribute,
        };
      }).filter((r) => r.from && r.to && r.component);
  }

  // --- win condition ---
  // v1: <winCondition recipe="..."><threshold score="..."><timer seconds="...">
  // v2: <win recipe="..." duration="60s" trigger="...">
  let winCondition: ParsedGame["winCondition"];

  const winElV1 = doc.querySelector("winCondition");
  const winElV2 = doc.querySelector("win");

  if (winElV1) {
    const recipe = winElV1.getAttribute("recipe") ?? "";
    winCondition = { recipe };
    const threshold = winElV1.querySelector("threshold");
    if (threshold) {
      winCondition.thresholdScore = parseFloat(threshold.getAttribute("score") ?? "10");
    }
    const timer = winElV1.querySelector("timer");
    if (timer) {
      winCondition.thresholdScore = parseFloat(timer.getAttribute("seconds") ?? "30");
    }
  } else if (winElV2) {
    const recipe = winElV2.getAttribute("recipe") ?? "";
    winCondition = { recipe };
    const duration = winElV2.getAttribute("duration");
    if (duration) {
      winCondition.thresholdScore = parseDuration(duration, 30);
    }
    const score = winElV2.getAttribute("score");
    if (score) {
      winCondition.thresholdScore = parseFloat(score);
    }
  } else {
    return null;
  }

  // --- lose condition ---
  // v1: <loseCondition recipe="..."><timer seconds="...">
  // v2: <lose recipe="..." duration="...">
  let loseCondition: ParsedGame["loseCondition"];

  const loseElV1 = doc.querySelector("loseCondition");
  const loseElV2 = doc.querySelector("lose");

  if (loseElV1) {
    const recipe = loseElV1.getAttribute("recipe") ?? "";
    loseCondition = { recipe };
    const timer = loseElV1.querySelector("timer");
    if (timer) {
      loseCondition.timerSeconds = parseFloat(timer.getAttribute("seconds") ?? "60");
    }
  } else if (loseElV2) {
    const recipe = loseElV2.getAttribute("recipe") ?? "";
    loseCondition = { recipe };
    const duration = loseElV2.getAttribute("duration");
    if (duration) {
      loseCondition.timerSeconds = parseDuration(duration, 60);
    }
  } else {
    return null;
  }

  // --- layout ---
  const layoutEl = doc.querySelector("layout");
  const structure = layoutEl?.getAttribute("structure") ?? "Arena";

  const spawns: ParsedSpawn[] = Array.from(
    layoutEl?.querySelectorAll("spawn") ?? []
  ).map((s) => {
    const intervalRaw = s.getAttribute("interval");
    return {
      entity: s.getAttribute("entity") ?? "",
      zone: toZone(s.getAttribute("zone")),
      interval: parseDuration(intervalRaw, 2.0),
    };
  });

  return {
    title,
    description,
    howToPlay,
    rhetoricTheme,
    entities,
    relations,
    winCondition,
    loseCondition,
    layout: { structure, spawns },
  };
}
