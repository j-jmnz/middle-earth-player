import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../catalog/boundary.ts";
import { encounterCodes } from "../catalog/scenario-data.ts";
import { EFFECTS } from "../effects/index.ts";
import type { PrintedCard } from "../rules/core/printed.ts";
import type { CampaignFacts } from "../rules/core/campaign-state.ts";
import { reduce, startScenario, type ReduceContext } from "../rules/engine/reduce.ts";
import { expectOk } from "../rules/core/test-fixture.ts";
import { mirkwoodLoadout, mirkwoodWorld } from "../../test/scenarios/passage-through-mirkwood/game.ts";
import { campaign, passage } from "../../test/scenarios/passage-through-mirkwood/scene.ts";

import { checklist, type ChecklistPlan } from "./checklist.ts";
import { emptyLog, type CampaignLog } from "./log.ts";
import { buildStart } from "./start.ts";
import { wilderlandFacts, WILDERLAND_CAMPAIGN } from "./wilderland.ts";

// Rules: emce.campaign-pool-encounter, emce.boon-allies, emce.treasure, rr.campaign-setup-checklist, rr.search (data/rules/entries.json). What the Campaign Log's Ered Mithrin columns do to a
// real deal: the pool's encounter cards shuffled into every encounter deck, the cards a campaign card's Setup searches out when a line is logged, and a Setup line that counts the treasures. No
// Ered Mithrin scenario is playable yet, so the deal is played on Passage Through Mirkwood's table with synthetic campaign card records: the deal does not depend on the scenario.
let cards: Map<string, PrintedCard>;
let ctx: ReduceContext;
let treacheries: string[];
let enemies: string[];

const record = (...instructions: Instruction[]): Effect => ({ id: "01129:campaignSetup:wilderland", cardCode: passage.campaignCard, lines: ["01129:A:1"], timing: "campaignSetup", instructions });

beforeAll(async () => {
  const world = await mirkwoodWorld("strong");
  cards = new Map(world.cards);
  ctx = { effects: EFFECTS, cards };
  const types = (type: PrintedCard["type"]) => [...new Set(encounterCodes(passage))].filter((code) => cards.get(code)?.type === type);
  treacheries = types("treachery");
  enemies = types("enemy");
}, 120_000);

const logWith = (extra: Partial<CampaignLog>): CampaignLog => ({ ...emptyLog(1), ...extra });
const copiesIn = (deck: readonly string[], code: string) => deck.filter((item) => item === code).length;

function plan(log: CampaignLog, setup: readonly Effect[] = [], choices: readonly string[] = []): ChecklistPlan {
  return checklist({ log, scenario: passage, seats: mirkwoodLoadout(1), effects: [...EFFECTS, ...setup], cards, choices });
}

function ok(result: ChecklistPlan): Extract<ChecklistPlan, { ok: true }> {
  if (!result.ok) throw new Error(`${result.errors.join("; ")} ${JSON.stringify(result.needs)}`);
  return result;
}

// The deal the briefing makes, up to the encounter deck the game starts with.
function deckOf(log: CampaignLog, setup: readonly Effect[] = [], choices: readonly string[] = [], facts?: CampaignFacts): readonly string[] {
  const effects = [...EFFECTS, ...setup];
  const made = ok(plan(log, setup, choices));
  const start = buildStart({ campaign, scenario: passage, seatCount: 1, seed: 3, threatModifier: made.threatModifier, seats: made.seats, effects, poolEncounterCards: made.poolEncounterCards, poolIntoPlay: made.poolIntoPlay, removedFromEncounter: made.removedFromEncounter, ...(facts ? { facts } : {}) });
  return start.encounterDeck;
}

