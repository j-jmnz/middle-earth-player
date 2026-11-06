// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.setup-mount-gundabad, rr.quest-cards-quest-deck, rr.quest-advancement, rr.search, rr.first-player (data/rules/entries.json); ledger lines 19135:A:2, 19135:B:3, 19142:B:3, 19124:A:1, 19122:A:3.
// Mount Gundabad's quest deck (part 8): the stage 2s are shuffled with side A up beneath stage 1, a stage shows side B from the beginning of the quest phase, the players may bypass the current stage at the end of the combat phase (it loses its progress, goes to the bottom of the
// quest deck and the next stage 2A is revealed), and Throat of the Mountain searches the deck for the current quest. Which stages the quest passes through, and where a defeated one goes, is the quest family's (families/quest/order.ts: a stage with `deck`). A game with no such stage reads none of it.
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import { releaseAttachments } from "../../core/keywords.ts";
import { shuffleIds } from "../../core/seed.ts";
import type { ScenarioState } from "../../core/state.ts";
import { inPlay, updateCard } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { lastPicked } from "../../interpret/player-verbs.ts";
import { afterProgress } from "../../quest/stage-reveal.ts";
import { askTarget } from "../../windows/choices.ts";
import { queueEvent } from "../../windows/queue.ts";
import { effectData } from "../encounter/moves.ts";
import { arrivalFace } from "../quest/order.ts";
import type { Focus } from "../index.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/**
 * FlipCurrentQuest: the current quest card shows side B (it was revealed side A and is flipped at the beginning of the quest phase). The stage that reveals the first stage 2 at the end of the planning phase flips it too, since the quest phase
 * begins at once: the engine hears the beginning of a phase before the end of the one before it, so the stage's own Forced effect has passed by then.
 */
export function flipCurrentQuest(state: ScenarioState): ScenarioState {
  const id = state.questStage;
  const stage = id ? state.cards[id] : undefined;
  return id && stage && stage.face === "A" ? updateCard(state, id, { face: "B" }) : state;
}

// The current stage leaves the quest for the bottom of the quest deck with no progress, side A up (emce.bypassing), and `nextId` is revealed in its place: its When Revealed effects resolve. The stage is not defeated, so nothing that hears a defeat is told (stageLeft `bypassed`).
function replaceCurrent(state: ScenarioState, nextId: string, flip: boolean, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const currentId = state.questStage;
  const current = currentId ? state.cards[currentId] : undefined;
  if (!currentId || !current || currentId === nextId) return state;
  const before = steps.length;
  if (current.progress > 0) steps.push({ kind: "progress", targetId: currentId, amount: -current.progress, cause: currentCause(steps, UNATTRIBUTED) });
  let next = releaseAttachments(state, currentId, ctx.cards, steps);
  next = updateCard(moveCard(next, currentId, { zone: "questDeck" }), currentId, { progress: 0, face: "A" });
  next = moveCard(next, nextId, { zone: "questStage" });
  next = updateCard(next, nextId, { face: flip ? "B" : arrivalFace(next, next.cards[nextId]?.code) });
  next = { ...next, stageLeft: { to: nextId, from: currentId, bypassed: true } };
  steps.push({ kind: "advance", cardId: nextId });
  return afterProgress(next, before, ctx, steps);
}

/** BypassStage: the source stage is bypassed (emce.bypassing). With no other stage in the quest deck nothing happens: there is no next stage 2A to reveal. */
export function bypassStage(state: ScenarioState, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const top = state.questDeck[0];
  return focus.sourceId != null && focus.sourceId === state.questStage && top != null ? replaceCurrent(state, top, false, ctx, steps) : state;
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
    return shuffleDeck(replaceCurrent(state, options[0] ?? "", true, ctx, steps));
  }
  return shuffleDeck(replaceCurrent(state, chosen, true, ctx, steps));
}

function shuffleDeck(state: ScenarioState): ScenarioState {
  const rolled = shuffleIds(state.questDeck, state.seed, state.seedCursor);
  return { ...state, questDeck: rolled.ids, seedCursor: rolled.cursor };
}

/**
 * FlipInPlace: the card in play with the code shows its other side `into`, where it lies, keeping its tokens and attachments; with `attachTo: "picked"` it then moves to the hero last picked (a hero any player controls), leaving the card it was attached to ("flip Wormsbane to its Reforged
 * side and attach it to any hero", 19122:A:3). Announced to the cards that hear a flip.
 */
export function flipInPlace(state: ScenarioState, instruction: Verb<"FlipInPlace">): ScenarioState {
  const card = Object.values(state.cards).find((candidate) => candidate.code === instruction.code && inPlay(candidate.zone));
  if (!card) return state;
  let next = queueEvent(updateCard(state, card.id, { code: instruction.into, other: card.code }), { trigger: "flippedOver", seat: null, cardId: card.id });
  const hostId = instruction.attachTo ? lastPicked(next) : "";
  const host = next.cards[hostId];
  if (!host || host.zone !== "heroes" || host.controller == null || card.host === hostId) return next;
  const old = card.host ? next.cards[card.host] : undefined;
  if (old) next = updateCard(next, old.id, { attachments: old.attachments.filter((id) => id !== card.id) });
  return attachTo(moveCard(next, card.id, { zone: "play", seat: host.controller }), card.id, hostId);
}
