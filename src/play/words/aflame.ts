// The words of the aflame family's verbs (src/catalog/families/aflame.ts) inside a choice: what a branch of a Choose does ("Either deal 2 damage to an Aflame location in play, or search ... for the
// Aflame location with the highest Aflame value", 11040:A:1), what a Pick or a question is for, and the damage a card is about to take. Every prompt names the card it is about and leads with the decision.
import type { Amount, Instruction } from "../../catalog/boundary.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

/** The title of the four Galdor's Counsel (11184 to 11187): one name, four cards. */
export const COUNSEL = "Galdor's Counsel";

/** What tells one option of a choice from another that carries the same title: the sphere a Galdor's Counsel names in its own text ("half the level of Galdor's Counsel (Leadership)"), because the four copies are all
 * neutral events in the data. Empty for a card whose text names none. */
export function sphereTell(name: string, text: string | null | undefined): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sphere = new RegExp(`${escaped} \\((Leadership|Lore|Spirit|Tactics)\\)`).exec(text ?? "")?.[1];
  return sphere ? ` (${sphere})` : "";
}

/** The Aflame line of a location in play for its preview: its value, the damage on it and what is left before it burns ("Aflame 5: 2 of 5 damage, 3 more damage place it underneath The Havens Burn"). */
export function aflameLine(tally: { value: number; damage: number }): string {
  const left = Math.max(0, tally.value - tally.damage);
  return `Aflame ${tally.value}: ${tally.damage} of ${tally.value} damage, ${left === 1 ? "1 more damage places it" : `${left} more damage place it`} underneath The Havens Burn`;
}

/** The mark on an Aflame location: the damage against its value ("3/5"), threat red when one more damage destroys it (the Burn's rule). */
export function aflameMark(tally: { value: number; damage: number }): { text: string; danger: boolean } {
  return { text: `${tally.damage}/${tally.value}`, danger: tally.damage + 1 >= tally.value };
}

/** The preview's sentence on The Havens Burn: only how many cards lie under it, never which (they are facedown and out of play, dcce.aflame). */
export function burnLine(tally: { count: number; limit: number }): string {
  return `${tally.count} ${tally.count === 1 ? "card is" : "cards are"} facedown underneath it, out of play. The players lose at ${tally.limit}.`;
}

/** The pill on The Havens Burn: the count against the number that loses ("2/5", short enough for the card's width), threat red when one more card loses; `speech` is what a screen reader hears. */
export function burnMark(tally: { count: number; limit: number }): { text: string; loses: boolean; speech: string } {
  return { text: `${tally.count}/${tally.limit}`, loses: tally.count + 1 >= tally.limit, speech: `${tally.count} under, lose at ${tally.limit}` };
}

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

/** The numbers and names a branch's words state, read when the sheet is built: the cards a Look takes (Galdor's Counsel, Lore: half its level plus the copies chosen) and the card being placed. */
export type BranchNow = { count?: number; placing?: string };

/** The `BranchNow` of a Choose: the look count its branches carry resolved now, and the name of the card the last Pick chose (the card a Lore Counsel places). */
export function branchNow(game: ScenarioState, ctx: ReduceContext, choose: Choose, seat: number, sourceId: string | null, picked: string | null, names: Pick<ChoiceNames, "card">): BranchNow {
  const look = choose.options.flatMap((option) => option.instructions).find((step): step is Extract<Instruction, { verb: "LookAtTop" | "LookAtBottom" }> => step.verb === "LookAtTop" || step.verb === "LookAtBottom");
  const count = look?.count == null ? undefined : typeof look.count === "number" ? look.count : resolveAmount(game, look.count, frameScope(game, seat, sourceId), ctx);
  return { ...(count != null ? { count } : {}), ...(picked ? { placing: names.card(picked) } : {}) };
}

// Put to the Torch (11048) and Throwing Axe (11190): the cards whose picks have words of their own.
const TORCH = "11048";
const AXE = "11190";

const STAT_WORD: Readonly<Record<string, string>> = { attack: "Attack", defense: "Defense" };

/** The words of a branch of the family's Choose instructions, or null: "Deal 3 damage to a character you control" / "Deal 3 damage to an Aflame location in play" (Put to the Torch), "Deal 3 damage to
 * Pillaged Ship" / "Add the topmost enemy in the encounter discard pile to the staging area", "Look at the top 3 cards of your deck", "Put Cutlass on the top of your deck". */
