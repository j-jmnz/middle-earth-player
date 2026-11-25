// Rules: rm.time-x, rm.grima-objective-ally, rr.cannot, rr.first-player (data/rules/entries.json); ledger lines 07016:A:1, 07016:A:3, 07023:A:1, 07059:A:1, 07059:B:1, 07059:B:2, 07059:B:3, 07060:B:2, 07060:B:3, 07061:B:1, 07061:B:2, 07061:B:3.
// What the table says of The Fords of Isen's pieces (src/play/readouts/ring-maker/fords.ts, src/play/cards/ring-maker/preview.ts): the time counters on the current stage against the Time X it printed, Gríma on The Islet and in a player's play area, and Ill Tidings in a hand.
// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import { plural } from "../../list.ts";

/** What the last time counter does on each stage, said after the count. */
const LAST: Record<string, string> = {
  "07059": "With the last gone, Gríma is discarded and the players lose.",
  "07060": "With the last gone, each player assigns damage for each card in his hand, and 2 time counters return.",
  "07061": "With the last gone, cards from the top of the encounter deck are discarded, each enemy among them joins the staging area, and 3 time counters return.",
};

/** The note of the stage's time dial: the counters left, the refresh phase that takes one and what the last one does. */
export const stageTimeWords = (code: string, left: number): string => `${plural(left, "time counter")} left. One comes off at the end of each refresh phase. ${LAST[code] ?? ""}`.trim();

/** The warning once two counters are left: the refresh phase that takes the last, and what it does. */
export const stageTimeNearWords = (code: string, left: number): string => (left <= 1 ? `The next refresh phase takes the last time counter. ${LAST[code] ?? ""}` : `${left} time counters are left.`).trim();

/** What the limit of the dial says: the Time X the stage printed. */
export const stageTimeLimitWords = (limit: number): string => `Time ${limit}: it starts with ${limit} time counters`;

/** Gríma's line in the preview, by where he lies. */
export const grimaOnWords = (host: string): string => `Gríma lies on ${host}, controlled by no player. When ${host} leaves play he returns to the staging area.`;
export const GRIMA_IN_STAGING = "Gríma is in the staging area, controlled by no player. The first player takes control of him once he is free of encounters.";
export const grimaControlledWords = (owner: string | null): string => `${owner ? `${owner} controls` : "You control"} Gríma. If he leaves play the players lose. The stage cannot advance unless the first player controls him.`;

/** Ill Tidings in a hand: it stays there, and why the player cannot play or discard it. */
export const ILL_TIDINGS_WORDS = "Held in this hand. Ill Tidings cannot be played or discarded, and no card effect takes it out. It counts as a card in hand.";
