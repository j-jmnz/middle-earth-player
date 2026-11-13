// Rules: mec108.campaign-setup-escape-from-mount-gram, mec108.setup-escape-from-mount-gram, mec108.captured-deck, mec108.campaign-log, mec108.campaign-log-tracking, rr.campaign-pool, rr.campaign-setup-checklist, rr.campaign-mode, rr.player-deck (data/rules/entries.json);
// ledger lines 10174:A:2, 10174:B:3, 10175:A:2, 10172:A:1.
import { beforeAll, describe, expect, it } from "vitest";

import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { capturedDeck, capturedUnder } from "../../../rules/families/captured/pile.ts";
import { dikePlan, dikeWorld, afterHills } from "../../../../test/scenarios/deadmens-dike/game.ts";
import { eriadorPlan, eriadorWorld } from "../../../../test/scenarios/the-wastes-of-eriador/game.ts";
import { GRAM_GOLDENS, gramLoadout, gramPlan, gramStart, gramWorld } from "../../../../test/scenarios/escape-from-mount-gram/game.ts";
import { expectLossWritesNothing } from "../../../../test/harness/campaign-kit.ts";
import { goldenState } from "../../../../test/harness/golden-state.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { angmarAwakenedRows } from "../../log-angmar-awakened.ts";
import { applyResolution, type CampaignLog } from "../../log.ts";
import { validateLoadout } from "../../loadout.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const campaign = loadCampaign("angmar-awakened");
const gram = loadScenario("escape-from-mount-gram");
const LOOT = "10175";
const DETERMINATION = "10172";
let ctx: ReduceContext;
let world: Awaited<ReturnType<typeof gramWorld>>;
let eriador: Awaited<ReturnType<typeof eriadorWorld>>;

beforeAll(async () => {
  world = await gramWorld("strong");
  eriador = await eriadorWorld("strong");
  await dikeWorld("strong");
  ctx = world.ctx;
}, 240_000);

