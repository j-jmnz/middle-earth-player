// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.caves-deck-gundabad, emce.treasure, rr.first-player, rr.search (data/rules/entries.json); ledger lines 19124:A:1, 19134:B:1, 19135:B:3, 19137:B:2, 19140:B:2, 19141:B:2, 19142:B:2, 19122:A:3, 12194:A:2
// The choices of Mount Gundabad on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player. A choice the first player makes for the group is not owned, so the sheet adds who chooses; one
// player's own choice leads with "Player N:" two-handed (`owned`) and has no lead solo. The words read the shape of a record's instructions, never a card code or an effect id.
import type { Instruction } from "../../catalog/boundary.ts";
import type { ScenarioState } from "../../rules/core/state.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { seatSays } from "./seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Whether the Choose is the bypass of a stage 2B (19135:B:3 and the others): bypass it, or stay on it. */
const isBypass = (choose: Choose): boolean => choose.options.length === 2 && choose.options.some((option) => option.id === "bypass" && option.instructions.some((step) => step.verb === "BypassStage"));

/** The progress on the current quest card, told in the bypass: what it loses. */
function stageProgress(game: ScenarioState): number {
  return game.cards[game.questStage ?? ""]?.progress ?? 0;
}

/** The sentence over the bypass of a stage (emce.bypassing): the first player answers for the group, at the end of the combat phase. Null for any other Choose. */
export function gundabadChooseNote(choose: Choose, game: ScenarioState, names: ChoiceNames, source?: string | null): string | null {
  if (!isBypass(choose)) return null;
  const stage = source ? names.card(source) : "This stage";
  const progress = stageProgress(game);
  const lost = progress === 0 ? "it has no progress to lose" : `it loses its ${progress} progress`;
  return `${stage}: bypass this stage at the end of the combat phase? If you do, ${lost}, it goes to the bottom of the quest deck and the next stage 2A is revealed (${game.questDeck.length} ${game.questDeck.length === 1 ? "stage" : "stages"} wait in the quest deck).`;
}

/** The row of a branch of the bypass choice, or null for another Choose. */
export function gundabadBranchWords(choose: Choose, optionId: string): string | null {
  if (!isBypass(choose)) return null;
  return optionId === "bypass" ? "Bypass the stage: it loses all its progress and goes to the bottom of the quest deck" : "Stay on the stage";
}

/**
 * The sentence a pick or an ask of Mount Gundabad makes: the quest card searched out of the quest deck (19124:A:1), the stage the first player puts on the bottom (19134:B:1, 19140:B:2), the location searched out of the Caves deck (19137:B:2), the hero Wormsbane is
 * attached to (19122:A:3), the character Dragon-sickness attaches to (12194:A:2), the enemy a stage has the players discard (19141:B:2), a questing character a stage damages (19141:B:1) and Dagnir added to the victory display (19142:B:2). Null for any other.
 */
export function gundabadAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, game: ScenarioState | undefined): PickWords | null {
  const says = game ? seatSays(game) : null;
  const card = source ? names.card(source) : "this card";
  // One player's own choice leads with the player two-handed; the first player's choice for the group is not owned (the sheet adds who chooses).
  const own = (verb: string, text: string): PickWords => (says ? { verb, prompt: says.say(text), ...says.owned } : { verb, prompt: capital(text) });
  const group = (verb: string, text: string): PickWords => ({ verb, prompt: capital(text) });
  if (instruction.verb === "SearchQuestDeck") return group("Search", `${card}: search the quest deck for a quest card and make it the current main quest. It is flipped over at once; the stage now current goes back into the quest deck and the quest deck is shuffled.`);
  if (instruction.verb === "ActivateFromCaves") return group("Search", `${card}: search the Caves deck for a location and make it the active location (the location active now returns to the staging area). The Caves deck is then shuffled.`);
  if (instruction.verb === "LookAtStages" && instruction.bottom === true) return group("Choose", `Look at the top ${instruction.count} stages of the quest deck and choose 1 to place on the bottom. The other becomes the current quest.`);
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  if (pick.type === "hero" && next?.verb === "FlipInPlace") return group("Attach", `${card}: choose a hero of any player to carry Wormsbane, flipped to its Reforged side.`);
  if (next?.verb === "AttachSelfToPicked" && pick.hasAttachment?.treasure === true) return group("Attach", `${card}: choose a character with 1 or more treasures attached. ${card} attaches to it, then every unguarded treasure in play is attached to that character.`);
  if (pick.names?.includes("Dagnir") && next?.verb === "AddToVictory") return own("Add", "Dagnir has no hit points remaining: she is added to the victory display and the players win the game.");
  if (pick.committed === true && next?.verb === "DamageCard") {
    const amount = typeof next.amount === "number" ? next.amount : 2;
    return own("Damage", `choose a questing character you control to deal ${amount} damage to.`);
  }
  if (pick.type === "enemy" && pick.nonUnique === true && pick.who === "firstPlayer" && next?.verb === "Discard") return group("Discard", `${card}: choose a non-unique enemy in play to discard.`);
  return null;
}
