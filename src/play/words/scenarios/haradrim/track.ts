// Rules: hrd.track, hrd.search-objective (data/rules/entries.json); ledger lines 17069:A:1 to 17072:A:1, 17073:A:1, 17075:A:1, 17075:A:2, 17077:A:1, 17078:A:1, 17080:A:1.
// What the table says when Beneath the Sands' Track keyword resolves and when the Search objective flips: the banner's beat (with the cards the Track discarded in the look strip, as a Discover's) and the log's line. The engine's `track` and `searchFlip` steps hold the facts. Pure.
import type { EngineStep } from "../../../../rules/core/intents.ts";
import { lookBeat, lookWordBeat } from "../../look-strip.ts";

export type TrackBeat = { title: string; lines: readonly { text: string; cards: readonly string[] }[] };

const SIDE = { onTrack: "On Track", offTrack: "Off Track" } as const;
const cards = (count: number): string => `${count} ${count === 1 ? "card" : "cards"}`;

/** The beat of a step, or null for a step that is not one of these: "Track 2" with "Pitch Black Tunnel: 2 cards discarded", "Hive Guardian shows On Track" and "The Search objective flips to On Track". */
export function trackBeat(step: EngineStep, name: (cardId: string) => string): TrackBeat | null {
  if (step.kind === "searchFlip") return { title: "Search objective", lines: [{ text: `The Search objective flips to ${SIDE[step.to]}`, cards: [step.cardId] }] };
  if (step.kind !== "track") return null;
  const lines: { text: string; cards: readonly string[] }[] = [{ text: step.discarded.length === 0 ? `${step.locationId ? `${name(step.locationId)}: ` : ""}no card could be discarded` : `${step.locationId ? `${name(step.locationId)}: ` : ""}${cards(step.discarded.length)} discarded`, cards: step.locationId ? [step.locationId] : [] }];
  for (const id of step.marked) lines.push({ text: `${name(id)} shows On Track`, cards: [] });
  if (step.flipped) lines.push({ text: "The Search objective flips to On Track", cards: [] });
  else if (step.marked.length === 0 && step.discarded.length > 0) lines.push({ text: "No card shows On Track", cards: [] });
  // The last line lays the cards the Track discarded in the look strip, as the last line of a Discover's beat does.
  const last = lines[lines.length - 1];
  if (last && step.discarded.length > 0) lines[lines.length - 1] = { ...last, cards: [...last.cards, ...lookBeat(step.discarded), lookWordBeat("Track")] };
  return { title: `Track ${step.amount}`, lines };
}

/** The log's one line for the step, or null for another step. */
export function trackLogLine(step: EngineStep, name: (cardId: string) => string): string | null {
  if (step.kind === "searchFlip") return `The Search objective flips to ${SIDE[step.to]}`;
  if (step.kind !== "track") return null;
  const where = step.locationId ? ` at ${name(step.locationId)}` : "";
  return `Track ${step.amount}${where}: ${cards(step.discarded.length)} discarded${step.flipped ? ", the Search objective flips to On Track" : ""}`;
}

/** The banner's group the beat opens and the lines it adds, as store/outcome.ts offers them: the beat is kept whole and last, as a Discover's is, and the next line opens a group of its own. Nothing is told for a step that is not one of these. */
export type TrackSink = { open: (rank: number, title: string, tone: "plain") => { whole?: boolean }; line: (text: string, mark: null, cards: readonly string[]) => void; close: () => void };

export function tellTrack(step: EngineStep, name: (cardId: string) => string, sink: TrackSink): void {
  const beat = trackBeat(step, name);
  if (!beat) return;
  sink.open(3, beat.title, "plain").whole = true;
  for (const text of beat.lines) sink.line(text.text, null, text.cards);
  sink.close();
}
