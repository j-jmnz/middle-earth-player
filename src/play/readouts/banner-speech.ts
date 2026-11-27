// What a screen reader hears of the last move (docs/design-system-table.md, Last move): its full telling, which the code calls the banner. Its label reads as one sentence; under a
// phone reader, which never sees the combat spotlight, the same words are announced as the banner's title and then each line on its own, in
// the order the engine resolved them (who attacks whom, the shadow and its effect, the damage, a destroyed card), so the announcer's queue
// (src/ui/announce.ts) gives each its time and a long attack is not cut off. Pure.
import type { Moment, MomentLine } from "../store/outcome.ts";
import { lookIdsOf, lookStripWords, lookWordOf } from "../words/look-strip.ts";

/** What a screen reader hears of a line: the line that lays cards in the look strip of a Discover or a Track names the strip (emce.discover, hrd.track), every other line its text. */
export function lineSpeech(line: MomentLine): string {
  const laid = lookIdsOf(new Set(line.cards ?? [])).length;
  return laid > 0 ? lookStripWords(laid, lookWordOf(line.cards ?? [])) : line.text;
}

/** The banner as one sentence: its title, then every line. */
export function bannerLabel(moment: Moment): string {
  return `${moment.title}. ${moment.lines.map(lineSpeech).join(". ")}`;
}

/** The announcements of a banner for a phone reader, in order: the title, then one for each line. */
export function bannerSpeech(moment: Moment): string[] {
  return [moment.title, ...moment.lines.map(lineSpeech)].filter((part) => part.length > 0);
}
