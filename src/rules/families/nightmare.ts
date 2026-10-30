// Rules: mec109.hide-tests, mec109.hide-x, rr.attachment-cards, rr.search, rr.discard-pile-and-victory-display, rr.forced,
// rr.quest-advancement (data/rules/entries.json); ledger lines 906101:A:2, 906102:A:3, 906106:A:1, 906107:A:2, 906108:A:1.
import type { Effect, Instruction } from "../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../cause.ts";
import { beginEnemyAttack } from "../combat.ts";
import { hasTrait } from "../conditions.ts";
import { attackBarred } from "../constants.ts";
import { effectsOf } from "../listen.ts";
import { dealAttackShadow } from "./defense-listen.ts";
import { dealForAttack } from "./south-watcher.ts";
import type { EngineStep } from "../intents.ts";
import { runEffect, type ReduceContext } from "../interpret.ts";
import { printedOf } from "../printed.ts";
import type { GameEvent, HideResult, ResponseOffer, ScenarioState } from "../state.ts";
import { inPlay, modifierActive, updateCard } from "../state.ts";
import { fireForced } from "../triggers.ts";
import { patchTop, topFrame, withFrame } from "../windows.ts";
import { attachTo, moveCard } from "../zones.ts";
import type { Focus } from "./index.ts";

// The verbs src/catalog/families/nightmare.ts adds, for the Nightmare decks. The Hide commit limit, the result of an effect's Hide
// test and the stage reveal are read where they apply (rules/hide.ts, rules/conditions.ts, rules/stage-reveal.ts). Null when the verb
// is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "AttachToQuest":
      return attachToQuest(state, focus);
    case "SearchToStaging":
      return searchToStaging(state, instruction.code, ctx);
    case "AttackActor":
      return attackActor(state, focus, ctx, steps);
    case "AttachToDamagedDefender":
      return instruction.card && instruction.to ? attachIfDamaged(state, instruction.card, instruction.to) : leaveForEnd(state, focus, steps);
    case "NotCanceledBy":
      return state;
    default:
      return null;
  }
}

// The source treachery goes onto the current quest card, faceup. It is discarded with that stage when the quest advances (quest.ts
// advanceStage releases a defeated stage's attachments, rr.attachment-cards).
function attachToQuest(state: ScenarioState, focus: Focus): ScenarioState {
  const source = focus.sourceId;
  const quest = state.questStage;
  if (!source || !quest || !state.cards[source] || !state.cards[quest]) return state;
  return updateCard(attachTo(moveCard(state, source, { zone: "attached" }), source, quest), source, { face: "up", controller: null });
}

// The first copy of the card's title found in the encounter deck, its discard pile or the victory display, in that order (rr.search),
// joins the staging area faceup, not revealed.
function searchToStaging(state: ScenarioState, code: string, ctx: ReduceContext): ScenarioState {
  const title = printedOf(ctx.cards, code).name;
  const found = [...state.encounterDeck, ...state.encounterDiscard, ...state.victory].find((id) => {
    const instance = state.cards[id];
    return instance != null && printedOf(ctx.cards, instance.code).name === title;
  });
  if (!found) return state;
  return updateCard(moveCard(state, found, { zone: "staging" }), found, { face: "up", controller: null, damage: 0, progress: 0, resources: 0 });
}

// The most characters a player may commit to a Hide test now (the smallest `hideCommitLimit` the table holds), or null with no limit.
export function hideCommitLimit(state: ScenarioState): number | null {
  let limit: number | null = null;
  for (const modifier of state.modifiers) {
    if (modifier.stat !== "hideCommitLimit" || modifier.instanceId !== "table" || !modifierActive(state, modifier)) continue;
    limit = limit == null ? modifier.amount : Math.min(limit, modifier.amount);
  }
  return limit;
}

// A Hide test made by an effect (HideTest) leaves its result on that effect's frame, for `lastHideFailed`.
export function noteEffectHide(state: ScenarioState, result: HideResult | null): ScenarioState {
  const top = topFrame(state);
  if (top?.data.kind !== "effect" || !result) return state;
  return patchTop(state, { data: { ...top.data, hideFailed: !result.success } });
}

// The `lastHideFailed` condition: the running effect's last Hide test failed.
export function lastHideFailed(state: ScenarioState): boolean {
  const data = topFrame(state)?.data;
  return data?.kind === "effect" && data.hideFailed === true;
}

// A quest card became the current stage (afterProgress, rules/stage-reveal.ts): Forced effects that listen for it resolve
// ("Forced: When stage 3A is revealed", 906101:A:2). The event is about no card, so the setup card next to the quest deck hears it; its
// `subject` names the stage.
export function announceStageRevealed(state: ScenarioState, stageId: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!ctx.effects.some((effect) => effect.trigger === "stageRevealed")) return state;
  return fireForced(state, { trigger: "stageRevealed", seat: null, subject: stageId }, ctx, steps);
}

