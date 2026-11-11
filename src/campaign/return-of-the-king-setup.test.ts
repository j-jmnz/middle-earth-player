import { beforeAll, describe, expect, it } from "vitest";

import { EFFECTS } from "../effects/index.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import { loadPrinted } from "../../test/harness/catalog.ts";
import { loadScenario } from "../../scripts/data/load-scenarios.ts";

import { checklist, type ChecklistPlan } from "./checklist.ts";
import { emptyLog, poolCard, type CampaignLog, type PoolCard } from "./log.ts";
import { AFTER_HAND } from "../rules/setup/setup.ts";

// Rules: mec113.setup-the-passing-of-the-grey-company, mec113.setup-the-siege-of-gondor, mec113.setup-the-black-gate-opens, rr.campaign-setup-checklist, rr.burdens (data/rules/entries.json). The Setup lines of The Return
// of the King's campaign cards that deal cards (145066:A:1, 145070:A:1, 146074:A:1), read from their real records: the +1 a hero change costs, the search of the first player's deck for Andúril at the cost of
// each player's threat, and the burdens of five earlier sets left out of the encounter deck.
const GLORFINDEL = "01011";
const BERAVOR = "01012";
const ANDURIL = "142014";
const SHADOW_BURDEN = "141078";
const VOICE = "143068";
const EYE = "144015";
const CARDS = [GLORFINDEL, BERAVOR, "145001", "146002", ANDURIL, SHADOW_BURDEN, VOICE, EYE];

let cards: ReadonlyMap<string, PrintedCard>;
beforeAll(async () => {
  cards = await loadPrinted(CARDS);
});

const pooled = (code: string, seat: number | null = 0, afterHand = false): PoolCard => poolCard(cards.get(code) as PrintedCard, code, null, seat, false, afterHand ? { afterHand: true } : undefined);
const log = (pool: readonly PoolCard[] = [], extra: Partial<CampaignLog> = {}): CampaignLog => ({ ...emptyLog(1), campaignPool: pool, ...extra });
const plan = (scenario: string, saved: CampaignLog, deck: readonly string[], choices?: readonly string[], seats = 1): ChecklistPlan =>
  checklist({ log: saved, scenario: loadScenario(scenario), seats: Array.from({ length: seats }, (_, index) => ({ heroes: [index === 0 ? GLORFINDEL : BERAVOR], deck: [...deck] })), effects: EFFECTS, cards, ...(choices ? { choices } : {}) });
const ok = (result: ChecklistPlan): Extract<ChecklistPlan, { ok: true }> => {
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result;
};

