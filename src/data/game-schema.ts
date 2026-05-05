/**
 * Single source of truth for the game config schema.
 * Used by the Game JSON Generation Agent as its authoritative reference.
 */
export const GAME_SCHEMA = `
=== VALID TYPES ===

Behavior types (the only accepted values for behavior.type):
  player_controlled | chase | spawn_on_timer | spawn_on_start | grow_over_time

Interaction types (the only accepted values for interaction.type):
  consume | damage | collect | damage_on_item | destroy

End condition types (the only accepted values for endCondition.type):
  timer_elapsed | entity_property_threshold | entity_count_threshold

Status bar sources (the only accepted values for statusBar.source):
  entity_size | timer_remaining | entity_inventory_item | entity_count


=== BEHAVIORS ===

player_controlled
  Entity fields:
    - initialSize: 20–60
    - minSize: 10–30
    - maxSize: 100–300
    - speed: 150–260
    - initialPosition: { "anchor": "center" }
  Behavior fields:
    - clampToCanvas: true

chase
  Entity fields:
    - size: 20–60
    - speedMin: 80–150
    - speedMax: 120–200
    - initialPosition: { "anchor": "none" }
  Behavior fields:
    - clampToCanvas: false
    - properties.target: <id of the entity being chased — must be a valid entity id>

spawn_on_timer  (continuous spawning; instances respawn after being destroyed)
  Entity fields:
    - size: 15–50
    - initialPosition: { "anchor": "none" }
  Behavior fields:
    - properties.intervalMs: 1000–4000
    - properties.max: 3–10
    - properties.spawnAt: { "anchor": "random_edge", "offset": 20–40 } for enemies
                          { "anchor": "random_canvas", "margin": 20–40 } for collectibles
    - properties.speedMin: 0 for static collectibles; 50–150 for moving entities
    - properties.speedMax: 0 for static collectibles; 100–200 for moving entities

spawn_on_start  (one-time placement; destroyed instances do NOT respawn)
  Entity fields:
    - size: 20–60
    - initialPosition: { "anchor": "none" }
  Behavior fields:
    - properties.count: 2–6
    - properties.spawnAt: { "anchor": "random_canvas", "margin": 40–80 }

grow_over_time
  Entity fields:
    - initialSize: 20–60
    - minSize: 0–10
    - maxSize: 300–500
    - initialPosition: { "anchor": "fixed", "x": <canvas_x>, "y": <canvas_y> }
  Behavior fields:
    - properties.property: "size"
    - properties.rate: 5–20
    - properties.clampToMax: true


=== INTERACTIONS ===

consume
  Effect: EntityA grows by 6 on contact; EntityB teleports to a random canvas position.
  No extra options needed.

damage
  Effect: EntityA shrinks by 5 on contact; EntityB instance is destroyed.
  No extra options needed.

collect
  Effect: EntityA adds one unit of EntityB's id to its inventory; EntityB instance is destroyed.
  REQUIRED: EntityA's entity definition must have "maxInventory": { "<itemKey>": N }
  The itemKey must exactly match EntityB's entity id.

damage_on_item
  Effect: EntityA spends inventory items to destroy EntityB.
  REQUIRED: EntityA must have "maxInventory" with the item key.
  REQUIRED: interaction must include "options": { "item": "<itemKey>", "amount": 1 }
  The itemKey must exactly match the key used in EntityA's maxInventory and in any collect interaction targeting that item.

destroy
  Effect: EntityB instance is destroyed on contact; no effect on EntityA.
  No extra options needed.


=== END CONDITIONS ===

timer_elapsed
  Fires when the countdown reaches zero.
  Properties: { "seconds": 60–120 }
  CONSTRAINT: If a timer_remaining status bar exists, its "total" must equal this "seconds" value.

entity_property_threshold
  Fires when a numeric property on one entity instance crosses a value.
  Properties: { "entity": "<id>", "property": "size", "operator": "<= | < | >= | > | =", "value": N }
  CONSTRAINT: Only use this for entities that have a single instance whose size changes (player, grow_over_time entities).
  CONSTRAINT: "value" must be within the entity's minSize–maxSize range.
  CONSTRAINT: Do NOT use this for counting instances — use entity_count_threshold instead.

entity_count_threshold
  Fires when the live instance count of an entity type crosses a value.
  Properties: { "entity": "<id>", "operator": "<= | < | >= | > | =", "value": N }
  CONSTRAINT: Only use this for entities spawned by spawn_on_timer or spawn_on_start (entities that can have multiple instances).
  CONSTRAINT: Do NOT use this on single-instance entities (player, grow_over_time) — their count is always 1.
  CONSTRAINT: "value": 0 means "all instances destroyed".


=== STATUS BARS ===

entity_size bar:    { "source": "entity_size",          "entity": "<id>", "color": "#hex", "displayMode": "percent", "min": N, "max": N }
timer bar:          { "source": "timer_remaining",       "color": "#hex", "displayMode": "seconds", "total": N }
inventory bar:      { "source": "entity_inventory_item", "entity": "<id>", "item": "<itemKey>", "color": "#hex", "min": 0, "max": N }
count bar:          { "source": "entity_count",          "entity": "<id>", "color": "#hex", "min": 0, "max": N }


=== PLAYABILITY CONSTRAINTS ===

1. Every entity id referenced in a behavior, interaction, end condition, or status bar MUST exist in the entities array.
2. Every inventory itemKey referenced in collect, damage_on_item, or entity_inventory_item bars MUST be identical across all three sites.
3. collect and damage_on_item only form a valid loop when BOTH are present: a collect with no damage_on_item outlet means the player collects forever with no effect.
4. entity_count_threshold with value 0 on a spawn_on_start entity is only reachable if the player or another entity can destroy those instances.
5. A win condition must be reachable: the player (or a mechanic) must be able to cause it. An unreachable win = unwinnable game.
6. A lose condition must be reachable: at least one threat must be able to cause it without player intervention. An unreachable lose = trivially easy game.
7. Entities with initialPosition.anchor="none" and no spawn behavior (spawn_on_timer or spawn_on_start) will never appear — always pair them with a spawn.
8. Do not use grow_over_time on the same entity as spawn_on_timer or spawn_on_start.
9. The player entity must have exactly one player_controlled behavior.
10. At least one interaction must involve the player entity as EntityA, giving the player agency.


=== FULL JSON SCHEMA ===

{
  "meta": {
    "title": "string",
    "instructions": "WASD to move. <one sentence explaining the objective>",
    "canvas": { "width": 900, "height": 600, "background": "#1e293b" }
  },
  "entities": [
    {
      "id": "snake_case_entity_id",
      "label": "Short Label",
      "color": "#hex",
      // size fields depend on behavior type — see BEHAVIORS above
    }
  ],
  "behaviors": [
    // one object per behavior per entity
    // player_controlled: { "entity": "id", "type": "player_controlled", "clampToCanvas": true }
    // chase:             { "entity": "id", "type": "chase", "clampToCanvas": false, "properties": { "target": "playerId" } }
    // spawn_on_timer:    { "entity": "id", "type": "spawn_on_timer", "properties": { "intervalMs": N, "max": N, "spawnAt": {...}, "speedMin": N, "speedMax": N } }
    // spawn_on_start:    { "entity": "id", "type": "spawn_on_start", "properties": { "count": N, "spawnAt": {...} } }
    // grow_over_time:    { "entity": "id", "type": "grow_over_time", "properties": { "property": "size", "rate": N, "clampToMax": true } }
  ],
  "interactions": [
    // { "entityA": "id", "entityB": "id", "type": "interactionType" }
    // damage_on_item also needs: "options": { "item": "itemKey", "amount": 1 }
  ],
  "endConditions": [
    // { "id": "snake_case_id", "type": "...", "properties": {...}, "result": "won" | "lost", "message": "string" }
  ],
  "ui": {
    "statusBars": [
      // include one bar per meaningful metric the player needs to track
    ]
  }
}
`.trim();
