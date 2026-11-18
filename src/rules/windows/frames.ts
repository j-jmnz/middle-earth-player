// Rules: rr.step-3-3, rr.staging, rr.surge, rr.treachery-cards, rr.running-out-of-cards, ltp.revealed-treachery,
// mec109.saga-staging-rules, mec109.peril, ltp.staging-placement, ltp.staging-treachery, faq.last-encounter-card
// (data/rules/entries.json).
import { effectStep, pushCardEffects } from "../interpret/effect-frames.ts";
import { currentCause, ruleCause } from "../core/cause.ts";
import type { EngineStep } from "../core/intents.ts";
import type { ReduceContext } from "../interpret/interpret.ts";
import { hideStep, pushHide } from "../quest/hide.ts";
import { fortitudeStep } from "../families/mount-doom/fortitude.ts";
import { escapeStep } from "../families/escape/test.ts";
import { encounterRaised } from "../families/quest/threat.ts";
import { raiseThreat } from "../core/keywords.ts";
import { queueEvent } from "./queue.ts";
import { offerResponses, responseStep } from "./responses.ts";
import { printedOf } from "../core/printed.ts";
import { flagged, heldAmount, inPlay, livingSeats, updateCard, withMode, type Frame, type ScenarioState } from "../core/state.ts";
import { eventStep, fireForced } from "./triggers.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { resetEncounterDeck, shuffleEncounterDeck } from "../interpret/verbs.ts";
import { attachTo, moveCard, turnedUp } from "../core/zones.ts";
import { announceEntered, listens, noteEncounterThreat, revealSeat, revealSkipped, revealsAllowed, spendSkippedReveal, watchReveal } from "../families/encounter/reveal.ts";
import { discardsAfterReveal } from "../families/sidequests/encounter.ts";
import { engageWith } from "../quest/quest.ts";
import { sharing, stagingDest } from "../families/breaking/areas.ts";
import { grapplesOnReveal, pushGrapple } from "../families/grapple/attach.ts";
import { skipLoot } from "../families/wilderland/loot.ts";
import { familyRevealed } from "../interpret/family-hooks.ts";
import { gainedDoomed } from "../families/deck/gains-doomed.ts";
import { gameReads } from "../core/game-reads.ts";
import { whenRevealedIgnored } from "../families/angmar/safe.ts";

// A frame that waits for a player lives on state.stack. settle advances the top one
// until it pops or opens a window.
export function advanceFrame(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const frame = topFrame(state);
  if (!frame) return state;
  // The action window that was open when an event was announced comes back.
  if (frame.data.kind === "resume") {
    return { ...popFrame(state, steps), window: frame.data.window, activeSeat: frame.data.seat, passed: frame.data.passed };
  }
  switch (frame.frame) {
    case "reveal":
      return revealStep(state, frame, ctx, steps);
    case "hide":
      return hideStep(state, frame, ctx, steps);
    case "fortitude":
      return fortitudeStep(state, frame, ctx, steps);
    case "escape":
      return escapeStep(state, frame, ctx, steps);
    case "response":
      return responseStep(state, ctx, steps);
    default:
      if (frame.data.kind === "effect") return effectStep(state, frame, ctx, steps);
      if (frame.data.kind === "event") return eventStep(state, frame, ctx, steps);
      throw new Error(`Frame ${frame.frame} cannot resume`);
  }
}

// Reveals the top card of the encounter deck, or the card an effect found.
export function startReveal(
  state: ScenarioState,
  seat: number,
  ctx: ReduceContext,
  steps: EngineStep[],
  cardId?: string,
  // The objective the card guards (families/objectives.ts).
  guards?: string,
  // An enemy found by a search is put into play engaged with the revealing seat, not staged (SearchReveal `to: engaged`).
  engage?: boolean,
  // The found card lay in the encounter discard pile (SearchReveal): the `revealed` event says so, for "revealed from the encounter deck" (09016:A:3).
  fromDiscard?: boolean,
): ScenarioState {
  // A Loot card on top of the deck is discarded, not revealed (emce.loot).
  const skipped = cardId ? { state, top: cardId } : skipLoot(resetEncounterDeck(state, steps, ctx), ctx, steps);
  const ready = skipped.state;
  const id = skipped.top;
  const instance = id ? ready.cards[id] : undefined;
  if (!id || !instance) return ready;
  const peril = printedOf(ctx.cards, instance.code).keywords.peril;
  const fromDeck = cardId == null ? { fromDeck: true } : {};
  return pushFrame(ready, { frame: "reveal", cardId: id, seat, peril, data: { kind: "reveal", hide: null, surge: false, ...fromDeck, ...(fromDiscard ? { fromDiscard: true as const } : {}), ...(guards ? { guards } : {}), ...(engage ? { engage: true as const } : {}) } }, steps);
}

