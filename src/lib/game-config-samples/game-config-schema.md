# Game Config Schema Reference

## Behaviors

### `player_controlled`
| Property | Type | Required | Description |
|---|---|---|---|
| `clampToCanvas` | boolean | no | Prevent entity from leaving canvas bounds (default: `true`) |

---

### `chase`
| Property | Type | Required | Description |
|---|---|---|---|
| `clampToCanvas` | boolean | no | Clamp movement to canvas (default: `false`) |
| `properties.target` | string | yes | Entity id to chase |

---

### `spawn_on_timer`
| Property | Type | Required | Description |
|---|---|---|---|
| `properties.intervalMs` | number | yes | Milliseconds between spawns |
| `properties.max` | number | no | Maximum live instances allowed |
| `properties.speedMin` | number | yes | Minimum speed for spawned instances |
| `properties.speedMax` | number | yes | Maximum speed for spawned instances |
| `properties.spawnAt` | SpawnPosition | yes | Where to place each new instance (see below) |

#### SpawnPosition anchors
| `anchor` | Extra fields | Description |
|---|---|---|
| `"random_canvas"` | `margin?: number` | Random point inside the canvas, inset by margin |
| `"random_edge"` | `offset?: number` | Random point just outside one of the four edges |
| `"near_entity"` | `entity: string`, `offsetRadius: number` | Random point on a circle around the first instance of the named entity |

---

## Interactions

### `consume`
| | Value |
|---|---|
| Hit threshold | `dist < sizeA + sizeB * 0.8` |
| Effect on A | `size += 6` (clamped to `maxSize`) |
| Effect on B | Teleported to a random canvas position (margin 40) |

### `damage`
| | Value |
|---|---|
| Hit threshold | `dist < sizeA + sizeB * 0.65` |
| Effect on A | `size -= 5` |
| Effect on B | Instance destroyed and removed |

---

## End Conditions

All end conditions share these common fields:

| Property | Type | Description |
|---|---|---|
| `result` | `"won"` \| `"lost"` | Outcome when triggered |
| `message` | string | Message shown on the game over screen |

---

### `timer_elapsed`
| Property | Type | Required | Description |
|---|---|---|---|
| `properties.seconds` | number | yes | Total game duration in seconds |

### `entity_property_threshold`
| Property | Type | Required | Description |
|---|---|---|---|
| `properties.property` | `"size"` | yes | Property to compare (`size` is the only one currently tracked) |
| `properties.operator` | `"<="` \| `"<"` \| `">="` \| `">"` \| `"="` | yes | Comparison operator |
| `properties.value` | number | yes | Threshold value |
