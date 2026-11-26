// Rules: rm.out-of-play-deck, rr.in-play-and-out-of-play, rr.cannot (data/rules/entries.json); ledger lines 07062:A:1, 07029:A:1, 07027:A:2, 07028:A:1, 07024:A:2.
// To Catch an Orc's out-of-play decks as one top-bar dial: the cards left in each seat's deck, never which cards. A deck warms when it runs low while Mugash is still hidden in one of them. The engine decided every number (`outOfPlayZone`, the pile); nothing here changes one. Empty in any other scenario. Pure, so a test reads it.
import { pileOf } from "../../../rules/core/piles.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { hasOutOfPlayDecks, outOfPlayZone } from "../../../rules/families/ring-maker/outofplay.ts";

import { outOfPlayLine, outOfPlayLowWords, outOfPlayNote } from "../../words/scenarios/ring-maker/orc-table.ts";
import type { TableDial } from "../dials.ts";

/** Mugash's code. */
export const MUGASH = "07024";
/** Mugash the objective of Into Fangorn (07031): lying on Edge of Fangorn, then on a hero. */
export const MUGASH_OBJECTIVE = "07031";
/** Mugash's Guard's code. */
export const GUARD = "07025";
// A deck with this many cards or fewer warms while Mugash is not found.
const LOW = 5;

/** Whether Mugash still lies in an out-of-play deck: nothing on the table shows him yet. */
export const mugashHidden = (game: ScenarioState): boolean => Object.values(game.cards).some((card) => card.code === MUGASH && (card.zone === "outOfPlay0" || card.zone === "outOfPlay1"));

/**
 * The out-of-play decks as one dial: alone, the count of the player's deck; two-handed, the cards of both decks together, with a panel that names each player's deck (two dials would crowd the bar beside both threat dials and the Time dial).
 * It warms while Mugash is hidden and a deck is low; the words name whose.
 */
export function orcDials(game: ScenarioState): readonly TableDial[] {
  if (!hasOutOfPlayDecks(game)) return [];
  const hidden = mugashHidden(game);
  const counts = Array.from({ length: game.seatCount }, (_, seat) => pileOf(game, outOfPlayZone(seat)).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const lowest = counts.findIndex((count) => count <= LOW);
  const owner = (seat: number): string | null => (game.seatCount > 1 ? `Player ${seat + 1}` : null);
  const note = outOfPlayNote(counts, !hidden);
  const warn = hidden && lowest >= 0 ? { level: "near" as const, words: outOfPlayLowWords(counts[lowest] ?? 0, owner(lowest)) } : null;
  // A tap opens the same panel alone and two-handed: a list of each deck's count, with the warning and the note at its foot. A noun title names the panel, as the Sack and Underworld dials do.
  const lines = counts.map((count, seat) => outOfPlayLine(count, owner(seat) ?? "Your deck"));
  return [
    {
      id: "out-of-play",
      testID: "ring-maker-out-of-play",
      label: "Out of play",
      short: "Aside",
      name: game.seatCount > 1 ? "Out-of-play decks" : "Out-of-play deck",
      value: total,
      ...(warn ? { warn } : {}),
      note,
      lists: [{ heading: "Cards left", lines }],
      said: note,
      foot: warn ? `${warn.words} ${note}` : note,
    },
  ];
}

/** The ids of Mugash (the enemy of To Catch an Orc, the objective of Into Fangorn) lying on this card: the hero he is attached to, or Edge of Fangorn. Empty for any other card and in every other game. The card's pill names him. */
export function mugashLyingOn(game: ScenarioState, hostId: string): readonly string[] {
  const host = game.cards[hostId];
  return host == null || host.attachments.length === 0 ? [] : host.attachments.filter((id) => game.cards[id]?.code === MUGASH || game.cards[id]?.code === MUGASH_OBJECTIVE);
}
