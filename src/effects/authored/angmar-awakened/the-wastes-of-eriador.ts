import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { DETERMINATION } from "./angmar-awakened.ts";
import { AUTHORED_EFFECTS as SIEGE } from "../return-of-the-king/the-siege-of-gondor.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Wastes of Eriador (Angmar Awakened part 4, campaign card 10171): the Time objective (Daybreak and Nightfall, one double-sided card), the three quest stages, Amarthiúl and Pack Leader, the ten encounter cards of the set, and Determination and
// Fend Off Despair of the pool. Every line is read from the scan ledger (data/printed/angmar-awakened.json); a line a template already writes (pnpm data build) needs no record here. The Time objective is the card whose code is Daybreak (10011) or Nightfall (10012) while it
// shows that side: the flip swaps the two codes, so each side's lines are heard only while that side is up (families/angmar/day-night.ts). The Eriador Wilds and Foul Weather cards are the records of Intruders in Chetwood and The Weather Hills; the campaign card's Setup and
// Resolution are the shell's (angmar-awakened.ts). The vocabulary the box added is in src/catalog/families/angmar.ts, deck.ts and burden.ts.
// Rules: mec108.day-and-night, mec108.objective-allies, mec108.immune, mec108.side-quests-in-play, mec108.campaign-mode, rr.reveal, rr.first-player, rr.forced, rr.travel, rr.optional-engagement, rr.keywords, rr.doomed-x, rr.cancel, rr.active-location, rr.engagement-check,
// rr.the-word-choose, rr.running-out-of-cards, rr.attachment-cards, faq.triggering-forced-effects, faq.lasting-effects, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.next-player, faq.progress-without-advancing (data/rules/entries.json).
const DAYBREAK = "10011";
const PACK_LEADER = "10017";

