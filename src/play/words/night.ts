// Rules: emce.side-quests, emce.side-quests-in-play, rr.first-player, rr.attacks-outside-the-combat-phase, rr.damage (data/rules/entries.json); ledger lines 19066:A:2, 19067:A:2, 19075:A:1, 19076:A:1, 19083:B:1.
// Fire in the Night's choices on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player. The first player's question at the beginning of the quest phase names the side quests in the staging area
// and what each is worth; one player's choice leads with "Player N:" two-handed (`owned`, so the sheet adds no "Player N chooses."), solo it has no lead. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { BELDIS_BOXES } from "../../catalog/ally-lines.ts";
import { modifiedStat } from "../../rules/core/keywords.ts";
import { MAIN_QUEST } from "../../rules/families/wilderland/night.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { GameEvent } from "../../rules/windows/frame-types.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { undefendedDamage } from "../store/foresight.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { seatSays } from "./seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;
type Facts = { game: ScenarioState; ctx: ReduceContext; options: readonly string[] };
type Kind = "current" | "thrall" | "orc" | "fortify";

const HILL = "Hrogar's Hill";

// Which of the scenario's choices a Choose is, from the instructions of its options; null for another Choose.
function kindOf(choose: Choose): Kind | null {
  const [first, second] = choose.options;
  if (!first || !second) return null;
  if (first.id === MAIN_QUEST && choose.options.every((option) => option.id === MAIN_QUEST || option.instructions[0]?.verb === "MakeCurrentQuest")) return "current";
  const damages = (option: Choose["options"][number], amount: number): boolean => option.instructions.some((step) => step.verb === "DamageCard" && step.target === "questStage" && step.amount === amount);
  if (choose.options.length === 2 && first.id === "hill" && second.id === "attack" && damages(first, 3) && second.instructions[0]?.verb === "ImmediateAttackBy") return "thrall";
  if (choose.options.length === 2 && first.id === "hero" && second.id === "hill" && damages(second, 3) && first.instructions.some((step) => step.verb === "DamageCard" && step.amount === 2)) return "orc";
  if (choose.options.length === 2 && first.id === "draw" && second.id === "resources" && first.instructions[0]?.verb === "Draw" && second.instructions[0]?.verb === "HeroesGainResources") return "fortify";
  return null;
}

const drawOf = (choose: Choose): number => {
  const step = choose.options[0]?.instructions[0];
  return step?.verb === "Draw" && typeof step.amount === "number" ? step.amount : 3;
};

const hillDamage = (choose: Choose, id: string): number => {
  const step = choose.options.find((option) => option.id === id)?.instructions.find((entry) => entry.verb === "DamageCard");
  return step?.verb === "DamageCard" && typeof step.amount === "number" ? step.amount : 3;
};

/** The sentence over a Choose of Fire in the Night: the first player's choice of the current quest (emce.side-quests-in-play), The Dragon's Thrall (19075:A:1), Orc of the Flame (19076:A:1) and Fortify the Defense (19067:A:2). Null for any other Choose. */
export function nightChooseNote(choose: Choose, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, source?: string | null): string | null {
  const kind = kindOf(choose);
  if (!kind) return null;
  const { say } = seatSays(game);
  if (kind === "current") {
    const quests = choose.options.filter((option) => option.id !== MAIN_QUEST).length;
    return say(`make ${quests === 1 ? "the side quest in the staging area" : `1 of the ${quests} side quests in the staging area`} the current quest until the end of the phase, or keep ${HILL}? Progress goes on the active location first, then on the current quest instead of ${HILL}: what it cannot take is discarded.`);
  }
  if (kind === "thrall") return say(`${source ? names.card(source) : "The Dragon's Thrall"} has engaged you: deal ${hillDamage(choose, "hill")} damage to ${HILL}, or it makes an immediate attack against you?`);
  if (kind === "orc") return say(`${source ? names.card(source) : "Orc of the Flame"}: deal 2 damage to a hero you control, or ${hillDamage(choose, "hill")} damage to ${HILL}?`);
  return say(`${source ? names.card(source) : "Fortify the Defense"} is defeated: draw ${drawOf(choose)} cards, or each hero you control gains 1 resource?`);
}

/** The row of an option of that Choose, or null for another. */
export function nightBranchWords(choose: Choose, optionId: string, names: ChoiceNames, source?: string | null): string | null {
  const kind = kindOf(choose);
  if (!kind) return null;
  if (kind === "current") {
    if (optionId === MAIN_QUEST) return `Keep ${HILL} as the quest`;
    return `Make ${names.card(optionId)} the current quest`;
  }
  // `source` is the card's name, as the branch words are handed it.
  if (kind === "thrall") return optionId === "hill" ? `Deal ${hillDamage(choose, "hill")} damage to ${HILL}` : `${source ?? "The Dragon's Thrall"} makes an immediate attack against you`;
  if (kind === "orc") return optionId === "hero" ? "Deal 2 damage to a hero you control" : `Deal ${hillDamage(choose, "hill")} damage to ${HILL}`;
  return optionId === "draw" ? `Draw ${drawOf(choose)} cards` : "Each hero you control gains 1 resource";
}

