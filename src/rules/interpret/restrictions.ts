// Rules: rr.constant-ability, rr.step-6-4-1, rr.travel, rr.first-player (data/rules/entries.json).
import type { Instruction, PickSpec } from "../../catalog/boundary.ts";

import { holds } from "./conditions.ts";
import { constantInstructions, memoOf, type StateMemo } from "./constant-records.ts";
import type { ReduceContext } from "./interpret.ts";
import { effectsOfCard } from "../families/misc/text.ts";
import { recordsOfFace } from "../families/dreamchaser/faces.ts";
import { grantedTravel } from "../families/grapple/travel.ts";
import { familyForcedTravel, familyTravelUnpayable } from "./family-hooks.ts";
import { modifiedStat } from "../core/keywords.ts";
import { countMatching, pickCandidates } from "./pick.ts";
import { spendablePools } from "../families/costs/verbs.ts";
import { guardsTitled } from "../families/objectives/pick.ts";
import { guardianSeat } from "../families/guardian/seats.ts";
import { joiningStages } from "../families/captured/join.ts";
import { guardedSafeLocation } from "../families/angmar/safe.ts";
import { flightDefenseBarred } from "../families/attack/flight.ts";
import { isPlayerType, printedOf } from "../core/printed.ts";
import { flagged, heldAmount, inPlay, livingSeats, type CardInstance, type ScenarioState } from "../core/state.ts";
import { frameScope, resolveAmount } from "./amounts.ts";

type Restrict = Extract<Instruction, { verb: "Restrict" }>;
// The `exceptTrait` the template "Cannot have non-<X> attachments" reads from the printed phrase "non-objective player card attachments" (51012:A:1): a card kind, not a Trait.
const OBJECTIVE_PLAYER_CARD = "objective player card";
// "Cannot have non-objective attachments" (19038:A:1, 19098:A:1): the same template word, a card type too: only an objective card may attach.
const OBJECTIVE = "objective";

export type Restriction = { sourceId: string; what: Restrict["what"]; location?: string; guarding?: string; trait?: string; exceptTrait?: string; withResources?: true; exceptBoon?: true; maxWillpower?: number; allies?: boolean; belowSourceHitPoints?: boolean; anyDefender?: true; exceptSelf?: boolean; unlessControls?: PickSpec; guardian?: true; exceptAlone?: true; engagedPlayer?: true };

// Rules from constant effects that forbid something. The question names what is being asked about, and
// each record names the card it came from, so a caller can tell whose rule it is.
// Kept for each state and question, so a caller must not change the list.
const RESTRICTED: StateMemo<Map<Restrict["what"], readonly Restriction[]>> = new WeakMap();

export function restricted(state: ScenarioState, ctx: ReduceContext, what: Restrict["what"]): readonly Restriction[] {
  const asked = memoOf(RESTRICTED, state, ctx, () => new Map());
  let found = asked.get(what);
  if (!found) {
    found = scanRestricted(state, ctx, what);
    asked.set(what, found);
  }
  return found;
}

function scanRestricted(state: ScenarioState, ctx: ReduceContext, what: Restrict["what"]): Restriction[] {
  const found: Restriction[] = what === "advance" ? joiningStages(state, ctx) : [];
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "Restrict" || instruction.what !== what) continue;
    // Once stages are separate "cannot defeat this stage" binds that stage only: another seat's stage does not hold this one back (148003:B:3 at stage 3B, 148004 at a trapped player's stage).
    if (what === "advance" && state.separate && source.zone === "questStage" && source.id !== state.questStage) continue;
    found.push({
      sourceId: source.id,
      what,
      ...(instruction.location ? { location: instruction.location } : {}),
      ...(instruction.guarding ? { guarding: instruction.guarding } : {}),
      ...(instruction.trait ? { trait: instruction.trait } : {}),
      ...(instruction.exceptTrait ? { exceptTrait: instruction.exceptTrait } : {}),
      ...(instruction.withResources ? { withResources: true as const } : {}),
      ...(instruction.exceptBoon ? { exceptBoon: true as const } : {}),
      ...(instruction.maxWillpower != null ? { maxWillpower: instruction.maxWillpower } : {}),
      ...(instruction.allies ? { allies: true } : {}),
      ...(instruction.belowSourceHitPoints ? { belowSourceHitPoints: true } : {}),
      ...(instruction.anyDefender ? { anyDefender: true as const } : {}),
      ...(instruction.exceptSelf ? { exceptSelf: true } : {}),
      ...(instruction.unlessControls ? { unlessControls: instruction.unlessControls } : {}),
      ...(instruction.guardian ? { guardian: true as const } : {}),
      ...(instruction.exceptAlone ? { exceptAlone: true as const } : {}),
      ...(instruction.engagedPlayer ? { engagedPlayer: true as const } : {}),
    });
  }
  return found;
}

