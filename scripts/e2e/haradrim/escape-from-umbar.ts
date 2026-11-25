// The save fixtures of Escape from Umbar (haradrim cycle part 1), written into src/campaign/fixtures/escape-from-umbar.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `umbar-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/escape-from-umbar/game.ts: all but one hero quest, nobody defends, the heroes attack together, every choice takes its first option), without card play.
import { umbarIntent } from "../../../test/scenarios/escape-from-umbar/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-umbar");

export const umbarFixtures = async () => standaloneWonLost(say, "umbar", { campaignId: "haradrim", scenarioId: "escape-from-umbar", seatCount: 2, answer: (state, ctx, memory) => umbarIntent(state, ctx, memory) }, "UMBAR_SEEDS");
