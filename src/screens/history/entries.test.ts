// History's cards: how a playthrough, a game are worded, and where a game's card leads.
import { describe, expect, it } from "vitest";

import { emptyLog } from "../../campaign/log";
import type { RunRecord } from "../../campaign/runs";
import type { ListedStandalone, StandaloneLoadout } from "../../campaign/standalone";
import { deleteGameSentence, gameDestination, gameWords, saveWords } from "./entries";
import type { LibrarySave } from "./read";
import type { SaveLine } from "./save-line";

const name = (code: string) => `N${code}`;

function run(id: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return { id, kind: "campaign", refId: "save-a", campaignId: "fellowship-of-the-ring", box: "fellowship-of-the-ring", scenarioId: "a-shadow-of-the-past", result: "won", lossCause: null, seatCount: 1, heroes: [["1", "2"]], rounds: 4, threats: [30], victoryPoints: 0, score: 44, reward: null, startedAt: null, endedAt: Date.UTC(2026, 9, 24, 12), activeMs: null, engineVersion: 6, backfilled: false, ...overrides };
}

const loadout = { difficulty: "Normal", seats: [{ heroes: ["1", "2"] }] } as unknown as StandaloneLoadout;

function game(overrides: Partial<ListedStandalone> = {}): ListedStandalone {
  return { id: "g1", campaignId: "fellowship-of-the-ring", scenarioId: "a-shadow-of-the-past", seatCount: 1, loadout, active: null, result: null, ...overrides };
}

function save(next: SaveLine["next"]): LibrarySave {
  const log = { ...emptyLog(1), heroesBySeat: [["1", "2"]] };
  return { id: "save-a", save: { id: "save-a", campaignId: "fellowship-of-the-ring", seatCount: 1, log, loadout: null, active: false }, line: { name: "Fellowship of the Ring", seats: "True solo", done: 2, total: 6, next, path: [] } };
}

const node = { id: "flight-to-the-ford", number: 3, name: "Flight to the Ford", status: "current", reward: [], score: null } as unknown as Extract<SaveLine["next"], { node: unknown }>["node"];

describe("history cards", () => {
  it("leads a game to its table, its outcome, a new deal, or nowhere", () => {
    expect(gameDestination(game({ active: { engineVersion: 6, dataHash: 1 } }), false)).toMatchObject({ to: "table", word: "Resume" });
    expect(gameDestination(game({ result: { outcome: "lost", reason: null, rounds: 3 } }), true)).toMatchObject({ to: "outcome", word: "See the outcome" });
    expect(gameDestination(game(), false)).toMatchObject({ to: "again", word: "Play again" });
    expect(gameDestination(game({ loadout: null }), false)).toBeNull();
  });

  it("says what Delete asks of a game", () => {
    expect(deleteGameSentence("A Shadow of the Past, True solo")).toBe("Delete A Shadow of the Past, True solo? It is gone for good. Your decks stay.");
  });

  it("words a playthrough with what is next, muted once it is archived, and its newest run to a screen reader", () => {
    const runs = [run("b", { result: "lost", lossCause: "Threat reached 50" }), run("a")];
    const live = saveWords(save({ kind: "begin", node }), runs, null, false, name);
    expect(live.lines).toEqual([
      { text: "True solo · 2 of 6 completed", tone: "muted" },
      { text: "N1, N2", tone: "muted" },
      { text: "Next: Flight to the Ford", tone: "accent" },
    ]);
    expect(live.firstSeat).toEqual(["1", "2"]);
    expect(live.spoken).toContain("2 runs, latest: A Shadow of the Past, Lost · Threat reached 50");
    expect(saveWords(save({ kind: "begin", node }), [], null, true, name).lines.at(-1)).toEqual({ text: "Next: Flight to the Ford", tone: "muted" });
    expect(saveWords(save({ kind: "finished" }), [], null, false, name).lines.at(-1)).toEqual({ text: "Campaign won", tone: "accent" });
    expect(saveWords(save({ kind: "finished" }), [], null, false, name).spoken).toContain("No runs yet");
  });

  it("words a game with its status, setup, run and where it leads", () => {
    const lost = game({ result: { outcome: "lost", reason: "Threat reached 50", rounds: 3 } });
    const words = gameWords(lost, run("g", { kind: "standalone", result: "lost", lossCause: "Threat reached 50", rounds: 3, threats: [50], score: null }), "See the outcome", false, name);
    expect(words.chip).toEqual({ label: "Lost", tone: "danger" });
    expect(words.lines).toEqual([
      { text: "True solo · Normal · Fellowship of the Ring", tone: "muted" },
      { text: "N1, N2", tone: "muted" },
      { text: "Threat reached 50", tone: "danger" },
      { text: "24 Oct 2026 · 3 rounds · threat 50", tone: "muted" },
      { text: "See the outcome", tone: "accent" },
    ]);
    // Managing leaves the run out.
    expect(gameWords(lost, null, null, false, name).lines).toHaveLength(2);
  });
});
