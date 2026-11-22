// The save fixtures of Escape from Khazad-dûm (standalone-scenarios cycle part 13), written into src/campaign/fixtures/escape-from-khazad-dum.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `khazad-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `khazad-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-khazad");

// The saved decklists' policy answers every question; the players travel to Dark Pit first and explore it there.
export const khazadFixtures = async () => standaloneWonLost(say, "khazad", { campaignId: "standalone-scenarios", scenarioId: "escape-from-khazad-dum", seatCount: 2, answer: (state, ctx, memory) => nextIntent(state, ctx, { scout: "", prefer: "51310", protect: "", play: true, act: true }, memory) }, "KHAZAD_SEEDS");