export function travelBlocked(state: ScenarioState, ctx: ReduceContext, locationId: string): boolean {
  const location = state.cards[locationId];
  // A location that cannot leave the staging area cannot become the active location ("Each non-unique location ... cannot leave the staging area", 146066:B:1).
  if (flagged(state, locationId, "cannotLeaveStaging")) return true;
  // A guarded safe objective-location waits for its guard to leave play (mec108.objective-locations).
  if (guardedSafeLocation(state, ctx, locationId)) return true;
  return restricted(state, ctx, "travel").some((rule) => {
    // Every location but the source (South Pier, 50217:A:2: "players cannot travel to other locations").
    if (rule.exceptSelf) return rule.sourceId !== locationId;
    // Every location that holds a resource (A Fork in the Road, 51003:B:2).
    if (rule.withResources) return (location?.resources ?? 0) > 0;
    // Every location with a trait (Grond's, 145044:A:1 and the Gate's kin).
    if (rule.trait != null) return printedOf(ctx.cards, location?.code ?? "").traits.includes(rule.trait);
    // A restriction on the location itself.
    if (rule.location == null) return rule.sourceId === locationId;
    // One a card puts on the location with this code ("The players cannot travel to The Old Ford", 18068:B:1).
    return location?.code === rule.location && (rule.guarding == null || guardsTitled(state, ctx, locationId, rule.guarding));
  });
}

/**
 * Why the players cannot travel to the location, when a quest stage holds them back until it has enough progress ("The players cannot travel to The Old Ford unless there is at least 5 progress here", 18068:B:1):
 * the stage's name, what it needs and what it has. Null for any other restriction, which keeps the engine's general reason.
 */
export function travelProgressReason(state: ScenarioState, ctx: ReduceContext, locationId: string): string | null {
  const rule = restricted(state, ctx, "travel").find((entry) => entry.location != null && state.cards[locationId]?.code === entry.location && (entry.guarding == null || guardsTitled(state, ctx, locationId, entry.guarding)));
  const source = rule ? state.cards[rule.sourceId] : undefined;
  if (!source) return null;
  for (const effect of effectsOfCard(state, ctx, source)) {
    const gate = effect.condition?.kind === "not" ? effect.condition.condition : undefined;
    if (effect.timing !== "constant" || gate?.kind !== "stageProgress" || !effect.instructions.some((instruction) => instruction.verb === "Restrict" && instruction.what === "travel")) continue;
    return `${printedOf(ctx.cards, source.code).name}: the players cannot travel here until the stage has ${gate.min} progress (${source.progress} now)`;
  }
  return null;
}

// "When faced with the option to travel, the players must travel to The East Bight if there is no active location" (01088:A:1): the
// locations in the staging area whose constant says travelOnly, while no location is active and the players can travel to them. They must
// travel to one of these and may not decline or go elsewhere.
export function forcedTravel(state: ScenarioState, ctx: ReduceContext): string[] {
  if (state.activeLocation || state.secondActiveLocation) return [];
  const only = restricted(state, ctx, "travelOnly")
    .map((rule) => rule.sourceId)
    .filter((id) => state.cards[id]?.zone === "staging" && !travelBlocked(state, ctx, id) && !travelCostUnpayable(state, ctx, id));
  // A family's rule that the players must travel to a location because they cannot pay for not traveling (Streets of Umbar, 12160:A:1, families/sea/streets.ts).
  const titled = familyForcedTravel(state, ctx).filter((id) => !travelBlocked(state, ctx, id) && !travelCostUnpayable(state, ctx, id));
  return [...only, ...titled];
}

