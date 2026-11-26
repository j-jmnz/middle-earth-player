// The save fixtures of Race Across Harad (haradrim cycle part 5), written into src/campaign/fixtures/race-across-harad.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `harad-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/race-across-harad/game.ts: two heroes of a seat stay home and defend, the rest quest, the players engage and attack, the Warg-rider goes to the staging area), with card play.
import { haradIntent } from "../../../test/scenarios/race-across-harad/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-harad");

export const haradFixtures = async () => standaloneWonLost(say, "harad", { campaignId: "haradrim", scenarioId: "race-across-harad", seatCount: 2, answer: (state, ctx, memory) => haradIntent(state, ctx, memory) }, "HARAD_SEEDS");
