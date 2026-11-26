// The save fixtures of Beneath the Sands (haradrim cycle part 6), written into src/campaign/fixtures/beneath-the-sands.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `sands-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/beneath-the-sands/game.ts: all but one hero quest, the players travel to the location with the fewest quest points, nobody defends, the heroes attack together, every choice takes its first option), without card play.
import { sandsIntent } from "../../../test/scenarios/beneath-the-sands/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-sands");

export const sandsFixtures = async () => standaloneWonLost(say, "sands", { campaignId: "haradrim", scenarioId: "beneath-the-sands", seatCount: 2, answer: (state, ctx, memory) => sandsIntent(state, ctx, memory) }, "SANDS_SEEDS");
