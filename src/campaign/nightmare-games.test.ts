// Rules: mec109.setup, rr.setup (data/rules/entries.json). One seeded game of each scenario on NIGHTMARE_PLAYABLE, on Nightmare: the
// recipe deals, the players keep, and the auto-player plays rounds with card play and Actions on. Every intent it sends is one the reducer
// listed, so a refusal, a throw or a stall in the Nightmare deck's records fails here (docs/brief.md, Nightmare).
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { pushCardEffects } from "../rules/interpret/effect-frames.ts";
import { settle } from "../rules/engine/machine.ts";
import { announceStageRevealed } from "../rules/families/nightmare/setup.ts";
import { reduce, startScenario } from "../rules/engine/reduce.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { playOut } from "../../test/harness/auto-player.ts";
import { temporaryCatalog } from "../../test/harness/temp-catalog.ts";
import prebuilt from "../../data/decks/prebuilt.json" with { type: "json" };

import { NIGHTMARE_PLAYABLE } from "./playable.ts";
import { contextOf } from "./session.ts";
import { buildStart } from "./start.ts";
import { loadWorld } from "./world.ts";

const FRODO = "141001";
const catalog = drizzle(new Database(temporaryCatalog(), { readonly: true }));

// The scenarios' campaigns and the seat each game is played with: the Fellowship's stealth starter with Frodo as Ring-bearer, and a
// Revised Core Set deck elsewhere.
const CAMPAIGN_OF: Readonly<Record<string, string>> = {
  "a-shadow-of-the-past": "fellowship-of-the-ring",
  "a-knife-in-the-dark": "fellowship-of-the-ring",
  "flight-to-the-ford": "fellowship-of-the-ring",
  "the-ring-goes-south": "fellowship-of-the-ring",
  "passage-through-mirkwood": "mirkwood-paths",
  "journey-along-the-anduin": "mirkwood-paths",
  "escape-from-dol-guldur": "mirkwood-paths",
};

function seatFor(campaignId: string): { heroes: string[]; deck: string[]; protect: string } {
  if (campaignId === "fellowship-of-the-ring") {
    const stealth = loadCampaign().starterDecks.find((entry) => entry.id === "stealth-and-steadfastness");
    const deck = stealth?.rows.filter((row) => row.type !== "hero").flatMap((row) => Array.from({ length: row.count }, () => row.code)) ?? [];
    return { heroes: [FRODO, "141002", "141003"], deck, protect: FRODO };
  }
  const core = prebuilt.find((entry) => entry.id === "core-spirit");
  const deck = core?.cards.flatMap((card) => Array.from({ length: card.count }, () => card.code)) ?? [];
  return { heroes: core?.heroes ?? [], deck, protect: "" };
}

describe("a seeded Nightmare game of each scenario on NIGHTMARE_PLAYABLE", () => {
  for (const id of NIGHTMARE_PLAYABLE) {
    it(`${id}: deals, keeps and plays rounds without a refusal, a throw or a stall`, () => {
      const campaignId = CAMPAIGN_OF[id] ?? "fellowship-of-the-ring";
      const campaign = loadCampaign(campaignId);
      const seat = seatFor(campaignId);
      const world = loadWorld(catalog, campaign, loadScenario(id), EFFECTS, [...seat.heroes, ...seat.deck]);
      const ctx = contextOf(world);
      for (const seed of [1, 2, 3]) {
        const start = buildStart({ campaign, scenario: world.scenario, seatCount: 1, seed, threatModifier: 0, seats: [{ heroes: seat.heroes, deck: seat.deck }], difficulty: "Nightmare", effects: world.effects, mode: "standalone" });
        let state = startScenario(start, ctx);
        expect(Object.values(state.cards).filter((card) => card.zone === "nightmare").map((card) => card.code)).toEqual([world.scenario.nightmare?.setupCard]);
        while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
        const played = playOut(state, ctx, { scout: seat.heroes[2] ?? "", prefer: "", protect: seat.protect, play: true, act: true }, 3000);
        expect(played.state.failure ?? null).toBeNull();
        // The game ended, or it went on for rounds: the turn budget was not spent on one window.
        expect(played.state.lost || played.state.stageCleared || played.rounds >= 3, `${id} seed ${seed} stalled in round ${played.rounds}`).toBe(true);
      }
    }, 120_000);
  }
});

