// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.campaign-pool, rr.campaign-log, rr.winning-the-game, rr.removed-from-game, ltp.campaign-setup-checklist, tdom.mini-campaign
// (data/rules/entries.json). The Caves of Nibin-Dûm in a campaign: what The Oath hands it (its pool and its facts, in Mirkwood Paths and in The Dark of Mirkwood), its campaign card's Setup
// at the checklist, what a win writes (the Ranger Sense carry-over) and unlocks (the end of the campaign), and what a loss leaves.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { holds } from "../rules/interpret/conditions.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { withSeat } from "../rules/core/state.ts";
import { OATH_GOLDENS, oathPlan, oathWorld, playGolden as playOath } from "../../scripts/oath-game.ts";
import { CAVES_GOLDENS, cavesLoadout, cavesWorld, playGolden } from "../../scripts/nibin-dum-game.ts";
import { campaign, cavesTable, loadCavesWorld, caves, type CavesWorld } from "../../scripts/nibin-dum-scene.ts";
import { loadCampaign } from "../../scripts/data/load-scenarios.ts";

import { carryOffers } from "./carry-over.ts";
import { checklist } from "./checklist.ts";
import { buildStart } from "./start.ts";
import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
import { newSave } from "./save.ts";
import { campaignPath } from "./path.ts";

const mini = loadCampaign("the-dark-of-mirkwood");
const EARLIER = ["passage-through-mirkwood", "journey-along-the-anduin", "escape-from-dol-guldur"];

// The worlds the goldens were dealt in (the checklist reads their heroes).
const WORLDS = new Map<string, { cards: Map<string, PrintedCard>; ctx: ReduceContext }>();
let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
let scene: CavesWorld;
// The Oath's wins: two-handed with 6 tokens (Guilty Conscience earned, Adaptations in the pool), true solo with the Fervor of Lore already used.
let oathTwo: CampaignLog;
let oathSolo: CampaignLog;
let oathBlank: CampaignLog;

beforeAll(async () => {
  for (const decks of ["strong", "weak", "steady", "brittle", "tense"] as const) WORLDS.set(decks, await cavesWorld(decks));
  const strong = await cavesWorld("strong");
  scene = await loadCavesWorld();
  const twoGolden = OATH_GOLDENS.find((item) => item.name === "two-handed, steady heroes, 6 tokens placed, won with Guilty Conscience")!;
  const steady = await oathWorld("steady");
  const two = playOath(twoGolden, steady.ctx);
  oathTwo = applyResolution({ ...oathPlan(2, emptyLog(2), twoGolden.adaptations).log, completed: EARLIER }, two.state.scenarioId, two.state, steady.cards);
  oathBlank = applyResolution(oathPlan(2, emptyLog(2), twoGolden.adaptations).log, two.state.scenarioId, two.state, steady.cards);
  const soloGolden = OATH_GOLDENS.find((item) => item.name === "true solo, the Fervor of Lore already used, won")!;
  const strongOath = await oathWorld("strong");
  const solo = playOath(soloGolden, strongOath.ctx);
  oathSolo = applyResolution({ ...oathPlan(1, emptyLog(1), soloGolden.adaptations).log, completed: EARLIER }, solo.state.scenarioId, solo.state, strongOath.cards);
  cards = new Map([...steady.cards, ...strong.cards]);
  ctx = strong.ctx;
}, 240_000);

