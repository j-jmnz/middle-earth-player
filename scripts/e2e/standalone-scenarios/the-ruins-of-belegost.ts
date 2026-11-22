// The save fixtures of The Ruins of Belegost (standalone-scenarios cycle part 6), written into src/campaign/fixtures/the-ruins-of-belegost.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `belegost-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `belegost-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; the scenario's own answers are the golden game's (test/scenarios/the-ruins-of-belegost/game.ts): the engagements, the quest commitment (the first hero
// quests, the second defends and the last attacks), the defenders, the attacks (Lurker of the Depths first, then Naurlhûg) and every choice.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { belegostIntent } from "../../../test/scenarios/the-ruins-of-belegost/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-belegost");

export const belegostFixtures = async () =>
  standaloneWonLost(
    say,
    "belegost",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-ruins-of-belegost",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const kind = state.window?.kind;
        const own = kind === "choose" || kind === "optionalEngage" || kind === "playerAttack" || kind === "defense" || (kind === "pass" && state.mode === "questCommit");
        return own ? belegostIntent(state, ctx, memory) : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "BELEGOST_SEEDS",
  );
