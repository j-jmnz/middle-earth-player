// Rules: mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.objective-allies, mec108.orc-deck, mec108.indestructible, rr.player-elimination (data/rules/entries.json); ledger lines 09023:A:1, 09024:A:1, 09024:A:2, 09024:A:3, 09036:A:2, 09038:A:1, 09038:A:2, 09051:A:1, 09067:A:2, 09071:A:1, 09072:A:2, 09072:A:3, 09073:B:3, 09074:B:2, 10158:A:1, 10158:A:2, 10158:A:3, 10168:A:2, 10169:A:2, 10170:A:2.
// What the table says of Intruders in Chetwood's pieces (src/play/readouts/angmar.ts, src/play/cards/angmar-preview.ts): Protect the Innocent's damage against the number that loses, the time counters on Rescue Iârion, the progress placed this round
// against Orc Rearguard's cap, the current quest, and the card held under a side quest; Deadmen's Dike's: the damage on Thaurdir against the hit points that open stage 2B, each seat's deck against the elimination at 0, Fornost Square's tokens, Broken Battlements' time counters, a burden on its host,
// The Power of Angmar's lock. The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).

import type { Instruction } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";

import type { ChoiceNames, PickWords } from "../choice.ts";
import { seatSays } from "../seat.ts";

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/** The note of Hunting the Orcs' dial: the resource tokens it holds against the number at which it flips (09071:A:1). */
export const huntWords = (tokens: number, limit: number): string => `${tokens} of ${limit} resource tokens. Each defeated enemy places 1. At ${limit} it flips to Savage Counter-attack, and the quest advances to stage 2.`;

/** The note of Savage Counter-attack's dial: its tokens, which fall when an enemy attacks and destroys a character; with none the players lose (09072:A:2, 09072:A:3). */
export const savageWords = (tokens: number): string => `${plural(tokens, "resource token", "resource tokens")} left. Each character an attack destroys discards 1, and with none left the players lose the game.`;

/** The warning when the next character an attack destroys, or the one after, takes the last token (at 2 left, the count of characters it takes). */
export const savageNearWords = (tokens: number): string => (tokens <= 1 ? "The next character an attack destroys loses the game." : "Two more characters destroyed by an attack lose the game. Cornered Animals can also take one.");

/** The line under Hunting the Orcs and Savage Counter-attack in their previews. */
export const huntPreviewWords = (tokens: number, limit: number): string => `${tokens} of ${limit} resource tokens on it. It flips to Savage Counter-attack at ${limit}, tokens and all.`;
export const savagePreviewWords = (tokens: number): string => `${plural(tokens, "resource token", "resource tokens")} on it. Each character an attack destroys discards 1. The players lose when none is left.`;

/** The note of Protect the Innocent's dial. */
export const protectWords = (damage: number, limit: number): string => `${damage} of ${limit} damage. Each attack that damages a character places 1; progress placed on it removes damage.`;

/** The warning when one more damage, or a few more, would lose the game. */
export const protectNearWords = (damage: number, limit: number): string => (damage + 1 >= limit ? "One more damage loses the game." : `${limit - damage} more damage loses the game.`);

/** The note of the dial that counts the time counters left on Find Shelter (09032:A:2): the last one removed makes each player deal 4 damage to a hero, then 4 time counters return. */
export const shelterTimeWords = (left: number): string =>
  `${plural(left, "time counter", "time counters")} left. One comes off at the end of each refresh phase. With the last gone, each player deals 4 damage to a hero they control, then 4 time counters return.`;

/** The warning when the next refresh phase takes Find Shelter's last time counter: not a loss, so it never goes critical. */
export const shelterTimeNearWords = (left: number): string => (left <= 1 ? "The next refresh phase takes the last time counter: each player deals 4 damage to a hero." : `${left} time counters are left.`);

/** The line under Find Shelter in its preview. */
export const shelterPreviewWords = (left: number): string => `${plural(left, "time counter", "time counters")} on it. With the last gone, each player deals 4 damage to a hero they control, then 4 time counters return.`;

/** The note of the dial that counts the time counters left on Rescue Iârion. */
export const timeWords = (left: number, held: string | null): string =>
  `${plural(left, "time counter", "time counters")} left. One comes off at the end of each refresh phase. With the last gone, ${held ?? "the card held under it"} is discarded and the players lose.`;

/** The warning when the next refresh phase takes the last time counter. */
export const timeNearWords = (left: number): string => (left <= 1 ? "The next refresh phase takes the last time counter." : `${left} time counters are left.`);

/** The note of Thaurdir's dial, the players' way out of stage 2 (09074:B:2): his damage against his hit points. He is Indestructible, so the damage stays on him; the stage cannot be defeated while he has any hit points left. */
export const thaurdirWords = (damage: number, limit: number): string => `${damage} of ${limit} damage. He cannot be destroyed, and stage 2 cannot be won while he has hit points left.`;

