import type { Ask } from "../asks.ts";

// The choice words of The Dunland Trap (the-ring-maker part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-dunland-trap --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-dunland-trap` prints each sentence.// Every choice but Off Track's is the asked player's own, so two-handed it leads with the player, card first (`owned` with a `why`). The first player answers for the group at Off Track. No choice here can lose the game by itself: the time dial carries the caution for the counters.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 08011:A:1 (Setup): each player searches the encounter deck (not the discard pile) for a Boar Clan enemy with a title no other player took, and puts it into play engaged with him.
  "08011:setup:1 @0.0 SearchMove": { owned: true, why: "each player searches.", note: "Search the encounter deck for a Boar Clan enemy with a title no other player took. It enters play engaged with you.", verb: "Engage" },

  // 08012:A:1 (When Revealed): after the Items and Mounts go, each player chooses 1 ally he controls and discards each other ally he controls. A player with no ally chooses nothing.
  "08012:whenRevealed:1 @1.2 Pick": { owned: true, why: "each player keeps 1 ally.", note: "Choose the ally you keep. Each other ally you control is discarded.", verb: "Keep" },

  // 08012:B:1 (When Revealed): each player searches the encounter deck and discard pile for a Boar Clan enemy and puts it into play engaged with him.
  "08012:whenRevealed:2 @0.0 SearchMove": { owned: true, why: "each player searches.", note: "Search the encounter deck and discard pile for a Boar Clan enemy with a title no other player took. It enters play engaged with you.", verb: "Engage" },

  // 07057:A:2 (When Revealed): Off Track attaches to a location in play that holds none. The same words as Into Fangorn: each scenario reads only its own asks file.
  "07057:whenRevealed:1 @0 Pick": { note: "Off Track: choose a location in play to attach it to. The location gets +2 quest points, and 1 more time counter comes off the current quest at the end of each refresh phase.", verb: "Attach" },

  // 08024:A:2 (Forced after the attached location is explored): each player searches the encounter deck and discard pile for a Dunland enemy and puts it into play engaged with him.
  "08024:forced:1 @0.0 SearchMove": { owned: true, why: "the location is explored.", note: "Search the encounter deck and discard pile for a Dunland enemy with a title no other player took. It enters play engaged with you.", verb: "Engage" },
};
