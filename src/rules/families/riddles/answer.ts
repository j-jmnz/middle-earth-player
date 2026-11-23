// Rules: hob.riddles, hob.riddles-steps-2-and-3 (data/rules/entries.json); ledger lines 131079:A:2, 131075:A:2, 131076:A:2, 131077:A:2, 131080:A:2, 131081:A:1, 131081:A:2, 131082:A:2, 131083:A:1, 131083:A:2, 131084:A:1. Answering a riddle: the first player names the items the riddle asks for, his deck is shuffled
// and the top cards are discarded, Bilbo's Magic Ring may discard more, and each discarded card that matches every named item is 1 progress on stage 2. The steps queue behind AnswerRiddle as RiddleStep verbs, so the player's choices come back to them; what the first player named and the
// discarded cards are kept on the running effect (`named`: "riddle:open", "riddle:<item>:<name>", "riddle:card:<id>"). Bilbo's Magic Ring is asked after the top cards come off (its Action is used while answering).
import type { Instruction } from "../../../catalog/boundary.ts";

import { currentCause, UNATTRIBUTED } from "../../core/cause.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { printedOf } from "../../core/printed.ts";
import type { QueueItem } from "../../windows/frame-types.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { queueEvent } from "../../windows/queue.ts";
import { askTarget } from "../../windows/choices.ts";
import { patchTop } from "../../windows/windows.ts";
import { effectData, moveEncounter } from "../encounter/moves.ts";
import { discardFromDeck } from "../deck/moves.ts";
import { queueFront } from "../play/refs.ts";
import type { Focus } from "../index.ts";
import { areaStage, ringReady } from "./area.ts";
import { riddleOf, riddlesIgnored } from "./conditions.ts";

type Verb<Name extends Instruction["verb"]> = Extract<Instruction, { verb: Name }>;

/** What the first player may name, by item (hob.riddles-steps-2-and-3): card types, spheres, and the printed costs of the player cards (0 to 6). */
export const NAMES = {
  type: ["ally", "event", "attachment", "treasure"],
  sphere: ["leadership", "spirit", "lore", "tactics", "baggins"],
  cost: ["0", "1", "2", "3", "4", "5", "6"],
} as const;

const KEPT = "riddle:";

function withNamed(state: ScenarioState, change: (named: readonly string[]) => readonly string[]): ScenarioState {
  const data = effectData(state);
  return data ? patchTop(state, { data: { ...data, named: change(data.named ?? []) } }) : state;
}

const named = (state: ScenarioState, item: string): string | undefined => (effectData(state)?.named ?? []).findLast((entry) => entry.startsWith(`${KEPT}${item}:`))?.slice(KEPT.length + item.length + 1);

/** Whether a discarded player card matches every item the first player named: its printed type, its printed sphere (a card with none matches no sphere), its printed cost (an X or no cost matches no number). */
function matches(state: ScenarioState, id: string, ctx: ReduceContext): boolean {
  const printed = printedOf(ctx.cards, state.cards[id]?.code ?? "");
  const type = named(state, "type");
  const sphere = named(state, "sphere");
  const cost = named(state, "cost");
  if (type != null && printed.type !== type) return false;
  if (sphere != null && printed.sphere !== sphere) return false;
  return cost == null || (printed.cost != null && Number(printed.cost) === Number(cost));
}

/** AnswerRiddle: the riddle of the source card (or the picked one) is answered by the first player: its steps are queued in front of the rest of the effect. Nothing happens while riddles are ignored or no riddle is named. */
export function answerRiddle(state: ScenarioState, instruction: Verb<"AnswerRiddle">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const data = effectData(state);
  if (!data || riddlesIgnored(state, ctx)) return state;
  const id = instruction.card === "picked" ? data.picked?.at(-1) : focus.sourceId;
  const code = id ? state.cards[id]?.code : undefined;
  if (!id || !code || !riddleOf(ctx, code)) return state;
  const riddle = riddleOf(ctx, code);
  if (!riddle) return state;
  const cause = currentCause(steps, UNATTRIBUTED);
  const seat = state.firstPlayer;
  const step = (verb: Verb<"RiddleStep">): QueueItem => ({ instruction: verb, seat, chosen: null, cause });
  const queued: QueueItem[] = [
    ...riddle.names.map((item) => step({ verb: "RiddleStep", step: "name", item, card: id })),
    step({ verb: "RiddleStep", step: "discard", card: id }),
    step({ verb: "RiddleStep", step: "ring", card: id }),
    step({ verb: "RiddleStep", step: "finish", card: id }),
  ];
  // The riddle starts clean: the names and cards of an earlier riddle of this effect (It Likes Riddles?, 131081:A:1) are forgotten.
  return queueFront(withNamed(state, (kept) => [...kept.filter((entry) => !entry.startsWith(KEPT)), `${KEPT}open`]), queued);
}

