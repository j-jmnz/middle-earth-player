// Rules: emce.side-quests, emce.side-quests-in-play, rr.step-3-4, rr.damage, rr.attacks-outside-the-combat-phase, rr.first-player, emce.campaign-log (data/rules/entries.json); ledger lines 19083:B:1, 19080:A:3, 19081:A:1, 12188:A:1.
// Fire in the Night (Ered Mithrin part 6): the encounter side quests. A side quest is both a quest card and an encounter card: it is revealed from the side quest deck into the staging area (its When Revealed effects cannot be canceled), the first player may
// make one the current quest at the beginning of the quest phase, progress goes on it once the active location is full (beyond its quest points it is discarded), and a defeated one is added to the victory display with no advance of the quest deck. The attack
// against Hrogar's Hill (the main quest card takes the damage of an undefended attack, and the excess damage past a defender) and the boxes marked beside Beldis in the campaign log are here too. A game that dealt no side quest deck reads none of it.
import type { Instruction } from "../../../catalog/boundary.ts";
import { isAllyLike } from "../../core/printed.ts";
import type { CombatHooks } from "../../interpret/family-manifest.ts";

import { BELDIS_BOXES } from "../../../catalog/ally-lines.ts";
import { ruleCause } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { NAMED_PILES, pileOf } from "../../core/piles.ts";
import { flagged, type ScenarioState } from "../../core/state.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { startReveal } from "../../windows/frames.ts";
import { queueEvent } from "../../windows/queue.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { defeatSideQuest } from "../sidequests/quest.ts";
import { hasSideQuests, isSideQuest, sideQuestPoints, stagedSideQuests } from "./night-quest.ts";
import { attackNowFromStaging } from "../south/watcher.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * RevealSideQuest: the top card of the side quest deck is revealed by the actor (a reveal frame of its own: it is added to the staging area and its When Revealed effects resolve; nothing can cancel them). Nothing happens with the deck empty. A reveal
 * the deck's side quest starts is not "revealed by the encounter deck": no Response that reads that is heard.
 */
export function revealSideQuest(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = pileOf(state, NAMED_PILES.sideQuests.deck)[0];
  return top ? startReveal(state, focus.seat, ctx, steps, top) : state;
}

/**
 * The beginning of the quest phase (emce.side-quests-in-play): with side quests in the staging area the first player may choose one to be the current quest until the end of the phase, in a frame of its own that asks them. Asked once a round, before the
 * characters are committed. Null when nothing is to be asked (the machine goes on), the marked state when there is no side quest to choose.
 */
export function askCurrentQuest(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (state.sideAsked === state.round || !hasSideQuests(state)) return null;
  const marked: ScenarioState = { ...state, sideAsked: state.round };
  const staged = stagedSideQuests(marked, ctx);
  const first = staged[0];
  if (first == null) return marked;
  // "May choose one": the main quest stays the quest when the first player declines.
  const choose: Instruction = {
    verb: "Choose",
    who: "firstPlayer",
    options: [{ id: MAIN_QUEST, instructions: [] }, ...staged.map((id) => ({ id, instructions: [{ verb: "MakeCurrentQuest" as const, card: id }] }))],
  };
  return pushEffectFrame(marked, { frame: "forced", sourceId: first, actor: marked.firstPlayer, peril: false, effectId: "sideQuests:current", instructions: [choose], cancel: null, blockCancel: null, cause: ruleCause("emce.side-quests-in-play") }, steps);
}

/** The option of the first player's question that leaves the main quest as the quest. */
export const MAIN_QUEST = "main";

