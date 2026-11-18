// The fixtures of The Ghost of Framsburg (ered-mithrin part 7), written into src/campaign/fixtures/the-ghost-of-framsburg.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck and the Defenders of Gondor lists of data/decks/test-decks.json and data/decks/prebuilt.json), two-handed, Easy, so each is a real save. `framsburg-won` is the first seed that wins, parked on the win (the Resolution waits); `framsburg-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks the first player for nothing here (the log holds no Isolde or Beldis line, and the search for a unique boon ally is skipped: the one answer given is "skip"); the Resolution asks the first player for Gundabad Hunter or Gundabad Stalker and for one of the 2 Hazard cards
// discarded (the flow answers the first option of each), and a treasure attached to Fram's Shade, if the game claims one, is discovered with no question.
// The decklists are played with the scenario's golden policy (test/scenarios/the-ghost-of-framsburg/game.ts: the Loot objectives, Crypt Key, Old Lantern and Scatha's Teeth are used, the enemies are engaged and attacked, the Action that shuffles the encounter discard pile is used,
// every character quests) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { NIGHT_GOLDENS, nightWorld, playGolden as playNight } from "../../test/scenarios/fire-in-the-night/game.ts";
import { rhovanionWonLog } from "./fire-in-the-night.ts";
import { DEFAULT_POLICY, FRAMSBURG_POLICY, framsburgIntent } from "../../test/scenarios/the-ghost-of-framsburg/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-framsburg");

export type FramsburgFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type FramsburgFixtureName = "framsburg-won" | "framsburg-lost";

// The log of a playthrough whose first 6 parts were won: the log of the parts before Fire in the Night (scripts/e2e/fire-in-the-night.ts), then the Fire in the Night golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function nightWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Fire in the Night", golden: "two-handed, won, after the earlier parts, Misplaced Trust, every other round, a card of the pool removed for each player", goldens: NIGHT_GOLDENS, world: nightWorld, play: playNight }, await rhovanionWonLog());
}

export async function framsburgFixtures(): Promise<Partial<Record<FramsburgFixtureName, FramsburgFixture>>> {
  const log = await nightWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): FramsburgFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => framsburgIntent(state, ctx, memory, { ...DEFAULT_POLICY, quest: "all", engage: true, use: true, reshuffle: true }, { ...FRAMSBURG_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "ered-mithrin", scenarioId: "the-ghost-of-framsburg", seatCount: 2, log, choices: ["skip"], answer }, "FRAMSBURG_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "framsburg-won");
  const lost = find((state) => state.lost, "framsburg-lost");
  return { ...(won ? { "framsburg-won": won } : {}), ...(lost ? { "framsburg-lost": lost } : {}) };
}
