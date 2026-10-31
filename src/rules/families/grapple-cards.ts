// Rules: dcce.stormcaller-and-the-thing, dcce.stormcaller-elite, dcce.campaign-mode, dcce.campaign-setup-the-thing-in-the-depths, rr.search (data/rules/entries.json); ledger lines 12040:B:1, 12039:B:2,
// 12041:A:1, 12055:A:1, 11194:A:3. The verbs of the grapple family that move cards: the encounter cards a Grapple effect discards, the encounter set that is removed and the one that is shuffled in at stage 2,
// the Stormcaller Elite turning to its objective ally sides, the Campaign Mode only side, and the cards the campaign card gives.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../amounts.ts";
import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import { beginEnemyAttack } from "../combat.ts";
import { attackBarred } from "../constants.ts";
import { hasTrait } from "../conditions.ts";
import { dealOneShadow } from "../interpret.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { lastPicked, seatOf } from "../player-verbs.ts";
import { printedOf } from "../printed.ts";
import { queueEvent } from "../queue.ts";
import type { ScenarioState, ZoneName } from "../state.ts";
import { inPlay, updateCard } from "../state.ts";
import { moveCard } from "../zones.ts";
import { dealAttackShadow } from "./defense-listen.ts";
import { effectData, moveEncounter, setAsideNamed } from "./encounter-moves.ts";
import { resolveGrapple } from "./grapple-attach.ts";
import type { Focus } from "./index.ts";
import { queueFront } from "./play-refs.ts";
import { isElite } from "./sea-routes.ts";
import { lastPlayer } from "./sea-players.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// The zones an encounter card of the set can be in: the decks, the play areas (the staging area, the engagement areas, the active location, the cards grappled), and the shadow cards dealt to enemies.
const SET_ZONES: ReadonlySet<ZoneName> = new Set(["encounterDeck", "encounterDiscard", "staging", "engaged", "activeLocation", "secondActiveLocation", "grappled", "seatStaging", "stormcallerArea", "shadow"]);

/** DiscardTopGrapple and DiscardUntilGrapple: the cards go from the top of the encounter deck to its discard pile, face up, and each enemy the effect discarded resolves its Grapple keyword in turn. */
export function discardAndGrapple(state: ScenarioState, instruction: Verb<"DiscardTopGrapple"> | Verb<"DiscardUntilGrapple">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const count = resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
  const grapplers: string[] = [];
  let next = state;
  let counted = 0;
  while (counted < count) {
    const top = next.encounterDeck[0];
    if (!top) break;
    next = updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
    const printed = printedOf(ctx.cards, next.cards[top]?.code ?? "");
    if (instruction.verb === "DiscardTopGrapple") counted += 1;
    else if (printed.type === "enemy" && hasTrait(next, top, instruction.trait, ctx)) counted += 1;
    else continue;
    if (printed.keywords.grapple != null) grapplers.push(top);
  }
  const cause = currentCause(steps, UNATTRIBUTED);
  return queueFront(next, grapplers.map((card) => ({ instruction: { verb: "ResolveGrapple" as const, card }, seat: next.firstPlayer, chosen: null, cause })));
}

/** FlipSetAside: the set-aside card with this title shows its side B. */
export function flipSetAside(state: ScenarioState, instruction: Verb<"FlipSetAside">, ctx: ReduceContext): ScenarioState {
  const id = setAsideNamed(state, instruction.name, ctx);
  return id ? updateCard(state, id, { face: "B" }) : state;
}

/** FlipElite: the Stormcaller Elite card in play with this title (its enemy side) becomes the objective ally side, without tokens, in the play area of the first or the last player. It hears that it flipped. */
export function flipElite(state: ScenarioState, instruction: Verb<"FlipElite">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = Object.values(state.cards).find((other) => inPlay(other.zone) && isElite(printedOf(ctx.cards, other.code)) && printedOf(ctx.cards, other.code).type === "enemy" && printedOf(ctx.cards, other.code).name === instruction.name);
  const side = [...ctx.cards.values()].find((printed) => isElite(printed) && printed.type === "objective" && printed.name === instruction.name);
  if (!card || !side) return state;
  const seat = instruction.to === "lastPlayer" ? lastPlayer(state) : state.firstPlayer;
  const moved = moveCard(state, card.id, { zone: "play", seat });
  const flipped = updateCard(moved, card.id, { code: side.code, face: "up", damage: 0, progress: 0, resources: 0, exhausted: false, controller: seat });
  steps.push({ kind: "flip", cardId: card.id, seat });
  return queueEvent(flipped, { trigger: "flipped", seat, cardId: card.id, subject: card.id });
}

/** RemoveEncounterSet: every card of the encounter set in a deck, the discard pile or a play area (and the shadow cards it dealt) leaves the game; the cards attached to those in play are discarded. */
export function removeEncounterSet(state: ScenarioState, instruction: Verb<"RemoveEncounterSet">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  let count = 0;
  for (const card of Object.values(state.cards)) {
    if (!SET_ZONES.has(card.zone) || printedOf(ctx.cards, card.code).encounterSet !== instruction.set) continue;
    count += 1;
    next = inPlay(card.zone) ? moveEncounter(next, card.id, "removed", state.firstPlayer, ctx, steps) : moveCard(next, card.id, { zone: "removed" });
  }
  steps.push({ kind: "removeSet", set: instruction.set, count });
  return next;
}