// "If the players cannot pay the Travel cost, then they cannot travel to that location." (rr.travel). A Travel cost that
// exhausts a named card can be paid only while a ready copy of that card is in play, and, when the line names who exhausts
// it, under that player's control: Weathertop (141046:A:3) prints "The first player must exhaust The One Ring to travel
// here", so the Ring must be ready and controlled by the player who holds the first player token now (rr.first-player); in
// two-handed play that is not the Ring-bearer's seat every round. A Hide test on a Travel line is not a cost the players
// can fail to pay. A Travel cost of cards (discard 2 at random, each player exhausts a hero) needs the cards to pay it.
export function travelCostUnpayable(state: ScenarioState, ctx: ReduceContext, locationId: string): boolean {
  const code = state.cards[locationId]?.code;
  if (code == null) return false;
  // Only the Travel effect of the side the location shows counts: the Temple of the Deceived side of a map location prints one that its other side does not (12068:B:3).
  const shown = state.cards[locationId];
  const instructions = [...(shown ? recordsOfFace(shown, ctx.effects.filter((effect) => effect.cardCode === code)) : []).filter((effect) => effect.timing === "travel").flatMap((effect) => effect.instructions), ...grantedTravel(state, locationId)];
  return instructions.some((instruction) => {
      // A cost line that is gated (`when`) is owed only while its condition holds: Fisherman's Dock's exhaust is owed with 1 active location (50223:A:2).
      if ("when" in instruction && instruction.when != null && !holds(state, instruction.when, { actor: state.firstPlayer, sourceId: locationId, returned: 0 }, ctx)) return false;
      // "A player at this staging area must engage an enemy in any staging area to travel here" (142079:A:1): an enemy to engage must be in some staging area.
      // "Place 1 resource on Shelob to travel here" (144045:A:3): the card the resources go on is picked and must be in play.
      if ((instruction.verb === "Engage" && instruction.target === "picked") || (instruction.verb === "PlaceResourceTokens" && instruction.on === "picked")) {
        const pick = instructions.find((other) => other.verb === "Pick");
        return pick?.verb === "Pick" && pickCandidates(state, pick.pick, state.activeSeat, [], locationId, ctx).length === 0;
      }
      // "Spend 1 Fellowship resource to travel here" (144020:A:3): a hero of the players must hold the resources, the record says whose (`group`: any player's).
      if (instruction.verb === "SpendResources") return spendablePools(state, state.firstPlayer, instruction, ctx).total < resolveAmount(state, instruction.amount, frameScope(state, state.firstPlayer, locationId), ctx);
      // "Either exhaust Sméagol, or discard 1 random card from each player's hand" (144044:A:2): a cost of a choice is payable when some option can be taken (rr.effects, rr.cost).
      if (instruction.verb === "Choose") return !instruction.options.some((option) => option.requires == null || holds(state, option.requires, { actor: state.firstPlayer, sourceId: locationId, returned: 0 }, ctx));
      // "Reveal the top card of the burden deck to travel here" (141058:A:3): an empty burden deck has none to reveal.
      if (instruction.verb === "RevealBurden") return (state.burdenDeck?.length ?? 0) === 0;
      // A family's own Travel cost the players cannot pay (the Corsair deck of Southern Belfalas is empty, 12154:A:1, families/sea/index.ts).
      if (familyTravelUnpayable(state, instruction, ctx, locationId)) return true;
      // "The first player must discard 2 cards at random from his hand to travel here" (01094:A:1): a hand of fewer cannot pay it.
      if (instruction.verb === "DiscardRandomFromHand" && instruction.who === "firstPlayer" && typeof instruction.amount === "number") {
        return (state.seats[state.firstPlayer]?.hand.length ?? 0) < instruction.amount;
      }
      // "Each player must exhaust 1 hero he controls to travel here" (01077:A:1): every player needs a card to choose.
      // "Each player must discard 1 random card from his hand to travel here" (41011:A:2): every player needs the cards.
      const discards = instruction.verb === "ForEachPlayer" ? instruction.instructions.find((inner) => inner.verb === "DiscardRandomFromHand") : undefined;
      if (discards?.verb === "DiscardRandomFromHand") {
        const amount = discards.amount ?? 1;
        return typeof amount === "number" && livingSeats(state).some((seat) => (state.seats[seat]?.hand.length ?? 0) < amount);
      }
      if (instruction.verb === "ForEachPlayer") {
        const cost = instruction.instructions.find((inner) => inner.verb === "Pick");
        const exhausts = instruction.instructions.some((inner) => inner.verb === "Exhaust");
        // `seats: "guardian"` (02133:A:1): only the player guarding Gollum pays.
        const payers = instruction.seats === "guardian" ? livingSeats(state).filter((seat) => seat === guardianSeat(state)) : livingSeats(state);
        return cost?.verb === "Pick" && exhausts && payers.some((seat) => pickCandidates(state, cost.pick, seat, [], locationId, ctx).length === 0);
      }
      // "Remove 4 damage from Cracked Pillar to travel here" (41028:A:2): the location must hold that much damage.
      if (instruction.verb === "Heal" && instruction.target === "self" && typeof instruction.amount === "number") return (state.cards[locationId]?.damage ?? 0) < instruction.amount;
      // "Move 2 progress from the main quest to the Stormcaller's quest stage" (12026:A:1): the quest card must hold that much progress.
      if (instruction.verb === "MoveProgressToStormcaller" && typeof instruction.amount === "number") {
        return (state.questStage ? (state.cards[state.questStage]?.progress ?? 0) : 0) < instruction.amount;
      }
      // "Exhaust a Ship objective to travel here" (12128:A:2): the card to exhaust is picked, so the cost cannot be paid without one.
      if (instruction.verb === "Exhaust" && instruction.target?.kind === "picked") {
        const pick = instructions.find((other) => other.verb === "Pick");
        // "The first player must exhaust 2 characters to travel here" (04066:A:1): one ready card for each exhaust of the cost.
        const needed = instructions.filter((other) => other.verb === "Exhaust" && other.target?.kind === "picked").length;
        return pick?.verb === "Pick" && pickCandidates(state, pick.pick, state.activeSeat, [], locationId, ctx).length < needed;
      }
      // "The first player must discard 1 event card from his hand to travel here" (02088:A:1): the card discarded is picked, so the cost cannot be paid without one.
      if (instruction.verb === "DiscardPicked") {
        const pick = instructions.find((other) => other.verb === "Pick");
        return pick?.verb === "Pick" && pickCandidates(state, pick.pick, state.firstPlayer, [], locationId, ctx).length === 0;
      }
      if (instruction.verb !== "Exhaust" || (instruction.target?.kind !== "byCode" && instruction.target?.kind !== "byName")) return false;
      return readyNamedCard(state, ctx, instruction.target, instruction.who === "firstPlayer" ? state.firstPlayer : null) == null;
    });
}

