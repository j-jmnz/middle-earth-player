// Rules: rr.forced, rr.first-player, faq.simultaneous-effects (data/rules/entries.json). The first player's order of the Forced effects that trigger at one moment (OrderForced, src/rules/families/encounter/forced-order.ts): the window
// comes from the engine, not from a record, so its words are written here. Each row is a card with its Forced line in its printed words and what that order does, found by sending the Choose on a copy of the game, as the fire rows and
// branchNow read a pick's outcome (the reducer decides, nothing here writes a number).
import type { Instruction } from "../../catalog/boundary.ts";
import type { GameEvent, ScenarioState } from "../../rules/core/state.ts";
import { reduce, type ReduceContext } from "../../rules/engine/reduce.ts";
import { asksForcedOrder } from "../../rules/families/encounter/forced-order.ts";
import { showedHidden } from "../../rules/engine/undo.ts";
import { effectById } from "../../rules/windows/listen.ts";
import { copiesInOrder } from "../../rules/windows/triggers.ts";
import { topFrame } from "../../rules/windows/windows.ts";

import { decidedBy, reachOf, said, type Reach } from "./table-changes.ts";
import type { AskedWords } from "./asks.ts";
import type { ChoiceNames } from "./choice.ts";

type OrderForced = Extract<Instruction, { verb: "OrderForced" }>;

const MOMENTS: Readonly<Record<string, string>> = {
  endOfRound: "at the end of the round",
  revealed: "when a card is revealed",
  traveled: "after the players travel",
  questSucceeded: "after the quest succeeds",
  questFailed: "after the quest fails",
  enteredPlay: "when a card enters play",
  hideFailed: "after a Hide test fails",
  hideSucceeded: "after a Hide test succeeds",
  firstPlayerTokenPassed: "when the first player token passes",
  leftPlay: "when a card leaves play",
  characterDestroyed: "when a character is destroyed",
  engaged: "when an enemy engages a player",
  addedToStaging: "when a card is added to the staging area",
  damaged: "when a character takes damage",
  enemyDestroyed: "when an enemy is destroyed",
  attackResolved: "after an attack",
  stagingStepBegins: "when the staging step begins",
  becameActive: "when a location becomes active",
  played: "when a card is played",
  committed: "when a character commits to the quest",
  threatRaised: "when threat is raised",
};

/** When the Forced effects trigger, said as the cards say it ("at the end of the round", "at the end of the quest phase"). */
function momentWords(event: GameEvent | undefined): string {
  if (event?.trigger === "endOfPhase" && event.phase) return `at the end of the ${event.phase.toLowerCase().replace(/ phase$/, "")} phase`;
  if (event?.trigger === "beginningOfPhase" && event.phase) return `at the beginning of the ${event.phase.toLowerCase().replace(/ phase$/, "")} phase`;
  return (event ? MOMENTS[event.trigger] : undefined) ?? "at the same moment";
}

// The order the card's effects initiate in is its own; the copy is read once the effects of that card are done: the frame of the order has ended (`ended`, the stack is shorter than in the game), or the same order asks again at the same depth (a
// third card or more is left). An order deeper in the stack is another card's own order, so the copy has not settled. A copy that stops on a question of the card's own gives no result, and an order that shows something hidden (a reveal, a shuffle, a random pick) is "hidden": the copy would
// show the card the player may not see yet. Each option costs one reduce (about 1 ms in Desert Crossing, measured with a scratch script: 2 ms for the two-option sheet), and the sheet is built when the window opens, so it keeps no cache (the words hold no module state).
export type Read = { readonly reach: Reach; readonly ended: boolean } | "hidden" | null;

function reachFor(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, id: string): Read {
  const sent = reduce(game, { type: "Choose", optionId: id }, ctx);
  if (!sent.ok) return null;
  if (showedHidden(game, sent.state)) return "hidden";
  const where = settledAt(game, sent.state);
  return where ? { reach: reachOf(game, sent.state, names.card), ended: where === "ended" } : null;
}

/** Where a copy of the game stands after one order was sent: "ended" (the frame of the order is gone), "asking" (the same order asks again at the same depth, a card is left) or null (the card's own question, or another order deeper in the stack: it has not settled). */
export function settledAt(game: ScenarioState, sent: ScenarioState): "ended" | "asking" | null {
  if (sent.stack.length < game.stack.length) return "ended";
  return asksForcedOrder(sent) && sent.stack.length === game.stack.length ? "asking" : null;
}

/** Whether the orders leave the same table: every copy was read to the end of the order (a card left after the first pick would still differ) and they left it alike. */
export function sameResult(reads: readonly Read[]): boolean {
  const known = reads.flatMap((read) => (read && read !== "hidden" ? [read] : []));
  return known.length > 1 && known.length === reads.length && known.every((read) => read.ended && read.reach.table === known[0]?.reach.table);
}

/** The Result of one row: what its order decides when every order was read to its end, all it changes when another is hidden, and why there is none when its own is hidden. Null when the copy stopped on a question of the card's own. */
function resultOf(read: Read, known: readonly Reach[], whole: boolean): string | null {
  if (read === "hidden") return "Result: shown after it resolves (a hidden card turns up).";
  if (read == null) return null;
  return `Result: ${whole ? decidedBy(read.reach, known) : said(read.reach.parts)}.`;
}

/** The sheet's words: the title, the question and one row for each card that may resolve next. */
export function orderForcedWords(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, instruction: OrderForced, options: readonly string[]): AskedWords {
  const data = topFrame(game)?.data;
  const left = instruction.entries.length;
  const total = instruction.total ?? left;
  const first = left === total;
  const reaches = options.map((id) => reachFor(game, ctx, names, id));
  const known = reaches.flatMap((read) => (read && read !== "hidden" ? [read.reach] : []));
  const same = sameResult(reaches);
  // What one order decides is what the others do not do, so it is said only when every order was read to its end; with a card left after the first pick, or a hidden order, each row names all its parts.
  const whole = reaches.every((read) => read != null && read !== "hidden" && read.ended);
  const ask = first ? "Choose the one that resolves first." : `Choose the one that resolves next (${left} of ${total} left).`;
  const when = first ? ` ${left} Forced effects trigger ${momentWords(data?.kind === "effect" ? data.orderEvent : undefined)}. ${left === 2 ? "The other resolves after it." : "The rest resolve after it."}` : "";
  const rows = Object.fromEntries(
    options.map((id, at) => {
      const effects = instruction.entries.filter((entry) => entry.sourceId === id).flatMap((entry) => {
        const effect = effectById(ctx, entry.effectId);
        return effect ? [effect] : [];
      });
      const copies = copiesInOrder(instruction.entries, (sourceId) => game.cards[sourceId]?.code, id);
      const line = effects.flatMap((effect) => {
        const text = effect.lines[0] ? names.line?.(effect.lines[0]) : null;
        return text ? [text] : [];
      }).join(" ");
      const result = same ? null : resultOf(reaches[at] ?? null, known, whole);
      // The Result comes first: on a short phone the row's detail is cut at its foot, and the printed line is the part a long press shows.
      return [id, { label: copies > 1 ? `${names.card(id)} (${copies} copies)` : names.card(id), detail: [result, line].filter((part) => part).join(" ") || null }];
    }),
  );
  return {
    verb: first ? "Resolve first" : "Resolve next",
    title: "Order the Forced effects",
    prompt: `${ask}${when}${same ? (options.length === 2 ? " Same result in either order." : " Same result in any order.") : ""}`,
    owned: true,
    bare: true,
    rows,
  };
}
