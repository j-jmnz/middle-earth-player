// The save fixtures of The Three Trials (the-ring-maker cycle part 5), written into src/campaign/fixtures/the-three-trials.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `trials-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists play with the auto-player's own answers (a Choose takes its first option, it travels, engages and defends as its policy says), which the scenario's questions do not need changed: the first seed that loses is parked on the loss.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-trials");

export const trialsFixtures = async () => standaloneWonLost(say, "trials", { campaignId: "the-ring-maker", scenarioId: "the-three-trials", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "TRIALS_SEEDS");