export function aflameBranchWords(choose: Choose, optionId: string, names: ChoiceNames, sourceId: string | null, now?: BranchNow): string | null {
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
  // Galdor's Counsel (Lore, 11187:A:1): the two branches are named top and bottom. The number is the one the table holds now.
  const lookBranch = choose.options.some((entry) => entry.id === "top") && choose.options.some((entry) => entry.id === "bottom");
  const cards = (count: Amount | undefined): string => {
    const shown = now?.count != null ? String(now.count) : amountOf(count);
    return shown === "1" ? "card" : `${shown} cards`;
  };
  if (top && lookBranch) return `Look at the top ${cards(top.count)} of your deck`;
  if (bottom && lookBranch) return `Look at the bottom ${cards(bottom.count)} of your deck`;
  const placing = steps.find((step): step is Extract<Instruction, { verb: "PutOnDeck" }> => step.verb === "PutOnDeck");
  if (placing && placing.position !== "shuffle" && lookBranch) return `Put ${now?.placing ?? "it"} on the ${placing.position} of your deck`;
  // Throwing Axe (11190:B:3, once per game): the toss is thrown at the table, so the player says where it stopped. Every row says the use is spent.
  const axe = choose.options.some((entry) => entry.id === "hit") && choose.options.some((entry) => entry.id === "miss");
  if (axe && optionId === "damage" && damageStep) return `Deal ${damage(damageStep.amount)} to an enemy (once per game)`;
  if (axe && optionId === "hit" && damageStep) return `Toss the axe: it stopped on an enemy. Deal ${damage(damageStep.amount)} to that enemy (once per game)`;
  if (axe && optionId === "miss" && steps.length === 0) return "Toss the axe: it missed (once per game)";
  // Na'asiyah (11079:A:2): the row names the card that gets the bonus for this attack.
  const bonus = steps.find((step): step is Extract<Instruction, { verb: "ModifyStat" }> => step.verb === "ModifyStat" && step.target === "self" && step.until === "endOfAttack" && STAT_WORD[step.stat] != null);
  if (bonus && sourceId && typeof bonus.amount === "number") return `${names.card(sourceId)} gets ${bonus.amount >= 0 ? "+" : ""}${bonus.amount} ${STAT_WORD[bonus.stat]} for this attack`;
  return null;
}

/** What a Pick of the family's cards, or one of its questions, asks. Null for any other pick. `next` is the instruction after it; `amount` is what that next instruction deals or moves, read now. */
export function aflamePickWords(pick: Instruction, next: Instruction | undefined, names: ChoiceNames, sourceId: string | null, amountNow?: number, game?: ScenarioState): PickWords | null {
  const host = sourceId ? names.card(sourceId) : "This card";
  switch (pick.verb) {
    case "SearchAflame":
      return { verb: "Add", prompt: `${host}: choose the Aflame location to add to the staging area. They are tied on the highest Aflame value.` };
    case "HealLocations":
      // One damage at a time, so the prompt counts them: "Damage 2 of 4".
      return { verb: "Heal", prompt: `${host}: choose the location that has 1 damage removed${typeof pick.amount === "number" ? ` (damage ${(pick.healed ?? 0) + 1} of ${pick.amount})` : ""}.` };
    case "Pick":
      break;
    default:
      return null;
  }
  const deal = next?.verb === "DamageCard" ? (amountNow != null ? `${amountNow} damage` : damage(next.amount)) : null;
  if (pick.pick.aflame === true && deal) {
    return pick.pick.lowestAflame ? { verb: "Burn", prompt: `${host}: choose the Aflame location that takes ${deal}. They are tied on the lowest Aflame value.` } : { verb: "Burn", prompt: `${host}: choose the Aflame location in play that takes ${deal}.` };
  }
  // Put to the Torch (11048:A:1): the character is one the player controls, and the card is named.
  if (pick.pick.type === "character" && pick.pick.control === "you" && deal && game && sourceId && game.cards[sourceId]?.code === TORCH) return { verb: "Assign", prompt: `${host}: choose a character you control to take ${deal}.` };
  // Throwing Axe (11190:B:3): the player says where the thrown axe stopped, or which enemy takes the 1 damage.
  if (pick.pick.type === "enemy" && deal && game && sourceId && game.cards[sourceId]?.code === AXE) {
    return next?.verb === "DamageCard" && next.amount === 4 ? { verb: "Hit", prompt: `${host}: choose the enemy the axe stopped on. It takes ${deal}.` } : { verb: "Hit", prompt: `${host}: choose the enemy that takes ${deal}.` };
  }
  if (pick.pick.type === "hero" && pick.pick.hasResources === true && next?.verb === "DiscardResources") return { verb: "Give", prompt: `${host}: choose a hero you control whose pool gives it 1 resource.` };
  if (pick.pick.defending === true && next?.verb === "Pick") return { verb: "Take", prompt: `${host}: choose the defending character whose resources move to the attacking enemy.` };
  if (pick.pick.attackingEnemy === true && (next?.verb === "MoveResources" || next?.verb === "PlaceResourceTokens")) return { verb: "Give", prompt: `${host}: the attacking enemy gets ${next.verb === "MoveResources" ? "the resources" : `${amountOf(next.amount)} ${amountOf(next.amount) === "1" ? "resource" : "resources"}`}.` };
  if (pick.pick.type === "enemy" && pick.pick.hasResources === true && next?.verb === "DiscardResources") return { verb: "Take", prompt: `${host}: take 1 resource from the enemy this hero defends against.` };
  if (pick.pick.looked === true && next?.verb === "Choose") return { verb: "Place", prompt: `${host}: choose a card you looked at to put on the top or the bottom of your deck.` };
  if (pick.pick.names?.includes("Dream-chaser") && deal) return { verb: "Burn", prompt: `${host}: the Dream-chaser takes ${deal}.` };
  return null;
}

/** The amount the instruction after a Pick deals or places, read now when the record's amount depends on the table ("damage equal to the Corsair enemies in play", Galdor's Counsel's X): the number the prompt states. */
export function dealtNow(game: ScenarioState, ctx: ReduceContext, next: Instruction | undefined, seat: number, sourceId: string | null): number | undefined {
  if ((next?.verb !== "DamageCard" && next?.verb !== "PlaceProgressOn" && next?.verb !== "AddResources") || typeof next.amount === "number") return undefined;
  return resolveAmount(game, next.amount, frameScope(game, seat, sourceId), ctx);
}
