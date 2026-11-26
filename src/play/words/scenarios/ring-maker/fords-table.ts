// Rules: rm.time-x, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 08122:B:2, 08122:B:3, 08123:B:2, 08123:B:3, 08011:B:2, 08013:B:3, 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:1, 07059:B:2, 07059:B:3, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2, 07061:B:3, 08066:B:1, 08066:B:2, 08067:B:1, 08067:B:2, 08095:B:1, 08095:B:2, 08095:B:3, 08096:B:1, 08096:B:2, 08096:B:3, 08097:B:1, 08097:B:2, 08097:B:3, 08098:B:1, 08098:B:2, 08099:B:1, 08099:B:2, 08099:B:3, 08100:B:1, 08100:B:2, 08101:B:1, 08101:B:2, 07065:B:1, 07065:B:2, 07066:B:1, 07066:B:2, 07067:B:1, 07067:B:2.
// What the table says of The Fords of Isen's pieces (src/play/readouts/ring-maker/fords.ts, src/play/cards/ring-maker/preview.ts): the time counters on the current stage against the Time X it printed, Gríma on The Islet and in a player's play area, and Ill Tidings in a hand.
// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import type { Instruction } from "../../../../catalog/boundary.ts";
import { plural } from "../../list.ts";

/** What stage 1B's last counter takes off each seat's threat elimination level (08066:B:2); a test holds it equal to the record's amount. */
export const ELIMINATION_DROP = 10;
/** The stage whose last counter lowers the level. */
export const LEVEL_STAGE = "08066";

/** The threat elimination level each living seat will have once the stage's last counter has lowered it (`seat` is 0-based): read from the engine for each seat, never a fixed number. */
export type NewLevels = readonly { seat: number; level: number }[];

/** "to 40" when every seat has the same new level, else "to 40 for Player 1, 38 for Player 2"; empty when the levels are not known. */
function newLevelWords(levels: NewLevels): string {
  const first = levels[0];
  if (first == null) return "";
  if (levels.every((one) => one.level === first.level)) return ` (to ${first.level})`;
  return ` (to ${levels.map((one) => `${one.level} for Player ${one.seat + 1}`).join(", ")})`;
}

// The three stages 2B and the three stages 3B are replaced by another of their number chosen at random: the replaced stage goes back to the quest deck and loses its progress and counters.
const STAGE_2_LAST = "this stage goes back to the quest deck, losing its progress and counters, and a different stage 2 chosen at random replaces it.";
const STAGE_3_LAST = "this stage goes back to the quest deck, losing its progress and counters, and a different stage 3 chosen at random replaces it.";

// Celebrimbor's Secret: both stages trigger every Scour effect in play when the last counter goes, and put 3 counters back (08122:B:2, 08123:B:2).
const SCOUR_LAST = "each Scour effect in play is triggered, and 3 time counters return.";

/** The standing rule of each stage of The Nîn-in-Eilph, said first on its dial so the three stages with one name read apart (08095:B:3, 08096:B:3, 08097:B:3, 08098:B:3, 08099:B:3, 08100:B:3). */
const STANDING: Readonly<Record<string, string>> = {
  "08095": "Player card effects cannot gain resources or draw cards.",
  "08096": "Before committing characters to the quest, a player discards a card at random from his hand. With no card, he cannot commit.",
  "08097": "Each player can play only 1 card each round.",
  "08098": "Each location in play gets +1 Threat.",
  "08099": "Each player readies at most 5 characters in the refresh phase.",
  "08100": "Each enemy in the staging area gets -20 engagement cost.",
  "08122": "Bellach is immune to player card effects and cannot be engaged.",
  "08123": "Until this stage has 12 progress, Bellach is immune to player card effects and cannot be engaged.",
};

/** The words of a table flag that a stage of this cycle holds (`commitDiscardsRandom`, 08096:B:3), for the sheets the flag changes. */
const FLAG_STANDING: Readonly<Record<string, string>> = { commitDiscardsRandom: STANDING["08096"] ?? "" };
export const flagStandingWords = (flag: string): string => FLAG_STANDING[flag] ?? "";

/** The standing rule of a stage, or an empty string. */
export const stageStandingWords = (code: string): string => STANDING[code] ?? "";

