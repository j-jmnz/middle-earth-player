// Rules: ats.underworld, ats.underworld-example, ats.setup-the-stewards-fear-underworld-deck, rr.running-out-of-cards, rr.player-elimination (data/rules/entries.json); ledger lines 06011:A:1, 06011:B:3, 06012:B:3, 06013:B:1, 06018:A:1, 06019:A:1, 06020:A:1, 06021:A:1, 06022:A:1, 06029:A:1, 06030:A:1, 06030:A:2, 06031:A:1.
// The words of The Steward's Fear table pieces: the underworld deck's count, the facedown cards under an Underworld location, the Underworld X chip's value, the resource tokens that advance stages 1 and 2, Up in Flames' discard and its loss, and the extra reveal and threat of the two other Plots.
// A sentence never names a facedown card or says in what order the underworld deck lies. Each stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words). Pure.
import { plural } from "../../list.ts";

/** The top-bar dial of the underworld deck: what it counts and where it goes. */
export const deckDialWords = (count: number): string =>
  `${plural(count, "card")} left in the underworld deck, facedown and out of play. An Underworld location that enters play takes its top cards. Stage 3B shuffles what is left into the encounter deck.`;

/** The panel a tap on the Underworld dial opens: the same words, one idea to a line. */
export const deckDialLists = (count: number): readonly { heading: string; lines: readonly string[] }[] => [
  { heading: "The underworld deck", lines: [`${plural(count, "card")} left, facedown and out of play.`, "An Underworld location that enters play takes its top cards.", "Stage 3B shuffles what is left into the encounter deck."] },
];

/** The dial's name for a screen reader. */
export const deckDialName = "Cards in the underworld deck:";

/** The pill on a location that holds facedown underworld cards, and what a screen reader hears of it. */
export const stackPill = (count: number): { text: string; loses: boolean; speech: string; count: number } => ({
  text: `${count} facedown`,
  count,
  loses: false,
  speech: `${plural(count, "facedown underworld card")} underneath`,
});

/** The line under a location's name in its preview: how many facedown cards lie under it, and that they are staged when it leaves play. */
export const stackWords = (count: number): string =>
  count === 0
    ? "No facedown cards lie under it."
    : count === 1
      ? "1 facedown underworld card lies under it. When it leaves play, it is revealed and added to the staging area."
      : `${count} facedown underworld cards lie under it. When it leaves play, they are revealed one at a time and added to the staging area.`;

/** The top-bar dial of the resource tokens on stage 1 or 2: the Clues and each explored location add them. */
const tokenSource = "An explored location adds 1, and a claimed Clue adds its own.";

export const clueDialWords = (tokens: number, limit: number): string =>
  `${tokens} of ${limit} resource tokens on this quest. ${tokenSource} At ${limit} the stage advances at once.`;

export const clueDialName = (name: string): string => `Resource tokens on ${name}, toward the stage advancing:`;

/** The line a stage 1 or 2 preview adds. */
export const clueStageWords = (tokens: number, limit: number): string => `${tokens} of ${limit} resource tokens. ${tokenSource} At ${limit} it advances at once, in any phase.`;

/** Stage 3B: the deck is gone. */
export const deckGoneWords = "The underworld deck is in the encounter deck now. An Underworld location takes no cards. The cards already under locations stay there.";

/** Up in Flames' dial: the tokens, and X for the next discard (the token comes first). */
export const flamesDialWords = (tokens: number): string =>
  `Up in Flames holds ${plural(tokens, "resource token")}. At the end of the round it gets 1 more, then each player discards that many cards from the top of their deck: the next discard is ${tokens + 1}. Any player with no cards left loses the game for all.`;

export const flamesDialName = (tokens: number): string => `Resource tokens on Up in Flames, ${tokens}, the next discard is ${tokens + 1}:`;

/** The warning when a deck holds no more than the next discard: each seat that is short, in seat order. `owner` is "Player 2's" or "your". */
export const flamesNearWords = (short: readonly { owner: string; cards: number }[], next: number): string => {
  const decks = short.map(({ owner, cards }, at) => `${at === 0 ? `${owner[0]?.toUpperCase()}${owner.slice(1)}` : owner} deck holds ${plural(cards, "card")}`).join(", and ");
  return `${decks}. The next discard is ${next}, which empties ${short.length > 1 ? "them" : "it"}, and the game is lost.`;
};

/** Up in Flames' preview line. */
export const flamesWords = (tokens: number): string => `Holds ${plural(tokens, "resource token")}. At the end of the round it gets 1 more, then each player discards that many cards: the next discard is ${tokens + 1}. An empty deck loses the game.`;

/** The banner group for the cards that move between the underworld deck, a location and the staging area. */
export const UNDERWORLD_TITLE = "Underworld";

/** The banner line for cards that went facedown under a location: the count and the place, never a card. */
export const takesWords = (count: number, host: string): string => `${plural(count, "card")} from the underworld deck ${count === 1 ? "goes" : "go"} facedown under ${host}`;

/** The banner line for a card revealed from under a location that left play. */
export const releasedWords = (card: string, host: string): string => `Revealed ${card} from under ${host}`;

/** The set-aside list's line: the facedown cards are the underworld deck and the Villain and Plot the Setup hides (kinds the rules make public, never a name). `deck` of the `count` lie in the deck. */
export const facedownSplitWords = (count: number, deck: number): string => {
  const rest = count - deck;
  const head = count === 1 ? "1 card is facedown" : `${count} cards are facedown`;
  // The Plot is revealed before the Villain (stages 2A and 3A), so one hidden card left is the Villain.
  const hidden = rest >= 2 ? "the hidden Villain and Plot" : "the hidden Villain";
  if (rest <= 0) return `${head}, all in the underworld deck`;
  return deck === 0 ? `${head}: ${hidden}` : `${head}: ${deck} in the underworld deck, and ${hidden}`;
};

/** Unholy Alliance's preview line. */
export const allianceWords = "Each staging step reveals 1 additional card, not 1 for each player. A hero destroyed by an enemy attack loses the game.";

/** Poisoned Counsels' preview line. */
export const counselsWords = "At the end of each round each player raises their threat by 2.";
