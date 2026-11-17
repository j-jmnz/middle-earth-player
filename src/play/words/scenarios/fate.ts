// Rules: rr.first-player, rr.engaged, rr.response, rr.explored, rr.shadow-effects, rr.attacks-outside-the-combat-phase (data/rules/entries.json); ledger lines 19155:A:1, 19156:A:1, 19156:A:2, 19157:A:1, 19157:A:2, 19158:A:1, 19159:A:1, 19160:A:1, 19163:A:2, 19164:A:1, 19167:A:1, 19168:B:1, 19169:B:2, 19170:B:1.
// The choices, Responses and attacks of The Fate of Wilderland on the live sheet (docs/design-system-table.md, Choice tray): the fight on The Goblins' Assault. Each note says why the window opened and where the objective stands (what it holds, and what advances the quest or loses the game),
// each row what the branch does, and a branch that pushes the progress to the number that loses the game arms the confirm. One player's own choice leads with "Player N, Card:" two-handed (`owned`) and has no lead solo; the first player's choice for the group is not owned, so the sheet
// adds who chooses. The words read the shape of a record's instructions and the numbers the table holds, never a card code, an effect id or a title, and they are told only in a game that deals one of the scenario's own verbs (`inFate`): a lookalike record in another scenario keeps the
// ordinary words. Pure.
import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { gameReads } from "../../../rules/core/game-reads.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { GameEvent, ScenarioState } from "../../../rules/core/state.ts";
import { namedInPlay } from "../../../rules/families/misc/amounts.ts";
import { attackedThisPhase } from "../../../rules/families/wilderland/assault.ts";
import { frameScope, resolveAmount } from "../../../rules/interpret/amounts.ts";
import type { ReduceContext } from "../../../rules/interpret/interpret.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import type { ChoiceNames, PickWords } from "../choice.ts";
import { plural } from "../list.ts";
import { seatSays } from "../seat.ts";

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

// The Watchtower's Choose: the card that takes the resource (an option that picks it by title and places resource tokens on it), the one that loses the progress (RemoveProgressFrom) and the amounts.
type Watch = { resource: string; progress: string; placed: Amount; removed: Amount };
type Amount = Extract<Instruction, { verb: "RemoveProgressFrom" }>["amount"];
function watchtowerCards(choose: Choose): Watch | null {
  const steps = choose.options.flatMap((option) => option.instructions);
  const pick = steps.find((step) => step.verb === "Pick" && step.pick.type === "objective" && step.pick.names?.[0] != null);
  const place = steps.find((step) => step.verb === "PlaceResourceTokens");
  const remove = steps.find((step) => step.verb === "RemoveProgressFrom");
  const resource = pick?.verb === "Pick" ? pick.pick.names?.[0] : undefined;
  return resource != null && place?.verb === "PlaceResourceTokens" && remove?.verb === "RemoveProgressFrom" && remove.named != null ? { resource, progress: remove.named, placed: place.amount, removed: remove.amount } : null;
}

const progressOf = (game: ScenarioState, ctx: ReduceContext, title: string): number => game.cards[namedInPlay(game, title, ctx) ?? ""]?.progress ?? 0;

/** What the current stage asks of the objective: the progress at which the quest advances at the end of the round, or the players lose the game (the AdvanceStage or LoseGame the stage's record guards with "X or more"), and what the end of the round adds first (1 for each enemy in the staging area or in play, from the record's PlaceProgressOn; null when the stage adds none). Null for a stage that asks nothing. */
export type StageGoal = { need: number; loses: boolean; round: { amount: number; where: "staging" | "play" } | null };
export function stageGoal(game: ScenarioState, ctx: ReduceContext): StageGoal | null {
  const code = game.cards[game.questStage ?? ""]?.code;
  if (!code) return null;
  const scope = frameScope(game, game.firstPlayer, null);
  for (const effect of effectsOf(ctx, code)) {
    for (const step of effect.instructions) {
      const when = step.verb === "AdvanceStage" || step.verb === "LoseGame" ? step.when : undefined;
      if (when?.kind !== "less" || typeof when.left !== "object" || when.left.players !== true) continue;
      const each = effect.instructions.find((other) => other.verb === "PlaceProgressOn" && typeof other.amount === "object" && other.amount.count != null);
      const counted = each?.verb === "PlaceProgressOn" && typeof each.amount === "object" ? each.amount : undefined;
      const round = counted?.count ? { amount: resolveAmount(game, counted, scope, ctx), where: counted.count.stagingOnly === true ? ("staging" as const) : ("play" as const) } : null;
      return { need: resolveAmount(game, when.left, scope, ctx) + 1, loses: step.verb === "LoseGame", round };
    }
  }
  return null;
}

