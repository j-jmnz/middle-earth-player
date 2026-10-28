import type { Condition, Effect, Instruction } from "../catalog/boundary.ts";
import { frameScope, refCard, resolveAmount } from "./amounts.ts";
import { beginEffect } from "./cancel.ts";
import { effectCause, inCause, type Cause } from "./cause.ts";
import { beginEnemyAttack } from "./combat.ts";
import { askTarget, openBranch } from "./choices.ts";
import { hasTrait, holds, outOfPlayChoices, searchable } from "./conditions.ts";
import { applyTargetVerb, targetCandidates } from "./effect-verbs.ts";
import { startReveal } from "./frames.ts";
import { pushHide } from "./hide.ts";
import type { EngineStep } from "./intents.ts";
import { runInstruction, type ReduceContext } from "./interpret.ts";
import { runEncounterItem } from "./families/encounter-items.ts";
import { moveEncounter } from "./families/encounter-moves.ts";
import { chooseEach } from "./families/deck-each.ts";
import { lookedDeckSeat } from "./families/deck-rules.ts";
import { attachHostChooser, highestThreatSeats } from "./families/play-hooks.ts";
import { pickCandidates } from "./pick.ts";
import { printedOf } from "./printed.ts";
import { attachBlocked, restrictedAttachments } from "./restrictions.ts";
import type { CancelOffer, EffectData, Frame, FrameName, QueueItem, ScenarioState } from "./state.ts";
import { livingSeats, updateCard, withSeat } from "./state.ts";
import { offerResponses } from "./responses.ts";
import { holdsNow, seatFor, shuffleIntoEncounterDeck } from "./verbs.ts";
import { patchTop, popFrame, pushFrame, topFrame } from "./windows.ts";
import { discardRestricted } from "./families/objectives-claimed.ts";
import { attachTo, moveCard } from "./zones.ts";
import { chooseAmount } from "./families/defense.ts";
import { dealAttackShadow } from "./families/defense-listen.ts";

export type EffectSpec = {
  frame: FrameName;
  sourceId: string | null;
  actor: number;
  peril: boolean;
  effectId: string;
  instructions: readonly Instruction[];
  cancel: CancelOffer | null;
  blockCancel: Condition | null;
  // The window to open again when the frame pops.
  resume?: EffectData["resume"];
  finish?: EffectData["finish"];
  eventSeat?: number | null;
  participants?: readonly string[];
  // The X an event was played for.
  x?: number;
  // A delayed effect starts with the card it was made for already picked.
  picked?: readonly string[];
  // The card the answered event was about, and the other card it names.
  subject?: string;
  other?: string;
  // The damage the answered event dealt, and the card whose destruction waits while the effect resolves.
  dealt?: number;
  hold?: string;
  // Why the instructions run: the effect record and its printed line. `causes` names one per instruction when several
  // records share a frame.
  cause?: Cause;
  causes?: readonly (Cause | undefined)[];
};

// A frame that can stop for a player. Its instructions wait in data, so settle resumes it.
export function pushEffectFrame(state: ScenarioState, spec: EffectSpec, steps: EngineStep[]): ScenarioState {
  const data: EffectData = {
    kind: "effect",
    effectId: spec.effectId,
    actor: spec.actor,
    queue: spec.instructions.map((instruction, at): QueueItem => {
      const cause = spec.causes?.[at] ?? spec.cause;
      return { instruction, seat: spec.actor, chosen: null, ...(cause ? { cause } : {}) };
    }),
    returned: 0,
    canceled: false,
    cancel: spec.cancel,
    blockCancel: spec.blockCancel,
    uncancelable: false,
    wait: null,
    resume: spec.resume ?? null,
    ...(spec.finish ? { finish: spec.finish } : {}),
    ...(spec.eventSeat != null ? { eventSeat: spec.eventSeat } : {}),
    ...(spec.x != null ? { x: spec.x } : {}),
    ...(spec.participants ? { participants: spec.participants } : {}),
    ...(spec.picked ? { picked: spec.picked } : {}),
    ...(spec.subject ? { subject: spec.subject } : {}),
    ...(spec.other ? { other: spec.other } : {}),
    ...(spec.dealt != null ? { dealt: spec.dealt } : {}),
    ...(spec.hold ? { hold: spec.hold } : {}),
  };
  return pushFrame(state, { frame: spec.frame, cardId: spec.sourceId, seat: spec.actor, peril: spec.peril, data }, steps);
}

