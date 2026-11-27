// The save fixtures of The Black Serpent (haradrim cycle part 7), written into src/campaign/fixtures/the-black-serpent.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `serpent-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-black-serpent/game.ts: all but one character quest, the hero kept home attacks, the Serpent is engaged once stage 3B holds 6 progress, a Choose window takes its last option).
import { serpentIntent } from "../../../test/scenarios/the-black-serpent/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-serpent");

export const serpentFixtures = async () => standaloneWonLost(say, "serpent", { campaignId: "haradrim", scenarioId: "the-black-serpent", seatCount: 2, answer: (state, ctx, memory) => serpentIntent(state, ctx, memory) }, "SERPENT_SEEDS");
