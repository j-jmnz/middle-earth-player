import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { scenarioCards } from "../catalog/scenario-data.ts";
import { expectOk } from "../rules/fixture.ts";
import { updateCard, type ScenarioState } from "../rules/state.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { legalIntents, reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { moveCard } from "../rules/zones.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { begin, buildTable, FRODO, idsOf, SAM, sceneCards, send, type Table } from "../../scripts/test-scene.ts";

import { checklist, type ChecklistInput } from "./checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
import { campaignPath } from "./path.ts";
import { buildStart } from "./start.ts";

// The campaign across two scenarios: win scenario 1 with a choice, then set scenario 2 up from the log.
const campaign = loadCampaign();
const second = loadScenario("a-knife-in-the-dark");
const MERRY = "141003";
const PIPPIN = "141004";

let base: Awaited<ReturnType<typeof sceneCards>>;
let cards: Map<string, PrintedCard>;

beforeAll(async () => {
  base = await sceneCards();
  const extra = await loadPrinted([...scenarioCards(second).map((card) => card.code), ...second.campaignPlaced, MERRY, PIPPIN, "142011", "142012", "142013", "142014", "142015"]);
  cards = new Map([...base.cards, ...extra]);
});

function wonWith(first: string, second_: string): { state: ScenarioState; table: Table; log: CampaignLog } {
  const table = buildTable(base, { stage: "141024", active: "141035", deck: ["f0", "f0", "f0"] });
  const state = updateCard(table.state, idsOf(table, "141035"), { progress: 8 });
  let run = send(begin(state), { type: "Commit", cardIds: [idsOf(table, FRODO), idsOf(table, SAM)] }, table.ctx);
  run = send(run, { type: "Pass" }, table.ctx);
  run = send(run, { type: "ChooseResolution", optionId: first }, table.ctx);
  run = send(run, { type: "ChooseResolution", optionId: second_ }, table.ctx);
  return { state: run.state, table, log: applyResolution(emptyLog(1), run.state.scenarioId, run.state, cards) };
}

const DECK = Array.from({ length: 10 }, (_, index) => `deck${index}`);

function plan(log: CampaignLog, heroes: readonly string[], extra: Partial<ChecklistInput> = {}) {
  return checklist({ log, scenario: second, seats: [{ heroes, deck: DECK }], effects: EFFECTS, cards, ...extra });
}

