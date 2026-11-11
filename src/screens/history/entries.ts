// How History words each card (docs/design-system.md, History): a playthrough, a standalone game, as the title, lines, chip and the sentence a screen reader hears. Where a card leads is the view's. Pure.
import type { RunRecord } from "../../campaign/runs";
import { isOpenStatus, standaloneStatus, type ListedStandalone, type StandaloneStatus } from "../../campaign/standalone";
import { BOXES, boxOf, scenarioName } from "../data/campaign-data";
import type { LibrarySave } from "./read";
import { heroesWords, playthroughWords, plural, runDate, runDetail, runLabel } from "./words";
import { describe, nextSummary, partySeats } from "./save-line";
import { seatWord } from "../data/seats";
import { gameCaption } from "./standalone-words";

type NameOf = (code: string) => string;

/** A line under a card's title: what it is (muted), where it stands (accent), or why it was lost (danger). */
export type CardLine = { text: string; tone: "muted" | "accent" | "danger" };

export type CardChip = { label: string; tone: "accent" | "danger" | "neutral" | "faint" };

/** How a card stands: a live one on the row's fill, an archived one marked Archived. */
export type CardState = "live" | "archived";

/**
 * Where a game's card leads: its table while it is playing, its outcome once it has a run, else a new deal of the same game; null
 * when it has neither a run nor a loadout to deal again. `word` is the card's last line, so the eye knows before the tap; `verb` leads
 * the spoken label.
 */
export type GameDestination = { to: "table" | "outcome" | "again"; verb: string; word: string };

export function gameDestination(game: ListedStandalone, hasRun: boolean): GameDestination | null {
  if (isOpenStatus(standaloneStatus(game))) return { to: "table", verb: "Resume", word: "Resume" };
  if (hasRun) return { to: "outcome", verb: "Outcome of", word: "See the outcome" };
  if (game.loadout) return { to: "again", verb: "Play again", word: "Play again" };
  return null;
}

/** What Delete asks of a game. */
export function deleteGameSentence(described: string): string {
  return `Delete ${described}? It is gone for good. Your decks stay.`;
}

export type CardWords = { title: string; lines: CardLine[]; chip: CardChip | null; spoken: string; firstSeat: readonly string[] };

const STATUS_CHIP: Record<StandaloneStatus, CardChip> = {
  playing: { label: "In progress", tone: "neutral" },
  needsChoice: { label: "Needs a choice", tone: "neutral" },
  won: { label: "Won", tone: "accent" },
  lost: { label: "Lost", tone: "danger" },
  dropped: { label: "Dropped", tone: "faint" },
};

const boxName = (box: string): string => BOXES.find((item) => item.id === box)?.name ?? box;

const line = (text: string | null, tone: CardLine["tone"]): CardLine[] => (text ? [{ text, tone }] : []);

/** What a game's one run adds to its card: a loss's cause, then the date, rounds, threat and score. */
function runLines(run: RunRecord | null, nameOf: NameOf): CardLine[] {
  if (!run) return [];
  const cause = run.result === "lost" ? run.lossCause : null;
  const how = [runDate(run), runDetail(run, nameOf)].filter((part) => part != null).join(" · ");
  return [...line(cause, "danger"), ...line(how || null, "muted")];
}

/** "3 runs, latest: A Shadow of the Past, Lost, 24 Oct 2026, …": what a card's runs say to a screen reader, kept to the newest. */
function runsSpoken(runs: readonly RunRecord[], nameOf: NameOf): string {
  const [latest] = runs;
  if (!latest) return "No runs yet";
  return `${plural(runs.length, "run")}, latest: ${runLabel(latest, scenarioName(latest.scenarioId), nameOf)}`;
}

// What is next is the accent's only while the playthrough or game is not put away.
const nextTone = (archived: boolean): CardLine["tone"] => (archived ? "muted" : "accent");

/** A playthrough: its campaign, the seats, start and progress, the fellowship, and what is next (or that every scenario is won). */
export function saveWords(ref: LibrarySave, runs: readonly RunRecord[], started: number | null, archived: boolean, nameOf: NameOf): CardWords {
  const { line: worded, save } = ref;
  const seats = partySeats(save);
  const next = worded.next.kind === "finished" ? "Campaign won" : nextSummary(worded.next);
  return {
    title: worded.name,
    lines: [...line(playthroughWords(worded.seats, started, { done: worded.done, total: worded.total }), "muted"), ...line(heroesWords(seats, nameOf), "muted"), ...line(next, nextTone(archived))],
    chip: null,
    spoken: [describe(worded), next, runsSpoken(runs, nameOf)].join(". "),
    firstSeat: seats[0] ?? [],
  };
}

/**
 * A standalone game: its scenario and how it stands, the seats, difficulty and box, the fellowship, how its run went (left out with
 * `run` null) and `opens`, the word for where its card leads ("Resume", "See the outcome", "Play again").
 */
export function gameWords(game: ListedStandalone, run: RunRecord | null, opens: string | null, archived: boolean, nameOf: NameOf): CardWords {
  const seats = game.loadout?.seats.map((seat) => seat.heroes) ?? [];
  const box = boxOf(game.scenarioId);
  const setup = [seatWord(game.seatCount), game.loadout?.difficulty ?? null, box ? boxName(box.id) : null].filter((part) => part != null).join(" · ");
  return {
    title: scenarioName(game.scenarioId),
    lines: [...line(setup, "muted"), ...line(heroesWords(seats, nameOf), "muted"), ...runLines(run, nameOf), ...line(opens, nextTone(archived))],
    chip: STATUS_CHIP[standaloneStatus(game)],
    spoken: [`${scenarioName(game.scenarioId)}, ${gameCaption(game)}`, ...(run ? [runLabel(run, scenarioName(run.scenarioId), nameOf)] : [])].join(". "),
    firstSeat: seats[0] ?? [],
  };
}
