// The save fixtures of Desert Crossing (haradrim cycle part 2), written into src/campaign/fixtures/desert-crossing.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `crossing-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/desert-crossing/game.ts: all but one hero quest, nobody defends, the heroes engage and attack together, every choice takes its first option), without card play.
import { crossingIntent } from "../../../test/scenarios/desert-crossing/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-crossing");

export const crossingFixtures = async () => standaloneWonLost(say, "crossing", { campaignId: "haradrim", scenarioId: "desert-crossing", seatCount: 2, answer: (state, ctx, memory) => crossingIntent(state, ctx, memory) }, "CROSSING_SEEDS");
