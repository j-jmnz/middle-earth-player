// The fixtures of The Passage of the Marshes (the-two-towers part 4), written into src/campaign/fixtures/the-passage-of-the-marshes.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `marshes-won` is the first seed that wins, parked on the win (the Resolution waits); `marshes-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (the checklist shuffles a Searching Eye into each deck and attaches The One Ring to the first player's Ring-bearer); the quest card's Setup asks each player for a location to search for and the first player
// nothing else; the Resolution (144067) asks each player in turn for the +2 starting threat penalty or a copy of The Searching Eye (the first option does). The decklists are played with the scenario's golden policy (test/scenarios/the-passage-of-the-marshes/game.ts: one
// character of each seat quests, the others attack Gollum and then the Undead one at a time) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { ISENGARD_GOLDENS, isengardWorld, playGolden as playIsengard } from "../../test/scenarios/the-road-to-isengard/game.ts";
import { deepWonLog } from "./the-road-to-isengard.ts";
import { DEFAULT_POLICY, MARSHES_POLICY, marshesIntent } from "../../test/scenarios/the-passage-of-the-marshes/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, FIXTURE_DECKS, prebuiltDeck, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-marshes");
// The saga Frodo (141001, Fellowship sphere, Ring-bearer) is the first seat's Ring-bearer with The One Ring (mec112.setting-up-the-game, scenarios 10 to 12), beside the first deck's heroes.
const FRODO = "141001";
const loadout: StoredLoadout = { scenarioId: "the-passage-of-the-marshes", difficulty: "Easy", seats: FIXTURE_DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) })), ringBearer: FRODO, choices: [], acceptPenalty: false };

export type MarshesFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type MarshesFixtureName = "marshes-won" | "marshes-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before The Road to Isengard (scripts/e2e/the-road-to-isengard.ts), then the The Road to Isengard golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function isengardWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Road to Isengard", golden: "two-handed, won, Normal", goldens: ISENGARD_GOLDENS, world: isengardWorld, play: playIsengard, scenarioId: "the-road-to-isengard" }, await deepWonLog());
}

export async function marshesFixtures(): Promise<Partial<Record<MarshesFixtureName, MarshesFixture>>> {
  const log = await isengardWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): MarshesFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => marshesIntent(state, ctx, memory, DEFAULT_POLICY, { ...MARSHES_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "the-passage-of-the-marshes", seatCount: 2, log, loadout, codes: [FRODO], answer }, "MARSHES_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "marshes-won");
  const lost = find((state) => state.lost, "marshes-lost");
  return { ...(won ? { "marshes-won": won } : {}), ...(lost ? { "marshes-lost": lost } : {}) };
}
