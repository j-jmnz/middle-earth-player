import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { ENGINE_VERSION } from "../../campaign/replay";
import type { StandaloneGame } from "../../campaign/standalone";
import { CATALOG_VERSION } from "../../catalog/version";
import {
  archiveStandalone,
  deleteStandalone,
  listArchivedStandalone,
  listStandalone,
  listStandaloneMarked,
  newStandaloneId,
  readStandalone,
  restoreStandalone,
  writeStandalone,
  writeStandaloneActive,
} from "./standalone-store";
import { standaloneGames } from "./user-schema";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

function gameOf(id: string, overrides: Partial<StandaloneGame> = {}): StandaloneGame {
  return {
    id,
    campaignId: "fellowship-of-the-ring",
    scenarioId: "a-shadow-of-the-past",
    seatCount: 1,
    loadout: { scenarioId: "a-shadow-of-the-past", difficulty: "Normal", seats: [{ deckId: "d", heroes: ["141002"], deck: ["01040"] }], ringBearer: "141001" },
    active: { engineVersion: ENGINE_VERSION, dataHash: 7, seed: 3, intents: [{ type: "Keep" }] },
    result: null,
    ...overrides,
  };
}

// The list row: the open game as its version and hash.
function listing(game: StandaloneGame) {
  return { ...game, active: game.active && { engineVersion: game.active.engineVersion, dataHash: game.active.dataHash } };
}

describe("standalone store", () => {
  it("listStandaloneMarked marks a game played on other data as needing a choice and writes nothing", () => {
    const user = openUser();
    writeStandalone(user, gameOf("game-old"), 1000);
    writeStandalone(user, gameOf("game-new", { active: { engineVersion: ENGINE_VERSION, dataHash: CATALOG_VERSION, seed: 3, intents: [] } }), 2000);
    const listed = listStandaloneMarked(user);
    expect(listed.find((game) => game.id === "game-old")).toMatchObject({ needsChoice: true, active: { engineVersion: ENGINE_VERSION, dataHash: 7 } });
    expect(listed.find((game) => game.id === "game-new")?.needsChoice).toBeUndefined();
    expect(readStandalone(user, "game-old")?.game).toEqual(gameOf("game-old"));
  });

  it("writeStandaloneActive changes only the open game, and a list row carries its version and hash", () => {
    const user = openUser();
    const game = gameOf("game-w");
    writeStandalone(user, game, 1000);
    archiveStandalone(user, "game-w", 5000);
    const next = { ...game, active: { ...game.active!, intents: [...game.active!.intents, { type: "Pass" as const }] } };
    writeStandaloneActive(user, next);
    expect(readStandalone(user, "game-w")?.game).toEqual(next);
    const row = user.select().from(standaloneGames).get();
    expect(row).toMatchObject({ createdAt: 1000, archivedAt: 5000 });
    expect(listArchivedStandalone(user)).toEqual([listing(game)]);
    writeStandaloneActive(user, { ...next, active: null });
    expect(listArchivedStandalone(user)[0]?.active).toBeNull();
  });

  it("keeps a game across a write and a read, and an update keeps its place in the list", () => {
    const user = openUser();
    const game = gameOf("game-a");
    writeStandalone(user, game, 1000);
    writeStandalone(user, gameOf("game-b"), 2000);
    expect(readStandalone(user, "game-a")).toEqual({ game, unreadable: false });
    const won = { ...game, active: null, result: { outcome: "won" as const, score: { rounds: 4, victoryPoints: 3, score: 77 } } };
    writeStandalone(user, won, 9000);
    expect(readStandalone(user, "game-a")?.game).toEqual(won);
    expect(listStandalone(user).map((item) => item.id)).toEqual(["game-b", "game-a"]);
  });

  it("archives a game out of the open list and restores it as it was", () => {
    const user = openUser();
    const game = gameOf("game-a");
    writeStandalone(user, game, 1000);
    archiveStandalone(user, "game-a", 5000);
    expect(listStandalone(user)).toEqual([]);
    expect(listArchivedStandalone(user)).toEqual([listing(game)]);
    // A write while archived (an intent recorded elsewhere) keeps the mark.
    writeStandalone(user, game, 6000);
    expect(listArchivedStandalone(user)).toEqual([listing(game)]);
    restoreStandalone(user, "game-a");
    expect(listStandalone(user)).toEqual([listing(game)]);
    expect(listArchivedStandalone(user)).toEqual([]);
  });

  it("deletes an open or an archived game for good", () => {
    const user = openUser();
    writeStandalone(user, gameOf("game-a"), 1000);
    writeStandalone(user, gameOf("game-b"), 2000);
    archiveStandalone(user, "game-b");
    deleteStandalone(user, "game-a");
    deleteStandalone(user, "game-b");
    expect(readStandalone(user, "game-a")).toBeNull();
    expect(listStandalone(user)).toEqual([]);
    expect(listArchivedStandalone(user)).toEqual([]);
  });

  it("drops an open game that does not read and says so; the row stays", () => {
    const user = openUser();
    writeStandalone(user, gameOf("game-a"), 1000);
    user.update(standaloneGames).set({ activeScenario: { engineVersion: "old" } }).run();
    expect(readStandalone(user, "game-a")).toMatchObject({ game: { active: null }, unreadable: true });
    user.update(standaloneGames).set({ loadout: {} }).run();
    const read = readStandalone(user, "game-a");
    expect(read?.game.loadout).toBeNull();
    expect(read?.game.active).toBeNull();
    if (read) writeStandalone(user, read.game);
    expect(readStandalone(user, "game-a")?.game.loadout).toBeNull();
  });

  it("makes a new id for each game", () => {
    expect(newStandaloneId(1000)).not.toBe(newStandaloneId(1000));
  });
});