const whereWords = (where: "staging" | "play"): string => (where === "staging" ? "the staging area" : "play");

/** "The Goblins' Assault: 3 of 4 progress, +2 at the end of the round (1 for each enemy in the staging area). At 4 the goblins push the quest on." */
export function assaultCount(game: ScenarioState, ctx: ReduceContext, objective: string): string {
  const held = progressOf(game, ctx, objective);
  const goal = stageGoal(game, ctx);
  if (!goal) return `${objective} holds ${plural(held, "progress", "progress")}.`;
  const coming = goal.round ? `, +${goal.round.amount} at the end of the round (1 for each enemy in ${whereWords(goal.round.where)})` : "";
  return `${objective}: ${held} of ${goal.need} progress${coming}. At ${goal.need} ${goal.loses ? "the game is lost" : "the goblins push the quest on"}.`;
}

/** Whether the objective, with `extra` more progress, would stand at the number that loses the game once the end of the round adds its own: only on a stage that loses. */
function lossLooms(game: ScenarioState, ctx: ReduceContext, objective: string, extra: number): { total: number; need: number; round: StageGoal["round"] } | null {
  const goal = stageGoal(game, ctx);
  const total = progressOf(game, ctx, objective) + extra + (goal?.round?.amount ?? 0);
  return goal?.loses && total >= goal.need ? { total, need: goal.need, round: goal.round } : null;
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

// The Watchtower's numbers on the table: the resources on the card that counts them and the card that bars a resource (data, from the flag), the amounts the option places and removes.
type Standing = { facts: ReturnType<typeof defenseFacts>; bar: string | null; placed: number; removed: number };
function standing(game: ScenarioState, ctx: ReduceContext, watch: Watch): Standing {
  const defense = namedInPlay(game, watch.resource, ctx);
  const scope = frameScope(game, game.firstPlayer, null);
  return { facts: defense ? defenseFacts(game, ctx, defense) : null, bar: defense ? barringCard(game, defense) : null, placed: resolveAmount(game, watch.placed, scope, ctx), removed: resolveAmount(game, watch.removed, scope, ctx) };
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
  const { facts, bar } = standing(game, ctx, watch);
  const resource = !facts ? "" : bar ? `${names.card(bar)} is in the staging area, so no resource can be placed on ${watch.resource}.` : `${watch.resource} holds ${facts.held} of the ${facts.need} resources that make ${facts.enemy ?? "the enemy"} engaged with each player.`;
  return [`${card} was explored.`, resource, assaultCount(game, ctx, watch.progress)].filter((part) => part !== "").join(" ");
}

/** The rows of the Choose's branches, when it is one of the scenario's: "Place 1 progress on The Goblins' Assault", "Exhaust a character you control", "Fierce Vanguard gets +2 Attack until the end of the round", the Watchtower's two. Empty for any other Choose, and outside The Fate of Wilderland. */
export function fateBranchRows(game: ScenarioState, ctx: ReduceContext, choose: Choose, sourceId?: string | null): Readonly<Record<string, string>> {
  if (!inFate(game, ctx)) return {};
  const watch = watchtowerCards(choose);
  if (watch) {
    const { placed, removed } = standing(game, ctx, watch);
    return Object.fromEntries(
      choose.options.flatMap((option): [string, string][] => {
        if (within(option.instructions, (step) => step.verb === "PlaceResourceTokens")) return [[option.id, `Place ${plural(placed, "resource")} on ${watch.resource}`]];
        return within(option.instructions, (step) => step.verb === "RemoveProgressFrom") ? [[option.id, `Remove ${removed} progress from ${watch.progress}`]] : [];
      }),
    );
  }
  const objective = progressObjective(choose);
  if (!objective) return {};
  const card = sourceId ? printedOf(ctx.cards, game.cards[sourceId]?.code ?? "").name : "This card";
  return Object.fromEntries(
    choose.options.flatMap((option): [string, string][] => {
      const place = option.instructions.find((step) => step.verb === "PlaceProgressOn");
      if (place?.verb === "PlaceProgressOn") return [[option.id, `Place ${typeof place.amount === "number" ? place.amount : "X"} progress on ${objective}`]];
      if (within(option.instructions, (step) => step.verb === "Exhaust")) return [[option.id, "Exhaust a character you control"]];
      const boost = option.instructions.find((step) => step.verb === "ModifyStat" && step.target === "self" && step.until === "endOfRound" && typeof step.amount === "number");
      if (boost?.verb === "ModifyStat" && typeof boost.amount === "number") return [[option.id, `${card} gets ${boost.amount > 0 ? "+" : ""}${boost.amount} ${boost.stat.charAt(0).toUpperCase()}${boost.stat.slice(1)} until the end of the round`]];
      return within(option.instructions, (step) => step.verb === "ReturnToStaging") ? [[option.id, `Return ${card} to the staging area: it does not attack you this phase`]] : [];
    }),
  );
}

/** The row of a branch of one of the scenario's choices, or null for another Choose and outside The Fate of Wilderland. */
export function fateBranchWords(choose: Choose, optionId: string, rows: Readonly<Record<string, string>> | undefined, game: ScenarioState | undefined, ctx: ReduceContext | undefined): string | null {
  if (!game || !ctx || !inFate(game, ctx)) return null;
  return progressObjective(choose) != null || watchtowerCards(choose) != null ? (rows?.[optionId] ?? null) : null;
}

/**
 * "Tap again: with 1 for each enemy in play, The Goblins' Assault reaches 16 of 16 at the end of the round and the game is lost" for the branch that places progress when, with what the end of the round adds, that brings the objective to the number that loses the game on the last stage;
 * "Tap again: no progress comes off and the game is lost at the end of the round" for the Watchtower's branch that does not take progress off when the stage loses at the number already there. Null for any other branch.
 */
export function fateBranchCaution(choose: Choose, optionId: string, game: ScenarioState, ctx: ReduceContext): string | null {
  if (!inFate(game, ctx)) return null;
  const steps = choose.options.find((option) => option.id === optionId)?.instructions ?? [];
  const watch = watchtowerCards(choose);
  if (watch) return within(steps, (step) => step.verb === "RemoveProgressFrom") ? null : fateStandCaution(game, ctx, watch.progress);
  const objective = progressObjective(choose);
  const place = steps.find((step) => step.verb === "PlaceProgressOn");
  if (!objective || place?.verb !== "PlaceProgressOn" || typeof place.amount !== "number") return null;
  const looms = lossLooms(game, ctx, objective, place.amount);
  return looms ? `Tap again: ${looms.round ? `with 1 for each enemy in ${looms.round.where === "staging" ? "the staging area" : "play"}, ` : ""}${objective} reaches ${looms.total} of ${looms.need} at the end of the round and the game is lost` : null;
}

// The caution before a Watchtower choice that leaves the progress where it is: the last stage loses at the end of the round with what the objective holds.
function fateStandCaution(game: ScenarioState, ctx: ReduceContext, objective: string): string | null {
  return lossLooms(game, ctx, objective, 0) ? "Tap again: no progress comes off and the game is lost at the end of the round" : null;
}

/** The sentence a pick of the scenario asks: the character the player exhausts in place of putting progress on the objective. Null for any other pick, and outside The Fate of Wilderland. */
export function fateAsk(instruction: Instruction, source: string | null, names: ChoiceNames, next: Instruction | undefined, game: ScenarioState | undefined, ctx: ReduceContext | undefined): PickWords | null {
  if (!game || !ctx || instruction.verb !== "Pick" || next?.verb !== "Exhaust" || instruction.pick.type !== "character" || instruction.pick.control !== "you" || !inFate(game, ctx)) return null;
  const says = seatSays(game);
  return { verb: "Exhaust", prompt: says.titled(source ? names.card(source) : "This card", "choose a ready character you control to exhaust."), ...says.owned };
}

// The Response windows of the scenario, told by the shape of the record: a resource placed on a card that counts them when an enemy is destroyed, and the choice the explored Watchtower gives.
type Offered = { cardId: string; kind: "resource" | "watchtower"; choose?: Choose; amount?: Amount };

function offeredResponse(game: ScenarioState, ctx: ReduceContext, event: GameEvent | null, offered: readonly string[]): Offered | null {
  if (!inFate(game, ctx) || !event) return null;
  for (const cardId of offered) {
    for (const effect of effectsOf(ctx, game.cards[cardId]?.code ?? "")) {
      if (effect.timing !== "response" || effect.trigger !== event.trigger) continue;
      const place = effect.instructions.find((step) => step.verb === "PlaceResourceTokens" && step.on === "self");
      if (event.trigger === "enemyDestroyed" && place?.verb === "PlaceResourceTokens") return { cardId, kind: "resource", amount: place.amount };
      const choose = effect.instructions.find((step): step is Choose => step.verb === "Choose" && watchtowerCards(step) != null);
      if (choose) return { cardId, kind: "watchtower", choose };
    }
  }
  return null;
}

/**
 * The sentence over the Response window of The Heroes' Defense (an enemy was destroyed: the resource it places and how near that brings Urdug's engagement) and of the explored Watchtower (the choice it will ask): what the Response does and what passing leaves.
 * Null for another event, and outside The Fate of Wilderland.
 */
export function fateResponseNote(game: ScenarioState, ctx: ReduceContext, names: Pick<ChoiceNames, "card">, event: GameEvent | null, offered: readonly string[]): string | null {
  const found = offeredResponse(game, ctx, event, offered);
  if (!found) return null;
  const { say } = seatSays(game, game.window?.kind === "response" ? game.window.seat : game.firstPlayer);
  const title = names.card(found.cardId);
  const watch = found.choose ? watchtowerCards(found.choose) : null;
  if (found.kind === "watchtower") {
    if (!watch) return null;
    const { facts, bar, placed, removed } = standing(game, ctx, watch);
    const goal = stageGoal(game, ctx);
    const held = progressOf(game, ctx, watch.progress);
    const take = `take ${removed} progress off ${watch.progress}${goal ? ` (${held} of ${goal.need})` : ""}`;
    if (bar) return say(`${title} was explored. ${names.card(bar)} is in the staging area, so no resource can be placed on ${watch.resource}. The first player may ${take}. Pass and the progress stays.`);
    const put = facts ? `put ${plural(placed, "resource")} on ${watch.resource} (${facts.held} of ${facts.need}) or ` : "";
    return say(`${title} was explored. The first player may ${put}${take}. Pass and neither happens.`);
  }
  const facts = defenseFacts(game, ctx, found.cardId);
  if (!facts) return null;
  const destroyed = event?.subject ? `${names.card(event.subject)} was destroyed. ` : "";
  const amount = found.amount != null ? resolveAmount(game, found.amount, frameScope(game, game.firstPlayer, found.cardId), ctx) : 1;
  return say(`${destroyed}${title} holds ${facts.held} of the ${facts.need} resources that make ${facts.enemy ?? "the enemy"} engaged with each player. Use it to place ${plural(amount, "resource")}. Pass and it stays at ${facts.held}.`);
}

/** The caution before passing the explored Watchtower's Response on the last stage, when the objective already stands at the number that loses the game: "Tap again: no progress comes off and the game is lost at the end of the round". Null for any other Response. */
export function fatePassCaution(game: ScenarioState, ctx: ReduceContext, event: GameEvent | null, offered: readonly string[]): string | null {
  const found = offeredResponse(game, ctx, event, offered);
  const watch = found?.choose ? watchtowerCards(found.choose) : null;
  return found?.kind === "watchtower" && watch ? fateStandCaution(game, ctx, watch.progress) : null;
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

/** The enemy whose attack discards the top card of the encounter deck and adds its Threat to the Attack (the Forced effect of its own record). */
export const discardsOnAttack = (ctx: ReduceContext, code: string): boolean => effectsOf(ctx, code).some((effect) => effect.timing === "forced" && effect.trigger === "attacks" && effect.instructions.some((step) => step.verb === "DiscardEncounterTop"));

// The Threat the enemy's own Forced effect added to this attack: its attack modifier for the attack, set by the record on the enemy itself.
const addedThreat = (game: ScenarioState, enemyId: string): number | null => game.modifiers.find((modifier) => modifier.instanceId === enemyId && modifier.sourceId === enemyId && modifier.stat === "attack" && modifier.until === "endOfAttack")?.amount ?? null;

/** The card the enemy's Forced effect discarded for this attack and the Threat it added: the Threat is the enemy's attack modifier, the card the last one discarded with that printed Threat. Null while the attack carries no such modifier. */
export function discardedForThreat(game: ScenarioState, ctx: ReduceContext, enemyId: string): { card: string | undefined; threat: number } | null {
  const threat = addedThreat(game, enemyId);
  if (threat == null) return null;
  return { card: [...game.encounterDiscard].reverse().find((id) => printedOf(ctx.cards, game.cards[id]?.code ?? "").threat === threat), threat };
}

// What the attack leaves for its end when it destroys a character (Urdug's Command: "The Goblins' Assault gets 1 progress"), from the instructions it carries.
function afterDestroying(attack: NonNullable<ScenarioState["pendingAttack"]>, game: ScenarioState, ctx: ReduceContext): string {
  const place = (attack.after ?? []).find((step) => step.verb === "PlaceProgressOn");
  const pick = (attack.after ?? []).find((step) => step.verb === "Pick" && step.pick.type === "objective");
  const objective = pick?.verb === "Pick" ? pick.pick.names?.[0] : undefined;
  if (place?.verb !== "PlaceProgressOn" || typeof place.amount !== "number" || !objective) return "";
  const looms = lossLooms(game, ctx, objective, place.amount);
  return ` If this attack destroys a character, ${objective} gets ${place.amount} progress${looms ? `. It then reaches ${looms.total} of ${looms.need} at the end of the round: the game is lost` : ""}.`;
}

/** The words of the attack that discards the encounter deck's top card for its Threat, on the defense sheet: whom he attacks, what a destroyed character costs when it is Urdug's Command, and the card discarded. Empty for any other attack, and outside The Fate of Wilderland. */
export function fateAttackNote(game: ScenarioState, ctx: ReduceContext, name: (id: string) => string): string {
  const attack = game.pendingAttack;
  const enemy = attack ? game.cards[attack.enemyId] : undefined;
  if (!attack || !enemy || !inFate(game, ctx) || !discardsOnAttack(ctx, enemy.code)) return "";
  const who = game.seatCount > 1 ? `Player ${attack.seat + 1}` : "you";
  const taken = discardedForThreat(game, ctx, enemy.id);
  const added = taken ? ` The top card of the encounter deck${taken.card ? `, ${name(taken.card)},` : ""} was discarded: its printed Threat ${taken.threat} is part of this Attack.` : "";
  const from = attack.immediate === true ? `${name(enemy.id)} attacks ${who} now, from the staging area.${afterDestroying(attack, game, ctx)}` : `${name(enemy.id)} is engaged with each player and attacks ${game.seatCount > 1 ? `each in turn: this attack is on ${who}` : "you"}.`;
  return ` ${from}${added}`;
}

/** The titles of the enemies that take no damage unless they have resolved an attack this phase (a constant record's `not attackedThisPhase`). */
export const shieldedTitles = (ctx: ReduceContext): string[] =>
  ctx.effects.flatMap((effect: Effect) => (effect.condition?.kind === "not" && effect.condition.condition.kind === "attackedThisPhase" ? [effect.condition.condition.name] : []));

/**
 * The note of the Attack on the enemy that takes no damage until he has attacked: his Defense and what raises it, who is asked, whether he has resolved an attack this phase and what destroying him does. Null for any other enemy, and outside The Fate of Wilderland.
 * "Defense 4 (+2 for each other enemy in play). Choose the characters that attack Urdug. He takes no damage until he has attacked this phase, and he has not."
 */
export function fateTargetNote(game: ScenarioState, ctx: ReduceContext, enemyId: string, defense: number, name: string): string | null {
  const enemy = game.cards[enemyId];
  if (!enemy || !inFate(game, ctx)) return null;
  const title = printedOf(ctx.cards, enemy.code).name;
  if (!shieldedTitles(ctx).includes(title)) return null;
  const raise = ctx.effects.flatMap((effect) => effect.instructions).find((step) => step.verb === "ModifyStat" && step.stat === "defense" && step.holders?.names?.includes(title) === true && typeof step.amount === "object" && step.amount.times != null);
  const times = raise?.verb === "ModifyStat" && typeof raise.amount === "object" ? raise.amount.times : undefined;
  const wins = effectsOf(ctx, enemy.code).some((effect) => effect.instructions.some((step) => step.verb === "WinGame"));
  const raised = times != null ? ` (+${times} for each other enemy in play)` : "";
  const status = attackedThisPhase(game, title, ctx) ? `He has attacked this phase, so he can be damaged.${wins ? " Destroy him and the players win." : ""}` : "He takes no damage until he has attacked this phase, and he has not.";
  return `Defense ${defense}${raised}. Choose the characters that attack ${name}. ${status}`;
}
