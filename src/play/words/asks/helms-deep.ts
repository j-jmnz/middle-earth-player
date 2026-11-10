import type { Ask } from "../asks.ts";

// The choice words of Helm's Deep (the-two-towers part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test:scenario helms-deep --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=helms-deep` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 143072:A:1: "the players must choose": the first player answers for the group. The first option is the one a player who wants Poisoned Counsels in their deck takes; the second bypasses stage 1B (its When Revealed never resolves).
  "143072:setup:1 @0 Choose": { note: "The King of the Golden Hall: {owner} chooses for all the players. Either each player shuffles 1 Poisoned Counsels into their deck, or advance to stage 2A (Assault on Helm's Deep), bypassing stage 1B." },
  "143072:setup:1 @0 counsels": { label: "Each player shuffles 1 Poisoned Counsels into their deck" },
  "143072:setup:1 @0 bypass": { label: "Advance to stage 2A, Assault on Helm's Deep, bypassing stage 1B" },
  // 143072:B:1: each player puts an ally from their hand into play whose sphere one of their heroes has; a neutral ally matches no sphere and a Fellowship hero has none.
  "143072:whenRevealed:1 @0.0 PutIntoPlayFromHand": { owned: true, note: "Stage 1B: put 1 ally from your hand into play that matches the sphere of 1 of your heroes. A neutral ally matches no sphere.", verb: "Put" },
  // 143034:A:2: the Shadow puts 1 progress on the active location (the only one), and the attacking enemy gets +1 Attack for each progress there.
  "143034:shadow:1 @0 Pick": { owned: true, note: "Wild Hillman's Shadow: place 1 progress on the active location. The attacking enemy gets +1 Attack for each progress there.", verb: "Place" },
  // 143044:A:2: the enemy in the staging area with the highest Attack attacks the revealing player (the pick offers only those that tie); no enemy there and Reckless Hate gains surge.
  "143044:whenRevealed:1 @0 Pick": { owned: true, note: "Reckless Hate: choose the enemy in the staging area with the highest Attack. It makes an immediate attack against you.", verb: "Attack" },
  // 143045:A:2: remove a token from The Defense of Helm's Deep (offered only while it holds one), or reveal 2 additional encounter cards.
  "143045:whenRevealed:1 @0 Choose": { note: "Night Without End: {owner} either removes 1 resource token from The Defense of Helm's Deep, or reveals 2 additional encounter cards." },
  "143045:whenRevealed:1 @0 remove": { label: "Remove 1 resource token from The Defense of Helm's Deep" },
  "143045:whenRevealed:1 @0 reveal": { label: "Reveal 2 additional encounter cards" },
  // 143074:A:1: Helm's Gate is already in the staging area (the search found no other); the Pick makes it the active location.
  "143074:whenRevealed:1 @2 Pick": { note: "The Hosts of Isengard: choose the Helm's Gate in the staging area to make the active location, returning the previous one to the staging area.", verb: "Make active" },
};
