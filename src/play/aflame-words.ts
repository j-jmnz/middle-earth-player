// The words of the aflame family's verbs (src/catalog/families/aflame.ts) inside a choice: what a branch of a Choose does ("Either deal 2 damage to an Aflame location in play, or search ... for the
// Aflame location with the highest Aflame value", 11040:A:1), what a Pick or a question is for, and the damage a card is about to take. Every prompt names the card it is about and leads with the decision.
import type { Amount, Instruction } from "../catalog/boundary.ts";
import { frameScope, resolveAmount } from "../rules/amounts.ts";
import type { ReduceContext } from "../rules/interpret.ts";
import type { ScenarioState } from "../rules/state.ts";

import type { ChoiceNames, PickWords } from "./choice-words.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

const amountOf = (amount: Amount | undefined): string => (amount == null ? "1" : typeof amount === "number" ? String(amount) : "X");
const damage = (amount: Amount | undefined): string => `${amountOf(amount)} damage`;

/** One instruction of the family in words, or null when it is not one of them. */
export function aflameWords(instruction: Instruction): string | null {
  switch (instruction.verb) {
    case "DiscardUntilAflame":
      return `discard cards from the encounter deck until ${instruction.perPlayer === 1 ? "an Aflame location for each player is" : `${instruction.perPlayer} Aflame locations for each player are`} discarded, and add them to the staging area`;
    case "SearchAflame":
      return "search the encounter deck and discard pile for the Aflame location with the highest Aflame value, and add it to the staging area";
    case "EngageFirstPlayer":
      return "it engages the first player";
    case "StageSetAside":
      return "add the set-aside card to the staging area";
    case "RemoveNamedFromGame":
      return `remove ${instruction.name} and each attachment on him from the game`;
    case "HealLocations":
      return `remove ${amountOf(instruction.amount)} damage from locations in play`;
    default:
      return null;
  }
}

/** The words of a branch of the family's Choose instructions, or null: "Deal 3 damage to a character you control" / "Deal 3 damage to an Aflame location in play" (Put to the Torch), "Deal 3 damage to
 * Pillaged Ship" / "Add the topmost enemy in the encounter discard pile to the staging area", "Look at the top 2 cards of your deck". */
export function aflameBranchWords(choose: Choose, optionId: string, names: ChoiceNames, sourceId: string | null): string | null {
  const option = choose.options.find((entry) => entry.id === optionId);
  if (!option) return null;
  const steps = option.instructions;
  const damageStep = steps.find((step): step is Extract<Instruction, { verb: "DamageCard" }> => step.verb === "DamageCard");
  const pick = steps.find((step): step is Extract<Instruction, { verb: "Pick" }> => step.verb === "Pick");
  if (damageStep && pick?.pick.aflame === true) return `Deal ${damage(damageStep.amount)} to an Aflame location in play`;
  if (damageStep && pick?.pick.type === "character" && pick.pick.control === "you") return `Deal ${damage(damageStep.amount)} to a character you control`;
  if (damageStep?.target === "self" && sourceId) return `Deal ${damage(damageStep.amount)} to ${names.card(sourceId)}`;
  if (damageStep?.target === "activeLocation") return `Deal ${damage(damageStep.amount)} to the active location`;
  if (damageStep?.target === "defender") return `Deal ${damage(damageStep.amount)} to the defending character`;
  if (steps.some((step) => step.verb === "PickDiscardTop")) return "Add the topmost enemy in the encounter discard pile to the staging area";
  if (steps.some((step) => step.verb === "SearchAflame")) return "Search the encounter deck and discard pile for the Aflame location with the highest Aflame value, and add it to the staging area";
  const top = steps.find((step): step is Extract<Instruction, { verb: "LookAtTop" }> => step.verb === "LookAtTop");
  const bottom = steps.find((step): step is Extract<Instruction, { verb: "LookAtBottom" }> => step.verb === "LookAtBottom");
  // Galdor's Counsel (Lore, 11187:A:1): the two branches are named top and bottom.
  const lookBranch = choose.options.some((entry) => entry.id === "top") && choose.options.some((entry) => entry.id === "bottom");
  if (top && lookBranch) return `Look at the top ${amountOf(top.count) === "1" ? "card" : `${amountOf(top.count)} cards`} of your deck`;
  if (bottom && lookBranch) return `Look at the bottom ${amountOf(bottom.count) === "1" ? "card" : `${amountOf(bottom.count)} cards`} of your deck`;
  const placing = steps.find((step): step is Extract<Instruction, { verb: "PutOnDeck" }> => step.verb === "PutOnDeck");
  if (placing && placing.position !== "shuffle" && lookBranch) return `Put it on the ${placing.position} of your deck`;
  // Throwing Axe (11190:B:3): the toss is thrown at the table, so the player says where it stopped.
  if (optionId === "hit" && damageStep) return `Toss the axe: it stopped on an enemy. Deal ${damage(damageStep.amount)} to that enemy`;
  if (optionId === "miss" && steps.length === 0) return "Toss the axe: it missed";
  return null;
}

