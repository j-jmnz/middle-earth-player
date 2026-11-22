import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";
import { catalog, worldFor, worldForStandalone } from "../../test/harness/fixture-world.ts";
import { skippedSetupAnswersOf } from "../../test/harness/setup-answers.ts";

import { cards as cardRows } from "../catalog/schema.ts";
import { deckRulesOf } from "../catalog/deck-rules.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../catalog/deck-save.ts";

import { briefing } from "./briefing.ts";
import { emptyLog } from "./log.ts";
import { fixture, fixtureKindOf, fixtureSave, fixtureStandalone, FIXTURE_NAMES, hasFixture, standaloneFixture, type FixtureName } from "./fixtures.ts";
import { FIXTURE_REGISTRY } from "./fixtures/registry.ts";
import { campaignPath, nextStep, openNode } from "./path.ts";
import { choiceSentence, promptSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import { contextOf, finish, resume } from "./session.ts";
import { finishStandalone, resumeStandalone, standaloneBriefing } from "./standalone.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { askingToCommit } from "../rules/families/sea/sailing-legal.ts";

// The fixtures (src/campaign/fixtures/*.json) are real games of saved deck cards: a briefing would deal each
// loadout, the reducer replays each to its moment, and the A Knife in the Dark one starts from the log scenario 1's won
// game writes. When this fails, run scripts/e2e/fixtures.ts again. `won` and `knife-lost` are the two names not committed (`OPEN`):
// no legal win of the two starter decks has been found, so the tests that need them are skipped until they are committed.
// A scenario of a cycle has no campaign save: its fixtures are one open standalone game each (the describe at the foot).
const COMMITTED = FIXTURE_NAMES.filter((name) => hasFixture(name) && fixtureKindOf(name) === "campaign");
const STANDALONE_ENTRIES = FIXTURE_REGISTRY.filter((entry) => entry.names.some((name) => fixtureKindOf(name) === "standalone"));
const WON = hasFixture("won");
const KNIFE = hasFixture("knife-lost");
// The only names the registry may hold with no committed game (docs/architecture.md, Tests).
const OPEN: readonly FixtureName[] = ["won", "knife-lost"];

const campaign = loadCampaign();

// Dream-chaser parts 2 on: the fixtures of each scenario in the registry (fixtures/registry.ts) are games of two decklists from the log the earlier parts' golden wins write
// (no won game of real decklists is searched for), so every earlier part in the campaign's order is completed, the playthrough's open scenario is this one and the path
// resumes it. A part has a `-lost` fixture and, where one is committed, a `-won` one. The Campaign Setup's offers are answered "skip" in the loadout, as many as the Setup asks (`skippedSetupAnswersOf`, test/harness/setup-answers.ts: Raid's Galdor's Counsel, the Drowned Ruins' Command and Círdan's Blessing, Haven's and The City of Corsairs' Círdan's Blessing).
const DREAM_CHASER = loadCampaign("dream-chaser");
const LATER_PARTS = FIXTURE_REGISTRY.flatMap((entry) => {
  const at = DREAM_CHASER.scenarios.indexOf(entry.scenarioId);
  if (at < 1) return [];
  const won = entry.names.find((name) => name.endsWith("-won"));
  const lost = entry.names.find((name) => name.endsWith("-lost"));
  if (!lost) throw new Error(`${entry.scenarioId} needs a -lost name in the fixture registry`);
  return [{ scenarioId: entry.scenarioId, part: at + 1, previous: DREAM_CHASER.scenarios.slice(0, at), lost, names: [...(won ? [won] : []), lost].filter((name) => hasFixture(name)) }];
});

// The scenarios of the fixture's campaign before the one the fixture plays: the one owner of what a fixture's log holds as completed.
function earlierParts(name: FixtureName): readonly string[] {
  const { campaignId, loadout } = fixture(name);
  const order = loadCampaign(campaignId).scenarios;
  return order.slice(0, Math.max(0, order.indexOf(loadout.scenarioId)));
}

describe("Save fixtures", () => {
  // A won fixture is never searched for: a name whose game is not committed (a `-won` the seeds no longer find) leaves the registry.
  it("are all committed, but scenario 1's won game and the loss dealt from its log", () => {
    const missing = FIXTURE_NAMES.filter((name) => !hasFixture(name));
    expect(missing.filter((name) => !OPEN.includes(name)), "take these names out of src/campaign/fixtures/registry.ts; do not search for a won game (docs/architecture.md, Tests)").toEqual([]);
  });

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
        // The deck's own rules apply, as the deck screen applies them: a contract's hero limit (Bond of Friendship's four).
        expect(deckSaveRefusal(seat.heroes, counts, facts, [], deckRulesOf(worldFor(name).effects, codes)), `${name} ${seat.deckId}`).toBeNull();
      }
    }
  });

  it.skipIf(!KNIFE || !WON)("knife-lost starts from the log scenario 1's won game writes with its Resolution answers", () => {
    const found = fixture("knife-lost");
    expect(found.past?.fixture).toBe("won");
    const world = worldFor("won");
    let save = fixtureSave("won", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
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
    // The answers the scenario-1 fixture gives: Gandalf's Delay and Gildor Inglorion.
    expect(found.log.campaignPool.map((card) => card.code)).toEqual(["141078", "141077"]);
    expect(found.log.completed).toEqual(["a-shadow-of-the-past"]);
    expect(found.loadout.scenarioId).toBe("a-knife-in-the-dark");
  });

  it.skipIf(!KNIFE)("knife-lost: replays to a loss, and finishing it leaves the log as it was", () => {
    const world = worldFor("knife-lost");
    const save = fixtureSave("knife-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
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
      // Every earlier part of the fixture's campaign, in the campaign's order, is completed: the log the earlier parts' won games write (a later part's fixtures are dealt from it).
      expect(save.log.completed).toEqual(earlierParts(name));
    }
  });

  it.skipIf(!WON)("won: replays to the first Resolution choice, a burden then a boon, one choice at a time", () => {
    const world = worldFor("won");
    const resumed = resume(fixtureSave("won", "s", CATALOG_VERSION), world);
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
    const resumed = resume(fixtureSave("lost", "s", CATALOG_VERSION), world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (resumed.ok) expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
  });
});