/** One step of an answered riddle (RiddleStep). */
export function riddleStep(state: ScenarioState, instruction: Verb<"RiddleStep">, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const seat = state.firstPlayer;
  const cause = currentCause(steps, UNATTRIBUTED);
  switch (instruction.step) {
    case "name": {
      const item = instruction.item;
      if (!item) return state;
      const options: readonly string[] = NAMES[item];
      if (focus.chosen == null || !options.includes(focus.chosen)) return askTarget(state, { instruction, seat, chosen: null, cause }, options);
      return withNamed(state, (kept) => [...kept, `${KEPT}${item}:${focus.chosen}`]);
    }
    case "discard":
      return discardCards(state, instruction.card, ctx, true, riddleOf(ctx, state.cards[instruction.card]?.code ?? "")?.discard ?? 0);
    case "ring":
      return ringStep(state, instruction, focus, ctx, cause);
    case "finish":
      return finishRiddle(state, instruction.card, ctx, steps);
  }
}

// The top cards of the first player's deck go to the discard pile and are kept as the riddle's cards. A riddle shuffles first; the Ring's extra card does not.
function discardCards(state: ScenarioState, card: string, ctx: ReduceContext, shuffle: boolean, amount: number): ScenarioState {
  const before = effectData(state)?.discardedFromDecks?.length ?? 0;
  const next = discardFromDeck(state, { verb: "DiscardFromDeck", amount, ...(shuffle ? { shuffle: true } : {}) }, { seat: state.firstPlayer, sourceId: card }, ctx);
  const found = (effectData(next)?.discardedFromDecks ?? []).slice(before);
  return withNamed(next, (kept) => [...kept, ...found.map((id) => `${KEPT}card:${id}`)]);
}

// "Action: When answering a riddle, spend 1 Baggins resource to discard an additional player card from the top of your deck" (131079:A:2): asked while Bilbo holds a resource and the Ring is on him, until the first player stops.
function ringStep(state: ScenarioState, instruction: Verb<"RiddleStep">, focus: Focus, ctx: ReduceContext, cause: QueueItem["cause"]): ScenarioState {
  const ready = ringReady(state, ctx);
  if (!ready || (state.seats[state.firstPlayer]?.deck.length ?? 0) === 0) return state;
  if (focus.chosen == null) return askTarget(state, { instruction, seat: state.firstPlayer, chosen: null, ...(cause ? { cause } : {}) }, ["ring", "stop"]);
  if (focus.chosen !== "ring") return state;
  const spent = updateCard(state, ready.bilbo.id, { resources: ready.bilbo.resources - ready.spend });
  const more = discardCards(spent, instruction.card, ctx, false, ready.discard);
  return queueFront(more, [{ instruction, seat: state.firstPlayer, chosen: null, ...(cause ? { cause } : {}) }]);
}

/** The cards the open riddle has discarded so far, each with whether it matches every name, and how many match (the words of the Ring's question read it). Empty when no riddle is open. */
export function riddleResult(state: ScenarioState, ctx: ReduceContext): { cards: readonly { id: string; match: boolean }[]; hits: number } {
  const cards = (effectData(state)?.named ?? []).filter((entry) => entry.startsWith(`${KEPT}card:`)).map((entry) => entry.slice(KEPT.length + 5)).map((id) => ({ id, match: matches(state, id, ctx) }));
  return { cards, hits: cards.filter((card) => card.match).length };
}

// The matches are counted: each is 1 progress on stage 2, no match fails the riddle, and the source card is discarded unless it lies elsewhere already.
function finishRiddle(state: ScenarioState, card: string, ctx: ReduceContext, steps: EngineStep[]): ScenarioState {
  const { hits } = riddleResult(state, ctx);
  const stage = areaStage(state);
  let next = state;
  if (stage && hits > 0) {
    next = updateCard(next, stage.id, { progress: stage.progress + hits });
    steps.push({ kind: "progress", targetId: stage.id, amount: hits, cause: currentCause(steps, UNATTRIBUTED) });
  }
  if (hits === 0) next = queueEvent(next, { trigger: "riddleFailed", seat: state.firstPlayer });
  if (state.cards[card]?.zone === "staging") next = moveEncounter(next, card, "discard", state.firstPlayer, ctx, steps);
  const data = effectData(next);
  return data ? patchTop(next, { data: { ...data, x: hits, named: (data.named ?? []).filter((entry) => !entry.startsWith(KEPT)) } }) : next;
}
