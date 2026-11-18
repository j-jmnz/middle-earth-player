// The fixtures of The Tower of Cirith Ungol (the-return-of-the-king part 4), written into src/campaign/fixtures/the-tower-of-cirith-ungol.json by scripts/e2e/fixtures.ts: real games of saved decklists (The One Deck in the first seat, Defenders of
// Gondor in the second: FIXTURE_DECKS in scripts/e2e/seed-kit.ts), two-handed, Easy, so each is a real save. `ungol-won` is the first seed that wins, parked on the win (the Resolution waits); `ungol-lost` the first
// that loses, parked on the loss. A game not found in the seeds is left out.
// The log has the earlier parts recorded as won, so the open scenario is the playthrough's current node and `openNode` resumes it.
// The Campaign Setup asks each player for an Item boon of the pool to set aside: the real chain's pool holds the Palantír of Orthanc (the Road to Isengard earned it), so the first player's choice is answered with it (`choices`) and the second has none to take. The Resolution asks nothing
// (a boon still guarded on Shagrat is lost, the others stay). The decklists are played with the scenario's golden policy (test/scenarios/the-tower-of-cirith-ungol/game.ts: every character but one quests, the players engage, Evil Vigilance's threat is chosen) with card play on.
import type { CampaignLog } from "../../src/campaign/log.ts";
import type { StoredLoadout } from "../../src/campaign/save.ts";
import type { PlayerIntent, ReduceContext, ScenarioState } from "../../src/rules/engine/reduce.ts";

import { FIELDS_GOLDENS, fieldsWorld, playGolden as playFields } from "../../test/scenarios/the-battle-of-the-pelennor-fields/game.ts";
import { DEFAULT_POLICY, UNGOL_POLICY, ungolIntent } from "../../test/scenarios/the-tower-of-cirith-ungol/game.ts";
import { gondorWonLog } from "./the-battle-of-the-pelennor-fields.ts";
import { createLog } from "../log.ts";
import { firstSeed, FIXTURE_DECKS, prebuiltDeck, wonLog } from "./seed-kit.ts";

const say = createLog("e2e-ungol");
// The Item boon the real chain carries: the Palantír of Orthanc.
const PALANTIR = "143020";
// The saga Frodo (141001, Fellowship sphere, Ring-bearer) is the first seat's Ring-bearer with The One Ring (mec113.setting-up-the-game), beside the first saved deck's heroes; the Setup lays him under Topmost Chamber and the first player gives Last of the Company to another hero.
const FRODO = "141001";
const loadout: StoredLoadout = { scenarioId: "the-tower-of-cirith-ungol", difficulty: "Easy", seats: FIXTURE_DECKS.map((id) => ({ deckId: id, ...prebuiltDeck(id) })), ringBearer: FRODO, choices: [PALANTIR], acceptPenalty: false };

export type UngolFixture = { campaignId: string; seatCount: 2; loadout: StoredLoadout; seed: number; intents: PlayerIntent[]; log: CampaignLog };
export type UngolFixtureName = "ungol-won" | "ungol-lost";

// The log of a playthrough whose first 3 parts were won: the log of the parts before The Battle of the Pelennor Fields (scripts/e2e/the-battle-of-the-pelennor-fields.ts), then the The Battle of the Pelennor Fields golden's two-handed win, resolved onto it, their heroes and what hangs on them left out.
export async function fieldsWonLog(): Promise<CampaignLog> {
  return wonLog({ title: "The Battle of the Pelennor Fields", golden: "two-handed, won, Normal, after the Siege", goldens: FIELDS_GOLDENS, world: fieldsWorld, play: playFields, scenarioId: "the-battle-of-the-pelennor-fields" }, await gondorWonLog());
}

export async function ungolFixtures(): Promise<Partial<Record<UngolFixtureName, UngolFixture>>> {
  const log = await fieldsWonLog();
  const find = (wanted: (state: ScenarioState) => boolean, label: string): UngolFixture | null => {
    const answer = (state: ScenarioState, ctx: ReduceContext, memory: Set<string>) => ungolIntent(state, ctx, memory, DEFAULT_POLICY, { ...UNGOL_POLICY, play: true, act: true });
    const found = firstSeed(say, { campaignId: "the-return-of-the-king", scenarioId: "the-tower-of-cirith-ungol", seatCount: 2, log, loadout, codes: [FRODO], answer }, "UNGOL_SEEDS", wanted, label);
    return found && { ...found, log };
  };
  const won = find((state) => state.stageCleared && !state.lost, "ungol-won");
  const lost = find((state) => state.lost, "ungol-lost");
  return { ...(won ? { "ungol-won": won } : {}), ...(lost ? { "ungol-lost": lost } : {}) };
}
