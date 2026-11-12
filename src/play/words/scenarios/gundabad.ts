// Rules: emce.gundabad-quest-deck, emce.bypassing, emce.caves-deck-gundabad, emce.treasure, rr.first-player, rr.search, rr.response, rr.cancel (data/rules/entries.json); ledger lines 19124:A:1, 19134:A:1, 19134:B:1, 19135:B:3, 19140:B:2, 19141:B:1, 19141:B:2, 19142:B:2, 19122:A:3, 19123:A:2, 12194:A:2
// The choices of Mount Gundabad on the live sheet (docs/design-system-table.md, Choice tray): each says the number, the side of the table and the player, and what declining does. A choice the first player makes for the group is not owned, so the sheet adds who chooses; one
// player's own choice leads with "Player N:" two-handed (`owned`) and has no lead solo. The words read the shape of a record's instructions, never a card code or an effect id, and the shapes other records share (a search of the deck for an attachment, a discard that wins the game, a pick of a questing character that is damaged) are told only in a game with a quest deck of stages (`inGundabad`): in
// another scenario's records they keep their ordinary words. The verbs only Mount Gundabad's records use (BypassStage, SearchQuestDeck, ActivateFromCaves, LookAtStages, FlipInPlace) need no gate. Dragon-sickness joins the encounter decks of the later scenarios, so it is told in every game. Pure.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { GameEvent, ScenarioState } from "../../../rules/core/state.ts";
import { stageName } from "../../../rules/families/wilderland/gundabad.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import type { ChoiceNames, PickWords } from "../choice.ts";
import { capital, plural } from "../list.ts";
import { seatSays } from "../seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

/** Whether the game is Mount Gundabad's: its quest is a quest deck of stages (the quest family's `deck`, emce.gundabad-quest-deck). */
export function inGundabad(game: ScenarioState): boolean {
  return game.stages.some((stage) => stage.deck === true);
}

/** The name of a card as a sheet or a beat tells it: a stage of the quest deck with its reading, any other card by its name. */
export function sheetName(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, cardId: string): string {
  return stageName(game, ctx, cardId, names.card(cardId));
}

const inOption = (choose: Choose, test: (step: Instruction) => boolean): boolean => choose.options.some((option) => option.instructions.some(test));

/** Whether the Choose is the bypass of a stage 2B: bypass it, or stay on it. */
const isBypass = (choose: Choose): boolean => choose.options.length === 2 && choose.options.some((option) => option.id === "bypass" && option.instructions.some((step) => step.verb === "BypassStage"));

/** Whether the Choose is a "may" to search one's own deck for an attachment with a trait (an Item) and add it to hand: search it, or decline. */
const isDeckSearch = (choose: Choose): boolean => choose.options.length === 2 && inOption(choose, (step) => step.verb === "Pick" && step.pick.from === "deck" && step.pick.cardType === "attachment" && step.pick.trait != null);

/** Whether the Choose is the "may" that discards a card to add an enemy to the victory display and win the game, or leaves it. */
const isKill = (choose: Choose): boolean => choose.options.length === 2 && inOption(choose, (step) => step.verb === "AddToVictory") && inOption(choose, (step) => step.verb === "WinGame");

// The named cards of the kill's picks: the one discarded (with its trait, "Reforged Wormsbane") and the enemy added to the victory display.
function killCards(choose: Choose): { discarded: string; added: string; short: string } | null {
  const picks = choose.options.flatMap((option) => option.instructions).flatMap((step) => (step.verb === "Pick" && step.pick.names?.[0] != null ? [step.pick] : []));
  const [first, last] = [picks[0], picks.at(-1)];
  if (!first?.names?.[0] || !last?.names?.[0]) return null;
  return { discarded: [first.trait, first.names[0]].filter((word) => word != null).join(" "), short: first.names[0], added: last.names[0] };
}

const article = (word: string): string => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);

/** The progress on the current quest card, told in the bypass: what it loses. */
function stageProgress(game: ScenarioState): number {
  return game.cards[game.questStage ?? ""]?.progress ?? 0;
}

/** The quest cards in the victory display now: the X of Wormsbane's Attack and Dagnir's cap, one more than their number. */
export function questsInVictory(game: ScenarioState, ctx: ReduceContext): number {
  return Object.values(game.cards).filter((card) => card.zone === "victory" && printedOf(ctx.cards, card.code).type === "quest").length;
}

const progressLost = (progress: number): string => (progress === 0 ? "it has no progress to lose" : `it loses its ${progress} progress`);
const waiting = (game: ScenarioState): string => `${game.questDeck.length} ${game.questDeck.length === 1 ? "waits" : "wait"} in the quest deck`;

