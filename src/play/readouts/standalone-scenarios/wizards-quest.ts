// Rules: rr.guarded, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51004:B:1, 51004:B:2, 51013:A:1 (docs/brief.md, The Wizard's Quest, readings 9 and 3; docs/design-system-table.md, Top bar).
// The player cards a card of The Wizard's Quest holds faceup under it (an ally under Carried Away, a card of a hand under Necromancer's Pass): the host's pill counts them and names each owner, and the held card's preview says where it lies.
import type { ReduceContext } from "../../../rules/engine/reduce.ts";
import { printedOf } from "../../../rules/core/printed.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { ownerWords } from "../../words/owner.ts";
import { keptCardWords, keptPill, type KeptCard } from "../../words/scenarios/wizards-quest-table.ts";

/** The held cards lying under a card, in the order they were laid there. */
export function keptUnder(game: ScenarioState, cardId: string): string[] {
  if (game.heldCards !== true) return [];
  return Object.values(game.cards).filter((card) => card.zone === "under" && card.host === cardId && card.heldTitle === true).map((card) => card.id);
}

/** The pill of a card that holds player cards ("2 held"), or null when it holds none (a game with no held card reads one flag and leaves). */
export function keptMark(game: ScenarioState, ctx: ReduceContext, cardId: string): { text: string; loses: boolean; speech: string; count: number } | null {
  const ids = keptUnder(game, cardId);
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
  return keptCardWords(name(card.host), ownerWords(game.seatCount, card.owner ?? card.controller));
}
