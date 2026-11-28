// Rules: emce.caves-deck, emce.deep, emce.guarded-x, emce.treasure, emce.campaign-pool-encounter, rr.search, rr.then (data/rules/entries.json); ledger lines 12170:A:2, 12172:A:1, 18045:A:2, 18043:A:3, 18048:A:1, 18050:A:2, 18055:A:2, 18078:A:1, 18079:A:1, 18079:B:2, 18080:A:1, 18080:B:2.
// The verbs The King's Quest adds to the wilderland family: the card placed with resources on it, the search that stops at two card types, the Caves deck looked at and rearranged, a card sent to its bottom, the questing hero a Condition
// attaches to, the Dragon treachery searched for, the Artifact the Dragon Hoard guards, the card Hobgoblin holds, and the player attack that is canceled.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { gameReads } from "../../core/game-reads.ts";
import type { EngineStep } from "../../core/intents.ts";
import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { attachBlocked } from "../../interpret/restrictions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { NAMED_PILES, pileDealt, pileOf, withPile } from "../../core/piles.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { runSetupVerb } from "../../setup/verbs.ts";
import { askTarget } from "../../windows/choices.ts";
import { guardWith } from "../objectives/guard.ts";
import { discardUntilType } from "../encounter/discard-until.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AddToStagingWithResources: the card enters the staging area (a copy the Setup search found is placed, as AddToStaging places it) and holds `amount` resource tokens. */
export function addToStagingWithResources(state: ScenarioState, instruction: Verb<"AddToStagingWithResources">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const known = new Set(state.staging);
  const placed = runSetupVerb(state, { verb: "AddToStaging", code: instruction.code }, ctx, focus.sourceId);
  const id = placed.staging.find((candidate) => !known.has(candidate));
  const amount = resolveAmount(placed, instruction.amount, frameScope(placed, focus.seat, focus.sourceId), ctx);
  const card = id ? placed.cards[id] : undefined;
  return card && amount > 0 ? updateCard(placed, card.id, { resources: card.resources + amount }) : placed;
}

/** ArrangeCaves: the player who triggered the Response (neither line names the first player) looks at the top `count` cards of the Caves deck and chooses the one that stays on top; the others go to the bottom, in their order. Run where no player can be asked, the first stays. */
export function arrangeCaves(state: ScenarioState, instruction: Verb<"ArrangeCaves">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const zone = NAMED_PILES.caves.deck;
  const deck = pileOf(state, zone);
  const looked = deck.slice(0, instruction.count);
  if (looked.length < 2) return state;
  if (focus.chosen == null && effectData(state)) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, looked);
  const top = focus.chosen != null && looked.includes(focus.chosen) ? focus.chosen : (looked[0] ?? "");
  return withPile(state, zone, [top, ...deck.slice(instruction.count), ...looked.filter((id) => id !== top)]);
}

/** PutOnPileBottom: the card with the code, set aside or in the encounter deck, joins the bottom of the pile, facedown. */
export function putOnPileBottom(state: ScenarioState, instruction: Verb<"PutOnPileBottom">): ScenarioState {
  const zone = NAMED_PILES[instruction.pile].deck;
  const id = [...state.setAside, ...state.encounterDeck].find((candidate) => state.cards[candidate]?.code === instruction.code);
  if (!id || !pileDealt(state, zone)) return state;
  return updateCard(moveCard(state, id, { zone }), id, { face: "down", controller: null });
}

/** AttachSelfToPicked: the source attaches to the last picked card, unless that card already carries one of its title ("Limit 1 per hero"): it attaches nowhere (`unlimited`: a card with no limit attaches whatever the host carries). */
export function attachSelfToPicked(state: ScenarioState, instruction: Verb<"AttachSelfToPicked">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const host = lastPicked(state);
  const code = focus.sourceId ? state.cards[focus.sourceId]?.code : undefined;
  if (!focus.sourceId || !host || !state.cards[host]) return state;
  if (instruction.unlimited !== true && state.cards[host].attachments.some((other) => state.cards[other]?.code === code)) return state;
  // A host that cannot have attachments takes none ("Cannot have attachments", 50709:A:1 to 50713:A:1).
  if (code != null && attachBlocked(state, ctx, host, code)) return state;
  return attachSelf(state, focus.sourceId, host, ctx);
}

/** AttachSearched: the first player chooses among the cards of the type and trait in the encounter deck and discard pile (one of each title) that the enemy named `to` does not carry; it attaches to that enemy in play. */
export function attachSearched(state: ScenarioState, instruction: Verb<"AttachSearched">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The host is the source when it is in play and bears the title (two copies of the enemy in play: the one whose line runs, 21018:A:3); else the first card in play with the title (a stage names its enemy, 18080:A:1).
  const inPlayTitled = (card: ScenarioState["cards"][string]): boolean => (card.zone === "staging" || card.zone === "engaged") && printedOf(ctx.cards, card.code).name === instruction.to;
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  const host = source && inPlayTitled(source) ? source : Object.values(state.cards).find(inPlayTitled);
  if (!host) return state;
  const carried = new Set(host.attachments.map((id) => state.cards[id]?.code));
  const titles = new Set<string>();
  const candidates = [...state.encounterDeck, ...state.encounterDiscard].filter((id) => {
    const card = state.cards[id];
    const printed = card ? printedOf(ctx.cards, card.code) : null;
    if (!card || !printed || printed.type !== instruction.type || !printed.traits.includes(instruction.trait) || (instruction.name != null && printed.name !== instruction.name) || carried.has(card.code) || titles.has(printed.name)) return false;
    titles.add(printed.name);
    return true;
  });
  if (candidates.length === 0) return state;
  if (focus.chosen == null && candidates.length > 1 && effectData(state)) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, candidates);
  const chosen = focus.chosen != null && candidates.includes(focus.chosen) ? focus.chosen : candidates[0];
  return chosen ? attachSelf(state, chosen, host.id, ctx) : state;
}

