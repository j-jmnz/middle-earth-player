// Rules: rr.first-player (data/rules/entries.json). Whose choice the open window is, as the sentence over it says it (docs/design-system-table.md, Choice tray): the player's number leads two-handed, nothing leads solo. Pure.
import type { ScenarioState } from "../../rules/core/state.ts";

// The seat whose decision the open choice is: the one the window asks (a choice, or the look that precedes one), else the first player.
export function askedSeat(game: ScenarioState): number {
  return game.window?.kind === "choose" || game.window?.kind === "look" ? game.window.seat : game.firstPlayer;
}

// Truly Lost's hand (18075:A:1), The Forest of Great Fear's nemesis (18076:A:1) and The Withered Heath's choices: the choice names its number, the side of the table it happens on and whose it is. Two-handed the sentence leads with the player and says so (`owned`: the sheet adds no "Player N chooses." after it); solo it has no lead.
// `at`: the seat the sentence is about when it is not the one the window asks (the defending player, the player who owns a Response).
// `titled`: a sentence led by the card that asks, with the one colon: "Player 1, Crypt Key: choose ...", solo "Crypt Key: choose ...".
export function seatSays(game: ScenarioState, at?: number): { seat: number; owned: { owned?: true }; say: (text: string) => string; titled: (name: string, text: string) => string } {
  const seat = at ?? askedSeat(game);
  const lead = game.seatCount > 1 ? `Player ${seat + 1}: ` : "";
  return {
    seat,
    owned: game.seatCount > 1 ? { owned: true as const } : {},
    say: (text) => (lead ? `${lead}${text}` : `${text.charAt(0).toUpperCase()}${text.slice(1)}`),
    titled: (name, text) => (game.seatCount > 1 ? `Player ${seat + 1}, ${name}: ${text}` : `${name}: ${text}`),
  };
}
