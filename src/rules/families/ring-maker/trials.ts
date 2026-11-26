// Rules: rm.current-trial, rm.setup-the-three-trials, rr.reveal, rr.quest-advancement, rr.attachment-cards (data/rules/entries.json); ledger lines 08035:B:1, 08036:A:1, 08037:A:1, 08038:A:1, 08036:B:2, 08039:A:1, 08054:A:1.
// The verbs of The Three Trials that move the trial's cards: the stage chosen by the players, the random set-aside card, a Key attached to its host, a Key shuffled into the bottom of the encounter deck and the Guardians revealed again from the victory display.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { pileOf } from "../../core/piles.ts";
import { addModifier } from "../../core/modified-stat.ts";
import { printedOf } from "../../core/printed.ts";
import { shuffleIds } from "../../core/seed.ts";
import { inPlay, updateCard, type ScenarioState } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked, pickedList } from "../../interpret/player-verbs.ts";
import { startReveal } from "../../windows/frames.ts";
import { queueEvent } from "../../windows/queue.ts";
import { moveEncounter, pushPicked } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { queueFront } from "../play/refs.ts";
import { addToVictory } from "../sidequests/victory.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * AdvanceToChosenStage ("advance to a stage 2A quest of their choice", 08035:B:1, 08036:B:2): of the stages with these codes that are still in the quest deck (a defeated stage lies set aside, so it is not offered again) the first player chooses one, and the quest advances to it
 * (AdvanceToStage: the stage left is defeated and the new stage's When Revealed effects resolve). One stage left is taken without a question; none left, the quest advances to `otherwise` ("If all stage 2 quests have been defeated, advance to stage 3A, instead", 08036:B:2).
 */
export function advanceToChosenStage(state: ScenarioState, instruction: Verb<"AdvanceToChosenStage">, focus: Focus, steps: EngineStep[]): ScenarioState {
  const left = instruction.codes.filter((code) => state.questDeck.some((id) => state.cards[id]?.code === code));
  const advance = (code: string) => ({ verb: "AdvanceToStage", code }) as const;
  const only = left.length === 1 ? left[0] : undefined;
  const next: Instruction = left.length > 1 ? { verb: "Choose", who: "firstPlayer", options: left.map((code) => ({ id: code, instructions: [advance(code)] })) } : advance(only ?? instruction.otherwise);
  return queueFront(state, [{ instruction: next, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }]);
}

/** Two cards share a Trait: a Key and the Guardian of its animal (Key of the Boar and Boar's Guardian). */
function shareTrait(ctx: ReduceContext, state: ScenarioState, left: string, right: string): boolean {
  const traits = printedOf(ctx.cards, state.cards[right]?.code ?? "").traits;
  return printedOf(ctx.cards, state.cards[left]?.code ?? "").traits.some((trait) => traits.includes(trait));
}

/**
 * PickSetAside ("Randomly choose 1 of the remaining set aside Guardian enemies", 08036:A:1; "Find the set aside Key objective that shares a Trait with the just revealed Guardian enemy", 08036:A:1): the last picked card becomes one of the set-aside cards with this type and Trait, chosen with the game's
 * seed; with `sharesTraitWithPicked` only one that shares a Trait with the card picked before. With `trialKey` the card is marked as the current trial's Key objective, for the stage that picks it (its 2B reads whether a player controls it). Nothing is picked when no card matches.
 */
export function pickSetAside(state: ScenarioState, instruction: Verb<"PickSetAside">, focus: Focus, ctx: ReduceContext): ScenarioState {
  const before = lastPicked(state);
  const pool = state.setAside.filter(
    (id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").type === instruction.cardType && hasTrait(state, id, instruction.trait, ctx) && (instruction.sharesTraitWithPicked !== true || (before !== "" && shareTrait(ctx, state, id, before))),
  );
  const shuffled = shuffleIds(pool, state.seed, state.seedCursor);
  const chosen = shuffled.ids[0];
  const drawn = pool.length > 1 ? { ...state, seedCursor: shuffled.cursor } : state;
  const next = pushPicked(drawn, chosen);
  return chosen != null && instruction.trialKey === true && focus.sourceId ? addModifier(next, chosen, focus.sourceId, "trialKey", 1, "endOfGame") : next;
}

/**
 * AttachPickedToPrevious ("attach it to that enemy", 08036:A:1, 08037:A:1): the last picked card, a set-aside Key, lies attached to the card picked before it, claimed and controlled by nobody (the Key text works only while it is unattached, 08043:A:1); the host that leaves play lets
 * the Key go to the staging area. The `attached` event is announced.
 */
export function attachPickedToPrevious(state: ScenarioState): ScenarioState {
  const list = pickedList(state);
  const key = state.cards[list.at(-1) ?? ""];
  const host = state.cards[list.at(-2) ?? ""];
  if (!key || !host || key.id === host.id) return state;
  const lying = updateCard(attachTo(moveCard(state, key.id, { zone: "attached" }), key.id, host.id), key.id, { face: "up", exhausted: false, claimed: true });
  return queueEvent(lying, { trigger: "attached", seat: state.firstPlayer, subject: key.id, other: host.id });
}

/** AddPickedToStaging ("add it to the staging area", 08037:A:1): the last picked set-aside card, or card of the Raven deck (08147:A:1, rm.raven-deck), enters the staging area faceup without a reveal (faq.reveal-and-add). */
export function addPickedToStaging(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = lastPicked(state);
  if (!state.cards[id] || !(state.setAside.includes(id) || pileOf(state, "ravenDeck").includes(id))) return state;
  return updateCard(moveEncounter(state, id, "staging", focus.seat, ctx, steps), id, { face: "up" });
}

/**
 * ShufflePickedIntoBottom ("shuffle it into the bottom 10 cards of the encounter deck", 08038:A:1): the last picked card joins the last `count` cards of the encounter deck (all of them when fewer), facedown, and those cards are shuffled, the card in a random place among them.
 */
export function shufflePickedIntoBottom(state: ScenarioState, instruction: Verb<"ShufflePickedIntoBottom">): ScenarioState {
  const id = lastPicked(state);
  if (!state.cards[id]) return state;
  const moved = updateCard(moveCard(state, id, { zone: "encounterDeck" }), id, { face: "down" });
  const deck = moved.encounterDeck.filter((other) => other !== id);
  const kept = deck.slice(0, Math.max(0, deck.length - instruction.count));
  const shuffled = shuffleIds([...deck.slice(kept.length), id], state.seed, state.seedCursor);
  return { ...moved, encounterDeck: [...kept, ...shuffled.ids], seedCursor: shuffled.cursor };
}

/**
 * RevealFromVictory ("Reveal each Guardian enemy in the victory display, adding them to the staging area", 08039:A:1; "reveal a random Guardian enemy from the victory display", 08054:A:1): each card in the victory display with this Trait is revealed in full (its Time counters are put on again,
 * none carry over) and joins the staging area; the first goes down last, so it resolves first. With `random` one of them is revealed, chosen with the seed.
 */
export function revealFromVictory(state: ScenarioState, instruction: Verb<"RevealFromVictory">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const pool = state.victory.filter((id) => hasTrait(state, id, instruction.trait, ctx));
  const shuffled = instruction.random === true && pool.length > 1 ? shuffleIds(pool, state.seed, state.seedCursor) : null;
  const chosen = instruction.random === true ? (shuffled ?? { ids: pool, cursor: state.seedCursor }).ids.slice(0, 1) : pool;
  let next = shuffled ? { ...state, seedCursor: shuffled.cursor } : state;
  for (const id of [...chosen].reverse()) next = startReveal(next, focus.seat, ctx, steps, id);
  return next;
}

/**
 * AddInPlayToVictory ("add all Barrow locations in play to the victory display", 08036:B:2; "add all Guardian enemies in play", 08037:B:2): each card in play (the staging area, an engagement area or the active location) with this Trait and printed type goes to the victory display, wherever it lies.
 * It is a quest effect, so a card that cannot leave play for a player card (the Guardians at Perseverance, 08037:B:1) goes too.
 */
export function addInPlayToVictory(state: ScenarioState, instruction: Verb<"AddInPlayToVictory">, ctx: ReduceContext): ScenarioState {
  const ids = Object.values(state.cards).filter((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).type === instruction.cardType && hasTrait(state, card.id, instruction.trait, ctx)).map((card) => card.id);
  return ids.reduce((next, id) => addToVictory(next, id, ctx), state);
}
