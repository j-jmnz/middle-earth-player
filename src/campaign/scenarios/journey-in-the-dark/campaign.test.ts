// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.burdens, rr.campaign-pool, mec109.campaign-mode, mec109.setup-journey-in-the-dark,
// rr.winning-the-game (data/rules/entries.json). The campaign across scenarios 4 and 5.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { encounterCodes, recordInstructions } from "../../../catalog/scenario-data.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { MORIA_GOLDENS, moriaWorld, playGolden } from "../../../../test/scenarios/journey-in-the-dark/game.ts";
import { BALROG, campaign, loadMoriaWorld, makeTable, moria, type MoriaWorld } from "../../../../test/scenarios/journey-in-the-dark/scene.ts";
import { first } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";

import { checklist } from "../../checklist.ts";
import { resolutionView } from "../../resolution-view.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { buildStart } from "../../start.ts";
import type { World } from "../../world.ts";

const FRODO = "141001";
const SAM = "141002";
const DECK = Array.from({ length: 12 }, () => "filler");
const LUST = "142084";
// Two of Flight to the Ford's burdens, earned in scenario 3, and Lust for the Ring, earned in scenario 4.
const BURDENS = ["141081", "141083", LUST];

let world: MoriaWorld;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await loadMoriaWorld();
  const extra = await loadPrinted(["141017", "141018", "141078", ...BURDENS, "142011", "142012", "142013", "142014", "142019", "141003"]);
  const cards = new Map([...world.cards, ...extra]);
  ctx = { effects: EFFECTS, cards };
}, 60_000);

// The log after scenarios 1 to 4: Mr. Underhill and Gandalf's Delay from the first, Tireless Ranger on Sam from the second, two burdens from the
// third, and Lust for the Ring from the fourth.
function afterFour(): CampaignLog {
  const pool = (code: string, attachedTo: string | null, seat: number | null) => ({ code, back: printedOf(ctx.cards, code).backType ?? "player", burdenSet: printedOf(ctx.cards, code).burdenSet, attachedTo, seat });
  return {
    ...emptyLog(1),
    heroesBySeat: [[FRODO, SAM]],
    completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south"],
    campaignPool: [pool("141078", null, null), pool("141017", FRODO, null), pool("141018", SAM, 0), ...BURDENS.map((code) => pool(code, null, null))],
  };
}

