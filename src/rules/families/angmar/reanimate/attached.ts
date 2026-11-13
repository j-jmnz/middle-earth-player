// Rules: rr.attachment-cards, rr.destroy, rr.first-player, rr.removed-from-game (data/rules/entries.json); ledger lines 101157:A:1, 101162:A:2.
// Two cards of The Dread Realm that change what they are while they lie on another card: the Wraith of Carn Dûm, an enemy that attaches itself to a character instead of staying out of play and returns to the staging area as an enemy when that character leaves play, and Possession, which
// destroys the dearest ally and takes the card it is attached to with it when it is discarded.
import type { Instruction } from "../../../../catalog/boundary.ts";

import type { EngineStep } from "../../../core/intents.ts";
import { destroyCard } from "../../../core/keywords.ts";
import { printedOf } from "../../../core/printed.ts";
import { flagged, inPlay, updateCard, type CardInstance, type ScenarioState } from "../../../core/state.ts";
import { moveCard, type Destination } from "../../../core/zones.ts";
import { queueEvent } from "../../../windows/queue.ts";
import { frameScope, refCard } from "../../../interpret/amounts.ts";
import { attachSelf } from "../../../interpret/effect-targeted.ts";
import type { ReduceContext } from "../../../interpret/interpret.ts";
import { askTarget } from "../../../windows/choices.ts";
import { currentCause, UNATTRIBUTED } from "../../../core/cause.ts";
import { lastPicked } from "../../../interpret/player-verbs.ts";
import { effectData, pushPicked } from "../../encounter/moves.ts";
import { patchTop } from "../../../windows/windows.ts";
import { stagingDest } from "../../breaking/areas.ts";
import type { Focus } from "../../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AttachEnemyToPicked: the source, an enemy that has left play, attaches to the card the effect picked last as an attachment (`asAttachment`): it has no enemy text while it lies there, and returns to the staging area as an enemy when its host leaves play ("attach it to a character in play", 101157:A:1). Nothing happens with no card picked. */
export function attachEnemyToPicked(state: ScenarioState, focus: Focus, ctx: ReduceContext): ScenarioState {
  const host = lastPicked(state);
  if (!focus.sourceId || !host || !state.cards[host] || !state.cards[focus.sourceId]) return state;
  return updateCard(attachSelf(state, focus.sourceId, host, ctx), focus.sourceId, { asAttachment: true });
}

/** An enemy lying on its host as an attachment (`asAttachment`: the Wraith of Carn Dûm) goes back to the staging area as an enemy when the host leaves play ("return Wraith of Carn Dûm to the staging area as an enemy", 101157:A:1): detached from the host, faceup, uncontrolled. Its tokens are left as they lie (an attachment holds none). Null when the card is no such attachment, so the caller releases it as any other. */
export function returnAttachedEnemy(state: ScenarioState, id: string): ScenarioState | null {
  if (state.cards[id]?.asAttachment !== true) return null;
  const moved = moveCard(state, id, stagingDest(state, state.firstPlayer));
  return updateCard(moved, id, { asAttachment: undefined, face: "up", controller: null, host: null });
}

/** A card that leaves its role as an attachment, called as `moveCard` moves it (`current` is the card as it was, `dest` where it goes): an enemy lying as an attachment (Wraith of Carn Dûm) is no attachment once it leaves that role, and an attachment that takes its host with it (Possession, the flag `discardsHost`) leaves any way but the game's own removal, so its host's card hears it and is discarded (rr.removed-from-game). */
export function attachmentLeaves(state: ScenarioState, id: string, current: CardInstance, dest: Destination): ScenarioState {
  let next = state;
  if (current.asAttachment === true && dest.zone !== "attached") next = updateCard(next, id, { asAttachment: undefined });
  if (current.zone === "attached" && current.host != null && dest.zone !== "removed" && dest.zone !== "attached" && flagged(next, id, "discardsHost")) {
    next = queueEvent(next, { trigger: "attachmentLeft", seat: null, cardId: id, subject: id, other: current.host });
  }
  return next;
}

/** DestroyHighestCostAlly: the ally with the highest printed cost among every player's allies in play (a card with no printed cost or an X counts 0) is destroyed; the first player chooses among allies that tie. It becomes the effect's last picked card, in its owner's discard pile; with no ally in play nothing is picked ("Destroy the highest cost ally in play", 101162:A:2). */
export function destroyHighestCostAlly(state: ScenarioState, _instruction: Verb<"DestroyHighestCostAlly">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const costOf = (id: string): number => printedOf(ctx.cards, state.cards[id]?.code ?? "").cost ?? 0;
  const allies = Object.values(state.cards).filter((card) => card.zone === "play" && printedOf(ctx.cards, card.code).type === "ally" && card.host == null).map((card) => card.id);
  const most = Math.max(...allies.map(costOf));
  const tied = allies.filter((id) => costOf(id) === most);
  const chosen = focus.chosen != null && tied.includes(focus.chosen) ? focus.chosen : tied.length === 1 ? tied[0] : undefined;
  if (tied.length === 0) return pushPicked(state, null);
  if (!chosen) return askTarget(state, { instruction: { verb: "DestroyHighestCostAlly" }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, tied);
  const controller = state.cards[chosen]?.controller;
  const destroyed = pushPicked(destroyCard(state, chosen, ctx.cards, steps), chosen);
  const data = effectData(destroyed);
  return data && controller != null ? patchTop(destroyed, { data: { ...data, destroyedController: controller } }) : destroyed;
}

/** DiscardOtherInPlay: the card the answered event names as its other card is discarded when it is still in play ("If Possession is discarded, the attached card is also discarded", 101162:A:2: the event `attachmentLeft` names the card Possession lay on). A card that left play already is left alone. */
export function discardOtherInPlay(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = refCard(state, "other", frameScope(state, focus.seat, focus.sourceId));
  const card = id ? state.cards[id] : undefined;
  return id && card && inPlay(card.zone) ? destroyCard(state, id, ctx.cards, steps) : state;
}

/** RemovePickedFromGame: the card the effect picked last leaves the game, wherever it lies in play; it is neither discarded nor lost from the Campaign Pool (rr.removed-from-game). */
export function removePickedFromGame(state: ScenarioState): ScenarioState {
  const id = lastPicked(state);
  return id && state.cards[id] && state.cards[id].zone !== "removed" ? moveCard(state, id, { zone: "removed" }) : state;
}
