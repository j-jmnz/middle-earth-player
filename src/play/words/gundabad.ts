// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.caves-deck-gundabad, emce.treasure, rr.first-player, rr.search, rr.response, rr.cancel (data/rules/entries.json); ledger lines 19124:A:1, 19134:A:1, 19134:B:1, 19135:B:3, 19137:B:1, 19137:B:2, 19140:B:2, 19141:B:1, 19141:B:2, 19142:B:2, 19122:A:3, 19123:A:2, 12194:A:2
// The choices of Mount Gundabad on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player, and what declining does. A choice the first player makes for the group is not owned, so the sheet adds who chooses; one
// player's own choice leads with "Player N:" two-handed (`owned`) and has no lead solo. The words read the shape of a record's instructions, never a card code or an effect id. Pure.
import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { flagged, type GameEvent, type ScenarioState } from "../../rules/core/state.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { seatSays } from "./seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

const capital = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const plural = (count: number, word: string, many = `${word}s`): string => `${count} ${count === 1 ? word : many}`;

/** Whether the Choose is the bypass of a stage 2B: bypass it, or stay on it. */
const isBypass = (choose: Choose): boolean => choose.options.length === 2 && choose.options.some((option) => option.id === "bypass" && option.instructions.some((step) => step.verb === "BypassStage"));

/** Whether the Choose is the search of one's own deck for an Item attachment (a "may" with the search in its first branch): search it, or decline. */
const isDeckSearch = (choose: Choose): boolean => choose.options.length === 2 && choose.options.some((option) => option.instructions.some((step) => step.verb === "Pick" && step.pick.from === "deck" && step.pick.cardType === "attachment"));

/** Whether the Choose is the "may" of the Response that adds Dagnir to the victory display (discard the Reforged Wormsbane, win), or leave her. */
const isKill = (choose: Choose): boolean => choose.options.length === 2 && choose.options.some((option) => option.instructions.some((step) => step.verb === "AddToVictory"));

/** The progress on the current quest card, told in the bypass: what it loses. */
function stageProgress(game: ScenarioState): number {
  return game.cards[game.questStage ?? ""]?.progress ?? 0;
}

/** The quest cards in the victory display now: the X of Wormsbane's Attack and Dagnir's cap, one more than their number. */
export function questsInVictory(game: ScenarioState, ctx: ReduceContext): number {
  return Object.values(game.cards).filter((card) => card.zone === "victory" && printedOf(ctx.cards, card.code).type === "quest").length;
}

const progressLost = (progress: number): string => (progress === 0 ? "it has no progress to lose" : `it loses its ${progress} progress`);
const waiting = (game: ScenarioState): string => `${plural(game.questDeck.length, "stage")} ${game.questDeck.length === 1 ? "waits" : "wait"} in the quest deck`;

/** The sentence over the Choose of Mount Gundabad: the bypass of a stage at the end of the combat phase (emce.bypassing) and the search of a deck for an Item attachment. Null for any other Choose. */
export function gundabadChooseNote(choose: Choose, game: ScenarioState, names: ChoiceNames, source?: string | null): string | null {
  const card = source ? names.card(source) : "this card";
  if (isDeckSearch(choose)) return seatSays(game).titled(card, "search your deck for an Item attachment and add it to your hand? Your deck is shuffled after the search.");
  if (isKill(choose)) return seatSays(game).titled(card, "discard your Reforged Wormsbane to add Dagnir to the victory display? The players win the game.");
  if (!isBypass(choose)) return null;
  const progress = stageProgress(game);
  const stay = progress === 0 ? "the quest continues" : `it keeps its ${progress} progress and the quest continues`;
  return `${source ? card : "This stage"}: bypass this stage at the end of the combat phase? If the players do, ${progressLost(progress)}, it goes to the bottom of the quest deck and it is not defeated, so it does not go to the victory display. The next stage 2A is revealed and its When Revealed effect resolves (${waiting(game)}). If they stay, ${stay}.`;
}

/** The row of a branch of the bypass choice or of the search for an Item attachment, or null for another Choose. */
export function gundabadBranchWords(choose: Choose, optionId: string, game?: ScenarioState): string | null {
  if (isKill(choose)) return optionId === "decline" ? "Do not discard it: Wormsbane stays attached and Dagnir stays in play" : "Discard Wormsbane: Dagnir is added to the victory display and the players win the game";
  if (isDeckSearch(choose)) return optionId === "decline" ? "Do not search: your hand and deck stay as they are" : "Search for an Item attachment and add it to your hand";
  if (!isBypass(choose)) return null;
  const progress = game ? stageProgress(game) : 0;
  if (optionId === "bypass") return progress > 0 ? `Bypass the stage: lose ${progress} progress, go to the bottom of the quest deck` : "Bypass the stage: go to the bottom of the quest deck";
  return progress > 0 ? `Stay on the stage: keep ${progress} progress` : "Stay on the stage";
}

