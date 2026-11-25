// Rules: rm.out-of-play-deck, rm.time-x, rr.cannot, rr.engaged (data/rules/entries.json); ledger lines 07062:A:1, 07024:A:2, 07025:A:1, 07029:A:1, 07027:A:2, 07028:A:1, 07063:B:1, 07063:B:2, 07064:B:1, 07064:B:2.
// What the table says of To Catch an Orc's pieces (src/play/readouts/ring-maker/orc.ts, src/play/cards/ring-maker/preview.ts): each seat's out-of-play deck as a count, Mugash held under his hero and the Guard that engages the player of that hero.
// The engine decided every number; these only say it. The cards of an out-of-play deck are never named: they lie facedown. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import { plural } from "../../list.ts";

const whose = (owner: string | null): string => (owner ? `${owner}'s` : "Your");

/** One deck's line in the dial's panel, "Player 2: 12 cards". */
export const outOfPlayLine = (cards: number, owner: string): string => `${owner}: ${plural(cards, "card")}`;

/** The dial's note: the cards in each deck (the player's own alone, each player's two-handed), facedown, and whether Mugash is found. `counts` is the cards of each seat's deck. */
export const outOfPlayNote = (counts: readonly number[], mugashFound: boolean): string => {
  const holds = counts.length > 1 ? `${counts.map((count, seat) => `Player ${seat + 1}'s out-of-play deck holds ${plural(count, "card")}`).join(" and ")}, facedown.` : `Your out-of-play deck holds ${plural(counts[0] ?? 0, "card")}, facedown.`;
  return `${holds} ${mugashFound ? "Mugash is found." : "Mugash is in one of the decks until a reveal finds him."}`;
};

/** The warning once a deck runs low while Mugash is still hidden: a reveal can take what is left. */
export const outOfPlayLowWords = (cards: number, owner: string | null): string =>
  cards <= 0 ? `${whose(owner)} out-of-play deck is empty. No reveal from it finds anything.` : `${whose(owner)} out-of-play deck is running low: ${plural(cards, "card")} left, and Mugash is not found.`;

/** Mugash's line in the preview, by where he lies. `host` is the hero he is attached to. */
export const mugashHeldWords = (host: string): string => `Mugash is held by ${host}. ${host} cannot ready. If ${host} leaves play, the players lose the game.`;

/** The line on the hero that holds Mugash. */
export const heroHoldsWords = (host: string): string => `${host} holds Mugash. It cannot ready. If it leaves play, the players lose the game.`;

/** The Guard's line in the preview: whom it engages while Mugash is attached. `owner` is the player who controls the hero, named in a game of several, else null. */
export const guardWords = (mugashHeld: boolean, owner: string | null): string =>
  mugashHeld ? `Mugash is attached to a hero ${owner ? `${owner} controls` : "you control"}. This Guard engages ${owner ?? "you"}, whatever its engagement cost.` : "While a player controls a hero with Mugash attached, this Guard engages that player, whatever its engagement cost.";

/** The pill of Mugash held under a hero. */
export const MUGASH_MARK = { text: "held", speech: "Mugash held underneath" } as const;
