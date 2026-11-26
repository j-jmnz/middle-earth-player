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

/** Whether a code is a location of this scenario that prints Time X. */
export const isTimeLocation = (code: string): boolean => LAST[code] != null;

const lastWords = (code: string): string => LAST[code] ?? "";

/** The note of a location's dial: the counters left, what the refresh phase takes and what the last one does. */
export const locationTimeWords = (code: string, left: number, takes: number): string =>
  `${plural(left, "time counter")} left. ${takes === 1 ? "One comes off" : `${takes} come off`} at the end of each refresh phase. With the last gone, ${lastWords(code)}`;

/** The warning once the next refresh phase takes the last counter: what the last one does. */
export const locationTimeNearWords = (code: string, left: number): string => `The next refresh phase takes ${left === 1 ? "the last time counter" : `the last ${left} time counters`}. ${lastWords(code).charAt(0).toUpperCase()}${lastWords(code).slice(1)}`;

/** Chief Turch in the preview: who controls him (named in a game of several, else "You") and what he cannot do. */
export const turchControlledWords = (owner: string | null): string => `${owner ? `${owner} controls` : "You control"} Chief Turch. He passes to the first player each round, does not exhaust to defend and is immune to player card effects. If he leaves play, the players lose.`;

/** Raven Chief in the preview: whether his Camp keeps him from damage, what his attack does, and the win his place in the victory display gives. */
export const ravenChiefWords = (campInPlay: boolean): string =>
  `${campInPlay ? "While Raven Chief's Camp is in play, Raven Chief cannot be damaged." : "Raven Chief's Camp is not in play, so he can be damaged."} Each time he attacks, 1 time counter comes off the active location. In the victory display at the end of the round on stage 3, the players win.`;

/** Raven Chief's Camp in the preview: its immunity and the shield it gives Raven Chief. */
export const campWords = (): string => "Raven Chief's Camp is immune to player card effects. While it is in play, Raven Chief cannot be damaged.";