/** The sentence a pick of Fire in the Night asks (19083:B:1): Dagnir is the enemy that attacks Hrogar's Hill, or null for another. */
export function nightAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, facts: Facts | undefined): PickWords | null {
  if (instruction.verb !== "Pick" || next?.verb !== "AttackStage") return null;
  const game = facts?.game;
  const says = game ? seatSays(game) : null;
  const text = `the enemy that attacks ${HILL}${source ? ` (${names.card(source)})` : ""}. The first player may declare a defender; the damage left undefended, and the damage beyond a defender's hit points, is dealt to ${HILL}.`;
  return says ? { verb: "Attack", prompt: says.say(`choose ${text}`), ...says.owned } : { verb: "Attack", prompt: `Choose ${text}` };
}

const leadOf = (game: ScenarioState, seat: number): string => (game.seatCount > 1 ? `Player ${seat + 1}: ` : "");

/**
 * The sentence over the defense sheet of an attack whose damage goes to Hrogar's Hill. The attack the stage makes (19083:B:1, rr.attacks-outside-the-combat-phase) is the first player's to defend, deals no shadow card, and puts the damage no defender takes, and
 * the damage beyond a defender's hit points, on the Hill; The Dragon's Fury (19081:A:1) has its shadow card and only the undefended damage go there. `caution` arms Leave undefended when the damage fills the Hill. Null for any other attack.
 */
export function nightStageAttack(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, enemyId: string, defenders: number): { note: string; caution?: string } | null {
  const hill = game.questStage ? game.cards[game.questStage] : undefined;
  const enemy = game.cards[enemyId];
  if (!game.pendingAttack?.toStage || game.pendingAttack.undefended || !hill || !enemy) return null;
  const seat = game.window?.kind === "defense" ? game.window.seat : game.firstPlayer;
  const points = modifiedStat(game, hill, "questPoints", ctx.cards);
  const damage = undefendedDamage(game, ctx, enemyId);
  const holds = `${HILL} holds ${hill.damage} of ${points} damage`;
  const caution = hill.damage + damage >= points ? { caution: `Tap again: ${HILL} holds ${points} damage and the game is lost` } : {};
  const lead = leadOf(game, seat);
  // The attack the stage makes: no shadow card, and the excess beyond the defender goes to the Hill too.
  if (game.pendingAttack.excessToStage && !enemy.shadowId) {
    const choice = defenders > 0 ? `A defender takes the damage its Defense leaves, and the damage beyond its hit points goes to ${HILL}. Leave it undefended and all ${damage} damage is dealt to ${HILL}.` : `No character can defend: all ${damage} damage is dealt to ${HILL}.`;
    return { note: `${lead}${names.card(enemy.id)} attacks ${HILL}. No shadow card is dealt. ${choice} ${holds}.`, ...caution };
  }
  const choice = defenders > 0 ? `Choose a defender, or leave it undefended: then all ${damage} damage is dealt to ${HILL}, not to a character.` : `No character can defend: all ${damage} damage is dealt to ${HILL}, not to a character.`;
  return { note: `${lead}${names.card(enemy.id)} attacks. ${choice} ${holds}.`, ...caution };
}

/** The sentence over the Response window of a defeated side quest (emce.side-quests-in-play), when one of the Responses offered is its own: the side quest goes to the victory display, the quest deck does not advance, and the first player uses the Response or passes it. Null for another event. */
export function nightResponseNote(game: ScenarioState, names: Pick<ChoiceNames, "card">, event: GameEvent | null, offered: readonly string[]): string | null {
  const quest = event?.trigger === "questDefeated" && event.cardId && offered.includes(event.cardId) ? game.cards[event.cardId] : undefined;
  if (!quest) return null;
  const seat = game.window?.kind === "response" ? game.window.seat : game.firstPlayer;
  return `${leadOf(game, seat)}${names.card(quest.id)} is defeated and goes to the victory display; ${HILL} does not advance. Use its Response, or pass: passing gives it up.`;
}

/** The sentence under Beldis's Action (12188:A:1): how many of the acting player's four boxes beside her in the campaign log are left, and that a win records the mark. Null for another card's Action. */
export function nightActionNote(game: ScenarioState, effectId: string): string | null {
  if (effectId !== "12188:action:1") return null;
  const seat = game.activeSeat;
  const left = BELDIS_BOXES - (game.campaignFacts?.beldisUses?.[seat] ?? 0);
  return `${leadOf(game, seat)}${left} of ${BELDIS_BOXES} boxes beside Beldis ${left === 1 ? "is" : "are"} left. Using her marks one in the campaign log if you win.`;
}
