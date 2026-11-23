// The save fixtures of The Lonely Mountain (the-hobbit cycle part 5), written into src/campaign/fixtures/the-lonely-mountain.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `mountain-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-mountain");

export const mountainFixtures = async () => standaloneWonLost(say, "mountain", { campaignId: "the-hobbit", scenarioId: "the-lonely-mountain", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "MOUNTAIN_SEEDS");
