// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.setup-mount-gundabad, rr.quest-cards-quest-deck, rr.quest-advancement, rr.search, rr.first-player, rr.restricted (data/rules/entries.json); ledger lines 19135:A:2, 19135:B:3, 19142:B:3, 19124:A:1, 19122:A:3.
// Mount Gundabad's quest deck (part 8): the stage 2s are shuffled with side A up beneath stage 1, a stage shows side B from the beginning of the quest phase, the players may bypass the current stage at the end of the combat phase (it loses its progress, goes to the bottom of the
// quest deck and the next stage 2A is revealed), and Throat of the Mountain searches the deck for the current quest. Which stages the quest passes through, and where a defeated one goes, is the quest family's (families/quest/order.ts: a stage with `deck`). A game with no such stage reads none of it.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { raiseThreat, releaseAttachments } from "../../core/keywords.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { flagged, heldAmount, inPlay, livingSeats, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { enforceRestricted } from "../../player/attach.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { askTarget } from "../../windows/choices.ts";
import { effectsOf } from "../../windows/listen.ts";
import { fireForced } from "../../windows/triggers.ts";
import { listenerInPlay } from "../nightmare/guards.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectData } from "../encounter/moves.ts";
import { arrivalFace } from "../quest/order.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

// What a stage of the quest deck does on side B, in a word or two: the stages print one title, so a sheet or a beat that names one tells it from the others by this reading. The first verb a stage's records use decides it.
const READINGS: readonly (readonly [Instruction["verb"], string])[] = [
  ["RaiseThreat", "raises threat"],
  ["UncancelableWhenRevealed", "no canceling"],
  ["DiscardEncounterTop", "encounter discard"],
  ["LimitPlaysPerPhase", "play limit"],
  ["AddToVictory", "can win"],
  ["AttackFromStaging", "attacks"],
  ["DamageCard", "deals damage"],
];

// The verbs of the instructions and of those nested in them (a player's turn, a branch of a Choose).
function verbsIn(steps: readonly Instruction[]): Instruction["verb"][] {
  return steps.flatMap((step) => [step.verb, ...verbsIn(step.verb === "ForEachPlayer" ? step.instructions : step.verb === "Choose" ? step.options.flatMap((option) => option.instructions) : [])]);
}

/** The name `base` of a stage of the quest deck with its reading, "Exploring Gundabad (attacks)"; the name alone for any other card. */
export function stageName(state: ScenarioState, ctx: ReduceContext, cardId: string, base: string): string {
  const code = state.cards[cardId]?.code;
  if (!code || !state.stages.some((stage) => stage.deck === true && stage.code === code)) return base;
  const verbs = new Set(effectsOf(ctx, code).flatMap((effect) => verbsIn(effect.instructions)));
  const reading = READINGS.find(([verb]) => verbs.has(verb));
  return reading ? `${base} (${reading[1]})` : base;
}

/**
 * FlipCurrentQuest: the current quest card shows side B (it was revealed side A and is flipped at the beginning of the quest phase). The stage that reveals the first stage 2 at the end of the planning phase flips it too, since the quest phase
 * begins at once: the engine hears the beginning of a phase before the end of the one before it, so the stage's own Forced effect has passed by then.
 */
export function flipCurrentQuest(state: ScenarioState): ScenarioState {
  const id = state.questStage;
  const stage = id ? state.cards[id] : undefined;
  return id && stage && stage.face === "A" ? updateCard(state, id, { face: "B" }) : state;
}

// How a stage leaves the quest for another: `flipped` the stage that arrives shows side B at once; `shuffle` the stage that left is shuffled into the quest deck, which is shuffled, and the top stage arrives (that stage may be the one that left: 901201:A:2, 03026:A:1);
// `leaves` where the stage goes, the bottom of the quest deck by default or set aside (the stage Hasty Council replaces goes to the victory display next, 03074:B:1).
export type Replace = { readonly flipped: boolean; readonly shuffle?: true; readonly leaves?: "setAside" };

// The current stage leaves the quest with no progress, side A up (emce.bypassing), and `nextId` is revealed in its place: its When Revealed effects resolve. The stage is not defeated, so nothing that hears a defeat is told (stageLeft `bypassed`). With `how.shuffle` the next stage is the top of the shuffled quest deck.
export function replaceCurrent(state: ScenarioState, nextId: string, how: Replace, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const currentId = state.questStage;
  const current = currentId ? state.cards[currentId] : undefined;
  if (!currentId || !current || (currentId === nextId && !how.shuffle)) return state;
  const before = steps.length;
  if (current.progress > 0) steps.push({ kind: "progress", targetId: currentId, amount: -current.progress, cause: currentCause(steps, UNATTRIBUTED) });
  let next = releaseAttachments(state, currentId, ctx.cards, steps);
  next = updateCard(moveCard(next, currentId, { zone: how.leaves ?? "questDeck" }), currentId, { progress: 0, face: "A" });
  if (how.shuffle) next = shuffleDeck(next);
  const arriving = how.shuffle ? (next.questDeck[0] ?? currentId) : nextId;
  next = moveCard(next, arriving, { zone: "questStage" });
  next = updateCard(next, arriving, { face: how.flipped ? "B" : arrivalFace(next, next.cards[arriving]?.code) });
  next = { ...next, stageLeft: { to: arriving, from: currentId, bypassed: true } };
  steps.push({ kind: "advance", cardId: arriving });
  return afterProgress(next, before, ctx, steps);
}

