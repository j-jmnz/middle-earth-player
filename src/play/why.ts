// Rules: rr.step-2-2, rr.resource-match, rr.unique-cards, rr.triggered-ability, rr.action-windows (data/rules/entries.json).
//
// Why a card in the hand does not glow, in one line for its preview: the engine's own refusal in the player's words, or that
// its heroes cannot pay for it yet. Read only when the player taps a card a moment does not ask about; nothing here decides
// what is legal (the reducer does).
import { attachmentTargets, playWindowReason } from "../rules/planning.ts";
import { printedOf } from "../rules/printed.ts";
import type { ReduceContext, ScenarioState } from "../rules/reduce.ts";

import { playRequest } from "./pay.ts";

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
  if (request) {
    const have = request.pools.reduce((sum, pool) => sum + pool.max, 0);
    if (have < request.total) {
      const whose = printed.sphere === "neutral" || printed.sphere == null ? "Your heroes have" : `Your ${sphere} heroes have`;
      return `It costs ${request.total}. ${whose} ${have} ${have === 1 ? "resource" : "resources"}.`;
    }
  }
  return null;
}