// All the effects of one timing on a card share one frame. An effect whose condition fails is left out.
export function pushCardEffects(
  state: ScenarioState,
  frame: FrameName,
  sourceId: string,
  actor: number,
  peril: boolean,
  effects: readonly Effect[],
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const scope = { actor, sourceId, returned: 0 };
  const running = effects.filter((effect) => !effect.condition || holds(state, effect.condition, scope, ctx));
  const first = running[0];
  if (!first) return state;
  return pushEffectFrame(
    state,
    {
      frame,
      sourceId,
      actor,
      peril,
      effectId: first.id,
      instructions: running.flatMap((effect) => effect.instructions),
      causes: running.flatMap((effect) => effect.instructions.map(() => effectCause(effect))),
      cancel: null,
      blockCancel: running.find((effect) => effect.uncancelable)?.uncancelable ?? null,
    },
    steps,
  );
}

// The frame under a "when revealed" frame is the staging of that same card: it was revealed from the encounter deck.
function revealedFromEncounterDeck(state: ScenarioState, frame: Frame): boolean {
  const at = state.stack.findIndex((entry) => entry.id === frame.id);
  const below = at > 0 ? state.stack[at - 1] : undefined;
  return below?.frame === "reveal" && below.cardId === frame.cardId;
}

export function effectStep(state: ScenarioState, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = frame.data;
  if (data.kind !== "effect") throw new Error(`Frame ${frame.frame} lost its effect data`);
  if (frame.step === 0) {
    if (data.canceled) return reopen(finishEvent(popFrame(state, steps), frame, data), data);
    // The "when revealed" effects of a card are about to resolve: a Response may cancel them first (rr.cancel). The only
    // such Response is A Test of Will, which cancels those "of a card that was just revealed from the encounter deck"
    // (01050:A:1); revealing from the encounter deck is staging (rr.staging), the `reveal` frame. A quest stage reached by
    // advancing (141026:B:1, 141027:A:1) was not revealed from the encounter deck, so nothing is offered against it.
    // An effect that cannot be canceled now is not offered to those Responses at all.
    const blocked = data.blockCancel != null && holds(state, data.blockCancel, { actor: frame.seat, sourceId: frame.cardId, returned: 0 }, ctx);
    if (frame.frame === "whenRevealed" && frame.cardId && !data.interrupted && !blocked && revealedFromEncounterDeck(state, frame)) {
      const offered = offerResponses(state, { trigger: "whenRevealedPending", seat: frame.seat, subject: frame.cardId }, ctx, steps);
      if (offered.stack.length === state.stack.length) return beginEffect(state, frame, data, ctx);
      // Remember that the offer was made, so the frame begins when the Responses are done.
      const stack = offered.stack.map((entry) => (entry.id === frame.id && entry.data.kind === "effect" ? { ...entry, data: { ...entry.data, interrupted: true } } : entry));
      return { ...offered, stack };
    }
    return beginEffect(state, frame, data, ctx);
  }
  const [item, ...rest] = data.queue;
  if (data.canceled || !item) return reopen(finishEvent(popFrame(state, steps), frame, data), data);
  const advanced = patchTop(state, { data: { ...data, queue: rest } });
  return finishWhenDone(runItem(advanced, item, frame, data.returned, ctx, steps), frame.id);
}

// An event goes to the discard pile as soon as its last instruction has run, before the Responses to what it did are
// offered, unless the effect is still waiting for a choice.
function finishWhenDone(state: ScenarioState, frameId: string): ScenarioState {
  const top = topFrame(state);
  if (!top || top.id !== frameId || top.data.kind !== "effect") return state;
  const data = top.data;
  if (data.finish !== "discardSource" || data.queue.length > 0 || data.wait || state.window) return state;
  const { finish: _done, ...rest } = data;
  return patchTop(finishEvent(state, top, data), { data: rest });
}

