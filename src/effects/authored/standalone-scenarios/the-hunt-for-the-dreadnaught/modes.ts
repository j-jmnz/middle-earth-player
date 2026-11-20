import type { Effect } from "../../../../catalog/boundary.ts";
import type { Copy } from "../../reprint.ts";
import * as H from "./shared.ts";

// The two mode cards and the two quest stages.
const { MODE, EASY, DREADNAUGHT, BLACK_SAILS, CORSAIR_WARSHIP, COBAS_HAVEN, GONDORIAN_WARSHIP, EACH_PLAYER, setup, noShipEliminated, questAction, PLAYERS } = H;

export const MODES: readonly (Effect | Copy)[] = [
  // 40002 Standard Mode (the Normal game). Front: the fleet is chosen, the Corsair deck prepared (only Corsairs: the Sea Monster stays in the encounter deck), the 7 unique enemies are set aside by the piles, the encounter deck is shuffled
  // and cards are discarded from the top until 2 locations are discarded (the piles list 3 locations from 3 players), which go to the staging area; the card is flipped by the end of Setup. Back: the Quest Action and the elimination.
  setup(MODE, 1, ["40002:A:1", "40002:A:2"], [{ verb: "PrepareFleet", own: true }]),
  setup(MODE, 2, ["40002:A:1", "40002:A:3"], [{ verb: "PrepareCorsairDeck", trait: "Corsair" }]),
  setup(MODE, 3, ["40002:A:1", "40002:A:4"], []),
  setup(MODE, 4, ["40002:A:1", "40002:A:5"], [{ verb: "ShuffleEncounterDeck" }, { verb: "DiscardUntilEnemies", perPlayer: 1, atLeast: 2, to: "staging", cardType: "location" }]),
  setup(MODE, 5, ["40002:A:1", "40002:A:6"], []),
  questAction(MODE, "40002:B:1", true),
  noShipEliminated(MODE, "40002:B:2"),

  // 40001 Easy Mode (the Easy game): two Black Sails and the Corsair Warship are set aside, Cobas Haven goes to the staging area (no cards are discarded for locations), each hero gets 1 resource, and each player draws 1 more card in the
  // resource phase. The Quest Action does not reveal a card.
  setup(EASY, 1, ["40001:A:1", "40001:A:2"], [{ verb: "PrepareFleet", own: true }]),
  setup(EASY, 2, ["40001:A:1", "40001:A:3"], [{ verb: "PrepareCorsairDeck", trait: "Corsair" }]),
  setup(EASY, 3, ["40001:A:1", "40001:A:4"], [{ verb: "SetAsideFromDeck", code: BLACK_SAILS }, { verb: "SetAsideFromDeck", code: CORSAIR_WARSHIP }]),
  setup(EASY, 4, ["40001:A:1", "40001:A:5"], [{ verb: "SearchToStaging", code: COBAS_HAVEN }, { verb: "ShuffleEncounterDeck" }]),
  setup(EASY, 5, ["40001:A:1", "40001:A:6"], [EACH_PLAYER([{ verb: "HeroesGainResources", amount: 1 }])]),
  setup(EASY, 6, ["40001:A:1", "40001:A:7"], []),
  { id: `${EASY}:constant:1`, cardCode: EASY, lines: ["40001:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "extraDraw", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }] },
  questAction(EASY, "40001:B:2", false),
  noShipEliminated(EASY, "40001:B:3"),

  // 40004 Searching the High Seas, stage 1B: global quest points 8 for each player; no more than 5 progress for each player each round; the players advance only after the quest phase has ended (reading 29).
  { id: "40004:constant:1", cardCode: "40004", lines: ["40004:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: { ...PLAYERS, times: 8 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "40004:constant:2", cardCode: "40004", lines: ["40004:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: { ...PLAYERS, times: 5 }, until: "whileSourceInPlay", target: "table" }] },
  { id: "40004:constant:3", cardCode: "40004", lines: ["40004:B:3"], timing: "constant", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 40005 Destroy the Dreadnaught, stage 2. A: the set-aside Dreadnaught joins the staging area, Elite side up. B: the same progress cap; the Action shuffles a set-aside Gondorian Warship into the encounter deck for 5 progress for each
  // player; the Response cancels the Dreadnaught's attack for 4 threat; the players win when it is destroyed.
  { id: "40005:whenRevealed:1", cardCode: "40005", lines: ["40005:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: DREADNAUGHT }] },
  { id: "40005:constant:1", cardCode: "40005", lines: ["40005:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: { ...PLAYERS, times: 5 }, until: "whileSourceInPlay", target: "table" }] },
  {
    id: "40005:action:1",
    cardCode: "40005",
    lines: ["40005:B:2"],
    timing: "action",
    condition: { kind: "setAsideHas", code: GONDORIAN_WARSHIP },
    instructions: [{ verb: "RemoveQuestProgress", perPlayer: 5 }, { verb: "ShuffleRandomSetAside", name: "Gondorian Warship" }, { verb: "ShuffleEncounterDeck" }],
  },
  {
    id: "40005:response:1",
    cardCode: "40005",
    lines: ["40005:B:3"],
    timing: "response",
    trigger: "enemyAttacks",
    subject: { type: "enemy", control: "any", names: ["Dreadnaught"] },
    eventSeat: "you",
    cost: { kind: "raiseThreat", amount: 4 },
    instructions: [{ verb: "CancelAttack" }],
  },
  { id: "40005:triggered:1", cardCode: "40005", lines: ["40005:B:4"], timing: "triggered", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", names: ["Dreadnaught"] }, instructions: [{ verb: "WinGame" }] },

];