/**
 * The sentence a pick or an ask of Mount Gundabad makes: the quest card searched out of the quest deck (19124:A:1), the stage the first player puts on the bottom (19134:B:1, 19140:B:2), the location searched out of the Caves deck (19137:B:2), the hero Wormsbane is attached to at
 * Setup (19134:A:1) and when it is reforged (19122:A:3), the character Dragon-sickness attaches to (12194:A:2), the enemy a stage has the players discard (19141:B:2), a questing character a stage damages (19141:B:1) and Dagnir added to the victory display (19142:B:2). Null for any other.
 */
export function gundabadAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, game: ScenarioState | undefined): PickWords | null {
  const says = game ? seatSays(game) : null;
  const card = source ? names.card(source) : "this card";
  // One player's own choice leads with the player two-handed; the first player's choice for the group is not owned (the sheet adds who chooses).
  const own = (verb: string, text: string): PickWords => (says ? { verb, prompt: says.say(text), ...says.owned } : { verb, prompt: capital(text) });
  const group = (verb: string, text: string): PickWords => ({ verb, prompt: capital(text) });
  const loses = "If that hero leaves play, the players lose the game.";
  if (instruction.verb === "SearchQuestDeck") {
    const progress = game ? stageProgress(game) : 0;
    const left = game ? `; ${progressLost(progress)}` : "";
    return group("Search", `${card}: search the quest deck for a quest card and make it the current main quest, flipped over at once. The stage now current goes back into the quest deck${left}, and the quest deck is shuffled.`);
  }
  if (instruction.verb === "ActivateFromCaves") return group("Search", `${card}: search the Caves deck for a location and make it the active location (the location active now returns to the staging area). The Caves deck is then shuffled.`);
  if (instruction.verb === "LookAtStages" && instruction.bottom === true) return group("Choose", `Look at the top ${instruction.count} stages of the quest deck and choose 1 to place on the bottom. The other becomes the current quest.`);
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  if (pick.type === "hero" && next?.verb === "FlipInPlace") return group("Attach", `${card}: choose a hero of any player to carry Wormsbane, flipped to its Reforged side. ${loses}`);
  if (pick.type === "hero" && pick.attachable != null && next?.verb === "AttachSetAside") return group("Attach", `${card}: choose the hero who carries ${names.code(next.code)}, Broken side up. ${loses}`);
  if (next?.verb === "AttachSelfToPicked" && pick.hasAttachment?.treasure === true) return group("Attach", `${card}: choose a character with 1 or more treasures attached. ${card} attaches to it, then every unguarded treasure in play is attached to that character. Each time that character exhausts, its controller raises their threat by 1 for each treasure attached to it.`);
  if (pick.names?.includes("Wormsbane") && next?.verb === "Discard") return own("Discard", "choose the Reforged Wormsbane you control to discard.");
  if (pick.names?.includes("Dagnir") && next?.verb === "AddToVictory") return own("Add", "Dagnir has no hit points remaining: she is added to the victory display and the players win the game.");
  if (pick.committed === true && next?.verb === "DamageCard") {
    const amount = typeof next.amount === "number" ? next.amount : 2;
    return own("Damage", `choose a questing character you control to deal ${amount} damage to.`);
  }
  if (pick.type === "enemy" && pick.nonUnique === true && pick.who === "firstPlayer" && next?.verb === "Discard") return group("Discard", `${card}: choose a non-unique enemy in play to discard.`);
  return null;
}

/** Whether the instruction, or one nested in it (a player's turn in ForEachPlayer, a branch of a Choose), passes the test. */
function within(step: Instruction, test: (step: Instruction) => boolean): boolean {
  if (test(step)) return true;
  const inner = step.verb === "ForEachPlayer" ? step.instructions : step.verb === "Choose" ? step.options.flatMap((option) => option.instructions) : [];
  return inner.some((item) => within(item, test));
}

/**
 * The sentence over the Response window of a location explored (The First Forge, Dagnir's Hoard, Throat of the Mountain) or of an attack on Dagnir that left her with no hit points (the stage 2B Response), when one of the Responses offered is its own: what the Response does and what
 * passing leaves undone. Null for another event.
 */
