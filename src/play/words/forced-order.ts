// Rules: rr.forced, rr.first-player, faq.simultaneous-effects (data/rules/entries.json). The first player's order of the Forced effects that trigger at one moment (OrderForced, src/rules/families/encounter/forced-order.ts): the window
// comes from the engine, not from a record, so its words are written here. Each row is a card with its Forced line in its printed words and what that order does, found by sending the Choose on a copy of the game, as the fire rows and
// branchNow read a pick's outcome (the reducer decides, nothing here writes a number).
import type { Instruction } from "../../catalog/boundary.ts";
import { temperatureOf } from "../../rules/families/haradrim/heat.ts";
import type { GameEvent, ScenarioState } from "../../rules/core/state.ts";
import { reduce, type ReduceContext } from "../../rules/engine/reduce.ts";
import { effectById } from "../../rules/windows/listen.ts";
import { topFrame } from "../../rules/windows/windows.ts";

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

// What the table holds that an order can change: the quest stages' progress, the temperature, each seat's threat and the damage on the heroes.
function readings(game: ScenarioState): Readonly<Record<string, number>> {
  const cards = Object.values(game.cards);
  const read: Record<string, number> = {
    progress: cards.filter((card) => card.zone === "questStage").reduce((sum, card) => sum + card.progress, 0),
    damage: cards.filter((card) => card.zone === "heroes").reduce((sum, card) => sum + card.damage, 0),
  };
  const temperature = temperatureOf(game);
  if (temperature != null) read.temperature = temperature;
  game.seats.forEach((seat, at) => {
    read[`threat${at}`] = seat.threat;
  });
  return read;
}

const NAMES: Readonly<Record<string, string>> = { progress: "quest progress", damage: "damage on the heroes", temperature: "temperature" };

/** What the order changes, in the table's own words: "quest progress 6 to 2, temperature 36 to 40". */
function changes(before: ScenarioState, after: ScenarioState): string {
  const was = readings(before);
  const now = readings(after);
  const parts = Object.keys(now).flatMap((key) => {
    const from = was[key] ?? 0;
    if (from === now[key]) return [];
    const seat = /^threat(\d)$/.exec(key);
    const name = seat ? (before.seatCount > 1 ? `Player ${Number(seat[1]) + 1} threat` : "threat") : (NAMES[key] ?? key);
    return [`${name} ${from} to ${now[key]}`];
  });
  return parts.length > 0 ? parts.join(", ") : "nothing else changes";
}

// The order the card's effects initiate in is its own; the result of sending the Choose is read once the effects of that card are done (up to the next question).
function resultOf(game: ScenarioState, ctx: ReduceContext, id: string): string | null {
  const sent = reduce(game, { type: "Choose", optionId: id }, ctx);
  return sent.ok ? changes(game, sent.state) : null;
}

/** The sheet's words: the title, the question and one row for each card that may resolve next. */
export function orderForcedWords(game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, instruction: OrderForced, options: readonly string[]): AskedWords {
  const data = topFrame(game)?.data;
  const left = instruction.entries.length;
  const total = instruction.total ?? left;
  const first = left === total;
  const results = options.map((id) => resultOf(game, ctx, id));
  const same = results.length > 1 && results.every((result) => result != null && result === results[0]);
  const ask = first ? "Choose the one that resolves first." : `Choose the one that resolves next (${left} of ${total} left).`;
  const when = first ? ` ${left} Forced effects trigger ${momentWords(data?.kind === "effect" ? data.orderEvent : undefined)}. ${left === 2 ? "The other resolves after it." : "The rest resolve after it."}` : "";
  const rows = Object.fromEntries(
    options.map((id, at) => {
      const effects = instruction.entries.filter((entry) => entry.sourceId === id).flatMap((entry) => {
        const effect = effectById(ctx, entry.effectId);
        return effect ? [effect] : [];
      });
      const sign = effects.map((effect) => effect.id).join(",");
      const copies = new Set(instruction.entries.filter((entry) => game.cards[entry.sourceId]?.code === game.cards[id]?.code && instruction.entries.filter((other) => other.sourceId === entry.sourceId).map((other) => other.effectId).join(",") === sign).map((entry) => entry.sourceId)).size;
      const line = effects.flatMap((effect) => {
        const text = effect.lines[0] ? names.line?.(effect.lines[0]) : null;
        return text ? [text] : [];
      }).join(" ");
      const result = same || results[at] == null ? null : `Result: ${results[at]}.`;
      return [id, { label: copies > 1 ? `${names.card(id)} (${copies} copies)` : names.card(id), detail: [line, result].filter((part) => part).join(" ") || null }];
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
