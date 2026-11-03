import { triggerIntents, triggerReason } from "./actions.ts";
import {
  archeryRecipients,
  attackDeclared,
  canAttack,
  canDefend,
  characters,
  declarableEnemies,
  defenderIds,
  hasLegalAttack,
  undefendedTargets,
} from "./combat.ts";
import { optionIntents, optionReason } from "./choices.ts";
import { mulliganTriggers } from "./families/deck/play.ts";
import { hideCommitReason, hideCommitters } from "./hide.ts";
import type { LegalIntent, PlayerIntent, Selection } from "./intents.ts";
import { suppliesNumber } from "./intents.ts";
import type { ReduceContext } from "./interpret.ts";
import { hasKeyword } from "./keywords.ts";
import { attachmentTargets, discardPlayable, playReason, playWindowReason } from "./planning.ts";
import { resolutionIntents, resolutionReason } from "./resolution.ts";
import { optionalEnemies, stagingLocations } from "./quest.ts";
import { defenseBlocked, forcedTravel, travelBlocked, travelCostUnpayable } from "./restrictions.ts";
import { flagged, perilLock, type ScenarioState } from "./state.ts";
import { attackRuleReason } from "./families/attack/targets.ts";
import { sideQuestReason } from "./families/sidequests/quest.ts";
import { travelsOverActive } from "./families/grapple/travel.ts";
import { exploring } from "./families/island/map.ts";
import { islandMayTravel, islandReach } from "./families/island/travel.ts";
import { freeSlot, mustTravel } from "./families/south/locations.ts";
import { viewOf } from "./families/breaking/areas.ts";
import { shipAttackReason, shipDefenseReason } from "./families/sea/ships.ts";
import { askingToCommit, sailingBlocks, sailingCommitReason, sailingCommitters, sailingIntents } from "./families/sea/sailing-legal.ts";
import { printedOf } from "./printed.ts";

const NUMBER = "The engine computes that number";

export function legalIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  if (state.lost || (state.stageCleared && state.window?.kind !== "resolution")) return [];
  if (state.seats[state.activeSeat]?.eliminated) return [];
  const window = state.window;
  if (!window) return [];
  switch (window.kind) {
    case "mulligan":
      // A Response used in place of the mulligan (Galdor of the Havens, families/deck/play.ts) is offered beside them.
      return state.mulliganSeats.includes(state.activeSeat)
        ? [{ type: "Keep" }]
        : [{ type: "Keep" }, { type: "Mulligan" }, ...mulliganTriggers(state, ctx)];
    case "pass":
      // While the first player commits characters to a Sailing test, only that and passing are open (families/sea/sailing.ts).
      return sailingIntents(state) ?? passIntents(state, ctx);
    case "frameAction":
      return passIntents(state, ctx);
    case "hideCommit":
      return [{ type: "CommitHide" }];
    case "choose":
      return optionIntents(state);
    case "cancelOffer":
      return triggerIntents(state, ctx);
    case "response":
      return [{ type: "Pass" }, ...triggerIntents(state, ctx)];
    case "look":
      return [{ type: "Pass" }];
    case "resolution":
      return resolutionIntents(state, ctx);
    case "travel":
      return travelIntents(state, ctx);
    case "optionalEngage":
      return optionalEnemies(state, ctx.cards).length > 0 ? [{ type: "Engage" }, { type: "DeclineEngage" }] : [{ type: "DeclineEngage" }];
    case "chooseEnemy":
      return [{ type: "ChooseEnemy" }];
    case "defense":
      return state.pendingAttack?.undefended ? [{ type: "Undefended" }] : [{ type: "DeclareDefender" }, { type: "Undefended" }];
    case "archery":
      return [{ type: "Distribute", total: window.total }];
    case "playerAttack":
      return hasLegalAttack(state, state.activeSeat, ctx.cards)
        ? [{ type: "DeclareAttackers" }, { type: "DeclineAttack" }]
        : [{ type: "DeclineAttack" }];
  }
}

