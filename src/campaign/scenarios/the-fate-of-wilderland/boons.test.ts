// Rules: emce.boon-allies, emce.campaign-log, emce.campaign-pool-encounter, emce.treasure, rr.setup, rr.mulligan, rr.campaign-setup-checklist (data/rules/entries.json); ledger lines 12195:A:2, 12166:A:1 to 12194:A:2.
// The boons, burdens and treasures the first eight parts leave, played in part 9: the boon allies and the Accolade and Song boons shuffled into their players' decks, the burdens and encounter cards of the pool dealt into the encounter deck, and the treasures a deck holds.
// The log is built by hand here, one card of each kind; the log the real Resolutions of the eight parts write is chained in the goldens' tests.
import { beforeAll, describe, expect, it } from "vitest";

import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { resolutionResult, openResolution } from "../../../rules/setup/resolution.ts";
import { wilderlandSetupChoices, wilderlandStart, wilderlandWorld } from "../../../../test/scenarios/the-fate-of-wilderland/game.ts";
import { STAGES } from "../../../../test/scenarios/the-fate-of-wilderland/scene.ts";
import { FILLER } from "../../../../test/harness/game-kit.ts";

let ctx: ReduceContext;
beforeAll(async () => {
  ctx = (await wilderlandWorld("strong")).ctx;
}, 120_000);

const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);
const pooled = (seats: 1 | 2, ...cards: readonly { code: string; seat?: number }[]): CampaignLog => ({ ...emptyLog(seats), campaignPool: cards.map((card) => poolCard(ctx.cards.get(card.code)!, card.code, null, card.seat ?? null)) });
// The scenario dealt with these cards in the pool, its Setup played to the first round: the mulligan is kept and each question is answered with its first option.
function opened(seats: 1 | 2, log: CampaignLog = emptyLog(seats), seed = 1): ScenarioState {
  let state = startScenario(wilderlandStart(seats, seed, "Normal", undefined, log, undefined, wilderlandSetupChoices(seats, log)), ctx);
  while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, ctx)).state;
  for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, ctx)).state;
  return state;
}
const ALLIES = { turayn: "12166", melanwar: "12169", isolde: "12171", beldis: "12188" } as const;
const ACCOLADES = ["12176", "12177", "12178", "12179"] as const;
const SONGS = ["12180", "12181", "12182", "12183"] as const;
const BURDENS = { misplacedTrust: "12186", urdugSCunning: "12185", growingThreat: "12167", dragonSickness: "12194" } as const;

describe("the boon allies and boons of the first eight parts", () => {
  it("12166, 12169, 12171 and 12188 the boon allies in a player's pool are shuffled into that player's deck", () => {
    const state = opened(2, pooled(2, { code: ALLIES.turayn, seat: 0 }, { code: ALLIES.melanwar, seat: 1 }, { code: ALLIES.isolde, seat: 0 }, { code: ALLIES.beldis, seat: 1 }));
    for (const [code, seat] of [[ALLIES.turayn, 0], [ALLIES.melanwar, 1], [ALLIES.isolde, 0], [ALLIES.beldis, 1]] as const) {
      expect(where(state, code), code).toHaveLength(1);
      const mine = [...(state.seats[seat]?.deck ?? []), ...(state.seats[seat]?.hand ?? [])];
      expect(mine, code).toContain(where(state, code)[0]?.id);
    }
  });

  it("the Accolade and Song boons in the pool are shuffled into their players' decks, and a boon is searched for by the campaign card's Setup", () => {
    const log = pooled(1, ...ACCOLADES.map((code) => ({ code, seat: 0 })), ...SONGS.map((code) => ({ code, seat: 0 })));
    const answers = wilderlandSetupChoices(1, log);
    expect(answers).toHaveLength(1);
    expect([...ACCOLADES, ...SONGS]).toContain(answers[0]);
    const state = opened(1, log);
    for (const code of [...ACCOLADES, ...SONGS]) expect(where(state, code), code).toHaveLength(1);
    expect(where(state, answers[0] ?? "")[0]?.zone).toBe("hand");
  });
});

describe("the burdens and encounter cards of the pool", () => {
  it("12185, 12186, 12191, 12192 and 12194 the pool's encounter cards are dealt into the encounter deck", () => {
    const log = pooled(2, { code: BURDENS.misplacedTrust, seat: 0 }, { code: BURDENS.misplacedTrust, seat: 1 }, { code: BURDENS.urdugSCunning }, { code: "12191" }, { code: "12192" }, { code: BURDENS.dragonSickness }, { code: BURDENS.growingThreat });
    const state = opened(2, log);
    const base = opened(2, emptyLog(2));
    for (const code of ["12185", "12186", "12191", "12192", "12194", "12167"]) expect(where(state, code).length, code).toBeGreaterThan(where(base, code).length);
    expect(where(state, BURDENS.misplacedTrust).length).toBe(2);
  });

  it("the pool is not changed by the win: the Resolution of the last part adds and removes nothing", () => {
    const log = pooled(1, { code: BURDENS.growingThreat }, { code: BURDENS.dragonSickness });
    const state = openResolution({ ...opened(1, log), stageCleared: true, window: null, stack: [] }, ctx);
    const result = resolutionResult(state);
    expect(result?.encounterPool?.[BURDENS.growingThreat]).toBeUndefined();
    expect(result?.encounterPool?.[BURDENS.dragonSickness]).toBeUndefined();
    expect(result?.treasures ?? []).toEqual([]);
  });
});

describe("the treasures of the log", () => {
  it("12197 a treasure in a deck is a player card the Setup may put in the hand, and the stage rules do not touch it", () => {
    const deck = ["12197", ...Array.from({ length: 29 }, () => FILLER)];
    const loadout = [{ heroes: ["q1", "q2", "q3"], deck }];
    const state = startScenario(wilderlandStart(1, 1, "Normal", undefined, emptyLog(1), undefined, ["12197"], loadout), ctx);
    let opening = state;
    while (opening.window?.kind === "mulligan") opening = expectOk(reduce(opening, { type: "Keep" }, ctx)).state;
    expect(where(opening, "12197")[0]?.zone).toBe("hand");
    expect(STAGES).toContain(opening.cards[opening.questStage ?? ""]?.code);
  });
});
