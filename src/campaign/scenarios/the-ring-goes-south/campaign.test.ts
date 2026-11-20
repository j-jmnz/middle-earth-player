// Rules: rr.campaign-setup-checklist, rr.campaign-cards, rr.burdens, mec109.campaign-mode, mec109.setup-the-ring-goes-south,
// mec109.stage-4 (data/rules/entries.json). The campaign across scenarios 3 and 4.
import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import { encounterCodes } from "../../../catalog/scenario-data.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { byCode, expectOk } from "../../../rules/core/test-fixture.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { playGolden, SOUTH_GOLDENS, southWorld } from "../../../../test/scenarios/the-ring-goes-south/game.ts";
import { campaign, DOORS, loadSouthWorld, LUST, south, southTable, type SouthWorld } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";

import { checklist } from "../../checklist.ts";
import { resolutionView } from "../../resolution-view.ts";
import { applyResolution, emptyLog, type CampaignLog } from "../../log.ts";
import { campaignPath } from "../../path.ts";
import { buildStart } from "../../start.ts";
import type { World } from "../../world.ts";
import { NO_COPY_LIMITS } from "../../wilderland.ts";

const FRODO = "141001";
const SAM = "141002";
const DECK = Array.from({ length: 12 }, () => "filler");
// Two of Flight to the Ford's burdens, earned in scenario 3.
const BURDENS = ["141081", "141083"];

let world: SouthWorld;
let ctx: ReduceContext;

beforeAll(async () => {
  world = await loadSouthWorld();
  const extra = await loadPrinted(["141017", "141018", "141078", "141080", ...BURDENS, "142011", "142012", "142013", "142014", "142019"]);
  const cards = new Map([...world.cards, ...extra]);
  ctx = { effects: EFFECTS, cards };
});

// The log after scenarios 1 to 3: Mr. Underhill and Gandalf's Delay from the first, Tireless Ranger on Sam from the second, two burdens
// from the third.
function afterThree(): CampaignLog {
  const pool = (code: string, attachedTo: string | null, seat: number | null) => ({ code, back: printedOf(ctx.cards, code).backType ?? "player", burdenSet: printedOf(ctx.cards, code).burdenSet, attachedTo, seat });
  return {
    ...emptyLog(1),
    heroesBySeat: [[FRODO, SAM]],
    completed: ["a-shadow-of-the-past", "a-knife-in-the-dark", "flight-to-the-ford"],
    campaignPool: [pool("141078", null, null), pool("141017", FRODO, null), pool("141018", SAM, 0), ...BURDENS.map((code) => pool(code, null, null))],
  };
}

function dealt(): ScenarioState {
  const plan = checklist({ log: afterThree(), scenario: south, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards, choices: ["142013"] });
  if (!plan.ok) throw new Error(JSON.stringify(plan));
  const start = buildStart({ campaign, scenario: south, seatCount: 1, seed: 5, threatModifier: plan.threatModifier, seats: plan.seats, effects: EFFECTS, poolEncounterCards: plan.poolEncounterCards, mode: "campaign" });
  return expectOk(reduce(startScenario(start, ctx), { type: "Keep" }, ctx)).state;
}

