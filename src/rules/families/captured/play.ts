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
import { effectsOf } from "../../windows/listen.ts";
import { askTarget } from "../../windows/choices.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectData } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { attachHeroBoons } from "./rescue.ts";
import { captureCard } from "./pile.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// CapturePicked: the card picked before the last pick, an ally the actor controls in play, is captured underneath the card the last pick chose.
export function capturePicked(state: ScenarioState): ScenarioState {
  const picks = pickedList(state);
  const host = picks.at(-1);
  const ally = picks.at(-2);
  const card = ally ? state.cards[ally] : undefined;
  if (!host || !ally || host === ally || !card || card.zone !== "play" || !inPlay(state.cards[host]?.zone ?? "removed")) return state;
  return captureCard(state, ally, host);
}

// CaptureAttachments (a Shadow effect): each attachment a player owns on the defending character goes underneath the attacking enemy.
export function captureAttachments(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  const defender = attack ? state.cards[attack.defenderId ?? attack.heroId ?? ""] : undefined;
  if (!attack || !defender || !inPlay(state.cards[attack.enemyId]?.zone ?? "removed")) return state;
  return defender.attachments.reduce((next, id) => {
    const attachment = next.cards[id];
    return attachment && (attachment.owner ?? attachment.controller) != null ? captureCard(next, id, attack.enemyId) : next;
  }, state);
}

// CaptureInsteadOfDamage run as a Shadow effect: the attack in progress captures the ally it would damage.
export function capturingAttack(state: ScenarioState): ScenarioState {
  return state.pendingAttack ? { ...state, pendingAttack: { ...state.pendingAttack, captures: true } } : state;
}

// An enemy marked with CaptureInsteadOfDamage in its own record (Cruel Torturer) captures the allies its attacks would damage.
function markedToCapture(state: ScenarioState, enemyId: string, ctx: ReduceContext): boolean {
  const code = state.cards[enemyId]?.code;
  return code != null && effectsOf(ctx, code).some((effect) => effect.instructions.some((instruction) => instruction.verb === "CaptureInsteadOfDamage"));
}

// The damage step of an attack (defense/excess.ts combatDamage): an ally the attack would damage is captured underneath the attacking enemy instead, whatever the damage, a lethal blow included; nothing is dealt, so nothing is destroyed (rr.replacement-effects). Null when
// it does not apply: no damage, a hero, or an attack that does not capture.
export function captureInstead(state: ScenarioState, enemyId: string, assigned: string, raw: number, ctx: ReduceContext): ScenarioState | null {
  if (!state.capture || raw <= 0) return null;
  const ally = state.cards[assigned];
  if (!ally || ally.zone !== "play" || printedOf(ctx.cards, ally.code).type !== "ally") return null;
  if (state.pendingAttack?.captures !== true && !markedToCapture(state, enemyId, ctx)) return null;
  return captureCard(state, assigned, enemyId);
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
  const owner = card?.owner;
  if (!card || owner == null || state.seats[owner]?.eliminated) return false;
  const type = printedOf(ctx.cards, card.code).type;
  if (type === "ally" || type === "hero") return true;
  return type === "attachment" && attachmentHostIds(state, owner, card.code, ctx).length > 0;
}

// PutCapturedIntoPlay: the last card picked goes into play at no cost under its owner. An attachment goes on a hero (or character) of its owner: the owner chooses when there are several.
export function putCapturedIntoPlay(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[], instruction: Verb<"PutCapturedIntoPlay">): ScenarioState {
  const id = lastPicked(state);
  const card = state.cards[id];
  const owner = card?.owner;
  if (!card || owner == null || card.zone === "play" || card.zone === "heroes" || !playable(state, id, ctx)) return state;
  const type = printedOf(ctx.cards, card.code).type;
  if (type === "hero" || card.heroSlot != null) {
    const entered = updateCard(moveCard(state, id, { zone: "heroes", seat: owner }), id, { face: "up", heroSlot: undefined });
    return queueEvent(attachHeroBoons(entered, id), { trigger: "heroEnteredPlay", seat: owner, cardId: id });
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
