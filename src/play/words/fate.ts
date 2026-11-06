// Rules: rr.first-player, rr.engaged, rr.response, rr.explored, rr.shadow-effects, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 19155:A:1, 19156:A:1, 19156:A:2, 19157:A:1, 19157:A:2, 19158:A:1, 19159:A:1, 19160:A:1, 19163:A:2, 19164:A:1, 19167:A:1, 19168:B:1, 19169:B:2, 19170:B:1.
// The choices, Responses and attacks of The Fate of Wilderland on the live sheet (docs/design-system-table.md, Choice tray): the fight on The Goblins' Assault. Each note says why the window opened and where the objective stands (what it holds, and what advances the quest or loses the game),
// each row what the branch does, and a branch that pushes the progress to the number that loses the game arms the confirm. One player's own choice leads with "Player N, Card:" two-handed (`owned`) and has no lead solo; the first player's choice for the group is not owned, so the sheet
// adds who chooses. The words read the shape of a record's instructions and the numbers the table holds, never a card code, an effect id or a title, and they are told only in a game that deals one of the scenario's own verbs (`inFate`): a lookalike record in another scenario keeps the
// ordinary words. Pure.
import type { Effect, Instruction } from "../../catalog/boundary.ts";
import { gameReads } from "../../rules/core/game-reads.ts";
import { printedOf } from "../../rules/core/printed.ts";
import { inPlay, type GameEvent, type ScenarioState } from "../../rules/core/state.ts";
import { attackedThisPhase } from "../../rules/families/wilderland/assault.ts";
import { frameScope, resolveAmount } from "../../rules/interpret/amounts.ts";
import type { ReduceContext } from "../../rules/interpret/interpret.ts";
import { effectsOf } from "../../rules/windows/listen.ts";

import type { ChoiceNames, PickWords } from "./choice.ts";
import { plural } from "./list.ts";
import { seatSays } from "./seat.ts";

type Choose = Extract<Instruction, { verb: "Choose" }>;

/** Whether the game is The Fate of Wilderland's: a card in it has a record that takes progress off a card by its title (RemoveProgressFrom), a verb only this scenario's records use. */
export function inFate(game: ScenarioState, ctx: ReduceContext): boolean {
  return gameReads(game, ctx, '"verb":"RemoveProgressFrom"');
}

const within = (steps: readonly Instruction[], test: (step: Instruction) => boolean): boolean => steps.some(test);

// The title a Pick of an objective by name picks, in an option that places progress on it ("place 1 progress on The Goblins' Assault").
function progressObjective(choose: Choose): string | null {
  for (const option of choose.options) {
    const [pick, place] = option.instructions;
    if (pick?.verb === "Pick" && pick.pick.type === "objective" && pick.pick.names?.[0] != null && place?.verb === "PlaceProgressOn") return pick.pick.names[0];
  }
  return null;
}

// The titles the Watchtower's Choose names: the card that takes the resource and the one that loses the progress.
function watchtowerCards(choose: Choose): { resource: string; progress: string } | null {
  const place = choose.options.flatMap((option) => option.instructions).find((step) => step.verb === "PlaceResourcesOnNamed");
  const remove = choose.options.flatMap((option) => option.instructions).find((step) => step.verb === "RemoveProgressFrom");
  return place?.verb === "PlaceResourcesOnNamed" && remove?.verb === "RemoveProgressFrom" ? { resource: place.named, progress: remove.named } : null;
}

const inPlayNamed = (game: ScenarioState, ctx: ReduceContext, name: string) => Object.values(game.cards).find((card) => inPlay(card.zone) && printedOf(ctx.cards, card.code).name === name);

/** What the current stage asks of the objective: the progress at which the quest advances at the end of the round, or the players lose the game (the AdvanceStage or LoseGame the stage's record guards with "X or more"). Null for a stage that asks none. */
export function stageGoal(game: ScenarioState, ctx: ReduceContext): { need: number; loses: boolean } | null {
  const code = game.cards[game.questStage ?? ""]?.code;
  if (!code) return null;
  for (const effect of effectsOf(ctx, code)) {
    for (const step of effect.instructions) {
      const when = step.verb === "AdvanceStage" || step.verb === "LoseGame" ? step.when : undefined;
      if (when?.kind === "less" && typeof when.left === "object" && when.left.players === true) return { need: resolveAmount(game, when.left, frameScope(game, game.firstPlayer, null), ctx) + 1, loses: step.verb === "LoseGame" };
    }
  }
  return null;
}

