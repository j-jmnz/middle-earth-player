import type { Ask } from "../asks.ts";

// The choice words of Danger in Dorwinion (vengeance-of-mordor part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario danger-in-dorwinion --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=danger-in-dorwinion` prints each sentence.
// The first player answers for the group at the Messenger's Choose and the Secret Cultist's tie; each player's own cost choice (the Backstabber's engage, the Overwhelmed shadow, the Disappearances shadow, the Setup search) is owned. Row labels stay short so they do not cut on a phone in landscape.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 21038:A:2 (Shadow): the defending player discards an attachment they control.
  "21038:shadow:1 @0 Pick": { owned: true, note: "Disappearances shadow: choose an attachment you control to discard.", verb: "Discard" },

  // 21039:A:1 (When Revealed): attach to the ally in play with the highest Attack; the first player chooses among those tied.
  "21039:whenRevealed:1 @0 Pick": { note: "Secret Cultist: choose the ally in play with the highest Attack. The Cultist attaches to it and the ally becomes an enemy engaged with its owner.", verb: "Attach" },

  // 21040:A:1 (When Revealed): the first player chooses: each player raises their threat by the active location's Threat, or Messenger from Mordor attacks the first player.
  "21040:whenRevealed:1 @0 Choose": { note: "Messenger from Mordor: raise each player's threat by the active location's Threat, or it attacks the first player now." },
  "21040:whenRevealed:1 @0 threat": { label: "Each player raises threat by location Threat" },
  "21040:whenRevealed:1 @0 attack": { label: "Messenger attacks the first player now" },

  // 21042:A:3 (Shadow): the defending player raises their threat by 2, or the attacking enemy cannot take damage this round.
  "21042:shadow:1 @0 Choose": { owned: true, note: "Overwhelmed shadow: raise your threat by 2, or the attacking enemy cannot take damage this round." },
  "21042:shadow:1 @0 threat": { label: "Raise your threat by 2" },
  "21042:shadow:1 @0 damage": { label: "Attacker takes no damage this round" },

  // 21044:A:1 (Forced after Rhûn Backstabber engages you): raise your threat by 2, or discard an ally you control with printed cost 2 or higher.
  "21044:forced:1 @0 Choose": { owned: true, note: "Rhûn Backstabber engaged you: raise your threat by 2, or discard an ally you control with printed cost 2 or higher." },
  "21044:forced:1 @0 threat": { label: "Raise your threat by 2" },
  "21044:forced:1 @0 discard": { label: "Discard an ally of cost 2 or more" },
  "21044:forced:1 @0.discard.0 Pick": { owned: true, note: "Rhûn Backstabber: choose an ally you control with printed cost 2 or higher to discard.", verb: "Discard" },

  // 21047:A:3 (Travel): look at the top 5 cards of the encounter deck and put one facedown under Seedy Tavern.
  "21047:travel:1 @1 PickEncounter": { note: "Seedy Tavern: to travel here, choose 1 of the top 5 encounter cards to put facedown under it. The other 4 are shuffled back.", verb: "Hide" },

  // 21077:A:1 (Setup): each player searches the encounter deck for a different location and adds it to the staging area.
  "21077:setup:1 @0.0 SearchMove": { owned: true, note: "choose a location from the encounter deck, different from the other players' locations, to add to the staging area at Setup.", verb: "Add" },
};
