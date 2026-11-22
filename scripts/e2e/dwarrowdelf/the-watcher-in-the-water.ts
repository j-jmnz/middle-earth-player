// The fixtures of The Watcher in the Water (dwarrowdelf cycle part 6), written into src/campaign/fixtures/the-watcher-in-the-water.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `water-won` is the first seed that wins, parked on the win (the outcome screen is one tap away); `water-lost` the first that loses,
// parked on the loss. A cycle has no log and no earlier part. A game not found in the seeds is left out.
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, takes the first option of every choice (Doors of Durin's hand discards take a card while there is one: the hand goes whole),
// uses Wrapped!'s Combat Action and Doors of Durin's Action when offered, and attacks; an enemy is engaged after the quest while a seat has fewer engaged than heroes, and a ready character attacks an engaged enemy (the auto-player alone never engages or attacks).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { engageOneEach } from "../../../test/harness/game-kit.ts";
import { legalIntents, legalTargets } from "../../../src/rules/engine/reduce.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-water");

export const waterFixtures = async () =>
  standaloneWonLost(
    say,
    "water",
    {
      campaignId: "dwarrowdelf",
      scenarioId: "the-watcher-in-the-water",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        if (state.window?.kind === "choose") {
          const card = state.window.options.find((option) => option !== "done" && state.cards[option]?.zone === "hand");
          if (state.window.options.includes("done") && card) return { type: "Choose", optionId: card };
        }
        const used = legalIntents(state, ctx).find((intent) => intent.type === "Trigger" && ["040076", "04065"].includes(state.cards[intent.cardId]?.code ?? ""));
        if (used?.type === "Trigger") return used;
        if (state.window?.kind === "playerAttack" && legalIntents(state, ctx).some((intent) => intent.type === "DeclareAttackers")) {
          for (const hero of state.seats[state.activeSeat]?.heroes ?? []) {
            const enemy = legalTargets(state, { type: "DeclareAttackers", cardId: hero }, ctx)[0];
            if (enemy) return { type: "DeclareAttackers", enemyId: enemy, attackerIds: [hero] };
          }
        }
        return engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "WATER_SEEDS",
  );
