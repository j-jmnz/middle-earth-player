// Rules: dcce.aflame, dcce.stormcaller-elite, rr.search, rr.first-player (data/rules/entries.json). The verbs of the aflame family that move cards: the Setup's discards, a search for an Aflame
// location, an enemy that engages the first player, the stage that turns progress into healing, and the cards a Resolution earns by being in the game.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../amounts.ts";
import { askTarget } from "../choices.ts";
import { currentCause, UNATTRIBUTED } from "../cause.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { pickCandidates } from "../pick.ts";
import { engageEnemy } from "../quest.ts";
import type { Earned } from "../campaign-state.ts";
import type { ScenarioState } from "../state.ts";
import { inPlay, livingSeats, updateCard } from "../state.ts";
import { printedOf } from "../printed.ts";
import { moveCard } from "../zones.ts";
import { effectData, moveEncounter } from "./encounter-moves.ts";
import { healBlocked } from "./burden-life.ts";
import type { Focus } from "./index.ts";
import { queueFront } from "./play-refs.ts";
import { aflameOf } from "./aflame-values.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** DiscardUntilAflame: the top cards of the encounter deck are discarded until `perPlayer` Aflame locations for each player have been; each of those goes to the staging area instead of staying in the discard
 * pile (11036:A:1). The deck can run out first. */
export function discardUntilAflame(state: ScenarioState, instruction: Verb<"DiscardUntilAflame">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const wanted = instruction.perPlayer * livingSeats(state).length;
  let next = state;
  let found = 0;
  for (let top = next.encounterDeck[0]; top != null && found < wanted; top = next.encounterDeck[0]) {
    const aflame = aflameOf(next, top, ctx) != null;
    if (aflame) found += 1;
    next = aflame ? moveEncounter(next, top, "staging", focus.seat, ctx, steps) : updateCard(moveCard(next, top, { zone: "encounterDiscard" }), top, { face: "up", controller: null });
  }
  return next;
}

/** SearchAflame: the Aflame location with the highest Aflame value among the encounter deck and its discard pile joins the staging area; of locations tied that are not copies of one card the first player chooses. */
export function searchAflame(state: ScenarioState, instruction: Verb<"SearchAflame">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = [...state.encounterDeck, ...state.encounterDiscard].filter((id) => aflameOf(state, id, ctx) != null);
  const highest = Math.max(-1, ...found.map((id) => aflameOf(state, id, ctx) ?? 0));
  const tied = found.filter((id) => aflameOf(state, id, ctx) === highest);
  if (tied.length === 0) return state;
  const options = tied.filter((id, at) => tied.findIndex((other) => state.cards[other]?.code === state.cards[id]?.code) === at);
  const chosen = focus.chosen && tied.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  if (!chosen) return effectData(state) ? askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : state;
  return moveEncounter(state, chosen, "staging", focus.seat, ctx, steps);
}

/** EngageFirstPlayer: the source enemy, in the staging area, engages the first player. */
export function engageFirstPlayer(state: ScenarioState, focus: Focus, steps: EngineStep[]): ScenarioState {
  return focus.sourceId ? engageEnemy(state, state.firstPlayer, focus.sourceId, steps) : state;
}

/** HealLocations: one damage at a time comes off the location the first player chooses among those in play with damage, until `amount` is removed or none holds damage. With one such location the rest comes off at once. */
export function healLocations(state: ScenarioState, instruction: Verb<"HealLocations">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const total = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
  const healed = instruction.healed ?? 0;
  if (healed >= total) return state;
  const options = pickCandidates(state, { type: "location", control: "any", damaged: true }, state.firstPlayer, [], focus.sourceId, ctx, undefined, undefined, true).filter((id) => !healBlocked(state, id));
  if (options.length === 0) return state;
  const chosen = focus.chosen && options.includes(focus.chosen) ? focus.chosen : options.length === 1 ? options[0] : undefined;
  const cause = currentCause(steps, UNATTRIBUTED);
  if (!chosen) return effectData(state) ? askTarget(state, { instruction: { ...instruction, amount: total }, seat: state.firstPlayer, chosen: null, cause }, options) : state;
  const card = state.cards[chosen];
  if (!card) return state;
  const taken = options.length === 1 ? Math.min(total - healed, card.damage) : 1;
  steps.push({ kind: "damage", targetId: chosen, amount: -taken, cause });
  const next = updateCard(state, chosen, { damage: card.damage - taken });
  return healed + taken >= total ? next : queueFront(next, [{ instruction: { ...instruction, amount: total, healed: healed + taken }, seat: focus.seat, chosen: null, cause }]);
}

/** EarnDealt, at a Resolution: one pool entry for each card the Setup let a seat choose with one of these codes, for the seat that chose it, wherever the copy is now (a hand, a discard pile, the victory
 * display after it was played). */
export function dealtCopies(state: ScenarioState, codes: readonly string[], step: number): Earned[] {
  return (state.chosenAtSetup ?? []).filter((chosen) => codes.includes(chosen.code)).map((chosen) => ({ code: chosen.code, to: "pool" as const, seat: chosen.seat, hero: null, step }));
}

/** StageSetAside: the set-aside card with this code joins the staging area, announced as added to it and as entering play (its Forced effects hear that). */
export function stageSetAside(state: ScenarioState, instruction: Verb<"StageSetAside">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = state.setAside.find((other) => (instruction.code != null ? state.cards[other]?.code === instruction.code : printedOf(ctx.cards, state.cards[other]?.code ?? "").name === instruction.name));
  if (!id) return state;
  // A card set aside on its Campaign Mode only side (The Thing in the Depths, FlipSetAside) keeps that side as it joins the staging area.
  const side = state.cards[id]?.face === "B" ? "B" : null;
  const staged = moveEncounter(state, id, "staging", focus.seat, ctx, steps);
  return side ? updateCard(staged, id, { face: side }) : staged;
}

/** RemoveNamedFromGame: the card in play with this title and each card attached to it leave the game, and nothing is announced as leaving play ("ignoring his 'leaves play' ability"). */
export function removeNamedFromGame(state: ScenarioState, instruction: Verb<"RemoveNamedFromGame">, ctx: ReduceContext): ScenarioState {
  const card = Object.values(state.cards).find((other) => inPlay(other.zone) && printedOf(ctx.cards, other.code).name === instruction.name);
  if (!card) return state;
  const gone = [...card.attachments, card.id];
  let next = state;
  for (const id of gone) next = moveCard(next, id, { zone: "removed" });
  return { ...next, pendingEvents: (next.pendingEvents ?? []).filter((event) => !(event.trigger === "leftPlay" && event.cardId != null && gone.includes(event.cardId))) };
}
