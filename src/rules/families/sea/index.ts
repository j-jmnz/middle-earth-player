// Rules: dcce.ships, dcce.prepare-your-fleet, dcce.heading, dcce.sailing-tests, dcce.corsair-deck, dcce.boarding, dcce.last-player, dcce.archery, dcce.from-sea-to-land
// (data/rules/entries.json). The verbs src/catalog/families/sea.ts adds. The ship rules (sea/ships.ts), the Sailing test (sea/sailing.ts), Boarding
// (sea/boarding.ts) and the routes of the Corsair deck and the Stormcaller Elite (sea/routes.ts) work inside the engine's own steps and are not verbs.
import type { CombatHooks, RulesFamily, TravelHooks } from "../../interpret/family-manifest.ts";
import type { Instruction } from "../../../catalog/boundary.ts";

import { frameScope, resolveAmount } from "../../interpret/amounts.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { engageEnemy } from "../../quest/quest.ts";
import type { ScenarioState } from "../../core/state.ts";
import { livingSeats } from "../../core/state.ts";
import type { Focus } from "../index.ts";
import { corsairHolds, endCorsairDeck, prepareCorsairDeck, refillCorsairDeck, revealCorsair, revealForAnyPlayer } from "./corsair.ts";
import { prepareFleet } from "./fleet.ts";
import { shiftHeading } from "./heading.ts";
import { lastPlayer } from "./players.ts";
import { attachSelf } from "../../interpret/effect-targeted.ts";
import { damageShip, defendingShip, fitShips, tradeShipDamage } from "./campaign.ts";
import { boardNow } from "./boarding.ts";
import { searchShips } from "./search.ts";
import { shuffleRandomSetAside } from "./random.ts";
import { setAsideSelf } from "./takeover.ts";
import { makeEngagementChecks } from "./checks.ts";
import { considerOutOfPlay, releaseHeld } from "./islet.ts";
import { discardFromAnyDeck, nameCard, plunderHand } from "./cards.ts";
import { discardAlliesForWillpower, restoreShipEnemies, takeControlAsShip } from "./skirmisher.ts";
import { attackWithPicked } from "./ramming.ts";
import { shipAttackReason, shipDefenseReason, shipEnemyAttacking, shipObjectivesAmong, shipsOnlyReason } from "./ships.ts";
import { announceShipsExhausted, noteAttachedToShip } from "./water.ts";
import { carryToSecondDeck, damageOnMatching, discardAllInPlay, setAsideEncounterDeck } from "./swap.ts";
import { immuneToEvents } from "./immune.ts";
import { attackOtherPlayers } from "./attacks.ts";
import { entriesBarred, entriesRefusal, noteEntries } from "./entries.ts";
import { mustTravelTitled, travelTax } from "./streets.ts";

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
      if (instruction.who === "anyPlayer") return revealForAnyPlayer(state, instruction, focus, count, ctx, steps);
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
    case "ShuffleRandomSetAside":
      return shuffleRandomSetAside(state, instruction, ctx);
    case "MakeEngagementChecks":
      return makeEngagementChecks(state, instruction, focus, ctx, steps);
    case "SetAsideSelf":
      return setAsideSelf(state, focus);
    case "ConsiderOutOfPlay":
      return considerOutOfPlay(state, focus, ctx);
    // A Shadow card's "attach ~ to it" for the Ship objective defending (12132:A:2) needs no question, so it runs inline; every other AttachSelf is the effect frame's.
    case "AttachSelf": {
      if (instruction.to.kind !== "ship" || instruction.to.defender !== true) return null;
      const [defender] = defendingShip(state, ctx);
      return defender && focus.sourceId ? attachSelf(state, focus.sourceId, defender, ctx) : state;
    }
    case "DiscardAlliesForWillpower":
      return discardAlliesForWillpower(state, instruction, focus, ctx, steps);
    case "TakeControlAsShip":
      return takeControlAsShip(state, focus);
    case "AttackWithPicked":
      return attackWithPicked(state, instruction, ctx, steps);
    case "SetAsideEncounterDeck":
      return setAsideEncounterDeck(state, instruction);
    case "AttackOtherPlayers":
      return attackOtherPlayers(state, instruction, focus, ctx, steps);
    case "CarryToSecondDeck":
      return carryToSecondDeck(state, instruction, ctx);
    case "DiscardAllInPlay":
      return discardAllInPlay(state, instruction, focus, ctx, steps);
    // A constant the engine reads when an ally is played or put into play (families/sea/entries.ts).
    case "LimitEntries":
    case "TravelOrAddResources":
      return state;
    default:
      return null;
  }
}

// A ship-objective attacks only ship-enemies, a ship-enemy's attack is defended only by a ship-objective, and its undefended damage goes to a ship-objective (dcce.ship-enemies, dcce.ship-objectives).
const SHIP_COMBAT: CombatHooks = {
  defense: shipDefenseReason,
  attack: (state, enemyId, attacker, target) => shipAttackReason(attacker, target) ?? shipsOnlyReason(state, enemyId, attacker),
  undefended: (state, candidates, cards) => (shipEnemyAttacking(state, cards) ? shipObjectivesAmong(candidates(), state, cards) : []),
};

// Traveling away from Streets of Umbar costs 2 resources on a Raider, and with no Raider to take them the players must travel to a location of that title (12160:A:1, sea/streets.ts);
// Southern Belfalas cannot be traveled to with no Corsair to reveal (12154:A:1).
const SEA_TRAVEL: TravelHooks = {
  cost: travelTax,
  forced: mustTravelTitled,
  unpayable: (state, instruction) => instruction.verb === "RevealCorsair" && !corsairHolds(state),
};

export const manifest: RulesFamily = { name: "sea", settle: { after: (state) => refillCorsairDeck(state), sweep: (state, ctx) => noteEntries(announceShipsExhausted(restoreShipEnemies(releaseHeld(state)), ctx), ctx) }, verbs: ["PrepareCorsairDeck", "EndCorsairDeck", "PrepareFleet", "ShiftHeading", "RevealCorsair", "EngageLastPlayer", "Board", "SearchShips", "FitShips", "TradeShipDamage", "PlunderHand", "NameCard", "DiscardFromAnyDeck", "DamageShip", "ShuffleIntoCorsairDeck", "ShuffleRandomSetAside", "MakeEngagementChecks", "SetAsideSelf", "ConsiderOutOfPlay", "DiscardAlliesForWillpower", "TakeControlAsShip", "AttackWithPicked", "SetAsideEncounterDeck", "CarryToSecondDeck", "AttackOtherPlayers", "DiscardAllInPlay", "LimitEntries", "TravelOrAddResources"], run, attached: noteAttachedToShip, combat: SHIP_COMBAT, travel: SEA_TRAVEL, play: (state, cardId, ctx, how) => entriesBarred(state, cardId, ctx, how.seat), playReason: entriesRefusal, pick: (state, id, _spec, at, ctx) => immuneToEvents(state, id, at, ctx), amount: (state, amount, scope, ctx) => (amount.damageOn ? damageOnMatching(state, amount.damageOn, scope, ctx) : null) };