// The scenario dealt from a campaign log, the mulligans kept and every question answered with its first option (the starting hero of each player).
function opened(seats: 1 | 2, log: CampaignLog, standalone = false): ScenarioState {
  let state = startScenario(gramStart(seats, 1, "Normal", undefined, log, undefined, undefined, { standalone }), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose" && state.phase !== "Planning"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const copies = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const WON = (seats: 1 | 2) => (seats === 1 ? "true solo, won, Normal" : "two-handed, won, Normal");
// The log The Wastes of Eriador's won golden writes onto the parts before it (goldenState, not a game played again): what Escape from Mount Gram is dealt from.
const dikeLog = (seats: 1 | 2): CampaignLog => applyResolution(dikePlan(seats, afterHills(seats)).log, "deadmens-dike", goldenState("deadmens-dike", WON(seats)), world.cards, NO_COPY_LIMITS);
const wastesLog = (seats: 1 | 2): CampaignLog => applyResolution(eriadorPlan(seats, dikeLog(seats)).log, "the-wastes-of-eriador", goldenState("the-wastes-of-eriador", WON(seats)), eriador.cards, NO_COPY_LIMITS);

// Escape from Mount Gram in the angmar-awakened campaign (part 5, campaign card 10174). The earlier parts' logs come from their golden states (goldenState), never from playing their goldens again; this scenario's own won state the same way.
describe("Escape from Mount Gram in the angmar-awakened campaign", () => {
  it("is part 5 of the campaign and names its campaign card", () => {
    expect(campaign.scenarios.indexOf(gram.id)).toBe(4);
    expect(gram.campaignCard).toBe("10174");
  });

  it("is playable, the road offers it after The Wastes of Eriador's win, and the part after it (Across the Ettenmoors) waits behind it as coming soon", () => {
    expect(PLAYABLE_SCENARIOS).toContain("escape-from-mount-gram");
    expect(PLAYABLE_SCENARIOS).not.toContain(campaign.scenarios[5]);
    const path = campaignPath(campaign, {}, wastesLog(1));
    expect(path.map((node) => [node.id, node.status]).slice(3, 6)).toEqual([["the-wastes-of-eriador", "completed"], ["escape-from-mount-gram", "current"], ["across-the-ettenmoors", "soon"]]);
  });

  it("10174:A:2 deals the Campaign Setup: Loot the Dungeons in the staging area holding the bottom 5 cards of each captured deck, the pool's Determination dealt as the Wastes left it", () => {
    for (const seats of [1, 2] as const) {
      const log = wastesLog(seats);
      const plan = gramPlan(seats, log);
      expect(plan.log.campaignPool.some((card) => card.code === DETERMINATION), `${seats} seats`).toBe(true);
      const started = opened(seats, log);
      const loot = copies(started, LOOT);
      expect(loot.map((card) => card.zone), `${seats} seats`).toEqual(["staging"]);
      expect(capturedUnder(started, loot[0]?.id ?? ""), `${seats} seats`).toHaveLength(5 * seats);
      // Each captured deck is made of the player's allies and Items and the two heroes that are not the starting hero; a Determination (an event) is never captured.
      for (const seat of [0, 1].slice(0, seats)) expect(capturedDeck(started, seat).every((id) => started.cards[id]?.code !== DETERMINATION), `${seats} seats`).toBe(true);
      expect(copies(started, DETERMINATION).every((card) => card.zone !== "captured"), `${seats} seats`).toBe(true);
    }
  });

  it("hands the previous parts to this one: The Wastes of Eriador's pool reaches the game, Mysterious Omens and Fend Off Despair shuffled into the encounter deck, no campaign card in a standalone game", () => {
    const log = wastesLog(1);
    const pooled = log.campaignPool.map((card) => card.code);
    expect(pooled).toEqual(expect.arrayContaining(["10160", "10173"]));
    const started = opened(1, log);
    expect(copies(started, "10160")).toHaveLength(1);
    expect(copies(started, "10173")).toHaveLength(1);
    // The original card deals no campaign card, so no Loot the Dungeons and no captured card under it.
    const alone = opened(1, gramPlan(1).log, true);
    expect(copies(alone, "10174").filter((card) => card.zone !== "setAside")).toHaveLength(0);
    expect(copies(alone, LOOT).filter((card) => card.zone !== "setAside")).toHaveLength(0);
    expect(alone.cards[alone.questStage ?? ""] ? true : alone.seats[0].stage != null).toBe(true);
  });

  // The Resolution (10174:B:3, and 10172:A:1's mark) on the won goldens' final states (goldenState, not a game played again), over the log The Wastes of Eriador left.
  it("10174:B:3 writes the unique cards still in each captured deck as stolen, by seat and once each, and shows them in the log's row", () => {
    for (const seats of [1, 2] as const) {
      const state = goldenState("escape-from-mount-gram", WON(seats));
      expect(state.stageCleared).toBe(true);
      const log = applyResolution(wastesLog(seats), "escape-from-mount-gram", state, world.cards, NO_COPY_LIMITS);
      expect(log.completed).toContain("escape-from-mount-gram");
      for (const seat of Array.from({ length: seats }, (_, index) => index)) {
        const unique = capturedDeck(state, seat).map((id) => state.cards[id]?.code).filter((code) => code != null && world.cards.get(code)?.isUnique === true);
        expect(log.stolenCards[seat] ?? [], `${seats} seats, seat ${seat}`).toEqual([...new Set(unique)]);
      }
      expect(angmarAwakenedRows(log, seats).some((row) => row.id === "log-stolen") === log.stolenCards.some((cards) => cards.length > 0)).toBe(true);
      const path = campaignPath(campaign, {}, log);
      expect(path.map((node) => [node.id, node.status]).slice(4, 6)).toEqual([["escape-from-mount-gram", "completed"], ["across-the-ettenmoors", "soon"]]);
    }
  });

  it("10174:B:3 the loadout of the next part refuses a stolen card in that player's deck, and still lets a stolen hero start", () => {
    const state = goldenState("escape-from-mount-gram", WON(1));
    const log = applyResolution(wastesLog(1), "escape-from-mount-gram", state, world.cards, NO_COPY_LIMITS);
    const stolen = log.stolenCards;
    const [seat] = gramLoadout(1);
    const refused = (deck: readonly string[], heroes: readonly string[] = seat!.heroes) => validateLoadout([{ ...seat!, heroes, deck }], world.cards, false, [], [], {}, stolen).filter((error) => error.rule === "stolenCard");
    const first = stolen[0]?.[0] ?? "";
    expect(first, "the golden leaves a unique card in the player's captured deck").not.toBe("");
    // The deck of the goldens holds copies of every boon: without the stolen ones nothing is refused, and one stolen card put back is refused once.
    const clean = seat!.deck.filter((code) => !(stolen[0] ?? []).includes(code));
    expect(refused(clean)).toHaveLength(0);
    expect(refused([...clean, first])).toHaveLength(1);
    // A hero is no deck card: a stolen hero (a unique card too) may still start.
    expect(refused(clean, [first, ...seat!.heroes.slice(1)])).toHaveLength(0);
    // Another player's seat is not refused it: a stolen card is that player's loss.
    expect(validateLoadout([{ ...seat!, deck: clean }, { ...seat!, deck: [...clean, first] }], world.cards, false, [], [], {}, [stolen[0] ?? [], []]).filter((error) => error.rule === "stolenCard")).toHaveLength(0);
  });

  it("10175:A:2 the boon a player takes at Loot the Dungeons joins the Campaign Pool on a win, with that player's seat, once", () => {
    const state = goldenState("escape-from-mount-gram", WON(2));
    const earned = { ...state, resolutionLog: { ...state.resolutionLog, earned: [...state.resolutionLog.earned, { code: "10176", to: "pool" as const, seat: 1, hero: null, step: 0 }] } };
    const log = applyResolution(wastesLog(2), "escape-from-mount-gram", earned, world.cards, NO_COPY_LIMITS);
    expect(log.campaignPool.filter((card) => card.code === "10176")).toHaveLength(1);
    expect(log.campaignPool.find((card) => card.code === "10176")?.seat).toBe(1);
  });

  it("10174:B:3 writes Determination's mark with the stolen cards: a Resolution that names the determined characters carries them into the log", () => {
    const state = goldenState("escape-from-mount-gram", WON(1));
    const log = applyResolution(wastesLog(1), "escape-from-mount-gram", state, world.cards, NO_COPY_LIMITS);
    // RecordDetermined (10172) marks each character that carries a Determination: none in this golden, so the mark stays as it was.
    expect(log.determined).toEqual(wastesLog(1).determined);
  });

  it("a lost game writes nothing: the Resolution is for a win only, so finishing each lost golden leaves the log as it was", () => {
    for (const golden of GRAM_GOLDENS.filter((one) => one.outcome === "lost")) expectLossWritesNothing(gramPlan(golden.seatCount).log, "escape-from-mount-gram", golden.name, world.cards);
  });
});
