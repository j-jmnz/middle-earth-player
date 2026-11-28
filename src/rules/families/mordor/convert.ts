// Rules: rr.attachment-cards, rr.ownership-and-control, rr.engaged, rr.player-elimination, rr.discard-pile-and-victory-display (data/rules/entries.json); ledger line 21039:A:1.
// Secret Cultist: the ally it attaches to loses the ally card type and gains the enemy card type (the code `<code>~enemy`, rules/core/printed.ts: the printed card is made from the ally's, its text box blank), engaged with its owner. When the Cultist leaves play, or the owner is eliminated, the
// ally is its owner's card again in the owner's discard pile.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { fallenBase, FALLEN_SUFFIX, printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { engageWith } from "../../quest/quest.ts";
import type { Focus } from "../index.ts";

/** The code of Secret Cultist (21039). */
export const SECRET_CULTIST = "21039";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** The card is an ally made an enemy by Secret Cultist (its printed card is an ally's). */
const converted = (state: ScenarioState, id: string, ctx: ReduceContext): boolean => {
  const code = state.cards[id]?.code ?? "";
  return code.endsWith(FALLEN_SUFFIX) && printedOf(ctx.cards, fallenBase(code)).type === "ally";
};

/** The source is attached to an ally in play: the ally becomes an enemy engaged with its owner. Nothing happens to a host that is not an ally in a player's area. */
export function convertAttachedAlly(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const ally = source?.host ? state.cards[source.host] : undefined;
  const seat = ally?.controller;
  if (!ally || ally.zone !== "play" || seat == null || printedOf(ctx.cards, ally.code).type !== "ally" || state.seats[seat]?.eliminated) return state;
  const made = updateCard(state, ally.id, { code: ally.code + FALLEN_SUFFIX, owner: seat, exhausted: false, committed: false });
  return engageWith(made, seat, ally.id, steps);
}

/** An ally made an enemy goes back to its owner's discard pile with its own code, wherever the enemy lies (engaged, in the staging area or in the encounter discard pile once defeated). */
function giveBack(state: ScenarioState, id: string): ScenarioState {
  const card = state.cards[id];
  if (!card) return state;
  const owner = card.owner ?? card.controller ?? 0;
  return updateCard(moveCard(state, id, { zone: "discard", seat: owner }), id, { code: fallenBase(card.code), owner: undefined, controller: owner, damage: 0, face: "up" });
}

/** ReturnConvertedAlly: each ally made an enemy that no Secret Cultist is attached to any more goes back to its owner's discard pile. `ifOwnerGone`: instead, the ally the source is attached to when its owner is eliminated, and then the source is discarded too. */
export function returnConvertedAlly(state: ScenarioState, instruction: Verb<"ReturnConvertedAlly">, focus: Focus, ctx: ReduceContext): ScenarioState {
  if (instruction.ifOwnerGone === true) {
    const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
    const ally = source?.host ? state.cards[source.host] : undefined;
    if (!source || !ally || !converted(state, ally.id, ctx) || !state.seats[ally.owner ?? -1]?.eliminated) return state;
    return moveCard(giveBack(state, ally.id), source.id, { zone: "encounterDiscard" });
  }
  const held = (id: string) => (state.cards[id]?.attachments ?? []).some((attachment) => state.cards[attachment]?.code === SECRET_CULTIST && state.cards[attachment]?.zone === "attached");
  return Object.keys(state.cards).filter((id) => converted(state, id, ctx) && !held(id)).reduce((next, id) => (inPlay(next.cards[id]?.zone ?? "removed") || next.cards[id]?.zone === "encounterDiscard" ? giveBack(next, id) : next), state);
}
