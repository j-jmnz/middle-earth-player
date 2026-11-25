// The save fixtures of The Fords of Isen (the-ring-maker cycle part 1), written into src/campaign/fixtures/the-fords-of-isen.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `isen-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists play the auto-player's answers (`play` and `act` on, no scenario rule): it never wins here, and the first seed that loses is the fixture. A Gríma Action costs no choice; the Down from the Hills choice takes its first option.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-isen");

export const isenFixtures = async () => standaloneWonLost(say, "isen", { campaignId: "the-ring-maker", scenarioId: "the-fords-of-isen", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory) }, "ISEN_SEEDS");
