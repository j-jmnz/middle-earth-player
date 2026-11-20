// Rules: mec108.captured-cards, rr.replacement-effects, rr.first-player, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 10041:A:1, 10043:A:2, 10044:A:2, 10046:A:2, 10048:A:3, 10051:A:1, 10051:A:2, 10174:B:2.
//
// What is done with captured cards in play: an ally captured from play (Captives of Gornákh), the attachments of the defending character captured by an attack (Tunnels' Shadow), an ally captured instead of damaged (Cruel Torturer, Captives' Shadow), a captured card
// put into play at no cost (Dungeon Guard, Prison Cell) and the enemy that engages a player by its own text (Jailor Gornákh).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import { printedOf } from "../../core/printed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { moveCard, attachTo } from "../../core/zones.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { frameScope, refCard } from "../../interpret/amounts.ts";
import { lastPicked, pickedList, seatOf } from "../../interpret/player-verbs.ts";
import { attachmentHostIds } from "../../player/attach.ts";
import { askTarget } from "../../windows/choices.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { attachHeroBoons } from "./rescue.ts";
import { captureAlly, captureCard } from "./pile.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// CapturePicked: the card picked before the last pick, an ally the actor controls in play, is captured underneath the card the last pick chose; the picks of another player's turn captured nothing here.
export function capturePicked(state: ScenarioState, focus: Focus): ScenarioState {
  const picks = pickedList(state);
  const host = picks.at(-1);
  const ally = picks.at(-2);
  const card = ally ? state.cards[ally] : undefined;
  // The ally is the acting player's own: a player with no ally picked none, and the picks of the player before are not theirs to capture.
  if (!host || !ally || host === ally || !card || card.zone !== "play" || card.controller !== focus.seat || !inPlay(state.cards[host]?.zone ?? "removed")) return state;
  return captureAlly(state, ally, host);
}

// CaptureAttachments (a Shadow effect): each attachment on the defending character goes underneath the attacking enemy, an encounter attachment too (the card says "each attachment"; it is rescued to the encounter discard pile).
export function captureAttachments(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  const defender = attack ? state.cards[attack.defenderId ?? attack.heroId ?? ""] : undefined;
  if (!attack || !defender || !inPlay(state.cards[attack.enemyId]?.zone ?? "removed")) return state;
  return defender.attachments.reduce((next, id) => {
    return next.cards[id] ? captureCard(next, id, attack.enemyId) : next;
  }, state);
}

// CaptureInsteadOfDamage run as a Shadow effect: the attack in progress captures the ally it would damage.
export function capturingAttack(state: ScenarioState): ScenarioState {
  return state.pendingAttack ? { ...state, pendingAttack: { ...state.pendingAttack, captures: true } } : state;
}

// EngageSelfWithPicked: the source enemy engages the picked player; one already engaged with that player stays.
export function engageSelfWithPicked(state: ScenarioState, focus: Focus): ScenarioState {
  const seat = seatOf(lastPicked(state));
  const enemy = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (seat == null || !enemy || !state.seats[seat] || state.seats[seat]?.eliminated || !inPlay(enemy.zone)) return state;
  if (enemy.zone === "engaged" && enemy.controller === seat) return state;
  return queueEvent(updateCard(moveCard(state, enemy.id, { zone: "engaged", seat }), enemy.id, { controller: seat }), { trigger: "engaged", seat, subject: enemy.id });
}

// Whether a captured card can be put into play: an ally or a hero, or an attachment its owner has a host for.
export function playable(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  // A card rescued into a hand has no captured owner any more: its player controls it (mec108.captured-cards).
  const owner = card?.owner ?? card?.controller ?? undefined;
  if (!card || owner == null || state.seats[owner]?.eliminated) return false;
  const type = printedOf(ctx.cards, card.code).type;
  if (type === "ally" || type === "hero") return true;
  return type === "attachment" && attachmentHostIds(state, owner, card.code, ctx).length > 0;
}

// PutCapturedIntoPlay: the last card picked goes into play at no cost under its owner. An attachment goes on a hero (or character) of its owner: the owner chooses when there are several.
export function putCapturedIntoPlay(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[], instruction: Verb<"PutCapturedIntoPlay">): ScenarioState {
  const id = lastPicked(state);
  const card = state.cards[id];
  const owner = card?.owner ?? card?.controller ?? undefined;
  if (!card || owner == null || card.zone === "play" || card.zone === "heroes" || !playable(state, id, ctx)) return state;
  const type = printedOf(ctx.cards, card.code).type;
  if (type === "hero" || card.heroSlot != null) {
    const entered = updateCard(moveCard(state, id, { zone: "heroes", seat: owner }), id, { face: "up", heroSlot: undefined });
    return queueEvent(entered, { trigger: "heroEnteredPlay", seat: owner, cardId: id });
  }
  if (type === "ally") {
    const entered = updateCard(moveCard(state, id, { zone: "play", seat: owner }), id, { face: "up" });
    return queueEvent(entered, { trigger: "enteredPlay", seat: owner, cardId: id });
  }
  const hosts = attachmentHostIds(state, owner, card.code, ctx);
  const host = hosts.length === 1 ? hosts[0] : focus.chosen != null && hosts.includes(focus.chosen) ? focus.chosen : undefined;
  if (!host) {
    if (!effectData(state)) return { ...state, failure: "Choosing the host of a captured card needs a choice, and no effect is asking" };
    return askTarget(state, { instruction, seat: owner, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, hosts);
  }
  const hostCard = state.cards[host];
  const placed = attachTo(updateCard(moveCard(state, id, { zone: "attached" }), id, { face: "up", controller: hostCard?.controller ?? owner }), id, host);
  return queueEvent(placed, { trigger: "enteredPlay", seat: owner, cardId: id });
}

// AttachHeroBoons: the hero the answered event is about gets its set-aside permanent boons back.
export function attachBoonsOfSubject(state: ScenarioState, focus: Focus): ScenarioState {
  const hero = refCard(state, "subject", frameScope(state, focus.seat, focus.sourceId));
  return hero ? attachHeroBoons(state, hero) : state;
}