/** The sentence over the Choose of Mount Gundabad: the bypass of a stage at the end of the combat phase (emce.bypassing), the search of a deck for an attachment and the discard that wins the game. Null for any other Choose, and outside Mount Gundabad. */
export function gundabadChooseNote(choose: Choose, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, source?: string | null): string | null {
  const card = source ? sheetName(game, ctx, names, source) : "this card";
  const says = seatSays(game);
  const here = inGundabad(game);
  if (here && isDeckSearch(choose)) {
    const search = choose.options.flatMap((option) => option.instructions).find((step) => step.verb === "Pick");
    const trait = search?.verb === "Pick" ? search.pick.trait : null;
    return says.titled(card, `search your deck for ${article(`${trait ?? "matching"} attachment`)} and add it to your hand? Your deck is shuffled after the search.`);
  }
  const kill = here && isKill(choose) ? killCards(choose) : null;
  if (kill) return says.titled(card, `discard your ${kill.discarded} to add ${kill.added} to the victory display? If you do, the players win the game.`);
  if (!isBypass(choose)) return null;
  const progress = stageProgress(game);
  const defeat = source != null && effectsOf(ctx, game.cards[source]?.code ?? "").some((effect) => effect.trigger === "questCardDefeated") ? ", and its 'when defeated' effect does not happen" : "";
  const lost = progress === 0 ? "It has no progress to lose and goes" : `It loses its ${progress} progress and goes`;
  const stay = progress === 0 ? "the quest continues" : `it keeps its ${progress} progress`;
  return `${source ? card : "This stage"}: bypass this stage? ${lost} to the bottom of the quest deck. It is not defeated: no victory display${defeat}. The next stage is revealed (${waiting(game)}). Stay and ${stay}.`;
}

/** The row of a branch of the bypass choice, of the search for an attachment or of the discard that wins the game, or null for another Choose. */
export function gundabadBranchWords(choose: Choose, optionId: string, game?: ScenarioState): string | null {
  const here = game != null && inGundabad(game);
  const kill = here && isKill(choose) ? killCards(choose) : null;
  if (kill) return optionId === "decline" ? `Keep ${kill.short}: ${kill.added} stays in play` : `Discard ${kill.short}: the players win`;
  if (here && isDeckSearch(choose)) {
    const search = choose.options.flatMap((option) => option.instructions).find((step) => step.verb === "Pick");
    const trait = search?.verb === "Pick" ? search.pick.trait : null;
    return optionId === "decline" ? "Don't search: your hand and deck stay as they are" : `Search for ${article(`${trait ?? "matching"} attachment`)} and add it to your hand`;
  }
  if (!isBypass(choose)) return null;
  const progress = game ? stageProgress(game) : 0;
  if (optionId === "bypass") return progress > 0 ? `Bypass the stage: lose ${progress} progress, go to the bottom of the quest deck` : "Bypass the stage: go to the bottom of the quest deck";
  return progress > 0 ? `Stay on the stage: keep ${progress} progress` : "Stay on the stage";
}

/** The row of a stage the players search the quest deck for, or look at to put on the bottom (19124:A:1, 19134:B:1, 19140:B:2): the stage by its reading, and where the look sends it. Null for another pick. */
export function gundabadOptionLabel(instruction: Instruction, id: string, game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">): string | null {
  if (!inGundabad(game)) return null;
  if (instruction.verb === "SearchQuestDeck") return sheetName(game, ctx, names, id);
  return instruction.verb === "LookAtStages" && instruction.bottom === true ? `${sheetName(game, ctx, names, id)} · to the bottom` : null;
}

/**
 * The sentence a pick or an ask of Mount Gundabad makes: the quest card searched out of the quest deck (19124:A:1), the stage the first player puts on the bottom (19134:B:1, 19140:B:2), the location searched out of the Caves deck (19137:B:2), the hero Wormsbane is attached to at
 * Setup (19134:A:1) and when it is reforged (19122:A:3), the enemy a stage has the players discard (19141:B:2), a questing character a stage damages (19141:B:1) and the cards of the kill that wins the game (19142:B:2). Null for any other, and outside Mount Gundabad.
 */
