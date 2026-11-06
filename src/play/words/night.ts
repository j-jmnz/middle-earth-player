// Rules: emce.side-quests, emce.side-quests-in-play, rr.first-player, rr.attacks-outside-the-combat-phase, rr.damage (data/rules/entries.json); ledger lines 19066:A:2, 19067:A:2, 19075:A:1, 19076:A:1, 19083:B:1.
// Fire in the Night's choices on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player. The first player's question at the beginning of the quest phase names the side quests in the staging area
// and what each is worth; one player's choice leads with "Player N:" two-handed (`owned`, so the sheet adds no "Player N chooses."), solo it has no lead. Pure.
import type { Instruction } from "../../catalog/boundary.ts";
import { MAIN_QUEST } from "../../rules/families/wilderland/night.ts";
import type { ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";

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