function dealt(log: CampaignLog = afterFour()): ScenarioState {
  const plan = checklist({ log, scenario: moria, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
  if (!plan.ok) throw new Error(JSON.stringify(plan));
  const start = buildStart({ campaign, scenario: moria, seatCount: 1, seed: 5, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, mode: "campaign" });
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 12 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

describe("the campaign across scenarios 4 and 5", () => {
  it("scenario 5 unlocks after scenario 4, and its checklist asks nothing: the campaign card has no choice at Setup", () => {
    const log = afterFour();
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "current", "locked"]);
    const plan = checklist({ log, scenario: moria, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
    expect(plan.ok).toBe(true);
  });

  it("brings the earlier scenarios' cards in: the earned burdens and Gandalf's Delay reach the encounter deck, the permanent cards stay on their heroes", () => {
    const plan = checklist({ log: afterFour(), scenario: moria, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.poolEncounterCards).toEqual(expect.arrayContaining(["141078", ...BURDENS]));
    expect(plan.seats[0]?.attachments).toEqual(expect.arrayContaining([{ host: FRODO, code: "141017" }, { host: SAM, code: "141018" }]));
    // This campaign card gives no free hero change: trading Sam for Merry costs 1 threat.
    const before = afterFour();
    const free = { ...before, campaignPool: before.campaignPool.filter((card) => card.attachedTo !== SAM && card.seat !== 0) };
    const traded = checklist({ log: free, scenario: moria, seats: [{ heroes: [FRODO, "141003"], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
    if (!traded.ok) throw new Error(JSON.stringify(traded));
    expect(traded.threatModifier).toBe(1);
  });

  it("deals the scenario: three cards set aside, Doom, Doom, Doom with 10 damage and the burden objectives in the staging area, the burden treacheries and the earned cards in the deck", () => {
    const started = dealt();
    const all = (code: string) => Object.values(started.cards).filter((card) => card.code === code);
    expect(started.setAside.map((id) => started.cards[id]?.code).sort()).toEqual([BALROG, "142050", "142051"]);
    const staging = started.staging.map((id) => started.cards[id]?.code);
    expect(staging).toEqual(expect.arrayContaining(["142043", "142087", "142088", "141078"]));
    expect(all("142043")[0]?.damage).toBe(10);
    expect(started.cards[started.questStage ?? ""]?.code).toBe("142040");
    expect(started.life).toBeUndefined();
    expect(started.burdenDeck).toBeUndefined();
    // The two burden treacheries and the three earned burdens are in the encounter deck, with the set's cards (the one location the player found is not).
    for (const code of ["142085", "142086", ...BURDENS]) expect(all(code).map((card) => card.zone), code).toEqual(["encounterDeck"]);
    // In the deck or the staging area: the set (the locations the Setup finds included), the two burden treacheries, the four cards of the pool (Gandalf's Delay and
    // the three burdens), the two burden objectives and Doom, Doom, Doom.
    expect(started.encounterDeck.length + started.staging.length).toBe(encounterCodes(moria, "Normal", 1).length + 2 + 4 + 2 + 1);
    // 142039 has nothing to do while the scenario is played: it is not in the game.
    expect(Object.values(started.cards).some((card) => card.zone === "campaign")).toBe(false);
    // Mr. Underhill is on Frodo, Tireless Ranger on Sam.
    expect(started.cards[all("141017")[0]?.id ?? ""]?.host).toBe(all(FRODO)[0]?.id);
    expect(started.cards[all("141018")[0]?.id ?? ""]?.host).toBe(all(SAM)[0]?.id);
  });
});

describe("the Resolution (142039:B:1), read from the final state", () => {
  function won(balrog: "staging" | "victory" | "setAside" | "encounterDiscard"): { state: ScenarioState; table: ReturnType<typeof makeTable> } {
    const table = makeTable(world, { stage: "142042", progress: 14, setAside: balrog === "setAside" ? [BALROG] : [], staging: balrog === "staging" ? [BALROG] : [], victory: balrog === "victory" ? [BALROG] : [], discard: balrog === "encounterDiscard" ? [BALROG] : [] });
    const resolving: ScenarioState = { ...table.state, window: null, stageCleared: true, resolution: recordInstructions(EFFECTS, moria.campaignCard, "resolution") };
    return { state: openResolution(resolving, table.ctx), table };
  }

  it("earns all four burdens when the Balrog is still in play", () => {
    const { state } = won("staging");
    expect(resolutionResult(state)?.earned.map((item) => item.code)).toEqual(["142086", "142085", "142088", "142087"]);
  });

  it.each(["victory", "setAside", "encounterDiscard"] as const)("asks the first player for one burden of each pair when the Balrog was destroyed or never came (%s)", (zone) => {
    const { state, table } = won(zone);
    expect(state.window?.kind).toBe("resolution");
    const first = expectOk(reduce(state, { type: "ChooseResolution", optionId: "142085" }, table.ctx)).state;
    const second = expectOk(reduce(first, { type: "ChooseResolution", optionId: "142087" }, table.ctx)).state;
    expect(resolutionResult(second)?.earned.map((item) => item.code)).toEqual(["142085", "142087"]);
  });
});

describe("a whole game's Resolution on the campaign log", () => {
  let strong: Awaited<ReturnType<typeof moriaWorld>>;
  beforeAll(async () => {
    strong = await moriaWorld("strong");
  }, 60_000);

  it.each(MORIA_GOLDENS.filter((golden) => golden.outcome === "won").map((golden) => golden.name))("%s: a win writes the burdens it earned and unlocks Breaking of the Fellowship", (name) => {
    const golden = MORIA_GOLDENS.find((item) => item.name === name)!;
    const game = playGolden(golden, strong.ctx);
    const earned = game.state.resolutionLog.earned.map((item) => item.code);
    const balrogInPlay = Object.values(game.state.cards).some((card) => card.code === BALROG && ["staging", "engaged", "activeLocation"].includes(card.zone));
    expect(earned.length).toBe(balrogInPlay ? 4 : 2);
    const before = { ...emptyLog(golden.seatCount), completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford", "the-ring-goes-south"] };
    const after = applyResolution(before, game.state.scenarioId, game.state, strong.cards);
    expect(after.completed).toContain("journey-in-the-dark");
    expect(after.campaignPool.map((card) => card.code).sort()).toEqual([...earned].sort());
    expect(campaignPath(campaign, {}, after).map((node) => node.status)).toEqual(["completed", "completed", "completed", "completed", "completed", "current"]);
    expect(campaign.scenarios[5]).toBe("breaking-of-the-fellowship");
  });

  it("the resolution screen settles on what was earned, and a loss shows Defeat", async () => {
    const won = MORIA_GOLDENS.find((item) => item.outcome === "won" && item.seatCount === 1)!;
    const lost = MORIA_GOLDENS.find((item) => item.outcome === "lost")!;
    const cards = new Map([...strong.cards, ...ctx.cards]);
    const screen: World = { campaign, scenario: moria, effects: EFFECTS, cards, sets: new Map() };
    expect(resolutionView(playGolden(won, strong.ctx).state, screen).kind).toBe("settled");
    expect(resolutionView(playGolden(lost, (await moriaWorld(lost.decks)).ctx).state, screen).kind).toBe("lost");
  });
});

void first;
