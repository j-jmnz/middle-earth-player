// Rules: rr.guarded, rr.in-play-and-out-of-play (data/rules/entries.json); ledger lines 51004:B:1, 51004:B:2, 51013:A:1 (docs/brief.md, The Wizard's Quest, readings 9 and 3).
// What the table says of the player cards Carried Away and Necromancer's Pass hold faceup under them (src/play/readouts/standalone-scenarios/wizards-quest.ts). The engine decided who holds what; these only say it. Each sentence stays at about 25 words.

import { plural } from "../list.ts";

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
