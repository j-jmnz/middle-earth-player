import type { Ask } from "../asks.ts";

// The choice words of The Siege of Annúminas (standalone-scenarios part 8), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-siege-of-annuminas --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-siege-of-annuminas` prints each sentence.
// A When Revealed, Shadow or Forced choice a player makes for himself is owned. The options of a Choose carry the card's own words in their rows (an option row reads as the card's sentence, not the engine's chain).
export const ASKS: Readonly<Record<string, Ask>> = {
  // 50803:A:1 (Rebuild the Defenses): each player searches the encounter deck for a different location; one must be the Gate of Annúminas.
  "50803:setup:1 @0.0 SearchMove": { owned: true, note: "Search the encounter deck for a location to add to the staging area. A different location for each player, and one of them must be the Gate of Annúminas.", verb: "Search" },

  // 50804:B:2 (Defend the City): the highest Attack enemy in the staging area attacks each player in turn; a tie is the first player's choice.
  "50804:forced:1 @0 Pick": { owned: true, note: "Choose which enemy in the staging area attacks each player in turn: the ones tied for the highest Attack.", verb: "Choose" },
  // 50804:B:3: each player heals 1 damage from a character he controls.
  "50804:response:1 @0.0 Pick": { owned: true, note: "Choose a damaged character you control. It heals 1 damage.", verb: "Heal" },

  // 50818:A:2 (Dúnedain of Annúminas): any player may spend 1 resource to take control of it.
  "50818:whenRevealed:1 @0.control.0 Pick": { note: "Choose the player who spends 1 resource to take control of Dúnedain of Annúminas.", verb: "Choose" },
  "50818:whenRevealed:1 @0.control.2 SpendResources": { owned: true, note: "Choose the hero whose pool pays 1 resource for Dúnedain of Annúminas.", verb: "Pay" },
  "50818:whenRevealed:1 @0 control": { label: "Take control of Dúnedain of Annúminas: a player spends 1 resource" },
  "50818:whenRevealed:1 @0 discard": { label: "Discard Dúnedain of Annúminas" },

  // 50819:A:2 (Gate of Annúminas): each player engages an enemy in the staging area to travel here.
  "50819:travel:1 @0.0 Pick": { owned: true, note: "Choose an enemy in the staging area to engage. Each player engages one to travel to the Gate of Annúminas.", verb: "Engage" },

  // 50817:A:3 (Host of Angmar), 50824:A:2, 50825:A:2, 50826:A:2 (the Forced choices of the enemies).
  "50817:forced:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "50817:forced:1 @0 staging": { label: "Return Host of Angmar to the staging area" },
  "50824:forced:1 @0 progress": { label: "Remove 1 progress from the main quest" },
  "50824:forced:1 @0 exhaust": { label: "Exhaust a character you control" },
  "50826:forced:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "50826:forced:1 @0 attack": { label: "Angmar Warg-rider makes an immediate attack against you" },
  "50825:forced:1 @0 progress": { label: "Remove 1 progress from the main quest" },
  "50825:forced:1 @0 defense": { label: "Orc of Angmar gets +2 Defense until the end of the phase" },

  // 50829:A:1 (The Hordes of Angmar): each player returns his highest Threat engaged enemy to the staging area, or searches for an enemy to engage.
  "50829:whenRevealed:1 @0.0.return.0 Pick": { owned: true, note: "Choose the highest Threat enemy engaged with you. It returns to the staging area.", verb: "Return" },
  "50829:whenRevealed:1 @0.0.search.0 SearchMove": { owned: true, note: "Search the encounter deck and discard pile for an enemy to put into play engaged with you.", verb: "Search" },
  "50829:whenRevealed:1 @0.0 return": { label: "Return your highest Threat engaged enemy to the staging area" },
  "50829:whenRevealed:1 @0.0 search": { label: "Search for an enemy to put into play engaged with you" },

  // 50830:A:2 (Sorcery of Carn Dûm): discard the highest cost attachment, or assign X damage (X the attachments you control).
  "50830:whenRevealed:1 @0.0.discard.0 Pick": { owned: true, note: "Choose the highest cost attachment you control. Discard it.", verb: "Discard" },
  "50830:whenRevealed:1 @0.0.damage.0 AssignDamage": { owned: true, note: "Assign 1 damage to a character you control, once for each attachment you control.", verb: "Assign" },
  "50830:whenRevealed:1 @0.0 discard": { label: "Discard your highest cost attachment" },
  "50830:whenRevealed:1 @0.0 damage": { label: "Assign damage among your characters, 1 for each attachment you control" },

  // 50831:A:1 (Caught in the Press) and A:2 (its Shadow).
  "50831:whenRevealed:1 @0.0 damage": { label: "Deal 1 damage to each questing character you control" },
  "50831:whenRevealed:1 @0.0 willpower": { label: "Each questing character you control gets -1 Willpower until the end of the phase" },
  "50831:shadow:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "50831:shadow:1 @0 staging": { label: "Return the attacking enemy to the staging area after this attack" },

  // The other picks a player makes for himself.
  "50830:shadow:1 @0 Pick": { owned: true, note: "Choose an attachment you control. Discard it.", verb: "Discard" },
  "50821:travel:1 @0.0 Pick": { owned: true, note: "Choose a hero you control to take 1 damage and travel to Arnor Battlefield.", verb: "Assign" },
  "50824:forced:1 @0.exhaust.0 Pick": { owned: true, note: "Choose a character you control to exhaust.", verb: "Exhaust" },
  "50826:shadow:1 @0 Pick": { owned: true, note: "Choose a character you control to exhaust.", verb: "Exhaust" },
  "50832:whenRevealed:1 @0.0 Pick": { owned: true, note: "Choose a hero you control to take 1 damage. A questing hero leaves the quest.", verb: "Assign" },
};