// On Nightmare the setup card's recipe can replace a scenario card by a Nightmare card of the same title (Weathertop 141046 by 906204,
// Ford of Bruinen 141059 by 906303; docs/plans/nightmare-mode.md). A record that names the standard card by code ("Add Weathertop to
// the staging area", 141027:A:1) means the card of that title the game dealt: with no card of the named code in the game, the code of a
// dealt card with the same printed title stands in for it. Off Nightmare, or when the named card is dealt, the code is kept.
export function twinCode(state: ScenarioState, code: string, cards: ReduceContext["cards"]): string {
  const all = Object.values(state.cards);
  // On Nightmare only: the setup card is in play next to the quest deck (rules/setup.ts).
  if (!all.some((card) => card.zone === "nightmare")) return code;
  if (all.some((card) => card.code === code)) return code;
  const title = cards.get(code)?.name;
  if (title == null) return code;
  return all.find((card) => card.code !== code && cards.get(card.code)?.name === title)?.code ?? code;
}

// An instruction or condition with a `code` field, read with that code's Nightmare twin.
export function withTwin<T extends object>(state: ScenarioState, named: T, cards: ReduceContext["cards"]): T {
  if (!("code" in named) || typeof named.code !== "string") return named;
  const code = twinCode(state, named.code, cards);
  return code === named.code ? named : { ...named, code };
}

// The setup card's own Setup lines (906401:A:2, "Setup: Set each copy of Pale-green Tentacle aside, out of play") resolve once the piles are
// dealt and the encounter cards' Setup has run, before the first quest card's Setup (setup.ts finishSetup; mec109.setup, rr.setup): the
// recipe is applied before the quest's Setup (docs/plans/nightmare-mode.md). The setup card stays where it is, next to the quest deck.
export function nightmareSetup(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  let next = state;
  for (const card of Object.values(state.cards)) {
    if (card.zone !== "nightmare") continue;
    for (const effect of ctx.effects) {
      if (effect.cardCode !== card.code || effect.timing !== "setup") continue;
      next = withFrame(next, "setup", card.id, false, (framed) => runEffect(framed, effect, card.id, next.firstPlayer, ctx, steps), steps);
      if (next.failure || next.lost) return next;
    }
  }
  return next;
}

// AttackActor: the source enemy attacks the actor now, from the staging area or while engaged with them (906203:A:1). It is dealt a shadow
// card of its own, as an attack outside the combat phase is (faq.enemy-attacks-outside-combat).
function attackActor(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = focus.sourceId;
  const enemy = id ? state.cards[id] : undefined;
  if (!id || !enemy || state.seats[focus.seat]?.eliminated || attackBarred(state, id, focus.seat)) return state;
  const staged = enemy.zone === "staging";
  if (!staged && !(enemy.zone === "engaged" && enemy.controller === focus.seat)) return state;
  const dealt = staged ? dealForAttack(state, id) : dealAttackShadow(state, id, ctx);
  const begun = beginEnemyAttack(dealt, focus.seat, id, ctx, steps, staged);
  return begun.pendingAttack ? { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } } : begun;
}

// The shadow effect leaves the attach for the end of the attack, naming the shadow card and the defender declared now. The attack keeps the
// damage it deals to the defender (`dealt`, families/defense-excess.ts) for it.
function leaveForEnd(state: ScenarioState, focus: Focus, steps: EngineStep[]): ScenarioState {
  const attack = state.pendingAttack;
  if (!attack || !focus.sourceId || !attack.defenderId || attack.undefended) return state;
  const later: Instruction = { verb: "AttachToDamagedDefender", card: focus.sourceId, to: attack.defenderId, dealt: true };
  return { ...state, pendingAttack: { ...attack, after: [...(attack.after ?? []), later], afterCause: currentCause(steps, UNATTRIBUTED) } };
}

// At the end of the attack (shadow.ts finishAttack): the attack dealt damage to the defender, which is still in play, so the shadow card is
// attached to it faceup and leaves its enemy (a shadow card is otherwise discarded at the end of the combat phase).
function attachIfDamaged(state: ScenarioState, cardId: string, defenderId: string): ScenarioState {
  const data = topFrame(state)?.data;
  const dealt = data?.kind === "effect" ? (data.dealt ?? 0) : 0;
  const card = state.cards[cardId];
  const defender = state.cards[defenderId];
  if (dealt <= 0 || !card || !defender || !inPlay(defender.zone) || (card.zone !== "shadow" && card.zone !== "encounterDiscard")) return state;
  return updateCard(attachTo(moveCard(state, cardId, { zone: "attached" }), cardId, defenderId), cardId, { face: "up", controller: null });
}

// A Response that would cancel the effects of an encounter card being revealed, on a card with the trait its When Revealed record names in
// NotCanceledBy ("cannot be canceled by the Ring-bearer's effect", 906208:A:1), is not offered (rr.cancel).
export function cancelNotAllowed(state: ScenarioState, offer: ResponseOffer, effect: Effect, ctx: ReduceContext): boolean {
  const event: GameEvent | undefined = offer.event;
  if (!event || (event.trigger !== "encounterRevealed" && event.trigger !== "whenRevealedPending")) return false;
  if (!effect.instructions.some((instruction) => instruction.verb === "CancelEffect")) return false;
  const subject = event.subject ?? event.cardId;
  const code = subject ? state.cards[subject]?.code : undefined;
  if (!code) return false;
  const traits = effectsOf(ctx, code)
    .filter((record) => record.timing === "whenRevealed")
    .flatMap((record) => record.instructions.flatMap((instruction) => (instruction.verb === "NotCanceledBy" ? [instruction.trait] : [])));
  return traits.some((trait) => hasTrait(state, offer.cardId, trait, ctx));
}
