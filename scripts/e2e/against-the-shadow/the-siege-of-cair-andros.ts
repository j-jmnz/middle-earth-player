// The save fixtures of The Siege of Cair Andros (against-the-shadow cycle part 3), written into src/campaign/fixtures/the-siege-of-cair-andros.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `andros-lost` is the first seed that loses on a Siege stage with a damaged Battleground location in play,
// parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions: the auto-player plays cards and answers each Response it can pay for, takes the first option of every choice and travels to the first location it may, archery damage follows `archeryAnswer`
// (test/scenarios/the-siege-of-cair-andros/game.ts), each seat keeps its last hero out of the quest so a ready hero defends (an undefended attack on stage 1 damages a Battleground location), an enemy is engaged after the quest while a seat has fewer
// engaged than heroes, and a ready character attacks (the auto-player alone never engages or attacks).
import { archeryAnswer, commitAnswer } from "../../../test/scenarios/the-siege-of-cair-andros/game.ts";
import { nextIntent } from "../../../test/harness/auto-player.ts";
import { attackTogether, engageOneEach } from "../../../test/harness/game-kit.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";

const say = createLog("e2e-andros");

const spec: StandaloneSeedSpec<2> = {
  campaignId: "against-the-shadow",
  scenarioId: "the-siege-of-cair-andros",
  seatCount: 2,
  answer: (state, ctx, memory) => archeryAnswer(state, ctx) ?? commitAnswer(state, ctx, 1) ?? attackTogether(state, ctx) ?? engageOneEach(state, ctx) ?? nextIntent(state, ctx, { scout: "", prefer: "", protect: "", play: true, act: true }, memory),
};

// The loss the fixture parks on: the first seed that loses on a Siege stage (The Defense, Breakthrough at the Citadel or The Last Battle) with a Battleground location in play that holds damage, so the table shows the damage dial and the stage's words.
const SIEGE_STAGES = ["05072", "05075", "05076"];
const BATTLEGROUNDS = ["05033", "05034", "05035"];
const lostOnSiegeWithDamage = (state: ScenarioState): boolean =>
  state.lost &&
  SIEGE_STAGES.includes(state.cards[state.questStage ?? ""]?.code ?? "") &&
  Object.values(state.cards).some((card) => BATTLEGROUNDS.includes(card.code) && (card.zone === "staging" || card.zone === "activeLocation") && card.damage > 0);

export const androsFixtures = async () => {
  const lost = firstStandaloneSeed(say, spec, "ANDROS_SEEDS", lostOnSiegeWithDamage, "andros-lost");
  return lost ? { "andros-lost": lost } : {};
};
