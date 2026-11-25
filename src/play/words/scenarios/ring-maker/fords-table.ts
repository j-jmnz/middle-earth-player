// Rules: rm.time-x, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:1, 07059:B:2, 07059:B:3, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2, 07061:B:3, 07065:B:1, 07065:B:2, 07066:B:1, 07066:B:2, 07067:B:1, 07067:B:2.
// What the table says of The Fords of Isen's pieces (src/play/readouts/ring-maker/fords.ts, src/play/cards/ring-maker/preview.ts): the time counters on the current stage against the Time X it printed, Gríma on The Islet and in a player's play area, and Ill Tidings in a hand.
// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import type { Instruction } from "../../../../catalog/boundary.ts";
import { plural } from "../../list.ts";

/** What the last time counter does on each stage, said after the count. */
const LAST: Record<string, string> = {
  "07059": "With the last gone, Gríma is discarded and the players lose.",
  "07060": "With the last gone, each player assigns damage for each card in his hand, and 2 time counters return.",
  "07061": "With the last gone, cards from the top of the encounter deck are discarded, each enemy among them joins the staging area, and 3 time counters return.",
  "07063": "With the last gone, the encounter discard pile joins the deck, 2 encounter cards are revealed for each player, and 2 time counters return.",
  "07064": "With the last gone, Mugash returns to the staging area, the players reveal 1 encounter card for each player after the first, and 3 time counters return.",
  "07065": "With the last gone, Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.",
  "07066": "With the last gone, Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.",
  "07067": "With the last gone, 5 cards from the top of the encounter deck are discarded, each player adds an enemy or objective from the discard pile to the staging area, and 3 time counters return.",
};

/** The note of the stage's time dial: the counters left, the refresh phase that takes one and what the last one does. */
export const stageTimeWords = (code: string, left: number): string => `${plural(left, "time counter")} left. One comes off at the end of each refresh phase. ${LAST[code] ?? ""}`.trim();

/** The warning once two counters are left: the refresh phase that takes the last, and what it does. */
export const stageTimeNearWords = (code: string, left: number): string => (left <= 0 ? `No time counters are left. ${LAST[code] ?? ""}` : left === 1 ? `The next refresh phase takes the last time counter. ${LAST[code] ?? ""}` : `${left} time counters are left.`).trim();

/** What the limit of the dial says: the Time X the stage printed. */
export const stageTimeLimitWords = (limit: number): string => `Time ${limit}: it starts with ${limit} time counters`;

/** Gríma's line in the preview, by where he lies. */
export const grimaOnWords = (host: string): string => `Gríma lies on ${host}, controlled by no player. When ${host} leaves play he returns to the staging area.`;
export const GRIMA_IN_STAGING = "Gríma is in the staging area, controlled by no player. The first player takes control of him once he is free of encounters.";
export const grimaControlledWords = (owner: string | null, stage1: boolean): string => `${owner ? `${owner} controls` : "You control"} Gríma. If he leaves play the players lose.${stage1 ? " The stage cannot advance unless the first player controls him." : ""}`;

/** Ill Tidings in a hand: whose hand holds it and why no card effect takes it out. The note that follows says why it cannot be played (choice/why.ts), so this line does not. `owner` is the player in a game of several, else null. */
export const illTidingsWords = (owner: string | null): string => `Held in ${owner ? `${owner}'s` : "your"} hand. Ill Tidings cannot be discarded, and no card effect takes it out. It counts as a card in hand.`;

/** The word on the pill of Ill Tidings in a hand, and what the reader says. */
export const ILL_TIDINGS_MARK = { text: "held", speech: "Held in the hand" } as const;

/** The verbs the ring-maker family adds, in words, or null for any other instruction. */
export function ringMakerWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "RemoveTimeFromQuest":
      return `remove ${typeof instruction.amount === "number" ? plural(instruction.amount, "time counter") : "time counters"} from the current quest`;
    case "DrawSelfIntoHand":
      return "the first player draws this card into his hand";
    case "EngageTopDiscarded":
      return `put the topmost ${instruction.trait} enemy discarded this way into play engaged with that player`;
    default:
      return null;
  }
}

/** The pill of a captive held under a card (Mugash under his hero, Gríma under The Islet): it names the captive, as the card's own strip does, in place of a count; the reader hears "Mugash held underneath". */
export const heldByName = (names: readonly string[]): { text: string; loses: boolean; speech: string } => ({ text: names.join(" · "), loses: false, speech: `${names.join(" and ")} held underneath` });
