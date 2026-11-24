// Rules: ats.prowl, hon.siege, hon.archery, faq.victory-display, rr.cost (data/rules/entries.json); ledger lines 06044:B:2, 06044:B:3, 06045:A:3, 06047:A:1, 06048:A:2, 06049:A:1, 06050:A:1, 06051:A:1, 06052:A:1, 06054:A:1.
//
// The pieces The Drúadan Forest's cards hold on the table: the Prowl X value of an enemy (a chip read from its own record, as Underworld X is), the Archery X of the Hunter, the archery a Glade gives a Wose, the progress an enemy holds against its hit points while stage 3 turns the damage of a
// character's attack into progress, the win bar of stage 3 (progress on the stage and Drû-buri-Drû in the victory display), the dial of Drû-buri-Drû, and the readout of an attack with Willpower. Every hook reads this scenario's own records (the verb GroupDiscardResources, the stat archeryBonus) or
// the flags of The Passage Out, and is empty in any other scenario. The engine decided every number; nothing here changes one. Pure, so a test reads it.
import type { Effect } from "../../../catalog/boundary.ts";
import { archeryRecipients } from "../../../rules/combat/combat.ts";
import { isAllyLike, printedOf } from "../../../rules/core/printed.ts";
import { flagged, modifierActive, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import { heldBy } from "../../../rules/core/holder-classes.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { hasTrait } from "../../../rules/interpret/conditions.ts";
import { resolveAmount } from "../../../rules/interpret/amounts.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";
import { questPointsOf } from "../../../rules/quest/quest.ts";

import { druDialDoneNote, druDialLimit, druDialName, druDialNote, progressFilledWords, progressHeldWords, progressResultWords, winBarWords } from "../../words/scenarios/against-the-shadow/druadan.ts";
import type { TableDial } from "../dials.ts";

const SCENARIO = "the-druadan-forest";
const STAGE_THREE = "06044";
const DRU_BURI_DRU = "06045";

/** Whether the game is The Drúadan Forest: every hook below keys on it. */
export const live = (game: ScenarioState): boolean => game.scenarioId === SCENARIO;

const tableHolds = (game: ScenarioState, stat: "attackWithWillpower" | "attackDamageAsProgress" | "progressToVictory"): boolean => live(game) && game.modifiers.length > 0 && flagged(game, "table", stat);

/** Whether the characters attack with Willpower now (06044:B:2): the attack sheet, the readout and the log say Willpower. */
export const willpowerAttack = (game: ScenarioState): boolean => tableHolds(game, "attackWithWillpower");

/** Whether the damage of a character's attack is progress now (06044:B:2). */
export const progressAttack = (game: ScenarioState): boolean => tableHolds(game, "attackDamageAsProgress");

/** Whether archery damage can go to allies only now (06043:B:1): the table holds the flag and an ally is in play, so the archery tray lists allies and no hero. */
export function alliesArchery(game: ScenarioState, ctx: ReduceContext): boolean {
  if (!live(game) || game.modifiers.length === 0 || !flagged(game, "table", "archeryToAllies")) return false;
  const recipients = archeryRecipients(game, ctx.cards);
  return recipients.length > 0 && recipients.every((id) => isAllyLike(printedOf(ctx.cards, game.cards[id]?.code ?? "")));
}

const recordsOf = (ctx: ReduceContext, code: string): readonly Effect[] => effectsOf(ctx, code) as readonly Effect[];

/** The value X of the card's Prowl X, read from its own record (a Forced `GroupDiscardResources`), or 0 for a card without one. */
export function prowlValue(game: ScenarioState, ctx: ReduceContext, cardId: string): number {
  const card = game.cards[cardId];
  if (!card || !live(game)) return 0;
  for (const effect of recordsOf(ctx, card.code)) {
    for (const step of effect.instructions) if (step.verb === "GroupDiscardResources") return resolveAmount(game, step.amount, { actor: 0, sourceId: cardId }, ctx);
  }
  return 0;
}

/** Whether the card prints Archery X: a constant of its own that adds the heroes with no resources (`archeryBonus` on itself). */
export const printsArcheryX = (game: ScenarioState, ctx: ReduceContext, code: string): boolean =>
  live(game) && recordsOf(ctx, code).some((effect) => effect.timing === "constant" && effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "archeryBonus" && step.target === "self"));

