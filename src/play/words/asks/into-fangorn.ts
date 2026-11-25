import type { Ask } from "../asks.ts";

// The choice words of Into Fangorn (the-ring-maker part 3), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario into-fangorn --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=into-fangorn` prints each sentence.
// The first player answers for the group at the Travel of Edge of Fangorn, Turned Around, Off Track and In Need of Rest, so those sentences are not owned; every other choice is the asked player's own, so two-handed it leads with the player.
// No choice here can lose the game by itself: the last time counter shuffles Mugash back into the deck or refills the stage, and a hero destroyed by damage only returns Mugash to the deck. The time row of Turned Around takes its count and its last-counter caution from ring-maker-sheets.ts.
const EXHAUSTED = { count: { type: "character", control: "you", state: "exhausted" } } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 07031:A:2 (Action, any player): exhaust a ready hero to claim Mugash when he is free of encounters; he attaches to it, and returns to the top of the encounter deck if it takes damage (07031:A:3).
  "07031:action:1 @0 Pick": { owned: true, note: "Choose a ready hero you control to exhaust and claim Mugash. If that hero takes damage, Mugash returns to the top of the encounter deck.", verb: "Exhaust" },

  // 07032:A:2 (Travel): the first player searches the encounter deck and discard pile for a Huorn enemy and adds it to the staging area, two with 3 or more players. The travel completes with none found.
  "07032:travel:1 @0 SearchMove": { note: "Edge of Fangorn: search the encounter deck and discard pile for a Huorn enemy. Add it to the staging area.", verb: "Add" },
  "07032:travel:1 @1 SearchMove": { note: "Edge of Fangorn, 3 or more players: search for a second Huorn enemy. Add it to the staging area.", verb: "Add" },

  // 07035:A:2 (Forced at the beginning of the resource phase): the engaged player deals 3 damage to one character he controls.
  "07035:forced:2 @0.0 Pick": { owned: true, note: "Deadly Huorn: choose a character you control to take 3 damage.", verb: "Assign" },

  // 07036:A:1 (Constant): each player refreshes at most 5 characters. The player chooses which exhausted characters beyond 5 stay exhausted, one at a time.
  "07036:forced:1 @0.0 CapRefresh": { owned: true, note: "Heart of Fangorn: only 5 of your {x} exhausted characters ready this refresh phase. Choose one that stays exhausted.", bind: { x: EXHAUSTED }, verb: "Keep" },

  // 07037:A:1 (When Revealed): with no attack made by a Huorn, each player searches the encounter deck and discard pile for a Huorn enemy and puts it into play engaged with him.
  "07037:whenRevealed:1 @1.0 SearchMove": { owned: true, note: "The Forest's Malice: no Huorn attacked. Search the encounter deck and discard pile for a Huorn enemy. It enters play engaged with you.", verb: "Engage" },

  // 07050:A:2 (Shadow): the defending player exhausts a character he controls.
  "07050:shadow:1 @0 Pick": { owned: true, note: "Ancient Forest's shadow: choose a ready character you control to exhaust.", verb: "Exhaust" },

  // 07052:A:1 (When Revealed): the first player, for the group, removes 1 time counter from the current quest, or returns the active location to the staging area.
  "07052:whenRevealed:1 @0 Choose": { note: "Turned Around: remove 1 time counter from the current quest, or return the active location to the staging area." },
  "07052:whenRevealed:1 @0 time": { label: "Remove 1 time counter from the current quest" },
  "07052:whenRevealed:1 @0 location": { label: "Return the active location to the staging area" },

  // 07056:A:1 (When Revealed): each player assigns X damage among the characters he controls, X their number.
  "07056:whenRevealed:1 @0.0 AssignDamage": { owned: true, note: "Low on Provisions: assign 1 damage for each character you control, among those characters ({left} left).", verb: "Assign" },

  // 07057:A:2 (When Revealed): attach Off Track to a location in play that holds none. +2 quest points; at the end of each refresh phase 1 more time counter comes off the current quest.
  "07057:whenRevealed:1 @0 Pick": { note: "Off Track: choose a location in play to attach it to. The location gets +2 quest points, and 1 more time counter comes off the current quest at the end of each refresh phase.", verb: "Attach" },

  // 07058:A:1 (When Revealed): remove a hero from the quest and attach In Need of Rest to it; the hero takes 1 damage each time a time counter comes off the current quest.
  "07058:whenRevealed:1 @0 Pick": { note: "In Need of Rest: choose a hero committed to the quest. It leaves the quest and takes 1 damage each time a time counter comes off the current quest.", verb: "Attach" },

  // 07065:B:2 and 07066:B:2 (Forced after the last time counter): Mugash is shuffled into the encounter deck and the quest advances to stage 3.
  "07065:forced:1 @1 Pick": { note: "The last time counter is gone: Mugash is shuffled into the encounter deck, wherever he lies. The quest then advances to stage 3.", verb: "Shuffle in" },
  "07066:forced:1 @1 Pick": { note: "The last time counter is gone: Mugash is shuffled into the encounter deck, wherever he lies. The quest then advances to stage 3.", verb: "Shuffle in" },

  // 07067:B:2 (Forced after the last time counter): the top 5 cards of the encounter deck are discarded, then each player chooses an enemy or objective in the discard pile, reveals it and adds it to the staging area.
  "07067:forced:1 @1.0 RevealChosenFromDiscard": { owned: true, note: "The last time counter is gone: choose an enemy or objective in the encounter discard pile. Reveal it and add it to the staging area. A chosen Mugash takes the next card as his guard.", verb: "Reveal" },

  // 07066:A:1 (When Revealed): each player searches the encounter deck and discard pile for a Huorn enemy and adds it to the staging area.
  "07066:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Escape from Fangorn: search the encounter deck and discard pile for a Huorn enemy. Add it to the staging area.", verb: "Add" },
};
