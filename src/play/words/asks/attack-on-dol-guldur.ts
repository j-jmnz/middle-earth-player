import type { Ask } from "../asks.ts";

// The choice words of Attack on Dol Guldur (standalone-scenarios part 9), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario attack-on-dol-guldur --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=attack-on-dol-guldur` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 50904:B:2, 50905:B:2, 50906:B:2 (the Tower of Sorcery, the Battle Under the Trees, the Dungeons of the Necromancer): the first player removes 5 more progress for the stage's own bonus.
  "50904:forced:1 @0.progress.1.extra.1 Pick": { owned: true, note: "Choose the player who searches their deck for a card to add to their hand.", verb: "Choose" },
  "50905:forced:1 @0.progress.1.extra.1 Pick": { owned: true, note: "Choose a non-unique enemy in the staging area. It is destroyed.", verb: "Destroy" },
  "50906:forced:1 @0.progress.1.extra.1 Pick": { owned: true, note: "Choose the player who puts an ally from the top 10 cards of their deck into play.", verb: "Choose" },

  // 50926:A:2 (Servant of Sauron): the enemy in the staging area with the highest engagement cost attacks the first player; a tie is the first player's choice.
  "50926:whenRevealed:1 @0 Pick": { owned: true, note: "Choose which enemy in the staging area attacks you: the ones tied for the highest engagement cost.", verb: "Choose" },

  // The stage 3 Forced effects (50903:B:2 to 50906:B:2): the first player removes 5 progress, then may remove 5 more, or takes the penalty.
  "50903:forced:1 @0 progress": { label: "Remove 5 progress from this stage" },
  "50903:forced:1 @0 penalty": { label: "Raise Dol Guldur's city strength by 3" },
  "50903:forced:1 @0.progress.1 extra": { label: "Remove 5 more progress: lower Dol Guldur's city strength by 3" },
  "50903:forced:1 @0.progress.1 decline": { label: "Remove no more progress" },
  "50904:forced:1 @0 progress": { label: "Remove 5 progress from this stage" },
  "50904:forced:1 @0 penalty": { label: "Each player discards all but 1 card from their hand" },
  "50904:forced:1 @0.progress.1 extra": { label: "Remove 5 more progress: a player searches their deck for a card" },
  "50904:forced:1 @0.progress.1 decline": { label: "Remove no more progress" },
  "50905:forced:1 @0 progress": { label: "Remove 5 progress from this stage" },
  "50905:forced:1 @0 penalty": { label: "Each player discards cards from the encounter deck until an enemy is discarded, and puts it into play engaged with them" },
  "50905:forced:1 @0.progress.1 extra": { label: "Remove 5 more progress: destroy a non-unique enemy in the staging area" },
  "50905:forced:1 @0.progress.1 decline": { label: "Remove no more progress" },
  "50906:forced:1 @0 progress": { label: "Remove 5 progress from this stage" },
  "50906:forced:1 @0 penalty": { label: "Each player discards an ally they control" },
  "50906:forced:1 @0.progress.1 extra": { label: "Remove 5 more progress: a player puts an ally from the top 10 cards into play" },
  "50906:forced:1 @0.progress.1 decline": { label: "Remove no more progress" },

  // 50902:A:1 (Crossing the Anduin): 10 progress from Power of Lórien for the Host of Lórien, then 20 more to keep Power of Lórien.
  "50902:whenRevealed:1 @0 host": { label: "Remove 10 progress from Power of Lórien: take control of the Host of Lórien" },
  "50902:whenRevealed:1 @0 discard": { label: "Discard Power of Lórien" },
  "50902:whenRevealed:1 @0.host.2 power": { label: "Remove 20 more progress from Power of Lórien: take control of it" },
  "50902:whenRevealed:1 @0.host.2 discard": { label: "Discard Power of Lórien" },

  // 50902:B:1 and 50931:B:2: the first player advances to a stage 3 that is not in play.
  "50902:whenRevealed:2 @2 50903": { label: "Advance to The Siege of Dol Guldur" },
  "50931:forced:2 @6 50903": { label: "Advance to The Siege of Dol Guldur" },
  "50902:whenRevealed:2 @2 50904": { label: "Advance to The Tower of Sorcery" },
  "50931:forced:2 @6 50904": { label: "Advance to The Tower of Sorcery" },
  "50902:whenRevealed:2 @2 50905": { label: "Advance to Battle Under the Trees" },
  "50931:forced:2 @6 50905": { label: "Advance to Battle Under the Trees" },
  "50902:whenRevealed:2 @2 50906": { label: "Advance to Dungeons of the Necromancer" },
  "50931:forced:2 @6 50906": { label: "Advance to Dungeons of the Necromancer" },

  // The Forced choices of the enemies and of Power Sevenfold.
  "50915:shadow:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "50915:shadow:1 @0 staging": { label: "Return Mirkwood Olog-hai to the staging area after the attack" },
  "50916:forced:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "50916:forced:1 @0 shadow": { label: "Deal Beast of Taur-nu-Fuin another shadow card" },
  "50917:forced:1 @0 progress": { label: "Remove 2 progress from the main quest" },
  "50917:forced:1 @0 damage": { label: "Deal 2 damage to an ally you control" },
  "50918:forced:1 @0 progress": { label: "Remove 1 progress from the main quest" },
  "50918:forced:1 @0 resource": { label: "Place 1 resource on Dol Guldur Marauder" },
  "50919:forced:1 @0 progress": { label: "Remove 1 progress from the main quest" },
  "50919:forced:1 @0 attachment": { label: "Discard an attachment you control" },
  "50927:whenRevealed:1 @0.0 location": { label: "Search for a Dol Guldur location to add to the staging area" },
  "50927:whenRevealed:1 @0.0 enemy": { label: "Search for an Orc enemy to put into play engaged with you" },
};
