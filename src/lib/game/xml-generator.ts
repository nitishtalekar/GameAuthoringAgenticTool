import type { GameState, EntitySpec, RepairAction, MicroRhetoricSelectionItem } from "./types";

/**
 * Basic well-formedness check.
 * Returns true if the XML string looks like a valid game spec document.
 */
export function validateXml(xml: string): boolean {
  const trimmed = xml.trim();
  return (
    (trimmed.startsWith("<?xml") || trimmed.startsWith("<game")) &&
    trimmed.includes("</game>")
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
  const alignmentScore = state.rhetoricCritique?.alignment_score ?? 0;
  const interpretation = state.rhetoricCritique?.interpretation ?? "";
  const selections = state.microRhetoricsSelection?.selections ?? [];
  const repairs = state.verifierReport?.repairs ?? [];
  const now = new Date().toISOString();

  const entitiesXml = entities
    .map((e) => serializeEntity(e))
    .join("\n  ");

  const winXml = buildWinConditionXml(win);
  const loseXml = buildLoseConditionXml(lose);
  const layoutXml = buildLayoutXml(structure, entities);
  const traceXml = buildDesignTraceXml(alignmentScore, interpretation, selections, repairs);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Game-O-Matic Generated Game Specification
     Generated: ${now}
     Concept: ${escapeXml(state.input)}
     Alignment Score: ${alignmentScore.toFixed(2)}
-->
<game version="1.0">

  <metadata
    title="${escapeXml(deriveTitle(entities))}"
    description="${escapeXml(deriveDescription(state))}"
    generatedFrom="${escapeXml(state.input)}"
  />

  <entities>
  ${entitiesXml}
  </entities>

  ${winXml}

  ${loseXml}

  ${layoutXml}

  ${traceXml}

</game>`;
}

// --- Private helpers ---

function buildFallbackEntities(state: GameState): EntitySpec[] {
  const entities = state.conceptGraph?.entities ?? [];
  const selections = state.microRhetoricsSelection?.selections ?? [];

  return entities.map((name, idx) => {
    const relevantComponents = selections
      .filter(
        (s) =>
          s.relation.startsWith(name + " ") ||
          s.relation.endsWith(" " + name)
      )
      .map((s) => s.component);

    return {
      name,
      isPlayer: idx === 0,
      components: relevantComponents,
      parameters: { speed: 100, size: 32, spawnRate: 1.5 },
    };
  });
}

function serializeEntity(e: EntitySpec): string {
  const componentsXml = e.components.length > 0
    ? e.components.map((c) => `      <component type="${escapeXml(c)}" />`).join("\n")
    : `      <!-- no components assigned -->`;

  const params = Object.entries(e.parameters);
  const parametersXml = params.length > 0
    ? params.map(([k, v]) => `      <param name="${escapeXml(k)}" value="${escapeXml(String(v))}" />`).join("\n")
    : `      <param name="speed" value="100" unit="px/s" />
      <param name="size" value="32" unit="px" />`;

  return `<entity name="${escapeXml(e.name)}" isPlayer="${e.isPlayer}">
      <components>
${componentsXml}
      </components>
      <parameters>
${parametersXml}
      </parameters>
    </entity>`;
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

function buildDesignTraceXml(
  alignmentScore: number,
  interpretation: string,
  selections: MicroRhetoricSelectionItem[],
  repairs: RepairAction[]
): string {
  const selectionsXml = selections
    .map(
      (s) =>
        `      <selection relation="${escapeXml(s.relation)}" microRhetoric="${escapeXml(s.micro_rhetoric)}" component="${escapeXml(s.component)}" />`
    )
    .join("\n");

  const repairsXml = repairs
    .map(
      (r) =>
        `      <repair operator="${escapeXml(r.operator)}" target="${escapeXml(r.target)}"${r.from ? ` from="${escapeXml(r.from)}"` : ""}${r.to ? ` to="${escapeXml(r.to)}"` : ""} />`
    )
    .join("\n");

  return `<designTrace>
    <rhetoricAlignmentScore value="${alignmentScore.toFixed(2)}" />
    <interpretation>${escapeXml(interpretation)}</interpretation>
    <microRhetoricSelections>
${selectionsXml || "      <!-- none -->"}
    </microRhetoricSelections>
    <repairsApplied>
${repairsXml || "      <!-- none -->"}
    </repairsApplied>
  </designTrace>`;
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
