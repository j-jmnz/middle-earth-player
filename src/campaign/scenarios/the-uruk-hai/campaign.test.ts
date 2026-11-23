// Rules: mec112.setup-the-uruk-hai, mec112.campaign-mode, mec112.pursuit, ltp.campaign-setup-checklist, rr.campaign-pool, rr.burdens (data/rules/entries.json).
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { PrintedCard } from "../../../rules/core/printed.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { captivesOf } from "../../../rules/families/captives/values.ts";
import { reduce, startScenario, type ReduceContext, type ScenarioState } from "../../../rules/engine/reduce.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { haiStart, haiWorld } from "../../../../test/scenarios/the-uruk-hai/game.ts";
import { loadCampaign, loadScenario } from "../../../../scripts/data/load-scenarios.ts";

import { checklist } from "../../checklist.ts";
import { campaignPath } from "../../path.ts";
import { PLAYABLE_SCENARIOS } from "../../playable.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";

const campaign = loadCampaign("the-two-towers");
const hai = loadScenario("the-uruk-hai");
let ctx: ReduceContext;
// The pool cards the campaign card's Setup reads: Gildor Inglorion and Mr. Underhill (on Frodo), and a burden of each of A Shadow of the Past, Flight to the Ford, The Ring Goes South and
// Journey in the Dark (a set the card does not name).
const FRODO = "141001";
const GLORFINDEL = "01011";
const GILDOR = "141077";
const UNDERHILL = "141017";
const SHADOW_BURDEN = "141078";
const FORD_BURDEN = "141080";
const SOUTH_BURDEN = "142084";
const DARK_BURDEN = "142085";
let printed: ReadonlyMap<string, PrintedCard>;

beforeAll(async () => {
  ctx = (await haiWorld("strong")).ctx;
  printed = await loadPrinted([FRODO, GLORFINDEL, GILDOR, UNDERHILL, SHADOW_BURDEN, FORD_BURDEN, SOUTH_BURDEN, DARK_BURDEN]);
}, 120_000);

// The scenario dealt and its Setup played to the first round: every question answered with the first option.
function opened(start: ReturnType<typeof haiStart>): ScenarioState {
  let state = startScenario(start, ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}

// The Uruk-hai in the the-two-towers campaign (part 1, campaign card 143071).
describe("The Uruk-hai in the the-two-towers campaign", () => {
  it("is part 1 of the campaign, names its campaign card and the boons it places, and is playable as the first part of a fresh save", () => {
    expect(campaign.scenarios.indexOf(hai.id)).toBe(0);
    expect(hai.campaignCard).toBe("143071");
    expect([...hai.campaignPlaced].sort()).toEqual(["143015", "143016", "143017", "143018", "143019"]);
    expect(PLAYABLE_SCENARIOS).toContain("the-uruk-hai");
    expect(campaignPath(campaign, {}, emptyLog(1))[0]).toMatchObject({ id: "the-uruk-hai", status: "current" });
  });

  it("keeps the campaign card off the table: its Setup and Resolution are all it prints (src/rules/families/burden/campaign.ts)", () => {
    const state = opened(haiStart(1, 1, "Normal"));
    expect(Object.values(state.cards).some((card) => card.code === "143071")).toBe(false);
  });

  it("takes the Captive the Campaign Log names for a seat without asking, and lets a seat the log names none for choose its own (user ruling, docs/brief.md)", () => {
    // Seat 0's log names q2; seat 1 names none and is asked (the first option, its first non-Fellowship hero).
    const facts = { prisoner: null, usedOnce: [], counters: {}, heroLog: { heroes: [], fallen: [], fellowship: [], captives: [{ seat: 0, hero: "q2" }] } };
    const state = opened(haiStart(2, 2, "Normal", facts));
    const captives = captivesOf(state);
    expect(captives.map((card) => [card.owner, card.code]).sort()).toEqual([[0, "q2"], [1, "q4"]]);
    expect(state.pursuit).toBe(10);
  });
});

// "Setup: Remove Gildor Inglorion and Mr. Underhill from the Campaign Pool. Remove each burden with the following burden set icons from the encounter deck: A Shadow of the Past, Flight to the Ford, The Ring Goes South"
describe("The Uruk-hai campaign card's Setup (143071:A:2)", () => {
  const pooled = (code: string, seat: number | null = null, attachedTo: string | null = null) => poolCard(printed.get(code) as PrintedCard, code, attachedTo, seat, false);
  const saved = (): CampaignLog => ({ ...emptyLog(1), campaignPool: [pooled(GILDOR), pooled(UNDERHILL, 0, FRODO), pooled(SHADOW_BURDEN), pooled(FORD_BURDEN), pooled(SOUTH_BURDEN), pooled(DARK_BURDEN)] });
  const plan = (effects: readonly Effect[]) => {
    const made = checklist({ log: saved(), scenario: hai, seats: [{ heroes: [GLORFINDEL], deck: ["d1"] }], effects, cards: printed });
    if (!made.ok) throw new Error(made.errors.join("; "));
    return made;
  };

  lineSpec("143071:A:2", "removes Gildor Inglorion and Mr. Underhill from the Campaign Pool", (effects) => {
    const pool = plan(effects).log.campaignPool.map((card) => card.code);
    expect(pool).not.toContain(GILDOR);
    expect(pool).not.toContain(UNDERHILL);
  });

  lineSpec("143071:A:2", "leaves the burdens of the three sets out of the encounter deck, in the pool, and deals the burden of another set", (effects) => {
    const made = plan(effects);
    expect(made.poolEncounterCards).toEqual([DARK_BURDEN]);
    expect(made.log.campaignPool.map((card) => card.code)).toEqual(expect.arrayContaining([SHADOW_BURDEN, FORD_BURDEN, SOUTH_BURDEN, DARK_BURDEN]));
  });
});