/** The line under Thaurdir in his preview: his damage against his hit points, and the burden he carries. */
export const thaurdirPreviewWords = (damage: number, limit: number, burden: string | null): string =>
  `${damage} of ${limit} damage on him. Indestructible: the damage stays, and stage 2 can be won once it reaches ${limit}.${burden ? ` He carries ${burden}.` : ""}`;

/** The mark of a seat's deck while a stage eliminates a player with no cards in his deck (09073:B:3, 09074:B:2): the cards left; it warms at 5 and is critical at 2. */
export const deckLabel = (seat: number | null, cards: number): string => (seat == null ? `Deck ${cards}` : `P${seat + 1} · Deck ${cards}`);
export const deckWords = (cards: number): string => `${plural(cards, "card", "cards")} left in this player's deck. A player with no cards in his deck is eliminated.`;
export const deckNearWords = (cards: number): string => (cards <= 0 ? "No cards left: this player is eliminated." : cards === 1 ? "One more card and this player is eliminated." : `${cards} cards left. At 0 this player is eliminated.`);

/** The note of the dial that counts the time counters left on Broken Battlements (09036:A:2): the last one makes each player discard 5 cards and place 1 time counter. Not a loss, so it never goes critical. */
export const battlementsTimeWords = (left: number): string =>
  `${plural(left, "time counter", "time counters")} left. One comes off at the end of each refresh phase. With the last gone, each player discards the top 5 cards of their deck and places 1 time counter here.`;
export const battlementsTimeNearWords = (left: number): string => (left <= 1 ? "The next refresh phase takes the last time counter: each player discards 5 cards." : `${left} time counters are left.`);
export const battlementsPreviewWords = (left: number): string => `${plural(left, "time counter", "time counters")} on it. With the last gone, each player discards the top 5 cards of their deck and places 1 time counter here.`;

/** The line under Fornost Square in its preview: its tokens and what they add to its Threat (09038:A:1), and what places one (09038:A:2). */
export const fornostWords = (tokens: number): string => `${plural(tokens, "resource token", "resource tokens")} on it: +${tokens} Threat. The first player discarding cards from the top of his deck places 1, once for each discard.`;

/** The line under a burden of Thaurdir's in its preview: where it lies and what it does there (10168:A:2, 10169:A:2, 10170:A:2). `host`: the card it lies on; `onHero`: that card is a hero. */
const BURDEN_EFFECTS = {
  "10168": { most: "the hero with the most resources", effect: "-2 Willpower and its text box, Traits included, is blank" },
  "10169": { most: "the hero with the most attachments that are not objectives", effect: "-2 Attack and it cannot commit to the quest" },
  "10170": { most: "the hero with the most damage", effect: "-2 Defense and it cannot be healed" },
} as const;
export const isBurden = (code: string): code is keyof typeof BURDEN_EFFECTS => code in BURDEN_EFFECTS;
export const burdenWords = (code: keyof typeof BURDEN_EFFECTS, host: string, onHero: boolean): string => {
  const burden = BURDEN_EFFECTS[code];
  const moves = `After a Sorcery treachery is revealed it moves to ${burden.most}.`;
  return onHero ? `On ${host}: ${burden.effect}. ${moves}` : `Carried by ${host}, with no effect on him. ${moves} It joins the Campaign Pool when the scenario is won.`;
};

/** The line under The Power of Angmar in its preview while it is in the staging area (09067:A:2). */
export const POWER_OF_ANGMAR_WORDS = "While it is in the staging area, no player card effect can take a card out of a discard pile. Encounter card effects can.";

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


/** Whether an option of a ChooseBoon pick is one of its boon codes (the other is "none"), which a row names by the card and pictures by its code. */
export const isBoonCode = (instruction: Instruction, id: string): boolean => instruction.verb === "ChooseBoon" && instruction.codes.includes(id);

/**
 * The words of the hero pick that follows a boon chosen in Mysterious Omens' reward (10160:A:3): the player who took the boon picks the hero that carries it (rr.campaign-pool). One player's own choice, so two-handed it leads with the player. Null for any other pick, and in a game
 * without the side quest rules.
 */
export function boonHeroAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, game: ScenarioState | undefined): PickWords | null {
  if (!game || game.sideQuests !== true || instruction.verb !== "Pick" || instruction.pick.type !== "hero" || instruction.pick.attachable == null || next?.verb !== "AttachSetAside") return null;
  const says = seatSays(game);
  return { verb: "Attach", prompt: says.say(`${source ? names.card(source) : "this card"}: choose a hero you control to carry ${names.code(next.code)}. It stays with that hero through the campaign.`), ...says.owned };
}
