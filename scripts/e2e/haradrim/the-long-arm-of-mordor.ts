// The save fixtures of The Long Arm of Mordor (haradrim cycle part 3), written into src/campaign/fixtures/the-long-arm-of-mordor.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `mordor-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-long-arm-of-mordor/game.ts: each player takes Firyal first, the damage goes to a hero that is no objective-hero, the heroes quest and attack the guards), without card play.
import { mordorIntent } from "../../../test/scenarios/the-long-arm-of-mordor/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-mordor");

export const mordorFixtures = async () => standaloneWonLost(say, "mordor", { campaignId: "haradrim", scenarioId: "the-long-arm-of-mordor", seatCount: 2, answer: (state, ctx, memory) => mordorIntent(state, ctx, memory) }, "MORDOR_SEEDS");
