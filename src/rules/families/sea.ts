// Rules: dcce.ships, dcce.prepare-your-fleet, dcce.heading, dcce.sailing-tests, dcce.corsair-deck, dcce.boarding, dcce.last-player, dcce.archery
// (data/rules/entries.json). The verbs src/catalog/families/sea.ts adds. The ship rules (sea-ships.ts), the Sailing test (sea-sailing.ts), Boarding
// (sea-boarding.ts) and the routes of the Corsair deck and the Stormcaller Elite (sea-routes.ts) work inside the engine's own steps and are not verbs.
import type { Instruction } from "../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../amounts.ts";
import type { EngineStep } from "../intents.ts";
import type { ReduceContext } from "../interpret.ts";
import { engageEnemy } from "../quest.ts";
import type { ScenarioState } from "../state.ts";
import { livingSeats } from "../state.ts";
import type { Focus } from "./index.ts";
import { endCorsairDeck, prepareCorsairDeck, revealCorsair } from "./sea-corsair.ts";
import { prepareFleet } from "./sea-fleet.ts";
import { shiftHeading } from "./sea-heading.ts";
import { lastPlayer } from "./sea-players.ts";
import { damageShip, fitShips, tradeShipDamage } from "./sea-campaign.ts";
import { boardNow } from "./sea-boarding.ts";
import { searchShips } from "./sea-search.ts";
import { discardFromAnyDeck, nameCard, plunderHand } from "./sea-cards.ts";

export function run(state: ScenarioState, instruction: Instruction, focus: Focus, ctx: ReduceContext, steps: EngineStep[]): ScenarioState | null {
  switch (instruction.verb) {
    case "PrepareCorsairDeck":
      return prepareCorsairDeck(state, ctx);
    case "EndCorsairDeck":
      return endCorsairDeck(state);
    case "PrepareFleet":
      return prepareFleet(state, instruction, focus, ctx, steps);
    case "ShiftHeading":
      return shiftHeading(state, instruction.direction);
    case "RevealCorsair": {
      const count = instruction.count == null ? 1 : resolveAmount(state, instruction.count, frameScope(state, focus.seat, focus.sourceId), ctx);
      const seats = instruction.who === "eachSeat" ? livingSeats(state) : [focus.seat];
      let next = state;
      for (const seat of seats) next = revealCorsair(next, seat, count, ctx, steps);
      return next;
    }
    case "EngageLastPlayer":
      return focus.sourceId ? engageEnemy(state, lastPlayer(state), focus.sourceId, steps) : state;
    case "Board":
      return boardNow(state, focus.sourceId, focus.seat, ctx, steps);
    case "SearchShips":
      return searchShips(state, instruction, focus, ctx, steps);
    case "FitShips":
      return fitShips(state, instruction, focus, ctx, steps);
    case "TradeShipDamage":
      return tradeShipDamage(state, instruction, focus, ctx, steps);
    case "PlunderHand":
      return plunderHand(state, focus, ctx);
    case "NameCard":
      return nameCard(state, instruction, focus, ctx, steps);
    case "DiscardFromAnyDeck":
      return discardFromAnyDeck(state, instruction, focus, ctx, steps);
    case "DamageShip":
      return damageShip(state, instruction, focus, ctx, steps);
    // Dealt when the game starts (src/campaign/start.ts): the card joins the Corsair deck the quest card's Setup shuffles.
    case "ShuffleIntoCorsairDeck":
      return state;
    default:
      return null;
  }
}
