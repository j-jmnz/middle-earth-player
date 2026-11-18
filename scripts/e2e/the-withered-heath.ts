// The fixtures of The Withered Heath (ered-mithrin part 4), written into src/campaign/fixtures/the-withered-heath.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `heath-won` is the first seed that wins, parked on the win (the Resolution waits); `heath-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the first three parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player one question: the boon-ally search (12175:A:2), answered with the first ally the pool offers (Turayn). The log is the two-handed wins of parts 1 to 3 that put the allies in the pool,
// so no line is written and no card is removed. The Resolution asks each player for a Song boon (the first offered) and, with 4 Dragon Signs in the victory display, the first player for a treasure of three: the fixture's win has 3, so the flow answers the two Songs only (the treasure draw is pinned by the golden and the campaign test).
// The decklists are played with the scenario's golden policy (test/scenarios/the-withered-heath/game.ts: a Deep location or Creature Den when one is offered, the enemy guarding a Dragon Sign first, Cold-Drake from the staging
// area, each Accolade boon taken, the first character of a seat quests alone) with card play on and the characters defending as the auto-player has them do.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { KINGSQUEST_GOLDENS, kingsquestWorld, playGolden as playKingsquest } from "../../test/scenarios/the-kings-quest/game.ts";
import { DEFAULT_POLICY, HEATH_POLICY, heathIntent } from "../../test/scenarios/the-withered-heath/game.ts";
import { lostmirkWonLog } from "./the-kings-quest.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-heath");

export type HeathFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type HeathFixtureName = "heath-won" | "heath-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before The King's Quest (scripts/e2e/the-kings-quest.ts), then the The King's Quest golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function kingsquestWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The King's Quest", golden: "two-handed, won, after the earlier parts, a treasure discovered", goldens: KINGSQUEST_GOLDENS, world: kingsquestWorld, play: playKingsquest }, await lostmirkWonLog());
}

export async function heathFixtures(): Promise<Partial<Record<HeathFixtureName, HeathFixture>>> {
  const log = await kingsquestWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): HeathFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => heathIntent(state, ctx, memory, { ...DEFAULT_POLICY, defend: true }, { ...HEATH_POLICY, play: true, act: true });
    // The boon-ally search: the first player takes Turayn, the first ally of the pool (12166, joined to the pool by Journey Up the Anduin).
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-withered-heath", seatCount: 2, log, choices: ["12166"], answer }, "HEATH_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  // The won game has 3 Dragon Signs in the victory display, so the Resolution asks the two Songs (one for each player) and no treasure of three: a test answers exactly those two questions.
  const signs = (state: ScenarioState): number => Object.values(state.cards).filter((card) => card.code === "19012" && card.zone === "victory").length;
  const won = find((state) => state.stageCleared && !state.lost && signs(state) === 3, "heath-won");
  const lost = find((state) => state.lost, "heath-lost");
  return { ...(won ? { "heath-won": won } : {}), ...(lost ? { "heath-lost": lost } : {}) };
}
