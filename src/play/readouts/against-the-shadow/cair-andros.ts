// Rules: ats.cair-andros-location-damage, ats.cair-andros-remove-stage, ats.cair-andros-defense-carry-over, hon.battle, hon.siege, hon.archery, rr.cannot (data/rules/entries.json); ledger lines 05033:A:1, 05034:A:1, 05035:A:1, 05033:A:2, 05034:A:2, 05035:A:2, 05072:B:2, 05073:B:1, 05075:B:2, 05076:B:3, 05057:A:2, 05058:A:1.
//
// The pieces The Siege of Cair Andros' cards hold on the table: the damage on each Battleground location against the number that removes it from the game (a top-bar dial and the card's preview), the lines of the current stage (where undefended damage goes, the extra Threat and reveal, the
// victory points toward Battle), the stages the Responses removed from the quest deck, a hero whose resources cannot be spent and the number Orc Arbalesters' Archery X counts now. The engine decided every number; nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import type { Effect } from "../../../catalog/boundary.ts";
import { victoryPointsOf } from "../../../rules/core/printed-stat.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { heldAmount, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { battlegroundsInPlay, undefendedBattlegrounds } from "../../../rules/families/pelargir/siege.ts";
import { stagePlace } from "../../../rules/families/quest/branch.ts";
import { questPointsOf } from "../../../rules/quest/quest.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { battleTurnWords, removesWords, battlegroundDialWords, battlegroundNearWords, extraRevealWords, removedStagesWords, stagingThreatWords, undefendedSheetWords, undefendedWords } from "../../words/scenarios/against-the-shadow/cair-andros.ts";
import type { TableDial } from "../dials.ts";

/** The number of damage that removes this card from the game (`removedAtDamage`), or 0 for a card without it. */
export const removalLimit = (game: ScenarioState, id: string): number => (game.modifiers.length > 0 ? heldAmount(game, id, "removedAtDamage") : 0);

/** The five stages of The Siege of Cair Andros (05072 to 05076). */
const STAGE_CODES: ReadonlySet<string> = new Set(["05072", "05073", "05074", "05075", "05076"]);

const printedName = (ctx: ReduceContext, card: CardInstance): string => printedOf(ctx.cards, card.code).name;

/** The Battleground locations in play that hold a removal limit, in the order the table keeps them. */
function limited(game: ScenarioState, ctx: ReduceContext): readonly CardInstance[] {
  return battlegroundsInPlay(game, ctx.cards).flatMap((id) => {
    const card = game.cards[id];
    return card && removalLimit(game, id) > 0 ? [card] : [];
  });
}

/** The dials of the Battleground locations that hold damage: its tokens against the limit (the disc reads "2/11" with the damage icon, and a tap shows the card), warming one short of it (the next damage removes the location). A location with no damage has none; its preview says the limit. */
export function cairAndrosDials(game: ScenarioState, ctx: ReduceContext): readonly TableDial[] {
  return limited(game, ctx)
    .filter((card) => card.damage > 0)
    .map((card) => {
      const limit = removalLimit(game, card.id);
      const name = printedName(ctx, card);
      const short = name.replace(/^The /, "");
      return {
        id: `battleground-${card.code}`,
        testID: `cair-${card.code}`,
        label: short,
        name: `Damage on ${name}, ${card.id === game.activeLocation ? "the active location" : "in the staging area"}, ${limit} removes it from the game:`,
        value: card.damage,
        // The disc says the damage with its limit ("2/11") and the damage token under it; a tap shows the location's card, whose preview says what removes it.
        word: `${card.damage}/${limit}`,
        icon: "damage" as const,
        cardId: card.id,
        limit,
        warms: true,
        ...(card.damage >= limit - 1 ? { warn: { level: "near" as const, words: battlegroundNearWords(name, card.damage, limit) } } : {}),
        limitWords: battlegroundDialWords(name, limit),
      };
    });
}

/** The quest cards the Responses took out of the quest deck, by stage number. A removed stage lies set aside with less progress than its quest points, which a defeated stage never has (stage 1 is never removed, so one that advanced at once for want of a Battleground location is no removed stage). */
export function removedStageNumbers(game: ScenarioState, ctx: ReduceContext): readonly number[] {
  const codes = new Set(ctx.effects.flatMap((effect) => effect.instructions.flatMap((step) => (step.verb === "RemoveStage" ? [step.code] : []))));
  if (codes.size === 0) return [];
  return game.setAside
    .flatMap((id) => {
      const card = game.cards[id];
      const points = card ? questPointsOf(game, card, ctx.cards) : null;
      return card && codes.has(card.code) && points != null && card.progress < points ? [stagePlace(game, card.code)?.at ?? 0] : [];
    })
    .filter((at) => at > 0)
    .sort((a, b) => a - b);
}

