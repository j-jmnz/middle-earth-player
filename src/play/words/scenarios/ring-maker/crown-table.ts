// Rules: rm.time-x, rm.raven-deck, rr.first-player, rr.cannot (data/rules/entries.json); ledger lines 08150:A:1, 08150:A:3, 08151:A:1, 08152:A:1, 08152:A:2, 08155:A:1, 08156:A:1, 08157:A:1, 08158:A:1, 08149:B:3.
// What the table says of The Antlered Crown's pieces (src/play/readouts/ring-maker/crown.ts, src/play/cards/ring-maker/crown-preview.ts): the time counters on its locations against what the last one does, Chief Turch following the first player, and Raven Chief with his Camp.
// The engine decided every number; these only say it. Each sentence stays at about 25 words (docs/design-system-table.md, Choice tray, Plain words).
import { plural } from "../../list.ts";

/** What the last time counter does on each location that prints Time X, as a clause with no lead. */
const LAST: Readonly<Record<string, string>> = {
  "08152": "each damaged character is exhausted, and 3 time counters return.",
  "08155": "each player in turn, the first player first, draws the top Raven card and it enters play engaged with him.",
  "08156": "the top Raven card is revealed and added to the staging area.",
  "08157": "each player assigns damage among his characters, one for each card in his hand.",
  "08158": "each player raises his threat by the cards in his hand.",
};

/** The short name on a location's dial, over the number: five dials in a row are told apart by it, as The Three Trials' Guardians are by their animal. */
const DIAL_LABEL: Readonly<Record<string, string>> = { "08152": "Camp", "08155": "War-camp", "08156": "Village", "08157": "Battlefield", "08158": "Country" };
export const locationDialLabel = (code: string): string => DIAL_LABEL[code] ?? "Time";
/** The name the caption shows for a label too long for it (Battlefield). */
export const locationDialShort = (code: string): string | undefined => (code === "08157" ? "Battle" : undefined);

/** The label of a quest stage's time dial in this scenario's three stages. */
export const CROWN_STAGE_LABEL = "Stage";

/** Whether a code is a location of this scenario that prints Time X. */
export const isTimeLocation = (code: string): boolean => LAST[code] != null;

const lastWords = (code: string): string => LAST[code] ?? "";

/** What the refresh phase takes and what the last counter does, without the count (the card preview's counter line says it). */
const standingWords = (code: string, takes: number): string => `${takes === 1 ? "One comes off" : `${takes} come off`} at the end of each refresh phase. With the last gone, ${lastWords(code)}`;

/** The note of a location's dial: the counters left, what the refresh phase takes and what the last one does; `active` says the dial is the active location's. */
export const locationTimeWords = (code: string, left: number, takes: number, active = false): string =>
  `${plural(left, "time counter")} left${active ? " on the active location" : ""}. ${standingWords(code, takes)}`;

/** The time words of a location's card preview, as the stage's preview does: what its last counter does once the next refresh phase takes it, else its standing rule. The count is not said: the preview's counter line says it. */
export const locationPreviewWords = (code: string, left: number, takes: number): string => (left === 1 ? locationTimeNearWords(code, left) : standingWords(code, takes));

/** The warning once the next refresh phase takes the last counter: what the last one does. */
export const locationTimeNearWords = (code: string, left: number): string => `The next refresh phase takes ${left === 1 ? "the last time counter" : `the last ${left} time counters`}. ${lastWords(code).charAt(0).toUpperCase()}${lastWords(code).slice(1)}`;

/** Chief Turch in the preview: who controls him (named in a game of several, else "You") and what he cannot do. */
export const turchControlledWords = (owner: string | null): string => `${owner ? `${owner} controls` : "You control"} Chief Turch. He passes to the first player each round, does not exhaust to defend. If he leaves play, the players lose.`;

/** Raven Chief in the preview: whether his Camp keeps him from damage, what his attack does, and the win his place in the victory display gives. */
export const ravenChiefWords = (campInPlay: boolean): string =>
  `${campInPlay ? "While Raven Chief's Camp is in play, Raven Chief cannot be damaged." : "Raven Chief's Camp is not in play, so he can be damaged."} Each time he attacks, 1 time counter comes off the active location. If he is in the victory display at the end of a round on stage 3, the players win.`;

/** Raven Chief's Camp in the preview: its immunity and the shield it gives Raven Chief. */
export const campWords = (): string => "Raven Chief's Camp is immune to player card effects. While it is in play, Raven Chief cannot be damaged.";

/** The row of a location in Raven Warrior's pick: its name and the counters it holds, or "last time counter" at one. */
export const locationRowWords = (name: string, left: number): string => `${name} \u00b7 ${left === 1 ? "last time counter" : plural(left, "time counter")}`;

/** The warning on the row of a location holding one counter: the pick takes it, and what the last counter starts. Null for a card with no Time X here. */
export const lastCounterRowWords = (code: string, name: string): string | null => (LAST[code] == null ? null : `Tap again: this takes the last time counter off ${name}, and ${lastWords(code)}`);

/** Stage 3's preview once Raven Chief lies in the victory display: the win its objective line names is met, and falls at the end of the round. */
export const ravenChiefWonWords = (): string => "Raven Chief is in the victory display: the players win at the end of the round.";
