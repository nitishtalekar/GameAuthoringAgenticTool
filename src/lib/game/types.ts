// ---- Concept Data (Step 1 output) ----

export interface Relation {
  subject: string;
  verb: string;
  object: string;
}

export interface ConceptData {
  conceptSentences: string[];
  entities: string[];
  relations: Relation[];
}

// ---- Rhetoric Assignment (Step 2 output) ----

export interface EntityBehaviorSpec {
  entity: string;
  isPlayer: boolean;
  behaviorType: string;
  // player_controlled
  speed?: number;
  clampToCanvas?: boolean;
  // sized entities
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  size?: number;
  // chase
  target?: string;
  speedMin?: number;
  speedMax?: number;
  // spawn_on_timer
  spawnIntervalMs?: number;
  spawnMax?: number;
  // grow_over_time
  growRate?: number;
  // inventory
  maxInventory?: Record<string, number>;
}

export interface EntityInteractionSpec {
  entityA: string;
  entityB: string;
  interactionType: string;
  // damage_on_item options
  item?: string;
  amount?: number;
}

export interface RhetoricAssignment {
  entityBehaviors: EntityBehaviorSpec[];
  entityInteractions: EntityInteractionSpec[];
}

// ---- Recipe Output (Step 3 output) ----

export interface WinCondition {
  recipe: string;
  type: "entity_property_threshold" | "entity_count_threshold" | "timer_elapsed";
  entity?: string;
  property?: string;
  operator?: ">=" | "<=" | ">" | "<" | "==";
  value?: number;
  seconds?: number;
  message: string;
}

export interface LoseCondition {
  recipe: string;
  type: "entity_property_threshold" | "entity_count_threshold" | "timer_elapsed";
  entity?: string;
  property?: string;
  operator?: ">=" | "<=" | ">" | "<" | "==";
  value?: number;
  seconds?: number;
  message: string;
}

export interface RecipeOutput {
  winConditions: WinCondition[];
  loseConditions: LoseCondition[];
  justification: string;
}

// ---- Alignment Rating (Step 4 output) ----

export interface AlignmentRating {
  alignmentScore: number;
  interpretation: string;
  mismatches: string[];
}

// ---- Top-level GameState (client-side accumulator) ----

export interface GameState {
  step: number;
  /** Raw article / original user text before distillation */
  initialInput?: string;
  conceptData?: ConceptData;
  rhetoricAssignment?: RhetoricAssignment;
  recipeOutput?: RecipeOutput;
  alignmentRating?: AlignmentRating;
  /** Final game config JSON string */
  gameJsonOutput?: string;
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
