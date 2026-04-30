import manVsHunger from "./man-vs-hunger.json";
import occupyWallStreet from "./occupy-wall-street.json";
import firefighter from "./firefighter.json";

export const GAME_CONFIG_SAMPLES: { id: string; label: string; config: unknown }[] = [
  { id: "man-vs-hunger", label: "Man vs Hunger", config: manVsHunger },
  { id: "occupy-wall-street", label: "Occupy Wall Street", config: occupyWallStreet },
  { id: "firefighter", label: "Firefighter", config: firefighter },
];
