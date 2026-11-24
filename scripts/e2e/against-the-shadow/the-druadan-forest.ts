// The save fixtures of The Drúadan Forest (against-the-shadow cycle part 5), written into src/campaign/fixtures/the-druadan-forest.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `druadan-lost` is the first seed that loses
// on stage 3 (Passage Out) with Drû-buri-Drû in play and an enemy holding progress from an attack, parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder plays for none
// (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions as the goldens do (`druadanIntent`, test/scenarios/the-druadan-forest/game.ts): the seat keeps its last two heroes out of the quest, each seat engages up to three enemies, the
// ready characters attack together (on stage 3 with their Willpower, Drû-buri-Drû first), a hero defends, archery damage goes to the least damaged character, and a pay-or-suffer card or a Prowl is paid.
import { druadanIntent } from "../../../test/scenarios/the-druadan-forest/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";

const say = createLog("e2e-druadan");

// What a game showed along the way, by seed: the lost fixture must pass through the scenario's moments, which the final state no longer holds (the Woses and Drû-buri-Drû are gone by then).
type Moments = { progress: boolean; prowl: boolean; attackers: boolean };
const seen = new Map<number, Moments>();
const inPlay = (card: { zone: string }) => card.zone === "staging" || card.zone === "engaged";

// The moments of the stage 3 table the Table step made (src/play/): an enemy holding progress from an attack with Drû-buri-Drû in play (the progress line and the Drû dial), a Prowl choice (the hero sheet or discard or stop) and the attackers sheet
// of a Siege stage (the attack window, Willpower).
function note(state: ScenarioState): void {
  const found = seen.get(state.seed) ?? { progress: false, prowl: false, attackers: false };
  seen.set(state.seed, found);
  const window = state.window;
  if (window?.kind === "choose") {
    const own = new Set(state.seats[window.seat]?.heroes ?? []);
    if ((window.options.length === 2 && window.options.includes("discard") && window.options.includes("stop")) || window.options.every((option) => own.has(option))) found.prowl = true;
  }
  if (state.cards[state.questStage ?? ""]?.code !== "06044") return;
  const cards = Object.values(state.cards);
  if (window?.kind === "playerAttack") found.attackers = true;
  if (cards.some((card) => card.code === "06045" && inPlay(card)) && cards.some((card) => inPlay(card) && card.progress > 0)) found.progress = true;
}

const spec: StandaloneSeedSpec<2> = {
  campaignId: "against-the-shadow",
  scenarioId: "the-druadan-forest",
  seatCount: 2,
  answer: (state, ctx, memory) => {
    note(state);
    return druadanIntent(state, ctx, memory, { choose: "first", reserve: 1, engage: 3, play: true });
  },
};

// The loss the fixture parks on: a lost game that passed through stage 3 with an enemy holding progress and Drû-buri-Drû in play, a Prowl choice and the attackers sheet, so the table shows the Drû dial, the progress line on the enemy and the
// stage's preview at those intents.
const lostThroughStageThree = (state: ScenarioState): boolean => {
  const found = seen.get(state.seed);
  return state.lost && found?.progress === true && found.prowl && found.attackers;
};

export const druadanFixtures = async () => {
  const lost = firstStandaloneSeed(say, spec, "DRUADAN_SEEDS", lostThroughStageThree, "druadan-lost");
  return lost ? { "druadan-lost": lost } : {};
};
