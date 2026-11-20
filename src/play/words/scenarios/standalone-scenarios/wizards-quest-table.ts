// Rules: rr.guarded, rr.in-play-and-out-of-play, rr.reveal (data/rules/entries.json); ledger lines 51004:B:1, 51004:B:2, 51013:A:1, 51241:A:1 (docs/brief.md, The Wizard's Quest, readings 9 and 3; The Mines of Moria, readings 10 and 11).
// What the table says of the player cards Carried Away, Necromancer's Pass and Narrow Paths hold faceup under them, and of the cards Hidden Threat lays facedown under the main quest (src/play/readouts/standalone-scenarios/wizards-quest.ts). The engine decided who holds what; these only say it. Each sentence stays at about 25 words.

import { plural } from "../../list.ts";

/** One held card: its title and whose it is in words ("Player 2's", "your"). */
export type KeptCard = { name: string; owner: string };

/** The pill on a card that holds player cards: "2 held", spoken with each card and its owner. */
export const keptPill = (kept: readonly KeptCard[]): { text: string; loses: boolean; speech: string; count: number } => ({
  text: `${kept.length} held`,
  count: kept.length,
  loses: false,
  speech: `${plural(kept.length, "card", "cards")} held underneath: ${kept.map((card) => `${card.name}, ${card.owner} card`).join(" and ")}`,
});

/** The line under a held card itself, in its preview: where it lies, whose it is, what is barred and when it returns. */
export const keptCardWords = (host: string, owner: string | null): string => `Held faceup under ${host}, out of play${owner ? `, ${owner} card` : ""}. No copy of it can be played. It returns to its owner's hand when ${host} leaves play.`;

/** The pill on the main quest that holds facedown cards (Hidden Threat): "1 hidden". The cards stay unnamed: they are facedown. */
export const hiddenPill = (count: number): { text: string; loses: boolean; speech: string; count: number } => ({
  text: `${count} hidden`,
  count,
  loses: false,
  speech: `${plural(count, "card", "cards")} hidden facedown underneath, revealed after the next successful quest`,
});
