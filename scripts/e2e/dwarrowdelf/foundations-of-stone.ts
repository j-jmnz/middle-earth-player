// The Maestro fixtures of Foundations of Stone (dwarrowdelf cycle part 8), written into src/campaign/fixtures/foundations-of-stone.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `stone-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `stone-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, Washed Away!'s stage 4 draw and every other choice (the Torch's hero, Lost and Alone's hero, Chill of the Roots, Drowned Treasury's claim) take their first
// option, and an enemy is engaged after the quest while a seat has fewer engaged than heroes, a ready character attacking an engaged enemy (the auto-player alone never engages or attacks).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { engageOneEach } from "../../../test/harness/game-kit.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/reduce.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-stone");

export const stoneFixtures = async () =>
  standaloneWonLost(
    say,
    "stone",
    {
      campaignId: "dwarrowdelf",
      scenarioId: "foundations-of-stone",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
          for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
            const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
            if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
          }
        }
        return engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "STONE_SEEDS",
  );
