// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, rr.travel (data/rules/entries.json); ledger lines 12051:A:1 to 12054:A:1, 12041:B:2, 12052:A:3, 12050:A:3, 12044:A:1. What the table says of the enemies grappled with a
// location: they are facedown under it, count against nothing the players can choose, and add 2 Threat each to it; what traveling to it does; the Threat a Ship location has against the number that loses the game
// at stage 3; where an attack of the Thing and of a detached arm comes from. The sentences the preview, the screen reader, the sheets and the log read from. Pure.
import type { Instruction } from "../catalog/boundary.ts";
import { GRAPPLE_THREAT, grappledWith } from "../rules/families/grapple-values.ts";
import { grantedTravel, travelsOverActive } from "../rules/families/grapple-travel.ts";
import { modifiedStat } from "../rules/keywords.ts";
import { effectsOf } from "../rules/listen.ts";
import { printedOf, type PrintedCard } from "../rules/printed.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import type { ChoiceNames, PickWords } from "./choice-words.ts";

/** "Grappled: 2 facedown enemies, +4 Threat": the enemies grappled with a location, never named (they are facedown), and the Threat they add. Null with none. */
export function grappledWords(count: number): string | null {
  if (count <= 0) return null;
  return `Grappled: ${count} facedown ${count === 1 ? "enemy" : "enemies"}, +${count * GRAPPLE_THREAT} Threat`;
}

/** The sentence for the location with this id, or null when no enemy is grappled with it. */
export function grappleDetail(game: ScenarioState, locationId: string): string | null {
  return grappledWords(grappledWith(game, locationId).length);
}

/** The sentence as a screen reader hears it after a card's name: " · Grappled: 2 facedown enemies, +4 Threat", or nothing. */
export function grappleTell(game: ScenarioState, locationId: string): string {
  const detail = grappleDetail(game, locationId);
  return detail ? ` · ${detail}` : "";
}

/** The enemy that attached itself to a location as it was revealed or resolved: it was faceup when it was revealed, so the line names it and the location. */
export function grappleLine(enemy: string, location: string): string {
  return `${enemy} grapples with ${location}`;
}

/** An enemy came out from under the location it was grappled with and was added to the staging area, faceup. */
export function detachLine(enemy: string, location: string): string {
  return `${enemy} comes out from under ${location}`;
}

/** The enemy a Forced effect of its own makes attack as it is detached (Crushing Arm, 12052:A:3). */
function attacksWhenDetached(game: ScenarioState, ctx: ReduceContext, id: string): boolean {
  const code = game.cards[id]?.code;
  return code != null && effectsOf(ctx, code).some((effect) => effect.trigger === "grappleDetached" && effect.instructions.some((instruction) => instruction.verb === "AttackFromStaging"));
}

/** What the travel row of a location with grappled enemies says: the count (a facedown card is never named) and the attack a detached arm makes, and the caution that arms the confirm. Null with none grappled. */
export type GrappleTravel = { words: string; caution: string };

export function grappleTravel(game: ScenarioState, ctx: ReduceContext, locationId: string): GrappleTravel | null {
  const arms = grappledWith(game, locationId);
  if (arms.length === 0) return null;
  const attackers = arms.filter((id) => attacksWhenDetached(game, ctx, id)).length;
  const out = arms.length === 1 ? "1 enemy comes out from under it and joins the staging area" : `${arms.length} enemies come out from under it and join the staging area`;
  const attack = attackers === 0 ? "" : attackers === 1 ? ", and one attacks the first player" : `, and ${attackers} attack the first player`;
  return { words: `${out}${attack}`, caution: `Tap again: ${out}${attack}` };
}

/** The sheet's note for a travel choice: only the location's own printed Threat stops counting, the enemies grappled with it come out and add theirs. */
export function travelNote(game: ScenarioState, locationIds: readonly string[]): string {
  const grappled = locationIds.some((id) => grappledWith(game, id).length > 0);
  return grappled
    ? "The location becomes active and leaves staging: its own Threat stops counting, and the enemies grappled with it join the staging area and add theirs. Progress goes on it before the quest."
    : "The location becomes active and leaves staging: its threat stops counting, and progress goes on it before the quest.";
}

/** Stage 3B lets the players travel while a location is active: the active location returns to the staging area, and its Threat counts there again. Null when it does not apply. */
export function returnsNote(game: ScenarioState, ctx: ReduceContext, name: (id: string) => string): string | null {
  const active = game.activeLocation ? game.cards[game.activeLocation] : undefined;
  if (!active || !travelsOverActive(game)) return null;
  return `${name(active.id)} returns to the staging area (Threat ${modifiedStat(game, active, "threat", ctx.cards)}).`;
}

/** A Travel cost a card gave the location ("each other Deck location gains: Travel: each player must exhaust a character he controls", 12044:A:1), as the row says it. Null when it has none. */
export function grantedTravelWords(game: ScenarioState, locationId: string): string | null {
  return grantedTravel(game, locationId).length > 0 ? "Travel: each player exhausts a character they control" : null;
}

