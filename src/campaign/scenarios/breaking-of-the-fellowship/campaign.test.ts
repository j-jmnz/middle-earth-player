// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.burdens, rr.campaign-pool, mec109.campaign-mode, mec109.setup-breaking-of-the-fellowship, rr.winning-the-game
// (data/rules/entries.json). The campaign across scenarios 5 and 6: what Journey in the Dark earned reaches Breaking of the Fellowship through the checklist, the card's
// Setup takes a boon for each seat, its Resolution reads the final state, and the win closes the Fellowship box.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { recordInstructions } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { openResolution } from "../../../rules/setup/resolution.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { BREAKING_GOLDENS, breakingGameWorld, playGolden } from "../../../../test/scenarios/breaking-of-the-fellowship/game.ts";
import { breaking, campaign } from "../../../../test/scenarios/breaking-of-the-fellowship/scene.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";

import { checklist } from "../../checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { buildStart } from "../../start.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const FRODO = "141001";
const SAM = "141002";
const DECK = Array.from({ length: 12 }, () => "filler");
const BOONS = ["142015", "142016", "142017", "142018"];
// What Journey in the Dark earned in scenario 5: two burden treacheries and a burden objective.
const EARNED = ["142086", "142085", "142088"];

let ctx: ReduceContext;

beforeAll(async () => {
  const world = await breakingGameWorld();
  const extra = await loadPrinted([...EARNED, SAM, "141017"]);
  ctx = { effects: EFFECTS, cards: new Map([...world.cards, ...extra]) };
}, 60_000);

// The log after scenarios 1 to 5: Mr. Underhill on Frodo from the first, Journey in the Dark's burdens in the pool.
function afterFive(): CampaignLog {
  const pool = (code: string, attachedTo: string | null) => ({ code, back: printedOf(ctx.cards, code).backType ?? "player", burdenSet: printedOf(ctx.cards, code).burdenSet, attachedTo, seat: null });
  return {
    ...emptyLog(1),
    heroesBySeat: [[FRODO, SAM]],
    completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south", "journey-in-the-dark"],
    campaignPool: [pool("141017", FRODO), ...EARNED.map((code) => pool(code, null))],
  };
}

const seats = [{ heroes: [FRODO, SAM], deck: DECK }];

describe("the campaign across scenarios 5 and 6", () => {
  it("scenario 6 unlocks after scenario 5", () => {
    expect(campaignPath(campaign, {}, afterFive()).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "current"]);
    expect(campaign.scenarios[5]).toBe(breaking.id);
  });

  it("asks the first seat for one of the four boons and a hero to carry it, and refuses a boon that is not one of them", () => {
    const asked = checklist({ log: afterFive(), scenario: breaking, seats, effects: EFFECTS, cards: ctx.cards });
    expect(asked.ok).toBe(false);
    if (asked.ok) return;
    expect(asked.needs?.options).toEqual(BOONS.flatMap((code) => [`${code}>${FRODO}`, `${code}>${SAM}`]));
    const wrong = checklist({ log: afterFive(), scenario: breaking, seats, effects: EFFECTS, cards: ctx.cards, choices: ["142085>141001"] });
    expect(wrong.ok).toBe(false);
  });

  it("deals the boon onto the hero, earns it, and brings Journey in the Dark's burdens into the encounter deck beside Followed by Night and Ill Fate", () => {
    const plan = checklist({ log: afterFive(), scenario: breaking, seats, effects: EFFECTS, cards: ctx.cards, choices: [`142016>${SAM}`] });
    if (!plan.ok) throw new Error(JSON.stringify(plan));
    expect(plan.seats[0]?.attachments).toEqual(expect.arrayContaining([{ host: FRODO, code: "141017" }, { host: SAM, code: "142016" }]));
    expect(plan.log.campaignPool.map((card) => card.code)).toContain("142016");
    expect(plan.poolEncounterCards).toEqual(expect.arrayContaining(EARNED));
    const start = buildStart({ campaign, scenario: breaking, seatCount: 1, seed: 5, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, mode: "campaign" });
    let state = startScenario(start, ctx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
    const inDeck = (code: string) => Object.values(state.cards).filter((card) => card.code === code).map((card) => card.zone);
    // The burden treacheries go into the encounter deck; the burden objective, Grievous Wound, is dealt to the staging area.
    for (const code of ["142089", "142090", "142086", "142085"]) expect(inDeck(code), code).toEqual(["encounterDeck"]);
    expect(inDeck("142088")).toEqual(["staging"]);
    const boon = Object.values(state.cards).find((card) => card.code === "142016");
    expect(state.cards[boon?.host ?? ""]?.code).toBe(SAM);
    // 142060 has nothing to do while the scenario is played: it is not in the game.
    expect(Object.values(state.cards).some((card) => card.zone === "campaign")).toBe(false);
  });
});

describe("the Resolution (142060:B:1 to 142060:B:3), read from the final state", () => {
  async function won(): Promise<{ state: ScenarioState; game: ReturnType<typeof playGolden> }> {
    // A two-handed win in which a hero is held by Fallen Into Evil at the end; the Resolution is answered again by hand from the state just before it.
    const golden = BREAKING_GOLDENS.find((item) => item.name === "two-handed, strong, won with a hero fallen into evil")!;
    const { ctx: world } = await breakingGameWorld(golden.decks);
    const game = playGolden(golden, world);
    return { state: game.state, game };
  }

  it("logs the hero Fallen Into Evil holds as fallen, asks the first player for Followed by Night or Ill Fate, and has each seat name a captive that is not the Ring-bearer", async () => {
    const { state, game } = await won();
    const held = Object.values(state.cards).find((card) => card.code === "142083" && card.zone === "attached");
    expect(held).toBeDefined();
    const fallen = state.cards[held?.host ?? ""]?.code.replace("~enemy", "");
    expect(state.resolutionLog.fallen).toEqual([fallen]);
    // The fallen hero is not offered as a captive: it is no longer among its player's heroes.
    expect(state.resolutionLog.captives.map((item) => item.hero)).not.toContain(fallen);
    expect(state.resolutionLog.earned.map((item) => item.code)).toEqual(["142089"]);
    const log = applyResolution(game.log, state.scenarioId, state, (await breakingGameWorld()).cards, NO_COPY_LIMITS);
    expect(log.fallenHeroesBySeat.flat()).toEqual([fallen]);
  });

  it("offers the burden pair to the first player and a captive to each seat, in the card's order", async () => {
    const world = await breakingGameWorld();
    const { state: final } = await won();
    // Rebuild the resolution from a fresh table: the cleared state with the two heroes in play and nothing attached.
    const resolving: ScenarioState = { ...final, window: null, stageCleared: true, resolutionAt: 0, resolutionSeat: 0, resolutionLog: { earned: [], fallen: [], captives: [] }, resolution: recordInstructions(EFFECTS, breaking.campaignCard, "resolution") };
    const asked = openResolution(resolving, world.ctx);
    expect(asked.window?.kind).toBe("resolution");
    const choice = expectOk(reduce(asked, { type: "ChooseResolution", optionId: "142090" }, world.ctx)).state;
    expect(choice.resolutionLog.earned.map((item) => item.code)).toEqual(["142090"]);
    expect(choice.window?.kind).toBe("resolution");
    const seat0 = choice.seats[0]?.heroes[0] ?? "";
    const named = expectOk(reduce(choice, { type: "ChooseResolution", optionId: seat0 }, world.ctx)).state;
    expect(named.resolutionLog.captives).toEqual([{ seat: 0, hero: choice.cards[seat0]?.code }]);
  });
});