// A reveal started by an effect instruction. It cannot wait for a player, so a Hide test or any other
// window inside it fails the intent.
export function revealNow(state: ScenarioState, seat: number, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const base = state.stack.length;
  // The window the effect was triggered from stays aside while the reveal resolves, so only a
  // window opened by the reveal itself fails the intent.
  const entryWindow = state.window;
  let next = startReveal({ ...state, window: null }, seat, ctx, steps);
  for (let guard = 0; guard < 400; guard += 1) {
    if (next.lost || next.failure) return next;
    // A failure makes reduce reject the intent and return the pre-intent state, so the window
    // the reveal opened is discarded with the rest of this result and the entry window is not restored.
    if (next.window) return { ...next, failure: "A reveal inside an effect cannot wait for a player" };
    if (next.stack.length <= base) return { ...next, window: entryWindow };
    next = advanceFrame(next, ctx, steps);
  }
  throw new Error("Reveal inside an effect exceeded its step limit");
}

export function stagingStep(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // "Skip the staging step of the quest phase for the remainder of the game" (01128:B:2): nothing is revealed and nothing hears the
  // step begin or end; the quest resolves next.
  if (state.revealCursor == null && flagged(state, "table", "skipStaging")) return withMode(state, "resolution");
  // The staging step begins: Forced effects "at the beginning of the staging step" (141051:A:2) resolve before the first
  // card is revealed (rr.step-3-3). The cursor is set first, so the step begins once.
  if (state.revealCursor == null) {
    const begun: ScenarioState = { ...state, revealCursor: { seats: livingSeats(state), index: 0 } };
    // Responses "after the players have committed characters to the quest" (17057:A:2) are offered too, after the Forced ones.
    const event = { trigger: "stagingStepBegins", seat: null } as const;
    return fireForced(offerResponses(begun, event, ctx, steps), event, ctx, steps);
  }
  const cursor = state.revealCursor;
  // "Reveal 1 less card from the encounter deck this phase" (RevealFewer) ends the step early.
  // Cards beyond one per player ("reveal an additional encounter card") are revealed by the players in turn from the first.
  const seat = cursor.index < revealsAllowed(state, cursor.seats.length) ? revealSeat(state, cursor.index, cursor.seats) : undefined;
  if (seat == null || state.lost || state.failure) {
    const ended: ScenarioState = { ...withMode(state, "resolution"), revealCursor: null };
    // Responses "at the end of the staging step" (22145:A:1).
    // The Forced effects of the end of the step resolve before them ("Forced: At the end of the staging step", 12014:B:2).
    const over = { trigger: "stagingStepEnds", seat: null } as const;
    return state.lost || state.failure ? ended : fireForced(offerResponses(ended, over, ctx, steps), over, ctx, steps);
  }
  const advanced: ScenarioState = { ...state, revealCursor: { seats: cursor.seats, index: cursor.index + 1 } };
  if (advanced.seats[seat]?.eliminated) return advanced;
  // A player who reveals fewer cards this phase skips this reveal (RevealFewer `who: picked`).
  const skipped = state.modifiers.length > 0 ? revealSkipped(state, seat) : null;
  if (skipped) return spendSkippedReveal(advanced, skipped);
  return startReveal(advanced, seat, ctx, steps);
}

function revealStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = frame.cardId;
  if (!id || frame.data.kind !== "reveal") throw new Error("Reveal frame lost its card");
  const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
  const seat = frame.seat;
  // The card's effects were canceled just after it was revealed: it goes back into the encounter deck and the same
  // seat reveals another card (141001:A:1).
  // A card a Response discarded as it canceled it (The Door is Closed!, 10092:A:1) is not returned: the reveal is over.
  if (frame.data.canceled && frame.step >= 1) return state.cards[id]?.zone === "staging" ? revealAnother(state, frame, ctx, steps) : resetEncounterDeck(popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps), steps, ctx);
  switch (frame.step) {
    case 0: {
      // Into the revealing seat's own staging area once stages are separate (mec109.multiple-staging-areas).
      const engages = frame.data.engage === true && printed.type === "enemy";
      let next = engages ? engageWith(state, seat, id, steps) : moveCard(state, id, stagingDest(state, seat));
      next = updateCard(next, id, { face: turnedUp(next, id), controller: seat });
      // A guard is attached to its objective as it is placed (rr.guarded); the objective may have left play since.
      if (frame.data.guards && next.cards[frame.data.guards] && inPlay(next.cards[frame.data.guards]?.zone ?? "removed")) next = updateCard(attachTo(next, id, frame.data.guards), id, { guard: true });
      steps.push({ kind: "reveal", seat, cardId: id, cause: currentCause(steps, ruleCause("mec109.saga-staging-rules")) });
      if (printed.keywords.peril) next = { ...next, perilSeat: seat };
      // The families that note a reveal (the first treachery of the round, families/wilderland/rounds.ts) hear it before the card's own effects.
      next = familyRevealed(next, id, ctx);
      // The lasting effects that watch the reveals act on the card; one may discard it, ending its staging.
      next = watchReveal(next, frame, ctx, steps);
      if (next.stack.length < state.stack.length) return next;
      // An enemy with Grapple attaches to a location in the staging area as it is revealed, and is not added to the staging area (dcce.grapple).
      if (grapplesOnReveal(next, id, ctx)) return pushGrapple(patchTop(next, { step: 1 }), id, seat, steps);
      // "After an enemy is added to the staging area" hears the card arrive.
      if (!engages) next = queueEvent(next, { trigger: "addedToStaging", seat, cardId: id });
      next = patchTop(next, { step: 1 });
      // A Forced effect on the reveal of a location (148004:B:1) resolves before the Responses to the reveal are offered; one that cancels the reveal leaves none to offer.
      if (printed.type === "location" && listens(next, ctx, "locationRevealed")) {
        const forced = fireForced(next, { trigger: "locationRevealed", seat, cardId: id }, ctx, steps);
        if (forced !== next) return forced;
      }
      // A card just revealed from the encounter deck: a Response may cancel its effects before any of them resolves.
      return frame.data.fromDeck ? offerResponses(next, { trigger: "encounterRevealed", seat, subject: id }, ctx, steps) : next;
    }
    case 1: {
      let next = patchTop(state, { step: 2 });
      // The Doomed a card in play gives it (Troll-fells gives each Weather card Doomed 1, 10077:A:1) comes on top of the printed number.
      // The Doomed the card gives itself (`gainsDoomed`, Wight of Rhudaur, 10099:A:2) comes on top as well, and the Doomed a reveal marker or a lasting effect grants it as it is revealed (families/angmar/weather.ts).
      const printedDoomed = printed.keywords.doomed ?? 0;
      const gainedFromPlay = gameReads(next, ctx, '"GainsDoomed"') ? gainedDoomed(next, id, seat, ctx) : 0;
      const heldDoomed = next.modifiers.length > 0 ? heldAmount(next, id, "gainsDoomed") : 0;
      const revealDoomed = frame.data.kind === "reveal" ? (frame.data.extraDoomed ?? 0) : 0;
      const doomed = printedDoomed + gainedFromPlay + heldDoomed + revealDoomed;
      if (doomed > 0) {
        // The players sharing the staging area it was added to, once stages are separate and the game has joined areas (families/captured/).
        const sharers = next.capture && next.separate ? sharing(next, seat) : null;
        for (let index = 0; index < next.seatCount; index += 1) {
          if (sharers && !sharers.includes(index)) continue;
          next = noteEncounterThreat(raiseThreat(next, index, doomed, steps, ruleCause("rr.doomed-x")), index, doomed, id, ctx);
        }
        // An encounter card's Doomed raise is heard by Elfhelm (02100:A:1).
        next = encounterRaised(next, livingSeats(next), id, ctx);
      }
      return next;
    }
    case 2: {
      const next = patchTop(state, { step: 3 });
      const hide = printed.keywords.hide;
      if (hide == null || state.seats[seat]?.eliminated) return next;
      return pushHide(next, frame, hide, steps);
    }
    case 3:
      return runRevealed(patchTop(state, { step: 4 }), id, seat, frame.peril, ctx, steps);
    case 4:
      // The Responses "after an enemy is revealed" (142067:B:2) are offered once the Forced effects of the reveal have resolved: their frame goes under those.
      const heard = { trigger: "revealed", seat, cardId: id, ...(frame.data.fromDeck ? { fromDeck: true } : {}), ...(frame.data.kind === "reveal" && frame.data.fromDiscard ? { fromDiscard: true as const } : {}) } as const;
      return fireForced(offerResponses(patchTop(state, { step: 5 }), heard, ctx, steps), heard, ctx, steps);
    case 5: {
      // A revealed treachery is resolved, then placed in the encounter discard pile unless its text says otherwise
      // (ltp.revealed-treachery, rr.treachery-cards, rr.step-3-3). A treachery whose text attached it (a Condition) has
      // left the staging area and stays where its text put it. A canceled treachery is discarded too (rr.cancel). Peril
      // covers that card's staging only, so the lock ends before surge (mec109.peril, rr.surge).
      const resolved = (printed.type === "treachery" || discardsAfterReveal(printed)) && state.cards[id]?.zone === "staging" ? moveCard(state, id, { zone: "encounterDiscard" }) : state;
      const unlocked = frame.peril && resolved.perilSeat === seat ? { ...resolved, perilSeat: null } : resolved;
      // A card still in play has entered play (rr.staging, step 3): "After a location enters play" (04060:A:1).
      const next = patchTop(announceEntered(unlocked, id, seat, ctx), { step: 6 });
      const revealing = next.seats[seat];
      // Each separate instance of surge reveals 1 additional card (rr.surge): the printed keyword, each gain from a card in play and each grant made during this reveal.
      // The surge a card gives itself is read before a treachery leaves the staging area, while its constants still hold (Groping Horror, 50324:A:2).
      const surges = (printed.keywords.surge ? 1 : 0) + heldAmount(state, id, "gainsSurge") + (frame.data.kind === "reveal" ? (frame.data.surge ? 1 : 0) + (frame.data.extraSurge ?? 0) : 0);
      if (surges <= 0 || !revealing || revealing.eliminated || frame.data.kind !== "reveal") return next;
      // The instances still to answer wait in the frame (step 6 reveals the next card when the one just revealed is done).
      return startReveal(surges > 1 ? patchTop(next, { data: { ...frame.data, surgeLeft: surges - 1 } }) : next, seat, ctx, steps);
    }
    case 6:
      if (frame.data.kind === "reveal" && (frame.data.surgeLeft ?? 0) > 0 && !state.seats[seat]?.eliminated) {
        return startReveal(patchTop(state, { data: { ...frame.data, surgeLeft: (frame.data.surgeLeft ?? 0) - 1 } }), seat, ctx, steps);
      }
      return finishReveal(state, frame, ctx, steps);
    default:
      return finishReveal(state, frame, ctx, steps);
  }
}

