// Rules: mec108.captured-deck, mec108.captured-cards, mec108.joining-another-player, mec108.setup-escape-from-mount-gram (data/rules/entries.json); ledger lines 10038:A:1, 10039:B:2, 10174:A:2.
//
// The pieces Escape from Mount Gram's cards hold on the table, as each seat's mark on its threat dial: the size of its captured deck (the cards the Goblins took, kept out of play), the area it joined when its stage 2B emptied, and, in the first round, the starting threat the quest card set
// to the starting hero's cost. The cards captured under a host are drawn under it and said in its preview (src/play/cards/gram-preview.ts). The engine decided every number (`Seat.captured`, `Seat.joined`, `threat`); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { ELIMINATION_LEVEL } from "../../rules/core/eliminate.ts";
import { heldAmount, livingSeats } from "../../rules/core/state.ts";
import { DIRE_ELIMINATION_LEVEL } from "../../rules/families/black-gate/dire.ts";
import { printedOf } from "../../rules/core/printed.ts";
import type { ReduceContext, ScenarioState } from "../../rules/engine/reduce.ts";
import { capturedByHost } from "../../rules/families/captured/pile.ts";

import { ownerWords } from "../words/owner.ts";
import { capturedDeckWords, capturedLabel, heldCapturedWords, joinedWords, startThreatWords, type ExecutionersRaise } from "../words/scenarios/gram-table.ts";
import type { HandMark } from "./isengard.ts";

export const LOOT = "10175";
export const EXECUTIONERS = "10053";
export const MOUNT_GRAM_STAGE_1 = "10038";

/** Whether the game holds a captured deck: only Escape from Mount Gram's Setup prepares one. The one cheap test every piece below starts with. */
export const hasCapturedDecks = (game: ScenarioState): boolean => game.capture != null;

/** The cards captured underneath a card, counted by owner in seat order: "2 of Player 1's, 1 of Player 2's" (the owners' words say "yours" in true solo). Empty when it holds none. */
export function capturedOwners(game: ScenarioState, cardId: string): { owner: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const id of capturedByHost(game).get(cardId) ?? []) {
    const owner = game.cards[id]?.owner;
    if (owner != null) counts.set(owner, (counts.get(owner) ?? 0) + 1);
  }
  return [...counts].sort((left, right) => left[0] - right[0]).map(([seat, count]) => ({ owner: ownerWords(game.seatCount, seat, true), count }));
}

/** The line a host's preview says of the cards captured under it, or null when it holds none. */
export function heldCapturedLine(game: ScenarioState, cardId: string): string | null {
  const owners = capturedOwners(game, cardId);
  return owners.length > 0 ? heldCapturedWords(owners) : null;
}

/** Each living seat's mark: its captured deck's size (with its owner in the note), the player whose area it joined, and in round 1 the starting threat. Empty in any other scenario. */
export function gramHands(game: ScenarioState, ctx: ReduceContext): readonly HandMark[] {
  if (!hasCapturedDecks(game)) return [];
  const two = game.seatCount > 1;
  return livingSeats(game).flatMap((seat) => {
    const state = game.seats[seat];
    if (!state || state.captured == null) return [];
    const count = state.captured.length;
    const joined = state.joined ?? null;
    // The starting hero the Setup recorded, not the first hero in play (a rescued hero can come first).
    const hero = state.startHero != null ? game.cards[state.startHero] : undefined;
    const threat = hero ? (printedOf(ctx.cards, hero.code).threat ?? null) : null;
    const notes = [capturedDeckWords(ownerWords(game.seatCount, seat), count)];
    if (joined != null) notes.push(joinedWords(ownerWords(game.seatCount, seat), ownerWords(game.seatCount, joined)));
    if (game.round <= 1 && threat != null && hero) notes.push(startThreatWords(threat, printedOf(ctx.cards, hero.code).name));
    return [{ seat, label: capturedLabel(two ? seat : null, count), note: notes.join(" ") }];
  });
}

/**
 * What Stop the Executioners' last time counter does to each player now (10053:A:3): each living player raises threat by 3 for each character of theirs (hero or ally) captured under it, and a seat the raise brings to the elimination level is out. Empty when no character lies under it.
 * `under` is every card captured under it, which the last counter discards.
 */
export function executionersRaises(game: ScenarioState, hostId: string, ctx: ReduceContext): { under: number; raises: ExecutionersRaise[] } {
  const held = capturedByHost(game).get(hostId) ?? [];
  const raises = livingSeats(game).flatMap((seat): ExecutionersRaise[] => {
    const characters = held.filter((id) => {
      const card = game.cards[id];
      if (!card || card.owner !== seat) return false;
      const type = printedOf(ctx.cards, card.code).type;
      return type === "hero" || type === "ally" || card.heroSlot != null;
    }).length;
    if (characters === 0) return [];
    const raise = characters * 3;
    const level = (game.dire ? DIRE_ELIMINATION_LEVEL : ELIMINATION_LEVEL) - Math.max(0, heldAmount(game, `seat:${seat}`, "eliminationReduction"));
    const name = ownerWords(game.seatCount, seat);
    return [{ owner: name, name: game.seatCount > 1 ? `Player ${seat + 1}` : "you", characters, raise, out: (game.seats[seat]?.threat ?? 0) + raise >= level }];
  });
  return { under: held.length, raises };
}
