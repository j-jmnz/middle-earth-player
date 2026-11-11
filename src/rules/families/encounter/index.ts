// Rules: rr.encounter-deck, rr.reveal, rr.staging, rr.step-3-3, rr.search, rr.lasting-effects, rr.active-location,
// rr.travel, rr.cancel (data/rules/entries.json).
import type { RulesFamily } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";
import { frameScope, refCard, resolveAmount } from "../../interpret/amounts.ts";
import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { startReveal } from "../../windows/frames.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lowerThreat, playerCardEffectCanChoose } from "../../core/keywords.ts";
import { isPlayerType, printedOf } from "../../core/printed.ts";
import { placeQuestProgress } from "../../quest/quest.ts";
import { restricted } from "../../interpret/restrictions.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import type { Modifier, ScenarioState } from "../../core/state.ts";
import { inPlay, withThreat } from "../../core/state.ts";
import { patchTop } from "../../windows/windows.ts";
import { lastPicked, seatOf } from "../../interpret/player-verbs.ts";
import type { Focus } from "../index.ts";
import { runEncounterItem } from "./items.ts";
import { countTop, discardUntil, effectData, encounterCard, lookAtTop, moveEncounter, pushPicked, shuffleDiscardIn, shuffleVictoryIn, travelThere } from "./moves.ts";
import { answeredRaise } from "./reveal.ts";
import { searchCollection } from "./collection.ts";
import { queueFront } from "../play/refs.ts";

const WATCH_STATS = { threatZero: "watchThreatZero", damage: "watchDamage", discard: "watchDiscard", readyHost: "watchReadyHost" } as const;

