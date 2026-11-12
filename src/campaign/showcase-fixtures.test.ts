import { readFileSync } from "node:fs";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { boardHolds, seatsStanding } from "../../scripts/e2e/seed-kit.ts";
import { MEC109_CHANGED, MEC112_CHANGED } from "../../scripts/data/printed/scope.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import { legalTargets } from "../rules/engine/reduce.ts";

import scenarioOne from "./fixtures/scenario-1.json";
import { fixture, fixtureSave, hasFixture, type FixtureName } from "./fixtures.ts";
import { contextOf, resume } from "./session.ts";
import { loadWorld, logCodes } from "./world.ts";

// The README showcase's saves (docs/showcase.md, Saves and decks) replay to the moments the capture flows open: a full table on a planning window,
// a quest commit and an enemy's attack waiting for a defender. What a flow taps (`showcase` in scenario-1.json) is a move the moment offers.
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));
const TAPS = scenarioOne as unknown as Record<string, { showcase?: { commit?: string[]; defender?: string } }>;

// The card ids a capture flow taps in the tray (.maestro/showcase/<shot>.yaml).
const tapped = (shot: string): string[] => [...readFileSync(new URL(`../../.maestro/showcase/${shot}.yaml`, import.meta.url), "utf8").matchAll(/id: sheet-option-(\w+)/g)].map((found) => found[1] as string);

function opened(name: FixtureName) {
  const { loadout, log, campaignId } = fixture(name);
  const codes = [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)];
  const world = loadWorld(catalog, loadCampaign(campaignId), loadScenario(loadout.scenarioId), EFFECTS, codes);
  const resumed = resume(fixtureSave(name, "s", CATALOG_VERSION), world, CATALOG_VERSION);
  if (!resumed.ok) throw new Error(`${name}: ${resumed.reason}`);
  return { state: resumed.state, ctx: contextOf(world) };
}

describe("README showcase fixtures", () => {
  it("are committed, two-handed", () => {
    for (const name of ["past-showcase-board", "past-showcase-quest", "past-showcase-combat", "sea-showcase", "deep-showcase"] as const) {
      expect(hasFixture(name), name).toBe(true);
      expect(fixture(name).seatCount, name).toBe(2);
    }
  });

  it("the tables park on the first player's planning window from round 3 on, full", () => {
    const least = { "past-showcase-board": { play: 8, attached: 4, engaged: 1, staging: 2, location: true }, "sea-showcase": { play: 8, staging: 2 }, "deep-showcase": { play: 8, engaged: 2, staging: 2 } } as const;
    for (const [name, board] of Object.entries(least) as [FixtureName, (typeof least)[keyof typeof least]][]) {
      const { state } = opened(name);
      expect(state.lost, name).toBe(false);
      expect(state.round, name).toBeGreaterThanOrEqual(3);
      expect([state.mode, state.activeSeat], name).toEqual(["planning", 0]);
      expect(boardHolds(state, board), name).toBe(true);
      expect(seatsStanding(state, 2), `${name}: both players in, two heroes or more`).toBe(true);
    }
  });

  // Every face-up card the tables show has a picture pin, so the capture draws its full picture (data/sources.json, pictures). The cards no picture
  // source carries are the ones scripts/data/sources/pictures.test.ts excepts (the MEC109 and MEC112 printings whose wording differs, Navigation): each
  // must then have its scan, Hall of Beorn's whole-card image, which is larger than the table draws a card.
  it("show only cards with a picture pin", () => {
    const { sources } = JSON.parse(readFileSync(new URL("../../data/sources.json", import.meta.url), "utf8")) as { sources: Record<string, { files: { path: string }[] } | undefined> };
    const pinned = new Set([...(sources.pictures?.files ?? []), ...(sources.nightmare?.files ?? [])].map((file) => /^pictures\/(\w+)\.A\./.exec(file.path)?.[1]).filter((code) => code != null));
    const scanned = new Set((sources.scans?.files ?? []).map((file) => /^scans\/(\w+)\.A\./.exec(file.path)?.[1]).filter((code) => code != null));
    const unpictured = new Set<string>([...MEC109_CHANGED, ...MEC112_CHANGED, "11084"]);
    const shown = new Set(["heroes", "play", "engaged", "staging", "activeLocation", "secondActiveLocation", "questStage", "hand"]);
    const missing: string[] = [];
    for (const name of ["past-showcase-board", "past-showcase-quest", "past-showcase-combat", "sea-showcase", "deep-showcase"] as const) {
      const { state } = opened(name);
      for (const card of Object.values(state.cards)) {
        if (shown.has(card.zone) && card.face !== "down" && !pinned.has(card.code) && !(unpictured.has(card.code) && scanned.has(card.code))) missing.push(`${name} ${card.code}`);
      }
    }
    expect([...new Set(missing)], "Run pnpm data sync pictures, or pick another seed").toEqual([]);
  });

  it("past-showcase-quest parks on a quest commit whose characters the flow commits", () => {
    const { state, ctx } = opened("past-showcase-quest");
    expect(state.mode).toBe("questCommit");
    const commit = TAPS["past-showcase-quest"]?.showcase?.commit ?? [];
    expect(commit.length).toBeGreaterThan(0);
    const legal = legalTargets(state, { type: "Commit" }, ctx);
    for (const id of commit) expect(legal, id).toContain(id);
    expect(commit, "the first three rows of the tray, which the iPhone shows without scrolling").toEqual(legal.slice(0, 3));
    expect(tapped("table-quest"), "the quest GIF's flow taps the committed characters").toEqual(commit);
  });

  it("past-showcase-combat parks on an attack whose defender the flow declares", () => {
    const { state, ctx } = opened("past-showcase-combat");
    expect(state.window?.kind).toBe("defense");
    const defender = TAPS["past-showcase-combat"]?.showcase?.defender;
    expect(defender).toBeDefined();
    expect(legalTargets(state, { type: "DeclareDefender" }, ctx).slice(0, 3), "one of the tray's first three rows").toContain(defender);
    expect(tapped("table-combat"), "the combat GIF's flow taps the defender").toEqual([defender]);
  });
});
