export interface EndConditionJsonSpec {
  notes: string;
  properties: string[];
}

export const END_CONDITION_PROPERTY_SPECS: Record<string, EndConditionJsonSpec> = {
  entity_property_threshold: {
    notes: "Fires when a numeric property on a specific entity crosses a threshold.",
    properties: [
      "entity: <entity id>",
      "property: 'size' | 'health' (use 'size' unless entity has a health field)",
      "operator: '>=' | '>' for reach/exceed thresholds; '<=' | '<' for fall-to thresholds",
      "value: number — must fall within the entity's minSize–maxSize range for size conditions",
    ],
  },
  entity_count_threshold: {
    notes: "Fires when the live instance count of an entity type crosses a threshold.",
    properties: [
      "entity: <entity id>",
      "operator: '<=' | '<' to detect depletion; '>=' | '>' to detect accumulation",
      "value: number (0 = all destroyed)",
    ],
  },
  timer_elapsed: {
    notes: "Fires when the countdown timer reaches zero. No entity reference needed.",
    properties: [
      "seconds: 30–120",
    ],
  },
};

function formatEndConditionSpec(type: string, spec: EndConditionJsonSpec): string {
  const props = spec.properties.map((p) => `      - ${p}`).join("\n");
  return `  ${type}: ${spec.notes}\n    Properties:\n${props}`;
}

export function formatEndConditionPropertySpecsForPrompt(): string {
  return Object.entries(END_CONDITION_PROPERTY_SPECS)
    .map(([type, spec]) => formatEndConditionSpec(type, spec))
    .join("\n\n");
}
