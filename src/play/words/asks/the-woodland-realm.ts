import type { Ask } from "../asks.ts";

// The choice words of The Woodland Realm (standalone-scenarios part 11), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-woodland-realm --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-woodland-realm` prints each sentence.
// The opposing team's choices (docs/scenarios/standalone-scenarios.md, The Woodland Realm, reading 3) are the engine's, so a sheet opens only for a tie its first player settles. The entries below word those sheets and the choices a player makes.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 51107:B:1 (The Forest of Great Fear): the resource goes on an enemy of cost 2 or more.
  "51107:whenRevealed:2 @2 Pick": { note: "The Forest of Great Fear: choose the enemy of cost 2 or more that gets the resource. While this stage is in play it gets +2 Attack and +2 Defense and is immune to player card effects.", verb: "Choose" },

  // 51123:A:1 (Caught in a Web): attached to a hero, which is exhausted.
  "51123:whenRevealed:1 @0 Pick": { note: "Caught in a Web: choose the hero it attaches to. That hero is exhausted and cannot ready unless its controller pays 2 resources from its pool.", verb: "Attach" },

  // 51126:A:1 (Driven by Shadow): attached to an enemy, which returns to the staging area.
  "51126:whenRevealed:1 @0 Pick": { note: "Driven by Shadow: choose the enemy it attaches to. That enemy returns to the staging area and gets +2 Threat, +2 Attack and +2 Defense, and is immune to player card effects.", verb: "Attach" },

  // 51129:A:1 (Wind-whipped Rain): keep 1 card of the hand and discard the rest, or take damage.
  "51129:whenRevealed:1 @0.0 Choose": { owned: true, note: "Wind-whipped Rain: keep 1 card and discard the rest, or assign 1 damage per card in your hand.", verb: "Choose" },
  "51129:whenRevealed:1 @0.0.keep.0 Pick": { owned: true, note: "Wind-whipped Rain: choose the 1 card of your hand to keep. Discard the rest.", verb: "Keep" },

  // 51134:A:2 (Mountains of Mirkwood): raise your threat or the attacker gets +2 Attack.
  "51134:shadow:1 @0 Choose": { owned: true, note: "Mountains of Mirkwood: raise your threat by 2, or the attacking enemy gets +2 Attack.", verb: "Choose" },

  // 51150:A:1 (A Frightened Beast): raise threat for each questing character or discard one.
  "51150:whenRevealed:1 @0.0 Choose": { owned: true, note: "A Frightened Beast: raise your threat by 1 for each questing character you control, or discard a questing character you control.", verb: "Choose" },

  // 51151 (Ambushing Orcs): the attack from the staging area, and the Shadow that engages the lowest engagement cost enemy there.
  "51151:whenRevealed:1 @0 Pick": { note: "Ambushing Orcs: it makes an immediate attack against the first player.", verb: "Attack" },
  "51151:shadow:1 @0 Pick": { note: "Ambushing Orcs: the enemy in the staging area with the lowest engagement cost engages you and is dealt a shadow card. Choose it.", verb: "Engage" },
};