/** What a Pick of the family's cards, or one of its questions, asks. Null for any other pick. `next` is the instruction after it; `amount` is what that next instruction deals or moves, read now. */
export function aflamePickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null, amountNow?: number): PickWords | null {
  const host = sourceId ? names.card(sourceId) : "This card";
  switch (pick.verb) {
    case "SearchAflame":
      return { verb: "Add", prompt: `${host}: choose the Aflame location to add to the staging area. They are tied on the highest Aflame value.` };
    case "HealLocations":
      return { verb: "Heal", prompt: `${host}: choose the location that has 1 damage removed. ${amountOf(pick.amount) === "X" ? "Damage is" : `${Math.max(1, (typeof pick.amount === "number" ? pick.amount : 1) - (pick.healed ?? 0))} damage is`} still to be removed.` };
    case "Pick":
      break;
    default:
      return null;
  }
  const deal = next?.verb === "DamageCard" ? (amountNow != null ? `${amountNow} damage` : damage(next.amount)) : null;
  if (pick.pick.aflame === true && deal) {
    return pick.pick.lowestAflame ? { verb: "Burn", prompt: `${host}: choose the Aflame location that takes ${deal}. They are tied on the lowest Aflame value.` } : { verb: "Burn", prompt: `${host}: choose the Aflame location in play that takes ${deal}.` };
  }
  if (pick.pick.type === "hero" && pick.pick.hasResources === true && next?.verb === "DiscardResources") return { verb: "Give", prompt: `${host}: choose a hero you control whose pool gives it 1 resource.` };
  if (pick.pick.defending === true && next?.verb === "Pick") return { verb: "Take", prompt: `${host}: choose the defending character whose resources move to the attacking enemy.` };
  if (pick.pick.attackingEnemy === true && (next?.verb === "MoveResources" || next?.verb === "PlaceResourceTokens")) return { verb: "Give", prompt: `${host}: the attacking enemy gets ${next.verb === "MoveResources" ? "the resources" : `${amountOf(next.amount)} ${amountOf(next.amount) === "1" ? "resource" : "resources"}`}.` };
  if (pick.pick.type === "enemy" && pick.pick.hasResources === true && next?.verb === "DiscardResources") return { verb: "Take", prompt: `${host}: take 1 resource from the enemy this hero defends against.` };
  if (pick.pick.looked === true && next?.verb === "Choose") return { verb: "Place", prompt: `${host}: choose a card you looked at to put on the top or the bottom of your deck.` };
  if (pick.pick.names?.includes("Dream-chaser") && deal) return { verb: "Burn", prompt: `${host}: the Dream-chaser takes ${deal}.` };
  return null;
}

/** The damage the instruction after a Pick deals, read now when the record's amount depends on the table ("damage equal to the Corsair enemies in play"): the number the prompt states. */
export function dealtNow(game: ScenarioState, ctx: ReduceContext, next: Instruction | undefined, seat: number, sourceId: string | null): number | undefined {
  if (next?.verb !== "DamageCard" || typeof next.amount === "number") return undefined;
  return resolveAmount(game, next.amount, frameScope(game, seat, sourceId), ctx);
}
