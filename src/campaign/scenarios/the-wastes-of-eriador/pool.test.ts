// Rules: mec108.campaign-log, mec108.campaign-mode, mec108.objective-allies, rr.campaign-pool, rr.campaign-mode, rr.campaign-setup-checklist, rr.doomed-x, rr.keywords, rr.removed-from-game, rr.attachment-cards, rr.first-player, faq.triggering-forced-effects (data/rules/entries.json).
// The pool cards that meet The Wastes of Eriador (Determination, Fend Off Despair, Amarthiúl's Courage, the burdens and Arnor Ravaged) and the log they write, on the scenario's own table and dealt from the log Deadmen's Dike leaves. Each test starts its title with the line it covers;
// lines.test.ts holds Day and Night, cards.test.ts and encounter.test.ts the cards of the scenario.
import { beforeAll, describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type PlayerIntent, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { afterDike, eriadorPlan, eriadorStart, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { afterHills, dikePlan, dikeWorld } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { fillerRecord, finish, idOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";
import { seatPenalty, signed, threatWords } from "../../two-towers-view.ts";

const ID = "the-wastes-of-eriador";
const DETERMINATION = "10172";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "10013", phase: "Planning", staging: ["10011"], campaign: true, ...layout });
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
let ctx: ReduceContext;
let cards: Awaited<ReturnType<typeof dikeWorld>>["cards"];
beforeAll(async () => {
  const world = await eriadorWorld("strong");
  ctx = world.ctx;
  cards = (await dikeWorld("strong")).cards;
}, 240_000);

// The scenario dealt from a log and its Setup played, every question answered with its first option.
function opened(log: CampaignLog, seed: number): ScenarioState {
  let state = startScenario(eriadorStart(1, seed, "Normal", undefined, log), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("10172:A:1 is Determination", () => {
  // The play of the Determination in hand, its 1 resource paid by the hero.
  const cast = (state: ScenarioState, hero: string): PlayerIntent => ({ type: "PlayCard", cardId: idOf(state, DETERMINATION), payments: [{ heroId: hero, amount: 1 }] });
  const played = (layout: Layout = {}, pick?: (state: ScenarioState) => string) => {
    const t = at({ hand: [DETERMINATION], heroResources: 2, ...layout });
    const run = finish(send({ state: t.state, steps: [] }, cast(t.state, t.hero), t.ctx), t.ctx, pick);
    return { t, run };
  };

  it("10172:A:1 attaches to a unique character in play, any player's (Amarthiúl too), and stays attached as a Condition", () => {
    const { run } = played({ play: ["10016"] });
    const determination = copies(run.state, DETERMINATION)[0];
    expect(determination?.zone).toBe("attached");
    expect(determination?.host).not.toBeNull();
  });

  it("10172:A:1 attaches to a character that already carries a copy: there is no limit to the number of attachments (rr.attachment-cards)", () => {
    const t = at({ hand: [DETERMINATION], heroResources: 2, play: ["10016"], attached: [{ code: DETERMINATION, to: "10016" }] });
    const inHand = copies(t.state, DETERMINATION).find((card) => card.zone === "hand")?.id ?? "";
    const run = finish(send({ state: t.state, steps: [] }, { type: "PlayCard", cardId: inHand, payments: [{ heroId: t.hero, amount: 1 }] }, t.ctx), t.ctx);
    const amarthiul = idOf(t.state, "10016");
    expect(run.state.cards[inHand]).toMatchObject({ zone: "attached", host: amarthiul });
    expect(copies(run.state, DETERMINATION).map((card) => card.host)).toEqual([amarthiul, amarthiul]);
  });

  it("10172:A:1 readies the host and every character with a Determination attached, and every character the Campaign Log marks determined", () => {
    const t = at({ hand: [DETERMINATION], heroResources: 2, play: ["10016"] });
    const tired = [t.hero, t.hero2, idOf(t.state, "10016")].reduce((state, id) => updateCard(state, id, { exhausted: true }), t.state);
    const intent = cast(tired, t.hero);
    const run = finish(send({ state: tired, steps: [] }, intent, t.ctx), t.ctx);
    const amarthiul = idOf(t.state, "10016");
    expect(copies(run.state, DETERMINATION).map((card) => card.host)).toEqual([amarthiul]);
    expect(run.state.cards[amarthiul]?.exhausted).toBe(false);
    // The heroes carry no Determination and are not determined: they stay exhausted.
    expect([t.hero, t.hero2].every((id) => run.state.cards[id]?.exhausted === true)).toBe(true);
    // A character the log marks determined is readied as well.
    const marked = { ...tired, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, angmar: { protectDamage: null, heroDamage: {}, determined: ["dh2"], stolen: [] } } } as ScenarioState;
    const again = finish(send({ state: marked, steps: [] }, intent as PlayerIntent, t.ctx), t.ctx);
    expect(again.state.cards[t.hero2]?.exhausted).toBe(false);
  });

  it("10171:B:1 marks the characters that still carry a Determination determined in the Campaign Log when the scenario is won, and nothing when it is lost", () => {
    const t = at({ phase: "Quest", attached: [{ code: DETERMINATION, to: "dh1" }, { code: DETERMINATION, to: "dh2" }] });
    const resolution = recordInstructions(EFFECTS, "10171", "resolution");
    const won = settle({ ...t.state, window: null, stageCleared: true, resolution }, t.ctx, []);
    const log = applyResolution(emptyLog(1), ID, won, t.cards, NO_COPY_LIMITS);
    expect(log.determined).toEqual(["dh1", "dh2"]);
    // Cumulative: an earlier mark stays, and the same character is marked once.
    expect(applyResolution({ ...emptyLog(1), determined: ["dh1", "x"] }, ID, won, t.cards, NO_COPY_LIMITS).determined).toEqual(["dh1", "x", "dh2"]);
    // A Determination whose host left play marks nobody.
    const bare = at({ phase: "Quest" });
    const alone = settle({ ...bare.state, window: null, stageCleared: true, resolution }, bare.ctx, []);
    expect(applyResolution(emptyLog(1), ID, alone, bare.cards, NO_COPY_LIMITS).determined).toEqual([]);
  });
});

describe("10172:A:1 marks its host at a later win too", () => {
  it("10188:B:1 marks the characters that carry a Determination determined in the Campaign Log, as the Wastes' Resolution does, and nothing when it is lost", () => {
    const t = at({ phase: "Quest", attached: [{ code: DETERMINATION, to: "dh1" }] });
    const resolution = recordInstructions(EFFECTS, "10188", "resolution");
    expect(resolution.some((step) => step.verb === "RecordDetermined")).toBe(true);
    const won = settle({ ...t.state, window: null, stageCleared: true, resolution }, t.ctx, []);
    expect(applyResolution({ ...emptyLog(1), determined: ["x"] }, ID, won, t.cards, NO_COPY_LIMITS).determined).toEqual(["x", "dh1"]);
    // A lost game writes nothing: the log is read from a won game only.
    expect(applyResolution(emptyLog(1), ID, { ...won, lost: true }, t.cards, NO_COPY_LIMITS).determined).toEqual([]);
  });
});

describe("10173:A:1 and 10173:A:2 are Fend Off Despair", () => {
  // The threat each player gains from playing the event, the card in hand with `doomed` printed on it (an event with a free Action of its own).
  const play = (layout: Layout, code: string, doomed = 0) => {
    const t = at({ hand: [code], heroResources: 4, deckOf: ["filler"], ...layout });
    t.cards.set(code, definePrinted({ code, name: code, type: "event", sphere: "neutral", cost: 0, ...(doomed > 0 ? { keywords: { doomed } } : {}) }));
    const ctx2 = code === "filler" || code === DETERMINATION ? t.ctx : { ...t.ctx, effects: [...t.ctx.effects, fillerRecord(code)] };
    const before = t.state.seats[0]?.threat ?? 0;
    const run = finish(send({ state: t.state, steps: [] }, { type: "PlayCard", cardId: idOf(t.state, code), payments: [] }, ctx2), ctx2);
    return (run.state.seats[0]?.threat ?? 0) - before;
  };

  it("10173:A:1 makes each event card gain Doomed 1: an event with none raises each player's threat by 1, a Doomed 2 event by 3, while it is in play", () => {
    const staged = { staging: ["10011", "10173"] };
    expect(play({}, "filler")).toBe(0);
    expect(play(staged, "filler")).toBe(1);
    expect(play({}, "d2", 2)).toBe(2);
    expect(play(staged, "d2", 2)).toBe(3);
  });

  it("10173:A:2 marks that each player's starting threat is reduced by 2 when it is defeated, cumulative, and writes it to the Campaign Log when the scenario is won", () => {
    const t = at({ phase: "Quest", staging: ["10011", "10173"] });
    const run = resolveRecords(t.state, t.ctx, "10173", "forced", idOf(t.state, "10173"));
    expect(run.state.resolutionLog.startingThreat).toBe(-2);
    const again = resolveRecords(run.state, t.ctx, "10173", "forced", idOf(run.state, "10173"));
    expect(again.state.resolutionLog.startingThreat).toBe(-4);
    const won = { ...run.state, stageCleared: true, resolution: [] };
    const log = applyResolution({ ...emptyLog(1), threatPenalty: 1 }, ID, won, t.cards, NO_COPY_LIMITS);
    expect(log.threatPenalty).toBe(-1);
    // A lost game carries no log: a state that did not clear its stage writes nothing.
    expect(applyResolution(emptyLog(1), ID, { ...run.state, stageCleared: false }, t.cards, NO_COPY_LIMITS).threatPenalty).toBe(0);
  });

  it("10173:A:2 gives a starting threat of the heroes' cost less 2 in the next scenario, and no seat starts below 0", () => {
    const log: CampaignLog = { ...afterDike(1), threatPenalty: -2 };
    const plan = eriadorPlan(1, log);
    expect(plan.threatModifier).toBe(-2);
    const state = startScenario(eriadorStart(1, 2, "Normal", undefined, log), ctx);
    const base = startScenario(eriadorStart(1, 2, "Normal", undefined, afterDike(1)), ctx);
    expect(state.seats[0]?.threat).toBe(Math.max(0, (base.seats[0]?.threat ?? 0) - 2));
    const deep = startScenario(eriadorStart(1, 2, "Normal", undefined, { ...afterDike(1), threatPenalty: -99 }), ctx);
    expect(deep.seats[0]?.threat).toBe(0);
  });

  it("10173:A:2 reads in the log and the checklist as -2, not +-2", () => {
    expect(threatWords({ threatPenalty: -2, threatPenaltyBySeat: [] }, 1)).toBe("-2");
    expect(threatWords({ threatPenalty: 0, threatPenaltyBySeat: [] }, 1)).toBe("None");
    expect(threatWords({ threatPenalty: 1, threatPenaltyBySeat: [] }, 2)).toBe("+1");
    expect(threatWords({ threatPenalty: -2, threatPenaltyBySeat: [0, 1] }, 2)).toBe("Player 1: -2 · Player 2: -1");
    expect(signed(3)).toBe("+3");
    expect(seatPenalty({ threatPenalty: -2, threatPenaltyBySeat: [1] }, 0)).toBe(-1);
    const step4 = eriadorPlan(1, { ...afterDike(1), threatPenalty: -2 }).steps.find((step) => step.n === 4);
    expect(step4?.did[0]).toBe("Each player's starting threat is the combined threat cost of their heroes -2, and at least 0.");
  });
});

describe("The pool Deadmen's Dike leaves meets this scenario", () => {
  it("10167:A:1 attaches Amarthiúl's Courage to Amarthiúl, whom the quest card's Setup puts into play after it, and 10168:A:1 removes Thaurdir's Legacy from this game only", () => {
    const log = afterDike(1);
    const started = opened(log, 2);
    expect(copies(started, "10016").map((card) => card.zone)).toEqual(["play"]);
    const courage = copies(started, "10167");
    expect(courage.map((card) => started.cards[card.host ?? ""]?.code)).toEqual(["10016"]);
    expect(copies(started, "10168").map((card) => card.zone)).toEqual(["removed"]);
    // The burden stays in the Campaign Pool for Rhudaur and Carn Dûm: removing it from the game takes nothing from the log.
    expect(log.campaignPool.map((card) => card.code)).toContain("10168");
    expect(started.pendingAttach ?? []).toEqual([]);
  });

  it("100158:A:1 stages Arnor Ravaged once with the damage the log noted, the pool's copy being the card its own Setup puts into play", () => {
    const before = dikePlan(1, afterHills(1)).log;
    const dike = applyResolution(before, "deadmens-dike", goldenState("deadmens-dike", "true solo, won, Normal"), cards, NO_COPY_LIMITS);
    expect(dike.campaignPool.map((card) => card.code)).toContain("100158");
    const log: CampaignLog = { ...dike, protectDamage: 3 };
    const started = opened(log, 2);
    expect(copies(started, "100158").map((card) => [card.zone, card.damage])).toEqual([["staging", 3]]);
    expect(copies(started, "10158")).toHaveLength(0);
  });
});