/** MakeCurrentQuest: the side quest is the current quest until the end of the phase; the cards that hear it ("After Draw Her Fire becomes the current quest") are told. */
export function makeCurrentQuest(state: ScenarioState, instruction: Verb<"MakeCurrentQuest">, ctx: ReduceContext): ScenarioState {
  const card = state.cards[instruction.card];
  if (!card || card.zone !== "staging" || !isSideQuest(state, card.id, ctx)) return state;
  const marked: ScenarioState = { ...state, modifiers: [...state.modifiers, { instanceId: card.id, sourceId: card.id, stat: "currentQuest", amount: 1, until: "endOfPhase" }] };
  return queueEvent(marked, { trigger: "becameCurrentQuest", seat: null, cardId: card.id, subject: card.id });
}

/** The settle sweep: a side quest in the staging area that holds its quest points in progress is defeated (emce.side-quests-in-play): it is added to the victory display, the quest deck does not advance. */
export function defeatFullSideQuests(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.stageCleared || !hasSideQuests(state)) return state;
  let next = state;
  for (const id of stagedSideQuests(state, ctx)) {
    const quest = next.cards[id];
    if (!quest || quest.progress <= 0) continue;
    const points = sideQuestPoints(next, quest, ctx.cards);
    if (points != null && quest.progress >= points) next = defeatSideQuest(next, id, ctx, steps);
  }
  return next;
}

/**
 * AttackStage: the last picked enemy, in the staging area, attacks the main quest card (19083:B:1): the first player is the defending player and may declare a defender; no shadow card is dealt. The damage of the attack left undefended, and the damage beyond a defender's
 * remaining hit points, is dealt to the quest card. It is an attack outside the combat phase, so it does not use up the enemy's attack, and the running effect counts it (its frames wait for the attack).
 */
export function attackStage(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  const enemy = id ? state.cards[id] : undefined;
  if (!id || enemy?.zone !== "staging" || !state.questStage) return state;
  return attackNowFromStaging(state, id, state.firstPlayer, ctx, steps, { shadow: false, toStage: true, excessToStage: true });
}

/** ExcessToStage: a Shadow effect marks the attack in progress: the damage beyond its defender's remaining hit points goes on the main quest card (19080:A:3). */
export function excessToStage(state: ScenarioState): ScenarioState {
  const attack = state.pendingAttack;
  return attack ? { ...state, pendingAttack: { ...attack, excessToStage: true } } : state;
}

/** MarkBeldisUse: the actor's next box beside Beldis is marked (emce.campaign-log). The game keeps a log of its own that a won scenario writes back; a game with none starts one. A fifth use is never marked. */
export function markBeldisUse(state: ScenarioState, focus: Focus): ScenarioState {
  const facts = state.campaignFacts ?? { prisoner: null, usedOnce: [], counters: {} };
  const uses = Array.from({ length: Math.max(state.seatCount, facts.beldisUses?.length ?? 0) }, (_, seat) => facts.beldisUses?.[seat] ?? 0);
  if ((uses[focus.seat] ?? 0) >= BELDIS_BOXES) return state;
  uses[focus.seat] = (uses[focus.seat] ?? 0) + 1;
  return { ...state, campaignFacts: { ...facts, beldisUses: uses } };
}

/** The actor has a box left beside Beldis (the `beldisBox` condition). */
export function beldisBoxLeft(state: ScenarioState, seat: number): boolean {
  return (state.campaignFacts?.beldisUses?.[seat] ?? 0) < BELDIS_BOXES;
}

/**
 * The combat hooks of the side quests' cards: allies (an ally, or an objective ally a player controls, but not an ally among the heroes) cannot be declared as attackers against an enemy that holds `alliesCannotAttack` (19068:A:1), and an attack on the main quest card sends the damage left
 * undefended to it (19083:B:1, 19081:A:1).
 */
export const NIGHT_COMBAT: CombatHooks = {
  attack: (state, enemyId, attacker, _target, attackerId) => (state.cards[attackerId]?.zone !== "heroes" && isAllyLike(attacker) && flagged(state, enemyId, "alliesCannotAttack") ? "Allies cannot attack that enemy" : null),
  undefended: (state) => (state.pendingAttack?.toStage && state.questStage ? [state.questStage] : []),
};
