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
  | "AdjustParameter"
  | "AssignPlayer";

export interface RepairAction {
  operator: RepairOperator;
  target: string;
  from?: string;
  to?: string;
  parameter?: string;
  value?: string | number;
}

export interface VerifierReport {
  issues: string[];
  repairs: RepairAction[];
  playable: boolean;
}

// ---- Rhetoric Critique (Agent 5 output) ----

export interface SuggestedSwap {
  entity: string;
  replace: string;
  with: string;
}

export interface RhetoricCritique {
  alignment_score: number;
  interpretation: string;
  mismatches: string[];
  suggested_swaps: SuggestedSwap[];
}

// ---- Entity Attribute State (Agent 3 output) ----

export type EntityAttributeValue = boolean | string | null;
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
  entities?: EntitySpec[];
  verifierReport?: VerifierReport;
  rhetoricCritique?: RhetoricCritique;
  rhetoricSwapApplied?: boolean;
  postSwapRhetoricCritique?: RhetoricCritique;
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
