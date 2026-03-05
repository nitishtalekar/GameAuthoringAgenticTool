import type { GameState, EntitySpec, MicroRhetoricSelectionItem } from "./types";

/**
 * Basic well-formedness check.
 * Returns true if the XML string looks like a valid game spec document.
 */
export function validateXml(xml: string): boolean {
  const trimmed = xml.trim();
  return (
    (trimmed.startsWith("<?xml") || trimmed.startsWith("<game")) &&
    trimmed.includes("</game>") &&
    trimmed.includes("<relations>")
  );
}

/**
 * Deterministic fallback XML serializer.
 * Used when the LLM XML generation agent produces malformed output.
 * Builds the full XML spec purely from structured GameState fields.
 */
export function serializeToXml(state: GameState): string {
  const entities = state.entities ?? buildFallbackEntities(state);
  const win = state.recipeSelection?.win_recipe ?? "Score Threshold Win";
  const lose = state.recipeSelection?.lose_recipe ?? "Run Out Of Time";
  const structure = state.recipeSelection?.structure_recipe ?? "Arena Layout";
  const rhetoricTheme = state.rhetoricCritique?.interpretation?.slice(0, 40) ?? "";
  const selections = state.microRhetoricsSelection?.selections ?? [];

  // Collect component types that appear in relations — these are relational, not intrinsic
  const relationalComponents = new Set(selections.map((s) => s.component));

  const entitiesXml = entities
    .map((e) => serializeEntity(e, relationalComponents))
    .join("\n  ");

  const relationsXml = buildRelationsXml(selections);
  const winXml = buildWinConditionXml(win);
  const loseXml = buildLoseConditionXml(lose);
  const layoutXml = buildLayoutXml(structure, entities);
  const howToPlay = deriveHowToPlay(entities, win, lose);

  return `<?xml version="1.0" encoding="UTF-8"?>
<game version="1.0">

  <metadata
    title="${escapeXml(deriveTitle(entities))}"
    description="${escapeXml(deriveDescription(state))}"
    generatedFrom="${escapeXml(state.input)}"
    howToPlay="${escapeXml(howToPlay)}"
    rhetoricTheme="${escapeXml(rhetoricTheme)}"
  />

  <entities>
  ${entitiesXml}
  </entities>

  ${relationsXml}

  ${winXml}

  ${loseXml}

  ${layoutXml}

</game>`;
}

// --- Private helpers ---

function buildFallbackEntities(state: GameState): EntitySpec[] {
  const entities = state.conceptGraph?.entities ?? [];
  return entities.map((name, idx) => ({
    name,
    isPlayer: idx === 0,
    components: [],
    parameters: { speed: 100, size: 32, spawnRate: 1.5 },
  }));
}

function serializeEntity(e: EntitySpec, relationalComponents: Set<string>): string {
  // Filter out relational components — they belong in <relations>
  const intrinsic = e.components.filter((c) => !relationalComponents.has(c));

  const componentsXml = intrinsic.length > 0
    ? intrinsic.map((c) => `      <component type="${escapeXml(c)}" />`).join("\n")
    : `      <!-- no intrinsic components -->`;

  const params = Object.entries(e.parameters);
  const parametersXml = params.length > 0
    ? params.map(([k, v]) => `      <param name="${escapeXml(k)}" value="${escapeXml(String(v))}" />`).join("\n")
    : `      <param name="speed" value="100" unit="px/s" />
      <param name="size" value="32" unit="px" />`;

  return `<entity name="${escapeXml(e.name)}" isPlayer="${e.isPlayer}" displayName="${escapeXml(e.name)}">
      <components>
${componentsXml}
      </components>
      <parameters>
${parametersXml}
      </parameters>
    </entity>`;
}

function buildRelationsXml(selections: MicroRhetoricSelectionItem[]): string {
  if (selections.length === 0) {
    return `<relations>
    <!-- no relations derived -->
  </relations>`;
  }

  const lines = selections.map((s) => {
    // s.relation format: "Subject verb Object" e.g. "Player chases Enemy"
    const parts = s.relation.trim().split(/\s+/);
    const from = parts[0] ?? "Unknown";
    const to = parts[parts.length - 1] ?? "Unknown";
    const verb = parts.length > 2 ? parts.slice(1, -1).join(" ") : "interacts with";
    return `    <relation from="${escapeXml(from)}" to="${escapeXml(to)}" microRhetoric="${escapeXml(s.micro_rhetoric)}" component="${escapeXml(s.component)}" verb="${escapeXml(verb)}" />`;
  });

  return `<relations>
${lines.join("\n")}
  </relations>`;
}

