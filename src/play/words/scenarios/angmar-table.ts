// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies (data/rules/entries.json); ledger lines 09023:A:1, 09024:A:1, 09024:A:2, 09024:A:3, 09051:A:1, 10158:A:1, 10158:A:2, 10158:A:3.
// What the table says of Intruders in Chetwood's pieces (src/play/readouts/angmar.ts, src/play/cards/angmar-preview.ts): Protect the Innocent's damage against the number that loses, the time counters on Rescue Iârion, the progress placed this round
// against Orc Rearguard's cap, the current quest, and the card held under a side quest. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The note of Protect the Innocent's dial. */
export const protectWords = (damage: number, limit: number): string => `${damage} of ${limit} damage. Each attack that damages a character places 1; progress placed on it removes damage.`;

/** The warning when one more damage, or a few more, would lose the game. */
export const protectNearWords = (damage: number, limit: number): string => (damage + 1 >= limit ? "One more damage loses the game." : `${limit - damage} more damage loses the game.`);

/** The note of the dial that counts the time counters left on Rescue Iârion. */
export const timeWords = (left: number, held: string | null): string =>
  `${plural(left, "time counter", "time counters")} left. One comes off at the end of each refresh phase. With the last gone, ${held ?? "the card held under it"} is discarded and the players lose.`;

/** The warning when the next refresh phase takes the last time counter. */
export const timeNearWords = (left: number): string => (left <= 1 ? "The next refresh phase takes the last time counter." : `${left} time counters are left.`);

/** What the cap dial's limit says: the number Orc Rearguard allows each round. */
export const rearguardLimitWords = (limit: number, title: string): string => `${limit} allowed each round by ${title}`;

/** The warning of the cap dial once the cap is reached. */
export const rearguardWords = (placed: number, limit: number): string => `${placed} of ${limit} progress placed on the current quest this round. No more can be placed until the next round.`;

/** The line a card's preview adds when it is the current quest. */
export const CURRENT_QUEST_WORDS = "The current quest until the end of the phase. Progress is placed on it after the active location takes its share.";

/** The line under Protect the Innocent in its preview. */
export const protectPreviewWords = (damage: number, limit: number): string => `${damage} of ${limit} damage on it. The players lose at ${limit}. It is never defeated: progress placed on it removes damage instead.`;

/** The line under Rescue Iârion in its preview, and under the card it holds. */
export const holdsWords = (held: string, left: number | null): string => `Holds ${held} facedown, in play. When this is defeated the first player takes ${held} back, exhausted.${left != null ? ` ${left} time counters left.` : ""}`;
export const heldWords = (host: string, left: number | null): string => `Facedown under ${host}, in play. No one controls it${left != null ? `, and ${left} time counters are left before it is discarded` : ""}. Its attachments stay on it.`;

/** The line under Lost in the Wilderness in its preview: each seat's hand lies facedown under it ("Player 1's hand, 3 cards; Player 2's hand, 1 card", solo "your hand, 3 cards"; `owner` is `ownerWords` of the seat). */
export const wildernessWords = (hands: readonly { owner: string; count: number }[]): string =>
  hands.length === 0 ? "No cards lie under it. Hands placed under it return to their owners when it is defeated." : `Facedown under it: ${hands.map((hand) => `${hand.owner} hand, ${plural(hand.count, "card", "cards")}`).join("; ")}. They return to their owners' hands when it is defeated.`;

/** The mark of a seat whose hand lies under Lost in the Wilderness ("hand under"), and what it says. */
export const handUnderLabel = (seat: number | null): string => (seat == null ? "Hand under" : `P${seat + 1} · Hand under`);
export const handUnderWords = (count: number): string => `${plural(count, "card", "cards")} from this player's hand lie facedown under Lost in the Wilderness. They return to this player's hand when it is defeated.`;

/** The mark of the seat that controls Iârion (the first player while he is in play and controlled), and what it says. */
export const iarionLabel = (seat: number | null): string => (seat == null ? "Iârion" : `P${seat + 1} · Iârion`);
export const iarionWords = "Iârion is under this player's control. If he leaves play the players lose the game.";