describe("the pool's encounter cards (emce.campaign-pool-encounter)", () => {
  it("shuffles the noted copies of each card into the encounter deck, whatever its set", () => {
    const base = deckOf(emptyLog(1));
    const [wolf = ""] = enemies;
    const [trick = ""] = treacheries;
    const log = logWith({ encounterPool: { [wolf]: 2, [trick]: 1 } });
    const made = ok(plan(log));
    expect(made.poolEncounterCards.slice().sort()).toEqual([wolf, wolf, trick].sort());
    const deck = deckOf(log);
    expect(deck).toHaveLength(base.length + 3);
    expect(copiesIn(deck, wolf)).toBe(copiesIn(base, wolf) + 2);
    expect(copiesIn(deck, trick)).toBe(copiesIn(base, trick) + 1);
    const step = made.steps.find((item) => item.n === 8);
    expect(step?.did.join(" ")).toContain("2 copies of");
  });

  it("starts a game of a log with none exactly as before", () => {
    const made = ok(plan(emptyLog(1)));
    expect(made.poolEncounterCards).toEqual([]);
    expect(made.removedFromEncounter).toEqual([]);
    expect(deckOf(emptyLog(1))).toEqual(deckOf(logWith({ encounterPool: {} })));
  });

  it("reaches the engine's game: the started encounter deck holds the cards", () => {
    const [wolf = ""] = enemies;
    const log = logWith({ encounterPool: { [wolf]: 2 } });
    const made = ok(plan(log));
    const start = buildStart({ campaign, scenario: passage, seatCount: 1, seed: 3, threatModifier: 0, seats: made.seats, effects: EFFECTS, poolEncounterCards: made.poolEncounterCards, removedFromEncounter: made.removedFromEncounter });
    const played = (from: typeof start) => {
      let state = startScenario(from, ctx);
      while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
      return state;
    };
    const base = played(buildStart({ campaign, scenario: passage, seatCount: 1, seed: 3, threatModifier: 0, seats: made.seats, effects: EFFECTS }));
    const wolves = (s: ReturnType<typeof played>) => Object.values(s.cards).filter((card) => card.code === wolf).length;
    expect(wolves(played(start))).toBe(wolves(base) + 2);
  });

  it("holds no copy in a standalone game", () => {
    const [wolf = ""] = enemies;
    const made = ok(plan(logWith({ encounterPool: { [wolf]: 2 } })));
    const standalone = buildStart({ campaign, scenario: passage, seatCount: 1, seed: 3, threatModifier: 0, seats: made.seats, effects: EFFECTS, mode: "standalone" });
    expect(copiesIn(standalone.encounterDeck, wolf)).toBe(copiesIn(deckOf(emptyLog(1)), wolf));
  });
});

describe("the pool the game reads (emce.campaign-pool-encounter)", () => {
  it("includes a card the campaign card's Setup adds, so a Resolution may offer it for removal", () => {
    const [trick = ""] = treacheries;
    const made = ok(plan(emptyLog(1), [record({ verb: "AddToPool", code: trick })]));
    expect(emptyLog(1).campaignPool).toEqual([]);
    expect(wilderlandFacts(made.log, WILDERLAND_CAMPAIGN).pool).toEqual([{ code: trick, seat: null }]);
  });
});

describe("RemoveFromEncounterDeckIfLogged (emce.boon-allies)", () => {
  const search = (count: number, extra: Partial<Extract<Instruction, { verb: "RemoveFromEncounterDeckIfLogged" }>> = {}) =>
    record({ verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count, cardType: "treachery", ...extra });

  it("does nothing while the line is not in the log", () => {
    const made = ok(plan(emptyLog(1), [search(2)]));
    expect(made.removedFromEncounter).toEqual([]);
  });

  it("asks the first player for each card, one title at a time, when the line is logged", () => {
    const log = logWith({ allyLines: ["turayn"] });
    const asked = plan(log, [search(2)]);
    if (asked.ok) throw new Error("expected a choice");
    expect(asked.needs).toMatchObject({ seat: 0 });
    expect(asked.needs?.options.every((code) => cards.get(code)?.type === "treachery")).toBe(true);
    expect(new Set(asked.needs?.options).size).toBe(asked.needs?.options.length);
    expect(asked.needs?.note).toContain("Turayn has taken an oath of vigilance");
    expect(asked.needs?.note).toContain("Card 1 of 2");
    const [first = "", second = ""] = treacheries;
    const next = plan(log, [search(2)], [first]);
    if (next.ok) throw new Error("expected a second choice");
    expect(next.needs?.note).toContain("Card 2 of 2");
    const base = deckOf(emptyLog(1));
    const deck = deckOf(log, [search(2)], [first, second]);
    expect(deck).toHaveLength(base.length - 2);
    expect(copiesIn(deck, first)).toBe(copiesIn(base, first) - 1 - (first === second ? 1 : 0));
    expect(ok(plan(log, [search(2)], [first, second])).steps.find((step) => step.n === 6)?.did.join(" ")).toContain("removes");
  });

  it("refuses an answer that is not a card of the deck of that type", () => {
    const wrong = plan(logWith({ allyLines: ["turayn"] }), [search(1)], [enemies[0] ?? ""]);
    if (wrong.ok) throw new Error("expected a refusal");
    expect(wrong.errors.join(" ")).toContain("is not one of");
  });

  it("removes only as many as the deck holds", () => {
    const log = logWith({ allyLines: ["turayn"] });
    const total = encounterCodes(passage).filter((code) => cards.get(code)?.type === "treachery").length;
    const answers = encounterCodes(passage).filter((code) => cards.get(code)?.type === "treachery");
    const made = ok(plan(log, [search(total + 3)], answers));
    expect(made.removedFromEncounter).toHaveLength(total);
  });

  it("leaves out a unique card or a named title when the line says so, and counts the pool's cards among those it searches", () => {
    const [wolf = ""] = enemies;
    const log = logWith({ allyLines: ["turayn"], encounterPool: { [wolf]: 1 } });
    const named = cards.get(wolf)?.name ?? "";
    const asked = plan(log, [record({ verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count: 1, cardType: "enemy", except: [named] })]);
    if (asked.ok) throw new Error("expected a choice");
    expect(asked.needs?.options).not.toContain(wolf);
    const nonUnique = plan(log, [record({ verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count: 1, cardType: "enemy", nonUnique: true })]);
    if (nonUnique.ok) throw new Error("expected a choice");
    expect(nonUnique.needs?.options.every((code) => cards.get(code)?.isUnique === false)).toBe(true);
    expect(nonUnique.needs?.options).toContain(wolf);
  });
});

