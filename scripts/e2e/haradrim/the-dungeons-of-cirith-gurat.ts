// The save fixtures of The Dungeons of Cirith Gurat (haradrim cycle part 8), written into src/campaign/fixtures/the-dungeons-of-cirith-gurat.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `gurat-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists are played with the scenario's golden policy (test/scenarios/the-dungeons-of-cirith-gurat/game.ts: the last hero stays home to attack the guards, the others quest, nobody defends), without card play.
import { guratIntent } from "../../../test/scenarios/the-dungeons-of-cirith-gurat/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-gurat");

export const guratFixtures = async () => standaloneWonLost(say, "gurat", { campaignId: "haradrim", scenarioId: "the-dungeons-of-cirith-gurat", seatCount: 2, answer: (state, ctx, memory) => guratIntent(state, ctx, memory) }, "GURAT_SEEDS");
