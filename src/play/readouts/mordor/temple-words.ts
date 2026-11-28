// Rules: docs/scenarios/vengeance-of-mordor/the-temple-of-doom.md (Table); ledger lines 21053:A:1, 21054:A:2, 21080:B:2, 21085:B:2, 21065:A:1, 21062:A:1, 21070:A:2. The words of The Temple of Doom's top-bar dials and seat marks (temple.ts beside them). Pure.
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** What a tap on the Tribute dial says: the damage against the 4 that reveal a card of the Power of Mordor deck, what is left in that deck and, with 3 tokens, what the end of this round does. */
export const tributeWords = (damage: number, deck: number): string => {
  const next = damage < 3 ? "" : deck > 0 ? " At the end of this round the 4th token is placed, 4 come off and the top card of the deck is revealed." : " At the end of this round the 4th token is placed and the players lose the game.";
  return `${plural(damage, "damage token", "damage tokens")} on Tribute to Mordor. At the end of the round 1 more is placed. With 4 or more, 4 come off and the top card of the Power of Mordor deck is revealed. The deck holds ${plural(deck, "card", "cards")}; with none to reveal the players lose the game.${next}`;
};

export const tributeLimitWords = (): string => "4 damage tokens reveal a Power of Mordor card";

/** The warning with 3 or more tokens and no card left in the Power of Mordor deck: the end of the round brings the count to 4 and the players lose. */
export const tributeLoseWords = (): string => "The Power of Mordor deck is empty. At the end of the round the players lose the game if Tribute to Mordor holds 4 damage tokens.";

/** What a tap on Thane Ulchor's dial says: the hit points left, his X and what each decides. */
export const ulchorWords = (left: number, x: number): string =>
  `Thane Ulchor has ${plural(left, "hit point", "hit points")} left. X is ${x}, 1 more than the quest stages in the victory display; he cannot be engaged unless X is 5. Tribute to Mordor cannot be the active quest while he has any hit points left.`;

/** What a tap on the stage 1B dial says: the resources on it against the 2 that advance the quest. */
export const templeGateWords = (held: number): string => `${plural(held, "resource", "resources")} on The Forgotten Temple. At the end of each planning phase 1 is placed. At 2 the stage is added to the victory display and the quest advances to a stage 2 chosen at random.`;

export const templeGateLimitWords = (): string => "2 resources advance the quest";

/** What a tap on the stage 2B cap dial says: the progress placed this round against the total printed cost of the cards the Forced effect discarded. */
export const lordCapWords = (placed: number, cap: number): string => `${placed} of the ${cap} progress that can be placed on The Lord of Middle-earth this round. The cap is the total printed cost of the cards discarded at the start of the quest phase.`;

/** The seat mark of Lost in the Dark (the count stays in a two-handed bar's caption): the cards under the player's threat dial. */
export const darkMarkLabel = (seat: number | null, held: number): string => `${seat == null ? "Dark" : `P${seat + 1}`} ${held}`;

export const darkMarkWords = (held: number): string =>
  `Lost in the Dark: ${plural(held, "card", "cards")} facedown under this threat dial. Each time this player raises threat 1 is discarded. When the side quest is defeated they are shuffled back into the deck.`;

/** The seat mark of Covered in Darkness: the threat the player's card effects lowered this round against the 1 allowed ("Lower", so it never reads as the "Cap" dial of stage 2B). */
export const coveredMarkLabel = (seat: number | null, lowered: number): string => `${seat == null ? "Lower" : `P${seat + 1}`} ${Math.min(lowered, 1)}/1`;

/** The seat mark of Narrow Opening: the cards the player has played this round against the 1 allowed. */
export const playMarkLabel = (seat: number | null, played: number): string => `${seat == null ? "Play" : `P${seat + 1}`} ${Math.min(played, 1)}/1`;

export const playMarkWords = (played: number): string =>
  played >= 1 ? "Narrow Opening: this player has played 1 card this round and can play no more." : "Narrow Opening: this player can play no more than 1 card each round.";
