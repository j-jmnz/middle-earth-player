// Rules: emce.treasure, emce.guarded-x, emce.haldan, rr.victory, rr.guarded, rr.quest-advancement, emce.campaign-pool-encounter (data/rules/entries.json); ledger lines 12168:A:2, 12168:B:3, 18028:A:2, 18029:A:3, 18071:A:1.
// Lost in Mirkwood's verbs: the quest stage a letter names, Haldan under the first player at Setup, the treasure guarded by a searched-for Twilight Hall and claimed once freed, the cards the Resolution discards into the pool, and the Objective-Location Searching for a Way Out puts into play.
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { moveCard } from "../../core/zones.ts";
import { effectCause } from "../../core/cause.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { advanceToStage } from "../breaking/index.ts";
import { freeOfEncounters } from "../objectives/free.ts";
import { markSurge } from "../../interpret/verbs.ts";
import { queueFront } from "../play/refs.ts";
import { resolveGuarded } from "./deep.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** AdvanceToLetterStage: the quest advances to the stage one number up with the letter (A the first of its level, C the second); nothing happens when the quest has no such stage ("if able"). */
export function advanceToLetterStage(state: ScenarioState, instruction: Verb<"AdvanceToLetterStage">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const current = state.questStage ? state.cards[state.questStage]?.code : undefined;
  const at = instruction.levels.findIndex((level) => current != null && level.includes(current));
  const code = at < 0 ? undefined : instruction.levels[at + 1]?.[instruction.letter === "A" ? 0 : 1];
  if (!code || !state.questDeck.some((id) => state.cards[id]?.code === code)) return state;
  return advanceToStage(state, code, ctx, steps);
}

/** TakeControlOfSetAside: the set-aside card with the code enters the first player's play area, faceup and ready. */
export function takeControlOfSetAside(state: ScenarioState, instruction: Verb<"TakeControlOfSetAside">, focus: Focus): ScenarioState {
  const id = state.setAside.find((candidate) => state.cards[candidate]?.code === instruction.code);
  if (!id) return state;
  return updateCard(moveCard(state, id, { zone: "play", seat: focus.seat }), id, { face: "up", exhausted: false });
}

/** SearchGuardForTreasure: when a copy of the card is in the encounter deck or its discard pile, the first player chooses to search for it; the copy is added to the staging area, remembered, and AttachRandomTreasure guards a treasure with it. */
export function searchGuardForTreasure(state: ScenarioState, instruction: Verb<"SearchGuardForTreasure">, focus: Focus): ScenarioState {
  const found = [...state.encounterDeck, ...state.encounterDiscard].some((id) => state.cards[id]?.code === instruction.code);
  if (!found) return state;
  const choose: Instruction = {
    verb: "Choose",
    who: "actor",
    options: [
      { id: "search", instructions: [{ verb: "SearchMove", code: instruction.code, to: "staging", remember: true }, { verb: "AttachRandomTreasure", to: "picked", ...(instruction.count != null ? { count: instruction.count } : {}) }] },
      { id: "decline", instructions: [] },
    ],
  };
  return queueFront(state, [{ instruction: choose, seat: focus.seat, chosen: null }]);
}

/** The settle sweep (emce.treasure: "Once that treasure is free of encounters, the players claim it"): a treasure in the staging area that is free of encounters (its guard left play) is claimed: a frame lets the first player choose the character it attaches to, as ClaimRandomTreasure does, and the players control it from then. Nothing resolves while a frame is open. */
export function freeTreasures(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (state.stack.length > 0 || state.lost || state.failure || state.staging.length === 0) return state;
  const record = ctx.effects.find((effect) => effect.instructions.some((instruction) => instruction.verb === "SearchGuardForTreasure" || instruction.verb === "AttachRandomTreasure"));
  if (!record) return state;
  const id = state.staging.find((candidate) => {
    const card = state.cards[candidate];
    return card != null && card.zone === "staging" && printedOf(ctx.cards, card.code).campaignKind === "treasure" && freeOfEncounters(state, candidate);
  });
  if (!id) return state;
  const aside = updateCard(moveCard(state, id, { zone: "setAside" }), id, { face: "up", controller: null });
  const instructions: Instruction[] = [{ verb: "Pick", pick: { type: "card", control: "any", hostForPicked: true, who: "firstPlayer" } }, { verb: "AttachPicked" }];
  return pushEffectFrame(aside, { frame: "ResolveEffect", sourceId: id, actor: state.firstPlayer, peril: false, effectId: record.id, instructions, picked: [id], cancel: null, blockCancel: null, cause: effectCause(record) }, steps);
}

/** DiscardToPoolFromSets (Resolution): cards come off the top of the encounter deck into the discard pile until `count` belong to one of the sets or the deck is empty; the codes of those cards, in the order discarded. */
export function discardToPoolFromSets(state: ScenarioState, sets: readonly string[], count: number, ctx: ReduceContext): { state: ScenarioState; codes: string[] } {
  let next = state;
  const codes: string[] = [];
  for (const id of state.encounterDeck) {
    if (codes.length >= count) break;
    const card = next.cards[id];
    if (!card) continue;
    next = updateCard(moveCard(next, id, { zone: "encounterDiscard" }), id, { face: "up", controller: null });
    const set = printedOf(ctx.cards, card.code).encounterSet;
    if (set != null && sets.includes(set)) codes.push(card.code);
  }
  return { state: next, codes };
}

/** After the cards progress was turned into are discarded: when Searching for a Way Out is in play, the topmost Objective-Location in the encounter discard pile enters play in the staging area and its Guarded keyword is resolved. */
export function putObjectiveLocation(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const markers = new Set(ctx.effects.filter((effect) => effect.instructions.some((instruction) => instruction.verb === "PutObjectiveLocationAfterDiscard")).map((effect) => effect.cardCode));
  if (markers.size === 0 || !Object.values(state.cards).some((card) => markers.has(card.code) && inPlay(card.zone))) return state;
  const id = [...state.encounterDiscard].reverse().find((candidate) => printedOf(ctx.cards, state.cards[candidate]?.code ?? "").objectiveLocation);
  if (!id) return state;
  const staged = updateCard(moveCard(state, id, { zone: "staging" }), id, { face: "up", controller: null });
  return resolveGuarded(staged, id, { seat: state.firstPlayer, sourceId: id }, ctx, steps);
}

/** GrantSurgeToSubject: the card being revealed (the event's subject) gains surge. */
export function grantSurge(state: ScenarioState, subject: string | null): ScenarioState {
  return subject ? markSurge(state, subject) : state;
}
