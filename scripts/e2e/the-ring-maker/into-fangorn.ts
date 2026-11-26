// The save fixtures of Into Fangorn (the-ring-maker cycle part 3), written into src/campaign/fixtures/into-fangorn.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `fangorn-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists play the auto-player's answers (`play` and `act` on, no scenario rule); the first seed that loses is the fixture. Its Choose windows take the first option.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-fangorn");

export const fangornFixtures = async () => standaloneWonLost(say, "fangorn", { campaignId: "the-ring-maker", scenarioId: "into-fangorn", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "FANGORN_SEEDS");