/** The archery cards in play give a card beyond its print: the name of each source and its amount (Glade of Cleansing's 1 for each Wose). */
export function archeryGains(game: ScenarioState, ctx: ReduceContext, cardId: string, nameOf: (id: string) => string): { name: string; amount: number }[] {
  const card = game.cards[cardId];
  if (!card || !live(game)) return [];
  const printed = printedOf(ctx.cards, card.code);
  return game.modifiers
    .filter((modifier) => modifier.stat === "archery" && modifier.sourceId !== cardId && modifierActive(game, modifier) && heldBy(modifier, card, printed, (trait) => hasTrait(game, cardId, trait, ctx)))
    .map((modifier) => ({ name: nameOf(modifier.sourceId), amount: modifier.amount }));
}

/** The progress an enemy in play holds against its printed hit points, while stage 3 makes an attack's damage progress; null for any other card. */
export function enemyProgress(game: ScenarioState, ctx: ReduceContext, cardId: string): { progress: number; hits: number } | null {
  const card = game.cards[cardId];
  if (!card || !progressAttack(game) || (card.zone !== "staging" && card.zone !== "engaged")) return null;
  const printed = printedOf(ctx.cards, card.code);
  return printed.type === "enemy" && printed.health != null ? { progress: card.progress, hits: printed.health } : null;
}

const druOf = (game: ScenarioState): CardInstance | undefined => Object.values(game.cards).find((card) => card.code === DRU_BURI_DRU);

// Where Drû-buri-Drû stands for the win bar: in the victory display, destroyed (the discard pile or out of the game), or still to be put there.
const whereIsDru = (card: CardInstance | undefined): "victory" | "play" | "gone" => (card?.zone === "victory" ? "victory" : card?.zone === "encounterDiscard" || card?.zone === "removed" ? "gone" : "play");

/** The line stage 3 adds to its preview and to the screen that tells the advance to it: what wins, and where each half stands. Empty for another stage and another scenario. */
export function druadanStageLines(game: ScenarioState, ctx: ReduceContext, code: string, nameOf: (code: string) => string): string[] {
  if (!live(game) || code !== STAGE_THREE) return [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage || stage.code !== code) return [];
  const points = questPointsOf(game, stage, ctx.cards);
  return points == null ? [] : [winBarWords(stage.progress, points, whereIsDru(druOf(game)), nameOf(DRU_BURI_DRU))];
}

/** The dial of Drû-buri-Drû while stage 3 holds the flags: his progress against his hit points (a goal dial), and once he is in the victory display the stage's progress he is still needed for. Empty in any other scenario. */
export function druadanDials(game: ScenarioState, ctx: ReduceContext, nameOf: (code: string) => string): readonly TableDial[] {
  const dru = druOf(game);
  if (!dru || !progressAttack(game) || !tableHolds(game, "progressToVictory")) return [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  const points = stage ? (questPointsOf(game, stage, ctx.cards) ?? 0) : 0;
  const hits = printedOf(ctx.cards, dru.code).health ?? 0;
  const name = nameOf(DRU_BURI_DRU);
  if (dru.zone === "victory") {
    return [{ id: "dru", testID: "druadan-dru", label: "Drû", name: `${name} is in the victory display:`, value: hits, limit: hits, goal: true, word: `${stage?.progress ?? 0}/${points}`, cardId: dru.id, note: druDialDoneNote(name, stage?.progress ?? 0, points), limitWords: druDialLimit(name, hits) }];
  }
  if (dru.zone !== "staging" && dru.zone !== "engaged") return [];
  return [{ id: "dru", testID: "druadan-dru", label: "Drû", name: druDialName(name), value: Math.min(dru.progress, hits), limit: hits, filled: Math.min(dru.progress, hits), goal: true, cardId: dru.id, note: druDialNote(name, dru.progress, hits, points), limitWords: druDialLimit(name, hits) }];
}

/** What the dock says of an attack that places progress: before the strike the tokens it will place and the number they reach against the hit points; once it has struck (`placed`, the window before the attack ends) what the card holds. Null while the damage is damage. */
export function progressReadout(game: ScenarioState, ctx: ReduceContext, enemyId: string, strength: number, defense: number, name: string, placed: boolean): string | null {
  if (!progressAttack(game)) return null;
  if (placed) {
    const card = game.cards[enemyId];
    if (card?.zone === "victory") return progressFilledWords(name);
    const held = enemyProgress(game, ctx, enemyId);
    return held ? progressHeldWords(held.progress, held.hits, name) : null;
  }
  const held = enemyProgress(game, ctx, enemyId);
  if (!held) return null;
  const blocked = flagged(game, enemyId, "cannotTakeDamage") || flagged(game, enemyId, "combatDamageCanceled");
  return progressResultWords(blocked ? 0 : Math.max(0, strength - defense), name, held.progress, held.hits);
}