describe("the campaign across scenarios 3 and 4", () => {
  it("scenario 4 unlocks after scenario 3, and its checklist offers the free hero change, the boons and the earned burdens", () => {
    const log = afterThree();
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "completed", "completed", "current", "locked", "locked"]);
    const open = checklist({ log, scenario: south, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards });
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.needs).toEqual({ seat: 0, options: ["142011", "142012", "142013", "142014"] });
    const plan = checklist({ log, scenario: south, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards: ctx.cards, choices: ["142013"] });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    // Glamdring in hand, the three nobody chose shuffled into the first player's deck; the burdens reach the encounter deck.
    expect(plan.seats[0]?.hand).toEqual(["142013"]);
    expect(plan.seats[0]?.deck).toEqual([...DECK, "142011", "142012", "142014"]);
    expect(plan.poolEncounterCards).toEqual(expect.arrayContaining(["141078", ...BURDENS]));
  });

  it("changing a hero costs no threat under this scenario's campaign card, and the briefing says so", () => {
    // No card is carried by a hero, so Sam can be traded for Merry.
    const before = afterThree();
    const log = { ...before, heroesBySeat: [[FRODO, SAM]], campaignPool: before.campaignPool.filter((card) => card.attachedTo == null) };
    const plan = checklist({ log, scenario: south, seats: [{ heroes: [FRODO, "141003"], deck: DECK }], effects: EFFECTS, cards: ctx.cards, choices: ["142011"] });
    if (!plan.ok) throw new Error(JSON.stringify(plan));
    expect(plan.threatModifier).toBe(0);
  });

  it("deals the scenario: four cards set aside, nothing in the staging area but the earned Gandalf's Delay, the earned cards in play", () => {
    const started = dealt();
    const all = (code: string) => byCode(started, code);
    expect(started.setAside.map((id) => started.cards[id]?.code).sort()).toEqual(["142024", "142029", "142030", "142084"]);
    expect(started.staging.map((id) => started.cards[id]?.code)).toEqual(["141078"]);
    expect(started.cards[started.questStage ?? ""]?.code).toBe("142020");
    expect(started.life).toBeUndefined();
    expect(started.burdenDeck).toBeUndefined();
    // Mr. Underhill is on Frodo, Tireless Ranger on Sam; Glamdring is in hand.
    expect(started.cards[all("141017")[0] ?? ""]?.host).toBe(all(FRODO)[0]);
    expect(started.cards[all("141018")[0] ?? ""]?.host).toBe(all(SAM)[0]);
    expect(all("142013").map((id) => started.cards[id]?.zone)).toEqual(["hand"]);
    // The encounter deck holds the set and the earned cards that belong in it.
    const base = encounterCodes(south, "Normal", 1).length;
    expect(started.encounterDeck.length + started.staging.length).toBe(base + 3);
    // 142019 has nothing to do while the scenario is played: it is not in the game.
    expect(Object.values(started.cards).some((card) => card.zone === "campaign")).toBe(false);
  });

  it("a win with Lust for the Ring attached to a hero records it as earned, on that hero; with it anywhere else, nothing", () => {
    for (const attached of [true, false]) {
      const table = southTable(world, { stage: "142023", active: DOORS, heroes: ["strong"], setAside: attached ? [] : [LUST] });
      let state = table.state;
      const strong = byCode(state, "strong")[0] ?? "";
      if (attached) {
        const spawned = spawn(state, LUST, { zone: "attached" });
        state = attachTo(spawned.state, spawned.id, strong);
      }
      // The quest card explores Doors of Durin: it is immune to player card effects, so a hero's effect would place no progress on it.
      const won = settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "ProgressQuest", amount: 9 }, { seat: 0, sourceId: state.questStage }, table.ctx, []), table.ctx), table.ctx, []);
      expect(won.stageCleared, String(attached)).toBe(true);
      expect(won.resolutionLog.earned.map((item) => item.code), String(attached)).toEqual(attached ? [LUST] : []);
      const log = applyResolution(emptyLog(1), won.scenarioId, won, ctx.cards, NO_COPY_LIMITS);
      expect(log.completed, String(attached)).toEqual(["the-ring-goes-south"]);
      expect(log.campaignPool.map((card) => card.code), String(attached)).toEqual(attached ? [LUST] : []);
    }
  });

  it("the resolution screen settles on what was earned and the scenario it unlocks, and a loss shows Defeat", async () => {
    const won = SOUTH_GOLDENS.find((item) => item.outcome === "won" && item.seatCount === 1)!;
    const lost = SOUTH_GOLDENS.find((item) => item.outcome === "lost")!;
    const cards = new Map([...(await southWorld(won.decks)).cards, ...ctx.cards]);
    const screen: World = { campaign, scenario: south, effects: EFFECTS, cards, sets: new Map() };
    const game = playGolden(won, (await southWorld(won.decks)).ctx);
    const view = resolutionView(game.state, screen);
    expect(view.kind).toBe("settled");
    const defeat = resolutionView(playGolden(lost, (await southWorld(lost.decks)).ctx).state, screen);
    expect(defeat.kind).toBe("lost");
  });
});
