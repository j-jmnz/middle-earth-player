import type { Ask } from "../asks.ts";

// The choice words of Shadow and Flame (dwarrowdelf part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario shadow-and-flame --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=shadow-and-flame` prints each sentence.
// Every choice of a player about his own cards (his ally, attachment, hero, deck, the characters he exhausts) is owned: two-handed the sentence leads with the player and the sheet adds no "Player N chooses.", solo it has no lead. The first
// player's choices (Inner Flame's and Inner Shadow's removal, Durin's Bane's immediate attacks) and the picks that name no player's card are not owned, so two-handed the sheet says whose choice it is. Fiery Depths' hero is any player's hero, so
// its sentence leads with the player who moves the damage and says the hero may be anyone's.
const BANE_LEFT = { stat: "hitPoints", ofNamed: "Durin's Bane", remaining: true } as const;

export const ASKS: Readonly<Record<string, Ask>> = {
  // 04140:B:1 (Last Lord of Moria) and 04149:A:1 (Leaping Flame, When Revealed): Durin's Bane attacks the first player at once, whatever his threat.
  "04140:whenRevealed:1 @0 Pick": { note: "{card}: Durin's Bane attacks the first player at once from the staging area, whatever his threat, dealt a shadow card. Choose Durin's Bane.", verb: "Attack" },
  "04149:whenRevealed:1 @0 Pick": { note: "{card}: Durin's Bane attacks the first player at once from the staging area, whatever his threat, dealt a shadow card. Choose Durin's Bane.", verb: "Attack" },

  // 04144:A:1, A:2 (Fires in the Deep): each player discards 1 ally he controls, if able; its Shadow does the same to the defending player.
  "04144:whenRevealed:1 @1.0 Pick": { owned: true, note: "{card}: choose 1 ally you control to discard. If no player discards one, it gains surge.", verb: "Discard" },
  "04144:shadow:1 @0 Pick": { owned: true, note: "{card}, a Shadow effect: choose 1 ally you control to discard, if able.", verb: "Discard" },

  // 04145:A:1, 04152:A:1, 04153:A:1 (Counter-Spell, Fiery Sword, Many Thonged Whip, When Revealed): the treachery attaches itself to Durin's Bane.
  "04145:whenRevealed:1 @0 AttachSelf": { note: "{card} attaches to the enemy with the Balrog trait: Durin's Bane. It is a Condition attachment no player controls.", verb: "Attach" },
  "04152:whenRevealed:1 @0 AttachSelf": { note: "{card} attaches to the enemy with the Balrog trait: Durin's Bane. It is a Weapon attachment no player controls.", verb: "Attach" },
  "04153:whenRevealed:1 @0 AttachSelf": { note: "{card} attaches to the enemy with the Balrog trait: Durin's Bane. It is a Weapon attachment no player controls.", verb: "Attach" },

  // 04146:A:1 (Inner Flame, When Revealed): Durin's Bane gets +3 Attack until the end of the round; the first player may remove a questing hero from the quest to cancel it.
  "04146:whenRevealed:1 @0 Choose": { note: "{card}: Durin's Bane gets +3 Attack until the end of the round. The first player may remove 1 questing hero from the quest to cancel it.", verb: "Choose" },
  "04146:whenRevealed:1 @0 remove": { label: "Remove a questing hero you control from the quest to cancel the +3 Attack" },
  "04146:whenRevealed:1 @0 keep": { label: "Keep it: Durin's Bane gets +3 Attack until the end of the round" },
  "04146:whenRevealed:1 @0.remove.0 Pick": { note: "{card}: choose 1 questing hero you control to remove from the quest. It stays exhausted. The +3 Attack is canceled.", verb: "Remove" },
  "04146:whenRevealed:1 @0.keep.0 Pick": { note: "{card}: Durin's Bane gets +3 Attack until the end of the round. Choose Durin's Bane.", verb: "Boost" },

  // 04147:A:2 (Inner Shadow, When Revealed): Surge, then 5 damage are healed from Durin's Bane; the first player may remove a questing hero from the quest to cancel the heal.
  "04147:whenRevealed:1 @0 Choose": { note: "{card}: 5 damage are healed from Durin's Bane. The first player may remove 1 questing hero from the quest to cancel the heal, not the surge.", verb: "Choose" },
  "04147:whenRevealed:1 @0 remove": { label: "Remove a questing hero you control from the quest to cancel the heal" },
  "04147:whenRevealed:1 @0 keep": { label: "Keep it: 5 damage are healed from Durin's Bane" },
  "04147:whenRevealed:1 @0.remove.0 Pick": { note: "{card}: choose 1 questing hero you control to remove from the quest. It stays exhausted. The heal is canceled.", verb: "Remove" },
  "04147:whenRevealed:1 @0.keep.0 Pick": { note: "{card}: 5 damage are healed from Durin's Bane. Choose Durin's Bane.", verb: "Heal" },

  // 04148:A:1 (Whip Lash, When Revealed): each player discards 1 attachment he controls, if able.
  "04148:whenRevealed:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 attachment you control to discard. An encounter attachment on Durin's Bane is not yours to discard.", verb: "Discard" },

  // 04151:A:1 (Ranging Goblin, When Revealed): each player deals 1 damage to a hero he controls.
  "04151:whenRevealed:1 @0.0 Pick": { owned: true, note: "{card}: choose 1 hero you control to take 1 damage.", verb: "Assign" },

  // 04141:A:1 (Dark Pit's Refresh Action, any player): exhaust X characters (0 to 3), discard the top X cards of the deck; their combined printed cost above the hit points Durin's Bane has left discards it from play.
  "04141:action:1 @0 Each": {
    owned: true,
    note: "{card}'s Refresh Action: exhaust up to 3 ready characters you control. Discard that many cards from your deck. Durin's Bane is discarded if their combined cost is above its {left} remaining hit points.",
    verb: "Exhaust",
    bind: { left: BANE_LEFT },
    labels: { done: "Done: discard as many cards as characters chosen" },
  },

  // 901803:A:1 (The Dark Fire, Shadow): 1 damage is healed from Durin's Bane for each point of damage this attack dealt.
  "901803:shadow:1 @0.0 Pick": { note: "{card}, a Shadow effect: Durin's Bane heals 1 damage for each point of damage this attack dealt. Choose Durin's Bane.", verb: "Heal" },

  // 901805:A:1 (Morgoth's Bidding, Shadow): a destroyed character brings an additional attack by Durin's Bane.
  "901805:shadow:1 @0.0 Pick": { note: "{card}, a Shadow effect: this attack destroyed a character, so Durin's Bane attacks the defending player again, dealt a new shadow card. Choose Durin's Bane.", verb: "Attack" },

  // 901807:A:2 (Servant of Flame, Shadow): the defending player searches the encounter deck for a treachery with the Shadow or Flame trait and reveals it, if able.
  "901807:shadow:1 @0 SearchReveal": { owned: true, note: "{card}, a Shadow effect: search the encounter deck for 1 treachery with the Shadow or Flame trait and reveal it. The deck is shuffled.", verb: "Reveal" },

  // 901809:A:2 (Fiery Depths, Travel): each player moves 1 damage from Durin's Bane to a hero, any player's.
  "901809:travel:1 @0.0 Pick": { owned: true, note: "{card}: to travel here each player moves 1 damage from Durin's Bane to a hero. Choose Durin's Bane.", verb: "Move" },
  "901809:travel:1 @0.1 Pick": { owned: true, note: "{card}: choose a hero in play, anyone's, to take 1 damage moved from Durin's Bane. Each player does this once to travel here.", verb: "Move" },
};