// An event played from the hand is discarded once its effect is done, canceled or not (rr.cancel).
function finishEvent(state: ScenarioState, frame: Frame, data: EffectData): ScenarioState {
  const id = frame.cardId;
  const instance = id ? state.cards[id] : undefined;
  if (data.finish !== "discardSource" || !id || !instance || instance.zone !== "hand" || instance.controller == null) return state;
  return moveCard(state, id, { zone: "discard", seat: instance.controller });
}

// An Action used in a window gives that window back once its frame is done.
function reopen(state: ScenarioState, data: EffectData): ScenarioState {
  if (!data.resume) return state;
  return { ...state, window: data.resume.window, activeSeat: data.resume.seat, passed: [] };
}

function runItem(
  state: ScenarioState,
  item: QueueItem,
  frame: Frame,
  returned: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  if (!holdsNow(state, instruction, { actor: item.seat, sourceId: frame.cardId, returned }, ctx)) return state;
  return inCause(steps, item.cause, () => runItemNow(state, item, frame, returned, ctx, steps));
}

function runItemNow(
  state: ScenarioState,
  item: QueueItem,
  frame: Frame,
  returned: number,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  // The encounter family's verbs that ask a player to choose get the queue item, so the choice comes back to them.
  const encounter = runEncounterItem(state, item, frame, ctx, steps);
  if (encounter) return encounter;
  switch (instruction.verb) {
    case "Choose":
      return openBranch(state, item, returned, ctx);
    case "ForEachPlayer":
      return expandPlayers(state, instruction, item.cause);
    case "Each":
      return expandEach(state, item, frame, ctx);
    case "Repeat":
      return expandRepeat(state, item, frame, ctx);
    case "DiscardFromHand":
      return expandDiscards(state, item, frame, ctx);
    case "HideTest":
      return pushHide(state, { cardId: frame.cardId, seat: item.seat, peril: frame.peril }, instruction.x, steps);
    case "ImmediateAttack":
      return immediateAttack(state, frame.cardId, ctx, steps);
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
    case "ReturnToStaging":
    case "AttachSelf":
    case "SearchMove":
    case "SearchReveal":
    case "ShuffleIntoDeck":
    case "DiscardRestricted":
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return targeted(state, item, frame, ctx, steps);
    case "Pick":
      return pick(state, item, frame, ctx);
    case "ArrangeTop":
      return arrangeTop(state, item);
    // The actor chooses the effect's X (defense family).
    case "ChooseAmount":
      return chooseAmount(state, item, frame, ctx);
    default:
      return runInstruction(state, instruction, { seat: item.seat, sourceId: frame.cardId, ...(item.chosen ? { chosen: item.chosen } : {}) }, ctx, steps);
  }
}

