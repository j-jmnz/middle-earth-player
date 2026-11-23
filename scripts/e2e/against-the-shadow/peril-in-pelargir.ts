// The save fixtures of Peril in Pelargir (against-the-shadow cycle part 1), written into src/campaign/fixtures/peril-in-pelargir.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `pelargir-lost` is the first seed that loses,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so `standaloneWonLost` plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, takes the first option of every choice, an enemy is engaged after the quest while a seat has fewer engaged than heroes, and a ready
// character attacks, the enemy that holds Alcaron's Scroll first (the auto-player alone never engages or attacks).
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { attackTogether, engageOneEach } from "../../../test/harness/game-kit.ts";
import { createLog } from "../../log.ts";
import { standaloneWonLost } from "../seed-kit.ts";

const say = createLog("e2e-pelargir");

export const pelargirFixtures = async () =>
  standaloneWonLost(
    say,
    "pelargir",
    {
      campaignId: "against-the-shadow",
      scenarioId: "peril-in-pelargir",
      seatCount: 2,
      answer: (state, ctx, memory) => {
        const holder = (id: string) => ((state.cards[id]?.attachments ?? []).some((attached) => state.cards[attached]?.code === "05019") ? 0 : 1);
        return attackTogether(state, ctx, () => true, holder) ?? engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory);
      },
    },
    "PELARGIR_SEEDS",
  );
