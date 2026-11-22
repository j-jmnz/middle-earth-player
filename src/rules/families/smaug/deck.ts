// Rules: docs/scenarios/standalone-scenarios.md (The Battle of Lake-town: the Smaug deck, from the Quest Companion), rr.reveal, rr.first-player, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 50201:A:1, 50204:A:2, 50206:A:3.
// The Smaug deck: at the beginning of every quest phase (round 1 too, before the commitments) the first player chooses the play area or the staging area blind, then reveals the top Smaug card and puts it there. In the play area he engages it at once
// (not an optional engagement). A Smaug already in play gives the new one all its damage, as the new one is revealed and before its When Revealed effects, and goes to the Smaug discard pile. An empty deck is shuffled from its discard pile. The deck and
// its discard pile are one of the decks beside the encounter deck (core/piles.ts DECKS); no encounter deck or discard effect touches them.
import type { Instruction } from "../../../catalog/boundary.ts";
import { refillDeck } from "../../core/decks.ts";
import type { EngineStep } from "../../core/intents.ts";
import { ruleCause } from "../../core/cause.ts";
import { DECKS, pileDealt, topOf } from "../../core/piles.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { startReveal } from "../../windows/frames.ts";
import { moveEncounter } from "../encounter/moves.ts";
import type { Focus } from "../index.ts";
import { isSmaug, SMAUG_CODES } from "./cards.ts";

/** The first player's question at the beginning of the quest phase: Smaug is put in the play area or the staging area, chosen before the card is seen. Asked once a round. Null when nothing is to be asked (no Smaug deck, or already asked this round). */
export function askSmaug(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  if (!pileDealt(state, DECKS.smaug.deck) || state.smaugAsked === state.round) return null;
  const marked: ScenarioState = { ...state, smaugAsked: state.round };
  const stage = marked.questStage;
  if (stage == null) return marked;
  const choose: Instruction = {
    verb: "Choose",
    who: "firstPlayer",
    options: [
      { id: "play", instructions: [{ verb: "RevealSmaug", to: "play" }] },
      { id: "staging", instructions: [{ verb: "RevealSmaug", to: "staging" }] },
    ],
  };
  return pushEffectFrame(marked, { frame: "forced", sourceId: stage, actor: marked.firstPlayer, peril: false, effectId: "smaug:reveal", instructions: [choose], cancel: null, blockCancel: null, cause: ruleCause("rr.reveal") }, steps);
}

/** RevealSmaug: the top of the Smaug deck (refilled from its discard pile first) is revealed by the first player into the play area (engaged with him) or the staging area. Nothing with both piles empty. */
export function revealSmaug(state: ScenarioState, instruction: Extract<Instruction, { verb: "RevealSmaug" }>, _focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const filled = refillDeck(state, DECKS.smaug);
  const top = topOf(filled, DECKS.smaug.deck);
  if (top == null) return filled;
  return startReveal(filled, filled.firstPlayer, ctx, steps, top, undefined, instruction.to === "play");
}

/**
 * The reveal hook (before the card's When Revealed effects): a Smaug that arrives while another is in play takes all its damage, and the old one is discarded to the Smaug discard pile. The old one's damage is moved, not dealt, so no cap or
 * immunity stops it.
 */
export function swapSmaug(state: ScenarioState, cardId: string, ctx: ReduceContext): ScenarioState {
  if (!isSmaug(state, cardId)) return state;
  const old = Object.values(state.cards).find((card) => card.id !== cardId && SMAUG_CODES.has(card.code) && (card.zone === "staging" || card.zone === "engaged"));
  if (!old) return state;
  const carried = updateCard(state, cardId, { damage: old.damage });
  return moveEncounter(carried, old.id, "discard", old.controller ?? carried.firstPlayer, ctx, []);
}