/** The card in play that an Exhaust names by code or by title and that is ready ("Exhaust the Gate Key to travel here"): a card named by title is one a player controls. `payer`: only a card this seat controls. */
export function readyNamedCard(state: ScenarioState, ctx: ReduceContext, target: { kind: "byCode"; code: string } | { kind: "byName"; name: string }, payer: number | null): CardInstance | undefined {
  return Object.values(state.cards).find(
    (card) => (target.kind === "byCode" ? card.code === target.code : printedOf(ctx.cards, card.code).name === target.name) && inPlay(card.zone) && !card.exhausted && (target.kind === "byCode" || card.controller != null) && (payer == null || card.controller === payer),
  );
}

export function attachBlocked(state: ScenarioState, ctx: ReduceContext, hostId: string, attachmentCode: string): boolean {
  const traits = printedOf(ctx.cards, attachmentCode).traits;
  if (flagged(state, hostId, "cannotHaveAttachments")) return true;
  if (flagged(state, hostId, "noPlayerAttachments") && isPlayerType(printedOf(ctx.cards, attachmentCode))) return true;
  if (flagged(state, hostId, "cannotHaveTreachery") && printedOf(ctx.cards, attachmentCode).type === "treachery") return true;
  if (flagged(state, hostId, "cannotHaveRestricted") && printedOf(ctx.cards, attachmentCode).keywords.restricted) return true;
  const printed = printedOf(ctx.cards, attachmentCode);
  // "Cannot have non-objective player card attachments" (51012:A:1): only a player card that is not an objective is barred; an encounter card, an objective and a Condition an encounter card makes may attach.
  const playerCard = isPlayerType(printed) && printed.type !== "objective";
  return restricted(state, ctx, "attach").some(
    (rule) => rule.sourceId === hostId && (rule.exceptTrait === OBJECTIVE_PLAYER_CARD ? playerCard : rule.exceptTrait === OBJECTIVE ? printed.type !== "objective" : !(rule.exceptTrait != null && traits.includes(rule.exceptTrait))) && !(rule.exceptBoon === true && printed.campaignKind === "boon"),
  );
}