/**
 * BypassStage: the source stage is bypassed (emce.bypassing). With no other stage in the quest deck nothing happens: there is no next stage 2A to reveal. Each player first pays the threat a card in play charges for a bypass (901207:A:1; a raise that eliminates him still lets the bypass happen),
 * and the Nightmare setup card shuffles the stage in and reveals the top of the deck (901201:A:2). The Forced effects that hear a bypass (901205:A:2) resolve before the next stage's When Revealed effects.
 */
export function bypassStage(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = state.questDeck[0];
  if (focus.sourceId == null || focus.sourceId !== state.questStage || top == null) return state;
  const paid = payBypassThreat(state, steps);
  if (paid.lost || paid.failure) return paid;
  const shuffles = flagged(paid, "table", "bypassShuffles");
  return announceBypassed(replaceCurrent(paid, top, shuffles ? { flipped: false, shuffle: true } : { flipped: false }, ctx, steps), ctx, steps);
}

// "As an additional cost to bypass a quest card, each player must raise his threat by 2" (901207:A:1): each copy in play adds its amount (the `bypassThreat` the table holds).
function payBypassThreat(state: ScenarioState, steps: EngineStep[]): ScenarioState {
  const cost = heldAmount(state, "table", "bypassThreat");
  let next = state;
  if (cost > 0) for (const seat of livingSeats(state)) next = raiseThreat(next, seat, cost, steps, currentCause(steps, UNATTRIBUTED));
  return next;
}

// The stage has gone to the quest deck, and a Forced effect that hears "a quest card is bypassed" (901205:A:2) resolves for each seat, the first player's first, below the new stage's When Revealed frames pushed already.
function announceBypassed(state: ScenarioState, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  if (!listenerInPlay(state, "stageBypassed", ctx.effects)) return state;
  let next = state;
  for (const seat of [...livingSeats(state)].reverse()) next = fireForced(next, { trigger: "stageBypassed", seat }, ctx, steps);
  return next;
}

/** Whether a stage can be bypassed now: the quest deck holds another stage to reveal. */
export function canBypass(state: ScenarioState): boolean {
  return state.questDeck.length > 0 && state.questStage != null;
}

/**
 * SearchQuestDeck (19124:A:1): the actor chooses a stage of the quest deck; it becomes the current quest in place of the stage now current, which returns to the quest deck as a bypassed stage does, and shows side B at once. The quest deck, with the stage that was current in it,
 * is shuffled with the game's seed. The stage is revealed, so its When Revealed effects resolve. Run where nobody can be asked, the top stage is taken.
 */
export function searchQuestDeck(state: ScenarioState, instruction: Verb<"SearchQuestDeck">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const options = state.questDeck;
  if (options.length === 0 || state.questStage == null) return state;
  const chosen = focus.chosen ?? (options.length === 1 ? options[0] : undefined);
  if (chosen == null || !options.includes(chosen)) {
    if (effectData(state)) return askTarget(state, { instruction, seat: focus.seat, chosen: null, cause: currentCause(steps, UNATTRIBUTED) }, options);
    return shuffleDeck(replaceCurrent(state, options[0] ?? "", { flipped: true }, ctx, steps));
  }
  return shuffleDeck(replaceCurrent(state, chosen, { flipped: true }, ctx, steps));
}

export function shuffleDeck(state: ScenarioState): ScenarioState {
  const rolled = shuffleIds(state.questDeck, state.seed, state.seedCursor);
  return { ...state, questDeck: rolled.ids, seedCursor: rolled.cursor };
}

/**
 * FlipInPlace: the card in play with the code shows its other side `into`, where it lies, keeping its tokens and attachments; with `attachTo: "picked"` it then moves to the hero last picked (a hero any player controls), leaving the card it was attached to ("flip Wormsbane to its Reforged
 * side and attach it to any hero", 19122:A:3). Announced to the cards that hear a flip (and, with `entersPlay`, as entering play). The host then discards any Restricted attachment over its limit.
 */
export function flipInPlace(state: ScenarioState, instruction: Verb<"FlipInPlace">, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const card = Object.values(state.cards).find((candidate) => candidate.code === instruction.code && inPlay(candidate.zone));
  if (!card) return state;
  let next = queueEvent(updateCard(state, card.id, { code: instruction.into, other: card.code }), { trigger: "flippedOver", seat: null, cardId: card.id });
  // The card that enters play by the flip (09072:A:1, Savage Counter-attack) hears it as any card entering play does.
  if (instruction.entersPlay) next = queueEvent(next, { trigger: "enteredPlay", seat: card.controller, cardId: card.id });
  const hostId = instruction.attachTo ? lastPicked(next) : "";
  const host = next.cards[hostId];
  if (!host || host.zone !== "heroes" || host.controller == null || card.host === hostId) return next;
  const old = card.host ? next.cards[card.host] : undefined;
  if (old) next = updateCard(next, old.id, { attachments: old.attachments.filter((id) => id !== card.id) });
  // The Reforged side is Restricted: a hero who now carries more than the limit discards the excess (rr.restricted).
  return enforceRestricted(attachTo(moveCard(next, card.id, { zone: "play", seat: host.controller }), card.id, hostId), hostId, ctx, steps);
}