// The verbs src/catalog/families/encounter.ts adds, for the encounter deck: look, move, discard, search, cancel and replace revealed cards, reveal triggers. Null when the verb is not one of them.
export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "LookAtTop":
      return lookAtTop(state, instruction, focus.seat, ctx, focus.sourceId);
    case "PickEncounter":
    case "ArrangeEncounter":
    case "PayResources":
    case "PlayRevealedFree":
      // Outside an effect frame nobody can be asked: the first option is taken.
      return runEncounterItem(state, { instruction, seat: focus.seat, chosen: null }, { cardId: focus.sourceId }, ctx, steps);
    case "MoveEncounterCard": {
      const id = encounterCard(state, instruction.card, focus);
      const picked = instruction.card === "deckTop" || instruction.card === "discardTop" ? pushPicked(state, id) : state;
      return id && !shielded(state, id, focus.sourceId, ctx) ? moveEncounter(picked, id, instruction.to, focus.seat, ctx, steps) : picked;
    }
    case "CountEncounterTop":
      return countTop(state, instruction, ctx);
    case "RevealEncounter": {
      const seat = instruction.who === "eventSeat" ? (effectData(state)?.eventSeat ?? focus.seat) : focus.seat;
      if (state.seats[seat]?.eliminated) return state;
      // `times` cards, one after the other: the rest wait in the effect's queue behind this reveal.
      const times = instruction.times == null ? 1 : resolveAmount(state, instruction.times, frameScope(state, focus.seat, focus.sourceId), ctx);
      if (times <= 0) return state;
      const rest: Instruction = { verb: "RevealEncounter", ...(instruction.who ? { who: instruction.who } : {}), times: times - 1 };
      const queued = times > 1 && effectData(state) ? queueFront(state, [{ instruction: rest, seat: focus.seat, chosen: null }]) : state;
      return startReveal(queued, seat, ctx, steps);
    }
    case "SearchCollection":
      return searchCollection(state, instruction, focus, ctx, steps);
    case "ShuffleVictoryIntoEncounterDeck":
      return shuffleVictoryIn(state, ctx);
    case "ShuffleEncounterDiscard":
      return shuffleDiscardIn(state);
    case "DiscardUntil":
      return discardUntil(state, instruction.types ?? (instruction.type ? [instruction.type] : []), ctx, instruction.trait);
    case "ResolveWhenRevealed": {
      const id = refCard(state, instruction.card ?? "picked", frameScope(state, focus.seat, focus.sourceId));
      const code = id ? state.cards[id]?.code : undefined;
      if (!id || !code) return state;
      const effects = ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
      return pushCardEffects(state, "whenRevealed", id, focus.seat, false, effects, ctx, steps);
    }
    case "RevealFewer": {
      // The player picked last skips that many of their reveals; the other players' are not shortened (143020:A:2).
      const seat = instruction.who === "picked" ? seatOf(lastPicked(state)) : null;
      if (instruction.who === "picked" && seat == null) return state;
      return addTableModifier(state, { stat: instruction.min === 1 ? "revealFewerMinOne" : "revealFewer", amount: instruction.amount, until: "endOfPhase", ...(seat != null ? { seat } : {}) }, focus);
    }
    case "RevealMore":
      return addTableModifier(state, { stat: "revealMore", amount: instruction.amount, until: "endOfPhase" }, focus);
    case "WatchReveals": {
      const when = instruction.type ? { when: { kind: "matches" as const, card: "subject" as const, pick: { type: instruction.type, control: "any" as const } } } : {};
      return addTableModifier(state, { stat: WATCH_STATS[instruction.effect], amount: instruction.amount ?? 1, until: instruction.until, seat: focus.seat, ...when }, focus);
    }
    case "TravelTo": {
      const id = refCard(state, instruction.target ?? "picked", frameScope(state, focus.seat, focus.sourceId));
      return id ? travelThere(state, id, ctx, steps) : state;
    }
    case "ProgressQuest": {
      const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
      if (amount <= 0) return state;
      const before = steps.length;
      const placed = placeQuestProgress(state, amount, ctx.cards, steps, (current) => !restricted(current, ctx, "advance").length);
      return afterProgress(placed, before, ctx, steps);
    }
    case "RaiseThreatTo": {
      const amount = resolveAmount(state, instruction.amount, frameScope(state, focus.seat, focus.sourceId), ctx);
      const threat = state.seats[focus.seat]?.threat ?? 0;
      if (state.seats[focus.seat]?.eliminated || amount <= threat) return state;
      steps.push({ kind: "threat", seat: focus.seat, amount: amount - threat, cause: currentCause(steps, UNATTRIBUTED) });
      return withThreat(state, focus.seat, amount);
    }
    case "LowerThreatByRaise": {
      const amount = answeredRaise(state);
      return amount > 0 ? lowerThreat(state, focus.seat, amount, steps, currentCause(steps, UNATTRIBUTED)) : state;
    }
    case "ReturnEventToHand": {
      const data = effectData(state);
      if (data?.finish !== "discardSource") return state;
      const { finish: _discard, ...kept } = data;
      return patchTop(state, { data: kept });
    }
    default:
      return null;
  }
}

// A card in play immune to player card effects, and the effect is a player card's (mec109.immune-to-player-card-effects).
function shielded(state: ScenarioState, id: string, sourceId: string | null, ctx: ReduceContext): boolean {
  const card = state.cards[id];
  const source = sourceId ? state.cards[sourceId] : undefined;
  if (!card || !inPlay(card.zone) || playerCardEffectCanChoose(printedOf(ctx.cards, card.code), state, id)) return false;
  return source == null || isPlayerType(printedOf(ctx.cards, source.code));
}

// A lasting effect held by the table (every seat), set by the source card.
export function addTableModifier(state: ScenarioState, modifier: Omit<Modifier, "instanceId" | "sourceId">, focus: Focus): ScenarioState {
  return { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: focus.sourceId ?? "table", ...modifier }] };
}

export const manifest: RulesFamily = { name: "encounter", verbs: ["LookAtTop", "PickEncounter", "ArrangeEncounter", "PayResources", "PlayRevealedFree", "MoveEncounterCard", "CountEncounterTop", "RevealEncounter", "SearchCollection", "ShuffleEncounterDiscard", "ShuffleVictoryIntoEncounterDeck", "DiscardUntil", "ResolveWhenRevealed", "RevealFewer", "RevealMore", "WatchReveals", "TravelTo", "ProgressQuest", "RaiseThreatTo", "LowerThreatByRaise", "ReturnEventToHand"], run };
