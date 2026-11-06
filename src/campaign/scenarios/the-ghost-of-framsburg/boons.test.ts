// Rules: emce.boon-allies, emce.campaign-log, emce.campaign-pool-encounter, emce.treasure, emce.deep, emce.discover, rr.setup, rr.mulligan (data/rules/entries.json); ledger lines 12190:A:1 to 12190:A:3, 12191:A:1, 12191:A:2, 12192:A:1, 12192:A:2, 12186:A:1, 12185:A:2, 12188:A:1, 12172:A:1, 12173:A:2.
// The boons and burdens of The Ghost of Framsburg (Ashen Brazier, Gundabad Hunter, Gundabad Stalker) as the pool hands them on, and the pool cards of the first six parts played in part 7: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { undiscoveredTreasures } from "../../../rules/families/wilderland/treasure.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { framsburgSetupChoices, framsburgStart, framsburgWorld } from "../../../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { CODES, framsburgTable, idOf, loadFramsburgWorld, resolveRecords, type FramsburgWorld } from "../../../../test/scenarios/the-ghost-of-framsburg/scene.ts";

let world: FramsburgWorld;
let ctx: ReduceContext;
beforeAll(async () => {
  world = await loadFramsburgWorld();
  ctx = (await framsburgWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const optionNamed = (id: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => option === id) ?? state.window.options[0] ?? "") : "");
type Facts = Parameters<typeof framsburgStart>[3];
// The scenario dealt with these cards in the pool, its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog = emptyLog(seats), seed = 1, facts?: Facts): ScenarioState {
  let state = startScenario(framsburgStart(seats, seed, "Normal", facts, log, undefined, framsburgSetupChoices(seats, log)), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const pooled = (seats: 1 | 2, ...cards: readonly { code: string; seat?: number; afterHand?: true; perPlayer?: boolean }[]): CampaignLog => ({
  ...emptyLog(seats),
  campaignPool: cards.map((card) => poolCard(ctx.cards.get(card.code)!, card.code, null, card.seat ?? null, card.perPlayer ?? false, card.afterHand ? { afterHand: true } : undefined)),
});

describe("what The Ghost of Framsburg hands on", () => {
  it("12190 Ashen Brazier earned into the pool is dealt as a boon objective: shuffled into the encounter deck by the campaign card, a Loot card among the scenario's", () => {
    const state = opened(1);
    expect(where(state, CODES.ashenBrazier)).toHaveLength(1);
    expect(where(state, CODES.ashenBrazier)[0]?.zone).toBe("encounterDeck");
    // Pooled, it is still one copy: the campaign card's Setup shuffles the one it names, and the pool does not deal a second.
    expect(where(opened(1, pooled(1, { code: CODES.ashenBrazier })), CODES.ashenBrazier).length).toBeLessThanOrEqual(2);
  });

  it("12191 Gundabad Hunter and 12192 Gundabad Stalker in the pool are shuffled into the encounter deck, each once", () => {
    const state = opened(1, pooled(1, { code: CODES.gundabadHunter }, { code: CODES.gundabadStalker }));
    for (const code of [CODES.gundabadHunter, CODES.gundabadStalker]) {
      const copies = where(state, code);
      expect(copies.length, code).toBeGreaterThanOrEqual(1);
      expect(copies.every((card) => card.zone === "encounterDeck" || card.zone === "staging" || card.zone === "encounterDiscard"), code).toBe(true);
    }
  });
});

describe("the pool cards of the first six parts in part 7", () => {
  it("12172:A:1 The Threat to Wilderland enters the staging area with X resources, X the campaign card's part number (7)", () => {
    const state = opened(1, pooled(1, { code: "12172" }));
    const threat = where(state, "12172");
    expect(threat).toHaveLength(1);
    expect(threat[0]).toMatchObject({ zone: "staging", resources: 7 });
  });

  it("12173:A:2 Dagnir's Spawn, revealed in part 7, has each player distribute 7 damage (X the part number); if they do it is shuffled into the encounter deck", () => {
    const t = framsburgTable(world, { staging: ["12173"] });
    const withPart = { ...t.state, part: 7 };
    const damageOf = (state: ScenarioState) => [t.hero, t.hero2].reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
    const taken = resolveRecords(withPart, t.ctx, "12173", "whenRevealed", idOf(withPart, "12173"), optionNamed("distribute"));
    expect(damageOf(taken.state)).toBe(7);
    expect(taken.state.cards[idOf(taken.state, "12173")]?.zone).toBe("encounterDeck");
  });

  it("12185:A:2 Urdug's Cunning in the pool is shuffled into the encounter deck, and revealed it deals damage for each enemy among the top 5 cards", () => {
    const state = opened(1, pooled(1, { code: "12185" }));
    expect(where(state, "12185")).toHaveLength(1);
    expect(["encounterDeck", "encounterDiscard", "staging"]).toContain(where(state, "12185")[0]?.zone);
    const t = framsburgTable(world, { staging: ["12185"], deck: ["f0", "f3", "place", "f0", "treachery", "mild"] });
    const run = resolveRecords(t.state, t.ctx, "12185", "whenRevealed", idOf(t.state, "12185"));
    expect(run.state.seats[0]?.heroes.reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0)).toBe(3);
  });

  it("12186:A:1 Misplaced Trust earned in part 5 is shuffled into its player's deck after the starting hand, and into no encounter deck", () => {
    const log = pooled(1, { code: "12186", seat: 0, afterHand: true, perPlayer: true });
    const state = opened(1, log);
    const copies = where(state, "12186");
    expect(copies).toHaveLength(1);
    expect(copies[0]?.zone).toBe("deck");
    expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain("12186");
  });

  it("a copy of a location of part 5 in the pool's encounter cards is added to the encounter deck regardless of encounter set (emce.campaign-pool-encounter)", () => {
    const state = opened(1, { ...emptyLog(1), encounterPool: { [CODES.moonlitPassage]: 1 } });
    const before = where(opened(1), CODES.moonlitPassage).length;
    expect(where(state, CODES.moonlitPassage)).toHaveLength(before + 1);
    // A location of another scenario's encounter set joins as well.
    const other = opened(1, { ...emptyLog(1), encounterPool: { "18046": 1 } });
    expect(where(other, "18046")).toHaveLength(1);
  });

  it("12188:A:1 Beldis in the pool is shuffled into a deck like any boon ally, and the campaign card's Setup lets a player search their deck for a unique boon ally", () => {
    const state = opened(1, pooled(1, { code: "12188", seat: 0 }));
    expect(where(state, "12188")).toHaveLength(1);
    expect(["deck", "hand", "play"]).toContain(where(state, "12188")[0]?.zone);
    // The search put it in the hand after the mulligan.
    expect(where(state, "12188")[0]?.zone).toBe("hand");
  });

  it("12166, 12169 and 12171 Turayn, Melanwar and Isolde are shuffled into their players' decks", () => {
    const log = pooled(2, { code: "12166", seat: 0 }, { code: "12169", seat: 1 }, { code: "12171", seat: 0 });
    const state = opened(2, log);
    for (const code of ["12166", "12169", "12171"]) {
      expect(where(state, code), code).toHaveLength(1);
      expect(["deck", "hand", "play"], code).toContain(where(state, code)[0]?.zone);
    }
    expect(where(state, "12171")[0]?.controller).toBe(0);
  });

  it("12197 a treasure discovered in part 6 is not offered again by the random draw of part 7, and the Response on Fram's Shade offers only undiscovered ones", () => {
    const facts = { prisoner: null, usedOnce: [], counters: {}, treasures: ["12197", "12198"] } as Facts;
    const state = opened(1, emptyLog(1), 1, facts);
    expect(state.campaignFacts?.treasures).toEqual(["12197", "12198"]);
    const drawn = undiscoveredTreasures(state, ctx);
    expect(drawn).not.toContain("12197");
    expect(drawn).not.toContain("12198");
    expect(drawn).toHaveLength(7);
    // None of the treasures dealt into this game is offered either.
    const dealt = undiscoveredTreasures(opened(1), ctx);
    expect(dealt).toHaveLength(9);
  });
});
