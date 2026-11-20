import type { Ask } from "../asks.ts";

// The choice words of Escape from Khazad-dûm (standalone-scenarios part 13), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario escape-from-khazad-dum --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=escape-from-khazad-dum` prints each sentence.
// The opposing team's choices (docs/brief.md, Escape from Khazad-dûm, reading 3) are the engine's, so a sheet opens only for a choice a player makes or a tie the first player settles. The entries below word those sheets.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 51304:B:1 (A Wrong Turn): each player keeps one card of his hand and shuffles the rest into his deck (reading 9).
  "51304:whenRevealed:2 @0.0 Pick": { note: "A Wrong Turn: choose the card of your hand you keep. You shuffle the rest of your hand into your deck.", verb: "Keep", owned: true },

  // 51317:A:1 (Watchful Eyes): attached to the hero with the highest Willpower that has no Watchful Eyes.
  "51317:whenRevealed:1 @0 Pick": { note: "Watchful Eyes: choose the hero it attaches to, among those with the highest Willpower and no Watchful Eyes. At the end of the combat phase, if that hero is exhausted, you reveal 1 encounter card.", verb: "Attach" },

  // 51331:A:2 (Lightless Grotto): the first player chooses an enemy in the staging area and engages it.
  "51331:travel:1 @0 Pick": { note: "Lightless Grotto: choose the enemy in the staging area the first player engages.", verb: "Engage" },

  // 51340:A:1 (Goblin Dungeon): the ally of the highest printed cost lies under it.
  "51340:whenRevealed:1 @0 Pick": { note: "Goblin Dungeon: choose the ally that lies under it, among those of the highest printed cost. Its tokens are discarded, and it returns to its owner, exhausted, when Goblin Dungeon leaves play.", verb: "Choose" },

  // 51347:A:1 (Vast and Intricate): attached to the non-unique location in the staging area with the highest Threat.
  "51347:whenRevealed:1 @0 Pick": { note: "Vast and Intricate: choose the non-unique location in the staging area it attaches to, among those with the highest Threat. That location gets +2 Threat and is immune to player card effects.", verb: "Attach" },
};
