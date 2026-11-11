import type { Ask } from "../asks.ts";

// The choice words of Shelob's Lair (the-two-towers part 6), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario shelobs-lair --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=shelobs-lair` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 144040:A:3: Forced at the beginning of the quest phase; "either ... or" for the first player (rr.first-player). The attack option is offered only while Shelob is in play.
  "144040:forced:1 @0 Choose": { note: "Shelob: {owner} chooses for all the players. Either place 1 resource on Shelob, or she makes an immediate attack against the first player." },
  "144040:forced:1 @0 place": { label: "Place 1 resource on Shelob: she gets +1 Threat" },
  "144040:forced:1 @0 attack": { label: "Shelob makes an immediate attack against {owner}" },
  // 144041:A:2 (Peril): the revealing player chooses.
  "144041:whenRevealed:1 @0 Choose": { owned: true, note: "Morgul Orc: you either discard 1 random card from your hand, or reveal an additional encounter card." },
  "144041:whenRevealed:1 @0 discard": { label: "Discard 1 card at random from your hand" },
  "144041:whenRevealed:1 @0 reveal": { label: "Reveal an additional encounter card" },
  // 144042:A:2 (Peril): the revealing player chooses; the discard option needs a card in some hand.
  "144042:whenRevealed:1 @0 Choose": { owned: true, note: "Orc of Cirith Ungol: you either have each player discard 1 random card from their hand, or the Orc attacks you." },
  "144042:whenRevealed:1 @0 discard": { label: "Each player discards 1 card at random from their hand" },
  "144042:whenRevealed:1 @0 attack": { label: "Orc of Cirith Ungol attacks you" },
  // 144043:A:2: Forced after Morgul Vale is explored; the search comes first, then the first player chooses.
  "144043:forced:1 @0 SearchMove": { owned: true, note: "Morgul Vale was explored: search the encounter deck and discard pile for a Morgul Wraith. Add it to the staging area.", verb: "Add" },
  "144043:forced:1 @2 Choose": { note: "Morgul Vale was explored: {owner} chooses for all the players. Either exhaust The One Ring, or each player discards 1 random card from their hand." },
  "144043:forced:1 @2 exhaust": { label: "Exhaust The One Ring" },
  "144043:forced:1 @2 discard": { label: "Each player discards 1 card at random from their hand" },
  // 144044:A:2: the first player chooses the cost of traveling to the Secret Way.
  "144044:travel:1 @0 Choose": { note: "Sméagol's Secret Way: {owner} chooses for all the players how to pay to travel here. Either exhaust Sméagol, or each player discards 1 random card from their hand." },
  "144044:travel:1 @0 exhaust": { label: "Exhaust Sméagol" },
  "144044:travel:1 @0 discard": { label: "Each player discards 1 card at random from their hand" },
  // 144044:A:3: each player in turn order, the first player first.
  "144044:forced:1 @0.0 Choose": { owned: true, note: "Sméagol's Secret Way was explored: you either exhaust a ready character you control, or discard 1 random card from your hand." },
  "144044:forced:1 @0.0 exhaust": { label: "Exhaust a ready character you control" },
  "144044:forced:1 @0.0 discard": { label: "Discard 1 card at random from your hand" },
  "144044:forced:1 @0.0.exhaust.0 Pick": { owned: true, note: "Sméagol's Secret Way: choose a ready character you control to exhaust.", verb: "Exhaust" },
  // 144045:A:3 and 144049:A:2: the Travel cost; 144049:A:1: Den of Night hears a canceled When Revealed effect. The resource goes on Shelob.
  "144045:travel:1 @0 Pick": { note: "Cleft of Cirith Ungol: choose Shelob to place 1 resource on, the cost to travel here. She gets +1 Threat for each resource.", verb: "Place" },
  "144049:travel:1 @0 Pick": { note: "Den of Night: choose Shelob to place 1 resource on, the cost to travel here. She gets +1 Threat for each resource.", verb: "Place" },
  "144049:forced:1 @0 Pick": { note: "Den of Night: a When Revealed effect was canceled. Choose Shelob to place 1 resource on.", verb: "Place" },
  // 144046:A:2: after The Spider's Lair becomes the active location Shelob attacks the first player.
  "144046:forced:2 @0 Pick": { note: "The Spider's Lair is the active location: choose Shelob to attack the first player now.", verb: "Attack" },
  // 144050:A:1 and A:2: an attachment of the player's own, not an objective.
  "144050:whenRevealed:1 @0.1 Pick": { owned: true, note: "Exhalation of Decay: choose a non-objective attachment you control to discard.", verb: "Discard" },
  "144050:shadow:1 @0 Pick": { owned: true, note: "Exhalation of Decay: choose a non-objective attachment you control to discard.", verb: "Discard" },
  // 144052:A:3: A Heavy Burden; the first player controls the Ring-bearer.
  "144052:forced:1 @0 Choose": { note: "A Heavy Burden: {owner} chooses for all the players. Either each player raises their threat by 1, or exhaust the Ring-bearer." },
  "144052:forced:1 @0 threat": { label: "Each player raises their threat by 1" },
  "144052:forced:1 @0 exhaust": { label: "Exhaust the Ring-bearer" },
  // 144054:A:1 and 144055:A:2: the first player chooses (as in The Passage of the Marshes).
  "144054:whenRevealed:1 @0 Choose": { note: "Call of the Ring: {owner} chooses for all the players. Either search for a Nazgûl enemy to add to the staging area, or exhaust The One Ring and reveal the top card." },
  "144054:whenRevealed:1 @0 search": { label: "Search the encounter deck and discard pile for a Nazgûl enemy and add it to the staging area" },
  "144054:whenRevealed:1 @0 reveal": { label: "Exhaust The One Ring and reveal the top card of the encounter deck" },
  "144054:whenRevealed:1 @0.search.0 SearchMove": { owned: true, note: "Call of the Ring: choose a Nazgûl enemy from the encounter deck or discard pile to add to the staging area.", verb: "Add" },
  "144055:whenRevealed:1 @0 Choose": { note: "We Hates Them!: {owner} chooses for all the players. Either flip Sméagol to Gollum, or Gollum makes an immediate attack against the first player. Or cancel this effect." },
  "144055:whenRevealed:1 @0 flip": { label: "Flip Sméagol to Gollum, engaged with the first player" },
  "144055:whenRevealed:1 @0 attack": { label: "Gollum makes an immediate attack against {owner}" },
  "144055:whenRevealed:1 @0 cancel": { label: "Cancel this effect: spend 1 Fellowship resource and exhaust The One Ring. Surge still reveals 1 more card" },
  "144055:whenRevealed:1 @0.cancel.0 SpendResources": { owned: true, note: "We Hates Them!: choose the hero whose Fellowship resource pays to cancel this effect.", verb: "Pay" },
  // 144059:A:2: Blocked Tunnel's Action; any player may use it, with a character of their own that carries a Weapon.
  "144059:action:1 @0 Pick": { owned: true, note: "Blocked Tunnel: choose a ready character you control with a Weapon attachment to exhaust. Blocked Tunnel gets 3 progress.", verb: "Exhaust" },
  // 144060:A:1: the revealing player attaches it to a hero they control that carries none.
  "144060:whenRevealed:1 @0 AttachSelf": { owned: true, note: "Shelob's Poison: choose a hero you control to carry it. The hero is exhausted, its text box is blank except Traits, and it cannot ready.", verb: "Attach" },
  // 144061:A:2 (Peril, Surge): the revealing player chooses; each option needs Shelob in play.
  "144061:whenRevealed:1 @0 Choose": { owned: true, note: "Lurking Malice: you either place 1 resource on Shelob, or she attacks you." },
  "144061:whenRevealed:1 @0 place": { label: "Place 1 resource on Shelob: she gets +1 Threat" },
  "144061:whenRevealed:1 @0 attack": { label: "Shelob attacks you" },
  "144061:whenRevealed:1 @0.place.0 Pick": { owned: true, note: "Lurking Malice: choose Shelob to place 1 resource on.", verb: "Place" },
  "144061:whenRevealed:1 @0.attack.0 Pick": { owned: true, note: "Lurking Malice: choose Shelob to attack you from the staging area.", verb: "Attack" },
  // 144062:A:1: Shelob attacks each player in turn order, the first player first.
  "144062:whenRevealed:1 @1 Pick": { note: "Rage and Hunger: Shelob gets +2 Attack until the end of the phase and attacks each player in turn order, the first player first.", verb: "Attack" },
  // 144072:A:1: Shelob is healed of all her damage.
  "144072:whenRevealed:1 @2 Pick": { note: "Gollum's Betrayal: choose Shelob to heal all damage from. Each player then places 1 resource on her.", verb: "Heal" },
};
