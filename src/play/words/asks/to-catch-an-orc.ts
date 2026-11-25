import type { PickSpec } from "../../../catalog/boundary.ts";
import type { Ask } from "../asks.ts";
import { DESTROYED_BY, type When } from "../asks-conditions.ts";

// The choice words of To Catch an Orc (the-ring-maker part 2), one entry for each Pick and Choose of its records: `<record id> @<instruction path> <verb | option id>` (src/play/words/asks.ts; docs/design-system-table.md, Choice tray).
// `pnpm test scenario to-catch-an-orc --words` fails on a Pick or Choose with neither an entry nor words of its own, and `WORDS_DUMP=to-catch-an-orc` prints each sentence.
// A hero with Mugash attached cannot leave play: the players lose if it does (07024:A:2). So the two choices that put damage on characters (Orc Skirmisher, Take Cover!) arm a two-tap caution on the row that would destroy that hero, and say the game is lost.
// The first player answers for the group at Mugash's attachment, Orc Hunter, Take Cover! and Searching for Mugash, so those sentences are not owned; every other choice here is the asked player's own, so two-handed it leads with the player.
const MUGASH_HOLDER: PickSpec = { type: "hero", control: "any", hasAttachment: { names: ["Mugash"] } };
// The picked character is the hero Mugash is attached to, and `damage` more damage would destroy it.
const HOLDER_DESTROYED_BY = (damage: number): When => ({ kind: "all", conditions: [{ kind: "matches", card: "picked", pick: MUGASH_HOLDER }, DESTROYED_BY(damage)] }) as When;
// Some hero holding Mugash has at most one hit point left: 1 damage to each exhausted character (it is always exhausted) destroys it.
const HOLDER_ON_LAST_POINT: When = { kind: "canPick", pick: { ...MUGASH_HOLDER, maxHitPointsLeft: 1 } };

export const ASKS: Readonly<Record<string, Ask>> = {
  // 07024:A:2 (Forced): after Mugash is defeated the first player attaches him to a hero he controls and exhausts it.
  "07024:forced:1 @1 Pick": { note: "Mugash is defeated: choose a hero you control to hold him. It exhausts and cannot ready. If it leaves play, the players lose.", verb: "Attach" },

  // 07027:A:2 and 07028:A:1 (Forced, Searches X, when explored): the top X cards of the searcher's out-of-play deck are revealed; each enemy joins the staging area, the searcher takes 1 of the other cards into his hand and the rest are discarded. The sheet lists the cards revealed that are no enemy.
  "07027:forced:1 @0.0 RevealOutOfPlay": { owned: true, note: "{card} explored: you revealed the top 3 cards of your out-of-play deck. Enemies join the staging area. Choose 1 other card for your hand. The rest are discarded.", verb: "Take" },
  "07028:forced:1 @1 RevealOutOfPlay": { owned: true, note: "{card} explored: you revealed the top 5 cards of your out-of-play deck. Enemies join the staging area. Choose 1 other card for your hand. The rest are discarded.", verb: "Take" },

  // 07029:A:2 and 07053:A:2 (Shadow): the defending player discards an attachment, or exhausts a character, he controls.
  "07029:shadow:1 @0 Pick": { owned: true, note: "Mugash's Lair's shadow: choose an attachment you control to discard.", verb: "Discard" },
  "07053:shadow:1 @0 Pick": { owned: true, note: "Prowling Wolf's shadow: choose a character you control to exhaust.", verb: "Exhaust" },

  // 07030:A:1 and 07062:B:1 (When Revealed): each player searches the encounter deck (and discard pile) for a location (a Mountain location) and adds it to the staging area.
  "07030:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Orc Territory: search the encounter deck and discard pile for a location. Add it to the staging area.", verb: "Add" },
  "07062:whenRevealed:1 @0.0 SearchMove": { owned: true, note: "Orders from Orthanc: search the encounter deck for a Mountain location. Add it to the staging area. The quest then advances.", verb: "Add" },

  // 07038:A:1 (Forced after it engages you): 3 damage to a character you control, or 1 time counter off the current quest.
  "07038:forced:1 @0 Choose": { owned: true, note: "Orc Skirmisher engaged you: deal 3 damage to a character you control, or remove 1 time counter from the current quest." },
  "07038:forced:1 @0 damage": { label: "Deal 3 damage to a character you control" },
  "07038:forced:1 @0 time": { label: "Remove 1 time counter from the current quest" },
  "07038:forced:1 @0.damage.0 Pick": { owned: true, note: "Orc Skirmisher: choose a character you control to take 3 damage.", verb: "Assign", caution: { when: HOLDER_DESTROYED_BY(3), text: "Tap again: {picked} holds Mugash, the damage destroys it and the players lose the game." } },

  // 07039:A:1 (When Revealed): the first player reveals 1 more encounter card, or removes 1 time counter.
  "07039:whenRevealed:1 @0 Choose": { note: "Orc Hunter: reveal 1 more encounter card, or remove 1 time counter from the current quest." },
  "07039:whenRevealed:1 @0 reveal": { label: "Reveal 1 more encounter card" },
  "07039:whenRevealed:1 @0 time": { label: "Remove 1 time counter from the current quest" },

  // 07040:A:2 (Forced after it engages you): exhaust a character you control.
  "07040:forced:1 @0 Pick": { owned: true, note: "Orc Hound engaged you: choose a character you control to exhaust.", verb: "Exhaust" },

  // 07055:A:2 (When Revealed): the first player deals 1 damage to each exhausted character, or removes 1 time counter.
  "07055:whenRevealed:1 @0 Choose": { note: "Take Cover!: deal 1 damage to each exhausted character, or remove 1 time counter from the current quest." },
  "07055:whenRevealed:1 @0 damage": { label: "Deal 1 damage to each exhausted character", caution: { when: HOLDER_ON_LAST_POINT, text: "Tap again: the damage destroys the hero that holds Mugash and the players lose the game." } },
  "07055:whenRevealed:1 @0 time": { label: "Remove 1 time counter from the current quest" },

  // 07063:B:3 (Response after questing successfully): cancel the progress and place a time counter on this stage, or advance with Mugash in play.
  "07063:response:1 @0 Choose": { note: "Searching for Mugash: cancel the progress the quest placed and add 1 time counter, or advance to the next stage with Mugash in play." },
  "07063:response:1 @0 time": { label: "Cancel all progress on this stage and place 1 time counter on it" },
  "07063:response:1 @0 advance": { label: "Advance to the next stage (Mugash is in play)" },
};