// The character cannot defend the attack in progress: "Characters with 1 Willpower or less cannot defend attacks made by The
// Witch-king" (141068:A:3) is a rule of the attacking enemy, read against the character's willpower now. "Allies cannot defend against
// Orc-chieftain" (142045:A:1) bars every ally.
export function defenseBlocked(state: ScenarioState, ctx: ReduceContext, defenderId: string): boolean {
  const attack = state.pendingAttack;
  const defender = state.cards[defenderId];
  if (!attack || !defender) return false;
  // "Only Eagle characters or characters with ranged can ... defend against Mirkwood Flock" (02070:A:1).
  if (flightDefenseBarred(state, attack.enemyId, defenderId, ctx.cards)) return true;
  // A defender an effect removed from this attack cannot be declared again (51335:A:2).
  if (attack.removedDefenders?.includes(defenderId)) return true;
  return restricted(state, ctx, "defend").some(
    (rule) =>
      rule.sourceId === attack.enemyId &&
      (rule.anyDefender === true ||
        (rule.belowSourceHitPoints
          ? printedOf(ctx.cards, defender.code).type === "ally" && (printedOf(ctx.cards, defender.code).health ?? 0) < (printedOf(ctx.cards, state.cards[rule.sourceId]?.code ?? "").health ?? 0)
          : rule.allies
            ? printedOf(ctx.cards, defender.code).type === "ally"
            : modifiedStat(state, defender, "willpower", ctx.cards) <= (rule.maxWillpower ?? 0))),
  );
}

// The hero does not count against the hero limit while a card attached to it says so.
export function heroLimitExempt(state: ScenarioState, ctx: ReduceContext, heroId: string): boolean {
  return restricted(state, ctx, "heroLimit").some((rule) => rule.sourceId === heroId || state.cards[rule.sourceId]?.host === heroId);
}

// Attachments of the card that carry the Restricted keyword.
export function restrictedAttachments(state: ScenarioState, hostId: string, ctx: ReduceContext): string[] {
  const host = state.cards[hostId];
  if (!host) return [];
  return host.attachments.filter((id) => {
    const attachment = state.cards[id];
    // Snowmane "loses the restricted keyword" while a flag says so (families/misc/traits.ts).
    return attachment != null && (printedOf(ctx.cards, attachment.code).keywords.restricted || flagged(state, id, "countsAsRestricted")) && !flagged(state, id, "losesRestricted");
  });
}

// How many restricted attachments the card counts as having: one each, two for a card that "counts as 2 Restricted attachments".
export function restrictedLoad(state: ScenarioState, hostId: string, ctx: ReduceContext): number {
  return restrictedAttachments(state, hostId, ctx).reduce((sum, id) => sum + Math.max(1, heldAmount(state, id, "countsAsRestricted")), 0);
}

// Whether the seat is barred by a "commit" or "draw" rule: it controls no card that matches the rule's `unlessControls` filter, read from its own side (02013:B:1 "Any player who does not control a hero with at least 1 Clue objective attached cannot commit
// characters to this quest"; 900404:A:1 "Each player who does not control at least 1 Clue card cannot draw cards through card effects").
// A rule with `guardian` binds the player guarding Gollum (02127:B:1, 02128:B:1), unless `exceptAlone` and he is the only player left in the game.
export function seatBarred(state: ScenarioState, ctx: ReduceContext, seat: number, what: "commit" | "draw" | "playFromHand"): boolean {
  return restricted(state, ctx, what).some(
    (rule) =>
      (rule.unlessControls != null && countMatching(state, rule.unlessControls, seat, rule.sourceId, ctx) === 0) ||
      (rule.guardian === true && guardianSeat(state) === seat && !(rule.exceptAlone === true && livingSeats(state).length === 1)) ||
      (rule.engagedPlayer === true && state.cards[rule.sourceId]?.zone === "engaged" && state.cards[rule.sourceId]?.controller === seat),
  );
}
