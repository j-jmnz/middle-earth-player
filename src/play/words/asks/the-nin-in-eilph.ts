import type { Ask } from "../asks.ts";

// The choice words of The Nîn-in-Eilph (the-ring-maker part 7), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-nin-in-eilph --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-nin-in-eilph` prints each sentence.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 07057:A:1 (Off Track): attached to a location in play; it gets +2 quest points and removes an additional time counter at the end of each refresh phase.
  "07057:whenRevealed:1 @0 Pick": { note: "Off Track: choose a location in play to attach it to. It gets +2 quest points and removes 1 more time counter from the current quest at the end of each refresh phase.", verb: "Attach" },

  // 08094:A:1 (Fleeing from Tharbad): each player in turn searches for a location with a different title.
  "08094:setup:1 @1.0 SearchMove": { owned: true, note: "Fleeing from Tharbad: choose a location with a different title from the others found, from the encounter deck. It is added to the staging area.", verb: "Add" },

  // 08098:A:1 to 08100:A:1 (Lost in the Swanfleet): the Marsh-dweller joins the staging area from out of play or from a player, healed.
  "08098:whenRevealed:1 @2 Pick": { note: "Lost in the Swanfleet: choose Ancient Marsh-dweller to return to the staging area. Its damage is healed.", verb: "Return" },
  "08099:whenRevealed:1 @2 Pick": { note: "Lost in the Swanfleet: choose Ancient Marsh-dweller to return to the staging area. Its damage is healed.", verb: "Return" },
  "08100:whenRevealed:1 @2 Pick": { note: "Lost in the Swanfleet: choose Ancient Marsh-dweller to return to the staging area. Its damage is healed.", verb: "Return" },

  // 08101:A:1 (Out of the Swamp): it joins the staging area healed, then attacks each player in player order.
  "08101:whenRevealed:1 @1 Pick": { note: "Out of the Swamp: choose Ancient Marsh-dweller to return to the staging area. Its damage is healed.", verb: "Return" },
  "08101:whenRevealed:1 @4 Pick": { note: "Out of the Swamp: choose Ancient Marsh-dweller to attack each player in player order, from the first player. It stays where it is.", verb: "Attack" },

  // 08101:B:2 (Out of the Swamp): after the last time counter goes, it attacks each player in order; then 2 time counters are put on the stage.
  "08101:forced:1 @0 Pick": { note: "Out of the Swamp: choose Ancient Marsh-dweller to attack each player in player order, from the first player. Then 2 time counters go on this stage.", verb: "Attack" },

  // 08105:A:1 (Neekerbreekers): the engaged player deals 2 damage to an ally he controls.
  "08105:forced:1 @0.0 Pick": { owned: true, note: "Neekerbreekers: choose an ally you control to take 2 damage.", verb: "Damage" },

  // 08106:A:1 (Fen of Reeds): each player exhausts a character after the players advance to a quest stage.
  "08106:forced:1 @0.0 Pick": { owned: true, note: "Fen of Reeds: choose a ready character you control to exhaust.", verb: "Exhaust" },

  // 08108:A:1 (Hidden Eyot): each player exhausts a character to travel here.
  "08108:travel:1 @0.0 Pick": { owned: true, note: "Hidden Eyot: choose a ready character you control to exhaust. It is the cost to travel here.", verb: "Exhaust" },

  // 08111:A:1 (Remnants of Elder Days): each player searches the encounter deck and discard pile for a Creature enemy to put into play engaged with him.
  "08111:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Remnants of Elder Days: choose a Creature enemy from the encounter deck or discard pile. It enters play engaged with you and is not revealed.", verb: "Engage" },
};
