// The save fixtures of The Wizard's Quest (standalone-scenarios cycle part 10), written into src/campaign/fixtures/the-wizards-quest.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `quest-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `quest-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists are played with the auto-player's card play on; the scenario's own answers are the golden game's (test/scenarios/the-wizards-quest/game.ts): the engagements, the quest commitment (a seat with several
// heroes sends one to quest), the defenders, the attacks (the enemy that guards a hero first, then Rider of Mirkwood) and every choice, the first player's stage 2 and stage 3 cards included (the first option of each).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { questIntent } from "../../../test/scenarios/the-wizards-quest/game.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-quest");

export const questFixtures = async () =>
  standaloneWonLost(
    say,
    "quest",
    {
      campaignId: "standalone-scenarios",
      scenarioId: "the-wizards-quest",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const kind = state.window?.kind;
        const own = kind === "choose" || kind === "optionalEngage" || kind === "playerAttack" || kind === "defense" || (kind === "pass" && state.mode === "questCommit");
        return own ? questIntent(state, ctx, memory) : nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "QUEST_SEEDS",
  );
