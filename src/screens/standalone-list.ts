// The words the standalone screens show for a game: its status on the list and the lines of its outcome. Pure.
import { standaloneStatus, type StandaloneGame, type StandaloneResult } from "../campaign/standalone";

export const STANDALONE_DROPPED = "The game in progress was dropped because the rules or the card data changed. Your decks are kept; deal it again from Scenarios.";

export function seatWord(seatCount: 1 | 2): string {
  return seatCount === 1 ? "True solo" : "Two-handed";
}

/** The game's line under its scenario name on the list: seats, difficulty, and how it stands. */
export function gameCaption(game: StandaloneGame): string {
  const parts = [seatWord(game.seatCount), ...(game.loadout ? [game.loadout.difficulty] : [])];
  return `${parts.join(" · ")} · ${statusWord(game)}`;
}

export function statusWord(game: StandaloneGame): string {
  switch (standaloneStatus(game)) {
    case "playing":
      return "In progress";
    case "won":
      return game.result?.outcome === "won" ? `Won · score ${game.result.score.score}` : "Won";
    case "lost":
      return "Lost";
    case "dropped":
      return "Dropped";
  }
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The lines under Victory or Defeat. A win shows the score and what made it (ltp.scoring); lower is better. */
export function outcomeLines(result: StandaloneResult): string[] {
  if (result.outcome === "lost") return [...(result.reason ? [result.reason] : []), `${plural(result.rounds, "round")} completed.`];
  const { score, rounds, victoryPoints } = result.score;
  return [`Score ${score}. Lower is better.`, `${plural(rounds, "completed round")} · ${plural(victoryPoints, "victory point")}`];
}
