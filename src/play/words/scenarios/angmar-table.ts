// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies (data/rules/entries.json); ledger lines 09023:A:1, 09024:A:1, 09024:A:2, 09024:A:3, 09051:A:1, 10158:A:1, 10158:A:2, 10158:A:3.
// What the table says of Intruders in Chetwood's pieces (src/play/readouts/angmar.ts, src/play/cards/angmar-preview.ts): Protect the Innocent's damage against the number that loses, the time counters on Rescue Iârion, the progress placed this round
// against Orc Rearguard's cap, the current quest, and the card held under a side quest. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

/** The note of Protect the Innocent's dial. */
export const protectWords = (damage: number, limit: number): string => `${damage} of ${limit} damage. Each attack that damages a character places 1; progress placed on it removes damage. At ${limit} the players lose.`;

/** The warning when one more damage, or a few more, would lose the game. */
export const protectNearWords = (damage: number, limit: number): string => (damage + 1 >= limit ? "One more damage loses the game." : `${limit - damage} more damage loses the game.`);

/** The note of the dial that counts the time counters taken off Rescue Iârion. */
export const timeWords = (removed: number, total: number, held: string | null): string =>
  `${removed} of ${total} time counters are gone. One comes off at the end of each refresh phase. With the last gone, ${held ?? "the card held under it"} is discarded and the players lose.`;

/** The warning when the next refresh phase takes the last time counter. */
export const timeNearWords = (left: number): string => (left <= 1 ? "The next refresh phase takes the last time counter." : `${left} time counters are left.`);

/** The note of the dial that counts the progress placed on the current quest this round against Orc Rearguard's cap. */
export const rearguardWords = (placed: number, limit: number): string => `${placed} of ${limit} progress placed on the current quest this round. No more can be placed until the next round.`;

/** The line a card's preview adds when it is the current quest. */
export const CURRENT_QUEST_WORDS = "The current quest until the end of the phase. Progress is placed on it after the active location takes its share.";

/** The line under Protect the Innocent in its preview. */
export const protectPreviewWords = (damage: number, limit: number): string => `${damage} of ${limit} damage on it. The players lose at ${limit}. It is never defeated: progress placed on it removes damage instead.`;

/** The line under Rescue Iârion in its preview, and under the card it holds. */
export const holdsWords = (held: string, left: number | null): string => `Holds ${held} facedown, in play. When this is defeated the first player takes ${held} back, exhausted.${left != null ? ` ${left} time counters left.` : ""}`;
export const heldWords = (host: string, left: number | null): string => `Facedown under ${host}, in play. No one controls it${left != null ? `, and ${left} time counters are left before it is discarded` : ""}. Its attachments stay on it.`;

/** The line under Lost in the Wilderness in its preview: the cards under it are the players' hands. */
export const wildernessWords = (count: number): string => `${count} ${count === 1 ? "card" : "cards"} from the players' hands lie facedown under it. They return to their owners when it is defeated.`;