// A record that names a card the recipe replaced reads the dealt card of the same title (twinCode, src/rules/families/nightmare/guards.ts): The
// Ringwraiths Attack adds Weathertop (141046) to the staging area, which on Nightmare is Nightmare Weathertop (906204), set aside by the piles.
describe("the quest's records on Nightmare", () => {
  it("add Nightmare Weathertop when The Ringwraiths Attack is revealed (141027:A:1)", () => {
    const campaign = loadCampaign();
    const seat = seatFor("fellowship-of-the-ring");
    const world = loadWorld(catalog, campaign, loadScenario("a-knife-in-the-dark"), EFFECTS, [...seat.heroes, ...seat.deck]);
    const ctx = contextOf(world);
    const start = buildStart({ campaign, scenario: world.scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: seat.heroes, deck: seat.deck }], difficulty: "Nightmare", effects: world.effects, mode: "standalone" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const codeAt = (id: string) => state.cards[id]?.code;
    expect(state.setAside.map(codeAt)).toContain("906204");
    const revealed = EFFECTS.filter((effect) => effect.id === "141027:whenRevealed:1");
    const stage = state.questStage ?? "";
    const after = settle(pushCardEffects({ ...state, window: null }, "whenRevealed", stage, 0, false, revealed, ctx, []), ctx, []);
    expect(after.staging.map((id) => after.cards[id]?.code)).toContain("906204");
    expect(after.setAside.map((id) => after.cards[id]?.code)).not.toContain("906204");
  });

  it("add Nightmare Ford of Bruinen when Race to Rivendell is revealed (141029:B:1)", () => {
    const campaign = loadCampaign();
    const seat = seatFor("fellowship-of-the-ring");
    const world = loadWorld(catalog, campaign, loadScenario("flight-to-the-ford"), EFFECTS, [...seat.heroes, ...seat.deck]);
    const ctx = contextOf(world);
    const start = buildStart({ campaign, scenario: world.scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: seat.heroes, deck: seat.deck }], difficulty: "Nightmare", effects: world.effects, mode: "standalone" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    expect(state.setAside.map((id) => state.cards[id]?.code)).toContain("906303");
    const revealed = EFFECTS.filter((effect) => effect.id === "141029:whenRevealed:1");
    const after = settle(pushCardEffects({ ...state, window: null }, "whenRevealed", state.questStage ?? "", 0, false, revealed, ctx, []), ctx, []);
    expect(after.staging.map((id) => after.cards[id]?.code)).toContain("906303");
  });

  it("set the Pale-green Tentacles aside at Setup, and engage one with each player when the players advance to The Gates of Moria (906401:A:2, 906401:A:3)", () => {
    const campaign = loadCampaign();
    const seat = seatFor("fellowship-of-the-ring");
    const world = loadWorld(catalog, campaign, loadScenario("the-ring-goes-south"), EFFECTS, [...seat.heroes, ...seat.deck]);
    const ctx = contextOf(world);
    const start = buildStart({ campaign, scenario: world.scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: seat.heroes, deck: seat.deck }], difficulty: "Nightmare", effects: world.effects, mode: "standalone" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const tentacles = (zone: string) => Object.values(state.cards).filter((card) => card.code === "906402" && card.zone === zone).length;
    expect(tentacles("setAside")).toBe(4);
    expect(tentacles("encounterDeck")).toBe(0);
    const gates = state.questDeck.find((id) => state.cards[id]?.code === "142023") ?? "";
    state = settle(announceStageRevealed({ ...state, window: null }, gates, ctx, []), ctx, []);
    // The engagement may offer Responses: they are passed.
    for (let guard = 0; guard < 10 && state.window?.kind === "response"; guard += 1) state = expectOk(reduce(state, { type: "Pass" }, ctx)).state;
    expect(tentacles("engaged")).toBe(1);
    expect(tentacles("encounterDeck")).toBe(3);
    expect(state.encounterDiscard).toEqual([]);
  });

  it("reveal one card for each player during Setup of Passage Through Mirkwood (900101:A:2)", () => {
    const campaign = loadCampaign("mirkwood-paths");
    const seat = seatFor("mirkwood-paths");
    const world = loadWorld(catalog, campaign, loadScenario("passage-through-mirkwood"), EFFECTS, [...seat.heroes, ...seat.deck]);
    const ctx = contextOf(world);
    const begin = (effects: typeof world.effects) => {
      const start = buildStart({ campaign, scenario: world.scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: seat.heroes, deck: seat.deck }], difficulty: "Nightmare", effects, mode: "standalone" });
      let state = startScenario(start, { ...ctx, effects });
      while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, { ...ctx, effects })).state;
      return state;
    };
    const withReveal = begin(ctx.effects);
    const without = begin(ctx.effects.filter((effect) => effect.id !== "900101:forced:1"));
    expect(withReveal.encounterDeck.length).toBeLessThan(without.encounterDeck.length);
  });
});
