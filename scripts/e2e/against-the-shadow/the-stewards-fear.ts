// The save fixtures of The Steward's Fear (against-the-shadow cycle part 4), written into src/campaign/fixtures/the-stewards-fear.json by scripts/e2e/fixtures.ts: real standalone games of saved decklists (the fixture decks of scripts/e2e/seed-kit.ts), two-handed, Easy, so each is one open game. `fear-lost` is the first seed that loses
// with an Underworld location in play that has facedown cards under it, a Clue claimed and resource tokens on the stage, parked on the loss. A cycle has no log and no earlier part. There is no won fixture: the registry names none, so the finder
// plays for none (docs/architecture.md, Tests).
// The saved decklists' policy answers the scenario's questions as the goldens do (`fearIntent`, test/scenarios/the-stewards-fear/game.ts): the Actions that claim a Clue are used, the seat keeps its last two heroes out of the quest, one defends and the last
// attacks, each seat engages up to three enemies, Daughter of Berúthiel's threat is paid while it is low, and archery damage goes to the least damaged character.
import { fearIntent } from "../../../test/scenarios/the-stewards-fear/game.ts";
import { createLog } from "../../log.ts";
import { firstStandaloneSeed, type StandaloneSeedSpec } from "../seed-kit.ts";
import type { ScenarioState } from "../../../src/rules/core/state.ts";

const say = createLog("e2e-fear");

const spec: StandaloneSeedSpec<2> = { campaignId: "against-the-shadow", scenarioId: "the-stewards-fear", seatCount: 2, answer: (state, ctx, memory) => fearIntent(state, ctx, memory) };

// The loss the fixture parks on: a location in play (staging area or active) holds facedown cards, a Clue of the scenario is claimed (in the victory display or attached as the Secret Map) and the quest stage holds resource tokens, so the table shows the
// dials, the stack under the location and the stage's preview.
const CLUES = ["06026", "06027", "06028"];
const lostWithStackAndClue = (state: ScenarioState): boolean => {
  const cards = Object.values(state.cards);
  const hosts = new Set(cards.filter((card) => card.zone === "under").map((card) => card.host));
  const stage = state.cards[state.questStage ?? ""];
  return (
    state.lost &&
    cards.some((card) => hosts.has(card.id) && (card.zone === "staging" || card.zone === "activeLocation")) &&
    cards.some((card) => CLUES.includes(card.code) && (card.zone === "victory" || card.host != null)) &&
    (stage?.resources ?? 0) > 0
  );
};

export const fearFixtures = async () => {
  const lost = firstStandaloneSeed(say, spec, "FEAR_SEEDS", lostWithStackAndClue, "fear-lost");
  return lost ? { "fear-lost": lost } : {};
};
