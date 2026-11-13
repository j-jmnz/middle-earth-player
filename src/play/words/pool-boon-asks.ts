// Rules: rr.campaign-pool (data/rules/entries.json); ledger line 10164:A:4. The choice words of the Campaign Pool's boons that a scenario can deal (data/overrides.json, scenarioCampaignPlaced): a game reads only its own scenario's asks file, so each scenario that deals them spreads these into its own.
import type { Ask } from "./asks.ts";

// 10164 Ruthless (Action): move any amount of damage from the attached hero to an enemy engaged with you. 10176 Berelind and 10179 Laermuin (Loot the Dungeons boons): their Responses.
export const POOL_BOON_ASKS: Readonly<Record<string, Ask>> = {
  "10164:action:1 @0 Pick": { owned: true, note: "Ruthless: choose the hero it is attached to, to move damage from.", verb: "Move" },
  "10164:action:1 @1 ChooseX": { owned: true, note: "Ruthless: choose how much damage to move, from 1 up to what the hero holds." },
  "10164:action:1 @2 Pick": { owned: true, note: "Ruthless: choose an enemy engaged with you to take the damage.", verb: "Move" },
  // 10176:A:1 (Response after Berelind destroys an enemy): 1 progress on a quest card in play: the current quest stage or a side quest.
  "10176:response:1 @0 Pick": { owned: true, note: "Berelind: choose a quest card in play to place 1 progress on, the current quest or a side quest. The active location does not take it.", verb: "Place" },

  // 10179:A:1 (Response after Laermuin commits to a quest): 1 damage is healed from a character, any player's.
  "10179:response:1 @0 Pick": { owned: true, note: "Laermuin: choose a character, any player's, to heal 1 damage from.", verb: "Heal" },
};

// 10172 Determination (Action): attach it to a unique character, then ready the characters that carry one or are determined. Worded once for every scenario that can deal it (The Wastes of Eriador and Escape from Mount Gram).
export const DETERMINATION_ASKS: Readonly<Record<string, Ask>> = {
  "10172:action:1 @0 Pick": { owned: true, note: "Determination: choose a unique character in play, any player's, to attach it to. Then each character with a Determination or marked determined readies.", verb: "Attach" },
};
