// The save fixtures of The Crossings of Poros (haradrim cycle part 9), written into src/campaign/fixtures/the-crossings-of-poros.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `poros-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-crossings-of-poros/game.ts: all but one character quest, the hero kept home attacks, every enemy but The Black Serpent is engaged, a Choose window takes its first option).
import { porosIntent } from "../../../test/scenarios/the-crossings-of-poros/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-poros");

export const porosFixtures = async () => standaloneWonLost(say, "poros", { campaignId: "haradrim", scenarioId: "the-crossings-of-poros", seatCount: 2, answer: (state, ctx, memory) => porosIntent(state, ctx, memory) }, "POROS_SEEDS");
