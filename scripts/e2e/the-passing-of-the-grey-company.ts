// The Maestro fixtures of The Passing of the Grey Company (the-return-of-the-king part 1), written into src/campaign/fixtures/the-passing-of-the-grey-company.json by scripts/e2e/fixtures.ts: real games of saved decklists (the Defenders of
// Gondor and Swords of the Noldor lists of data/prebuilt-decks.json, `FIXTURE_DECKS`), two-handed, Easy, so each is a real save. `company-won` is the first seed that wins, parked on the win (the Resolution waits); `company-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The Campaign Setup asks nothing a policy answers (the first player may raise each player's threat by 1 to search for Andúril: a fresh log's checklist takes the first option) and the Resolution asks nothing (each Overcome by Fear on a dial and the Army of
// the Dead boon join the pool). The decklists are played with the scenario's golden policy (test/scenarios/the-passing-of-the-grey-company/game.ts: all but the last character of a seat quest, every choice takes the first safe answer) with card play on.
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { COMPANY_POLICY, DEFAULT_POLICY, companyIntent } from "../../test/scenarios/the-passing-of-the-grey-company/game.ts";
import { createLog } from "../log.ts";
import { firstSeed } from "./seed-kit.ts";

const say = createLog("e2e-company");

export type CompanyFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[] };
export type CompanyFixtureName = "company-won" | "company-lost";

export async function companyFixtures(): Promise<Partial<Record<CompanyFixtureName, CompanyFixture>>> {
  const find = (wanted: (state: ScenarioState) => boolean, label: string): CompanyFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => companyIntent(state, ctx, memory, DEFAULT_POLICY, { ...COMPANY_POLICY, play: true, act: true });
    return firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-passing-of-the-grey-company", seatCount: 2, answer }, "COMPANY_SEEDS", wanted, label);
  };
  const won = find((state) => state.stageCleared && !state.lost, "company-won");
  const lost = find((state) => state.lost, "company-lost");
  return { ...(won ? { "company-won": won } : {}), ...(lost ? { "company-lost": lost } : {}) };
}
