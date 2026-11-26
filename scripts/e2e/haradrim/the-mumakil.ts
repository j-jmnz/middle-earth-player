// The save fixtures of The Mûmakil (haradrim cycle part 4), written into src/campaign/fixtures/the-mumakil.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `mumakil-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-mumakil/game.ts: every character quests, the first one defends, the Mûmakil are engaged and attacked, the Capture Responses are used, the Wild Mûmak makes its immediate attack), with card play.
import { mumakilIntent } from "../../../test/scenarios/the-mumakil/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-mumakil");

export const mumakilFixtures = async () => standaloneWonLost(say, "mumakil", { campaignId: "haradrim", scenarioId: "the-mumakil", seatCount: 2, answer: (state, ctx, memory) => mumakilIntent(state, ctx, memory) }, "MUMAKIL_SEEDS");