describe("the deck a Setup search looks through is the deck the deal builds", () => {
  const search = record({ verb: "RemoveFromEncounterDeckIfLogged", line: "turayn", count: 99, cardType: "treachery" });
  const logged = logWith({ allyLines: ["turayn"] });

  // The cards the search finds in the deck, as the note "Card 1 of N" counts them.
  function found(log: CampaignLog): number {
    const asked = plan(log, [search]);
    if (asked.ok) throw new Error("expected a choice");
    return Number(/Card 1 of (\d+)/.exec(asked.needs?.note ?? "")?.[1]);
  }

  it("holds the pool's encounter-backed cards the deal shuffles in, and not one that goes to a player's deck", () => {
    const [trick = ""] = treacheries;
    const base = found(logged);
    const card = { code: trick, back: "encounter", burdenSet: null, attachedTo: null, seat: 0 } as const;
    expect(found({ ...logged, campaignPool: [card] })).toBe(base + 1);
    expect(found({ ...logged, campaignPool: [{ ...card, afterHand: true }] })).toBe(base);
    expect(found({ ...logged, encounterPool: { [trick]: 2 } })).toBe(base + 2);
  });
});

describe("a Setup line that counts the treasures in the log (emce.treasure; 12193:A)", () => {
  const shuffle = record({ verb: "ShuffleIntoEncounterDeck", code: "01135", when: { kind: "treasuresLogged", min: 6 } });
  const six = ["t1", "t2", "t3", "t4", "t5", "t6"];

  it("shuffles the card in with 6 or more treasures recorded, and not with fewer", () => {
    const base = deckOf(emptyLog(1));
    expect(deckOf(logWith({ treasures: six }), [shuffle], [], { prisoner: null, usedOnce: [], counters: {}, ...wilderlandFacts(logWith({ treasures: six }), WILDERLAND_CAMPAIGN) })).toHaveLength(base.length + 1);
    const five = logWith({ treasures: six.slice(1) });
    expect(deckOf(five, [shuffle], [], { prisoner: null, usedOnce: [], counters: {}, ...wilderlandFacts(five, WILDERLAND_CAMPAIGN) })).toHaveLength(base.length);
  });

  it("shuffles it in as it always did when the line has no condition", () => {
    const plain = record({ verb: "ShuffleIntoEncounterDeck", code: "01135" });
    expect(deckOf(emptyLog(1), [plain])).toHaveLength(deckOf(emptyLog(1)).length + 1);
  });
});

describe("the facts a started game holds", () => {
  it("reach the game's state for the Ered Mithrin campaign only", () => {
    const log = logWith({ treasures: ["t1"], allyLines: ["isolde"], encounterPool: { [enemies[0] ?? ""]: 1 } });
    const start = (id: string) => buildStart({ campaign, scenario: passage, seatCount: 1, seed: 3, threatModifier: 0, seats: ok(plan(log)).seats, effects: EFFECTS, facts: { prisoner: null, usedOnce: [], counters: {}, ...wilderlandFacts(log, id) } });
    expect(start(WILDERLAND_CAMPAIGN).facts).toMatchObject({ treasures: ["t1"], allyLines: ["isolde"], encounterPool: log.encounterPool });
    expect(startScenario(start(WILDERLAND_CAMPAIGN), ctx).campaignFacts?.allyLines).toEqual(["isolde"]);
    expect(start("mirkwood-paths").facts).toBeUndefined();
  });
});
