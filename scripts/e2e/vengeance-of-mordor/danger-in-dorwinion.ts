// The save fixtures of Danger in Dorwinion (vengeance-of-mordor cycle part 2), written into src/campaign/fixtures/danger-in-dorwinion.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `dorwinion-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/danger-in-dorwinion/game.ts: all but one character quest, the hero kept home attacks, every enemy of the staging area is engaged, a Choose window takes its first option).
import { dorwinionIntent } from "../../../test/scenarios/danger-in-dorwinion/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-dorwinion");

export const dorwinionFixtures = async () => standaloneWonLost(say, "dorwinion", { campaignId: "vengeance-of-mordor", scenarioId: "danger-in-dorwinion", seatCount: 2, answer: (state, ctx, memory) => dorwinionIntent(state, ctx, memory) }, "DORWINION_SEEDS");
