// The save fixtures of The Temple of Doom (vengeance-of-mordor cycle part 3), written into src/campaign/fixtures/the-temple-of-doom.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `templedoom-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-temple-of-doom/game.ts: all but one character quest, Thane Ulchor is engaged first and attacked first, the current quest is Tribute to Mordor once it is offered).
import { templedoomIntent } from "../../../test/scenarios/the-temple-of-doom/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-templedoom");

export const templedoomFixtures = async () => standaloneWonLost(say, "templedoom", { campaignId: "vengeance-of-mordor", scenarioId: "the-temple-of-doom", seatCount: 2, answer: (state, ctx, memory) => templedoomIntent(state, ctx, memory) }, "TEMPLEDOOM_SEEDS");
