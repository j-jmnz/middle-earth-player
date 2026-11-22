import type { Ask } from "../asks.ts";

// The choice words of The Mines of Moria (standalone-scenarios part 12), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-mines-of-moria --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-mines-of-moria` prints each sentence.
// The opposing team's choices (docs/scenarios/standalone-scenarios.md, The Mines of Moria, reading 3) are the engine's, so a sheet opens only for a tie its first player settles. The entries below word those sheets.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 51205:B:1 (Narrow Paths): the attachment of highest printed cost each player controls lies under the stage.
  "51205:whenRevealed:2 @0.0 Pick": { note: "Narrow Paths: choose the attachment you control that lies under this stage. Choose among those of the highest printed cost. It leaves play until this stage is defeated, and no copy of its title can be played.", verb: "Choose" },

  // 51214:A:1 (Shadow of Fear): attached to the hero with the highest Willpower.
  "51214:whenRevealed:1 @0 Pick": { note: "Shadow of Fear: choose the hero it attaches to, among those with the highest Willpower. That hero's text box is treated as blank, except for Traits.", verb: "Attach" },

  // 51223:A:1 (Denizen of the Deep): attached to the non-unique enemy with the highest Attack, which returns to the staging area.
  "51223:whenRevealed:1 @0 Pick": { note: "Denizen of the Deep: choose the non-unique enemy it attaches to, among those with the highest Attack. That enemy returns to the staging area and gets +1 Threat, +1 Attack and +1 Defense, and is immune to player card effects.", verb: "Attach" },
};
