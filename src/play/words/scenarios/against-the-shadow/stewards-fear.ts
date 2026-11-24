// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear-underworld-deck, rr.running-out-of-cards, rr.player-elimination (data/rules/entries.json); ledger lines 06011:A:1, 06011:B:3, 06012:B:3, 06013:B:1, 06018:A:1, 06019:A:1, 06020:A:1, 06021:A:1, 06022:A:1, 06029:A:1, 06030:A:1, 06030:A:2, 06031:A:1.
// The words of The Steward's Fear' table pieces: the underworld deck's count, the facedown cards under an Underworld location, the Underworld X chip's value, the resource tokens that advance stages 1 and 2, Up in Flames' discard and its loss, and the extra reveal and threat of the two other Plots.
// A sentence never names a facedown card or says in what order the underworld deck lies. Each stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words). Pure.
import { plural } from "../../list.ts";

/** The top-bar dial of the underworld deck: what it counts and where it goes. */
export const deckDialWords = (count: number): string =>
  `${plural(count, "card")} left in the underworld deck, facedown and out of play. An Underworld location that enters play takes its top cards. Stage 3B shuffles what is left into the encounter deck.`;

/** The dial's name for a screen reader. */
export const deckDialName = "Cards in the underworld deck:";

/** The pill on a location that holds facedown underworld cards, and what a screen reader hears of it. */
export const stackPill = (count: number): { text: string; loses: boolean; speech: string; count: number } => ({
  text: `${count} underworld`,
  count,
  loses: false,
  speech: `${plural(count, "facedown underworld card")} underneath`,
});

/** The line under a location's name in its preview: how many facedown cards lie under it, and that they are staged when it leaves play. */
export const stackWords = (count: number): string =>
  count === 0
    ? "No facedown cards lie under it."
    : count === 1
      ? "1 facedown underworld card lies under it, out of play. It is staged when the location leaves play, however it leaves."
      : `${count} facedown underworld cards lie under it, out of play. They are staged one at a time when the location leaves play, however it leaves.`;

/** The top-bar dial of the resource tokens on stage 1 or 2: the Clues and each explored location add them. */
export const clueDialWords = (tokens: number, limit: number): string =>
  `${tokens} of ${limit} resource tokens on this quest. A location explored while it is active adds 1, and a Clue adds its own. At ${limit} the stage advances at once.`;

export const clueDialName = (name: string): string => `Resource tokens on ${name}, toward the stage advancing:`;

/** The line a stage 1 or 2 preview adds. */
export const clueStageWords = (tokens: number, limit: number): string => `${tokens} of ${limit} resource tokens: at ${limit} it advances at once, in any phase.`;

/** Stage 3B: the deck is gone. */
export const deckGoneWords = "The underworld deck is in the encounter deck now. An Underworld location takes no cards. The cards already under locations stay there.";

/** Up in Flames' dial: the tokens, and X for the next discard (the token comes first). */
export const flamesDialWords = (tokens: number): string =>
  `Up in Flames holds ${tokens}. At the end of the round it gets 1 more, then each player discards that many cards from the top of their deck. Any player with no cards left loses the game for all.`;

export const flamesDialName = (tokens: number): string => `Resource tokens on Up in Flames, ${tokens}, the next discard is ${tokens + 1}:`;

/** The warning when a deck holds no more than the next discard. `owner` is "Player 2's" or "your". */
export const flamesNearWords = (owner: string, cards: number, next: number): string => `${owner[0]?.toUpperCase()}${owner.slice(1)} deck holds ${plural(cards, "card")}. The next discard is ${next}, which empties it, and the game is lost.`;

/** Up in Flames' preview line. */
export const flamesWords = (tokens: number): string => `${plural(tokens, "resource token")}. At the end of the round it gets 1 more, then each player discards that many cards. An empty deck loses the game.`;

/** Unholy Alliance's preview line. */
export const allianceWords = "Each staging step reveals 1 additional card, not 1 for each player. A hero destroyed by an enemy attack loses the game.";

/** Poisoned Counsels' preview line. */
export const counselsWords = "At the end of each round each player raises their threat by 2.";