/** The Threat a Ship location has against the total that loses the game at the end of the round (12041:B:2): the pill's count, whether it is at the limit, and the sentence. */
export type ShipLoss = { text: string; danger: boolean; speech: string };

export function shipLoss(game: ScenarioState, ctx: ReduceContext, locationId: string): ShipLoss | null {
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const rule = stage ? effectsOf(ctx, stage.code).find((effect) => effect.condition?.kind === "locationThreat") : undefined;
  const condition = rule?.condition;
  const card = game.cards[locationId];
  if (condition?.kind !== "locationThreat" || !card || (card.zone !== "staging" && card.zone !== "activeLocation" && card.zone !== "secondActiveLocation")) return null;
  const printed = printedOf(ctx.cards, card.code);
  if (printed.type !== "location" || !printed.traits.includes(condition.trait)) return null;
  const threat = modifiedStat(game, card, "threat", ctx.cards);
  const danger = threat >= condition.min;
  return {
    text: `${threat}/${condition.min}`,
    danger,
    speech: danger ? `Threat ${threat} of ${condition.min}: at the end of the round the players lose` : `Threat ${threat} of ${condition.min}: at ${condition.min}, at the end of the round, the players lose`,
  };
}

/** Where an attack that is not an engaged enemy's comes from, for the defense sheet's note: the Thing attacking from the staging area while Eye of the Beast is engaged with the defender (12050:A:3), or an
 * arm detached from its location (12052:A:3). Empty for any other attack. */
export function attackSource(game: ScenarioState, ctx: ReduceContext, name: (id: string) => string): string {
  const attack = game.pendingAttack;
  const enemy = attack ? game.cards[attack.enemyId] : undefined;
  if (!attack || !enemy) return "";
  const relay = (game.seats[attack.seat]?.engaged ?? []).find((id) => game.modifiers.some((modifier) => modifier.stat === "relaysAttack" && modifier.instanceId === id));
  if (enemy.zone === "staging" && attack.immediate !== true && relay != null) return ` ${name(relay)} is engaged with ${attack.seat === game.activeSeat && game.seatCount === 1 ? "you" : `Player ${attack.seat + 1}`}: ${name(enemy.id)} attacks ${game.seatCount === 1 ? "you" : `Player ${attack.seat + 1}`} from the staging area.`;
  if (attack.immediate === true && attacksWhenDetached(game, ctx, enemy.id)) return ` ${name(enemy.id)} was detached: it attacks the first player now.`;
  return "";
}

/** What a choice of the grapple family asks: the location an enemy grapples with among those tied (the enemy was faceup when it was revealed, so it is named with the criterion), a Giant Arm's engage or
 * grapple, the Trait a character gains (the character named), and the player Come Together goes to. Null for any other. */
export type GrappleFacts = { rule: PrintedCard["keywords"]["grapple"]; picked: string | null };

const CRITERION: Readonly<Record<NonNullable<PrintedCard["keywords"]["grapple"]>, string>> = {
  highestThreat: "the highest printed Threat",
  lowestThreat: "the lowest printed Threat",
  highestQuestPoints: "the highest printed quest points",
  lowestQuestPoints: "the lowest printed quest points",
};

/** The facts a grapple choice names, read from the game: the Grapple keyword of the enemy that grapples, and the card the effect last picked. */
export function grappleFactsOf(game: ScenarioState, ctx: ReduceContext, instruction: Instruction, picked: string | null): GrappleFacts {
  const enemy = instruction.verb === "ResolveGrapple" && instruction.card ? game.cards[instruction.card] : undefined;
  return { rule: enemy ? printedOf(ctx.cards, enemy.code).keywords.grapple : null, picked };
}

export function grappleAsk(pick: Instruction, sourceId: string | null, names: ChoiceNames, facts?: GrappleFacts): PickWords | null {
  const host = sourceId ? names.card(sourceId) : "This card";
  switch (pick.verb) {
    case "ResolveGrapple": {
      const enemy = pick.card ? names.card(pick.card) : "The enemy";
      const criterion = facts?.rule ? CRITERION[facts.rule] : null;
      return { verb: "Grapple", prompt: `${enemy} grapples with the location with ${criterion ?? "the Threat or quest points its Grapple keyword names"}. The locations are tied: choose one. The enemy goes facedown under it.` };
    }
    case "EngageOrGrapple":
      return { verb: "Choose", prompt: `${host}: put it into play engaged with you and deal it a shadow card, or resolve its Grapple keyword?` };
    case "GainChosenTrait": {
      const who = facts?.picked ? names.card(facts.picked) : "this character";
      return { verb: "Gain", prompt: `${host}: choose the Trait ${who} gains until the end of the round.` };
    }
    default:
      return null;
  }
}

/** The label of an option of the family that is no card: Giant Arm's two ways, a Trait. Null for a card (the sheet names it). */
export function grappleOptionLabel(instruction: Instruction, id: string): string | null {
  if (instruction.verb === "EngageOrGrapple") return id === "engage" ? "Put it into play engaged with you, and deal it a shadow card" : id === "grapple" ? "Resolve its Grapple keyword" : null;
  if (instruction.verb === "GainChosenTrait") return id;
  return null;
}
