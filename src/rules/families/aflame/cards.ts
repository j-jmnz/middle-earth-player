// Rules: dcce.aflame, dcce.stormcaller-elite, rr.search, rr.first-player (data/rules/entries.json); ledger line 00002:A:1. The verbs of the aflame family that move cards: the Setup's discards, a search for an Aflame
// location, an enemy that engages the first player, the stage that turns progress into healing, and the cards a Resolution earns by being in the game.
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import { askTarget } from "../../windows/choices.ts";
import { startReveal } from "../../windows/frames.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { engageEnemy, engageWith } from "../../quest/quest.ts";
import type { Earned } from "../../core/campaign-state.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { printedOf } from "../../core/printed.ts";
import { seatOf } from "../../interpret/player-verbs.ts";
import { moveCard } from "../../core/zones.ts";
import { effectData, moveEncounter, setAsideNamed } from "../encounter/moves.ts";
import { healBlocked } from "../burden/life.ts";
import type { Focus } from "../index.ts";
import { markPicked, queueFront } from "../play/refs.ts";
import { aflameOf } from "./values.ts";

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

/** EngageFirstPlayer: the source enemy, in the staging area, engages the first player; with `moves`, one engaged with another player moves to the first player (nothing stops it unless it cannot be engaged). */
export function engageFirstPlayer(state: ScenarioState, focus: Focus, steps: EngineStep[], moves = false): ScenarioState {
  if (!focus.sourceId) return state;
  const enemy = state.cards[focus.sourceId];
  if (moves && enemy?.zone === "engaged" && enemy.controller !== state.firstPlayer) return flagged(state, focus.sourceId, "cannotBeEngaged") ? state : engageWith(state, state.firstPlayer, focus.sourceId, steps);
  return engageEnemy(state, state.firstPlayer, focus.sourceId, steps);
}

/** EngageLowestThreat: every copy of the source's title, in the staging area or engaged with a player, engages the living seat with the lowest threat. Among tied seats the first player chooses (once, for every copy). Copies that are all
 * engaged with one lowest-threat seat already stay. A copy that cannot be engaged stays where it is. */
export function engageLowestThreat(state: ScenarioState, focus: Focus, steps: EngineStep[]): ScenarioState {
  const source = focus.sourceId ? state.cards[focus.sourceId] : undefined;
  if (!source) return state;
  const seats = livingSeats(state);
  const lowest = Math.min(...seats.map((seat) => state.seats[seat]?.threat ?? 0));
  const tied = seats.filter((seat) => (state.seats[seat]?.threat ?? 0) === lowest);
  const copies = Object.values(state.cards).filter((card) => card.code === source.code && (card.zone === "staging" || card.zone === "engaged") && !flagged(state, card.id, "cannotBeEngaged"));
  if (copies.length === 0 || tied.length === 0) return state;
  const holders = new Set(copies.map((card) => (card.zone === "engaged" ? card.controller : null)));
  const [only] = [...holders];
  if (holders.size === 1 && only != null && tied.includes(only)) return state;
  const options = tied.map((seat) => `seat:${seat}`);
  const seat = tied.length === 1 ? tied[0] : focus.chosen ? seatOf(focus.chosen) : undefined;
  if (seat == null) return effectData(state) ? askTarget(state, { instruction: { verb: "EngageLowestThreat" }, seat: state.firstPlayer, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options) : state;
  let next = state;
  for (const copy of copies) {
    if (copy.zone === "engaged" && copy.controller === seat) continue;
    next = copy.zone === "engaged" ? engageWith(next, seat, copy.id, steps) : engageEnemy(next, seat, copy.id, steps);
  }
  return next;
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
  const chosen = (state.chosenAtSetup ?? []).filter((one) => codes.includes(one.code));
  const counted = new Map<string, number>();
  // A code that several seats chose is one numbered copy for each of them (a Brace of Coneys for each player who shuffled one in, 144069:B:1), not one card the second seat's copy is lost to.
  return chosen.map((one) => {
    const number = (counted.get(one.code) ?? 0) + 1;
    counted.set(one.code, number);
    const shared = chosen.filter((other) => other.code === one.code).length > 1;
    return { code: one.code, to: "pool" as const, seat: one.seat, hero: null, step, ...(shared ? { copy: number } : {}) };
  });
}

/** StageSetAside: the set-aside card with this code joins the staging area, announced as added to it and as entering play (its Forced effects hear that). */
export function stageSetAside(state: ScenarioState, instruction: Verb<"StageSetAside">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = instruction.code != null ? state.setAside.find((other) => state.cards[other]?.code === instruction.code) : setAsideNamed(state, instruction.name ?? "", ctx);
  if (!id) return state;
  // "Reveal ... and add it to the staging area" (09070:A:1, rr.reveal): the reveal frame resolves the card's keywords and When Revealed effects and places it (the staging area, or engaged for an enemy that engages).
  if (instruction.reveal) return startReveal(markPicked(state, id), focus.seat, ctx, steps, id);
  // A card set aside on its Campaign Mode only side (The Thing in the Depths, FlipSetAside) keeps that side as it joins the staging area.
  const side = state.cards[id]?.face === "B" ? "B" : null;
  const staged = moveEncounter(state, id, "staging", focus.seat, ctx, steps);
  const faced = side ? updateCard(staged, id, { face: side }) : staged;
  return instruction.remember ? markPicked(faced, id) : faced;
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
