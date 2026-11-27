import type { Amount } from "../../catalog/boundary.ts";
import type { Ask } from "./asks.ts";

// The conditions the scenarios' asks files (asks/<scenario>.ts) share, written once: a caution's `when` for a pick that loses the game (docs/design-system-table.md, Choice tray).
export type When = NonNullable<Ask["caution"]>["when"];

/** The picked character carries The One Ring: its loss from play loses the game (mec113.the-one-ring). */
export const CARRIES_RING: When = { kind: "matches", card: "picked", pick: { type: "character", control: "any", hasAttachment: { names: ["The One Ring"] } } };

/** The picked character (or `of`, the card that triggered the record) would be destroyed by `damage` more damage: its hit points are less than its damage plus that damage plus 1. */
export const DESTROYED_BY = (damage: number, of: "picked" | "subject" = "picked"): When => ({ kind: "less", left: { stat: "hitPoints", of }, right: { stat: "damage", of, plus: damage + 1 } });

/** The raise takes the player to the elimination level, 99 or more under Dire (mec113.dire), or `level` (50, the ordinary one): `raise` is a number or an amount read now. */
export const ELIMINATED = (raise: number | Amount, level = 99): When =>
  // Threat plus the raise is the level or more: the level less 1, less the threat, is less than the raise.
  (typeof raise === "number" ? { kind: "threat", min: level - raise } : { kind: "less", left: { threat: "actor", times: -1, plus: level - 1 }, right: raise }) as When;

/** The picked character carries The One Ring and would be destroyed by `damage` more damage. */
export const RING_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [CARRIES_RING, DESTROYED_BY(damage)] }) as When;

/**
 * The caution of a raise that reaches every player's threat: `reaches(seat)` says the raise takes that seat to the elimination level (the condition `seatThreat`, with `plus` for a raise read now).
 * The words name the players it eliminates (Player 1, Player 2, both); a solo game, or the player who chooses alone, reads "you".
 */
export const ELIMINATES_SEATS = (reaches: (seat: number) => When): NonNullable<Ask["caution"]> => ({
  when: { kind: "any", conditions: [reaches(0), reaches(1)] } as When,
  text: [
    { when: { kind: "all", conditions: [{ kind: "not", condition: { kind: "otherPlayer" } }, reaches(0)] } as When, text: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost" },
    { when: { kind: "all", conditions: [reaches(0), reaches(1)] } as When, text: "Tap again: this takes Player 1's and Player 2's threat to 50 and eliminates both. The game is lost" },
    { when: reaches(0), text: "Tap again: this takes Player 1's threat to 50 and eliminates Player 1. The game is lost when no other player is left" },
    { text: "Tap again: this takes Player 2's threat to 50 and eliminates Player 2. The game is lost when no other player is left" },
  ],
});
