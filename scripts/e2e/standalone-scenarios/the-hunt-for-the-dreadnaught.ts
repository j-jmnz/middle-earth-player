// The save fixtures of The Hunt for the Dreadnaught (standalone-scenarios cycle part 14), written into src/campaign/fixtures/the-hunt-for-the-dreadnaught.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `dreadnaught-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `dreadnaught-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; the scenario's own answers are the golden game's (test/scenarios/the-hunt-for-the-dreadnaught/game.ts): the ships (the first offered), the engagements, the quest
// commitment (the first hero quests, the second defends and the last attacks), the defenders (a Ship objective against every Ship enemy), the attacks (the unique Corsairs first, then the Dreadnaught) and every choice.
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { dreadnaughtIntent } from "../../../test/scenarios/the-hunt-for-the-dreadnaught/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-dreadnaught");

export const dreadnaughtFixtures = async () =>
  standaloneWonLost(
    say,
    "dreadnaught",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-hunt-for-the-dreadnaught",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const kind = state.window?.kind;
        const own = kind === "choose" || kind === "optionalEngage" || kind === "playerAttack" || kind === "defense" || (kind === "pass" && state.mode === "questCommit");
        return own ? dreadnaughtIntent(state, ctx, memory) : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "DREADNAUGHT_SEEDS",
  );
