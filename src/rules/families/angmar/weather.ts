// Rules: rr.surge, rr.reveal, rr.keywords, faq.lasting-effects (data/rules/entries.json); ledger lines 09069:B:1, 09039:A:1, 00008:A:1, 00014:A:2. "The first Weather treachery card revealed each round gains surge": the stage's constant record FirstTraitSurge is the marker; the engine notes the reveal as the card is revealed, before its When Revealed
// effects and before the surge check. A card is revealed from the staging step, by an effect or by Surge alike; the table remembers one was revealed until the round ends (`traitRevealed`, one for each Trait). 09039:A:1 Haunted Keep is the same marker on an Undead enemy.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";

import { constantInstructions, constantVerbCodes } from "../../interpret/constant-records.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, modifierActive, type ScenarioState } from "../../core/state.ts";
import { topFrame } from "../../windows/windows.ts";
import { onStage } from "../nightmare/guards.ts";

const MARKER = "FirstTraitSurge" as const satisfies Instruction["verb"];

type Marker = Extract<Instruction, { verb: "FirstTraitSurge" }>;

// The markers any record of the game holds, with the card that prints each. A game that deals a holder keeps the round's tally of its Trait from the round's start, whether or not the holder is in play or its own condition holds (Haunted Keep in the encounter deck or the staging area; Reading 11).
const MARKERS = new WeakMap<readonly Effect[], readonly Marker[]>();

function markersOf(ctx: Pick<ReduceContext, "effects">): readonly Marker[] {
  let found = MARKERS.get(ctx.effects);
  if (!found) {
    found = ctx.effects.filter((effect) => effect.timing === "constant").flatMap((effect) => effect.instructions.flatMap((instruction) => (instruction.verb === MARKER ? [instruction] : [])));
    MARKERS.set(ctx.effects, found);
  }
  return found;
}

// The card type a marker applies to: a treachery unless it names one.
const markerType = (marker: Marker): string => marker.type ?? "treachery";

// Whether the game holds a card that prints a marker for this Trait and type and can enter play by a reveal this round: one in play, or an encounter card dealt in a pile (Haunted Keep in the encounter deck), not one the game removed and not a quest stage waiting its turn (the next stage sets the marker when it arrives).
function holderDealt(state: ScenarioState, markers: readonly Marker[], trait: string, type: string, ctx: ReduceContext): boolean {
  const codes = new Set(ctx.effects.filter((effect) => effect.timing === "constant" && effect.instructions.some((instruction) => instruction.verb === MARKER && instruction.trait === trait && markerType(instruction) === type)).map((effect) => effect.cardCode));
  return markers.length > 0 && Object.values(state.cards).some((card) => codes.has(card.code) && (inPlay(card.zone) || (card.zone !== "removed" && printedOf(ctx.cards, card.code).type !== "quest")));
}

// Whether a card of this type and Trait was already revealed this round: a `traitRevealed` tally a card of the type with the Trait put on the table.
function alreadyTallied(state: ScenarioState, trait: string, type: string, ctx: ReduceContext): boolean {
  return state.modifiers.some((modifier) => modifier.stat === "traitRevealed" && modifier.amount > 0 && modifierActive(state, modifier) && printedOf(ctx.cards, state.cards[modifier.sourceId ?? ""]?.code ?? "").type === type && hasTrait(state, modifier.sourceId ?? "", trait, ctx));
}

// The marker for this Trait and type in force now (its constant record's own condition holds: the stage, or Haunted Keep while it is the active location), or undefined.
function markerHolds(state: ScenarioState, trait: string, type: string, ctx: ReduceContext): Marker | undefined {
  for (const { instruction } of constantInstructions(state, ctx)) if (instruction.verb === MARKER && instruction.trait === trait && markerType(instruction) === type) return instruction;
  return undefined;
}

/** The reveal in progress of this card gains Doomed `amount` on top of its printed Doomed (read as the reveal frame raises the threat, windows/frames.ts). */
function markDoomed(state: ScenarioState, cardId: string, amount: number): ScenarioState {
  const index = state.stack.findLastIndex((frame) => frame.frame === "reveal" && frame.cardId === cardId && frame.data.kind === "reveal");
  if (index < 0) return state;
  const stack = state.stack.map((entry, at) => (at === index && entry.data.kind === "reveal" ? { ...entry, data: { ...entry.data, extraDoomed: (entry.data.extraDoomed ?? 0) + amount } } : entry));
  return { ...state, stack };
}

/**
 * A card was revealed (the `revealed` hook): the first card of the type a marker names (a treachery unless it says `type`) with the Trait it names, revealed in a round of a game that deals a card holding the marker, is noted for the round (`traitRevealed`); it gains surge when the
 * marker's own condition holds (Haunted Keep: while it is the active location). One tally for each Trait: a later card of the Trait finds it noted, so an Undead revealed before the Keep enters play is the round's first and the next one does not surge.
 */
export function noteFirstTrait(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  const card = state.cards[cardId];
  const top = topFrame(state);
  if (!card || top?.data.kind !== "reveal" || top.cardId !== cardId || constantVerbCodes(ctx, MARKER).size === 0) return state;
  const type = printedOf(ctx.cards, card.code).type;
  // The Traits of this card that a marker of its type names; each is tallied once, against the tally as the round began this reveal (a card with two such Traits tallies both).
  const markers = markersOf(ctx).filter((marker) => markerType(marker) === type && hasTrait(state, cardId, marker.trait, ctx));
  let next = state;
  for (const trait of new Set(markers.map((marker) => marker.trait))) {
    if (alreadyTallied(state, trait, type, ctx) || !holderDealt(state, markers, trait, type, ctx)) continue;
    next = { ...next, modifiers: [...next.modifiers, { instanceId: "table", sourceId: cardId, stat: "traitRevealed" as const, amount: 1, until: "endOfRound" as const }] };
    const holds = markerHolds(next, trait, type, ctx);
    if (!holds) continue;
    next = markSurge(next, cardId);
    if (holds.doomed != null) next = markDoomed(next, cardId, holds.doomed);
  }
  return next;
}

/** RevealedGainDoomed: from now until `until` each card revealed gains Doomed (a table modifier read as every card is revealed). */
export function revealedGainDoomed(state: ScenarioState, instruction: Extract<Instruction, { verb: "RevealedGainDoomed" }>, sourceId: string | null): ScenarioState {
  const stageAmount = instruction.instead ? { stageAmount: instruction.instead } : {};
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: sourceId ?? "table", stat: "revealDoomed", amount: instruction.amount, until: instruction.until, ...stageAmount }] };
}

/** A card was revealed (the `revealed` hook): the Doomed the table's RevealedGainDoomed effects give it, recalculated now (faq.lasting-effects): the effect's `instead` amount once the current stage is its stage or later. */
export function noteRevealDoomed(state: ScenarioState, cardId: string): ScenarioState {
  if (state.modifiers.length === 0) return state;
  const top = topFrame(state);
  if (top?.data.kind !== "reveal" || top.cardId !== cardId) return state;
  let doomed = 0;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "revealDoomed" || !modifierActive(state, modifier)) continue;
    doomed += modifier.stageAmount && onStage(state, modifier.stageAmount.stage) ? modifier.stageAmount.amount : modifier.amount;
  }
  return doomed > 0 ? markDoomed(state, cardId, doomed) : state;
}
