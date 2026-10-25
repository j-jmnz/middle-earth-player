import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { scenarioCards } from "../catalog/scenario-data.ts";
import { updateCard, type ScenarioState } from "../rules/state.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/reduce.ts";
import { expectOk } from "../rules/fixture.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";
import { loadPrinted } from "../../scripts/test-catalog.ts";
import { begin, buildTable, FRODO, idsOf, SAM, sceneCards, send, type Table } from "../../scripts/test-scene.ts";

import { checklist, type ChecklistInput } from "./checklist.ts";
import { applyResolution, emptyLog, type CampaignLog } from "./log.ts";
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
    // It is in the encounter deck at the beginning of the game, so its hand sentence counts before the hands are drawn
    // (mec109.setup): 6 less 1. Once the hand is kept, the encounter search puts it in the staging area.
    expect(started.seats[0]?.hand).toHaveLength(5);
    const kept = expectOk(reduce(started, { type: "Keep" }, ctx)).state;
    expect(kept.staging.map((id) => kept.cards[id]?.code)).toContain("141078");
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

  it("refuses a logged hero left out without a trade, and a second trade (ltp.fellowship-of-heroes)", () => {
    const { log } = wonWith("141078", "141017");
    const logged = { ...log, heroesBySeat: [[FRODO, SAM, MERRY]] };
    const dropped = plan(logged, [FRODO, SAM]);
    expect(dropped.ok).toBe(false);
    if (!dropped.ok) expect(dropped.errors.join(" ")).toContain("must start unless traded");
    const twice = plan({ ...log, heroesBySeat: [[FRODO, SAM]] }, [FRODO, MERRY, PIPPIN]);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.errors.join(" ")).toContain("only 1 hero");
    // A fallen hero may be left out.
    const fallen = plan({ ...logged, fallenHeroesBySeat: [[MERRY]] }, [FRODO, SAM]);
    expect(fallen.ok).toBe(true);
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
    // All four were earned: the two nobody chose are in the pool too, and stay with the first player's deck later.
    expect(both.log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining(["142011", "142012", "142013", "142014"]));
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