describe("The Caves of Nibin-Dûm in Mirkwood Paths and The Dark of Mirkwood", () => {
  it("is the fifth part of Mirkwood Paths and the second and last of The Dark of Mirkwood, which share its scenario file", () => {
    expect(campaign.scenarios.slice(3)).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(mini.scenarios).toEqual(["the-oath", "the-caves-of-nibin-dum"]);
    expect(caves.campaignCard).toBe("41051");
    expect([...caves.campaignPlaced].sort()).toEqual(["41042", "41048", "41049"]);
  });

  it("receives The Oath's pool through the Campaign Setup Checklist in Mirkwood Paths: each seat's Adaptation in its deck, Stalking Goblin and Guilty Conscience in the encounter deck", () => {
    expect(oathTwo.completed.at(-1)).toBe("the-oath");
    const plan = checklist({ log: oathTwo, scenario: caves, seats: cavesLoadout(2), effects: EFFECTS, cards });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    const adaptations = oathTwo.campaignPool.filter((card) => ["41044", "41045", "41046", "41047"].includes(card.code));
    expect(adaptations).toHaveLength(2);
    for (const card of adaptations) expect(plan.seats[card.seat ?? 0]?.deck, card.code).toContain(card.code);
    expect([...plan.poolEncounterCards].sort()).toEqual(["41041", "41043"]);
    // The campaign card's own Setup: a "No Time to Waste!" in each hand after the mulligan, Shiny Distraction shuffled into the encounter deck, and all of them in the pool.
    expect(plan.seats.map((seat) => seat.afterMulligan)).toEqual([["41048"], ["41048"]]);
    expect(plan.log.campaignPool.map((card) => `${card.code}:${card.seat ?? "any"}`).sort()).toEqual([...oathTwo.campaignPool.map((card) => `${card.code}:${card.seat ?? "any"}`), "41048:0", "41048:1", "41042:any"].sort());
    const dealt = buildStart({ campaign, scenario: caves, seatCount: 2, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay });
    // Shiny Distraction once (the campaign card's Setup), Stalking Goblin and Guilty Conscience once each (the pool).
    for (const code of ["41042", "41041", "41043"]) expect(dealt.encounterDeck.filter((entry) => entry === code), code).toHaveLength(1);
  });

  it("deals it on a log holding only The Oath in The Dark of Mirkwood the same way, and on a blank log with no pool", () => {
    const plan = checklist({ log: oathBlank, scenario: caves, seats: cavesLoadout(2), effects: EFFECTS, cards });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    expect(plan.poolEncounterCards).toEqual(expect.arrayContaining(["41041"]));
    expect(plan.seats.map((seat) => seat.afterMulligan)).toEqual([["41048"], ["41048"]]);
    const fresh = newSave("mini", "the-dark-of-mirkwood", 2);
    const bare = checklist({ log: fresh.log, scenario: caves, seats: cavesLoadout(2), effects: EFFECTS, cards });
    if (!bare.ok) throw new Error(bare.errors.join("; "));
    expect(bare.poolEncounterCards).toEqual([]);
    expect(bare.log.campaignPool.map((card) => card.code).sort()).toEqual(["41042", "41048", "41048"]);
  });

  it("starts from The Oath's facts: the once-per-campaign uses it recorded are in the game", () => {
    expect(oathSolo.usedOnce).toContain("41044");
    const plan = checklist({ log: oathSolo, scenario: caves, seats: cavesLoadout(1), effects: EFFECTS, cards });
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    const dealt = buildStart({ campaign, scenario: caves, seatCount: 1, seed: 1, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, poolIntoPlay: plan.poolIntoPlay, facts: { prisoner: oathSolo.prisoner, usedOnce: oathSolo.usedOnce, counters: oathSolo.counters } });
    // The cards of The Oath's pool are printed data the game needs.
    const full: ReduceContext = { effects: EFFECTS, cards };
    let state = startScenario(dealt, full);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, full)).state;
    expect(state.campaignFacts?.usedOnce).toEqual(oathSolo.usedOnce);
    expect(Object.values(state.cards).filter((card) => card.code === "41044").length).toBe(1);
  });
});