export function gundabadAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, game: ScenarioState | undefined, ctx: ReduceContext | undefined): PickWords | null {
  if (!game || !ctx) return null;
  const says = seatSays(game);
  const card = source ? names.card(source) : "this card";
  // One player's own choice leads with the player two-handed; the first player's choice for the group is not owned (the sheet adds who chooses).
  const own = (verb: string, text: string): PickWords => ({ verb, prompt: says.say(text), ...says.owned });
  const group = (verb: string, text: string): PickWords => ({ verb, prompt: capital(text) });
  const loses = "If that hero leaves play, the players lose the game.";
  if (instruction.verb === "SearchQuestDeck") return group("Search", `${card}: search the quest deck for a quest card and make it the current main quest, flipped over at once. The stage now current goes back into the quest deck; ${progressLost(stageProgress(game))}, and the quest deck is shuffled.`);
  if (instruction.verb === "ActivateFromCaves") return group("Search", `${card}: search the Caves deck for a location and make it the active location (the location active now returns to the staging area). The Caves deck is then shuffled.`);
  if (instruction.verb === "LookAtStages" && instruction.bottom === true) {
    // A stage whose own record flips the next one (FlipCurrentQuest: the quest phase begins at once after the planning phase) shows it flipped over; otherwise it arrives side A up and waits for the next quest phase.
    const flips = effectsOf(ctx, game.cards[game.questStage ?? ""]?.code ?? "").some((effect) => effect.trigger === "endOfPhase" && effect.instructions.some((step) => step.verb === "FlipCurrentQuest"));
    const arrives = flips ? "is flipped over at once" : "arrives side A up and is flipped at the beginning of the quest phase";
    return group("Choose", `Look at the top ${instruction.count} stages of the quest deck and choose 1 to place on the bottom. The other becomes the current quest: it ${arrives}.`);
  }
  if (instruction.verb !== "Pick") return null;
  const pick = instruction.pick;
  if (pick.type === "hero" && next?.verb === "FlipInPlace") return group("Attach", `${card}: choose a hero of any player to carry ${nameOf(ctx, next.code)}, flipped to its ${sideTrait(ctx, next.into, next.code) ?? "other"} side. ${loses}`);
  // The shapes other records share are told only here.
  if (!inGundabad(game)) return null;
  if (pick.type === "hero" && pick.attachable != null && next?.verb === "AttachSetAside") return group("Attach", `${card}: choose the hero who carries ${names.code(next.code)}, ${sideTrait(ctx, next.code, null) ?? "starting"} side up. ${loses}`);
  if (pick.names?.[0] != null && next?.verb === "Discard") return own("Discard", `choose the ${[pick.trait, pick.names[0]].filter((word) => word != null).join(" ")} you control to discard.`);
  if (pick.names?.[0] != null && next?.verb === "AddToVictory") return own("Add", `${pick.names[0]} has no hit points remaining: it is added to the victory display and the players win the game.`);
  if (pick.committed === true && pick.control === "you" && pick.type === "character" && next?.verb === "DamageCard") {
    const amount = typeof next.amount === "number" ? next.amount : 2;
    return own("Damage", `deal ${amount} damage to a questing character you control.`);
  }
  if (pick.type === "enemy" && pick.nonUnique === true && pick.who === "firstPlayer" && next?.verb === "Discard") return group("Discard", `${card}: choose a non-unique enemy in play to discard.`);
  return null;
}

/**
 * The character Dragon-sickness (12194:A:2) attaches to. It is told in every game, since it joins the encounter decks of the later scenarios: the shape (an attachment that takes every treasure to a character that carries one) is its own.
 */
export function dragonSicknessAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined): PickWords | null {
  if (instruction.verb !== "Pick" || next?.verb !== "AttachSelfToPicked" || instruction.pick.hasAttachment?.treasure !== true) return null;
  const card = source ? names.card(source) : "this card";
  return {
    verb: "Attach",
    prompt: `${card}: choose a character with 1 or more treasures attached. ${card} attaches to it, then every unguarded treasure in play is attached to that character. Each time that character exhausts, its controller raises their threat by 1 for each treasure attached to it.`,
  };
}


const nameOf = (ctx: ReduceContext, code: string): string => ctx.cards.get(code)?.name ?? code;

// The trait that tells the side of a card from `other` (Broken, Reforged): the traits one printing has and the other lacks. Null when the printing is not known.
function sideTrait(ctx: ReduceContext, code: string, other: string | null): string | null {
  const printed = ctx.cards.get(code);
  if (!printed) return null;
  const theirs = other == null ? [] : (ctx.cards.get(other)?.traits ?? []);
  return printed.traits.filter((trait) => !theirs.includes(trait)).at(-1) ?? null;
}

/** Whether the instruction, or one nested in it (a player's turn in ForEachPlayer, a branch of a Choose), passes the test. */
function within(step: Instruction, test: (step: Instruction) => boolean): boolean {
  if (test(step)) return true;
  const inner = step.verb === "ForEachPlayer" ? step.instructions : step.verb === "Choose" ? step.options.flatMap((option) => option.instructions) : [];
  return inner.some((item) => within(item, test));
}

// The Response of Mount Gundabad offered among `offered` for the event, with the step that tells which it is.
type Offered = { cardId: string; kind: "reforge" | "quest" | "hoard" | "kill"; step: Instruction };

