// Rules: docs/scenarios/standalone-scenarios.md (Murder at the Prancing Pony, readings 1, 7 and 12), rr.in-play-and-out-of-play; ledger lines 50701:A:1, 50702:B:1, 50728:A:1, 50728:A:2. The Investigation deck (core/piles.ts, the named pile `investigation`): built by the Setup, a card removed from it unseen, a card shuffled into it.
// Hidden information: no EngineStep and no log line names a card of the deck or the Suspect and Hideout set aside facedown, so these functions push no step. Only a look window (look.ts) shows cards.
import type { Instruction } from "../../../catalog/boundary.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";

import { pileOf, shufflePile } from "../../core/piles.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import type { Focus } from "../index.ts";

const DECK = "investigationDeck" as const;

/** The set-aside cards with one of these codes, in id order, so one seed always rolls the same cards. */
function setAsideWith(state: ScenarioState, codes: readonly string[]): string[] {
  return state.setAside.filter((id) => codes.includes(state.cards[id]?.code ?? "")).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

/**
 * HideSuspectAndHideout: of the set-aside Suspects one is picked with the game's seed, then of the set-aside Hideouts one; both stay set aside facedown. The other Suspects and Hideouts go into the Investigation deck (facedown, not yet shuffled: BuildInvestigationDeck
 * adds Taken by Surprise and shuffles). The seed is rolled for each kind in turn, so one seed always hides the same pair.
 */
export function hideSuspectAndHideout(state: ScenarioState, instruction: Extract<Instruction, { verb: "HideSuspectAndHideout" }>): ScenarioState {
  let next = state;
  for (const codes of [instruction.suspects, instruction.hideouts]) {
    const set = setAsideWith(next, codes);
    if (set.length === 0) continue;
    const rolled = shuffleIds(set, next.seed, next.seedCursor);
    next = { ...next, seedCursor: rolled.cursor };
    for (const id of set) next = id === rolled.ids[0] ? updateCard(next, id, { face: "down", controller: null }) : updateCard(moveCard(next, id, { zone: DECK }), id, { face: "down", controller: null });
  }
  return next;
}

/** BuildInvestigationDeck: the set-aside cards with these codes (Taken by Surprise) join the Investigation deck facedown, and the deck is shuffled with the game's seed. */
export function buildInvestigationDeck(state: ScenarioState, instruction: Extract<Instruction, { verb: "BuildInvestigationDeck" }>): ScenarioState {
  let next = state;
  for (const id of setAsideWith(state, instruction.codes)) next = updateCard(moveCard(next, id, { zone: DECK }), id, { face: "down", controller: null });
  return shufflePile(next, DECK);
}

/** RemoveRandomInvestigation: the game's seed picks a card of the deck, which leaves the game unseen (no step, so no line names it). An empty deck changes nothing. */
export function removeRandomInvestigation(state: ScenarioState): ScenarioState {
  const pile = pileOf(state, DECK);
  if (pile.length === 0) return state;
  const rolled = shuffleIds(pile, state.seed, state.seedCursor);
  const id = rolled.ids[0];
  if (id === undefined) return state;
  return moveCard({ ...state, seedCursor: rolled.cursor }, id, { zone: "removed" });
}

/** ShuffleSelfIntoInvestigation: the source card (a revealed treachery in the staging area, or a shadow card) joins the deck facedown, and the deck is shuffled. */
export function shuffleSelfIntoInvestigation(state: ScenarioState, instruction: Extract<Instruction, { verb: "ShuffleSelfIntoInvestigation" }>, focus: Focus, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  // A shadow card that shuffles itself in only if the attack destroys a character: the shuffle waits for the end of the attack, as AfterAttack does (the source is then the attacking enemy, so the card is named).
  if (instruction.ifDestroyed && instruction.card == null) {
    if (!attack || !focus.sourceId) return state;
    const later: Instruction = { verb: "ShuffleSelfIntoInvestigation", card: focus.sourceId, when: { kind: "x", min: 1 } };
    return { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), later], afterCause: currentCause(steps, UNATTRIBUTED) } };
  }
  const id = instruction.card ?? focus.sourceId;
  if (!id || !state.cards[id]) return state;
  return shufflePile(updateCard(moveCard(state, id, { zone: DECK }), id, { face: "down", controller: null }), DECK);
}