export function gundabadResponseNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, event: GameEvent | null, offered: readonly string[]): string | null {
  const seat = game.window?.kind === "response" ? game.window.seat : game.firstPlayer;
  const { say } = seatSays(game, seat);
  const records = (cardId: string): readonly Effect[] => effectsOf(ctx, game.cards[cardId]?.code ?? "").filter((effect) => effect.timing === "response" && effect.trigger === event?.trigger);
  const find = (test: (step: Instruction) => boolean) => offered.find((cardId) => records(cardId).some((effect) => effect.instructions.some((step) => within(step, test))));
  const reforging = find((step) => step.verb === "FlipInPlace");
  if (reforging) {
    const attack = questsInVictory(game, ctx) + 1;
    return say(`${names.card(reforging)} was explored. Flip Wormsbane to its Reforged side and attach it to any hero the first player chooses. That hero gets +${attack} Attack (1 more than the ${plural(attack - 1, "quest card")} in the victory display), and if it leaves play the players lose the game. Pass and Wormsbane stays Broken side up on its hero, since The First Forge is gone.`);
  }
  const quest = find((step) => step.verb === "SearchQuestDeck");
  if (quest) return say(`${names.card(quest)} was explored. Search the quest deck (${plural(game.questDeck.length, "stage")}) for a quest card and make it the current main quest, flipped over at once; the stage now current (${progressLost(stageProgress(game))}) goes back into the quest deck and the quest deck is shuffled. Pass and the quest stays as it is.`);
  const hoard = find((step) => step.verb === "Pick" && step.pick.from === "deck" && step.pick.cardType === "attachment");
  if (hoard) return say(`${names.card(hoard)} was explored. Each player may search their deck for an Item attachment, add it to their hand and shuffle their deck. Pass and nobody searches.`);
  const kill = find((step) => step.verb === "AddToVictory");
  if (kill && event?.trigger === "attacked") return say(`Dagnir has no hit points remaining. You may discard your Reforged Wormsbane to add her to the victory display, and the players win the game. Pass and she stays in play.`);
  return null;
}

/** The note of the first treachery revealed each round (19137:B:1): its When Revealed effect cannot be canceled by player cards, told as it is revealed. Null for any other card. */
export function firstTreacheryNote(game: ScenarioState, cardId: string, name: string): string | null {
  return flagged(game, cardId, "firstTreachery") ? `${name} is the first treachery revealed this round: its When Revealed effect cannot be canceled by player cards.` : null;
}

/** The side a stage of the quest deck shows when the quest arrives at it, told with the advance: side A until the beginning of the next quest phase. Null for a stage that arrives side B. */
export function stageArrivalNote(game: ScenarioState, cardId: string): string | null {
  const stage = game.cards[cardId];
  if (!stage || stage.face !== "A" || !game.stages.some((item) => item.deck === true && item.code === stage.code)) return null;
  return "It shows side A: only its side A text works until it is flipped at the beginning of the quest phase.";
}

/** The beat of a stage the intent flipped or left (emce.gundabad-quest-deck, emce.bypassing): flipped to side B at the beginning of the quest phase (after the advance that brought it, when one did), or bypassed or replaced (it leads: it is why the quest moved). Null when neither happened. */
export function stageBeats(before: ScenarioState, after: ScenarioState, names: Pick<ChoiceNames, "card">): { rank: number; title: string; lines: readonly string[] } | null {
  const id = after.questStage;
  if (!id || !after.stages.some((item) => item.deck === true)) return null;
  if (before.cards[id]?.face === "A" && after.cards[id]?.face === "B" && before.questStage === id) {
    return { rank: 2, title: `${names.card(id)} is flipped`, lines: ["The quest card shows side B at the beginning of the quest phase: its side B text works from now on."] };
  }
  const left = after.stageLeft;
  if (left?.bypassed === true && left.to === id && before.questStage === left.from && before.questStage !== id) {
    const lost = before.cards[left.from]?.progress ?? 0;
    const progress = lost === 0 ? "It had no progress to lose" : `It loses its ${lost} progress`;
    // A stage searched out of the quest deck (Throat of the Mountain) shows side B at once and the deck is shuffled; a bypassed one arrives side A and goes to the bottom.
    if (after.cards[id]?.face === "B") return { rank: 0, title: `${names.card(id)} becomes the current quest`, lines: [`${progress} and the stage that was current goes back into the quest deck, which is shuffled: it is not defeated, so it is not added to the victory display. The new stage is flipped over at once.`] };
    return { rank: 0, title: `${names.card(left.from)} is bypassed`, lines: [`${progress} and goes to the bottom of the quest deck: it is not defeated, so it is not added to the victory display.`] };
  }
  return null;
}
