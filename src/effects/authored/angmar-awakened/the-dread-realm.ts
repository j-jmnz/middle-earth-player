import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for The Dread Realm (angmar-awakened part 9, campaign card 10193): the three quest stages, Daechanar and the Altar of Midwinter, and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/); a line a template already writes (pnpm data build) or
// another card prints word for word needs no record here, and the stage reminders of mec108.reanimated-dead (10150:B:1, 10151:B:1, 10152:B:1) are inert marks the engine honours as a rule (core/printed.ts DEAD_SUFFIX). The campaign card's records are in angmar-awakened.ts.
// "Reanimate" is the box's own mechanic (mec108.reanimated-dead): a player card placed facedown in front of a player as if it had just engaged them, acting as an Undead enemy with 0 engagement cost, 2 Threat, 2 Attack, 2 Defense and 2 hit points until it leaves play for its owner's discard pile.
// Rules: mec108.reanimated-dead, rr.engaged, rr.destroy, rr.setup, rr.shadow-effects, rr.step-6-2, rr.step-6-11, rr.first-player, rr.defending-player, rr.in-play-and-out-of-play, rr.attachment-cards, rr.removed-from-game, rr.explored, rr.search, rr.travel, rr.cost, rr.active-location, rr.effects,
// rr.forced, rr.modifiers, rr.cancel, rr.reveal, rr.current-quest, rr.printed, rr.unique-cards, faq.enemy-attacks-outside-combat, faq.additional-attacks, faq.progress-without-advancing, faq.simultaneous-effects (data/rules/entries.json).
export const DAECHANAR = "10153";
export const ALTAR_OF_MIDWINTER = "10154";
/** Stage 3 of The Dread Realm: the quest card whose B side wins the game once no location is in play at the end of the quest phase. */
export const ESCAPE_FROM_CARN_DUM = "10152";
export const WRAITH_OF_CARN_DUM = "101157";
export const POSSESSION = "101162";
export const A_FELL_DREAD = "101163";
const FIRST_PLAYER = { who: "firstPlayer" } as const;
/** "Sorcery cards in play": the faceup cards with the Trait in play, attachments on heroes, allies, enemies and quest cards included; a shadow card lies out of play (rr.in-play-and-out-of-play). */
export const SORCERY_IN_PLAY: PickSpec = { type: "card", control: "any", trait: "Sorcery", allInPlay: true };
const AT_LEAST_ONE_SORCERY: Condition = { kind: "count", pick: SORCERY_IN_PLAY, min: 1 };
/** Daechanar in play, in the staging area or engaged. */
const DAECHANAR_IN_PLAY: Condition = { kind: "count", pick: { type: "enemy", control: "any", staging: true, names: ["Daechanar"] }, min: 1 };
export const LOCATIONS_IN_PLAY: PickSpec = { type: "location", control: "any" };
const PHASE_QUEST: Condition = { kind: "phase", is: "Quest" };
const ATTACHED = { kind: "sourceIn", zone: "attached" } as const;
/** "Attached character", "attached hero": the host is that card type now (a host can change type, rr.then is not involved). */
const HOST_IS = (type: "character" | "hero") => ({ kind: "matches", card: "host", pick: { type, control: "any" } }) as const;
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
/** "Each player reanimates the top card of his deck." */
const EACH_PLAYER_REANIMATES: Instruction = EACH_PLAYER([{ verb: "Reanimate", from: "deckTop" }]);
/** "deal it 1 shadow card": the Reanimated Dead the Reanimate just made (the picked card). */
const DEAL_IT_A_SHADOW: Instruction = { verb: "DealShadowInPlay", target: "picked" };
const HOST_MINUS_ONE = (stat: "willpower" | "attack" | "defense"): Instruction => ({ verb: "ModifyStat", stat, amount: -1, until: "whileSourceInPlay", target: "host" });
/** "If this attack destroys a character, reanimate that character and deal it 1 shadow card" (Unholy Crypt, Dwimmerlaik): the effect the attack leaves for its end, X the characters it destroyed. */
const REANIMATE_DESTROYED: Instruction = { verb: "AfterAttack", instructions: [{ verb: "Reanimate", from: "destroyed", when: { kind: "x", min: 1 } }, { ...DEAL_IT_A_SHADOW, when: { kind: "x", min: 1 } }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 10150 Overwhelmed (1A/1B). Setup: Daechanar and the Altar of Midwinter are set aside (the data does it); each player reveals an encounter card, then each player reanimates the top card of their deck. 1B: the Sorcery cards attached to this stage move to stage 2B when it advances.
  { id: "10150:setup:1", cardCode: "10150", lines: ["10150:A:1"], timing: "setup", instructions: [EACH_PLAYER([{ verb: "RevealEncounter" }]), EACH_PLAYER_REANIMATES] },
  { id: "10150:constant:1", cardCode: "10150", lines: ["10150:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "passesSorcery", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 10151 Daechanar's Sorcery (2A/2B). When Revealed: Daechanar joins the staging area, the Altar of Midwinter becomes the active location (the one that was returns to the staging area) and each player reanimates the top card of their deck. 2B: when Daechanar is defeated the quest advances.
  { id: "10151:whenRevealed:1", cardCode: "10151", lines: ["10151:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: DAECHANAR }, { verb: "MakeSetAsideActive", code: "10154" }, EACH_PLAYER_REANIMATES] },
  { id: "10151:forced:1", cardCode: "10151", lines: ["10151:B:2"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", names: ["Daechanar"] }, instructions: [{ verb: "AdvanceStage" }] },

  // 10152 Escape from Carn Dûm (3A/3B). When Revealed: the first player searches the encounter deck and discard pile for locations until the staging area holds one for each player (the deck is shuffled after). 3B: progress goes on the staged locations as the first player divides it; at the end of
  // the quest phase every character takes 1 damage while a location is in play, and the players win once none is.
  {
    id: "10152:whenRevealed:1",
    cardCode: "10152",
    lines: ["10152:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Repeat", times: 2, instructions: [{ verb: "SearchMove", type: "location", to: "staging", when: { kind: "less", left: { count: { type: "location", control: "any", stagingOnly: true } }, right: { players: true } } }] },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  { id: "10152:constant:1", cardCode: "10152", lines: ["10152:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "progressToStaging", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "10152:forced:1", cardCode: "10152", lines: ["10152:B:2"], timing: "forced", trigger: "progressReplaced", instructions: [{ verb: "PlaceProgressInStaging", required: true }] },
  { id: "10152:forced:2", cardCode: "10152", lines: ["10152:B:3"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [PHASE_QUEST, { kind: "count", pick: LOCATIONS_IN_PLAY, min: 1 }] }, instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any" } }] },
  { id: "10152:forced:3", cardCode: "10152", lines: ["10152:B:3"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [PHASE_QUEST, { kind: "count", pick: LOCATIONS_IN_PLAY, max: 0 }] }, instructions: [{ verb: "WinGame" }] },

  // 10153 Daechanar. +1 Attack for each Sorcery card in play, indestructible while there is one; when he is damaged with one in play all that damage is canceled and the first player removes a Sorcery card from the game.
  { id: "10153:constant:2", cardCode: DAECHANAR, lines: ["10153:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: SORCERY_IN_PLAY }, until: "whileSourceInPlay", target: "self" }] },
  { id: "10153:constant:3", cardCode: DAECHANAR, lines: ["10153:A:2"], timing: "constant", condition: AT_LEAST_ONE_SORCERY, instructions: [{ verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "10153:forced:1",
    cardCode: DAECHANAR,
    lines: ["10153:A:3"],
    timing: "forced",
    trigger: "damaged",
    subject: "self",
    condition: AT_LEAST_ONE_SORCERY,
    instructions: [{ verb: "CancelDamage", all: true }, { verb: "Pick", pick: { ...SORCERY_IN_PLAY, ...FIRST_PLAYER } }, { verb: "RemovePickedFromGame" }],
  },

  // 10154 Altar of Midwinter. No progress is placed on it while Daechanar is in play; at the end of the staging step the first player reveals one more encounter card or reanimates the top card of their deck (not offered with an empty deck).
  { id: "10154:constant:1", cardCode: "10154", lines: ["10154:A:1"], timing: "constant", condition: DAECHANAR_IN_PLAY, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "10154:forced:1",
    cardCode: "10154",
    lines: ["10154:A:2"],
    timing: "forced",
    trigger: "stagingStepEnds",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
          { id: "reanimate", requires: { kind: "canPick", pick: { type: "card", control: "you", from: "deck", top: 1 } }, instructions: [{ verb: "Reanimate", from: "deckTop" }] },
        ],
      },
    ],
  },

  // 10155 Dwimmerlaik. Forced: after it attacks and destroys a character the defending player reanimates that character and deals it 1 shadow card. Shadow: the same text as Unholy Crypt's (copied below).
  {
    id: "10155:forced:1",
    cardCode: "10155",
    lines: ["10155:A:1"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "character", control: "any" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", isSource: true } },
    instructions: [{ verb: "Reanimate", from: "card", card: "subject" }, DEAL_IT_A_SHADOW],
  },

  // 101156 Witch of Angmar. Forced: once her shadow cards have resolved their shadow effects, the "when revealed" effects of those with the Sorcery trait resolve, in the order dealt, with the defending player revealing them.
  { id: "101156:forced:1", cardCode: "101156", lines: ["101156:A:1"], timing: "forced", trigger: "shadowsResolved", subject: "self", instructions: [{ verb: "ResolveWhenRevealedOf", of: "heldShadows", trait: "Sorcery" }] },

  // 101157 Wraith of Carn Dûm. Forced: when it leaves play the first player attaches it to a character in play. Attached it counts as a Sorcery attachment: the character has -1 Willpower, -1 Attack and -1 Defense, and when it leaves play the Wraith returns to the staging area as an enemy (the engine does
  // it, core/zones.ts and keywords.ts releaseAttachments). Its Forced is the enemy's text, and is not heard while it lies attached.
  { id: "101157:forced:1", cardCode: "101157", lines: ["101157:A:1"], timing: "forced", trigger: "exitedPlay", subject: "self", instructions: [{ verb: "Pick", pick: { type: "character", control: "any", ...FIRST_PLAYER } }, { verb: "AttachEnemyToPicked" }] },
  { id: "101157:constant:1", cardCode: "101157", lines: ["101157:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Sorcery" }] },
  { id: "101157:constant:2", cardCode: "101157", lines: ["101157:A:1"], timing: "constant", condition: { kind: "all", conditions: [ATTACHED, HOST_IS("character")] }, instructions: [HOST_MINUS_ONE("willpower"), HOST_MINUS_ONE("attack"), HOST_MINUS_ONE("defense")] },

  // 101158 Sinister Dungeon. Forced: when it is explored the first player reanimates a random card from their hand and deals the Dungeon to it facedown as a shadow card (with an empty hand nothing is reanimated and the Dungeon stays in the discard pile). Shadow: the top 2 cards of the encounter deck are
  // discarded and the "when revealed" effects of each Sorcery card discarded resolve.
  { id: "101158:forced:1", cardCode: "101158", lines: ["101158:A:1"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "Reanimate", from: "handRandom", ...FIRST_PLAYER }, { verb: "DealSourceAsShadow" }] },
  { id: "101158:shadow:1", cardCode: "101158", lines: ["101158:A:2"], timing: "shadow", instructions: [{ verb: "DiscardEncounterTop", count: 2 }, { verb: "ResolveWhenRevealedOf", of: "looked", trait: "Sorcery" }] },

  // 101159 Tombs of Carn Dûm. Forced: at the end of the round each player discards the top card of their deck, then reanimates it when it is an ally. Travel: 1 shadow card is dealt to each Undead enemy in play (a cost: the deck must hold one for each).
  {
    id: "101159:forced:1",
    cardCode: "101159",
    lines: ["101159:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [EACH_PLAYER([{ verb: "DiscardFromDeck", amount: 1 }]), EACH_PLAYER([{ verb: "Reanimate", from: "discardTop" }])],
  },
  { id: "101159:travel:1", cardCode: "101159", lines: ["101159:A:2"], timing: "travel", instructions: [{ verb: "DealShadowInPlay", trait: "Undead" }] },

  // 101160 Dark Halls. While it is in the staging area each Reanimated Dead has +1 Attack and +1 Defense (per copy). Shadow: a copy of the defending character in the defending player's discard pile is reanimated and dealt 1 shadow card.
  {
    id: "101160:constant:1",
    cardCode: "101160",
    lines: ["101160:A:1"],
    timing: "constant",
    condition: { kind: "sourceIn", zone: "staging" },
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, reanimated: true } },
      { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, reanimated: true } },
    ],
  },
  {
    id: "101160:shadow:1",
    cardCode: "101160",
    lines: ["101160:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "you", from: "discard", copyOfDefender: true } },
      { verb: "Reanimate", from: "card", card: "picked", when: { kind: "canPick", pick: { type: "card", control: "you", from: "discard", copyOfDefender: true } } },
      DEAL_IT_A_SHADOW,
    ],
  },

  // 101161 Unholy Crypt. +1 Threat for each Reanimated Dead in play. Shadow: if the attack destroys a character it is reanimated and dealt 1 shadow card.
  { id: "101161:constant:1", cardCode: "101161", lines: ["101161:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { count: { type: "enemy", control: "any", staging: true, reanimated: true } }, until: "whileSourceInPlay", target: "self" }] },
  { id: "101161:shadow:1", cardCode: "101161", lines: ["101161:A:2"], timing: "shadow", instructions: [REANIMATE_DESTROYED] },
  copyLine("101161:A:2", "10155:A:2"),

  // 101162 Possession. Doomed 1 is the keyword. When Revealed: the highest cost ally in play is destroyed, its controller reanimates it into the staging area and Possession attaches to it. Attached it counts as a Sorcery Condition and is discarded with the Reanimated Dead, and the Reanimated Dead with it
  // (not when the Altar's Daechanar removes it from the game).
  {
    id: "101162:whenRevealed:1",
    cardCode: "101162",
    lines: ["101162:A:2"],
    timing: "whenRevealed",
    instructions: [{ verb: "DestroyHighestCostAlly" }, { verb: "Reanimate", from: "card", to: "staging", who: "controller" }, { verb: "AttachSelfToPicked" }],
  },
  { id: "101162:constant:1", cardCode: "101162", lines: ["101162:A:2"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "ModifyStat", stat: "discardsHost", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "101162:triggered:1", cardCode: "101162", lines: ["101162:A:2"], timing: "triggered", trigger: "attachmentLeft", subject: "self", instructions: [{ verb: "DiscardOtherInPlay" }] },

  // 101163 A Fell Dread. When Revealed: the player with the highest threat attaches it to a hero they control that does not carry one. The hero's Willpower is reduced to 0 and it must commit to the quest, if able.
  { id: "101163:whenRevealed:1", cardCode: "101163", lines: ["101163:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "highestThreat" } }] },
  {
    id: "101163:constant:1",
    cardCode: "101163",
    lines: ["101163:A:1"],
    timing: "constant",
    condition: HOST_IS("hero"),
    instructions: [{ verb: "SetStat", stat: "willpower", value: 0, target: "host" }, { verb: "ModifyStat", stat: "mustCommit", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },
  { id: "101163:constant:2", cardCode: "101163", lines: ["101163:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },

  // 101164 Death and Calamity. When Revealed: it is attached to the current quest, then the first player reanimates the top X cards of their deck, X the copies of it in play. Shadow: the attacking enemy gets +X Attack, X the Sorcery cards in play.
  {
    id: "101164:whenRevealed:1",
    cardCode: "101164",
    lines: ["101164:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AttachToQuest" }, { verb: "Reanimate", from: "deckTop", count: { count: { type: "card", control: "any", names: ["Death and Calamity"], allInPlay: true } }, when: ATTACHED, ...FIRST_PLAYER }],
  },
  { id: "101164:shadow:1", cardCode: "101164", lines: ["101164:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: SORCERY_IN_PLAY }, until: "endOfAttack", target: "attacker" }] },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
