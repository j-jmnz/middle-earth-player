// The words the standalone screens show for a game: its status on the list and the lines of its outcome. Pure.
import { lossText } from "../../campaign/report";
import { standaloneStatus, type ListedStandalone, type StandaloneResult } from "../../campaign/standalone";
import { seatWord } from "../data/seats";


/** The game's line under its scenario name on the list: seats, difficulty, and how it stands. */
export function gameCaption(game: ListedStandalone): string {
  const parts = [seatWord(game.seatCount), ...(game.loadout ? [game.loadout.difficulty] : [])];
  return `${parts.join(" · ")} · ${statusWord(game)}`;
}

export function statusWord(game: ListedStandalone): string {
  switch (standaloneStatus(game)) {
    case "playing":
      return "In progress";
    case "needsChoice":
      return "Needs a choice";
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

/** The lines under Victory or Defeat. A win shows the score and what made it (ltp.scoring); lower is better. A loss gives the engine's reason, or `reason` when the final game is at hand to say the cause of each elimination (rules/core/elimination-words.ts). */
export function outcomeLines(result: StandaloneResult, reason?: string | null): string[] {
  if (result.outcome === "lost") {
    const why = lossText(reason ?? result.reason);
    return [...(why ? [why.endsWith(".") ? why : `${why}.`] : []), `${plural(result.rounds, "round")} completed.`];
  }
  const { score, rounds, victoryPoints } = result.score;
  return [`Score ${score}. Lower is better.`, `${plural(rounds, "completed round")} · ${plural(victoryPoints, "victory point")}`];
}
