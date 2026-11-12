import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import migrations from "../../../drizzle/migrations";
import { loadCampaign } from "../../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../../test/harness/temp-catalog.ts";
import { ENGINE_VERSION } from "../../campaign/replay.ts";
import { record } from "../../campaign/session.ts";
import { dealStandalone, type StandaloneLoadout } from "../../campaign/standalone.ts";
import { CATALOG_VERSION } from "../../catalog/version.ts";
import { loadWorld } from "../../campaign/world.ts";
import { EFFECTS } from "../../effects/index.ts";
import { readStandalone, writeStandalone, writeStandaloneActive } from "../data/standalone-store.ts";
import { campaignOf, scenarioOf } from "../data/campaign-data";
import { openStandalone, standaloneCodes } from "./standalone-open.ts";

function openUser() {
  const sqlite = new Database(":memory:");
  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, "0")}` as keyof typeof migrations.migrations;
    for (const statement of migrations.migrations[key].split("--> statement-breakpoint")) if (statement.trim()) sqlite.exec(statement.trim());
  }
  return drizzle(sqlite);
}

const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const PAST = "a-shadow-of-the-past";

// A game saved before the world stamp is current on its catalog version: the first open hands back the stamped game to write once.
describe("opening a standalone game", () => {
  const stealth = loadCampaign().starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
  const deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
  const loadout: StandaloneLoadout = { scenarioId: PAST, difficulty: "Normal", seats: [{ deckId: "deck", heroes: ["141002", "141003", "141004"], deck }], ringBearer: "141001" };
  const campaign = campaignOf("fellowship-of-the-ring")!;
  const world = loadWorld(catalog, campaign, scenarioOf(PAST)!, EFFECTS, ["141001", "141002", "141003", "141004", ...deck]);
  const dealt = dealStandalone("game-1", world, 1, loadout, 1);
  if (!dealt.ok) throw new Error("not dealt");
  const legacy = { ...dealt.game, active: { ...dealt.game.active!, world: null } };

  it("stamps a current legacy game once, and is not written by the open", () => {
    const user = openUser();
    writeStandalone(user, legacy);
    const opened = openStandalone(catalog, user, "game-1");
    if (!opened.ok) throw new Error(opened.reason);
    expect(standaloneCodes(opened.stored).length).toBeGreaterThan(0);
    expect(readStandalone(user, "game-1")!.game.active!.world).toBeNull();
    expect(typeof opened.stamp?.active?.world).toBe("number");
    writeStandaloneActive(user, opened.stamp!);
    expect(readStandalone(user, "game-1")!.game.active).toEqual(dealt.game.active);
    expect(openStandalone(catalog, user, "game-1")).toMatchObject({ ok: true, stamp: null });
  });

  it("asks for a choice, writing nothing, for a legacy game on other data or a stamp of another world", () => {
    const user = openUser();
    const old = { ...legacy, active: { ...legacy.active, dataHash: CATALOG_VERSION + 1 } };
    writeStandalone(user, old);
    expect(openStandalone(catalog, user, "game-1")).toMatchObject({ ok: false, reason: "stale", write: null });
    expect(readStandalone(user, "game-1")!.game.active).toEqual(old.active);
    writeStandalone(user, { ...dealt.game, active: { ...dealt.game.active!, world: dealt.game.active!.world! + 1 } });
    expect(openStandalone(catalog, user, "game-1")).toMatchObject({ ok: false, reason: "stale", write: null });
  });

  it("backfills the checks of a current game once; with them, another engine version resumes with no message when every move matches, and a changed check asks for a choice", () => {
    const user = openUser();
    writeStandalone(user, record(dealt.game, { type: "Keep" }));
    const opened = openStandalone(catalog, user, "game-1");
    if (!opened.ok) throw new Error(opened.reason);
    const active = opened.stamp!.active!;
    expect(active.checks).toHaveLength(1);
    writeStandaloneActive(user, { ...opened.stamp!, active: { ...active, engineVersion: ENGINE_VERSION - 1 } });
    const moved = openStandalone(catalog, user, "game-1");
    expect(moved).toMatchObject({ ok: true });
    expect(moved.ok && moved.stamp?.active).toEqual(active);
    writeStandaloneActive(user, { ...opened.stamp!, active: { ...active, engineVersion: ENGINE_VERSION - 1, checks: [active.checks![0]! + 1] } });
    expect(openStandalone(catalog, user, "game-1")).toMatchObject({ ok: false, reason: "stale", write: null, takenBack: 1 });
  });
});
