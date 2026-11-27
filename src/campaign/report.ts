// Rules: ltp.scoring, rr.scoring, rr.quest-cards-quest-deck, rr.winning-the-game (data/rules/entries.json).
//
// What the end of a scenario shows beyond Victory or Defeat, read from the final game state: when it ended, how far the quest
// got, each player's threat and heroes, the victory display, and for a win the parts of the score. Pure, so a test reads it.
import { stagePlace } from "../rules/families/quest/branch.ts";
import { printedOf, type PrintedCard } from "../rules/core/printed.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import { reanimatedHeroes } from "../rules/families/angmar/reanimate/standing.ts";

import { allHeroesDestroyed, lossText, lossWithCauses } from "../rules/core/elimination-words.ts";
import { scoreParts, scoreTotal } from "./score.ts";

// The screens say a loss reason through this (src/screens imports no rules module).
export { lossText };

export type ReportHero = { name: string; words: string; destroyed: boolean };
export type ReportSeat = { label: string; threat: string; heroes: readonly ReportHero[] };
export type ReportLine = { label: string; value: string };
export type GameReport = {
  // "Won in round 6." or "Lost in round 5, in the combat phase."
  ended: string;
  // "Stage 2 of 3 · A Fork in the Road", and its progress when progress fills it.
  stage: { title: string; detail: string | null } | null;
  seats: readonly ReportSeat[];
  // The cards in the victory display, with their points.
  victory: readonly string[];
  // A win: what the score adds up, ending with the total.
  score: readonly ReportLine[] | null;
  // A loss: the engine's reason with the cause of each elimination after "No seats remain" (rules/core/elimination-words.ts), else null.
  lossReason: string | null;
};

const PHASE_WORDS: Readonly<Record<string, string>> = {
  Resource: "the resource phase",
  Planning: "the planning phase",
  Quest: "the quest phase",
  Travel: "the travel phase",
  Encounter: "the encounter phase",
  Combat: "the combat phase",
  Refresh: "the refresh phase",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function stageLine(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): GameReport["stage"] {
  const card = state.questStage ? state.cards[state.questStage] : undefined;
  if (!card) return null;
  const printed = printedOf(cards, card.code);
  const place = stagePlace(state, card.code);
  const title = place ? `Stage ${place.at} of ${place.of} · ${printed.name}` : printed.name;
  // A won game's last stage was defeated; a stage with no quest points (or 0) is won another way, so no progress is counted.
  const points = printed.questPoints;
  const detail = state.lost && points != null && points > 0 ? `${card.progress} of ${points} progress` : null;
  return { title, detail };
}

function heroWords(cards: ReadonlyMap<string, PrintedCard>, code: string, damage: number): string {
  const health = printedOf(cards, code).health;
  if (damage === 0) return "Unhurt";
  return health != null ? `${damage} damage of ${health} hit points` : plural(damage, "damage");
}

function seatLines(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, destroyed?: ReadonlySet<string>): ReportSeat[] {
  return state.seats.slice(0, state.seatCount).map((seat, index) => {
    const label = state.seatCount > 1 ? `Player ${index + 1}` : "Your heroes";
    const standing = seat.heroes.flatMap((id) => {
      const card = state.cards[id];
      if (!card) return [];
      const name = printedOf(cards, card.code).name;
      return [{ name, words: seat.eliminated ? "Defeated with the player" : heroWords(cards, card.code, card.damage), destroyed: seat.eliminated }];
    });
    const fallen = seat.discard.flatMap((id) => {
      const card = state.cards[id];
      if (!card || printedOf(cards, card.code).type !== "hero") return [];
      // A hero that left play with its eliminated player was not destroyed: only a hero a destroy step named is (the steps are known when the game was replayed).
      const withPlayer = seat.eliminated && destroyed != null && !destroyed.has(id);
      return [{ name: printedOf(cards, card.code).name, words: withPlayer ? "Defeated with the player" : "Destroyed", destroyed: true }];
    });
    // A destroyed hero lying reanimated (mec108.reanimated-dead) is in no discard pile but is still destroyed.
    const reanimated = reanimatedHeroes(state, cards).filter((hero) => hero.seat === index).map((hero) => ({ name: printedOf(cards, hero.code).name, words: "Destroyed", destroyed: true }));
    return { label, threat: seat.eliminated ? "Eliminated" : `Threat ${seat.threat}`, heroes: [...standing, ...fallen, ...reanimated] };
  });
}

function scoreLines(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>): ReportLine[] {
  const parts = scoreParts(state, cards);
  const total = scoreTotal(parts);
  return [
    { label: state.seatCount > 1 ? "Final threat of each player" : "Final threat", value: `+${parts.threat}` },
    { label: "Threat cost of destroyed heroes", value: `+${parts.destroyed}` },
    { label: "Damage on surviving heroes", value: `+${parts.damage}` },
    { label: `${plural(parts.rounds, "completed round")} × 10`, value: `+${10 * parts.rounds}` },
    { label: "Victory points", value: `−${parts.victoryPoints}` },
    { label: "Score", value: String(total) },
  ];
}

/** Why a lost game was lost, in words: the engine's reason, and for "No seats remain" the cause of each elimination, the heroes told from the destroy steps the table kept (`destroyed`). The Resolution screen and the report share it. */
export function lossReasonOf(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, destroyed?: ReadonlySet<string>): string | null {
  return lossWithCauses(state, destroyed && allHeroesDestroyed(state, destroyed, (id) => cards.get(state.cards[id]?.code ?? "")?.type === "hero"));
}

/** The report of a finished scenario: a win when the game is not lost. `destroyed` holds the heroes a destroy step named; with it, a hero of an eliminated player that is in no such step is told as defeated with the player. */
export function gameReport(state: ScenarioState, cards: ReadonlyMap<string, PrintedCard>, destroyed?: ReadonlySet<string>): GameReport {
  const phase = PHASE_WORDS[state.phase];
  const ended = state.lost ? `Lost in round ${state.round}${phase ? `, in ${phase}` : ""}.` : `Won in round ${state.round}.`;
  const victory = state.victory.flatMap((id) => {
    const card = state.cards[id];
    if (!card) return [];
    const printed = printedOf(cards, card.code);
    return [printed.victory ? `${printed.name} (${printed.victory})` : printed.name];
  });
  return { ended, stage: stageLine(state, cards), seats: seatLines(state, cards, destroyed), victory, score: state.lost ? null : scoreLines(state, cards), lossReason: state.lost ? lossReasonOf(state, cards, destroyed) : null };
}
