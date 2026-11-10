import type { Ask } from "../asks.ts";
import { ASKS as HELMS_DEEP } from "./helms-deep.ts";
import { ASKS as THE_ROAD_TO_ISENGARD } from "./the-road-to-isengard.ts";
import { ASKS as THE_URUK_HAI } from "./the-uruk-hai.ts";

// Written by pnpm data:build from src/play/words/asks/ (scripts/data/effects/asks-barrel.ts). Do not edit.
export const ASKS_BY_SCENARIO: Readonly<Record<string, Readonly<Record<string, Ask>>>> = { "helms-deep": HELMS_DEEP, "the-road-to-isengard": THE_ROAD_TO_ISENGARD, "the-uruk-hai": THE_URUK_HAI };
