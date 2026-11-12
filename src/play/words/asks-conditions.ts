import type { Amount } from "../../catalog/boundary.ts";
import type { Ask } from "./asks.ts";

// The conditions the scenarios' asks files (asks/<scenario>.ts) share, written once: a caution's `when` for a pick that loses the game (docs/design-system-table.md, Choice tray).
export type When = NonNullable<Ask["caution"]>["when"];

/** The picked character carries The One Ring: its loss from play loses the game (mec113.the-one-ring). */
export const CARRIES_RING: When = { kind: "matches", card: "picked", pick: { type: "character", control: "any", hasAttachment: { names: ["The One Ring"] } } };

/** The picked character would be destroyed by `damage` more damage: its hit points are less than its damage plus that damage plus 1. */
export const DESTROYED_BY = (damage: number): When => ({ kind: "less", left: { stat: "hitPoints", of: "picked" }, right: { stat: "damage", of: "picked", plus: damage + 1 } });

/** The raise takes the player to the elimination level, 99 or more under Dire (mec113.dire): `raise` is a number or an amount read now. */
export const ELIMINATED = (raise: number | Amount): When =>
  // Threat plus the raise is 99 or more: 98 less the threat is less than the raise.
  (typeof raise === "number" ? { kind: "threat", min: 99 - raise } : { kind: "less", left: { threat: "actor", times: -1, plus: 98 }, right: raise }) as When;

/** The picked character carries The One Ring and would be destroyed by `damage` more damage. */
export const RING_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [CARRIES_RING, DESTROYED_BY(damage)] }) as When;
