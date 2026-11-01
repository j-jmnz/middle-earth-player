// Rules: rr.constant-ability, rr.step-6-4-1, rr.travel, rr.first-player (data/rules/entries.json).
import type { Instruction } from "../catalog/boundary.ts";

import { constantInstructions, memoOf, type StateMemo } from "./constant-records.ts";
import type { ReduceContext } from "./interpret.ts";
import { recordsOfFace } from "./families/dreamchaser-faces.ts";
import { grantedTravel } from "./families/grapple-travel.ts";
import { modifiedStat } from "./keywords.ts";
import { pickCandidates } from "./pick.ts";
import { isPlayerType, printedOf } from "./printed.ts";
import { flagged, heldAmount, inPlay, livingSeats, type ScenarioState } from "./state.ts";

type Restrict = Extract<Instruction, { verb: "Restrict" }>;
export type Restriction = { sourceId: string; what: Restrict["what"]; exceptTrait?: string; maxWillpower?: number; allies?: boolean; belowSourceHitPoints?: boolean };

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
  const found: Restriction[] = [];
  for (const { source, instruction } of constantInstructions(state, ctx)) {
    if (instruction.verb !== "Restrict" || instruction.what !== what) continue;
    found.push({
      sourceId: source.id,
      what,
      ...(instruction.exceptTrait ? { exceptTrait: instruction.exceptTrait } : {}),
      ...(instruction.maxWillpower != null ? { maxWillpower: instruction.maxWillpower } : {}),
      ...(instruction.allies ? { allies: true } : {}),
      ...(instruction.belowSourceHitPoints ? { belowSourceHitPoints: true } : {}),
    });
  }
  return found;
}

export function travelBlocked(state: ScenarioState, ctx: ReduceContext, locationId: string): boolean {
  return restricted(state, ctx, "travel").some((rule) => rule.sourceId === locationId);
}

// "When faced with the option to travel, the players must travel to The East Bight if there is no active location" (01088:A:1): the
// locations in the staging area whose constant says travelOnly, while no location is active and the players can travel to them. They must
// travel to one of these and may not decline or go elsewhere.
export function forcedTravel(state: ScenarioState, ctx: ReduceContext): string[] {
  if (state.activeLocation || state.secondActiveLocation) return [];
  return restricted(state, ctx, "travelOnly")
    .map((rule) => rule.sourceId)
    .filter((id) => state.cards[id]?.zone === "staging" && !travelBlocked(state, ctx, id) && !travelCostUnpayable(state, ctx, id));
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
      // "A player at this staging area must engage an enemy in any staging area to travel here" (142079:A:1): an enemy to engage must be in some staging area.
      if (instruction.verb === "Engage" && instruction.target === "picked") {
        const pick = instructions.find((other) => other.verb === "Pick");
        return pick?.verb === "Pick" && pickCandidates(state, pick.pick, state.activeSeat, [], locationId, ctx).length === 0;
      }
      // "Reveal the top card of the burden deck to travel here" (141058:A:3): an empty burden deck has none to reveal.
      if (instruction.verb === "RevealBurden") return (state.burdenDeck?.length ?? 0) === 0;
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
        return cost?.verb === "Pick" && exhausts && livingSeats(state).some((seat) => pickCandidates(state, cost.pick, seat, [], locationId, ctx).length === 0);
      }
      // "Remove 4 damage from Cracked Pillar to travel here" (41028:A:2): the location must hold that much damage.
      if (instruction.verb === "Heal" && instruction.target === "self" && typeof instruction.amount === "number") return (state.cards[locationId]?.damage ?? 0) < instruction.amount;
      // "Move 2 progress from the main quest to the Stormcaller's quest stage" (12026:A:1): the quest card must hold that much progress.
      if (instruction.verb === "MoveProgressToStormcaller" && typeof instruction.amount === "number") {
        return (state.questStage ? (state.cards[state.questStage]?.progress ?? 0) : 0) < instruction.amount;
      }
      if (instruction.verb !== "Exhaust" || (instruction.target?.kind !== "byCode" && instruction.target?.kind !== "byName")) return false;
      const target = instruction.target;
      const payer = instruction.who === "firstPlayer" ? state.firstPlayer : null;
      return !Object.values(state.cards).some(
        (card) => (target.kind === "byCode" ? card.code === target.code : printedOf(ctx.cards, card.code).name === target.name) && inPlay(card.zone) && !card.exhausted && (target.kind === "byCode" || card.controller != null) && (payer == null || card.controller === payer),
      );
    });
}

export function attachBlocked(state: ScenarioState, ctx: ReduceContext, hostId: string, attachmentCode: string): boolean {
  const traits = printedOf(ctx.cards, attachmentCode).traits;
  if (flagged(state, hostId, "cannotHaveAttachments")) return true;
  if (flagged(state, hostId, "noPlayerAttachments") && isPlayerType(printedOf(ctx.cards, attachmentCode))) return true;
  if (flagged(state, hostId, "cannotHaveRestricted") && printedOf(ctx.cards, attachmentCode).keywords.restricted) return true;
  return restricted(state, ctx, "attach").some(
    (rule) => rule.sourceId === hostId && !(rule.exceptTrait != null && traits.includes(rule.exceptTrait)),
  );
}

// The character cannot defend the attack in progress: "Characters with 1 Willpower or less cannot defend attacks made by The
// Witch-king" (141068:A:3) is a rule of the attacking enemy, read against the character's willpower now. "Allies cannot defend against
// Orc-chieftain" (142045:A:1) bars every ally.
export function defenseBlocked(state: ScenarioState, ctx: ReduceContext, defenderId: string): boolean {
  const attack = state.pendingAttack;
  const defender = state.cards[defenderId];
  if (!attack || !defender) return false;
  return restricted(state, ctx, "defend").some(
    (rule) =>
      rule.sourceId === attack.enemyId &&
      (rule.belowSourceHitPoints
        ? printedOf(ctx.cards, defender.code).type === "ally" && (printedOf(ctx.cards, defender.code).health ?? 0) < (printedOf(ctx.cards, state.cards[rule.sourceId]?.code ?? "").health ?? 0)
        : rule.allies
          ? printedOf(ctx.cards, defender.code).type === "ally"
          : modifiedStat(state, defender, "willpower", ctx.cards) <= (rule.maxWillpower ?? 0)),
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
    // Snowmane "loses the restricted keyword" while a flag says so (families/misc-traits.ts).
    return attachment != null && (printedOf(ctx.cards, attachment.code).keywords.restricted || flagged(state, id, "countsAsRestricted")) && !flagged(state, id, "losesRestricted");
  });
}

// How many restricted attachments the card counts as having: one each, two for a card that "counts as 2 Restricted attachments".
export function restrictedLoad(state: ScenarioState, hostId: string, ctx: ReduceContext): number {
  return restrictedAttachments(state, hostId, ctx).reduce((sum, id) => sum + Math.max(1, heldAmount(state, id, "countsAsRestricted")), 0);
}
