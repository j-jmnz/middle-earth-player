import Database from "better-sqlite3";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { CATALOG_VERSION } from "../catalog/version.ts";
import { ENGINE_VERSION } from "../rules/engine/version.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";

import { cards as cardRows } from "../catalog/schema.ts";
import { deckSaveRefusal, type DeckSaveCard } from "../catalog/deck-save.ts";

import { briefing } from "./briefing.ts";
import { emptyLog } from "./log.ts";
import { fixture, fixtureSave, FIXTURE_NAMES, hasFixture, type FixtureName } from "./fixtures.ts";
import { FIXTURE_REGISTRY } from "./fixtures/registry.ts";
import { campaignPath, nextStep, openNode } from "./path.ts";
import { choiceSentence, promptSentence, resolutionView, settledSentence } from "./resolution-view.ts";
import { contextOf, finish, resume } from "./session.ts";
import { loadWorld, logCodes } from "./world.ts";
import { reduce } from "../rules/engine/reduce.ts";
import { askingToCommit } from "../rules/families/sea/sailing-legal.ts";

// The Maestro fixtures (src/campaign/fixtures/*.json) are real games of saved deck cards: a briefing would deal each
// loadout, the reducer replays each to its moment, and the A Knife in the Dark one starts from the log scenario 1's won
// game writes. When this fails, run scripts/e2e/fixtures.ts again. `won` and `knife-lost` are open (docs/phases/STATUS.md):
// no legal win of the two starter decks has been found, so the tests that need them are skipped until they are committed.
const COMMITTED = FIXTURE_NAMES.filter(hasFixture);
const WON = hasFixture("won");
const KNIFE = hasFixture("knife-lost");

const campaign = loadCampaign();
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

// Dream-chaser parts 2 on: the fixtures of each scenario in the registry (fixtures/registry.ts) are games of two decklists from the log the earlier parts' golden wins write
// (the Voyage's `voyage-won` and the like, wins of real decklists, are open), so every earlier part in the campaign's order is completed, the playthrough's open scenario is this one and the path
// resumes it. A name whose game the seeds did not find is not committed and has nothing to check. The Campaign Setup's offers are answered in the loadout (Raid's Galdor's Counsel, the Drowned Ruins' Command and Círdan's Blessing, Haven's and The City of Corsairs' Círdan's Blessing).
const DREAM_CHASER = loadCampaign("dream-chaser");
const SETUP_CHOICES: Readonly<Record<string, readonly string[]>> = { "raid-on-the-grey-havens": ["skip", "skip"], "the-drowned-ruins": ["skip", "skip", "skip", "skip"], "a-storm-on-cobas-haven": ["skip", "skip"], "the-city-of-corsairs": ["skip", "skip"] };
const LATER_PARTS = FIXTURE_REGISTRY.flatMap((entry) => {
  const at = DREAM_CHASER.scenarios.indexOf(entry.scenarioId);
  if (at < 1) return [];
  const won = entry.names.find((name) => name.endsWith("-won"));
  const lost = entry.names.find((name) => name.endsWith("-lost"));
  if (!won || !lost) throw new Error(`${entry.scenarioId} needs a -won and a -lost name in the fixture registry`);
  return [{ scenarioId: entry.scenarioId, part: at + 1, previous: DREAM_CHASER.scenarios.slice(0, at), won, lost, names: [won, lost].filter((name) => hasFixture(name)) }];
});

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
      // The Journey Along the Anduin fixtures start from the log Passage Through Mirkwood's won game writes, the Caves of Nibin-Dûm ones from The Oath's, Lost in Mirkwood's from Journey Up the Anduin's, The King's Quest's from both earlier Ered Mithrin parts', The Withered Heath's from the three, Roam Across Rhovanion's from the four, Fire in the Night's from the five, each later Dream-chaser part's from the log the earlier parts' golden wins write (LATER_PARTS).
      const later = LATER_PARTS.find((part) => part.won === name || part.lost === name);
      expect(save.log.completed).toEqual(later ? later.previous : name.startsWith("dol-guldur-") ? ["passage-through-mirkwood", "journey-along-the-anduin"] : name.startsWith("anduin-") ? ["passage-through-mirkwood"] : name.startsWith("nibin-dum-") ? ["the-oath"] : name.startsWith("lostmirk-") ? ["journey-up-the-anduin"] : name.startsWith("kingsquest-") ? ["journey-up-the-anduin", "lost-in-mirkwood"] : name.startsWith("heath-") ? ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest"] : name.startsWith("rhovanion-") ? ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath"] : name.startsWith("night-") ? ["journey-up-the-anduin", "lost-in-mirkwood", "the-kings-quest", "the-withered-heath", "roam-across-rhovanion"] : []);
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
    if (view.kind === "settled") expect(settledSentence(view, world, "Journey Along the Anduin")).toBe("Confirming records 2 copies of Mendor's Support and the burden Ungoliant's Swarm in the campaign and unlocks Journey Along the Anduin.");
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

