// Rules: hob.venom-poison, hob.unconscious-characters (data/rules/entries.json); ledger lines 132029:A:2, 132027:A:1, 132027:A:2, 132067:B:1.
// The pick filters `poisoned`, `unconscious` and `mostPoison` (src/catalog/effect-schema-pick.ts): the character has any poison, is unconscious, or has as much poison as any character of the chooser's area.
import type { PickSpec } from "../../../catalog/boundary.ts";

import { characters } from "../../combat/combat.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import type { PickContext } from "../../interpret/pick.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { sharing } from "../breaking/areas.ts";
import { poisonOf } from "./poison.ts";

/** A card the filter keeps: false takes it out of the pick. */
export function poisonPickMatches(state: ScenarioState, id: string, spec: PickSpec, at: PickContext, ctx: ReduceContext): boolean {
  if (spec.poisoned == null && spec.unconscious == null && spec.mostPoison !== true) return true;
  const card = state.cards[id];
  if (!card) return false;
  if (spec.unconscious != null && (card.unconscious === true) !== spec.unconscious) return false;
  if (spec.poisoned != null && poisonOf(state, id) > 0 !== spec.poisoned) return false;
  if (spec.mostPoison === true) {
    // The characters of the chooser's area: once stages are separate the players who share its staging area, else every player (mec108.create-staging-area).
    const seats = state.separate ? sharing(state, at.seat) : livingSeats(state);
    const most = Math.max(0, ...seats.flatMap((seat) => characters(state, seat, ctx.cards)).map((other) => poisonOf(state, other)));
    if (poisonOf(state, id) !== most) return false;
  }
  return true;
}