describe("two scenarios of the campaign", () => {
  it("Gandalf's Delay and Mr. Underhill: the burden is shuffled into scenario 2's encounter deck and Underhill, a Permanent card, goes on his hero in step 5", () => {
    const { log } = wonWith("141078", "141017");
    expect(log.completed).toEqual(["a-shadow-of-the-past"]);
    const result = plan(log, [FRODO, SAM]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.steps.every((step) => step.rule === "rr.campaign-setup-checklist")).toBe(true);
    expect(result.poolEncounterCards).toEqual(["141078"]);
    expect(result.seats[0]?.attachments).toEqual([{ host: FRODO, code: "141017" }]);
    expect(result.steps[4]?.did.join(" ")).toContain("Mr. Underhill goes on Frodo Baggins");
    expect(result.steps[5]?.did.join(" ")).not.toContain("Underhill");
    const start = buildStart({ campaign, scenario: second, seatCount: 1, seed: 3, threatModifier: result.threatModifier, seats: result.seats, effects: EFFECTS, poolEncounterCards: result.poolEncounterCards });
    expect(start.encounterDeck).toContain("141078");
    const ctx: ReduceContext = { effects: EFFECTS, cards };
    const started = startScenario(start, ctx);
    const inDeck = started.encounterDeck.map((id) => started.cards[id]?.code);
    expect(inDeck).toContain("141078");
    const underhill = Object.values(started.cards).find((card) => card.code === "141017");
    expect(started.cards[underhill?.host ?? ""]?.code).toBe(FRODO);
  });

  it("The Ring Draws Them and Gildor Inglorion: both encounter-backed cards join the encounter deck", () => {
    const { log } = wonWith("141079", "141077");
    const result = plan(log, [FRODO, SAM]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.poolEncounterCards).toEqual(["141079", "141077"]);
    expect(printedOf(cards, "141077").backType).toBe("encounter");
    expect(result.seats[0]?.attachments).toEqual([]);
  });

  it("a hero change raises the threat penalty by one", () => {
    const { log } = wonWith("141078", "141017");
    const same = plan(log, [FRODO, SAM]);
    const changed = plan({ ...log, heroesBySeat: [[FRODO, SAM]] }, [FRODO, MERRY]);
    expect(same.ok && same.threatModifier).toBe(0);
    expect(changed.ok).toBe(true);
    if (changed.ok) {
      expect(changed.threatModifier).toBe(1);
      expect(changed.log.threatPenalty).toBe(1);
      expect(changed.steps[2]?.did[0]).toContain("add 1");
    }
  });

  // 142019 (The Ring Goes South) waives the +1 threat penalty for changing heroes; its Setup record has WaiveThreatPenalty.
  it("a hero change costs nothing when the scenario's campaign card waives the penalty (WaiveThreatPenalty)", () => {
    const { log } = wonWith("141078", "141017");
    const ringGoesSouth = loadScenario("the-ring-goes-south");
    expect(ringGoesSouth.campaignCard).toBe("142019");
    const logged = { ...log, heroesBySeat: [[FRODO, SAM]] };
    const input = { log: logged, scenario: ringGoesSouth, seats: [{ heroes: [FRODO, MERRY], deck: DECK }], effects: EFFECTS, cards };
    const waived = checklist({ ...input, choices: ["142011"] });
    expect(waived.ok).toBe(true);
    if (waived.ok) {
      expect(waived.threatModifier).toBe(0);
      expect(waived.log.threatPenalty).toBe(0);
      expect(waived.steps[2]?.did[0]).toContain("cost nothing");
    }
    // The same change under a card that does not waive it costs 1.
    const charged = checklist({ ...input, scenario: second });
    expect(charged.ok && charged.threatModifier).toBe(1);
  });

  it("142019 asks each seat for one boon into hand and shuffles the boons nobody took into the first player's deck", () => {
    const { log } = wonWith("141078", "141017");
    const ringGoesSouth = loadScenario("the-ring-goes-south");
    const input = { log: { ...log, heroesBySeat: [[FRODO, SAM], [MERRY]] }, scenario: ringGoesSouth, seats: [{ heroes: [FRODO, SAM], deck: DECK }, { heroes: [MERRY], deck: DECK }], effects: EFFECTS, cards };
    const open = checklist(input);
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.needs).toEqual({ seat: 0, options: ["142011", "142012", "142013", "142014"] });
    const half = checklist({ ...input, choices: ["142011"] });
    if (!half.ok) expect(half.needs).toEqual({ seat: 1, options: ["142012", "142013", "142014"] });
    const both = checklist({ ...input, choices: ["142011", "142013"] });
    expect(both.ok).toBe(true);
    if (!both.ok) return;
    expect(both.seats[0]?.hand).toEqual(["142011"]);
    expect(both.seats[1]?.hand).toEqual(["142013"]);
    expect(both.seats[0]?.deck).toEqual([...DECK, "142012", "142014"]);
    expect(both.log.campaignPool.map((card) => card.code)).toContain("142011");
    expect(checklist({ ...input, choices: ["142011", "142011"] }).ok).toBe(false);
  });

  it("142060 asks each seat to put one of the gifts on a hero", () => {
    const { log } = wonWith("141078", "141017");
    const breaking = loadScenario("breaking-of-the-fellowship");
    const input = { log: { ...log, heroesBySeat: [[FRODO, SAM]] }, scenario: breaking, seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards };
    const open = checklist(input);
    expect(open.ok).toBe(false);
    if (!open.ok) expect(open.needs?.options).toContain(`142015>${SAM}`);
    const done = checklist({ ...input, choices: [`142015>${SAM}`] });
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.seats[0]?.attachments).toContainEqual({ host: SAM, code: "142015" });
  });

  it("a fallen hero cannot start", () => {
    const { log } = wonWith("141078", "141017");
    const result = plan({ ...log, fallenHeroesBySeat: [[SAM]] }, [FRODO, SAM]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("fallen hero and cannot start");
  });
});