describe("Journey Along the Anduin (Mirkwood Paths part 2, phase 30)", () => {
  const ANDUIN_LOST = hasFixture("anduin-lost");
  const ANDUIN_WON = hasFixture("anduin-won");

  it.skipIf(!ANDUIN_LOST && !ANDUIN_WON)("start from the log Passage Through Mirkwood's won game writes, in a Mirkwood Paths save with no Ring-bearer", () => {
    const past = fixture("mirkwood-won");
    const world = worldFor("mirkwood-won");
    const passageSave = fixtureSave("mirkwood-won", "s", CATALOG_VERSION);
    const resumed = resume(passageSave, world, CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    const written = finish(passageSave, world, resumed.state).log;
    for (const name of ["anduin-won", "anduin-lost"] as const) {
      if (!hasFixture(name)) continue;
      const found = fixture(name);
      expect(found.campaignId, name).toBe("mirkwood-paths");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("journey-along-the-anduin");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.past?.fixture, name).toBe("mirkwood-won");
      expect(found.log, name).toEqual(written);
      expect(found.log.completed, name).toEqual(["passage-through-mirkwood"]);
      expect(past.seatCount, name).toBe(2);
    }
  });

  it.skipIf(!ANDUIN_LOST)("anduin-lost replays to a loss, and finishing it leaves the log as it was", () => {
    const world = worldFor("anduin-lost");
    const save = fixtureSave("anduin-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "current", "locked"]);
  });

  it.skipIf(!ANDUIN_WON)("anduin-won replays to a win with nothing to answer, and confirming it writes the prisoner and unlocks Escape from Dol Guldur", () => {
    const world = worldFor("anduin-won");
    const save = fixtureSave("anduin-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    if (view.kind === "settled") {
      expect(view.prisoner).toBeTruthy();
      expect(settledSentence(view, world, "Escape from Dol Guldur")).toMatch(/ and unlocks Escape from Dol Guldur\. .+, the hero with the most damage, is taken prisoner\.$/);
    }
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["passage-through-mirkwood", "journey-along-the-anduin"]);
    expect(after.log.prisoner).toBe(view.kind === "settled" ? view.prisoner : null);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 3)).toEqual(["completed", "completed", "current"]);
  });
});

describe("Escape from Dol Guldur (Mirkwood Paths part 3, phase 31)", () => {
  const LOST = hasFixture("dol-guldur-lost");

  it.skipIf(!LOST)("dol-guldur-lost replays to a loss, and finishing it writes nothing", () => {
    const world = worldFor("dol-guldur-lost");
    const save = fixtureSave("dol-guldur-lost", "s", CATALOG_VERSION);
    expect(save.log.prisoner).toBeTruthy();
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status).slice(0, 4)).toEqual(["completed", "completed", "current", "locked"]);
  });
});

describe("The Oath (The Dark of Mirkwood part 1, phase 32)", () => {
  it("are two-handed games of two decklists from the blank log a new The Dark of Mirkwood playthrough starts on, each seat's Adaptation chosen", () => {
    for (const name of ["oath-won", "oath-lost"] as const) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("the-dark-of-mirkwood");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("the-oath");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.log, name).toEqual(emptyLog(2));
      expect(found.past, name).toBeNull();
      expect(found.loadout.choices.map((choice) => choice.split(">")[0]), name).toEqual(["41044", "41045"]);
    }
  });

  it("oath-won replays to a win with nothing to answer, and confirming it writes the used Adaptation and the pool, and unlocks The Caves of Nibin-Dûm", () => {
    const world = worldFor("oath-won");
    const save = fixtureSave("oath-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    // Goblin Troop was brought into play (stage 3's When Revealed) and defeated: it is not set aside (rr.quest-advancement).
    expect(Object.values(resumed.state.cards).filter((card) => card.code === "41019").map((card) => card.zone)).not.toContain("setAside");
    if (view.kind === "settled") expect(settledSentence(view, world, "The Caves of Nibin-Dûm")).toMatch(/^Confirming records .* and unlocks The Caves of Nibin-Dûm\. .* recorded as used this campaign\./);
    const tokens = Object.values(resumed.state.cards).find((card) => card.code === "41050")?.resources ?? -1;
    expect(tokens).toBeGreaterThanOrEqual(0);
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["the-oath"]);
    expect(after.log.counters).toEqual({});
    expect(after.log.usedOnce.length).toBeGreaterThan(0);
    // The Adaptations the seats chose and Stalking Goblin are in the pool; Guilty Conscience with 6 or more tokens.
    const pool = after.log.campaignPool.map((card) => card.code);
    expect(pool).toEqual(expect.arrayContaining(["41044", "41045", "41041"]));
    expect(pool.includes("41043")).toBe(tokens >= 6);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["completed", "current"]);
  });

  it("oath-lost replays to a loss, and finishing it writes nothing", () => {
    const world = worldFor("oath-lost");
    const save = fixtureSave("oath-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.log.usedOnce).toEqual([]);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["current", "locked"]);
  });
});