function offeredResponse(game: ScenarioState, ctx: ReduceContext, event: GameEvent | null, offered: readonly string[]): Offered | null {
  if (!inGundabad(game)) return null;
  const records = (cardId: string): readonly Effect[] => effectsOf(ctx, game.cards[cardId]?.code ?? "").filter((effect) => effect.timing === "response" && effect.trigger === event?.trigger);
  const tests: readonly (readonly [Offered["kind"], (step: Instruction) => boolean])[] = [
    ["reforge", (step) => step.verb === "FlipInPlace"],
    ["quest", (step) => step.verb === "SearchQuestDeck"],
    ["hoard", (step) => step.verb === "Pick" && step.pick.from === "deck" && step.pick.cardType === "attachment" && step.pick.trait != null],
    ["kill", (step) => step.verb === "AddToVictory"],
  ];
  for (const [kind, test] of tests) {
    for (const cardId of offered) {
      const step = records(cardId).flatMap((effect) => effect.instructions).find((item) => within(item, test));
      if (step) return { cardId, kind, step };
    }
  }
  return null;
}

/** The FlipInPlace behind a reforging Response: Wormsbane, the side it is flipped to and the side it lies on. */
function reforging(ctx: ReduceContext, step: Instruction): { name: string; reforged: string; broken: string } | null {
  return step.verb === "FlipInPlace" ? { name: nameOf(ctx, step.code), reforged: sideTrait(ctx, step.into, step.code) ?? "flipped", broken: sideTrait(ctx, step.code, step.into) ?? "unflipped" } : null;
}

/**
 * The sentence over the Response window of a location explored (The First Forge, Dagnir's Hoard, Throat of the Mountain) or of an attack on Dagnir that left her with no hit points (the stage 2B Response), when one of the Responses offered is its own: what the Response does and what
 * passing leaves undone. Null for another event, and outside Mount Gundabad.
 */
export function gundabadResponseNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, event: GameEvent | null, offered: readonly string[]): string | null {
  const found = offeredResponse(game, ctx, event, offered);
  if (!found) return null;
  const seat = game.window?.kind === "response" ? game.window.seat : game.firstPlayer;
  const { say } = seatSays(game, seat);
  const explored = names.card(found.cardId);
  if (found.kind === "reforge") {
    const forge = reforging(ctx, found.step);
    if (!forge) return null;
    const attack = questsInVictory(game, ctx) + 1;
    const chooser = game.seatCount > 1 ? "the first player chooses" : "you choose";
    return say(`${explored} was explored. Flip ${forge.name} to its ${forge.reforged} side and attach it to any hero ${chooser}. That hero gets +${attack} Attack (1 more than the ${plural(attack - 1, "quest card")} in the victory display). If it leaves play, the players lose the game. Pass and ${forge.name} stays ${forge.broken}: the players cannot win the game without the ${forge.reforged} ${forge.name}.`);
  }
  if (found.kind === "quest") return say(`${explored} was explored. Search the quest deck (${plural(game.questDeck.length, "stage")}) for a quest card and make it the current main quest, flipped over at once. The stage now current (${progressLost(stageProgress(game))}) goes back into the quest deck, and the quest deck is shuffled. Pass and the quest stays as it is.`);
  if (found.kind === "hoard") return say(`${explored} was explored. Each player may search their deck for an Item attachment, add it to their hand and shuffle their deck. Pass and nobody searches.`);
  const kill = killOf(found.step);
  return event?.trigger === "attacked" && kill ? say(`${kill.added} has no hit points remaining. You may discard your ${kill.discarded} to add ${kill.added} to the victory display, and the players win the game. Pass and ${kill.added} stays in play.`) : null;
}

// The cards of the may inside a kill Response's record.
function killOf(step: Instruction): ReturnType<typeof killCards> {
  return step.verb === "Choose" ? killCards(step) : null;
}

/** What passing the Response leaves undone for good, as the armed Pass says it ("Tap again: Wormsbane stays Broken and the game cannot be won."): the Response that reforges Wormsbane and the one that wins the game. Null for any other. */
export function gundabadPassCaution(game: ScenarioState, ctx: ReduceContext, event: GameEvent | null, offered: readonly string[]): string | null {
  const found = offeredResponse(game, ctx, event, offered);
  if (found?.kind === "reforge") {
    const forge = reforging(ctx, found.step);
    return forge ? `Tap again: ${forge.name} stays ${forge.broken} and the game cannot be won.` : null;
  }
  const kill = found?.kind === "kill" ? killOf(found.step) : null;
  return kill ? `Tap again: ${kill.added} stays in play and the game is not won.` : null;
}
