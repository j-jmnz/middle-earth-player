import type { Ask } from "../asks.ts";

// The choice words of The Passage of the Marshes (the-two-towers part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-passage-of-the-marshes --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-passage-of-the-marshes` prints each sentence.
// Where a card says "the first player" or "the players must choose" the first player answers for the group (`rr.first-player`, `rr.the-word-choose`): the sentence names that player with {owner}.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 144015:A:2: the player who drew The Searching Eye chooses; exhausting is offered only while a hero of theirs is ready.
  "144015:forced:1 @0 Choose": { owned: true, note: "The Searching Eye: you either exhaust each hero you control, or reveal the top card of the encounter deck." },
  "144015:forced:1 @0 exhaust": { label: "Exhaust each hero you control" },
  "144015:forced:1 @0 reveal": { label: "Reveal the top card of the encounter deck" },
  // 144020:A:2: Shifting Quagmire was discarded by Mire; both options need a location in the victory display.
  "144020:forced:1 @0 Choose": { note: "Shifting Quagmire was discarded by Mire: {owner} chooses for all the players. Either return a random location from the victory display, or raise each player's threat." },
  "144020:forced:1 @0 return": { label: "Return a random location from the victory display to the staging area" },
  "144020:forced:1 @0 threat": {
    label: "Each player raises their threat by {n}, 1 for each location in the victory display",
    bind: { n: { count: { type: "location", control: "any", from: "victory" } } },
  },
  // 144020:A:3: Travel costs 1 Fellowship resource, from a Fellowship hero of any player.
  "144020:travel:1 @0 SpendResources": { note: "Shifting Quagmire: choose the Fellowship hero whose resource pays to travel here. A hero of any player may pay.", verb: "Pay" },
  // 144021:A:1: the first player searches (no "you" on the card).
  "144021:forced:1 @0 SearchMove": { owned: true, note: "Haunted Mere was discarded by Mire: search the encounter deck and discard pile for an Undead enemy. Reveal it and add it to the staging area.", verb: "Add" },
  // 144025:A:2 (Peril): the revealing player chooses.
  "144025:whenRevealed:1 @0 Choose": { owned: true, note: "Bitter Reek: you either raise your threat for each committed character you control, or deal 1 damage to each committed character." },
  "144025:whenRevealed:1 @0 threat": {
    label: "Raise your threat by {n}, 1 for each character you control committed to the quest",
    bind: { n: { count: { type: "character", control: "you", committed: true } } },
  },
  "144025:whenRevealed:1 @0 damage": {
    label: "Deal 1 damage to each of the {n} characters committed to the quest, any player's",
    bind: { n: { count: { type: "character", control: "any", committed: true } } },
  },
  // 144054:A:1: "The first player must choose".
  "144054:whenRevealed:1 @0 Choose": { note: "Call of the Ring: {owner} chooses for all the players. Either search for a Nazgûl enemy to add to the staging area, or exhaust The One Ring and reveal the top card." },
  "144054:whenRevealed:1 @0 search": { label: "Search the encounter deck and discard pile for a Nazgûl enemy and add it to the staging area" },
  "144054:whenRevealed:1 @0 reveal": { label: "Exhaust The One Ring and reveal the top card of the encounter deck" },
  "144054:whenRevealed:1 @0.search.0 SearchMove": { owned: true, note: "Call of the Ring: choose a Nazgûl enemy from the encounter deck or discard pile to add to the staging area.", verb: "Add" },
  // 144055:A:2: the first player chooses and may cancel the whole effect for 1 Fellowship resource and the exhausted Ring.
  "144055:whenRevealed:1 @0 Choose": { note: "We Hates Them!: {owner} chooses for all the players. Either flip Sméagol to Gollum, or Gollum makes an immediate attack against the first player. Or cancel this effect." },
  "144055:whenRevealed:1 @0 flip": { label: "Flip Sméagol to Gollum, engaged with the first player" },
  "144055:whenRevealed:1 @0 attack": { label: "Gollum makes an immediate attack against {owner}" },
  "144055:whenRevealed:1 @0 cancel": { label: "Cancel this effect: spend 1 Fellowship resource and exhaust The One Ring. Surge still reveals 1 more card" },
  "144055:whenRevealed:1 @0.cancel.0 SpendResources": { owned: true, note: "We Hates Them!: choose the hero whose Fellowship resource pays to cancel this effect.", verb: "Pay" },
  // 144064:A:1 (Setup): each player in order searches the encounter deck for 1 location.
  "144064:setup:1 @1.0 SearchMove": { owned: true, note: "The Taming of Sméagol: search the encounter deck for 1 location. Reveal it and add it to the staging area.", verb: "Add" },
  // 144066:A:1: each player puts an Undead enemy found in the encounter deck or discard pile into play engaged with them.
  "144066:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Don't Look at the Lights!: search the encounter deck and discard pile for an Undead enemy. Put it into play engaged with you.", verb: "Engage" },
};
