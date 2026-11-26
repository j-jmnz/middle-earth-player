// Rules: rm.time-x, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 08011:B:2, 08013:B:3, 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:1, 07059:B:2, 07059:B:3, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2, 07061:B:3, 08066:B:1, 08066:B:2, 08067:B:1, 08067:B:2, 07065:B:1, 07065:B:2, 07066:B:1, 07066:B:2, 07067:B:1, 07067:B:2.
// What the table says of The Fords of Isen's pieces (src/play/readouts/ring-maker/fords.ts, src/play/cards/ring-maker/preview.ts): the time counters on the current stage against the Time X it printed, Gríma on The Islet and in a player's play area, and Ill Tidings in a hand.
// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import type { Instruction } from "../../../../catalog/boundary.ts";
import { plural } from "../../list.ts";

/** What the last time counter does on each stage, as a clause with no lead: the dial's notes and the Choose's caution put their own words before it. */
const LAST_COUNTER: Readonly<Record<string, string>> = {
  "07059": "Gríma is discarded and the players lose.",
  "07060": "each player assigns damage for each card in his hand, and 2 time counters return.",
  "07061": "cards from the top of the encounter deck are discarded, each enemy among them joins the staging area, and 3 time counters return.",
  "07063": "the encounter discard pile joins the deck, 2 encounter cards are revealed for each player, and 2 time counters return.",
  "07064": "Mugash returns to the staging area, the players reveal 1 encounter card for each player after the first, and 3 time counters return.",
  "07065": "Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.",
  "07066": "Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.",
  "08011": "each player discards the hand and draws 2 cards, and 2 time counters return.",
  "08013": "the players make engagement checks and each engaged enemy attacks. The players win if no hero is destroyed, and lose if one is.",
  "08066": "each player's threat elimination level goes down by 10 for the rest of the game, and 4 time counters return.",
  "08067": "the first player chooses: each player raises their threat by 3, or Bellach attacks Nalir. Then 3 time counters return.",
  "07067": "5 cards from the top of the encounter deck are discarded, each player adds an enemy or objective from the discard pile to the staging area, and 3 time counters return.",
};

/** What the last counter does on the stage, or null for a card with no time dial. */
export const lastCounterWords = (code: string): string | null => LAST_COUNTER[code] ?? null;

/** The sentence under the count on the dial: "With the last gone, ...". */
const withLastGone = (code: string): string => (LAST_COUNTER[code] != null ? `With the last gone, ${LAST_COUNTER[code]}` : "");

/** What the next refresh phase and the table take from a time stage: `takes` counters at the end of the refresh phase (the stage's own, Old South Road's, Off Track's) and whether an enemy that engages a player also takes one (Chief Turch). */
export type TimeTakes = { takes: number; engages?: boolean };
const ONE: TimeTakes = { takes: 1 };

/** The note of the stage's time dial: the counters left, the refresh phase that takes some and what the last one does. */
export const stageTimeWords = (code: string, left: number, facts: TimeTakes = ONE): string => `${plural(left, "time counter")} left. ${facts.takes === 1 ? "One comes off" : `${facts.takes} come off`} at the end of each refresh phase. ${withLastGone(code)}`.trim();

/** The warning once the next refresh phase takes the last counters, or two are left: what the refresh phase takes, any engagement that takes one too, and what the last one does. */
export function stageTimeNearWords(code: string, left: number, facts: TimeTakes = ONE): string {
  if (left <= 0) return `No time counters are left. ${withLastGone(code)}`.trim();
  const engages = facts.engages === true && left <= 2 ? "Any enemy that engages a player also takes one." : "";
  if (facts.takes < left && left > 1) return [`${left} time counters are left.`, engages].filter((part) => part !== "").join(" ");
  const taken = left === 1 ? "the last time counter" : `the last ${left} time counters`;
  return [`The next refresh phase takes ${taken}.`, engages, withLastGone(code)].filter((part) => part !== "").join(" ");
}

/** What the limit of the dial says: the Time X the stage printed, and for a Time X for each player the amount and the players counted. */
export const stageTimeLimitWords = (limit: number, each?: { amount: number; players: number }): string => (each != null ? `Time ${each.amount} x ${plural(each.players, "player")}: it starts with ${limit} time counters` : `Time ${limit}: it starts with ${limit} time counters`);

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