function buildWinConditionXml(recipe: string): string {
  switch (recipe) {
    case "Score Threshold Win":
      return `<winCondition recipe="${escapeXml(recipe)}">
    <threshold score="10" />
  </winCondition>`;
    case "Eliminate All Of Type":
      return `<winCondition recipe="${escapeXml(recipe)}">
    <eliminateAll type="enemy" />
  </winCondition>`;
    case "Survive Duration":
      return `<winCondition recipe="${escapeXml(recipe)}">
    <timer seconds="30" />
  </winCondition>`;
    case "Reach Goal Zone":
      return `<winCondition recipe="${escapeXml(recipe)}">
    <goalZone zone="right" />
  </winCondition>`;
    case "Grow Beyond Size":
      return `<winCondition recipe="${escapeXml(recipe)}">
    <threshold size="200" />
  </winCondition>`;
    case "Collect All Items":
      return `<winCondition recipe="${escapeXml(recipe)}">
    <collectAll type="collectible" />
  </winCondition>`;
    default:
      return `<winCondition recipe="${escapeXml(recipe)}" />`;
  }
}

function buildLoseConditionXml(recipe: string): string {
  switch (recipe) {
    case "Run Out Of Time":
      return `<loseCondition recipe="${escapeXml(recipe)}">
    <timer seconds="60" />
  </loseCondition>`;
    case "Health Depletion":
      return `<loseCondition recipe="${escapeXml(recipe)}">
    <health minimum="0" />
  </loseCondition>`;
    case "Protected Entity Removed":
      return `<loseCondition recipe="${escapeXml(recipe)}">
    <protect entity="critical" />
  </loseCondition>`;
    case "Enemy Reaches Goal":
      return `<loseCondition recipe="${escapeXml(recipe)}">
    <boundary zone="left" />
  </loseCondition>`;
    default:
      return `<loseCondition recipe="${escapeXml(recipe)}" />`;
  }
}

function buildLayoutXml(structure: string, entities: EntitySpec[]): string {
  const player = entities.find((e) => e.isPlayer);
  const others = entities.filter((e) => !e.isPlayer);

  const spawnLines = [
    player ? `    <spawn entity="${escapeXml(player.name)}" zone="left" />` : "",
    ...others.map(
      (e) => `    <spawn entity="${escapeXml(e.name)}" zone="center" interval="2.0" />`
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return `<layout structure="${escapeXml(structure)}">
${spawnLines}
  </layout>`;
}

function deriveTitle(entities: EntitySpec[]): string {
  if (entities.length === 0) return "Game-O-Matic Game";
  const names = entities.map((e) => e.name);
  return names.slice(0, 2).join(" vs ") + " Game";
}

function deriveDescription(state: GameState): string {
  const win = state.recipeSelection?.win_recipe ?? "Score Threshold Win";
  const interpretation = state.rhetoricCritique?.interpretation;
  if (interpretation) return interpretation.slice(0, 120);
  return `An arcade game about ${state.input.slice(0, 80)}. Goal: ${win}.`;
}

function deriveHowToPlay(entities: EntitySpec[], win: string, lose: string): string {
  const player = entities.find((e) => e.isPlayer);
  const others = entities.filter((e) => !e.isPlayer);
  const playerName = player?.name ?? "the player";
  const otherNames = others.map((e) => e.name).join(", ") || "other entities";

  const winClause: Record<string, string> = {
    "Score Threshold Win": `Score points by interacting with ${otherNames}.`,
    "Eliminate All Of Type": `Eliminate all ${otherNames}.`,
    "Survive Duration": "Survive as long as possible.",
    "Reach Goal Zone": "Reach the goal zone on the right.",
    "Grow Beyond Size": "Grow large enough to win.",
    "Collect All Items": `Collect all ${otherNames}.`,
    "Escort Entity Safely": `Escort ${otherNames} to safety.`,
  };

  const loseClause: Record<string, string> = {
    "Run Out Of Time": "Don't run out of time.",
    "Health Depletion": "Don't lose all your health.",
    "Protected Entity Removed": "Protect your critical entity.",
    "Enemy Reaches Goal": `Don't let ${otherNames} reach the goal.`,
    "Meter Overflow": "Keep the meter under control.",
  };

  const winStr = winClause[win] ?? `Achieve the win condition: ${win}.`;
  const loseStr = loseClause[lose] ?? `Avoid the lose condition: ${lose}.`;
  return `Control ${playerName}. ${winStr} ${loseStr}`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
