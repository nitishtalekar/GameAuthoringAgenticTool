// ---- Concept Graph (Agent 1 output) ----

export interface Relation {
  subject: string;
  verb: string;
  object: string;
}

export interface ConceptGraph {
  entities: string[];
  relations: Relation[];
  confidence: number;
}

// ---- Micro-Rhetoric Selection (Agent 2 output) ----

export interface MicroRhetoricSelectionItem {
  relation: string;
  micro_rhetoric: string;
  component: string;
  justification: string;
}

export interface MicroRhetoricsSelection {
  selections: MicroRhetoricSelectionItem[];
}

// ---- Recipe Selection (Agent 3 output) ----

export interface WinLoseCondition {
  /** Natural-language constraint, e.g. "All Asteroid isRemovedBy Player" */
  description: string;
  /** The entity whose state is observed, e.g. "Asteroid" */
  entity: string;
  /** The attribute being checked, e.g. "isRemovedBy" */
  attribute: string;
  /**
   * The value that satisfies the condition.
   * - Entity-ref attribute: exact entity name, e.g. "Player"
   * - Boolean with measurable threshold: numeric string with unit, e.g. "256px" or "60s"
   * - Plain boolean: "true" or "false"
   */
  value: string;
}

export interface RecipeSelection {
  win_recipe: string;
  lose_recipe: string;
  structure_recipe: string;
  patch_recipes: string[];
  win_condition: WinLoseCondition;
  lose_condition: WinLoseCondition;
  justifications: Record<string, string>;
}

// ---- Entity (assembled after Agent 3) ----

export interface EntitySpec {
  name: string;
  isPlayer: boolean;
  components: string[];
  parameters: Record<string, string | number>;
}

// ---- Verifier Report (Agent 4 output) ----

export type RepairOperator =
  | "AddComponent"
  | "RemoveComponent"
  | "ReplaceComponent"
  | "AlterAttribute"
  | "AdjustParameter"
  | "AssignPlayer";

export interface RepairAction {
  operator: RepairOperator;
  target: string;
  /** For component operations: old component name */
  from?: string;
  /** For component operations: new component name */
  to?: string;
  /** For AlterAttribute: the attribute key to change */
  attribute?: string;
  /** For AlterAttribute: the new attribute value */
  attributeValue?: string | boolean | null;
  /** For AdjustParameter: the parameter name */
  parameter?: string;
  /** For AdjustParameter: the new parameter value */
  value?: string | number;
  /** For win/lose condition repairs: "win_condition" | "lose_condition" */
  conditionField?: "win_condition" | "lose_condition";
  /** For win/lose condition repairs: the updated condition object */
  conditionValue?: Record<string, string>;
}

export interface VerifierSuggestion {
  operator: RepairOperator;
  target: string;
  description: string;
  /** For AlterAttribute */
  attribute?: string;
  attributeValue?: string | boolean | null;
  /** For condition repairs */
  conditionField?: "win_condition" | "lose_condition";
  conditionValue?: Record<string, string>;
  /** For AdjustParameter */
  parameter?: string;
  value?: string | number;
  /** For component ops */
  from?: string;
  to?: string;
}

export interface VerifierReport {
  isPlayable: boolean;
  issues: string[];
  repairs: RepairAction[];
  suggestions: VerifierSuggestion[];
  repairsSummary: string;
}

// ---- Rhetoric Critique (Agent 5 output) ----

export interface RhetoricCritique {
  alignment_score: number;
  interpretation: string;
  mismatches: string[];
}

// ---- Entity Attribute State (Agent 3 output) ----

export type EntityAttributeValue = boolean | string | number | null;
export type EntityAttributeMap = Record<string, EntityAttributeValue>;

/**
 * Keys are entity names. Values are maps of all predefined attributes.
 * Empty object {} means the attribute agent has not run yet.
 */
export type EntityAttributeState = Record<string, EntityAttributeMap>;

// ---- Top-level GameState (client-side accumulator) ----

export interface GameState {
  step: number;
  input: string;
  conceptGraph?: ConceptGraph;
  microRhetoricsSelection?: MicroRhetoricsSelection;
  entityAttributeState?: EntityAttributeState;
  recipeSelection?: RecipeSelection;
  verifierReport?: VerifierReport;
  rhetoricCritique?: RhetoricCritique;
  xmlOutput?: string;
}

// ---- API contract ----

export interface StepRequest {
  step: number;
  state: GameState;
}

export interface StepResponse {
  state: GameState;
  error?: string;
}
