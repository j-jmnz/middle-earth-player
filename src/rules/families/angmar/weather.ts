// Rules: rr.surge, rr.reveal (data/rules/entries.json); ledger lines 09069:B:1, 09039:A:1. "The first Weather treachery card revealed each round gains surge": the stage's constant record FirstTraitSurge is the marker; the engine notes the reveal as the card is revealed, before its When Revealed
// effects and before the surge check. A card is revealed from the staging step, by an effect or by Surge alike; the table remembers one was revealed until the round ends (`traitRevealed`, one for each Trait). 09039:A:1 Haunted Keep is the same marker on an Undead enemy.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, modifierActive, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";

const MARKER = "FirstTraitSurge" as const satisfies Instruction["verb"];

type Marker = Extract<Instruction, { verb: "FirstTraitSurge" }>;

// The markers any record of the game holds, with the code of the card that prints each: a card with a marker in play keeps the round's tally of its Trait whether or not the marker's own condition holds (Haunted Keep in the staging area, not yet active; 09039:A:1).
const MARKERS = new WeakMap<readonly Effect[], readonly { marker: Marker; code: string }[]>();

function markersOf(ctx: Pick<ReduceContext, "effects">): readonly { marker: Marker; code: string }[] {
  let found = MARKERS.get(ctx.effects);
  if (!found) {
    found = ctx.effects.filter((effect) => effect.timing === "constant").flatMap((effect) => effect.instructions.flatMap((instruction) => (instruction.verb === MARKER ? [{ marker: instruction, code: effect.cardCode }] : [])));
    MARKERS.set(ctx.effects, found);
  }
  return found;
}

/**
 * A card was revealed (the `revealed` hook): the first card of the type a marker names (a treachery unless it says `type`) with the Trait it names, revealed in a round while a card holding the marker is in play, is noted for the round (`traitRevealed`); it gains surge when the
 * marker's own condition holds (Haunted Keep: while it is the active location). One tally for each Trait: a later card of the Trait finds it noted.
 */
export function noteFirstTrait(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.cardId !== cardId || constantVerbCodes(ctx, MARKER).size === 0) return state;
  const type = printedOf(ctx.cards, card.code).type;
  const tallied = (trait: string): boolean =>
    state.modifiers.some((modifier) => modifier.stat === "traitRevealed" && modifier.amount > 0 && modifierActive(state, modifier) && printedOf(ctx.cards, state.cards[modifier.sourceId ?? ""]?.code ?? "").type === type && hasTrait(state, modifier.sourceId ?? "", trait, ctx));
  let next = state;
  for (const trait of new Set(markersOf(ctx).filter(({ marker }) => (marker.type ?? "treachery") === type && hasTrait(next, cardId, marker.trait, ctx)).map(({ marker }) => marker.trait))) {
    const held = markersOf(ctx).filter(({ marker }) => marker.trait === trait && (marker.type ?? "treachery") === type);
    if (tallied(trait) || !held.some(({ code }) => Object.values(next.cards).some((other) => other.code === code && inPlay(other.zone)))) continue;
    next = { ...next, modifiers: [...next.modifiers, { instanceId: "table", sourceId: cardId, stat: "traitRevealed" as const, amount: 1, until: "endOfRound" as const }] };
    if (constantInstructions(next, ctx).some(({ instruction }) => instruction.verb === MARKER && instruction.trait === trait && (instruction.type ?? "treachery") === type)) next = markSurge(next, cardId);
  }
  return next;
}
