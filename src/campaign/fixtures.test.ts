import Database from "better-sqlite3";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_VERSION } from "../rules/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../scripts/temp-catalog.ts";

import { cards as cardRows } from "../catalog/schema.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../catalog/deck-save.ts";

import { briefing } from "./briefing.ts";
import { fixture, fixtureSave, FIXTURE_NAMES, hasFixture, type FixtureName } from "./fixtures.ts";
import { campaignPath } from "./path.ts";
import { choiceSentence, promptSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import { contextOf, finish, resume } from "./session.ts";
import { loadWorld, logCodes } from "./world.ts";
import { reduce } from "../rules/reduce.ts";

// The Maestro fixtures (src/campaign/fixtures/*.json) are real games of saved deck cards: a briefing would deal each
// loadout, the reducer replays each to its moment, and the A Knife in the Dark one starts from the log scenario 1's won
// game writes. When this fails, run scripts/e2e-fixtures.ts again. `won` and `knife-lost` are open (docs/phases/STATUS.md):
// no legal win of the two starter decks has been found, so the tests that need them are skipped until they are committed.
const COMMITTED = FIXTURE_NAMES.filter(hasFixture);
const WON = hasFixture("won");
const KNIFE = hasFixture("knife-lost");

const campaign = loadCampaign();
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

function worldFor(name: FixtureName) {
  const { loadout, log, campaignId } = fixture(name);
  const codes = [...(loadout.ringBearer ? [loadout.ringBearer] : []), ...loadout.seats.flatMap((seat) => [...seat.heroes, ...seat.deck]), ...logCodes(log)];
  return loadWorld(catalog, loadCampaign(campaignId), loadScenario(loadout.scenarioId), EFFECTS, codes);
}

describe("Maestro fixtures", () => {
  it("are loadouts a briefing deals, from the fixture's log", () => {
    for (const name of COMMITTED) {
      const { loadout, seatCount, log } = fixture(name);
      const plan = briefing({ world: worldFor(name), log, seatCount, seats: loadout.seats, ringBearer: loadout.ringBearer, difficulty: loadout.difficulty, choices: loadout.choices, acceptPenalty: loadout.acceptPenalty });
      expect(plan.problems, name).toEqual([]);
    }
  });

  it("deal ordinary saved decks: deck-legal catalog cards that the deck screen would save", () => {
    for (const name of COMMITTED) {
      for (const seat of fixture(name).loadout.seats) {
        const codes = [...new Set([...seat.heroes, ...seat.deck])];
        const facts = new Map<string, DeckSaveCard>(
          catalog
            .select()
            .from(cardRows)
            .where(inArray(cardRows.code, codes))
            .all()
            .map((row) => [row.code, { name: row.name, typeCode: row.typeCode, sphereCode: row.sphereCode, deckLimit: row.deckLimit, deckLegal: row.deckLegal, traits: row.traits }]),
        );
        const counts = [...new Set(seat.deck)].map((code) => ({ code, count: seat.deck.filter((item) => item === code).length }));
        expect(deckSaveRefusal(seat.heroes, counts, facts), `${name} ${seat.deckId}`).toBeNull();
      }
    }
  });

  it.skipIf(!KNIFE || !WON)("knife-lost starts from the log scenario 1's won game writes with its Resolution answers", () => {
    const found = fixture("knife-lost");
    expect(found.past?.fixture).toBe("won");
    const world = worldFor("won");
    let save = fixtureSave("won", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    let state = resumed.state;
    for (const optionId of found.past?.choices ?? []) {
      const next = reduce(state, { type: "ChooseResolution", optionId }, contextOf(world));
      if (!next.ok) throw new Error(next.reason);
      state = next.state;
    }
    expect(resolutionView(state, world).kind).toBe("settled");
    save = finish(save, world, state);
    expect(found.log).toEqual(save.log);
    // The answers the scenario-1 Maestro flow gives: Gandalf's Delay and Gildor Inglorion.
    expect(found.log.campaignPool.map((card) => card.code)).toEqual(["141078", "141077"]);
    expect(found.log.completed).toEqual(["a-shadow-of-the-past"]);
    expect(found.loadout.scenarioId).toBe("a-knife-in-the-dark");
  });

  it.skipIf(!KNIFE)("knife-lost: replays to a loss, and finishing it leaves the log as it was", () => {
    const world = worldFor("knife-lost");
    const save = fixtureSave("knife-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.active).toBeNull();
    expect(campaignPath(campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
  });

  it("are stamped with this build's engine and catalog versions", () => {
    if (KNIFE) expect(fixtureSave("knife-lost", "s", CATALOG_VERSION).log.completed).toEqual(["a-shadow-of-the-past"]);
    for (const name of COMMITTED.filter((item) => item !== "knife-lost")) {
      const save = fixtureSave(name, "s", CATALOG_VERSION);
      expect(save.active?.engineVersion).toBe(ENGINE_VERSION);
      expect(save.active?.dataHash).toBe(CATALOG_VERSION);
      expect(save.log.completed).toEqual([]);
    }
  });

  it.skipIf(!WON)("won: replays to the first Resolution choice, a burden then a boon, one choice at a time", () => {
    const world = worldFor("won");
    const resumed = resume(fixtureSave("won", "s", CATALOG_VERSION), world, CATALOG_VERSION);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    const burden = resolutionView(resumed.state, world);
    expect(burden.kind).toBe("choosing");
    if (burden.kind !== "choosing") return;
    expect(burden.eyebrow).toBe("Choose a burden");
    expect(burden.seatLabel).toBeNull();
    expect(burden.tiles.map((tile) => tile.code).sort()).toEqual(["141078", "141079"]);
    const tile = burden.tiles.find((item) => item.code === "141078");
    expect(tile && choiceSentence(burden, tile)).toBe("Gandalf's Delay is added to the campaign pool.");
    // The prompt is built from the noun; this burden cannot be declined.
    expect(burden.decline).toBeNull();
    expect(promptSentence(burden)).toBe("Choose a burden. Your choice is written to the campaign log when you confirm.");
    expect(promptSentence({ ...burden, decline: { optionId: "skip", label: "No burden" } })).toBe("Choose a burden, or tap No burden. Your choice is written to the campaign log when you confirm.");
    const next = reduce(resumed.state, { type: "ChooseResolution", optionId: "141078" }, contextOf(world));
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const boon = resolutionView(next.state, world);
    expect(boon.kind === "choosing" ? boon.eyebrow : boon.kind).toBe("Choose a boon");
    const last = reduce(next.state, { type: "ChooseResolution", optionId: boon.kind === "choosing" ? (boon.tiles[0]?.optionId ?? "") : "" }, contextOf(world));
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    const settled = resolutionView(last.state, world);
    expect(settled.kind).toBe("settled");
    if (settled.kind === "settled") expect(settledSentence(settled, world, "A Knife in the Dark")).toMatch(/^Confirming records Gandalf's Delay and .+ in the campaign and unlocks A Knife in the Dark\.$/);
  });

  it("lost: replays to a loss", () => {
    const world = worldFor("lost");
    const resumed = resume(fixtureSave("lost", "s", CATALOG_VERSION), world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (resumed.ok) expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
  });
});

describe("Passage Through Mirkwood (Mirkwood Paths part 1, phase 29)", () => {
  it("are two-handed games of two decklists from an empty Mirkwood Paths log, with no Ring-bearer", () => {
    for (const name of ["mirkwood-won", "mirkwood-lost"] as const) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("mirkwood-paths");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("passage-through-mirkwood");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.log.completed, name).toEqual([]);
      expect(fixtureSave(name, "s", CATALOG_VERSION).campaignId, name).toBe("mirkwood-paths");
    }
  });

  it("mirkwood-won replays to a win with nothing to answer, and confirming it writes the Resolution and unlocks Journey Along the Anduin", () => {
    const world = worldFor("mirkwood-won");
    const save = fixtureSave("mirkwood-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    // Beorn's Path (stage 3B 01122), which the Maestro flow's sentence and log rows name.
    expect(resumed.state.stagesReached).toEqual(["01120", "01122"]);
    if (view.kind === "settled") expect(settledSentence(view, world, "Journey Along the Anduin")).toBe("Confirming records 2 copies of Mendor's Support and Ungoliant's Swarm in the campaign and unlocks Journey Along the Anduin.");
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["passage-through-mirkwood"]);
    expect(after.log.campaignPool.filter((card) => card.code === "01132")).toHaveLength(2);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
  });

  it("mirkwood-lost replays to a loss when Mendor leaves play, and finishing it leaves the log as it was", () => {
    const world = worldFor("mirkwood-lost");
    const save = fixtureSave("mirkwood-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.state.lossReason).toBe("Mendor left play");
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: "Mendor left play" });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)[0]).toBe("current");
  });
});

describe("duo (the peek's two-handed fixture, phase 26)", () => {
  it("is a two-handed game of scenario 1 with one deck per seat, from an empty log", () => {
    const found = fixture("duo");
    expect(found.seatCount).toBe(2);
    expect(found.loadout.seats.map((seat) => seat.deckId)).toEqual(["stealth-and-steadfastness", "wisdom-and-wizardry"]);
    expect(found.loadout.scenarioId).toBe("a-shadow-of-the-past");
    expect(found.past).toBeNull();
    expect(found.log.completed).toEqual([]);
  });

  it("replays to the first player's planning window of round 1: two seats, neither eliminated, seat 0 acting, nothing won or lost", () => {
    const world = worldFor("duo");
    const resumed = resume(fixtureSave("duo", "s", CATALOG_VERSION), world, CATALOG_VERSION);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    const state = resumed.state;
    expect(state.seatCount).toBe(2);
    expect(state.mode).toBe("planning");
    expect(state.round).toBe(1);
    expect(state.activeSeat).toBe(0);
    expect(state.lost).toBe(false);
    expect(state.seats.slice(0, 2).map((seat) => seat.eliminated)).toEqual([false, false]);
    // The seat the peek shows holds cards of its own.
    expect(state.seats[1]?.hand.length).toBeGreaterThan(0);
    expect(state.seats[1]?.heroes.length).toBeGreaterThan(0);
    expect(state.seats[0]?.hand).not.toEqual(state.seats[1]?.hand);
  });
});