/** What the last time counter does on each stage, as a clause with no lead: the dial's notes and the Choose's caution put their own words before it. A clause that reads the table is a function of what it reads. */
const LAST_COUNTER: Readonly<Record<string, string | ((levels: NewLevels) => string)>> = {
  "07059": "Gríma is discarded and the players lose.",
  "07060": "each player assigns damage for each card in his hand, and 2 time counters return.",
  "07061": "cards from the top of the encounter deck are discarded, each enemy among them joins the staging area, and 3 time counters return.",
  "07063": "the encounter discard pile joins the deck, 2 encounter cards are revealed for each player, and 2 time counters return.",
  "07064": "Mugash returns to the staging area, the players reveal 1 encounter card for each player after the first, and 3 time counters return.",
  "07065": "Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.",
  "07066": "Mugash is shuffled into the encounter deck, even from a hero, and the quest advances to stage 3.",
  "08011": "each player discards the hand and draws 2 cards, and 2 time counters return.",
  "08013": "the players make engagement checks and each engaged enemy attacks. The players win if no hero is destroyed, and lose if one is.",
  "08066": (levels) => `each player's threat elimination level goes down by ${ELIMINATION_DROP} for the rest of the game${newLevelWords(levels)}, a player whose threat is at or above his new level is eliminated at once, and 4 time counters return.`,
  "08067": "the first player chooses: each player raises their threat by 3, or Bellach attacks Nalir. Then 3 time counters return.",
  "08095": STAGE_2_LAST,
  "08096": STAGE_2_LAST,
  "08097": STAGE_2_LAST,
  "08098": STAGE_3_LAST,
  "08099": STAGE_3_LAST,
  "08100": STAGE_3_LAST,
  "08101": "Ancient Marsh-dweller attacks each player in player order, and 2 time counters are placed on this stage.",
  "08122": SCOUR_LAST,
  "08123": SCOUR_LAST,
  "07067": "5 cards from the top of the encounter deck are discarded, each player adds an enemy or objective from the discard pile to the staging area, and 3 time counters return.",
};

/** What the last counter does on the stage, or null for a card with no time dial. */
export function lastCounterWords(code: string, levels: NewLevels = []): string | null {
  const words = LAST_COUNTER[code];
  return words == null ? null : typeof words === "string" ? words : words(levels);
}

/** The sentence under the count on the dial: "With the last gone, ...". */
const withLastGone = (code: string, levels: NewLevels): string => {
  const words = lastCounterWords(code, levels);
  return words != null ? `With the last gone, ${words}` : "";
};

/** What the next refresh phase and the table take from a time stage: `takes` counters at the end of the refresh phase (the stage's own, Old South Road's, Off Track's) and whether an enemy that engages a player also takes one (Chief Turch). */
export type TimeTakes = { takes: number; engages?: boolean; levels?: NewLevels };
const ONE: TimeTakes = { takes: 1 };

/** The note of the stage's time dial: the counters left, the refresh phase that takes some and what the last one does. */
export const stageTimeWords = (code: string, left: number, facts: TimeTakes = ONE): string => `${stageStandingWords(code)} ${plural(left, "time counter")} left. ${facts.takes === 1 ? "One comes off" : `${facts.takes} come off`} at the end of each refresh phase. ${withLastGone(code, facts.levels ?? [])}`.trim();

/** The warning once the next refresh phase takes the last counters, or two are left: what the refresh phase takes, any engagement that takes one too, and what the last one does. */
export function stageTimeNearWords(code: string, left: number, facts: TimeTakes = ONE, counted = true): string {
  const levels = facts.levels ?? [];
  if (left <= 0) return `No time counters are left. ${withLastGone(code, levels)}`.trim();
  const engages = facts.engages === true && left <= 2 ? "Any enemy that engages a player also takes one." : "";
  if (facts.takes < left && left > 1) return [counted ? `${left} time counters are left.` : "", engages].filter((part) => part !== "").join(" ");
  const taken = left === 1 ? "the last time counter" : `the last ${left} time counters`;
  return [`The next refresh phase takes ${taken}.`, engages, withLastGone(code, levels)].filter((part) => part !== "").join(" ");
}

/** Stage 4B of The Nîn-in-Eilph puts 2 counters back on itself, so it holds 2 most of the game: its dial warms only when the next refresh phase takes the last counter (the attack), not for the count. */
const WARMS_AT_LAST_ONLY: ReadonlySet<string> = new Set(["08101"]);

/** Whether the time dial of a stage warms: two counters or fewer are left, or the next refresh phase takes the rest (a stage in WARMS_AT_LAST_ONLY warms only for the second). */
export const timeDialWarms = (code: string, left: number, takes: number): boolean => takes >= left || (left <= 2 && !WARMS_AT_LAST_ONLY.has(code));

/** The time words of a stage's preview: its standing rule first, then what the dial warns of once two counters or fewer are left. The count is not said: the preview's counter line says it. */
export function stageTimePreviewWords(code: string, left: number, facts: TimeTakes, warms: boolean): string {
  return [stageStandingWords(code), warms ? stageTimeNearWords(code, left, facts, false) : ""].filter((part) => part !== "").join(" ");
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