/**
 * GuardPickedAttachment: the card the last pick took from a hand lies faceup in the staging area, guarded by the first card of the encounter deck of one of the types (discarded, added to the staging area, attached to it). The settle sweep
 * (mirkwood.ts freeTreasures) claims it once nothing guards it, as it claims a treasure. The record that set it up is remembered on the card. With no card of the types it is free at once.
 */
export function guardPickedAttachment(state: ScenarioState, instruction: Verb<"GuardPickedAttachment">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || card.zone !== "hand") return state;
  const owner = card.controller ?? focus.seat;
  const cause = currentCause(steps, UNATTRIBUTED);
  const staged = updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up", controller: null, owner, ...("effect" in cause ? { setUpBy: cause.effect } : {}) });
  const searched = discardUntilType(staged, instruction.types, ctx);
  if (searched.found == null) return staged;
  const found = searched.found;
  return guardWith(updateCard(moveCard(searched.state, found, { zone: "staging" }), found, { face: "up", controller: null }), found, id);
}

/** GuardWithDeckTop: the first player's top deck card lies faceup under the source, which guards it; with `discards` it is discarded, not returned to the hand, when the source leaves play (51351:A:1). */
export function guardWithDeckTop(state: ScenarioState, focus: Focus, discards = false): ScenarioState {
  const source = focus.sourceId;
  const seat = state.firstPlayer;
  const top = state.seats[seat]?.deck[0];
  if (!source || !top || !state.cards[source]) return state;
  return updateCard(moveCard(state, top, { zone: "under", locationId: source }), top, { face: "up", owner: seat, controller: null, held: true, ...(discards ? { heldDiscard: true as const } : {}) });
}

/**
 * The settle sweep for ReturnGuardedToHand ("When Hobgoblin leaves play, return the card it was guarding to its owner's hand"): a card held under an enemy that is no longer in play returns to its owner's hand. Only a game whose records hold a card
 * (a card of the game has a record with GuardWithDeckTop, or GuardWithSetAside for the boons Shagrat guards, 146069:B:1) looks.
 */
export function returnHeld(state: ScenarioState, ctx: ReduceContext): ScenarioState {
  if (!gameReads(state, ctx, '"GuardWithDeckTop"') && !gameReads(state, ctx, '"GuardWithSetAside"')) return state;
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.held !== true) continue;
    // The holder leaving play sends the card under it to its owner's discard pile (moveCard); a holder out of play with the card still under it is read the same.
    const host = card.zone === "under" && card.host ? state.cards[card.host] : undefined;
    if (card.zone === "under" && host && inPlay(host.zone)) continue;
    // A card the holder discards (`discards`): it goes to its owner's discard pile once the holder is out of play, and is held no more.
    if (card.heldDiscard === true) {
      const seat = card.owner ?? card.controller ?? -1;
      const released = card.zone === "under" && seat >= 0 ? moveCard(next, card.id, { zone: "discard", seat }) : next;
      next = updateCard(released, card.id, { owner: undefined, face: "up", held: undefined, heldDiscard: undefined });
      continue;
    }
    const owner = card.zone === "discard" ? state.seats.findIndex((seat) => seat.discard.includes(card.id)) : (card.owner ?? card.controller ?? -1);
    // A boon guarded on Shagrat lands in the encounter discard pile when he leaves play (nobody controls it); its owner is kept on it.
    if (owner >= 0 && (card.zone === "discard" || card.zone === "under" || card.zone === "encounterDiscard")) next = updateCard(moveCard(next, card.id, { zone: "hand", seat: owner }), card.id, { owner: undefined, face: "up", held: undefined });
  }
  return next;
}

/** CancelStrike: the player attack in progress deals no damage. */
export function cancelStrike(state: ScenarioState): ScenarioState {
  return state.pendingStrike ? { ...state, pendingStrike: { ...state.pendingStrike, canceled: true } } : state;
}

/** ShuffleIntoPile with `placed`: the campaign card brings a copy the game does not hold into the dealt pile (the pile is shuffled by the caller). */
export function spawnIntoPile(state: ScenarioState, code: string, pile: keyof typeof NAMED_PILES): ScenarioState {
  const zone = NAMED_PILES[pile].deck;
  if (!pileDealt(state, zone)) return state;
  const spawned = spawn(state, code, { zone }, "down");
  return updateCard(spawned.state, spawned.id, { controller: null });
}