describe("the Andúril search of 145066, 145070 and 146074 (the first player may raise each player's threat by 1)", () => {
  for (const scenario of ["the-passing-of-the-grey-company", "the-siege-of-gondor", "the-black-gate-opens"]) {
    it(`asks the first player alone, with the cost in the note, in ${scenario}`, () => {
      const asked = plan(scenario, log(), ["d1", ANDURIL], undefined, 2);
      expect(asked).toMatchObject({ ok: false, needs: { seat: 0, options: [ANDURIL, "skip"] } });
      expect(asked.ok ? "" : (asked.needs?.note ?? "")).toContain("Raise each player's threat by 1");
    });
  }

  it("takes the card out of the deck into the hand after the mulligan and raises every seat's starting threat by 1 for this game only", () => {
    const made = ok(plan("the-passing-of-the-grey-company", log(), ["d1", ANDURIL], [ANDURIL], 2));
    expect(made.seats[0]?.deck).toEqual(["d1"]);
    expect(made.seats[0]?.afterMulligan).toEqual([ANDURIL]);
    expect(made.seats.map((seat) => seat.threatPenalty)).toEqual([1, 1]);
    // The search is not a permanent penalty and the second player's deck is not searched.
    expect(made.threatModifier).toBe(0);
    expect(made.log.threatPenalty).toBe(0);
    expect(made.seats[1]?.deck).toEqual(["d1", ANDURIL]);
    expect(made.steps.find((step) => step.n === 6)?.did).toEqual(expect.arrayContaining(["Each player's threat is raised by 1 for this game.", "Seat 1 searches their deck for Andúril and adds it to their hand after the mulligan."]));
  });

  it("changes nothing when the first player skips", () => {
    const made = ok(plan("the-siege-of-gondor", log(), ["d1", ANDURIL], ["skip"], 2));
    expect(made.seats[0]?.deck).toEqual(["d1", ANDURIL]);
    expect(made.seats[0]?.afterMulligan).toEqual([]);
    expect(made.seats.map((seat) => seat.threatPenalty)).toEqual([undefined, undefined]);
    expect(made.steps.find((step) => step.n === 6)?.did).toContain("The first player does not search for Andúril.");
  });

  it("asks nothing when the first player's deck holds no copy and the pool has none to shuffle in", () => {
    const made = ok(plan("the-passing-of-the-grey-company", log(), ["d1"]));
    expect(made.seats[0]?.afterMulligan).toEqual([]);
  });

  it("finds a copy the pool would shuffle into the deck at step 7, and then does not shuffle it in", () => {
    const made = ok(plan("the-black-gate-opens", log([pooled(ANDURIL)]), ["d1"], [ANDURIL]));
    expect(made.seats[0]?.afterMulligan).toEqual([ANDURIL]);
    expect(made.seats[0]?.deck).toEqual(["d1"]);
    expect(made.log.campaignPool.map((card) => card.code)).toEqual([ANDURIL]);
    // Not taken, the copy is shuffled in as any boon of the pool.
    const skipped = ok(plan("the-black-gate-opens", log([pooled(ANDURIL)]), ["d1"], ["skip"]));
    expect(skipped.seats[0]?.deck).toEqual(["d1", ANDURIL]);
  });

  it("refuses an answer that is not the card or a skip", () => {
    const refused = plan("the-passing-of-the-grey-company", log(), ["d1", ANDURIL], ["resources"]);
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok ? [] : refused.errors.join(" ")).toContain("resources is not one of");
  });
});

describe("the burden sets the five card Setups leave out of the encounter deck", () => {
  const pool = () => [pooled(SHADOW_BURDEN), pooled(VOICE), pooled(EYE, 0, true)];

  it("leave out an encounter burden of A Shadow of the Past and deal the burdens of the sets they do not name", () => {
    for (const scenario of ["the-passing-of-the-grey-company", "the-siege-of-gondor", "the-black-gate-opens"]) {
      const made = ok(plan(scenario, log(pool()), ["d1"], ["skip"]));
      expect(made.poolEncounterCards, scenario).toEqual([VOICE]);
      expect(made.log.campaignPool, scenario).toHaveLength(3);
      expect(made.steps.find((step) => step.n === 8)?.did, scenario).toContain("Gandalf's Delay stays in the pool: its burden set is removed from the decks this scenario.");
      // The line says "from the encounter deck": a burden that functions like a player card (The Searching Eye) is shuffled into its player's deck after the hand.
      expect(made.seats[0]?.afterMulligan, scenario).toEqual([`${AFTER_HAND}${EYE}`]);
    }
  });
});

describe("the hero change of 145066 and 146074", () => {
  const changed = (scenario: string) => ok(checklist({ log: { ...log(), heroesBySeat: [[BERAVOR]] }, scenario: loadScenario(scenario), seats: [{ heroes: [GLORFINDEL], deck: [] }], effects: EFFECTS, cards, choices: ["skip"] }));

  it("costs no +1 threat penalty where the card waives it, and +1 on the Siege of Gondor's, which does not", () => {
    expect(changed("the-passing-of-the-grey-company").threatModifier).toBe(0);
    expect(changed("the-black-gate-opens").threatModifier).toBe(0);
    expect(changed("the-siege-of-gondor").threatModifier).toBe(1);
  });
});