function expandPlayers(
  state: ScenarioState,
  instruction: Extract<Instruction, { verb: "ForEachPlayer" }>,
  cause: Cause | undefined,
): ScenarioState {
  const data = topFrame(state)?.data;
  if (data?.kind !== "effect") return state;
  const seats = livingSeats(state);
  const ordered = instruction.order === "lastFirst" ? [...seats].reverse() : seats;
  const expanded = ordered.flatMap((seat) =>
    instruction.instructions.map((entry): QueueItem => ({ instruction: entry, seat, chosen: null, ...(cause ? { cause } : {}) })),
  );
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

// "Each Dwarf character": the cards that match now, each in turn the picked card for the instructions (a Pick with its choice
// already made), and nobody chooses.
function expandEach(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  const data = topFrame(state)?.data;
  if (instruction.verb !== "Each" || data?.kind !== "effect") return state;
  // "Up to 4 Rohan allies", "any number of Gondor allies": the actor chooses them (families/deck-each.ts).
  if (instruction.upTo != null) return chooseEach(state, item, frame, ctx);
  const ids = pickCandidates(state, instruction.pick, item.seat, [], frame.cardId, ctx, data.x, data.participants, false, { subject: data.subject ?? null, other: data.other ?? null });
  const cause = item.cause ? { cause: item.cause } : {};
  const expanded = ids.flatMap((id) => [
    { instruction: { verb: "Pick" as const, pick: instruction.pick }, seat: item.seat, chosen: id, ...cause },
    ...instruction.instructions.map((entry): QueueItem => ({ instruction: entry, seat: item.seat, chosen: null, ...cause })),
  ]);
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

// "Resolve that effect again for each copy of ~ in your discard pile": the instructions, that many times (read once, now).
function expandRepeat(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  const data = topFrame(state)?.data;
  if (instruction.verb !== "Repeat" || data?.kind !== "effect") return state;
  const times = resolveAmount(state, instruction.times, frameScope(state, item.seat, frame.cardId), ctx);
  const cause = item.cause ? { cause: item.cause } : {};
  const expanded = Array.from({ length: times }, () => instruction.instructions.map((entry): QueueItem => ({ instruction: entry, seat: item.seat, chosen: null, ...cause }))).flat();
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

// The actor chooses a card in their hand and discards it, that many times.
function expandDiscards(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  const data = topFrame(state)?.data;
  if (instruction.verb !== "DiscardFromHand" || data?.kind !== "effect") return state;
  const count = Math.min(resolveAmount(state, instruction.amount, frameScope(state, item.seat, frame.cardId), ctx), state.seats[item.seat]?.hand.length ?? 0);
  const cause = item.cause ? { cause: item.cause } : {};
  const pick = { verb: "Pick" as const, pick: { type: "card" as const, control: "you" as const, from: "hand" as const } };
  const expanded = Array.from({ length: count }, (): QueueItem[] => [
    { instruction: pick, seat: item.seat, chosen: null, ...cause },
    { instruction: { verb: "DiscardPicked" as const }, seat: item.seat, chosen: null, ...cause },
  ]).flat();
  return patchTop(state, { data: { ...data, queue: [...expanded, ...data.queue] } });
}

// The enemy attacks the player it is engaged with, and the frame waits for the defense window.
function immediateAttack(state: ScenarioState, sourceId: string | null, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const enemy = sourceId ? state.cards[sourceId] : undefined;
  if (!sourceId || enemy?.zone !== "engaged" || enemy.controller == null) return state;
  // An attack an effect makes is dealt a shadow card of its own (families/defense-listen.ts).
  const dealt = dealAttackShadow(state, sourceId, ctx);
  const begun = beginEnemyAttack(dealt, enemy.controller, sourceId, ctx, steps);
  if (!begun.pendingAttack) return begun;
  return { ...begun, pendingAttack: { ...begun.pendingAttack, immediate: true } };
}

function hasEnemyType(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const instance = state.cards[id];
  return instance != null && printedOf(ctx.cards, instance.code).type === "enemy";
}

function candidates(state: ScenarioState, item: QueueItem, sourceId: string | null, ctx: ReduceContext): string[] {
  const instruction = item.instruction;
  switch (instruction.verb) {
    case "ReturnToStaging": {
      const target = instruction.target;
      const source = sourceId ? state.cards[sourceId] : undefined;
      if (target.kind === "self") return sourceId ? [sourceId] : [];
      if (target.kind === "host") return source?.host ? [source.host] : [];
      if (target.kind === "activeLocation") return state.activeLocation && state.activeLocation !== sourceId ? [state.activeLocation] : [];
      if (target.kind === "picked" || target.kind === "subject" || target.kind === "attacker" || target.kind === "other") {
        const id = refCard(state, target.kind, frameScope(state, item.seat, sourceId));
        return id && hasEnemyType(state, id, ctx) && state.cards[id]?.zone === "engaged" ? [id] : [];
      }
      const seats = target.who === "actor" ? [item.seat] : livingSeats(state);
      return seats
        .flatMap((seat) => state.seats[seat]?.engaged ?? [])
        .filter((id) => hasEnemyType(state, id, ctx))
        .filter((id) => !target.trait || hasTrait(state, id, target.trait, ctx));
    }
    case "AttachSelf": {
      const code = sourceId ? state.cards[sourceId]?.code : undefined;
      const free = (id: string): boolean =>
        !(state.cards[id]?.attachments ?? []).some((other) => state.cards[other]?.code === code) &&
        (code == null || !attachBlocked(state, ctx, id, code));
      if (instruction.to.kind === "hero") {
        const everyone = instruction.to.control === "any" || instruction.to.control === "highestThreatCost";
        const seats = everyone ? livingSeats(state) : instruction.to.control === "highestThreat" ? highestThreatSeats(state) : [item.seat];
        const except = instruction.to.exceptSphere;
        const heroes = seats.flatMap((seat) => state.seats[seat]?.heroes ?? []);
        // "The hero with the highest threat cost" (41043:A:2): the heroes in play whose printed threat cost is the greatest.
        const top = instruction.to.control === "highestThreatCost" ? Math.max(...heroes.map((id) => printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0)) : null;
        return heroes
          .filter((id) => top == null || (printedOf(ctx.cards, state.cards[id]?.code ?? "").threat ?? 0) === top)
          .filter(free)
          .filter((id) => except == null || printedOf(ctx.cards, state.cards[id]?.code ?? "").sphere !== except);
      }
      const trait = instruction.to.trait;
      return [...state.staging, ...livingSeats(state).flatMap((seat) => state.seats[seat]?.engaged ?? [])]
        .filter((id) => hasEnemyType(state, id, ctx) && hasTrait(state, id, trait, ctx))
        .filter(free);
    }
    case "SearchMove":
    case "SearchReveal": {
      const found = searchable(state, instruction, ctx);
      const required = instruction.verb === "SearchMove" && instruction.require ? searchable(state, { code: instruction.require }, ctx) : [];
      return required.length > 0 ? required : found;
    }
    case "ShuffleIntoDeck":
      return searchable(state, instruction, ctx, ["encounterDiscard"]);
    case "DiscardRestricted":
      return sourceId ? restrictedAttachments(state, sourceId, ctx) : [];
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return outOfPlayChoices(state, instruction.code);
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return targetCandidates(state, instruction, item.seat, ctx);
    default:
      return [];
  }
}

// A Pick records its choice on the frame: nothing to choose records "", one candidate is taken, several ask the player.
function pick(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext): ScenarioState {
  const instruction = item.instruction;
  const data = topFrame(state)?.data;
  if (instruction.verb !== "Pick" || data?.kind !== "effect") return state;
  // The actor chooses, unless the card says the first player does.
  const chooser = instruction.pick.who === "firstPlayer" ? state.firstPlayer : item.seat;
  const found = pickCandidates(state, instruction.pick, chooser, data.picked ?? [], frame.cardId, ctx, data.x, data.participants);
  const options = (instruction.pick.from ?? "play") === "play" ? found : distinctByCode(state, found);
  let chosen = item.chosen;
  if (!chosen) {
    if (options.length > 1) return askTarget(state, { ...item, seat: chooser }, options);
    chosen = options[0] ?? "";
  }
  // A look at the top of a deck: the cards seen are put back by ArrangeTop.
  const looked = instruction.pick.top != null ? { looked: (state.seats[chooser]?.deck ?? []).slice(0, instruction.pick.top) } : {};
  return patchTop(state, { data: { ...data, ...looked, picked: [...(data.picked ?? []), chosen] } });
}

// Puts the cards a Pick looked at, those still in the deck, back on top in the order the actor chooses: the card for the
// top position first, then the next, until one choice is left.
function arrangeTop(state: ScenarioState, item: QueueItem): ScenarioState {
  const data = topFrame(state)?.data;
  // The deck the looked cards are in: the actor's, or the player's whose deck the actor looked at (Gandalf's Search).
  const owner = (data?.kind === "effect" ? lookedDeckSeat(state, data) : null) ?? item.seat;
  const seat = state.seats[owner];
  if (data?.kind !== "effect" || !seat) return state;
  const offset = item.offset ?? 0;
  const count = (data.looked ?? []).filter((id) => seat.deck.includes(id)).length;
  const rest = seat.deck.slice(offset, count);
  if (rest.length <= 1 || distinctByCode(state, rest).length <= 1) return state;
  if (!item.chosen) return askTarget(state, { ...item, offset }, distinctByCode(state, rest));
  const from = seat.deck.indexOf(item.chosen);
  if (from < offset) return state;
  const deck = [...seat.deck];
  [deck[offset], deck[from]] = [deck[from] ?? "", deck[offset] ?? ""];
  const arranged = withSeat(state, owner, { ...seat, deck });
  if (rest.length <= 2) return arranged;
  const next = topFrame(arranged)?.data;
  if (next?.kind !== "effect") return arranged;
  return patchTop(arranged, { data: { ...next, queue: [{ ...item, chosen: null, offset: offset + 1 }, ...next.queue] } });
}

// Different copies of one card are the same choice. Only different cards make the player pick.
function distinctByCode(state: ScenarioState, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const code = state.cards[id]?.code ?? id;
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function picksOne(instruction: Instruction): boolean {
  if (instruction.verb === "ReturnToStaging") return instruction.target.kind === "engagedEnemies" && instruction.target.pick === "choose";
  // "Add each Nazgûl enemy found": every match goes, and nobody chooses.
  if (instruction.verb === "SearchMove") return instruction.each !== true;
  return true;
}

function targeted(state: ScenarioState, item: QueueItem, frame: Frame, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const found = candidates(state, item, frame.cardId, ctx);
  let ids = found;
  if (item.chosen) {
    ids = [item.chosen];
  } else if (item.instruction.verb === "ShuffleOutOfPlayIntoEncounterDeck") {
    // On an encounter or quest effect the first player picks among the choices (rr.first-player).
    if (found.length > 1) return askTarget(state, { ...item, seat: state.firstPlayer }, found);
    ids = found.slice(0, 1);
  } else if (picksOne(item.instruction)) {
    const distinct = distinctByCode(state, found);
    const chooser = attachHostChooser(state, item.instruction, item.seat);
    if (distinct.length > 1) return askTarget(state, { ...item, seat: chooser }, distinct);
    ids = found.slice(0, 1);
  }
  return applyTargeted(state, item, ids, frame.cardId, ctx, steps);
}

function applyTargeted(
  state: ScenarioState,
  item: QueueItem,
  ids: readonly string[],
  sourceId: string | null,
  ctx: ReduceContext,
  steps: EngineStep[],
): ScenarioState {
  const instruction = item.instruction;
  const first = ids[0];
  switch (instruction.verb) {
    case "ReturnToStaging": {
      let next = state;
      let count = 0;
      for (const id of ids) {
        if (!next.cards[id]) continue;
        next = updateCard(moveCard(next, id, { zone: "staging" }), id, { controller: null });
        count += 1;
      }
      const data = topFrame(next)?.data;
      return data?.kind === "effect" ? patchTop(next, { data: { ...data, returned: data.returned + count } }) : next;
    }
    case "AttachSelf": {
      if (!first || !sourceId || !state.cards[sourceId]) return state;
      const attached = attachTo(moveCard(state, sourceId, { zone: "attached" }), sourceId, first);
      return updateCard(attached, sourceId, { face: "up" });
    }
    case "SearchMove": {
      let next = state;
      for (const id of instruction.each ? ids : ids.slice(0, 1)) {
        // "Put it into play engaged with you" (41013:A:1): the searching player engages it as it enters play (rr.engaged), so Forced effects
        // that hear an engagement hear this one.
        if (instruction.to === "engaged") {
          next = moveEncounter(next, id, "engaged", item.seat, ctx, steps);
          continue;
        }
        next = instruction.to === "staging" ? moveCard(next, id, { zone: "staging" }) : moveCard(next, id, { zone: "engaged", seat: state.firstPlayer });
        if (instruction.each) next = updateCard(next, id, { face: "up" });
      }
      return next;
    }
    case "SearchReveal":
      return first ? startReveal(state, seatFor(state, instruction.who, item.seat), ctx, steps, first) : state;
    case "ShuffleIntoDeck":
    case "ShuffleOutOfPlayIntoEncounterDeck":
      return first ? shuffleIntoEncounterDeck(state, first) : state;
    case "DiscardRestricted":
      return first ? discardRestricted(state, first) : state;
    case "ReadyHero":
    case "BarAttack":
    case "PlaceProgressOnLocation":
      return applyTargetVerb(state, instruction, first, sourceId, item.seat, ctx, steps);
    default:
      return state;
  }
}
