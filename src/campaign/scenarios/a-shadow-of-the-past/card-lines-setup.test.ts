// Rules: mec109.setup, mec109.setting-up-the-game, mec109.the-one-ring, mec109.multiplayer-the-one-ring, mec109.campaign-mode, rr.campaign-setup-checklist, rr.campaign-pool, rr.explored, rr.first-player (data/rules/entries.json);
// ledger lines 141017:A:2, 141085:A:1, 141085:A:2, 141078:A:2, 141030:A:2, 141030:B:1, 141035:A:4.
// A Shadow of the Past's Setup lines, the campaign card's Setup and Resolution, The One Ring's control and hero limit, and the win on Bucklebury Ferry. A Setup record is resolved on a table built by layout; the starting hand
// and the campaign card are read from the start the campaign builds (test/scenarios/a-shadow-of-the-past/game.ts), as a game is dealt.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { Effect } from "../../../catalog/boundary.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { heroLimitExempt } from "../../../rules/interpret/restrictions.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { buildStart } from "../../start.ts";
import { applyResolution, emptyLog } from "../../log.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { quest } from "../../../../test/harness/card-spec.ts";
import { idOf, idsOf, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { campaign, scenario } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { RING_BEARER, starterLoadout, starterStart, starterWorld } from "../../../../test/scenarios/a-shadow-of-the-past/game.ts";

const SCENARIO = "a-shadow-of-the-past";
const RING = "141085";
const UNDERHILL = "141017";
const table = (layout: Layout): LayoutTable => tableFromLayout(SCENARIO, layout, { extra: [RING, RING_BEARER, UNDERHILL] });
const without = (...ids: string[]): readonly Effect[] => EFFECTS.filter((effect) => !ids.includes(effect.id));

// The codes of the cards attached to a card.
const codesOn = (state: ScenarioState, id: string) => (state.cards[id]?.attachments ?? []).map((attached) => state.cards[attached]?.code);

// A table whose first seat has Frodo, the Ring-bearer, as its second hero after the stand-in dh1, so a Setup that searches for the Ring-bearer has to pass dh1 by.
function withFrodo(layout: Layout = {}): LayoutTable & { frodo: string } {
  const made = table(layout);
  const frodo = spawn(made.state, RING_BEARER, { zone: "heroes", seat: 0 });
  return { ...made, state: frodo.state, frodo: frodo.id };
}

describe("Setups that attach to the Ring-bearer", () => {
  // 141017 Mr. Underhill: "Setup: Attach to the Ring-bearer."
  it("141017:A:2 Mr. Underhill attaches to the Ring-bearer, not to the first hero", () => {
    const made = withFrodo();
    const run = resolveRecords(made.state, made.ctx, UNDERHILL, "setup");
    expect(codesOn(run.state, made.frodo)).toContain(UNDERHILL);
    expect(codesOn(run.state, made.hero)).toEqual([]);
  });

  // 141085 The One Ring: "Setup: The first player claims The One Ring and attaches it to the Ring-bearer."
  it("141085:A:1 The One Ring attaches to the Ring-bearer under the first player's control", () => {
    const made = withFrodo();
    const run = resolveRecords(made.state, made.ctx, RING, "setup");
    const ring = (run.state.cards[made.frodo]?.attachments ?? []).find((id) => run.state.cards[id]?.code === RING) ?? "";
    expect(run.state.cards[ring]).toMatchObject({ code: RING, host: made.frodo, controller: 0 });
  });
});

// Every window of the round is passed until the next round begins (the card-spec `endRound` action, on a table that holds The One Ring, which the card-spec rows' tables do not load).
function toNextRound(made: LayoutTable): ScenarioState {
  let run = start(made.state);
  for (let guard = 0; guard < 60 && run.state.round === made.state.round; guard += 1) {
    const next = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
    if (!next) throw new Error(`nothing to pass (window ${run.state.window?.kind ?? "none"})`);
    run = send(run, next, made.ctx);
  }
  return run.state;
}

describe("141085 The One Ring", () => {
  // "Attached hero does not count against the hero limit."
  it("141085:A:2 the hero it is attached to does not count against the hero limit, another hero does", () => {
    const made = table({ attached: [{ code: RING, to: "dh1" }] });
    expect(heroLimitExempt(made.state, made.ctx, made.hero)).toBe(true);
    expect(heroLimitExempt(made.state, made.ctx, made.hero2)).toBe(false);
  });

  // "The first player gains control of attached hero." mec109.multiplayer-the-one-ring: "the first player gains control of the attached Ring-bearer, all resources in that hero's resource pool, and all cards attached to that hero."
  it("141085:A:2 when the first player token passes, the new first player gains control of the attached hero, its resources and its attachments", () => {
    const made = table({ seats: 2, phase: "Combat", heroResources: 2, attached: [{ code: RING, to: "dh1" }, { code: UNDERHILL, to: "dh1" }], deck: ["f0", "f0"] });
    const state = toNextRound(made);
    const hero = made.hero;
    expect(state.firstPlayer).toBe(1);
    expect(state.seats[1]?.heroes).toContain(hero);
    expect(state.seats[0]?.heroes).not.toContain(hero);
    expect(state.cards[hero]).toMatchObject({ controller: 1 });
    expect(state.cards[hero]?.resources).toBeGreaterThanOrEqual(2);
    expect(state.cards[idOf(state, RING)]?.controller).toBe(1);
    expect(state.cards[idOf(state, UNDERHILL)]?.controller).toBe(1);
    // The hero without The One Ring stays where it was.
    expect(state.seats[0]?.heroes).toContain(made.hero2);
  });
});

describe("141078 Gandalf's Delay", () => {
  let ctx: ReduceContext;
  beforeAll(async () => {
    const one = await starterWorld("stealth-and-steadfastness");
    const two = await starterWorld("wisdom-and-wizardry");
    ctx = { effects: EFFECTS, cards: new Map([...one.cards, ...two.cards]) };
  }, 60_000);

  // "Each player draws 1 less card in his starting hand." The campaign card adds it to the staging area (141030:A:2), so a campaign game starts with 5 cards in hand, not the usual 6.
  it("141078:A:2 the starting hand of the player is 5 cards, one less than without it", () => {
    const started = startScenario(starterStart("stealth-and-steadfastness", 1), ctx);
    expect(started.seats[0]?.hand).toHaveLength(5);
    const plain = startScenario(starterStart("stealth-and-steadfastness", 1), { ...ctx, effects: without("141078:setup:2") });
    expect(plain.seats[0]?.hand).toHaveLength(6);
  });

  it("141078:A:2 each player draws 1 card less, the second player too", () => {
    const second = { ...starterLoadout("wisdom-and-wizardry"), heroes: ["01007", "01002"] };
    const start = buildStart({ campaign, scenario, seatCount: 2, seed: 1, threatModifier: 0, seats: [starterLoadout("stealth-and-steadfastness"), second], effects: EFFECTS });
    const started = startScenario(start, ctx);
    expect(started.seats.map((seat) => seat.hand.length)).toEqual([5, 5]);
  });
});

describe("141030 A Shadow of the Past, the campaign card", () => {
  let ctx: ReduceContext;
  beforeAll(async () => {
    ({ ctx } = await starterWorld("stealth-and-steadfastness"));
  }, 60_000);

  const codesIn = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
  // The game as the opening hand is kept: the Setup has been played.
  function begun(effects: readonly Effect[], mode: "campaign" | "standalone" = "campaign"): ScenarioState {
    const at = { ...ctx, effects };
    const kept = reduce(startScenario(buildStart({ campaign, scenario, seatCount: 1, seed: 1, threatModifier: 0, seats: [starterLoadout("stealth-and-steadfastness")], effects, mode }), at), { type: "Keep" }, at);
    if (!kept.ok) throw new Error(kept.reason);
    return kept.state;
  }

  // "Setup: Attach Mr. Underhill to the Ring-bearer. Add Gandalf's Delay to the staging area. Shuffle Gildor Inglorion and The Ring Draws Them into the encounter deck."
  it("141030:A:2 attaches Mr. Underhill to the Ring-bearer, stages Gandalf's Delay and shuffles Gildor Inglorion and The Ring Draws Them into the encounter deck", () => {
    const state = begun(EFFECTS);
    const underhill = idsOf(state, UNDERHILL)[0] ?? "";
    expect(state.cards[state.cards[underhill]?.host ?? ""]?.code).toBe(RING_BEARER);
    expect(codesIn(state, state.staging)).toContain("141078");
    expect(codesIn(state, state.encounterDeck)).toEqual(expect.arrayContaining(["141077", "141079"]));
  });

  it("141030:A:2 deals none of them without the campaign card's Setup, or in a standalone game", () => {
    for (const state of [begun(without("141030:campaignSetup:1")), begun(EFFECTS, "standalone")]) {
      expect(idsOf(state, UNDERHILL)).toEqual([]);
      expect(codesIn(state, [...state.staging, ...state.encounterDeck])).not.toContain("141078");
      expect(codesIn(state, state.encounterDeck)).not.toContain("141077");
      expect(codesIn(state, state.encounterDeck)).not.toContain("141079");
    }
  });

  // "Resolution: Choose Gandalf's Delay or The Ring Draws Them and add it to the Campaign Pool. Then, choose Gildor Inglorion or Mr. Underhill and add it to the Campaign Pool."
  it("141030:B:1 the first player chooses one card of each pair, in the card's order, and both go into the Campaign Pool", () => {
    const done = playedLayout(SCENARIO, { stage: "141024", campaign: true, active: { code: "141035", progress: 8 }, deck: ["f0", "f0", "f0"] }, quest("success"));
    const ctxOf = done.table.ctx;
    const options = (state: ScenarioState) => reduceOptions(state, ctxOf);
    let state = done.run.state;
    expect(state.window).toMatchObject({ kind: "resolution", step: 0 });
    expect(options(state)).toEqual(["141078", "141079"]);
    expect(reduce(state, { type: "ChooseResolution", optionId: "141077" }, ctxOf).ok).toBe(false);
    state = accept(state, "141079", ctxOf);
    expect(options(state)).toEqual(["141077", "141017"]);
    state = accept(state, "141077", ctxOf);
    const log = applyResolution(emptyLog(1), state.scenarioId, state, ctxOf.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.map((card) => card.code)).toEqual(["141079", "141077"]);
  });
});

// The Resolution options the reducer offers now.
function reduceOptions(state: ScenarioState, ctx: ReduceContext): string[] {
  return ["141078", "141079", "141077", "141017"].filter((optionId) => reduce(state, { type: "ChooseResolution", optionId } as PlayerIntent, ctx).ok);
}

function accept(state: ScenarioState, optionId: string, ctx: ReduceContext): ScenarioState {
  const result = reduce(state, { type: "ChooseResolution", optionId }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

describe("141035 Bucklebury Ferry", () => {
  // "After Bucklebury Ferry leaves play as an explored location, the players win the game." It has 9 quest points; dh1 and dh2 quest for 4 against no Threat.
  it("141035:A:4 the players win when the quest explores it", () => {
    const done = playedLayout(SCENARIO, { stage: "141024", active: { code: "141035", progress: 8 }, deck: ["f0", "f0", "f0"] }, quest("success"));
    expect(done.run.state.cards[idOf(done.run.state, "141035")]?.zone).toBe("encounterDiscard");
    expect(done.run.state.stageCleared).toBe(true);
    expect(done.run.state.lost).toBe(false);
  });

  it("141035:A:4 a quest that leaves it short of its quest points wins nothing", () => {
    const done = playedLayout(SCENARIO, { stage: "141024", active: "141035", deck: ["f0", "f0", "f0"] }, quest("success"));
    expect(done.run.state.cards[idOf(done.run.state, "141035")]?.zone).toBe("activeLocation");
    expect(done.run.state.stageCleared).toBe(false);
  });
});
