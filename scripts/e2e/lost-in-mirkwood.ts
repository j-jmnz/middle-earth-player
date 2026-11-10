// The Maestro fixtures of Lost in Mirkwood (ered-mithrin part 2), written into src/campaign/fixtures/lost-in-mirkwood.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `lostmirk-won` is the first seed that wins, parked on the win (the Resolution waits); `lostmirk-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player whether to search the encounter deck for Twilight Hall (the policy searches) and, once the treasure it guards is free, which character carries it; the Resolution asks the first player whether
// Melanwar joins the pool, and the flow takes the first option. The decklists are played with the scenario's golden policy (test/scenarios/lost-in-mirkwood/game.ts: nobody engages but the nemesis, every character attacks alone, the
// players travel to the Objective-Locations that end on Escape from Taur-nu-fuin) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { UPANDUIN_GOLDENS, upanduinWorld, playGolden as playUpanduin } from "../../test/scenarios/journey-up-the-anduin/game.ts";
import { LOSTMIRK_POLICY, lostmirkIntent } from "../../test/scenarios/lost-in-mirkwood/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-lostmirk");

export type LostmirkFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type LostmirkFixtureName = "lostmirk-won" | "lostmirk-lost";

// The log of a playthrough whose first 1 part was won: the Journey Up the Anduin golden's two-handed win, resolved onto a blank log, their heroes and what hangs on them left out.
export async function upanduinWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Journey Up the Anduin", golden: "two-handed, won, a treasure discovered, Turayn joins the pool", goldens: UPANDUIN_GOLDENS, world: upanduinWorld, play: playUpanduin });
}

export async function lostmirkFixtures(): Promise<Partial<Record<LostmirkFixtureName, LostmirkFixture>>> {
  const log = await upanduinWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): LostmirkFixture | null => {
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "lost-in-mirkwood", seatCount: 2, log, answer: (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => lostmirkIntent(state, ctx, memory, { choose: "first", resolve: "first", route: "escape" }, { ...LOSTMIRK_POLICY, play: true, act: true }) }, "LOSTMIRK_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "lostmirk-won");
  const lost = find((state) => state.lost, "lostmirk-lost");
  return { ...(won ? { "lostmirk-won": won } : {}), ...(lost ? { "lostmirk-lost": lost } : {}) };
}
