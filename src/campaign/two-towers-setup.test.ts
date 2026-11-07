import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { startScenario } from "../rules/engine/reduce.ts";
import { AFTER_HAND } from "../rules/setup/setup.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadWorld } from "../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { loadCampaign, loadScenario } from "../../scripts/data/load-scenarios.ts";

import { checklist, type ChecklistPlan } from "./checklist.ts";
import { emptyLog, poolCard, type CampaignLog, type PoolCard } from "./log.ts";
import { buildStart } from "./start.ts";

// Rules: mec112.setup-the-uruk-hai, mec112.setup-the-passage-of-the-marshes, mec112.setup-journey-to-the-cross-roads, rr.campaign-setup-checklist, rr.burdens (data/rules/entries.json). The Setup lines of The Two Towers'
// campaign cards, dealt by the Campaign Setup Checklist from their real records: cards leave the pool, burden sets are left out of the decks, a copy goes into each deck, and a player chooses a copy or a resource.
const FRODO = "141001";
const GLORFINDEL = "01011";
const GILDOR = "141077";
const UNDERHILL = "141017";
const SHADOW_BURDEN = "141078";
const FORD_BURDEN = "141080";
const DARK_BURDEN = "142085";
const COUNSELS = "143021";
const VOICE = "143068";
const BRACE = "144014";
const EYE = "144015";
const CARDS = [FRODO, GLORFINDEL, "01012", GILDOR, UNDERHILL, SHADOW_BURDEN, FORD_BURDEN, DARK_BURDEN, COUNSELS, VOICE, BRACE, EYE];

let cards: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  cards = await loadPrinted(CARDS);
});

const pooled = (code: string, seat: number | null = null, attachedTo: string | null = null, afterHand = false): PoolCard => poolCard(cards.get(code) as PrintedCard, code, attachedTo, seat, false, afterHand ? { afterHand: true } : undefined);
const log = (pool: readonly PoolCard[]): CampaignLog => ({ ...emptyLog(1), campaignPool: pool });
const plan = (scenario: string, saved: CampaignLog, choices?: readonly string[]): ChecklistPlan => checklist({ log: saved, scenario: loadScenario(scenario), seats: [{ heroes: [GLORFINDEL], deck: ["d1"] }], effects: EFFECTS, cards, ...(choices ? { choices } : {}) });
const ok = (result: ChecklistPlan): Extract<ChecklistPlan, { ok: true }> => {
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result;
};

describe("143071 The Uruk-hai Setup", () => {
  const pool = () => [pooled(GILDOR), pooled(UNDERHILL, 0, FRODO), pooled(SHADOW_BURDEN), pooled(FORD_BURDEN), pooled(DARK_BURDEN)];

  it("removes Gildor Inglorion and Mr. Underhill from the pool for good, and the Fellowship burdens of three sets from the encounter deck", () => {
    const made = ok(plan("the-uruk-hai", log(pool())));
    expect(made.log.campaignPool.map((card) => card.code)).toEqual([SHADOW_BURDEN, FORD_BURDEN, DARK_BURDEN]);
    // Only the burden of a set the card does not name is shuffled in; the others stay in the pool.
    expect(made.poolEncounterCards).toEqual([DARK_BURDEN]);
    expect(made.steps.find((step) => step.n === 6)?.did).toContain("Gildor Inglorion is removed from the Campaign Pool.");
    expect(made.steps.find((step) => step.n === 8)?.did).toContain("Gandalf's Delay stays in the pool: its burden set is removed from the decks this scenario.");
  });

  it("deals the same pool the old way where no card of the box is the campaign card", () => {
    const made = ok(plan("a-shadow-of-the-past", log([pooled(SHADOW_BURDEN)])));
    expect(made.poolEncounterCards).toEqual([SHADOW_BURDEN]);
  });
});

describe("144067 The Passage of the Marshes Setup", () => {
  const pool = () => [pooled(COUNSELS, 0, null, true), pooled(VOICE), pooled(EYE, 0, null, true), pooled(SHADOW_BURDEN)];

  it("shuffles a Searching Eye into each deck and leaves the burdens of Helm's Deep and The Road to Isengard out of the encounter deck and the player decks, copies earned for a player's deck included", () => {
    const made = ok(plan("the-passage-of-the-marshes", log(pool())));
    expect(made.seats[0]?.deck).toEqual(["d1", EYE]);
    expect(made.seats[0]?.afterMulligan).toEqual([`${AFTER_HAND}${EYE}`]);
    expect(made.poolEncounterCards).toEqual([SHADOW_BURDEN]);
    expect(made.log.campaignPool).toHaveLength(4);
  });

  it("changing a hero costs no +1 threat penalty (the card waives it)", () => {
    const made = ok(checklist({ log: { ...log([]), heroesBySeat: [["01012"]] }, scenario: loadScenario("the-passage-of-the-marshes"), seats: [{ heroes: [GLORFINDEL], deck: [] }], effects: EFFECTS, cards }));
    expect(made.threatModifier).toBe(0);
  });
});

describe("144069 Journey to the Cross-roads Setup", () => {
  it("asks each player for a copy of Brace of Coneys or a resource on each hero", () => {
    const asked = plan("journey-to-the-cross-roads", log([]));
    expect(asked).toMatchObject({ ok: false, needs: { seat: 0, options: [BRACE, "resources"] } });
  });

  it("a resource is noted for the seat's heroes, a copy goes into its deck and is recorded as chosen at Setup", () => {
    const resource = ok(plan("journey-to-the-cross-roads", log([]), ["resources"]));
    expect(resource.seats[0]).toMatchObject({ resources: 1, deck: ["d1"] });
    const copy = ok(plan("journey-to-the-cross-roads", log([]), [BRACE]));
    expect(copy.seats[0]).toMatchObject({ deck: ["d1", BRACE], chosen: [BRACE] });
    expect(copy.seats[0]?.resources).toBeUndefined();
  });

  it("starts each of the seat's heroes with the extra resources", async () => {
    const world = await loadWorld();
    const start = buildStart({ campaign: loadCampaign(), scenario: loadScenario("a-shadow-of-the-past"), seatCount: 1, seed: 1, threatModifier: 0, seats: [{ heroes: [FRODO, "141002"], deck: [], resources: 1 }], effects: EFFECTS });
    const state = startScenario(start, { effects: EFFECTS, cards: world.cards });
    expect((state.seats[0]?.heroes ?? []).map((id) => state.cards[id]?.resources)).toEqual([1, 1]);
  });
});