const DAY: Condition = { kind: "timeOfDay", is: "day" };
const NIGHT: Condition = { kind: "timeOfDay", is: "night" };
const NOT_NIGHT: Condition = { kind: "not", condition: NIGHT };
const ATTACHED: Condition = { kind: "sourceIn", zone: "attached" };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const WARG_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Warg" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ATTACKER_PLUS = (amount: number, when?: Condition): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });
// "Discard 1 non-objective ally from play": the first player chooses among the allies of every player (Amarthiúl, an objective, is not one); with none left nothing is discarded.
const ALLY_TO_DISCARD: PickSpec = { type: "ally", control: "any", who: "firstPlayer", nonObjective: true };
const THREE_PLAYERS: Condition = { kind: "count", pick: { type: "player", control: "any" }, min: 3 };
// The `count`th ally of the Forced effect: the first is discarded always, the second only with 3 or more players.
const DISCARD_ALLY = (count: 1 | 2): Instruction[] => {
  const when: Condition = count === 2 ? { kind: "all", conditions: [{ kind: "canPick", pick: ALLY_TO_DISCARD }, THREE_PLAYERS] } : { kind: "canPick", pick: ALLY_TO_DISCARD };
  return [{ verb: "Pick", pick: ALLY_TO_DISCARD, when }, { verb: "Discard", target: { kind: "picked" }, when }];
};
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const WARGS_ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", engaged: "you", trait: "Warg" };
const UNIQUE_CHARACTER: PickSpec = { type: "character", control: "any", unique: true };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 10011 Daybreak / 10012 Nightfall (objective, one card: Daybreak faceup is Day, Nightfall faceup is Night). Day: enemies do not make engagement checks (an optional engagement and an effect's engagement are not checks); each enemy engaged with a player returns to the
  // staging area when it becomes Day. Night: no progress is placed on quest cards (the active location still takes it), encounter card effects cannot be canceled, and an encounter card is revealed (by the first player) when it becomes Night. Both: the objective flips at the
  // end of each round (once: the other side's Forced effect was not heard at that moment, faq.triggering-forced-effects).
  { id: "10011:constant:1", cardCode: DAYBREAK, lines: ["10011:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "10011:forced:1", cardCode: DAYBREAK, lines: ["10011:A:2"], timing: "forced", trigger: "becameDay", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }] },
  { id: "10011:forced:2", cardCode: DAYBREAK, lines: ["10011:A:3"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "FlipTimeObjective", to: "other" }] },
  copyLine("10011:A:3", "10012:A:3"),
  { id: "10012:constant:1", cardCode: "10012", lines: ["10012:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "10012:constant:2", cardCode: "10012", lines: ["10012:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "encounterUncancelable", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: "10012:forced:1", cardCode: "10012", lines: ["10012:A:2"], timing: "forced", trigger: "becameNight", instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },

  // 10013 Across the Wastes (1A/1B). Setup: Pack Leader is set aside, Shrouded Hills is the active location and Daybreak is in the staging area faceup (the piles of the scenario); the first player takes control of Amarthiúl, the encounter deck is shuffled and each player
  // reveals 1 card. 1B: while it is Day each hero gets +1 Willpower; when it becomes Night each player raises their threat by 1.
  { id: "10013:setup:1", cardCode: "10013", lines: ["10013:A:1"], timing: "setup", instructions: [{ verb: "PutSetAsideInPlay", name: "Amarthiúl", to: "firstPlayer" }, { verb: "ShuffleEncounterDeck" }, EACH_PLAYER([{ verb: "RevealEncounter" }])] },
  { id: "10013:constant:1", cardCode: "10013", lines: ["10013:B:1"], timing: "constant", condition: DAY, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "heroes" }] },
  { id: "10013:forced:1", cardCode: "10013", lines: ["10013:B:2"], timing: "forced", trigger: "becameNight", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },

  // 10014 Howling at Night (2A/2B). When Revealed: the encounter discard pile is shuffled in, cards come off the top until as many Warg enemies as players are discarded, and each is added to the staging area (not revealed). 2B: when it becomes Day each player draws 1 card;
  // when it becomes Night 1 non-objective ally (2 with 3 or more players) is discarded from play, chosen by the first player among every player's.
  { id: "10014:whenRevealed:1", cardCode: "10014", lines: ["10014:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, trait: "Warg", to: "staging" }] },
  { id: "10014:forced:1", cardCode: "10014", lines: ["10014:B:1"], timing: "forced", trigger: "becameDay", instructions: [EACH_PLAYER([{ verb: "Draw", amount: 1 }])] },
  { id: "10014:forced:2", cardCode: "10014", lines: ["10014:B:2"], timing: "forced", trigger: "becameNight", instructions: [...DISCARD_ALLY(1), ...DISCARD_ALLY(2)] },

  // 10015 Battle with the Pack (3A/3B). When Revealed: the Time objective flips to Nightfall, Pack Leader is added to the staging area, and as 2A with 1 fewer Warg than players (none alone: the pile is only shuffled in). 3B: Pack Leader cannot take damage unless 5 or more progress is on
  // this stage; when it becomes Day all progress on the stage is discarded; the stage cannot be defeated while Pack Leader is in play, and the players win when he is destroyed.
  { id: "10015:whenRevealed:1", cardCode: "10015", lines: ["10015:A:1"], timing: "whenRevealed", instructions: [{ verb: "FlipTimeObjective", to: "night" }, { verb: "AddSetAsideToStaging", code: PACK_LEADER }, { verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntilEnemies", perPlayer: 1, less: 1, trait: "Warg", to: "staging" }] },
  { id: "10015:constant:1", cardCode: "10015", lines: ["10015:B:1"], timing: "constant", condition: { kind: "not", condition: { kind: "stageProgress", min: 5 } }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["Pack Leader"] } }] },
  { id: "10015:forced:1", cardCode: "10015", lines: ["10015:B:2"], timing: "forced", trigger: "becameDay", instructions: [{ verb: "RemoveAllQuestProgress", of: "stage" }] },
  { id: "10015:constant:2", cardCode: "10015", lines: ["10015:B:3"], timing: "constant", condition: { kind: "inPlay", code: PACK_LEADER, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "10015:forced:2", cardCode: "10015", lines: ["10015:B:3"], timing: "forced", trigger: "enemyDestroyed", subject: { type: "enemy", control: "any", names: ["Pack Leader"] }, instructions: [{ verb: "WinGame" }] },

  // 10016 Amarthiúl (objective ally). Response: after an enemy engages a player other than his controller, control of him goes to that player (optional, like any Response).
  { id: "10016:response:1", cardCode: "10016", lines: ["10016:A:1"], timing: "response", trigger: "engaged", eventSeat: "other", instructions: [{ verb: "ChangeControl", to: "eventSeat" }] },

  // 10017 Pack Leader (enemy, Warg, set aside). Cannot be optionally engaged. Forced: after he engages you, exhaust a character you control for each Warg enemy engaged with you (himself included: at least one).
  // (110077:A:3 prints the same line, but 10017:A:1 is a generated record of this card, so the copy would take its number: written out.)
  { id: "10017:constant:2", cardCode: PACK_LEADER, lines: ["10017:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay" }] },
  { id: "10017:forced:1", cardCode: PACK_LEADER, lines: ["10017:A:3"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Repeat", times: { count: WARGS_ENGAGED_WITH_YOU }, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] }] },

  // 10018 Northern Warg. When Revealed: each Warg enemy gets +1 Threat until the end of the phase (the ones that enter play later in the phase too: a lasting effect of an encounter card, faq.lasting-effects). Shadow: after this attack the attacking enemy engages the next player
  // and makes an immediate attack (a new shadow card is dealt); with one player there is no next player.
  { id: "10018:whenRevealed:1", cardCode: "10018", lines: ["10018:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "endOfPhase", target: "enemies", trait: "Warg" }] },
  { id: "10018:shadow:1", cardCode: "10018", lines: ["10018:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "EngageNextPlayer", when: { kind: "otherPlayer" } }, { verb: "ImmediateAttack", when: { kind: "otherPlayer" } }] }] },

  // 10019 Blood-thirsty Warg. While it is in the staging area: Forced, when it becomes Night it engages the first player and makes an immediate attack (a shadow card is dealt).
  { id: "10019:forced:1", cardCode: "10019", lines: ["10019:A:1"], timing: "forced", trigger: "becameNight", condition: IN_STAGING, instructions: [{ verb: "Engage", target: "self" }, { verb: "ImmediateAttack", when: { kind: "sourceIn", zone: "engaged" } }] },

  // 10020 Hunting Pack. While a player makes an engagement check against it, it gets -1 engagement cost for each damaged character that player controls (families/angmar/check-cost.ts).
  { id: "10020:constant:2", cardCode: "10020", lines: ["10020:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "checkCostPerDamaged", amount: -1, until: "whileSourceInPlay" }] },

  // 10021 White Warg. Forced: after it engages you, 1 damage to a character you control (2 at Night). Shadow: at Night the attacking enemy makes an additional attack after this one.
  { id: "10021:forced:1", cardCode: "10021", lines: ["10021:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "DamageCard", amount: 1, target: "picked", when: NOT_NIGHT }, { verb: "DamageCard", amount: 2, target: "picked", when: NIGHT }] },
  { id: "10021:shadow:1", cardCode: "10021", lines: ["10021:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ImmediateAttack", when: NIGHT }] }] },

  // 10022 Wolf of Angmar (Surge). While it is Night it gets +2 Attack. Shadow: the attacking enemy gets +1 Attack (+2 at Night).
  { id: "10022:constant:1", cardCode: "10022", lines: ["10022:A:2"], timing: "constant", condition: NIGHT, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay" }] },
  { id: "10022:shadow:1", cardCode: "10022", lines: ["10022:A:3"], timing: "shadow", instructions: [ATTACKER_PLUS(1, NOT_NIGHT), ATTACKER_PLUS(2, NIGHT)] },

  // 10023 Eriador Wastes (location). While it is in the staging area no more than 5 progress can be placed on the current quest each round (the active location's progress is not counted). Travel: the first player engages a Warg enemy in the staging area and deals it a shadow card.
  { id: "10023:constant:1", cardCode: "10023", lines: ["10023:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "questProgressCap", amount: 5, until: "whileSourceInPlay", target: "table" }] },
  { id: "10023:travel:1", cardCode: "10023", lines: ["10023:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: { ...WARG_IN_STAGING, who: "firstPlayer" } }, { verb: "Engage", target: "picked" }, { verb: "DealShadowTo", target: "picked" }] },

  // 10024 Warg's Den (location, immune to player card effects: the build). Travel: the first player searches the encounter deck and discard pile for a Warg enemy, reveals it and puts it into play engaged with him; the encounter deck is shuffled.
  { id: "10024:travel:1", cardCode: "10024", lines: ["10024:A:2"], timing: "travel", instructions: [{ verb: "SearchReveal", trait: "Warg", type: "enemy", who: "actor", to: "engaged", cost: true }, { verb: "ShuffleEncounterDeck" }] },

  // 10025 North Downs (location). While it is Night it gets +2 Threat. Shadow: the attacking enemy gets +1 Attack; if this attack destroys a character, all progress is removed from the current quest.
  { id: "10025:constant:1", cardCode: "10025", lines: ["10025:A:1"], timing: "constant", condition: NIGHT, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay" }] },
  { id: "10025:shadow:1", cardCode: "10025", lines: ["10025:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS(1), { verb: "AfterAttack", instructions: [{ verb: "RemoveAllQuestProgress", when: { kind: "x", min: 1 } }] }] },

  // 10026 Sudden Darkness (treachery, Weather). When Revealed: at Night each player raises their threat by 4; at Day the Time objective flips to Nightfall. Shadow: the topmost Warg enemy of the discard pile enters play engaged with you and is dealt a shadow card.
  { id: "10026:whenRevealed:1", cardCode: "10026", lines: ["10026:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: 4, who: "eachSeat", when: NIGHT }, { verb: "FlipTimeObjective", to: "night", when: DAY }] },
  { id: "10026:shadow:1", cardCode: "10026", lines: ["10026:A:2"], timing: "shadow", instructions: [{ verb: "PutTopmostFromEncounterDiscard", type: "enemy", trait: "Warg", dealShadow: true }] },

  // 10027 Predatory Wolves (treachery). When Revealed: each player (the first player first) either discards the highest cost ally they control (an ally with no printed cost counts 0) or searches the encounter deck and discard pile for a Warg enemy, reveals it and adds it to the staging
  // area; then the encounter deck is shuffled. Shadow: exhaust a character you control (copied).
  { id: "10027:whenRevealed:1", cardCode: "10027", lines: ["10027:A:1"], timing: "whenRevealed", instructions: [
    EACH_PLAYER([{ verb: "Choose", who: "actor", options: [
      { id: "discard", requires: { kind: "canPick", pick: { type: "ally", control: "you", highestCost: true } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", highestCost: true } }, { verb: "Discard", target: { kind: "picked" } }] },
      { id: "search", instructions: [{ verb: "SearchReveal", trait: "Warg", type: "enemy", who: "actor", to: "staging" }] },
    ] }]),
    { verb: "ShuffleEncounterDeck" }] },
  copyLine("145042:A:3", "10027:A:2"),

  // 10172 Determination (event, Action). Attach it to a unique character in play (any controller's hero or unique ally; any number of copies may be attached to one card), where it stays as a Condition attachment; then ready each character with a Determination attached and each character the Campaign Log marks "determined".
  // The Forced "if you win this scenario, mark ... determined" is read by the Resolution (RecordDetermined, run by the campaign card's record in angmar-awakened.ts) for a Determination still attached to a character in play.
  // The Action is the play of the event, from the hand or from the top of the deck (Gandalf, 142002:A:1): once it is attached it is in play as a Condition attachment, and its Action is not used again from the character
  // (the event's cost would discard it).
  { id: "10172:action:1", cardCode: DETERMINATION, lines: ["10172:A:1"], timing: "action", condition: { kind: "not", condition: { kind: "sourceIn", zone: "play" } }, instructions: [
    { verb: "Pick", pick: UNIQUE_CHARACTER },
    { verb: "AttachSelfToPicked", unlimited: true },
    // "Then, ready ...": only when the attach happened (rr.then), so with no unique character to attach to nothing is readied.
    { verb: "Each", pick: { type: "character", control: "any", hasAttachment: { names: ["Determination"] } }, instructions: [{ verb: "Ready", target: "picked" }], when: ATTACHED },
    { verb: "Each", pick: { type: "character", control: "any", determined: true }, instructions: [{ verb: "Ready", target: "picked" }], when: ATTACHED }] },
  { id: "10172:constant:1", cardCode: DETERMINATION, lines: ["10172:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },

  // 10173 Fend Off Despair (encounter side quest). Each event card gains doomed 1 (every player raises their threat by 1 more when one is played). Forced: when it is defeated, each player's starting threat is reduced by 2 in the Campaign Log (cumulative, written when the scenario is won).
  { id: "10173:constant:1", cardCode: "10173", lines: ["10173:A:1"], timing: "constant", instructions: [{ verb: "GainsDoomed", amount: 1, pick: { type: "card", control: "any", cardType: "event" } }] },
  { id: "10173:forced:1", cardCode: "10173", lines: ["10173:A:2"], timing: "forced", trigger: "questDefeated", subject: "self", instructions: [{ verb: "RecordStartingThreat", amount: -2 }] },
], { pool: SIEGE });

export const AUTHORED_REPLACES: readonly string[] = [];