/** "The Goblins' Assault holds 3 of the 12 progress that advance the quest at the end of the round." */
export function assaultCount(game: ScenarioState, ctx: ReduceContext, objective: string): string {
  const held = inPlayNamed(game, ctx, objective)?.progress ?? 0;
  const goal = stageGoal(game, ctx);
  return goal ? `${objective} holds ${held} of the ${goal.need} progress that ${goal.loses ? "lose the game" : "advance the quest"} at the end of the round.` : `${objective} holds ${plural(held, "progress", "progress")}.`;
}

// The Heroes' Defense's own numbers: the resources that make Urdug engaged with each player, from its constant record ("5 resources for each player", at least), and the title of the enemy it engages.
export function defenseFacts(game: ScenarioState, ctx: ReduceContext, cardId: string): { need: number; held: number; enemy: string | null } | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const record = effectsOf(ctx, card.code).find((effect) => effect.timing === "constant" && effect.condition?.kind === "less" && typeof effect.condition.left === "object" && effect.condition.left.players === true);
  const condition = record?.condition;
  if (condition?.kind !== "less") return null;
  const engage = record?.instructions.find((step) => step.verb === "ModifyStat" && step.stat === "engagedWithAll");
  const holder = engage?.verb === "ModifyStat" ? engage.holders : undefined;
  return { need: resolveAmount(game, condition.left, frameScope(game, game.firstPlayer, null), ctx) + 1, held: card.resources, enemy: holder?.names?.[0] ?? null };
}

// The card whose constant record bars resource tokens on this card, when one does ("resources cannot be placed on The Heroes' Defense").
const barringCard = (game: ScenarioState, cardId: string): string | null => game.modifiers.find((modifier) => modifier.stat === "noResourcesPlaced" && modifier.instanceId === cardId)?.sourceId ?? null;

// The record that holds the instruction (the choice's own card), to read why its window opened.
function recordOf(ctx: ReduceContext, game: ScenarioState, source: string | null | undefined, choose: Choose): Effect | undefined {
  const code = source ? game.cards[source]?.code : undefined;
  const wanted = JSON.stringify(choose);
  return code ? effectsOf(ctx, code).find((effect) => effect.instructions.some((step) => JSON.stringify(step) === wanted)) : undefined;
}

// Why the window opened, from the record's trigger.
function reasonOf(effect: Effect | undefined): string {
  if (effect?.timing === "whenRevealed") return "it was revealed.";
  if (effect && "trigger" in effect && effect.trigger === "engaged") return "it engaged you.";
  if (effect && "trigger" in effect && effect.trigger === "attackResolved") return "it was dealt a shadow card with no effect.";
  return "";
}

/**
 * The sentence over a Choose of The Fate of Wilderland: the one that makes the player pay or place progress on the objective (an enemy that engaged, a shadow card with no effect, a treachery revealed), and the Watchtower's, which the first player answers. Each says why the window opened and
 * where the objective stands. Null for any other Choose, and outside The Fate of Wilderland.
 */
export function fateChooseNote(choose: Choose, game: ScenarioState, ctx: ReduceContext, names: ChoiceNames, source?: string | null): string | null {
  if (!inFate(game, ctx)) return null;
  const card = source ? names.card(source) : "This card";
  const objective = progressObjective(choose);
  if (objective) return seatSays(game).titled(card, [reasonOf(recordOf(ctx, game, source, choose)), assaultCount(game, ctx, objective)].filter((part) => part !== "").join(" "));
  const watch = watchtowerCards(choose);
  if (!watch) return null;
  const defense = Object.values(game.cards).find((item) => inPlay(item.zone) && printedOf(ctx.cards, item.code).name === watch.resource);
  const facts = defense ? defenseFacts(game, ctx, defense.id) : null;
  const bar = defense ? barringCard(game, defense.id) : null;
  const resource = !facts ? "" : bar ? `${names.card(bar)} is in the staging area, so no resource can be placed on ${watch.resource}: only progress comes off.` : `${watch.resource} holds ${facts.held} of the ${facts.need} resources that engage ${facts.enemy ?? "the enemy"} with each player.`;
  return [`${card} was explored.`, resource, assaultCount(game, ctx, watch.progress)].filter((part) => part !== "").join(" ");
}

const GAME_LOST_AT_ONCE = "the players lose the game at the end of the round, unless progress comes off it";

