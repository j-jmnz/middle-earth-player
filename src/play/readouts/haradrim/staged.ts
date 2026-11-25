// Rules: hrd.heroes-in-the-staging-area, hrd.guarded-heroes, hrd.objective-hero-elimination, rr.blank, rr.immune (data/rules/entries.json); ledger lines 16071:A:1, 16071:B:3, 16072:B:3, 16073:A:1, 16073:B:2, 16031:A:2 (docs/scenarios/haradrim/the-long-arm-of-mordor.md, Table).
// The pieces The Long Arm of Mordor's records create: the heroes in the staging area (a Captive that no card holds, drawn in the staging area), the heroes an Orc guards (a Captive under it with the guarded flag, drawn under it as every held card is) and the objective-heroes
// (a hero whose own record eliminates its seat when it leaves play). Each is read from the state's own facts, never the scenario id; the engine decided every one and nothing here changes one. Pure, so a test reads it.
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { inPlay, flagged, type CardInstance, type ScenarioState } from "../../../rules/core/state.ts";
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import { captivesOf, captivesUnder } from "../../../rules/families/captives/values.ts";
import { effectsOf } from "../../../rules/windows/listen.ts";

import { ownerWords } from "../../words/owner.ts";
import { guardedWords, guardsWords, objectiveWords, stageXWords, stagedDialWords, stagedReturnWords, stagedWords } from "../../words/scenarios/haradrim/staged-table.ts";

/** The heroes in the staging area: the Captives no card holds, in card order (none unless a record moved a hero there). */
export const stagedHeroes = (game: ScenarioState): readonly CardInstance[] => captivesOf(game).filter((card) => card.host == null);

/** Their ids, for the staging area's list (the prisoner of Escape from Dol Guldur is no Captive). */
export const stagedHeroIds = (game: ScenarioState): readonly string[] => stagedHeroes(game).map((card) => card.id);

// A Captive an Orc guards: the guarded flag marks it, so a Captive of The Uruk-hai (no flag) is none.
const isGuarded = (card: CardInstance): boolean => card.captive === true && card.zone === "captive" && card.guardedHero === true && card.host != null;

/** The heroes an Orc guards that lie under the card, in card order (empty for any other card): its preview lists them after it, as it lists its attachments. */
export const guardedUnder = (game: ScenarioState, hostId: string): readonly string[] => captivesUnder(game, hostId).filter((id) => {
  const held = game.cards[id];
  return held != null && isGuarded(held);
});

/** The role of a hero an Orc guards in a preview (it is no attachment), or null. */
export const guardedRole = (game: ScenarioState, cardId: string): string | null => {
  const card = game.cards[cardId];
  return card != null && isGuarded(card) ? "Guarded hero" : null;
};

const capital = (text: string): string => text.replace(/^./, (first) => first.toUpperCase());

/** The preview line of a hero in the staging area, a hero an Orc guards, or the Orc that guards one; null for any other card. */
export function stagedDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card) return null;
  const owner = card.owner != null ? capital(ownerWords(game.seatCount, card.owner)) : "A";
  if (card.captive === true && card.zone === "captive" && card.host == null) {
    return `${stagedWords(owner, flagged(game, cardId, "blankText"), flagged(game, cardId, "immuneToPlayerCards"))} ${stagedReturnWords(card.owner != null && game.seatCount > 1 ? `Player ${card.owner + 1}` : "its owner")}`;
  }
  if (isGuarded(card)) return guardedWords(owner, name(card.host ?? ""));
  const first = guardedUnder(game, cardId).map((id) => game.cards[id])[0];
  if (!first) return null;
  return guardsWords(name(first.id), first.owner != null ? ownerWords(game.seatCount, first.owner) : "a player's", name(cardId));
}

/** The preview line of an objective-hero in play: what its own record says happens when it leaves play (EliminatePlayer on leftPlay of itself); null for any other card. */
export function objectiveDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || card.zone !== "heroes") return null;
  const eliminates = effectsOf(ctx, card.code).some((effect) => effect.trigger === "leftPlay" && effect.subject === "self" && effect.instructions.some((instruction) => instruction.verb === "EliminatePlayer"));
  return eliminates ? objectiveWords(game.seatCount, card.controller) : null;
}

/** The sentence a seat's dial says of a hero held in the staging area or under an Orc ("Legolas is in the staging area"), or null for any other Captive. */
export function stagedDial(game: ScenarioState, card: CardInstance, nameOf: (code: string) => string): string | null {
  if (card.captive !== true) return null;
  if (card.host == null) return stagedDialWords(nameOf(card.code), null);
  const host = game.cards[card.host];
  return card.guardedHero === true && host ? stagedDialWords(nameOf(card.code), nameOf(host.code)) : null;
}

const X_STATS = ["threat", "attack", "defense"] as const;
const STAT_NAME = { threat: "Threat", attack: "Attack", defense: "Defense" } as const;

/**
 * The preview line of a card in play whose Threat, Attack or Defense is X and whose constant record says X is the stage number (ModifyStat of the main quest's stage number on itself): the number each is now.
 * The card prints "X", so no badge says the value (a badge is a change to a printed number). Null for any other card.
 */
export function stageXDetail(game: ScenarioState, ctx: ReduceContext, cardId: string): string | null {
  const card = game.cards[cardId];
  if (!card || !inPlay(card.zone) || card.face === "down") return null;
  const printed = printedOf(ctx.cards, card.code);
  const read = new Set<(typeof X_STATS)[number]>();
  for (const effect of effectsOf(ctx, card.code)) {
    if (effect.timing !== "constant") continue;
    for (const instruction of effect.instructions) {
      if (instruction.verb === "ModifyStat" && instruction.target === "self" && instruction.amount != null && typeof instruction.amount === "object" && "stage" in instruction.amount && instruction.amount.stage === true) {
        const stat = X_STATS.find((one) => one === instruction.stat);
        if (stat && printed[stat] == null) read.add(stat);
      }
    }
  }
  if (read.size === 0) return null;
  const stage = game.questStage ? game.cards[game.questStage] : undefined;
  return stageXWords([...read].map((stat) => ({ name: STAT_NAME[stat], value: modifiedStat(game, card, stat, ctx.cards) })), stage != null);
}