function finishReveal(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  // The revealed card's staging is resolved: an encounter deck it emptied is reset now (faq.last-encounter-card).
  return resetEncounterDeck(popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps), steps, ctx);
}

function revealAnother(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const id = frame.cardId ?? "";
  const popped = popFrame(frame.peril ? { ...state, perilSeat: null } : state, steps);
  const discarded = frame.data.kind === "reveal" && frame.data.discard === true;
  const returned = state.cards[id]
    ? discarded
      ? moveCard(popped, id, { zone: "encounterDiscard" })
      : shuffleEncounterDeck(updateCard(moveCard(popped, id, { zone: "encounterDeck" }), id, { face: "down", controller: null }))
    : popped;
  if (returned.seats[frame.seat]?.eliminated) return returned;
  return startReveal(returned, frame.seat, ctx, steps, undefined, frame.data.kind === "reveal" ? frame.data.guards : undefined);
}

function runRevealed(
  state: ScenarioState,
  id: string,
  seat: number,
  peril: boolean,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const code = state.cards[id]?.code;
  if (!code) return state;
  // A safe location that is active makes the players ignore the "when revealed" effects of every treachery (mec108.safe).
  const effects = whenRevealedIgnored(state, id, ctx) ? [] : ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  return pushCardEffects(state, "whenRevealed", id, seat, peril, effects, ctx, steps);
}
