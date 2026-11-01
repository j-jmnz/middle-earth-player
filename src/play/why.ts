// Rules: rr.step-2-2, rr.resource-match, rr.unique-cards, rr.triggered-ability, rr.action-windows (data/rules/entries.json).
//
// Why a card in the hand does not glow, in one line for its preview: the engine's own refusal in the player's words, or that
// its heroes cannot pay for it yet. Read only when the player taps a card a moment does not ask about; nothing here decides
// what is legal (the reducer does).
import { attachmentTargets, playWindowReason } from "../rules/planning.ts";
import { exhaustSlack } from "../rules/families/costs-play.ts";
import { payingSlack } from "../rules/families/deck-play.ts";
import { printedOf } from "../rules/printed.ts";
import { reduce, type ReduceContext, type ScenarioState } from "../rules/reduce.ts";

import { playRequest } from "./pay.ts";
import type { Sheet } from "./sheet-types.ts";

const SPHERE_WORD: Readonly<Record<string, string>> = { leadership: "Leadership", tactics: "Tactics", spirit: "Spirit", lore: "Lore", fellowship: "Fellowship", baggins: "Baggins", neutral: "Neutral" };

/** Why the hand card cannot be played now, or null when it can (or is not in the hand). */
export function whyNotPlayable(game: ScenarioState, ctx: ReduceContext, cardId: string, cardName: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (!card || (card.zone !== "hand" && card.zone !== "deck")) return null;
  const printed = printedOf(ctx.cards, card.code);
  const sphere = printed.sphere ? (SPHERE_WORD[printed.sphere] ?? printed.sphere) : "";
  if (game.lost || game.stageCleared) return null;
  if (card.controller !== game.activeSeat && game.window != null) return "It is another player's turn to act.";
  const refused = playWindowReason(game, cardId, ctx);
  if (refused) {
    // "You must use resources from 3 different heroes' pools" (01036:A:1): the engine counts the pools that can pay.
    const fewest = /^Pay from at least (\d+) different heroes$/.exec(refused);
    if (fewest) {
      const pools = playRequest(game, ctx, cardId)?.pools.filter((pool) => pool.max > 0).length ?? 0;
      return `It is paid from ${fewest[1]} different heroes. ${pools} of yours can pay.`;
    }
    switch (refused) {
      case "That intent is not legal in this window":
        if (printed.type === "ally" || printed.type === "attachment") return `${printed.type === "ally" ? "Allies" : "Attachments"} are played in the planning phase.`;
        return game.window ? "Nothing can be played at this point." : "Nothing can be played right now.";
      case "Only the active player plays allies and attachments now":
        return "Allies and attachments are played in your own planning turn.";
      case "A second copy of that unique card cannot enter play":
        return `${cardName(cardId)} is unique and a copy is already in play.`;
      case "No hero matches that card's sphere":
        return `No ${sphere} hero is in play to pay for it.`;
      case "That card cannot be played":
        return printed.type === "event" ? "It is played as a Response, when its moment comes." : "It cannot be played.";
      case "That card is not in hand":
        return "It is not in your hand.";
      case "That card cannot be played now":
        return "Its condition does not hold now.";
      case "That card has no legal target":
        return "It has no legal target now.";
      default:
        return `${refused}.`;
    }
  }
  if (printed.type === "attachment" && attachmentTargets(game, card.code, ctx).length === 0) return "No card can take it now.";
  const request = playRequest(game, ctx, cardId);
  return request ? shortWords(request.total, request.pools.reduce((sum, pool) => sum + pool.max, 0), playSlack(game, ctx, cardId), printed.sphere) : null;
}

// "It costs 3. Your Spirit heroes have 1 resource." when the pools that can pay, with what lowers the cost as it is paid (`slack`:
// characters exhausted for ExhaustToReduce, a card that pays for it), hold less than the cost, else null.
function shortWords(total: number, have: number, slack: number, sphere: string | null | undefined): string | null {
  if (have + slack >= total) return null;
  const whose = sphere === "neutral" || sphere == null ? "Your heroes have" : `Your ${SPHERE_WORD[sphere] ?? sphere} heroes have`;
  return `It costs ${total}. ${whose} ${have} ${have === 1 ? "resource" : "resources"}.`;
}

// What lowers a played card's cost as it is paid (pay.ts leaves the sheet inexact for it), so a card it covers is payable.
function playSlack(game: ScenarioState, ctx: ReduceContext, cardId: string): number {
  return exhaustSlack(game, game.activeSeat, cardId, ctx) + payingSlack(game, game.activeSeat, cardId, ctx);
}

/**
 * Why a sheet the player is about to open asks for a payment the pools cannot make, or null. A payment sheet for playing a card or
 * using an Action or Response whose pools (with what lowers the cost as it is paid) hold less than its cost is refused, and so is
 * an attachment's host pick when no host can be paid for: the table plays the reject haptic and shows these words instead of
 * opening a sheet that cannot be met (rr.cost: a cost must be paid in full).
 */
export function cannotPay(game: ScenarioState, ctx: ReduceContext, sheet: Sheet): string | null {
  if (sheet.kind === "pick") {
    const nexts = sheet.options.flatMap((item) => ("next" in item && item.next ? [item.next] : []));
    if (nexts.length === 0 || nexts.length < sheet.options.length) return null;
    const reasons = nexts.map((next) => cannotPay(game, ctx, next));
    return reasons.every((reason) => reason != null) ? (reasons[0] ?? null) : null;
  }
  if (sheet.kind !== "distribute" || sheet.purpose.kind === "archery") return null;
  const cardId = sheet.purpose.cardId;
  const card = game.cards[cardId];
  if (!card) return null;
  const have = sheet.options.reduce((sum, item) => sum + (item.max ?? 0), 0);
  const slack = sheet.purpose.kind === "play" ? playSlack(game, ctx, cardId) : 0;
  return shortWords(sheet.total, have, slack, printedOf(ctx.cards, card.code).sphere);
}

/**
 * Why a character the open pick veils cannot be chosen, in the engine's own refusal (dcce.ship-enemies, dcce.ship-objectives): only a ship defends against a ship-enemy's attack, a ship attacks
 * only a ship-enemy. Null when the card is one of the pick's options, is not a character of the acting seat, or the engine would take it, and in every game outside the sea family
 * (`sea` absent), where a veiled card says nothing. The table adds no words of its own.
 */
export function whyNotChosen(game: ScenarioState, ctx: ReduceContext, cardId: string, sheet: Sheet | null): string | null {
  const card = game.cards[cardId];
  if (!card || !sheet || game.sea == null || card.controller !== game.activeSeat || game.lost || game.stageCleared) return null;
  if (sheet.kind !== "pick" && sheet.kind !== "multi") return null;
  if (sheet.options.some((item) => item.id === cardId)) return null;
  const type = printedOf(ctx.cards, card.code).type;
  if (type !== "hero" && type !== "ally" && type !== "objective") return null;
  const attempt =
    sheet.kind === "multi" && sheet.build.kind === "attack"
      ? ({ type: "DeclareAttackers", enemyId: sheet.build.enemyId, attackerIds: [cardId] } as const)
      : sheet.kind === "pick" && game.window?.kind === "defense"
        ? ({ type: "DeclareDefender", defenderId: cardId } as const)
        : null;
  if (!attempt) return null;
  const refused = reduce(game, attempt, ctx);
  return refused.ok ? null : `${refused.reason}.`;
}
