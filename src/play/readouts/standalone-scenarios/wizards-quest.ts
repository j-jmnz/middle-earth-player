// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.reveal (data/rules/entries.json); ledger lines 51004:B:1, 51004:B:2, 51013:A:1, 51205:B:1, 51241:A:1 (docs/brief.md, The Wizard's Quest, readings 9 and 3; The Mines of Moria, readings 10 and 11; docs/design-system-table.md, Top bar).
// The player cards a quest card holds faceup under it (an ally under Carried Away, a card of a hand under Necromancer's Pass, an attachment under Narrow Paths) and the cards Hidden Threat lays facedown under the main quest: the host's pill counts them and names each owner, and the held card's preview says where it lies.
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { CardInstance, ScenarioState } from "../../../rules/core/state.ts";
import { ownerWords } from "../../words/owner.ts";
import { hiddenPill, keptCardWords, keptPill, type KeptCard } from "../../words/scenarios/standalone-scenarios/wizards-quest-table.ts";

/** A player card held faceup under a card: by its title (Carried Away's ally, Narrow Paths' attachment) or until it is discarded when the host leaves play (Nameless Thing's, 51351:A:1). */
export const isHeldFaceup = (card: CardInstance): boolean => card.heldTitle === true || card.heldDiscard === true;

/** The cards lying under a card that `isHeld` accepts, in the order they were laid there. */
function keptUnder(game: ScenarioState, cardId: string, isHeld: (card: CardInstance) => boolean): string[] {
  return Object.values(game.cards).filter((card) => card.zone === "under" && card.host === cardId && isHeld(card)).map((card) => card.id);
}

/** The pill of a card that holds player cards ("2 held"), or null when it holds none. */
export function keptMark(game: ScenarioState, ctx: ReduceContext, cardId: string, isHeld: (card: CardInstance) => boolean): { text: string; loses: boolean; speech: string; count: number } | null {
  const ids = keptUnder(game, cardId, isHeld);
  if (ids.length === 0) return null;
  const kept: KeptCard[] = ids.map((id) => {
    const card = game.cards[id];
    return { name: printedOf(ctx.cards, card?.code ?? "").name, owner: ownerWords(game.seatCount, card?.owner ?? card?.controller) ?? "an unknown player's" };
  });
  return keptPill(kept);
}

/** The line in the preview of a held card: where it lies, whose it is, and when it returns; null for any other card. */
export function keptDetail(game: ScenarioState, cardId: string, name: (id: string) => string): string | null {
  const card = game.cards[cardId];
  if (game.heldCards !== true || card?.zone !== "under" || card.heldTitle !== true || card.host == null) return null;
  return keptCardWords(name(card.host), ownerWords(game.seatCount, card.owner ?? card.controller), card.heldExhausted === true);
}

/** The pill of the main quest that holds the cards Hidden Threat laid facedown under it ("2 hidden"), or null when it holds none. */
export function hiddenMark(game: ScenarioState, cardId: string): { text: string; loses: boolean; speech: string; count: number } | null {
  const count = Object.values(game.cards).filter((card) => card.zone === "under" && card.host === cardId && card.hiddenAt != null).length;
  return count > 0 ? hiddenPill(count) : null;
}
