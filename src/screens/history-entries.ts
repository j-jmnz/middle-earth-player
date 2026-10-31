// How History words each card (docs/design-system.md, History): a playthrough, a standalone game, or the runs of one that was
// deleted, as the title, lines, chip and the sentence a screen reader hears. Where a card leads is the view's. Pure.
import type { RunRecord } from "../campaign/runs";
import { standaloneStatus, type ListedStandalone, type StandaloneStatus } from "../campaign/standalone";
import { BOXES, boxOf, campaignOf, scenarioName } from "./campaign-data";
import type { LibrarySave } from "./history-read";
import type { CardChip, CardLine } from "./history-rows";
import { startedOf } from "./history-list";
import { deletedWords, heroesWords, playthroughWords, plural, runDate, runDetail, runLabel } from "./history-words";
import { describe, nextSummary, partySeats } from "./save-line";
import { seatWord } from "./seats";
import { gameCaption } from "./standalone-words";

type NameOf = (code: string) => string;

export type CardWords = { title: string; lines: CardLine[]; chip: CardChip | null; spoken: string; firstHero: string | undefined };

const STATUS_CHIP: Record<StandaloneStatus, CardChip> = {
  playing: { label: "In progress", tone: "neutral" },
  won: { label: "Won", tone: "accent" },
  lost: { label: "Lost", tone: "danger" },
  dropped: { label: "Dropped", tone: "faint" },
};

const RESULT_CHIP: Record<RunRecord["result"], CardChip> = { won: STATUS_CHIP.won, lost: STATUS_CHIP.lost };

const boxName = (box: string | undefined): string | null => (box ? (BOXES.find((item) => item.id === box)?.name ?? box) : null);

const line = (text: string | null, tone: CardLine["tone"]): CardLine[] => (text ? [{ text, tone }] : []);

/** What a game's one run adds to its card: a loss's cause, then the date, rounds, threat and score. */
function runLines(run: RunRecord | null, nameOf: NameOf): CardLine[] {
  if (!run) return [];
  const cause = run.result === "lost" ? run.lossCause : null;
  const how = [runDate(run), runDetail(run, nameOf)].filter((part) => part != null).join(" · ");
  return [...line(cause, "danger"), ...line(how || null, "muted")];
}

/** "3 runs: A Shadow of the Past, Lost, 24 Oct 2026, …; …": what a card's runs say to a screen reader. */
function runsSpoken(runs: readonly RunRecord[], nameOf: NameOf): string {
  if (runs.length === 0) return "No runs yet";
  return `${plural(runs.length, "run")}: ${runs.map((run) => runLabel(run, scenarioName(run.scenarioId), nameOf, false)).join("; ")}`;
}

/** A playthrough: its campaign, the seats, start and progress, the fellowship, and what is next (or that every scenario is won). */
export function saveWords(ref: LibrarySave, runs: readonly RunRecord[], started: number | null, nameOf: NameOf): CardWords {
  const { line: worded, save } = ref;
  const seats = partySeats(save);
  const next = worded.next.kind === "finished" ? "Campaign complete" : nextSummary(worded.next);
  return {
    title: worded.name,
    lines: [...line(playthroughWords(worded.seats, started, { done: worded.done, total: worded.total }), "muted"), ...line(heroesWords(seats, nameOf), "muted"), ...line(next, "accent")],
    chip: null,
    spoken: [describe(worded), next, runsSpoken(runs, nameOf)].join(". "),
    firstHero: seats[0]?.[0],
  };
}

/** A standalone game: its scenario and how it stands, the seats, difficulty and box, the fellowship, and how its run went. */
export function gameWords(game: ListedStandalone, run: RunRecord | null, nameOf: NameOf): CardWords {
  const seats = game.loadout?.seats.map((seat) => seat.heroes) ?? [];
  const setup = [seatWord(game.seatCount), game.loadout?.difficulty ?? null, boxOf(game.scenarioId)?.name ?? null].filter((part) => part != null).join(" · ");
  return {
    title: scenarioName(game.scenarioId),
    lines: [...line(setup, "muted"), ...line(heroesWords(seats, nameOf), "muted"), ...runLines(run, nameOf)],
    chip: STATUS_CHIP[standaloneStatus(game)],
    spoken: [`${scenarioName(game.scenarioId)}, ${gameCaption(game)}`, ...(run ? [runLabel(run, scenarioName(run.scenarioId), nameOf, false)] : [])].join(". "),
    firstHero: seats[0]?.[0],
  };
}

/** The runs of a deleted playthrough (under its campaign, with the seats and start they know) or of a deleted game (one card each). */
export function goneWords(runs: readonly RunRecord[], nameOf: NameOf): CardWords | null {
  const first = runs[0];
  if (!first) return null;
  const gone = deletedWords(first.kind);
  if (first.kind === "campaign") {
    const title = campaignOf(first.campaignId ?? "")?.name ?? first.campaignId ?? "";
    return {
      title,
      lines: [...line(playthroughWords(seatWord(first.seatCount), startedOf(runs), null), "muted"), ...line(heroesWords(first.heroes, nameOf), "muted"), ...line(gone, "faint")],
      chip: null,
      spoken: [title, gone, runsSpoken(runs, nameOf)].join(". "),
      firstHero: first.heroes[0]?.[0],
    };
  }
  const setup = [seatWord(first.seatCount), boxName(first.box)].filter((part) => part != null).join(" · ");
  return {
    title: scenarioName(first.scenarioId),
    lines: [...line(setup, "muted"), ...line(heroesWords(first.heroes, nameOf), "muted"), ...runLines(first, nameOf), ...line(gone, "faint")],
    chip: RESULT_CHIP[first.result],
    spoken: runLabel(first, scenarioName(first.scenarioId), nameOf, true),
    firstHero: first.heroes[0]?.[0],
  };
}