describe("what a win writes (41051:B:1)", () => {
  const won = CAVES_GOLDENS.filter((golden) => golden.outcome === "won");

  it("completes Mirkwood Paths and The Dark of Mirkwood: the path shows every part done", () => {
    const golden = won.find((item) => item.name === "two-handed, won")!;
    const game = playGolden(golden, ctx);
    const log = applyResolution({ ...oathTwo, campaignPool: [] }, game.state.scenarioId, game.state, cards);
    expect(log.completed).toEqual([...EARLIER, "the-oath", "the-caves-of-nibin-dum"]);
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed"]);
    const second = applyResolution({ ...oathBlank, campaignPool: [] }, game.state.scenarioId, game.state, cards);
    expect(campaignPath(mini, {}, second).map((node) => node.status)).toEqual(["completed", "completed"]);
  });

  it("keeps a Ranger Sense for each player for the next campaign when the highest final threat is under 40, and nothing at 40 or more", () => {
    const under = playGolden(won.find((item) => item.name === "two-handed, won")!, ctx);
    const log = applyResolution(emptyLog(2), under.state.scenarioId, under.state, cards);
    expect(log.carryOver.map((card) => `${card.code}:${card.perPlayer === true}`)).toEqual(["41049:true"]);
    // The Ranger Sense joins this campaign's pool now, one for each player, as well.
    expect(log.campaignPool.filter((card) => card.code === "41049").map((card) => card.seat).sort()).toEqual([0, 1]);
    const over = playGolden(won.find((item) => item.name === "two-handed, threat 40 or higher at the end, won")!, ctxFor("tense"));
    const bare = applyResolution(emptyLog(2), over.state.scenarioId, over.state, cards);
    expect(bare.carryOver).toEqual([]);
    expect(bare.campaignPool.map((card) => card.code)).not.toContain("41049");
  });

  it("reads the highest final threat of the players still in the game: 39 earns, 40 does not, an eliminated player counts as 50 (rr.scoring)", () => {
    const at = (threats: readonly [number, number], eliminated = false) => {
      const made = cavesTable(scene, { seats: 2, threat: threats });
      const state = eliminated ? withSeat(made.state, 1, { ...made.state.seats[1]!, eliminated: true }) : made.state;
      return holds(state, { kind: "highestThreat", max: 39 }, { actor: 0, sourceId: null, returned: 0 }, made.ctx);
    };
    expect(at([30, 39])).toBe(true);
    expect(at([30, 40])).toBe(false);
    expect(at([40, 30])).toBe(false);
    // An eliminated player's threat raises to 50 (rr.scoring).
    expect(at([20, 50], true)).toBe(false);
  });

  it("is taken in by a new save of any campaign once the campaign is finished: a Ranger Sense is shuffled into each player's deck", () => {
    const game = playGolden(won.find((item) => item.name === "two-handed, won")!, ctx);
    for (const [campaignId, scenarios] of [["mirkwood-paths", campaign.scenarios], ["the-dark-of-mirkwood", mini.scenarios]] as const) {
      const log = applyResolution(emptyLog(2), game.state.scenarioId, game.state, cards);
      const finished = { ...log, completed: [...scenarios] };
      const old = { id: "old", campaignId, seatCount: 2 as const, score: 0, log: finished };
      const offers = carryOffers([old as never], (id) => (id === campaignId ? scenarios : null));
      expect(offers, campaignId).toHaveLength(1);
      expect(offers[0]?.cards.map((card) => card.code), campaignId).toEqual(["41049"]);
      // Any other campaign takes it too: a Fellowship save, a Mirkwood Paths one, a The Dark of Mirkwood one.
      for (const next of ["mirkwood-paths", "the-dark-of-mirkwood", "fellowship-of-the-ring"]) {
        const fresh = newSave("next", next, 2, { carried: finished.carryOver, carriedFrom: "old" });
        expect(fresh.log.carryIn.map((card) => `${card.code}:${card.seat}`), `${campaignId} to ${next}`).toEqual(["41049:0", "41049:1"]);
      }
      const fresh = newSave("next", campaignId, 2, { carried: finished.carryOver, carriedFrom: "old" });
      const plan = checklist({ log: fresh.log, scenario: caves, seats: cavesLoadout(2), effects: EFFECTS, cards });
      if (!plan.ok) throw new Error(plan.errors.join("; "));
      for (const seat of [0, 1]) expect(plan.seats[seat]?.deck.filter((code) => code === "41049"), `${campaignId} seat ${seat}`).toHaveLength(1);
      // A save that took the offer does not offer it again.
      expect(carryOffers([old as never, { ...old, id: "next", log: fresh.log } as never], (id) => (id === campaignId ? scenarios : null))).toEqual([]);
    }
  });
});

describe("what a loss leaves", () => {
  it("writes nothing to the log: no carry-over, no completed scenario, no removal from the pool", () => {
    for (const golden of CAVES_GOLDENS.filter((item) => item.outcome === "lost")) {
      const lost = playGolden(golden, ctxFor(golden.decks));
      const blank = emptyLog(golden.seatCount);
      expect(applyResolution(blank, lost.state.scenarioId, lost.state, cards), golden.name).toBe(blank);
      expect(applyResolution(oathTwo, lost.state.scenarioId, lost.state, cards), golden.name).toBe(oathTwo);
    }
  });

  it("keeps a played \"No Time to Waste!\" in the pool when the scenario is lost", () => {
    const lost = CAVES_GOLDENS.find((item) => item.name === "true solo, weak, lost on threat")!;
    const game = playGolden({ ...lost, boon: "play" }, ctxFor("weak"));
    const log = emptyLog(1);
    expect(applyResolution(log, game.state.scenarioId, game.state, cards)).toBe(log);
  });
});

function ctxFor(decks: string): ReduceContext {
  const world = WORLDS.get(decks);
  if (!world) throw new Error(`no world for ${decks}`);
  return world.ctx;
}
