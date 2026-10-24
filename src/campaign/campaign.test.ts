import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import { scenarioCards } from "../catalog/scenario-data.ts";
import { updateCard, type ScenarioState } from "../rules/state.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import { startScenario, type ReduceContext } from "../rules/reduce.ts";
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
  const extra = await loadPrinted([...scenarioCards(second).map((card) => card.code), ...second.campaignPlaced, MERRY, PIPPIN]);
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
  it("Gandalf's Delay and Mr. Underhill: the burden is shuffled into scenario 2's encounter deck and Underhill stays on his hero", () => {
    const { log } = wonWith("141078", "141017");
    expect(log.completed).toEqual(["a-shadow-of-the-past"]);
    const result = plan(log, [FRODO, SAM]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.steps.every((step) => step.rule === "rr.campaign-setup-checklist")).toBe(true);
    expect(result.poolEncounterCards).toEqual(["141078"]);
    expect(result.seats[0]?.attachments).toEqual([{ host: FRODO, code: "141017" }]);
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

  it("a hero change raises the threat penalty by one, and waiving it needs the campaign card", () => {
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

  it("a fallen hero cannot start", () => {
    const { log } = wonWith("141078", "141017");
    const result = plan({ ...log, fallenHeroesBySeat: [[SAM]] }, [FRODO, SAM]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("fallen hero and cannot start");
  });
});
