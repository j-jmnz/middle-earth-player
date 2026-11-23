// Rules: hob.riddle-area, hob.setup-dungeons-deep-and-caverns-dim (data/rules/entries.json); ledger lines 131029:A:1, 131030:A:1, 131031:B:1. The riddle area of Dungeons Deep and Caverns Dim: stage 2 (Riddles in the Dark) and the Gollum enemy lie in the zone `riddleArea`, in play outside the staging area, and Bilbo Baggins
// stays among his seat's heroes with Bilbo's Magic Ring attached; they are "in the area" while stage 2 is. Stage 2 is no quest stage of `ScenarioState.stages`: the quest advances from stage 1 to stage 3 past it (advanceStage asks `skipAreaStage`).
import type { Instruction } from "../../../catalog/boundary.ts";

import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import type { CardInstance, ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { printedOf } from "../../core/printed.ts";
import { engageWith } from "../../quest/quest.ts";
import type { Focus } from "../index.ts";

export const STAGE_2 = "131030";
export const GOLLUM = "131074";
export const RING = "131079";
export const BILBO = "131001";

const cardOf = (state: ScenarioState, code: string, zone?: CardInstance["zone"]): CardInstance | undefined => Object.values(state.cards).find((card) => card.code === code && (zone == null || card.zone === zone));

/** Stage 2 of the quest while it lies in the riddle area. */
export const areaStage = (state: ScenarioState): CardInstance | undefined => cardOf(state, STAGE_2, "riddleArea");

/** Gollum while he is in the riddle area. */
export const areaGollum = (state: ScenarioState): CardInstance | undefined => cardOf(state, GOLLUM, "riddleArea");

/** Bilbo Baggins, in play among his seat's heroes. */
export const bilbo = (state: ScenarioState): CardInstance | undefined => cardOf(state, BILBO, "heroes");

/** The cards of the riddle area (hob.riddle-area): stage 2, Gollum, Bilbo Baggins and the Ring attached to him. Empty once stage 2 has left. */
export function areaIds(state: ScenarioState): string[] {
  if (!areaStage(state)) return [];
  const hero = bilbo(state);
  const ring = hero ? hero.attachments.find((id) => state.cards[id]?.code === RING) : undefined;
  return [...Object.values(state.cards).filter((card) => card.zone === "riddleArea").map((card) => card.id), ...(hero ? [hero.id] : []), ...(ring ? [ring] : [])];
}

/** Whether the card is in the riddle area (Bilbo and the Ring count while stage 2 does). */
export const inArea = (state: ScenarioState, id: string): boolean => areaIds(state).includes(id);

/** advanceStage's next stage code: the stage after `code` in the quest's order that does not lie in the riddle area (stage 2 is no stage the quest moves on to). */
export function skipAreaStage(state: ScenarioState, index: number): string | undefined {
  const held = areaStage(state);
  const next = state.stages[index + 1]?.code;
  return held != null && next === held.code ? state.stages[index + 2]?.code : next;
}

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** CreateRiddleArea: the quest deck's card with this code goes into the riddle area, side B up, and its Setup records resolve (131030:A:1, in a frame of their own). */
export function createRiddleArea(state: ScenarioState, instruction: Verb<"CreateRiddleArea">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.questDeck.find((candidate) => state.cards[candidate]?.code === instruction.stage);
  if (!id) return state;
  const placed = updateCard(moveCard(state, id, { zone: "riddleArea" }), id, { face: "B", progress: 0 });
  const own = ctx.effects.filter((effect) => effect.cardCode === instruction.stage && effect.timing === "setup");
  return pushCardEffects(placed, "setup", id, focus.seat, false, own, ctx, steps);
}

/** PlaceInRiddleArea: the card with this code, found in the encounter deck, goes into the area: attached to the hero with the title `attachTo`, or lying in it. */
export function placeInRiddleArea(state: ScenarioState, instruction: Verb<"PlaceInRiddleArea">, ctx: ReduceContext): ScenarioState {
  const id = state.encounterDeck.find((candidate) => state.cards[candidate]?.code === instruction.code);
  if (!id) return state;
  if (instruction.attachTo == null) return updateCard(moveCard(state, id, { zone: "riddleArea" }), id, { face: "up", controller: null });
  const host = Object.values(state.cards).find((card) => card.zone === "heroes" && printedOf(ctx.cards, card.code).name === instruction.attachTo);
  if (!host) return state;
  return attachTo(updateCard(moveCard(state, id, { zone: "attached" }), id, { face: "up", controller: null }), id, host.id);
}

/** LeaveRiddleArea: stage 2 leaves the game with the riddle area (131031:B:1). Bilbo stays the first player's and is no longer limited: his limits came from stage 2's record. */
export function leaveRiddleArea(state: ScenarioState): ScenarioState {
  const stage = areaStage(state);
  return stage ? moveCard(state, stage.id, { zone: "removed" }) : state;
}

/** GollumEngagesFirstPlayer: Gollum, in the riddle area or engaged with another player, engages the first player (131031:B:2). He is not moved from the area while stage 2 holds him there. */
export function gollumEngagesFirstPlayer(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  const gollum = cardOf(state, GOLLUM);
  if (!gollum || areaStage(state) || (gollum.zone !== "riddleArea" && gollum.zone !== "engaged") || (gollum.zone === "engaged" && gollum.controller === state.firstPlayer)) return state;
  return engageWith(state, state.firstPlayer, gollum.id, steps);
}

/** The Action the Ring prints for answering a riddle (131079:A:2): its record, which the riddle step reads for the resources spent and the cards discarded. */
const ringAction = (ctx: Pick<ReduceContext, "effects">) => ctx.effects.find((effect) => effect.cardCode === RING && effect.timing === "action" && effect.condition?.kind === "riddle");

/** The Ring on Bilbo and the Baggins resources in his pool, when both are there to use while answering a riddle (131079:A:2): Bilbo, what one use spends and how many cards it discards. Null without the Action's record. */
export function ringReady(state: ScenarioState, ctx: Pick<ReduceContext, "effects">): { bilbo: CardInstance; spend: number; discard: number } | null {
  const action = ringAction(ctx);
  const cost = action && !Array.isArray(action.cost) && action.cost?.kind === "resources" ? action.cost : undefined;
  const discard = action?.instructions.find((instruction) => instruction.verb === "DiscardFromDeck");
  const amount = discard?.verb === "DiscardFromDeck" && typeof discard.amount === "number" ? discard.amount : undefined;
  const hero = bilbo(state);
  const ring = hero?.attachments.some((id) => state.cards[id]?.code === RING) === true;
  return hero && ring && cost && amount != null && hero.resources >= cost.amount ? { bilbo: hero, spend: cost.amount, discard: amount } : null;
}
