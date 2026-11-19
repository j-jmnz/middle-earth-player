import type { Ask } from "../asks.ts";

// The choice words of The Redhorn Gate (dwarrowdelf part 4), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario the-redhorn-gate --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=the-redhorn-gate` prints each sentence.
// The first player answers for the group at Black Uruks, Arwen's Response, Snowdrifts, Fallen Stones and Freezing Cold, so those sentences are not owned (the sheet adds who chooses); each player's own heroes and characters are owned at Fanuidhol, Rocky Crags and Wolfpelt Goblin.
// Fanuidhol asks once for each committed hero with a resource and names the hero ({picked}); a pick that spans seats (Black Uruks' attachment, Arwen's hero) names the owner on each row.
export const ASKS: Readonly<Record<string, Ask>> = {
  // 03054:A:1 (When Revealed): the first player discards an attachment on a questing character, any player's.
  "03054:whenRevealed:1 @0 Pick": { note: "{card}: choose 1 attachment on a questing character, any player's. It is discarded.", verb: "Discard" },

  // 03059:A:1 (When Revealed): a Mountain Warg joins the staging area from the encounter deck or discard pile, not revealed.
  "03059:whenRevealed:1 @0 SearchMove": { note: "{card}: search the encounter deck and discard pile for a Mountain Warg. It joins the staging area, not revealed, and the deck is shuffled.", verb: "Add" },

  // 04012:B:2 (Forced when the stage is defeated): Caradhras is searched out of the victory display, the encounter deck or its discard pile when it is not in the staging area, then becomes the active location without a travel.
  "04012:forced:1 @2 SearchMove": { note: "{card}: search the victory display, the encounter deck and its discard pile for Caradhras. It joins the staging area.", verb: "Add" },
  "04012:forced:1 @3 Pick": { note: "{card}: Caradhras becomes the active location. The players do not travel there.", verb: "Make active" },

  // 04014:A:2 (Response when Arwen exhausts): her controller chooses a hero, any player's, to get 1 resource. The pick spans seats, so each row names its owner.
  "04014:response:1 @0 Pick": { note: "{card} exhausted: choose a hero, any player's, to add 1 resource to.", verb: "Add" },

  // 04016:A:1 (Forced when the quest total is counted): each committed hero with a resource may spend 1 from its own pool to count its Willpower; its controller answers, one question for each hero.
  "04016:forced:1 @0.0.0 Choose": { owned: true, note: "{card}: spend 1 resource from {picked}'s pool to count its Willpower, or keep it and count 0." },
  "04016:forced:1 @0.0.0 pay": { label: "Spend 1 resource from {picked}'s pool: its Willpower counts" },
  "04016:forced:1 @0.0.0 keep": { label: "Keep the resource: {picked} counts 0 Willpower" },

  // 04019:A:1 (Travel): each player deals 2 damage to a character he controls; every player pays it or the players cannot travel here.
  "04019:travel:1 @0.0 Pick": { owned: true, note: "{card}: to travel here, choose 1 character you control to take 2 damage. Every player pays this.", verb: "Assign" },

  // 04021:A:1 (When Revealed): the first player removes every progress token in play, or reveals 2 encounter cards into the staging area.
  "04021:whenRevealed:1 @0 Choose": { note: "{card}: choose 1. Remove every progress token in play: on the quest, the active location, locations in the staging area, side quests and Blinding Blizzard. Or reveal 2 cards." },
  "04021:whenRevealed:1 @0 remove": { label: "Remove all progress tokens from play" },
  "04021:whenRevealed:1 @0 reveal": { label: "Reveal 2 encounter cards and add them to the staging area" },

  // 04023:A:1 (When Revealed): the first player attaches Freezing Cold to a hero he controls, one that carries a copy included.
  "04023:whenRevealed:1 @0 AttachSelf": { note: "{card}: choose 1 hero you control to carry it. The hero gets -2 Willpower and cannot commit to the quest. A second copy on a hero discards it.", verb: "Attach" },

  // 901302:A:2 (Forced after it engages a player): that player deals X damage to a character he controls, X the active location's quest points less its progress.
  "901302:forced:1 @0 Pick": { owned: true, bind: { x: { remainingQuestPoints: "activeLocation" } }, note: "{card}: choose 1 character you control to take {x} damage, the active location's quest points less its progress. Then 2 progress come off it.", verb: "Assign" },

  // 901304:A:2 (Forced after it engages a player): the player discards the ally he controls with the highest Willpower, his choice among those tied.
  "901304:forced:2 @0 Pick": { owned: true, note: "{card}: discard the ally you control with the highest Willpower. Choose among those tied. Arwen counts, and losing her loses the game.", verb: "Discard" },
};
