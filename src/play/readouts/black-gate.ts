// Rules: mec113.saga-staging-rules, mec113.dire, rr.first-player (data/rules/entries.json); ledger lines 146024:A:3, 146029:A:1, 146041:A:2, 146072:B:1, 146073:B:1.
//
// The pieces of The Black Gate Opens' table (docs/design-system-table.md, Cards, The Black Gate Opens): the resources on The Black Gate (a warning: each is another reveal and another damage on stage 2B), the enemies lying under Reeking Moat, the Embassy's row while Setup
// decides it (a pair at a time), and the seat that controls Gwaihir. The engine decided every number (`state.embassy`, the tokens, the card's controller); nothing here changes one. Pure, so a test reads it.
import type { ScenarioState } from "../../rules/engine/reduce.ts";

import { ownerWords } from "../words/owner.ts";
import { embassyWords, gateWords, gwaihirLabel, gwaihirWords, moatWords, pairWords } from "../words/scenarios/black-gate.ts";
import { cardsOf, type TableDial } from "./dials.ts";
import type { HandMark } from "./isengard.ts";

const SCENARIO = "the-black-gate-opens";
const GATE = "146024";
const MOAT = "146029";
const GWAIHIR = "146041";
const STAGE_TWO = "146073";

/** The pair the first player is deciding now ("Player 1's Gandalf with Hill-troll"), null with no Embassy or before the first pair is taken. `nameOfCard` names a card by id. */
export function embassyPairNow(game: ScenarioState, nameOfCard: (id: string) => string): string | null {
  const embassy = game.embassy;
  const pair = embassy && embassy.at > 0 ? embassy.pairs[embassy.at - 1] : undefined;
  const player = pair ? game.cards[pair.player] : undefined;
  return pair && player ? pairWords(ownerWords(game.seatCount, player.controller ?? player.owner), nameOfCard(pair.player), nameOfCard(pair.encounter)) : null;
}

/** The pairs the Embassy has made, in the order the first player decides them, each as "Player 1's Gandalf with Hill-troll". The pair being decided is first once it is taken; decided pairs are gone. Empty with no Embassy. */
export function embassyPairs(game: ScenarioState, nameOf: (code: string) => string): readonly string[] {
  const embassy = game.embassy;
  if (!embassy) return [];
  return embassy.pairs.slice(Math.max(0, embassy.at - 1)).flatMap((pair) => {
    const player = game.cards[pair.player];
    const encounter = game.cards[pair.encounter];
    return player && encounter ? [pairWords(ownerWords(game.seatCount, player.controller ?? player.owner), nameOf(player.code), nameOf(encounter.code))] : [];
  });
}

/**
 * The dials The Black Gate Opens' pieces hold now, in the order the top bar draws them: the resources on The Black Gate first (the one that warns: the count only grows), then the enemies under Reeking Moat while it is in play, then the Embassy while Setup decides it (the pairs
 * left). None fills toward a goal, so none looks complete. Empty in any other scenario.
 */
export function blackGateDials(game: ScenarioState, nameOf: (code: string) => string): readonly TableDial[] {
  if (game.scenarioId !== SCENARIO) return [];
  const dials: TableDial[] = [];
  const gate = cardsOf(game, GATE)[0];
  if (gate) {
    const tokens = gate.resources;
    const second = game.cards[game.questStage ?? ""]?.code === STAGE_TWO;
    dials.push({ id: "gate", testID: "gate-tokens", label: "Gate", name: `Resource tokens on ${nameOf(GATE)}:`, value: tokens, note: gateWords(tokens, second) });
  }
  const moat = cardsOf(game, MOAT)[0];
  const under = moat ? Object.values(game.cards).filter((card) => card.zone === "under" && card.host === moat.id) : [];
  if (moat && under.length > 0) dials.push({ id: "moat", testID: "moat-under", label: "Moat", name: `Enemies under ${nameOf(MOAT)}:`, value: under.length, note: moatWords(under.map((card) => nameOf(card.code))) });
  const embassy = game.embassy;
  if (embassy) {
    const pairs = embassyPairs(game, nameOf);
    dials.push({ id: "embassy", testID: "embassy-pairs", label: "Embassy", name: "Embassy from the Dark Tower, pairs left to decide:", value: pairs.length, note: embassyWords(pairs.length, pairs) });
  }
  return dials;
}

/** The mark of the seat that controls Gwaihir, in play: the first player's says he is earned if he stays there. Empty while he is not in play under a seat and in any other scenario. */
export function blackGateHands(game: ScenarioState): readonly HandMark[] {
  if (game.scenarioId !== SCENARIO) return [];
  return cardsOf(game, GWAIHIR).flatMap((card) => (card.zone === "play" && card.controller != null ? [{ seat: card.controller, label: gwaihirLabel(game.seatCount > 1 ? card.controller : null), note: gwaihirWords(card.controller === game.firstPlayer) }] : []));
}
