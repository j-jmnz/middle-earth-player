// The save fixtures of The River Running (vengeance-of-mordor cycle part 1), written into src/campaign/fixtures/the-river-running.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `running-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-river-running/game.ts: all but one character quest, the hero kept home attacks, every enemy of the staging area is engaged, a Choose window takes its first option).
import { runningIntent } from "../../../test/scenarios/the-river-running/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-running");

export const runningFixtures = async () => standaloneWonLost(say, "running", { campaignId: "vengeance-of-mordor", scenarioId: "the-river-running", seatCount: 2, answer: (state, ctx, memory) => runningIntent(state, ctx, memory) }, "RUNNING_SEEDS");
