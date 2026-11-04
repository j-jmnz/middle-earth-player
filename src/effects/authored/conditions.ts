import type { Condition } from "../../catalog/boundary.ts";

// Conditions several authored files read the same way. This file exports no AUTHORED_EFFECTS, so the authored barrel (scripts/data/effects/barrel.ts) does not list it.

/** A condition that always holds, for the "cannot be canceled" of a card that prints no condition (`uncancelable` takes one). */
export const ALWAYS = { kind: "count", pick: { type: "hero", control: "any" }, min: 0 } as const satisfies Condition;

/** 3 or more players are in the game ("the top 3 instead if there are 3 or more players"). */
export const MANY_PLAYERS = { kind: "count", pick: { type: "player", control: "any" }, min: 3 } as const satisfies Condition;