/** The rows of the Choose's branches, when it is one of the scenario's: "Place 1 progress on The Goblins' Assault", "Exhaust a character you control". Empty for any other Choose, and outside The Fate of Wilderland. */
export function fateBranchRows(game: ScenarioState, ctx: ReduceContext, choose: Choose): Readonly<Record<string, string>> {
  if (!inFate(game, ctx)) return {};
  const objective = progressObjective(choose);
  if (!objective) return {};
  return Object.fromEntries(
    choose.options.flatMap((option): [string, string][] => {
      const place = option.instructions.find((step) => step.verb === "PlaceProgressOn");
      if (place?.verb === "PlaceProgressOn") return [[option.id, `Place ${typeof place.amount === "number" ? place.amount : "X"} progress on ${objective}`]];
      return within(option.instructions, (step) => step.verb === "Exhaust") ? [[option.id, "Exhaust a character you control"]] : [];
    }),
  );
}

/** The row of a branch of one of the scenario's choices, or null for another Choose. */
export function fateBranchWords(choose: Choose, optionId: string, rows?: Readonly<Record<string, string>>): string | null {
  return progressObjective(choose) != null ? (rows?.[optionId] ?? null) : null;
}

/** "Tap again: The Goblins' Assault would hold 24 of the 24 ..." for the branch that places progress when that brings the objective to the number that loses the game on the last stage. Null for any other branch. */
export function fateBranchCaution(choose: Choose, optionId: string, game: ScenarioState, ctx: ReduceContext): string | null {
  const objective = progressObjective(choose);
  const place = choose.options.find((option) => option.id === optionId)?.instructions.find((step) => step.verb === "PlaceProgressOn");
  if (!objective || place?.verb !== "PlaceProgressOn" || typeof place.amount !== "number" || !inFate(game, ctx)) return null;
  const goal = stageGoal(game, ctx);
  const would = (inPlayNamed(game, ctx, objective)?.progress ?? 0) + place.amount;
  return goal?.loses && would >= goal.need ? `Tap again: ${objective} would hold ${would} of ${goal.need} and ${GAME_LOST_AT_ONCE}.` : null;
}

/** The sentence a pick of the scenario asks: the character the player exhausts in place of putting progress on the objective. Null for any other pick, and outside The Fate of Wilderland. */
export function fateAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, game: ScenarioState | undefined, ctx: ReduceContext | undefined): PickWords | null {
  if (!game || !ctx || instruction.verb !== "Pick" || next?.verb !== "Exhaust" || instruction.pick.type !== "character" || instruction.pick.control !== "you" || !inFate(game, ctx)) return null;
  const says = seatSays(game);
  return { verb: "Exhaust", prompt: says.titled(source ? names.card(source) : "This card", "choose a ready character you control to exhaust."), ...says.owned };
}

// The Response windows of the scenario, told by the shape of the record: a resource placed on a card that counts them when an enemy is destroyed, and the choice the explored Watchtower gives.
type Offered = { cardId: string; kind: "resource" | "watchtower"; choose?: Choose };

function offeredResponse(game: ScenarioState, ctx: ReduceContext, event: GameEvent | null, offered: readonly string[]): Offered | null {
  if (!inFate(game, ctx) || !event) return null;
  for (const cardId of offered) {
    for (const effect of effectsOf(ctx, game.cards[cardId]?.code ?? "")) {
      if (effect.timing !== "response" || effect.trigger !== event.trigger) continue;
      if (event.trigger === "enemyDestroyed" && effect.instructions.some((step) => step.verb === "PlaceResourceTokens" && step.on === "self")) return { cardId, kind: "resource" };
      const choose = effect.instructions.find((step): step is Choose => step.verb === "Choose" && watchtowerCards(step) != null);
      if (choose) return { cardId, kind: "watchtower", choose };
    }
  }
  return null;
}

/**
 * The sentence over the Response window of The Heroes' Defense (an enemy was destroyed: the resource it places and how near that brings Urdug's engagement, or the card that bars it) and of the explored Watchtower (the choice it will ask): what the Response does and
 * what passing leaves. Null for another event, and outside The Fate of Wilderland.
 */