describe("The Caves of Nibin-Dûm (The Dark of Mirkwood part 2, phase 33)", () => {
  const WON = hasFixture("nibin-dum-won");

  it("start from the log a real oath-won game writes when it is confirmed, in a The Dark of Mirkwood save, each seat's cards from the pool", () => {
    const oathSave = fixtureSave("oath-won", "s", CATALOG_VERSION);
    const resumed = resume(oathSave, worldFor("oath-won"), CATALOG_VERSION);
    if (!resumed.ok) throw new Error(resumed.reason);
    const written = finish(oathSave, worldFor("oath-won"), resumed.state).log;
    for (const name of ["nibin-dum-won", "nibin-dum-lost"] as const) {
      if (!hasFixture(name)) continue;
      const found = fixture(name);
      expect(found.campaignId, name).toBe("the-dark-of-mirkwood");
      expect(found.seatCount, name).toBe(2);
      expect(found.loadout.scenarioId, name).toBe("the-caves-of-nibin-dum");
      expect(found.loadout.ringBearer, name).toBeNull();
      expect(found.log, name).toEqual(written);
      expect(found.log.completed, name).toEqual(["the-oath"]);
      expect(found.past?.fixture, name).toBe("oath-won");
    }
  });

  it("nibin-dum-lost replays to a loss, and finishing it writes nothing: The Caves of Nibin-Dûm stays current and nothing is carried over", () => {
    const world = worldFor("nibin-dum-lost");
    const save = fixtureSave("nibin-dum-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.log.carryOver).toEqual([]);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["completed", "current"]);
  });

  it.skipIf(!WON)("nibin-dum-won replays to a win with nothing to answer, and confirming it completes the campaign and writes the Ranger Sense carry-over", () => {
    const world = worldFor("nibin-dum-won");
    const save = fixtureSave("nibin-dum-won", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.stageCleared && !resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    const view = resolutionView(resumed.state, world);
    expect(view.kind).toBe("settled");
    const after = finish(save, world, resumed.state);
    expect(after.log.completed).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(campaignPath(world.campaign, {}, after.log).map((node) => node.status)).toEqual(["completed", "completed"]);
    const highest = Math.max(...resumed.state.seats.slice(0, resumed.state.seatCount).map((seat) => seat.threat));
    expect(after.log.carryOver.map((card) => card.code)).toEqual(highest < 40 ? ["41049"] : []);
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
    const resumed = resume(fixtureSave("sea-solo", "s", CATALOG_VERSION), world, CATALOG_VERSION);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(askingToCommit(resumed.state)).toBe(true);
    expect(resumed.state.sea?.heading).toBe("Cloud");
    const cards = contextOf(world).cards;
    const ships = Object.values(resumed.state.cards).filter((card) => cards.get(card.code)?.ship === "objective" && card.zone === "play");
    expect(ships.length).toBe(2);
  });

  it("sea-duo replays to the first player's planning window of round 1", () => {
    const resumed = resume(fixtureSave("sea-duo", "s", CATALOG_VERSION), worldFor("sea-duo"), CATALOG_VERSION);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.state.mode).toBe("planning");
    expect(resumed.state.activeSeat).toBe(0);
    expect(resumed.state.round).toBe(1);
  });

  it("voyage-lost replays to a loss, and finishing it writes nothing", () => {
    const world = worldFor("voyage-lost");
    const save = fixtureSave("voyage-lost", "s", CATALOG_VERSION);
    const resumed = resume(save, world, CATALOG_VERSION);
    expect(resumed.ok && resumed.state.lost).toBe(true);
    if (!resumed.ok) return;
    expect(resolutionView(resumed.state, world)).toEqual({ kind: "lost", reason: resumed.state.lossReason });
    const after = finish(save, world, resumed.state);
    expect(after.log).toEqual(save.log);
    expect(after.active).toBeNull();
  });
});

describe.each(LATER_PARTS)("$scenarioId (Dream-chaser part $part)", ({ scenarioId, previous, won, lost, names }) => {
  it("are games of two decklists dealt on the scenario, the Campaign Setup's offers answered in the loadout", () => {
    for (const name of names) {
      const found = fixture(name);
      expect(found.campaignId, name).toBe("dream-chaser");
      expect(found.loadout.scenarioId, name).toBe(scenarioId);
      expect(found.loadout.choices, name).toEqual(SETUP_CHOICES[scenarioId] ?? []);
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

  it(`${won} replays to a win, and ${lost} to a loss that writes nothing`, () => {
    for (const name of names) {
      const world = worldFor(name);
      const save = fixtureSave(name, "s", CATALOG_VERSION);
      const resumed = resume(save, world, CATALOG_VERSION);
      expect(resumed.ok, name).toBe(true);
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
