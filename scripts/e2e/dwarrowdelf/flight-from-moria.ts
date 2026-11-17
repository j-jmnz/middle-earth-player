// The Maestro fixtures of Flight from Moria (dwarrowdelf cycle part 3), written into src/campaign/fixtures/flight-from-moria.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the One Deck and
// Defenders of Gondor lists of data/decks), two-handed, Easy, so each is one open game. `frommoria-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `frommoria-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for; the first player stays on a stage the quest can defeat and bypasses Escape from Darkness and Blocked by Flame
// (their progress cannot come from the quest), takes Blocked by Shadow's second option when it is offered and takes the first option of any other choice; an enemy is engaged after the quest while a seat has fewer engaged than heroes, and a ready
// character attacks an engaged enemy (the auto-player alone never engages or attacks).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { engageOneEach } from "../../../test/harness/game-kit.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/reduce.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-frommoria");

export const frommoriaFixtures = async () =>
  standaloneWonLost(
    say,
    "frommoria",
    {
      campaignId: "dwarrowdelf",
      scenarioId: "flight-from-moria",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        if (state.window?.kind === "choose") {
          const options = state.window.options;
          if (options.includes("bypass") && options.includes("stay")) {
            const stage = state.cards[state.questStage ?? ""]?.code;
            return { type: "Choose", optionId: stage === "03076" || stage === "901203" ? "bypass" : "stay" };
          }
          if (options.includes("next")) return { type: "Choose", optionId: "next" };
        }
        if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
          for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
            const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
            if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
          }
        }
        return engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "FROMMORIA_SEEDS",
  );
