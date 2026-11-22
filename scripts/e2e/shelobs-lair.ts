// The fixtures of Shelob's Lair (the-two-towers part 6), written into src/campaign/fixtures/shelobs-lair.json by scripts/e2e/fixtures.ts: real games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `lair-won` is the first seed that wins, parked on the win (the Resolution waits); `lair-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks nothing (the checklist attaches The One Ring and A Heavy Burden to the first player's Ring-bearer and removes the Two Towers burden sets) and neither does the Resolution (A Heavy Burden joins the pool). The decklists are
// played with the scenario's golden policy (test/scenarios/shelobs-lair/game.ts: all but the last character of a seat quest, the last attacks Gollum, then Shelob; a card's choice takes the first of the safe answers) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { ROADS_GOLDENS, roadsWorld, playGolden as playRoads } from "../../test/scenarios/journey-to-the-cross-roads/game.ts";
import { DEFAULT_POLICY, LAIR_GOLDENS, LAIR_POLICY, lairIntent, lairWorld, playGolden as playLair } from "../../test/scenarios/shelobs-lair/game.ts";
import { marshesWonLog } from "./journey-to-the-cross-roads.ts";
import { continuedLog } from "../../src/campaign/continue.ts";
import { createLog } from "../log.ts";
import { firstSeed, FIXTURE_DECKS, prebuiltDeck, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-lair");
// The saga Frodo (141001, Fellowship sphere, Ring-bearer) is the first seat's Ring-bearer with The One Ring (mec112.setting-up-the-game, scenarios 10 to 12), beside the first saved deck's heroes.
const FRODO = "141001";
const loadout: StoredLoadout = { scenarioId: "shelobs-lair", difficulty: "Easy", seats: FIXTURE_DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) })), ringBearer: FRODO, choices: [], acceptPenalty: false };

export type LairFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type LairFixtureName = "lair-won" | "lair-lost";

// The log of a playthrough whose first 5 parts were won: the log of the parts before Journey to the Cross-roads (scripts/e2e/journey-to-the-cross-roads.ts), then the Journey to the Cross-roads golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function roadsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "Journey to the Cross-roads", golden: "two-handed, won, Normal", goldens: ROADS_GOLDENS, world: roadsWorld, play: playRoads, scenarioId: "journey-to-the-cross-roads" }, await marshesWonLog());
}

// The log a finished Two Towers hands on: the six parts' Resolutions written one onto the other (Shelob's Lair's golden win last, read with `goldenState`), taken into a new Return of the King save (`continuedLog`, SAGA_PREVIOUS), which the first part of The Return of the King starts from.
export async function twoTowersFinishedLog(): Promise<CampaignLog> {
  const finished = await wonLog({ title: "Shelob's Lair", golden: "two-handed, won, Normal", goldens: LAIR_GOLDENS, world: lairWorld, play: playLair, scenarioId: "shelobs-lair" }, await roadsWonLog());
  return continuedLog({ id: "tt", campaignId: "the-two-towers", seatCount: 2, log: { ...finished, campaignPool: [...finished.campaignPool] } });
}

export async function lairFixtures(): Promise<Partial<Record<LairFixtureName, LairFixture>>> {
  const log = await roadsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): LairFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => lairIntent(state, ctx, memory, DEFAULT_POLICY, { ...LAIR_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-two-towers", scenarioId: "shelobs-lair", seatCount: 2, log, loadout, codes: [FRODO], answer }, "LAIR_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "lair-won");
  const lost = find((state) => state.lost, "lair-lost");
  return { ...(won ? { "lair-won": won } : {}), ...(lost ? { "lair-lost": lost } : {}) };
}