export function legalTargets(state: ScenarioState, selection: Selection, ctx: ReduceContext): readonly string[] {
  switch (selection.type) {
    case "PlayCard":
      return attachmentTargets(state, state.cards[selection.cardId]?.code, ctx);
    case "Commit":
      return askingToCommit(state) ? sailingCommitters(state, ctx) : committers(state, state.activeSeat, ctx);
    case "CommitHide":
      return state.window?.kind === "hideCommit" ? hideCommitters(state, state.window.seat, ctx.cards) : [];
    case "Travel":
      return canTravel(state, ctx) ? travelTargets(state, ctx) : [];
    case "Engage":
      return optionalEnemies(state, ctx.cards);
    case "ChooseEnemy":
      return state.window?.kind === "chooseEnemy" ? state.window.options : [];
    case "DeclareDefender": {
      const seat = state.pendingAttack?.seat ?? state.activeSeat;
      if (state.pendingAttack?.undefended) return [];
      return defenderIds(state, seat, ctx.cards).filter((id) => !defenseBlocked(state, ctx, id));
    }
    case "Undefended":
      return undefendedTargets(state, state.pendingAttack?.seat ?? state.activeSeat, ctx.cards);
    case "DeclareAttackers":
      return declarableEnemies(state, state.activeSeat, selection.cardId, ctx.cards);
    case "Distribute":
      return archeryRecipients(state, ctx.cards, state.window?.kind === "archery" ? state.window.seat : undefined);
  }
}

export function rejectionReason(state: ScenarioState, intent: PlayerIntent, ctx: ReduceContext): string | null {
  if (suppliesNumber(intent)) return NUMBER;
  if (state.lost) return "The game is lost";
  // Resigning is open to the table at any moment, a Peril lock or an eliminated active seat included.
  if (intent.type === "Resign") return null;
  if (state.seats[state.activeSeat]?.eliminated) return "That seat is eliminated";
  const locked = perilLock(state);
  if (locked != null && state.activeSeat !== locked && !mandatory(state)) {
    return "Peril: other seats cannot act";
  }
  // No Action is used during a Sailing test (dcce.sailing-tests).
  const blocked = sailingBlocks(state, intent.type);
  if (blocked) return blocked;
  switch (intent.type) {
    case "Keep":
      return state.window?.kind === "mulligan" ? null : "Mulligan is closed";
    case "Mulligan":
      if (state.window?.kind !== "mulligan") return "Mulligan is closed";
      return state.mulliganSeats.includes(state.activeSeat) ? "A second mulligan is not allowed" : null;
    case "Pass":
      return state.window?.kind === "pass" ||
        state.window?.kind === "frameAction" ||
        state.window?.kind === "cancelOffer" ||
        state.window?.kind === "look" ||
        state.window?.kind === "response"
        ? null
        : "That intent is not legal in this window";
    case "PlayCard":
      return playReason(state, intent, ctx);
    case "Commit":
      return askingToCommit(state) ? sailingCommitReason(state, intent.cardIds, ctx) : commitReason(state, intent, ctx);
    case "CommitHide":
      return hideCommitReason(state, intent, ctx);
    case "Trigger":
      return triggerReason(state, intent, ctx);
    case "Choose":
      return optionReason(state, intent);
    case "ChooseResolution":
      return resolutionReason(state, intent, ctx);
    case "Travel":
      return travelReason(state, intent, ctx);
    case "DeclineTravel":
      if (state.window?.kind !== "travel") return "That intent is not legal in this window";
      return mustTravelNow(state, ctx) && canTravel(state, ctx) && travelTargets(state, ctx).length > 0 ? "The players must travel to a location, if able" : null;
    case "Engage":
      return engageReason(state, intent, ctx);
    case "DeclineEngage":
      return state.window?.kind === "optionalEngage" ? null : "That intent is not legal in this window";
    case "ChooseEnemy":
      return choiceReason(state, intent);
    case "DeclareDefender":
      return defenderReason(state, intent, ctx);
    case "Undefended":
      return undefendedReason(state, intent, ctx);
    case "DeclareAttackers":
      return attackReason(state, intent, ctx);
    case "DeclineAttack":
      return state.window?.kind === "playerAttack" ? null : "That intent is not legal in this window";
    case "Distribute":
      return distributeReason(state, intent, ctx);
    default:
      return "That intent is not legal in this window";
  }
}

// A decision the rules force on a seat is not an action Peril can take away.
function mandatory(state: ScenarioState): boolean {
  const kind = state.window?.kind;
  return kind === "choose" || kind === "cancelOffer" || kind === "defense";
}

function passIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  const intents: LegalIntent[] = [{ type: "Pass" }];
  // Events are Actions and may be played in any action window; allies and attachments in the planning phase.
  // The top card of the deck too, when a hero lets the seat play it (Gandalf).
  const top = state.seats[state.activeSeat]?.deck[0];
  for (const cardId of [...(state.seats[state.activeSeat]?.hand ?? []), ...(top ? [top] : []), ...discardPlayable(state, state.activeSeat, ctx)]) {
    if (playWindowReason(state, cardId, ctx) === null) intents.push({ type: "PlayCard", cardId });
  }
  // The quest commitment is open in the pass window only, not in an action window between steps (a Sailing window before it, say).
  if (state.mode === "questCommit" && state.window?.kind === "pass") intents.push({ type: "Commit" });
  intents.push(...triggerIntents(state, ctx));
  return intents;
}

// A slot is free for the traveling seat: its own active location once stages are separate (families/breaking/areas.ts).
// Under Exploration the active location stays, and the players may travel from it once it holds progress equal to its quest points (families/island/travel.ts).
function canTravel(state: ScenarioState, ctx: ReduceContext): boolean {
  return freeSlot(viewOf(state, state.activeSeat)) != null || travelsOverActive(state) || islandMayTravel(state, ctx.cards);
}

// The locations the players may travel to: those in the staging area, and the ones the active location lets them reach beyond it (Winding Caverns, 12073:A:2).
function travelCandidates(state: ScenarioState, ctx: ReduceContext): string[] {
  const staged = stagingLocations(state, ctx.cards, state.separate ? state.activeSeat : undefined);
  return islandMayTravel(state, ctx.cards) ? [...staged, ...islandReach(state)] : staged;
}

function travelTargets(state: ScenarioState, ctx: ReduceContext): string[] {
  // Once stages are separate the seat that travels chooses among the locations of its own staging area.
  const open = travelCandidates(state, ctx).filter((id) => !travelBlocked(state, ctx, id) && !travelCostUnpayable(state, ctx, id));
  // A location that says the players must travel to it (01088:A:1) is the only one they may travel to.
  const forced = forcedTravel(state, ctx);
  return forced.length > 0 ? open.filter((id) => forced.includes(id)) : open;
}

// The players may not decline to travel: a card says they must (mec109.stage-4) or a location says they must travel to it (01088:A:1).
function mustTravelNow(state: ScenarioState, ctx: ReduceContext): boolean {
  return mustTravel(state) || forcedTravel(state, ctx).length > 0;
}

function travelIntents(state: ScenarioState, ctx: ReduceContext): LegalIntent[] {
  const intents: LegalIntent[] = [{ type: "DeclineTravel" }];
  if (canTravel(state, ctx) && travelTargets(state, ctx).length > 0) {
    // "The players must travel to a location, if able" (mec109.stage-4): no declining while they can.
    return mustTravelNow(state, ctx) ? [{ type: "Travel" }] : [{ type: "Travel" }, ...intents];
  }
  return intents;
}

function committers(state: ScenarioState, seat: number, ctx: ReduceContext): string[] {
  return characters(state, seat, ctx.cards).filter((id) => {
    const instance = state.cards[id];
    // "Can commit to quests while exhausted" (11009:A:1).
    return instance != null && (!instance.exhausted || flagged(state, id, "commitsExhausted")) && !instance.committed && !flagged(state, id, "cannotQuest");
  });
}

function commitReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "Commit" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "pass" || state.mode !== "questCommit") return "That intent is not legal in this window";
  if (intent.cardIds.length === 0) return "Commit at least one character";
  const legal = new Set(committers(state, state.activeSeat, ctx));
  for (const id of intent.cardIds) {
    if (!legal.has(id)) return "That character cannot commit";
  }
  return intent.sideQuestId ? sideQuestReason(state, intent.sideQuestId) : null;
}

function travelReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "Travel" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "travel") return "That intent is not legal in this window";
  if (!canTravel(state, ctx)) return exploring(state) ? "The active location needs progress equal to its quest points before the players can travel from it" : "An active location is already in play";
  if (!travelCandidates(state, ctx).includes(intent.locationId)) return "That location is not in staging";
  const forced = forcedTravel(state, ctx);
  if (forced.length > 0 && !forced.includes(intent.locationId)) return "The players must travel to the location that says so";
  if (travelBlocked(state, ctx, intent.locationId)) return "Players cannot travel to that location now";
  if (travelCostUnpayable(state, ctx, intent.locationId)) return "The players cannot pay that location's Travel cost";
  return null;
}

function engageReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "Engage" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "optionalEngage") return "That intent is not legal in this window";
  if (!optionalEnemies(state, ctx.cards).includes(intent.enemyId)) return "That enemy cannot be optionally engaged";
  return null;
}

function choiceReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "ChooseEnemy" }>): string | null {
  if (state.window?.kind !== "chooseEnemy") return "That intent is not legal in this window";
  if (!state.window.options.includes(intent.enemyId)) return "That enemy is not a legal choice";
  return null;
}

function defenderReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "DeclareDefender" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "defense" || !state.pendingAttack) return "That intent is not legal in this window";
  if (state.pendingAttack.undefended) return "This attack is considered undefended";
  const defender = state.cards[intent.defenderId];
  if (!defender) return "That character cannot defend";
  if (defender.controller !== state.pendingAttack.seat) {
    if (!hasKeyword(state, defender.id, "sentinel", ctx.cards)) return "Sentinel is required to defend for another seat";
  }
  // A ship-enemy's attack is defended only by a ship-objective (dcce.ship-enemies, dcce.ship-objectives).
  const ship = shipDefenseReason(state, printedOf(ctx.cards, defender.code), ctx.cards);
  if (ship) return ship;
  if (!canDefend(state, state.pendingAttack.seat, intent.defenderId, ctx.cards)) return "That character cannot defend";
  if (defenseBlocked(state, ctx, intent.defenderId)) return "That character cannot defend this enemy's attack";
  return null;
}

function undefendedReason(state: ScenarioState, intent: Extract<PlayerIntent, { type: "Undefended" }>, ctx: ReduceContext): string | null {
  if (state.window?.kind !== "defense" || !state.pendingAttack) return "That intent is not legal in this window";
  const heroes = undefendedTargets(state, state.pendingAttack.seat, ctx.cards);
  if (heroes.length === 0) return "No hero can take the attack";
  if (heroes.length === 1) {
    const only = heroes[0];
    if (intent.heroId != null && intent.heroId !== only) return "Choose a hero";
    return null;
  }
  if (intent.heroId == null || !heroes.includes(intent.heroId)) return "Choose a hero";
  return null;
}

function attackReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "DeclareAttackers" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "playerAttack") return "That intent is not legal in this window";
  if (intent.attackerIds.length === 0) return "Declare at least one attacker";
  const enemy = state.cards[intent.enemyId];
  if (!enemy || (enemy.zone !== "engaged" && enemy.zone !== "staging")) return "That enemy cannot be attacked";
  // A card's attack window, an attack into the staging area (families/attack/targets.ts).
  const ruled = attackRuleReason(state, intent);
  if (ruled) return ruled;
  if (attackDeclared(state, state.activeSeat, intent.enemyId)) return "That enemy was already attacked this phase";
  const seen = new Set<string>();
  for (const attackerId of intent.attackerIds) {
    if (seen.has(attackerId)) return "That character cannot attack twice";
    seen.add(attackerId);
    if (!canAttack(state, state.activeSeat, attackerId, intent.enemyId, ctx.cards)) {
      const ship = shipAttackReason(printedOf(ctx.cards, state.cards[attackerId]?.code ?? ""), printedOf(ctx.cards, enemy.code));
      if (ship) return ship;
      if (enemy.controller !== state.activeSeat) return "Ranged is required to attack an enemy engaged with another seat";
      return "That attack is illegal";
    }
  }
  return null;
}

function distributeReason(
  state: ScenarioState,
  intent: Extract<PlayerIntent, { type: "Distribute" }>,
  ctx: ReduceContext,
): string | null {
  if (state.window?.kind !== "archery") return "That intent is not legal in this window";
  const legal = new Set(archeryRecipients(state, ctx.cards, state.window.seat));
  const seen = new Set<string>();
  let sum = 0;
  for (const assignment of intent.assignments) {
    if (!Number.isInteger(assignment.amount) || assignment.amount < 0) return "That assignment is not a share of the total";
    if (seen.has(assignment.cardId) || !legal.has(assignment.cardId)) return "That character cannot take archery damage";
    seen.add(assignment.cardId);
    sum += assignment.amount;
  }
  if (sum !== state.window.total) return "Those amounts must sum to the total";
  return null;
}
