// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.burdens, mec109.burden-deck, mec109.setup-flight-to-the-ford,
// mec109.ringbearers-life, mec109.campaign-mode (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { encounterCodes } from "../catalog/scenario-data.ts";
import { byCode, expectOk } from "../rules/fixture.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";
import { printedOf } from "../rules/printed.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { FORD_GOLDENS, fordWorld, playGolden } from "../../scripts/ford-game.ts";
import { BURDENS, campaign, ford, loadFordWorld, type FordWorld } from "../../scripts/ford-scene.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";

import { checklist } from "./checklist.ts";
import { resolutionView, settledSentence } from "./resolution-view.ts";
import type { World } from "./world.ts";
import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { buildStart } from "./start.ts";

const FRODO = "141001";
const SAM = "141002";
const DECK = Array.from({ length: 12 }, () => "filler");

let world: FordWorld;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await loadFordWorld();
  const extra = await loadPrinted(["141017", "141018", "141078", "142011", "142012", "142013", "142014", "142019"]);
  const cards = new Map([...world.cards, ...extra]);
  ctx = { effects: EFFECTS, cards };
});

// The log after scenarios 1 and 2: Gandalf's Delay and Mr. Underhill earned in the first, Tireless Ranger on Sam in the second.
function afterTwo(): CampaignLog {
  const cards = ctx.cards;
  const pool = (code: string, attachedTo: string | null, seat: number | null) => ({ code, back: printedOf(cards, code).backType ?? "player", burdenSet: printedOf(cards, code).burdenSet, attachedTo, seat });
  return {
    ...emptyLog(1),
    heroesBySeat: [[FRODO, SAM]],
    completed: ["a-shadow-of-the-past", "a-knife-in-the-dark"],
    campaignPool: [pool("141078", null, null), pool("141017", FRODO, null), pool("141018", SAM, 0)],
  };
}