export function fateResponseNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, event: GameEvent | null, offered: readonly string[]): string | null {
  const found = offeredResponse(game, ctx, event, offered);
  if (!found) return null;
  const { say } = seatSays(game, game.window?.kind === "response" ? game.window.seat : game.firstPlayer);
  const title = names.card(found.cardId);
  if (found.kind === "watchtower" && found.choose) {
    const note = fateChooseNote(found.choose, game, ctx, { ...names, code: (code) => ctx.cards.get(code)?.name ?? code }, found.cardId);
    const only = note?.includes("only progress comes off") === true;
    return say(`${note ?? `${title} was explored.`} ${only ? "The first player takes the progress off." : "The first player places the resource or takes the progress off."} Pass and ${only ? "the progress stays" : "neither happens"}.`);
  }
  const facts = defenseFacts(game, ctx, found.cardId);
  const destroyed = event?.subject ? `${names.card(event.subject)} was destroyed. ` : "";
  if (!facts) return null;
  const bar = barringCard(game, found.cardId);
  const engaged = facts.enemy ?? "the enemy";
  const holds = `${title} holds ${facts.held} of the ${facts.need} resources that engage ${engaged} with each player.`;
  return say(`${destroyed}${bar ? `${holds} ${names.card(bar)} is in the staging area, so no resource can be placed on it: passing loses nothing.` : `${holds} Place 1 resource on it. Pass and it stays at ${facts.held}.`}`);
}

/** The sentence over the optional engagement: the enemy that cannot be engaged at all, and the resources on the card that count him as engaged with each player. Null in any other game. */
export function fateEngageNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">): string | null {
  if (!inFate(game, ctx)) return null;
  const card = game.staging.find((id) => effectsOf(ctx, game.cards[id]?.code ?? "").some((effect) => effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "cannotBeEngaged")));
  const counter = game.staging.find((id) => defenseFacts(game, ctx, id) != null);
  const facts = counter ? defenseFacts(game, ctx, counter) : null;
  if (!card || !counter || !facts) return null;
  const was = facts.held >= facts.need ? `${names.card(counter)} holds ${facts.held} of ${facts.need} resources, so he counts as engaged with each player now.` : `Once ${names.card(counter)} holds ${facts.need} resources (${facts.held} now) he counts as engaged with each player.`;
  return `${names.card(card)} cannot be engaged. ${was}`;
}

// The enemy whose attack discards the top card of the encounter deck and adds its Threat to the Attack (the Forced effect of its own record).
const discardsOnAttack = (ctx: ReduceContext, code: string): boolean => effectsOf(ctx, code).some((effect) => effect.timing === "forced" && effect.trigger === "attacks" && effect.instructions.some((step) => step.verb === "DiscardEncounterTop"));

/** The words of the attack that discards the encounter deck's top card for its Threat, on the defense sheet: whom he attacks, and the card discarded. Empty for any other attack, and outside The Fate of Wilderland. */
export function fateAttackNote(game: ScenarioState, ctx: ReduceContext, name: (id: string) => string): string {
  const attack = game.pendingAttack;
  const enemy = attack ? game.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || !inFate(game, ctx) || !discardsOnAttack(ctx, enemy.code)) return "";
  const who = game.seatCount > 1 ? `Player ${attack.seat + 1}` : "you";
  const discarded = game.encounterDiscard.at(-1);
  const threat = discarded ? printedOf(ctx.cards, game.cards[discarded]?.code ?? "").threat : undefined;
  const added = discarded && threat != null ? ` The top card of the encounter deck, ${name(discarded)}, was discarded: its printed Threat ${threat} is part of this Attack.` : "";
  const from = attack.immediate === true ? `${name(enemy.id)} attacks ${who} now, from the staging area.` : `${name(enemy.id)} is engaged with each player and attacks ${game.seatCount > 1 ? `each in turn: this attack is on ${who}` : "you"}.`;
  return ` ${from}${added}`;
}

// The title of the enemy that takes no damage unless it has resolved an attack this phase (the condition of a constant record: "not attackedThisPhase").
const shieldedTitles = (ctx: ReduceContext): string[] =>
  ctx.effects.flatMap((effect: Effect) => (effect.condition?.kind === "not" && effect.condition.condition.kind === "attackedThisPhase" ? [effect.condition.condition.name] : []));

/** The sentence under the Attack on the enemy that takes no damage until he has attacked: whether he has resolved an attack this phase. Empty for any other enemy, and outside The Fate of Wilderland. */
export function fateTargetNote(game: ScenarioState, ctx: ReduceContext, enemyId: string): string {
  const enemy = game.cards[enemyId];
  if (!enemy || !inFate(game, ctx)) return "";
  const name = printedOf(ctx.cards, enemy.code).name;
  if (!shieldedTitles(ctx).includes(name)) return "";
  return attackedThisPhase(game, name, ctx) ? " He has resolved an attack this phase, so damage can be dealt to him." : " He takes no damage until he has resolved an attack this phase, and he has not.";
}
