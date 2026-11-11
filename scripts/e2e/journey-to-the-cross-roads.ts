// The Maestro fixtures of Journey to the Cross-roads (the-two-towers part 5), written into src/campaign/fixtures/journey-to-the-cross-roads.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck in the first
// seat, Defenders of Gondor in the second: FIXTURE_DECKS in scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `roads-won` is the first seed that wins, parked on the win (the Resolution waits); `roads-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup (144069) asks each player for a copy of Brace of Coneys or 1 resource on each hero: both seats take the resources (the loadout's choices). The Resolution asks nothing (it earns a Brace of Coneys for each
// player who chose one, and writes the enemies under The Black Gate to the log). The decklists are played with the scenario's golden policy (test/scenarios/journey-to-the-cross-roads/game.ts: the players engage the Haradrim, travel to the
// first location they may and take each choice's last option) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { MARSHES_GOLDENS, marshesWorld, playGolden as playMarshes } from "../../test/scenarios/the-passage-of-the-marshes/game.ts";
import { isengardWonLog } from "./the-passage-of-the-marshes.ts";
import { DEFAULT_POLICY, ROADS_CHOICES, ROADS_POLICY, roadsIntent } from "../../test/scenarios/journey-to-the-cross-roads/game.ts";
import { createLog } from "../log.ts";
import { firstSeed, FIXTURE_DECKS, prebuiltDeck, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-roads");
// The saga Frodo (141001, Fellowship sphere, Ring-bearer) is the first seat's Ring-bearer with The One Ring (mec112.setting-up-the-game, scenarios 10 to 12), beside The One Deck's heroes.
const FRODO = "141001";
const loadout: StoredLoadout = { scenarioId: "journey-to-the-cross-roads", difficulty: "Easy", seats: FIXTURE_DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) })), ringBearer: FRODO, choices: [...ROADS_CHOICES], acceptPenalty: false };

export type RoadsFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type RoadsFixtureName = "roads-won" | "roads-lost";

// The log of a playthrough whose first 4 parts were won: the log of the parts before The Passage of the Marshes (scripts/e2e/the-passage-of-the-marshes.ts), then the The Passage of the Marshes golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function marshesWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Passage of the Marshes", golden: "two-handed, won, Normal", goldens: MARSHES_GOLDENS, world: marshesWorld, play: playMarshes, scenarioId: "the-passage-of-the-marshes" }, await isengardWonLog());
}

export async function roadsFixtures(): Promise<Partial<Record<RoadsFixtureName, RoadsFixture>>> {
  const log = await marshesWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): RoadsFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => roadsIntent(state, ctx, memory, DEFAULT_POLICY, { ...ROADS_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "journey-to-the-cross-roads", seatCount: 2, log, loadout, codes: [FRODO], answer }, "ROADS_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "roads-won");
  const lost = find((state) => state.lost, "roads-lost");
  return { ...(won ? { "roads-won": won } : {}), ...(lost ? { "roads-lost": lost } : {}) };
}