function dealt(log: CampaignLog, mode: "campaign" | "standalone" = "campaign"): ScenarioState {
  const plan = checklist({ log, scenario: ford, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
  if (!plan.ok) throw new Error(plan.errors.join("; "));
  const start = buildStart({ campaign, scenario: ford, seatCount: 1, seed: 5, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, mode });
  return expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
}

describe("the campaign across scenarios 2 and 3", () => {
  it("scenario 3 unlocks after scenario 2, and its checklist carries the earned cards over", () => {
    const log = afterTwo();
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "current", "locked", "locked", "locked"]);
    const plan = checklist({ log, scenario: ford, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Underhill and the boon go back on their heroes (step 5); scenario 1's burden is shuffled into scenario 3's encounter deck.
    expect(plan.seats[0]?.attachments).toEqual(expect.arrayContaining([{ host: FRODO, code: "141017" }, { host: SAM, code: "141018" }]));
    expect(plan.poolEncounterCards).toEqual(["141078"]);
  });

  it("deals the scenario: the burden deck, the life, the wound, the Fell Rider, the set-aside cards and the campaign card, with the earned cards in play", () => {
    const started = dealt(afterTwo());
    const all = (code: string) => byCode(started, code);
    expect(started.life).toBe(15);
    expect(started.burdenDeck?.map((id) => started.cards[id]?.code).sort()).toEqual([...BURDENS]);
    // The campaign card is next to the quest deck, in the game.
    expect(all("141056").map((id) => started.cards[id]?.zone)).toEqual(["campaign"]);
    // An Evil Wound is attached to the Ring-bearer, who carries The One Ring.
    const frodo = all(FRODO)[0] ?? "";
    expect(started.cards[all("141057")[0] ?? ""]?.host).toBe(frodo);
    expect(started.cards[all("141085")[0] ?? ""]?.host).toBe(frodo);
    // The quest card's Setup: The Last Bridge and one Fell Rider for the one player in the staging area, two cards set aside.
    expect(started.staging.map((id) => started.cards[id]?.code).sort()).toEqual(["141058", "141063", "141078"].sort());
    expect(started.setAside.map((id) => started.cards[id]?.code).sort()).toEqual(["141059", "141068"]);
    // The earned boon is on Sam, with its stat and its trait; Mr. Underhill is on Frodo.
    const sam = all(SAM)[0] ?? "";
    expect(started.cards[all("141018")[0] ?? ""]?.host).toBe(sam);
    expect(started.cards[all("141017")[0] ?? ""]?.host).toBe(frodo);
    expect(modifiedStat(started, started.cards[sam]!, "defense", ctx.cards)).toBe((printedOf(ctx.cards, SAM).defense ?? 0) + 1);
    // Gandalf's Delay was shuffled into the encounter deck and its own Setup line staged it once.
    expect(all("141078")).toHaveLength(1);
    const dealtCodes = encounterCodes(ford, "Normal", 1).length;
    expect(started.encounterDeck.length + started.staging.filter((id) => started.cards[id]?.code === "141078").length).toBe(dealtCodes + 1);
  });

  it("the Setup record states the cards the definition places, and the Fell Riders one for each player", () => {
    const record = EFFECTS.find((effect) => effect.id === "141028:setup:1");
    expect(record?.lines).toEqual(["141028:A:1"]);
    const stated = (record?.instructions ?? []).flatMap((instruction) => ("code" in instruction ? [`${instruction.verb} ${instruction.code}`] : []));
    for (const seatCount of [1, 2] as const) {
      const start = buildStart({ campaign, scenario: ford, seatCount, seed: 5, threatModifier: 0, seats: Array.from({ length: seatCount }, () => ({ heroes: [FRODO], deck: [] })), effects: EFFECTS });
      const run = start.definition.setup.flatMap((instruction) => ("code" in instruction && instruction.code !== "141085" ? [`${instruction.verb} ${instruction.code}`] : []));
      expect([...new Set(run)].sort(), `${seatCount} seats`).toEqual([...new Set(stated)].sort());
      expect(run.filter((item) => item === "AddToStaging 141063"), `${seatCount} seats`).toHaveLength(seatCount);
    }
    // It also says the burden deck is shuffled, the life is set at 15 and the encounter deck is shuffled, in printed order.
    expect((record?.instructions ?? []).map((instruction) => instruction.verb)).toEqual(["ShuffleBurdenDeck", "AttachToRingBearer", "SetAside", "SetAside", "AddToStaging", "AddToStaging", "SetLife", "ShuffleEncounterDeck"]);
    expect(record?.instructions).toContainEqual({ verb: "SetLife", value: ford.life });
  });

  it("a standalone game has the burden deck and the life but no campaign card and no earned card (mec109.campaign-mode)", () => {
    const standalone = dealt(afterTwo(), "standalone");
    expect(standalone.life).toBe(15);
    expect(standalone.burdenDeck).toHaveLength(5);
    expect(Object.values(standalone.cards).some((card) => card.zone === "campaign")).toBe(false);
    expect(standalone.resolution).toEqual([]);
  });

  it("a win writes exactly the burdens the card names, keeps the pool, and unlocks The Ring Goes South", async () => {
    const golden = FORD_GOLDENS.find((item) => item.outcome === "won" && item.seatCount === 1);
    if (!golden) throw new Error("no won golden");
    const game = playGolden(golden, (await fordWorld(golden.decks)).ctx);
    const log = afterTwo();
    const cards = new Map([...(await fordWorld(golden.decks)).cards, ...ctx.cards]);
    const after = applyResolution(log, game.state.scenarioId, game.state, cards);
    expect(after.completed).toEqual(["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford"]);
    // The earlier cards stay; the burdens in play, in the encounter deck and in its discard pile join them.
    expect(after.campaignPool.slice(0, 3)).toEqual(log.campaignPool);
    const burdens = after.campaignPool.slice(3);
    expect(burdens.length).toBeGreaterThan(0);
    for (const card of burdens) expect(card).toMatchObject({ back: "encounter", burdenSet: "Flight to the Ford", attachedTo: null });
    expect(after.earned["flight-to-the-ford"]).toEqual(burdens.map((card) => card.code));
    expect(campaignPath(campaign, {}, after).map((node) => node.status)).toEqual(["completed", "completed", "completed", "current", "locked", "locked"]);
    expect(campaign.scenarios[3]).toBe("the-ring-goes-south");
    // The earned burdens reach the next scenario's encounter deck through the checklist (step 8).
    const next = checklist({ log: after, scenario: ford, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards });
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.poolEncounterCards).toEqual(expect.arrayContaining(burdens.map((card) => card.code)));
  });

  it("the resolution screen has no choice to ask: it settles on the burdens and the scenario it unlocks, and a loss shows Defeat", async () => {
    const won = FORD_GOLDENS.find((item) => item.outcome === "won" && item.seatCount === 1)!;
    const lost = FORD_GOLDENS.find((item) => item.outcome === "lost")!;
    const cards = new Map([...(await fordWorld(won.decks)).cards, ...ctx.cards]);
    const screen: World = { campaign, scenario: ford, effects: EFFECTS, cards, sets: new Map() };
    const game = playGolden(won, (await fordWorld(won.decks)).ctx);
    const view = resolutionView(game.state, screen);
    expect(view.kind).toBe("settled");
    if (view.kind !== "settled") return;
    expect(view.earned.every((card) => card.hero == null && card.seat == null)).toBe(true);
    const sentence = settledSentence(view, screen, "The Ring Goes South");
    expect(sentence).toMatch(/^Confirming records .+ in the campaign and unlocks The Ring Goes South\.$/);
    for (const card of view.earned) expect(sentence).toContain(cards.get(card.code)?.name ?? "missing");
    const defeat = resolutionView(playGolden(lost, (await fordWorld(lost.decks)).ctx).state, screen);
    expect(defeat).toEqual({ kind: "lost", reason: lost.lossReason });
  });

  it("a loss writes nothing and leaves The Ring Goes South locked", async () => {
    const golden = FORD_GOLDENS.find((item) => item.outcome === "lost");
    if (!golden) throw new Error("no lost golden");
    const game = playGolden(golden, (await fordWorld(golden.decks)).ctx);
    const log = afterTwo();
    expect(applyResolution(log, game.state.scenarioId, game.state, ctx.cards)).toBe(log);
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "current", "locked", "locked", "locked"]);
  });
});