/** ShuffleSetAsideSet: every set-aside card of the encounter set joins the encounter deck (the deck is shuffled by the step after it). A boon or burden of the set (Sea Serpent) is a card of the campaign, not of the set the scenario sets aside. */
export function shuffleSetAsideSet(state: ScenarioState, instruction: Verb<"ShuffleSetAsideSet">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  let count = 0;
  for (const id of state.setAside) {
    const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
    if (printed.encounterSet !== instruction.set || printed.campaignKind != null) continue;
    count += 1;
    next = moveEncounter(next, id, "shuffle", state.firstPlayer, ctx, steps);
  }
  steps.push({ kind: "shuffleSet", set: instruction.set, count });
  return next;
}

/** AddResourcesSetAside: the set-aside cards with these codes hold the resources until they enter play. */
export function addResourcesSetAside(state: ScenarioState, instruction: Verb<"AddResourcesSetAside">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  let next = state;
  for (const id of state.setAside) {
    const card = state.cards[id];
    if (card && amount > 0 && instruction.codes.includes(card.code)) next = updateCard(next, id, { resources: card.resources + amount });
  }
  return next;
}

/** AddSetAsideToHand: the set-aside card with this code joins the hand of the player last picked, and counts as a card the campaign card gave this game. */
export function addSetAsideToHand(state: ScenarioState, instruction: Verb<"AddSetAsideToHand">, focus: Focus): ScenarioState {
  const id = state.setAside.find((other) => state.cards[other]?.code === instruction.code);
  const seat = seatOf(lastPicked(state)) ?? focus.seat;
  if (!id || state.seats[seat]?.eliminated) return state;
  const added = updateCard(moveCard(state, id, { zone: "hand", seat }), id, { owner: seat, face: "up" });
  return { ...added, chosenAtSetup: [...(added.chosenAtSetup ?? []), { code: instruction.code, seat }] };
}

/** RemoveCodeFromGame: the card in play with this code leaves the game. */
export function removeCodeFromGame(state: ScenarioState, instruction: Verb<"RemoveCodeFromGame">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = Object.values(state.cards).find((other) => other.code === instruction.code && inPlay(other.zone));
  return card ? moveEncounter(state, card.id, "removed", state.firstPlayer, ctx, steps) : state;
}

/** EngageOrGrapple: the actor chooses, as the shadow effect resolves, for the shadow card that is an enemy; the choice is done once the attack is over: the card comes into play engaged with them and is dealt a shadow
 * card of its own, or it resolves its Grapple keyword. */
export function engageOrGrapple(state: ScenarioState, instruction: Verb<"EngageOrGrapple">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = instruction.card ?? focus.sourceId;
  const card = id ? state.cards[id] : undefined;
  if (!id || !card || printedOf(ctx.cards, card.code).type !== "enemy") return state;
  if (instruction.choice != null) {
    // The attack is over: the shadow card is still dealt, or already in the encounter discard pile.
    if (instruction.choice === "grapple") return resolveGrapple(state, { verb: "ResolveGrapple", card: id }, focus, ctx, steps);
    return dealOneShadow(moveEncounter(state, id, "engaged", focus.seat, ctx, steps), id, steps);
  }
  if (focus.chosen == null) return effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, ["engage", "grapple"]) : state;
  const attack = state.pendingAttack;
  if (!attack || (focus.chosen !== "engage" && focus.chosen !== "grapple")) return state;
  return { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), { verb: "EngageOrGrapple", card: id, choice: focus.chosen }], afterCause: attack.afterCause ?? currentCause(steps, UNATTRIBUTED) } };
}

/** AttackFirstPlayer: the source enemy attacks the first player now, from the staging area or while engaged with any player, as an attack outside the combat phase. */
export function attackFirstPlayer(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const enemy = id ? state.cards[id] : undefined;
  const seat = state.firstPlayer;
  if (!id || !enemy || (enemy.zone !== "staging" && enemy.zone !== "engaged") || attackBarred(state, id, seat) || state.seats[seat]?.eliminated) return state;
  const begun = beginEnemyAttack(dealAttackShadow(state, id, ctx, steps), seat, id, ctx, steps, enemy.zone === "staging");
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}

/** GainChosenTrait: the actor chooses a Trait printed on a card of the game that the last picked card lacks; it has the Trait until the end of the round. */
export function gainChosenTrait(state: ScenarioState, instruction: Verb<"GainChosenTrait">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  if (!state.cards[id]) return state;
  const traits = [...new Set([...ctx.cards.values()].flatMap((printed) => printed.traits))].filter((trait) => !hasTrait(state, id, trait, ctx)).sort();
  const chosen = focus.chosen && traits.includes(focus.chosen) ? focus.chosen : undefined;
  if (!chosen) return traits.length > 0 && effectData(state) ? askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, traits) : state;
  return { ...state, modifiers: [...state.modifiers, { instanceId: id, sourceId: focus.sourceId ?? id, stat: "traitGained", amount: 1, until: "endOfRound", trait: chosen }] };
}
