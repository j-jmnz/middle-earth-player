import type { Ask } from "../asks.ts";
import { ELIMINATED } from "../asks-conditions.ts";
import { ELIMINATION_LEVEL } from "../../../rules/core/eliminate.ts";

// The choice words of The Steward's Fear (against-the-shadow part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-stewards-fear --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-stewards-fear` prints each sentence.
// A choice of one player's own (the engaged player's threat or return, each player's draw, the hero a player exhausts for a Clue, the hero Pickpocket and Umbar Assassin hurt) is owned: two-handed the sentence leads with the player. The first player answers for the group at Underworld Dissident's token
// and A Knife in the Back's hero, so those sentences are not owned and the sheet adds who chooses. The Peril in Pelargir cards dealt here (05037 to 05045) are worded again, because a game reads only its own scenario's file.
// A raise of 4 that takes the player to the elimination level (50): the last player's elimination loses the game.
const ELIMINATED_BY_THREAT = { when: ELIMINATED(4, ELIMINATION_LEVEL), text: "Tap again: this takes your threat to 50 and eliminates you. If you are the last player, the game is lost" };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 06011:B:1 (stage 1B, When Revealed): search the encounter deck, not its discard pile, for The Fourth Star and make it the active location; then shuffle. Underworld X then puts cards under it.
  "06011:whenRevealed:1 @0 SearchMove": { note: "Stage 1B: search the encounter deck for The Fourth Star. It becomes the active location, and its Underworld X puts cards from the underworld deck facedown under it.", verb: "Add" },
  // 06014:A:2 (Underworld Dissident, Shadow): if the attack is undefended, 1 token is removed from the current quest; the first player picks the kind when the quest holds both (an option needs its tokens).
  "06014:shadow:1 @0 Choose": { note: "Underworld Dissident, Shadow: the attack is undefended. Choose the token it removes from the current quest." },
  "06014:shadow:1 @0 progress": { label: "Remove 1 progress token from the current quest" },
  "06014:shadow:1 @0 resource": { label: "Remove 1 resource token from the current quest" },
  // 06015:A:2 (Daughter of Berúthiel, Forced): after her attack she returns to the staging area unless the engaged player raises his own threat by 4.
  "06015:forced:1 @0 Choose": { owned: true, note: "Daughter of Berúthiel attacked you: raise your threat by 4, or she returns to the staging area." },
  "06015:forced:1 @0 raise": { label: "Raise your threat by 4: she stays engaged with you", caution: ELIMINATED_BY_THREAT },
  "06015:forced:1 @0 return": { label: "She returns to the staging area" },
  // 06022:A:3 (The Fourth Star, Response): when it leaves play as an explored location, each player, the first player first, may draw 1 card.
  "06022:response:1 @0.0 Choose": { owned: true, note: "The Fourth Star was explored: draw 1 card, or none." },
  "06022:response:1 @0.0 draw": { label: "Draw 1 card" },
  "06022:response:1 @0.0 skip": { label: "Don't draw" },
  // 06024:A:1 (A Knife in the Back, When Revealed): the first player deals X damage to one of his own heroes, X the Attack of the ally chosen at random; the ally is then discarded.
  "06024:whenRevealed:1 @2 Pick": { note: "A Knife in the Back: choose a hero of the first player to take damage equal to the Attack of the ally chosen at random. The ally is then discarded. A hero that cannot survive it is destroyed.", verb: "Damage" },
  // 06026:A:1 (A Scrap of History), 06028:A:1 (A Prisoner), Action: exhaust a hero to claim the objective, add it to the victory display and place 1 (2) resource tokens on the current quest.
  "06026:action:1 @0 Pick": { owned: true, note: "A Scrap of History: choose a ready hero you control to exhaust. It claims the card, which goes to the victory display. 1 resource token goes on the current quest.", verb: "Exhaust" },
  "06028:action:1 @0 Pick": { owned: true, note: "A Prisoner: choose a ready hero you control to exhaust. It claims the card, which goes to the victory display. 2 resource tokens go on the current quest.", verb: "Exhaust" },
  // 06027:A:1 (Secret Map, Action): exhaust a hero to claim the objective and attach it to that hero.
  "06027:action:1 @0 Pick": { owned: true, note: "Secret Map: choose a ready hero you control to exhaust. It claims Secret Map and carries it.", verb: "Exhaust" },
  // 05037:A:1 (Pickpocket): the defending player picks the hero whose pool loses 1 resource.
  "05037:forced:1 @0 Pick": { owned: true, note: "Pickpocket: choose a hero you control that has resources, to discard 1 resource from its pool.", verb: "Discard" },
  // 05037:A:2 (Pickpocket, Shadow): the defending player picks one of his own attachments.
  "05037:shadow:1 @0 Pick": { owned: true, note: "Pickpocket: choose one of your own attachments to discard.", verb: "Discard" },
  // 05044:A:2 (Umbar Assassin): the player it engages chooses the hero that takes 3 damage when he chose the engagement, else the hero that is discarded.
  "05044:forced:1 @0 Pick": {
    owned: true,
    note: [
      { when: { kind: "flag", stat: "engagedOptionally", holder: "self" }, text: "Umbar Assassin: choose a hero you control to take 3 damage. A hero that cannot survive it is destroyed." },
      { text: "Umbar Assassin engaged you by the engagement check: choose a hero you control to discard." },
    ],
  },
  // 05039:A:2 (Market Square, Travel): each player pays 1 resource from one hero's pool.
  "05039:travel:1 @0.0 SpendResources": { owned: true, note: "Market Square: choose whose pool pays 1 resource to travel here. Each player pays one.", verb: "Pay" },
  // 05040:A:1 (Lost in the City): each player searches the encounter deck and discard pile for a City location; the Underworld ones (Sewers, Storehouse, Houses of the Dead, The Fourth Star) are City locations too.
  "05040:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Lost in the City: choose a City location from the encounter deck or discard pile to add to the staging area. Each player chooses one.", verb: "Add" },
};