// Scenario 2 set up from scenario 1's log and played to its end (rr.campaign-setup-checklist, mec109.setup, 141044:B:1).
// The game is short-cut to stage 3B with no Nazgûl in play, so the stage's own win condition (141027:B:1) ends it; the
// goldens (golden-knife.test.ts) play whole games.
describe("A Knife in the Dark from the log of A Shadow of the Past", () => {
  const RING = "141085";
  const STARTER = Array.from({ length: 12 }, () => "card");

  function knifeStart(log: CampaignLog, seats: { heroes: string[]; deck: string[] }[], seed = 3) {
    const result = checklist({ log, scenario: second, seats, effects: EFFECTS, cards });
    if (!result.ok) throw new Error(result.errors.join("; "));
    const start = buildStart({ campaign, scenario: second, seatCount: seats.length as 1 | 2, seed, threatModifier: result.threatModifier, seats: result.seats, effects: EFFECTS, poolEncounterCards: result.poolEncounterCards });
    const ctx: ReduceContext = { effects: EFFECTS, cards };
    return { result, start, ctx, started: startScenario(start, ctx) };
  }

  const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);
  const all = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

  it("deals scenario 1's burden into the encounter deck and its Permanent boon onto its hero, and the saga setup still runs", () => {
    const { log } = wonWith("141078", "141017");
    const { result, start, started: dealt, ctx } = knifeStart(log, [{ heroes: [FRODO, SAM], deck: STARTER }]);
    // Encounter Setup and the quest card's Setup run once the opening hand is kept.
    const started = expectOk(reduce(dealt, { type: "Keep" }, ctx)).state;
    expect(start.definition.id).toBe("a-knife-in-the-dark");
    // Step 8: the encounter-backed burden joins the encounter deck; step 5: Mr. Underhill (player-backed, Permanent) goes on
    // Frodo, not into a deck; step 7 has no other player-backed card to shuffle in.
    expect(result.steps[7]?.did).toEqual(["Gandalf's Delay is shuffled into the encounter deck."]);
    expect(result.steps[6]?.did).toEqual(["No player-backed card is in the pool."]);
    expect(start.encounterDeck).toContain("141078");
    // Its own Setup line (141078:A:1) is found in the encounter deck by the Setup search and puts it in staging (mec109.setup).
    expect(codes(started, started.staging)).toContain("141078");
    expect(all(started, "141078")).toHaveLength(1);
    expect(codes(started, started.seats[0]?.deck ?? [])).not.toContain("141017");
    // The saga setup: the first seat's Ring-bearer carries The One Ring and Mr. Underhill; one Fellowship hero; one Frodo.
    const ring = all(started, RING);
    expect(ring).toHaveLength(1);
    expect(started.cards[ring[0]?.host ?? ""]?.code).toBe(FRODO);
    expect(started.seats[0]?.heroes).toContain(ring[0]?.host);
    expect(started.cards[all(started, "141017")[0]?.host ?? ""]?.code).toBe(FRODO);
    expect(all(started, FRODO)).toHaveLength(1);
    const fellowship = started.seats.flatMap((seat) => seat.heroes).filter((id) => printedOf(cards, started.cards[id]?.code ?? "").sphere === "fellowship");
    expect(fellowship).toHaveLength(1);
    // The quest card's Setup: The Prancing Pony and Bill Ferny in staging, the four cards set aside.
    expect(codes(started, started.staging).sort()).toEqual(["141045", "141051", "141078"]);
    expect(codes(started, Object.values(started.cards).filter((card) => card.zone === "setAside").map((card) => card.id))).toEqual(expect.arrayContaining(["141046", "141048", "141068", "141069"]));
  });

  it("shuffles The Ring Draws Them and Gildor Inglorion into the encounter deck, two-handed", () => {
    const { log } = wonWith("141079", "141077");
    const { started: dealt, ctx } = knifeStart({ ...log, heroesBySeat: [[FRODO, SAM], [MERRY]], fallenHeroesBySeat: [[], []] }, [{ heroes: [FRODO, SAM], deck: STARTER }, { heroes: [MERRY], deck: STARTER }]);
    const started = expectOk(reduce(expectOk(reduce(dealt, { type: "Keep" }, ctx)).state, { type: "Keep" }, ctx)).state;
    expect(codes(started, started.encounterDeck)).toEqual(expect.arrayContaining(["141079", "141077"]));
    expect(started.cards[all(started, RING)[0]?.host ?? ""]?.code).toBe(FRODO);
    expect(all(started, FRODO)).toHaveLength(1);
  });

  // Moves the game to stage 3B with every Nazgûl out of play; the next intent meets 141027:B:1.
  function atTheEnd(state: ScenarioState): ScenarioState {
    let next = state;
    for (const card of Object.values(next.cards)) {
      if (card.code === "141025" || card.code === "141026") next = moveCard(next, card.id, { zone: "setAside" });
      if (printedOf(cards, card.code).traits.includes("Nazgûl") && card.zone !== "setAside") next = moveCard(next, card.id, { zone: "setAside" });
    }
    const third = Object.values(next.cards).find((card) => card.code === "141027");
    return third ? updateCard(moveCard(next, third.id, { zone: "questStage" }), third.id, { face: "B" }) : next;
  }

  it("a win runs 141044's Resolution: the boon goes on the hero the seat names, and flight-to-the-ford unlocks", () => {
    const { log } = wonWith("141078", "141017");
    const { started, ctx } = knifeStart(log, [{ heroes: [FRODO, SAM], deck: STARTER }]);
    const kept = expectOk(reduce(started, { type: "Keep" }, ctx)).state;
    const ended = expectOk(reduce(atTheEnd(kept), { type: "Pass" }, ctx)).state;
    expect(ended.stageCleared).toBe(true);
    expect(ended.window).toEqual({ kind: "resolution", step: 0, seat: 0 });
    const sam = ended.seats[0]?.heroes.find((id) => ended.cards[id]?.code === SAM) ?? "";
    expect(legalIntents(ended, ctx)).toContainEqual({ type: "ChooseResolution", optionId: `141018>${sam}` });
    const done = expectOk(reduce(ended, { type: "ChooseResolution", optionId: `141018>${sam}` }, ctx)).state;
    const after = applyResolution(log, done.scenarioId, done, cards);
    expect(after.completed).toEqual(["a-shadow-of-the-past", "a-knife-in-the-dark"]);
    expect(after.campaignPool).toContainEqual({ code: "141018", back: "player", burdenSet: null, attachedTo: SAM, seat: 0 });
    expect(after.earned["a-knife-in-the-dark"]).toEqual(["141018"]);
    const path = campaignPath(campaign, {}, after);
    expect(path.map((node) => node.status)).toEqual(["completed", "completed", "current", "locked", "locked", "locked"]);
    expect(campaign.scenarios[2]).toBe("flight-to-the-ford");
    // Scenario 3's checklist puts the boon back on Sam in step 5.
    const third = checklist({ log: after, scenario: loadScenario("flight-to-the-ford"), seats: [{ heroes: [FRODO, SAM], deck: DECK }], effects: EFFECTS, cards });
    expect(third.ok).toBe(true);
    if (third.ok) expect(third.seats[0]?.attachments).toContainEqual({ host: SAM, code: "141018" });
  });

  it("a loss writes nothing and leaves flight-to-the-ford locked", () => {
    const { log } = wonWith("141078", "141017");
    const { started, ctx } = knifeStart(log, [{ heroes: [FRODO, SAM], deck: STARTER }]);
    const kept = expectOk(reduce(started, { type: "Keep" }, ctx)).state;
    const lost: ScenarioState = { ...kept, lost: true, lossReason: "The One Ring left play", window: null };
    expect(applyResolution(log, lost.scenarioId, lost, cards)).toBe(log);
    expect(campaignPath(campaign, {}, log).map((node) => node.status)).toEqual(["completed", "current", "locked", "locked", "locked", "locked"]);
  });
});