describe("duo (the peek's two-handed fixture, phase 26)", () => {
  it("is a two-handed game of scenario 1 with one deck per seat, from an empty log", () => {
    const found = fixture("duo");
    expect(found.seatCount).toBe(2);
    expect(found.loadout.seats.map((seat) => seat.deckId)).toEqual(["100-fellowship-detours-and-defense", "100-fellowship-out-of-thin-air"]);
    expect(found.loadout.scenarioId).toBe("a-shadow-of-the-past");
    expect(found.past).toBeNull();
    expect(found.log.completed).toEqual([]);
  });

  it("replays to the first player's planning window of round 1: two seats, neither eliminated, seat 0 acting, nothing won or lost", () => {
    const world = worldFor("duo");
    const resumed = resume(fixtureSave("duo", "s", CATALOG_VERSION), world);
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

describe("Voyage Across Belegaer (Dream-chaser part 1, phase 40)", () => {
  it("are games of two decklists from the blank log a new Dream-chaser playthrough starts on, the Campaign Setup answered in the game", () => {
    for (const name of ["sea-solo", "sea-duo", "voyage-lost"] as const) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("dream-chaser");
      expect(found.loadout.scenarioId, name).toBe("voyage-across-belegaer");
      expect(found.log, name).toEqual(emptyLog(found.seatCount));
      expect(found.past, name).toBeNull();
      expect(found.loadout.ringBearer, name).toBeNull();
    }
    expect(fixture("sea-solo").seatCount).toBe(1);
    expect(fixture("sea-duo").seatCount).toBe(2);
  });

  it("sea-solo replays to the first Sailing test's commit with the Heading off-course, and the Dream-chaser and one other ship in play", () => {
    const world = worldFor("sea-solo");
    const resumed = resume(fixtureSave("sea-solo", "s", CATALOG_VERSION), world);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(askingToCommit(resumed.state)).toBe(true);
    expect(resumed.state.sea?.heading).toBe("Cloud");
    const cards = contextOf(world).cards;
    const ships = Object.values(resumed.state.cards).filter((card) => cards.get(card.code)?.ship === "objective" && card.zone === "play");
    expect(ships.length).toBe(2);
  });

  it("sea-duo replays to the first player's planning window of round 1", () => {
    const resumed = resume(fixtureSave("sea-duo", "s", CATALOG_VERSION), worldFor("sea-duo"));
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.state.mode).toBe("planning");
    expect(resumed.state.activeSeat).toBe(0);
    expect(resumed.state.round).toBe(1);
  });

  it("voyage-lost replays to a loss, and finishing it writes nothing", () => {
    const world = worldFor("voyage-lost");
    const save = fixtureSave("voyage-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.active).toBeNull();
  });
});

describe.each(LATER_PARTS)("$scenarioId (Dream-chaser part $part)", ({ scenarioId, previous, lost, names }) => {
  it("are games of two decklists dealt on the scenario, the Campaign Setup's offers answered in the loadout", () => {
    for (const name of names) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("dream-chaser");
      expect(found.loadout.scenarioId, name).toBe(scenarioId);
      expect(found.loadout.choices, name).toEqual(skippedSetupAnswersOf(worldFor(name), found.loadout.seats, found.log));
      expect(found.seatCount, name).toBe(2);
      expect(found.past, name).toBeNull();
      expect(found.loadout.ringBearer, name).toBeNull();
    }
  });

  it("start from a log with the earlier parts recorded as won, so the node the path opens is this scenario, not an earlier part", () => {
    for (const name of names) {
      const found = fixture(name);
      expect(found.log.completed, name).toEqual(previous);
      expect(found.log.xpGained[previous.at(-1) ?? ""], name).toBeGreaterThan(0);
      const save = fixtureSave(name, "s", CATALOG_VERSION);
      const path = campaignPath(DREAM_CHASER, {}, save.log);
      expect(openNode(path, save.loadout?.scenarioId)?.id, name).toBe(scenarioId);
      expect(nextStep(path, save.loadout?.scenarioId), name).toMatchObject({ kind: "resume", node: { id: scenarioId } });
    }
  });

  it(`${lost} replays to a loss that writes nothing, and a won fixture to a win`, () => {
    for (const name of names) {
      const world = worldFor(name);
      const save = fixtureSave(name, "s", CATALOG_VERSION);
      const resumed = resume(save, world);
      expect(resumed.ok, `${name}: \`pnpm game show ${name}\` names the intent the replay refuses`).toBe(true);
      if (!resumed.ok) continue;
      if (name === lost) {
        expect(resumed.state.lost).toBe(true);
        const after = finish(save, world, resumed.state);
        expect(after.log).toEqual(save.log);
        expect(after.active).toBeNull();
      } else {
        expect(resumed.state.stageCleared).toBe(true);
        expect(resumed.state.lost).toBe(false);
      }
    }
  });
});

// A scenario of a cycle (Shadows of Mirkwood): the fixtures are one open standalone game each, dealt from the cycle's own order with no log and no earlier part.
describe("standalone fixtures (a cycle's scenarios)", () => {
  it("name only scenarios of a cycle, in the cycle's order", () => {
    for (const entry of STANDALONE_ENTRIES) {
      const cycle = loadCampaign(standaloneFixtureCycle(entry));
      expect(cycle.kind, entry.scenarioId).toBe("cycle");
      expect(cycle.scenarios, entry.scenarioId).toContain(entry.scenarioId);
    }
    for (const name of FIXTURE_NAMES.filter((item) => fixtureKindOf(item) === "standalone")) expect(() => fixture(name), name).toThrow();
  });

  it("are loadouts the standalone briefing deals, replayed to their win or loss", () => {
    for (const name of FIXTURE_NAMES.filter((item) => fixtureKindOf(item) === "standalone" && hasFixture(item))) {
      const found = standaloneFixture(name);
      const world = worldForStandalone(name);
      const plan = standaloneBriefing({ world, seatCount: found.seatCount, seats: found.loadout.seats, ringBearer: found.loadout.ringBearer, difficulty: found.loadout.difficulty });
      expect(plan.problems, name).toEqual([]);
      const game = fixtureStandalone(name, "s", CATALOG_VERSION);
      expect(game.active?.engineVersion, name).toBe(ENGINE_VERSION);
      const resumed = resumeStandalone(game, world);
      expect(resumed.ok, `${name}: \`pnpm game show ${name}\` names the intent the replay refuses`).toBe(true);
      if (!resumed.ok) continue;
      const ended = finishStandalone(game, world, resumed.state);
      expect(ended.result?.outcome, name).toBe(name.endsWith("-lost") ? "lost" : "won");
      expect(ended.active, name).toBeNull();
    }
    // Every cycle fixture replays in turn: about 2.5 s alone, past the default 5 s on a busy run of the whole suite.
  }, 30_000);
});

// The cycle a standalone entry belongs to: its fixture's campaign once the file holds one, else the first cycle that lists the scenario.
function standaloneFixtureCycle(entry: { scenarioId: string; names: readonly string[] }): string {
  const first = (entry.names as readonly FixtureName[]).find((name) => hasFixture(name));
  if (first) return standaloneFixture(first).campaignId;
  return ["shadows-of-mirkwood", "dwarrowdelf"].find((id) => loadCampaign(id).scenarios.includes(entry.scenarioId)) ?? "shadows-of-mirkwood";
}