/** The amount of the ModifyStat constant a stage's record sets on the table (`moreStagingThreat`, `revealMore`), or 0. */
function tableConstant(ctx: ReduceContext, code: string, stat: string): number {
  for (const effect of effectsOf(ctx, code) as readonly Effect[]) {
    if (effect.timing !== "constant") continue;
    for (const step of effect.instructions) if (step.verb === "ModifyStat" && step.stat === stat && step.target === "table" && typeof step.amount === "number") return step.amount;
  }
  return 0;
}

/** The victory points the players hold and the number that turns Siege into Battle, from the stage's own record (`losesSiege`, the condition `victoryPoints`), or null for another stage. */
function battleTurn(game: ScenarioState, ctx: ReduceContext, code: string): { points: number; needed: number } | null {
  for (const effect of effectsOf(ctx, code) as readonly Effect[]) {
    const condition = effect.condition;
    if (effect.timing !== "constant" || condition?.kind !== "victoryPoints" || !effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "losesSiege")) continue;
    return { points: game.victory.reduce((sum, id) => sum + victoryPointsOf(game, id, ctx.cards), 0), needed: condition.min };
  }
  return null;
}

/**
 * The lines the current stage adds to its preview and to the screen that tells the advance to it, after its quest points: where undefended damage goes (stage 1B), the extra reveal (2B) and Threat (4B), the victory points toward Battle (5B), and the stages
 * removed from the quest deck. Empty for a stage that is not current and for any other scenario.
 */
export function cairAndrosStageLines(game: ScenarioState, ctx: ReduceContext, code: string): string[] {
  // The stat names `revealMore` and `moreStagingThreat` are other scenarios' too (Fire in the Night, Journey Along the Anduin, Helm's Deep): only this scenario's stages are worded here.
  if (!STAGE_CODES.has(code)) return [];
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  if (!stage || stage.code !== code) return [];
  const lines: string[] = [];
  if (effectsOf(ctx, code).some((effect) => effect.instructions.some((step) => step.verb === "ModifyStat" && step.stat === "undefendedToBattleground"))) {
    lines.push(undefendedWords(undefendedBattlegrounds(game, ctx.cards).map((id) => printedName(ctx, game.cards[id]!))));
  }
  const reveal = tableConstant(ctx, code, "revealMore");
  if (reveal > 0) lines.push(extraRevealWords(reveal));
  const threat = tableConstant(ctx, code, "moreStagingThreat");
  if (threat > 0) lines.push(stagingThreatWords(threat));
  const turn = battleTurn(game, ctx, code);
  if (turn) lines.push(battleTurnWords(turn.points, turn.needed));
  const removed = removedStageNumbers(game, ctx);
  if (removed.length > 0) lines.push(removedStagesWords(removed));
  return lines;
}

/**
 * What an enemy's attack sheet says while stage 1B sends the damage of an undefended attack to a Battleground location: which location takes it and how much damage it holds against its limit, and whether this attack alone removes it from the game. Null when the damage goes to a hero.
 */
export function undefendedRedirectWords(game: ScenarioState, ctx: ReduceContext, attack: number): string | null {
  const targets = undefendedBattlegrounds(game, ctx.cards).flatMap((id) => (game.cards[id] ? [game.cards[id]] : []));
  const first = targets[0];
  if (!first) return null;
  const name = printedName(ctx, first);
  if (targets.length > 1) return `Undefended: ${targets.map((card) => printedName(ctx, card)).join(" or ")} takes all of it, the one you choose, and no hero does.`;
  return undefendedSheetWords(name, first.damage, removalLimit(game, first.id), attack);
}

/** "; it is removed from the game" when the damage of an undefended attack alone reaches the removal limit of the Battleground location it lands on, else "". */
export function undefendedRemoves(game: ScenarioState, id: string, strength: number): string {
  const card = game.cards[id];
  const limit = removalLimit(game, id);
  return card && limit > 0 && card.damage + strength >= limit ? removesWords() : "";
}
