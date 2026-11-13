import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Weather Hills (Angmar Awakened part 2, campaign card 10159): the encounter cards no template reads, the two quest stages, Hunting the Orcs and Savage Counter-attack, the lines of the campaign card (the Setup) and of Mysterious Omens with its five boons.
// Every line is read from the scan ledger (data/printed/angmar-awakened.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. The Orc deck (mec108.orc-deck) is the pile `angmarOrcs`, the cards the
// scenario's data deals into `angmarOrcDeck`; its cards that are discarded go to the encounter discard pile. The side quests lie in the encounter deck (families/wilderland/night-quest.ts markSideQuests). The vocabulary the box added is in src/catalog/families/angmar.ts.
// Rules: mec108.orc-deck, mec108.time-x, mec108.side-quests, mec108.side-quests-in-play, mec108.setup-the-weather-hills, mec108.campaign-setup-the-weather-hills, mec108.campaign-mode, rr.staging, rr.reveal, rr.travel, rr.blank, rr.destroy, rr.first-player, rr.effects,
// rr.campaign-pool, ltp.permanent, faq.enemy-attacks-outside-combat (data/rules/entries.json).
const HUNTING_THE_ORCS = "09071";
const SAVAGE_COUNTER_ATTACK = "09072";
const ORC_AMBUSH = "09046";
const AMON_FORN = "09026";
const PROTECT_THE_INNOCENT = "10158";
const MYSTERIOUS_OMENS = "10160";
const BOONS = ["10161", "10162", "10163", "10164", "10165"];

const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const REFRESH_ENDS: Condition = { kind: "phase", is: "Refresh" };
// "the Mission objective": the card in play with the trait Mission (Hunting the Orcs, or Savage Counter-attack once it is flipped).
const MISSION: PickSpec = { type: "objective", control: "any", trait: "Mission" };
const MY_CHARACTER: PickSpec = { type: "character", control: "you" };
const MY_HERO: PickSpec = { type: "hero", control: "you" };
const COMMITTED: PickSpec = { type: "character", control: "any", committed: true };
const DAMAGED: PickSpec = { type: "character", control: "any", damaged: true };
// "X is the number of quest cards in play" (Ice Storm).
const X = { questCards: true } as const;
// "+1 Attack for each damaged character the defending player controls": the defending player is the shadow's actor.
const FOR_EACH_DAMAGED_CHARACTER = { count: { type: "character", control: "you", damaged: true } } as const;
// "an Orc enemy": an enemy with the trait Orc entering or returning to the staging area.
const ORC_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Orc" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ATTACKER_PLUS = (amount: number | { readonly count: PickSpec }): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker" });
// "Each player deals 1 damage to a character (a hero) he controls".
const EACH_PLAYER_DAMAGES = (pick: PickSpec, amount: number): Instruction => EACH_PLAYER([{ verb: "Pick", pick }, { verb: "DamageCard", amount, target: "picked" }]);
/** The X of Hunting the Orcs (09071:A:1), 3 more than the players: the dial and the preview of src/play read the number the record flips at from here. */
export const HUNT_FLIP_TOKENS = { players: true, plus: 3 } as const;
// "X resource tokens here" read as a count of the quest's own tokens: at least 3 more than the players.
const AT_LEAST_X_TOKENS: Condition = { kind: "not", condition: { kind: "less", left: { stat: "resources", of: "self" }, right: HUNT_FLIP_TOKENS } };

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 09025 Cornered Orc. Forced: after it engages a player it makes an immediate attack (also when put into play engaged by a search). Shadow: +1 Attack, +2 instead if the defending character is damaged.
  { id: "09025:forced:1", cardCode: "09025", lines: ["09025:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "ImmediateAttack" }] },
  {
    id: "09025:shadow:1",
    cardCode: "09025",
    lines: ["09025:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } } },
    ],
  },

  // 09026 Amon Forn (Immune to player card effects is a keyword). While it is the active location, each Orc enemy added to the staging area (revealed, searched into it, returned to it) makes an immediate attack against the first player (a shadow card is dealt:
  // faq.enemy-attacks-outside-combat). The players cannot win while it is in play (Restrict advance, as Parth Galen).
  { id: "09026:forced:1", cardCode: AMON_FORN, lines: ["09026:A:2"], timing: "forced", trigger: "addedToStaging", subject: ORC_ENEMY, condition: ACTIVE, instructions: [{ verb: "AttackFromStaging", target: "subject", who: "firstPlayer" }] },
  { id: "09026:forced:2", cardCode: AMON_FORN, lines: ["09026:A:2"], timing: "forced", trigger: "returnedToStaging", subject: ORC_ENEMY, condition: ACTIVE, instructions: [{ verb: "AttackFromStaging", target: "subject", who: "firstPlayer" }] },
  { id: "09026:constant:2", cardCode: AMON_FORN, lines: ["09026:A:3"], timing: "constant", instructions: [{ verb: "Restrict", what: "advance" }] },

  // 09027 Weathered Hilltop. +1 Threat for each resource token on it. Forced: after a Weather treachery is revealed from the encounter deck (not from the discard pile) it gets 1 resource token.
  { id: "09027:constant:1", cardCode: "09027", lines: ["09027:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { stat: "resources", of: "self" }, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "09027:forced:1",
    cardCode: "09027",
    lines: ["09027:A:2"],
    timing: "forced",
    trigger: "revealed",
    notFromDiscard: true,
    subject: { type: "treachery", control: "any", trait: "Weather" },
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }],
  },

  // 09028 Exposed Ridge. While it is the active location, at the end of the refresh phase each player deals 1 damage to a character he controls. Shadow: +1 Attack for each damaged character the defending player controls.
  { id: "09028:forced:1", cardCode: "09028", lines: ["09028:A:1"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [REFRESH_ENDS, ACTIVE] }, instructions: [EACH_PLAYER_DAMAGES(MY_CHARACTER, 1)] },
  { id: "09028:shadow:1", cardCode: "09028", lines: ["09028:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS(FOR_EACH_DAMAGED_CHARACTER)] },

  // 09029 Sheltered Valley. While it is the active location, when it is explored 1 character is healed of all its damage. Travel: remove 1 resource token from the Mission objective (a cost: the players cannot travel here while none holds a token).
  { id: "09029:response:1", cardCode: "09029", lines: ["09029:A:1"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [{ verb: "Pick", pick: DAMAGED }, { verb: "Heal", all: true, target: "picked" }] },
  { id: "09029:travel:1", cardCode: "09029", lines: ["09029:A:2"], timing: "travel", instructions: [{ verb: "Pick", pick: MISSION }, { verb: "RemoveResourceTokens", on: "picked", amount: 1 }] },

  // 09030 Concealed Orc-camp. While it is the active location, when it is explored 1 resource token goes on the Mission objective. Travel: the first player searches the encounter deck and discard pile for an Orc enemy and puts it into play engaged with him; the deck is shuffled.
  { id: "09030:response:1", cardCode: "09030", lines: ["09030:A:1"], timing: "response", trigger: "activeExplored", subject: "self", instructions: [{ verb: "Pick", pick: MISSION }, { verb: "PlaceResourceTokens", amount: 1, on: "picked" }] },
  { id: "09030:travel:1", cardCode: "09030", lines: ["09030:A:2"], timing: "travel", instructions: [{ verb: "SearchMove", trait: "Orc", type: "enemy", to: "engagedFirstPlayer" }, { verb: "ShuffleEncounterDeck" }] },

  // 09031 Ice Storm. When Revealed: each player assigns X damage among characters he controls, X the number of quest cards in play, then each damaged character (any controller) is exhausted. Shadow: the defending player assigns X damage among the characters he controls.
  { id: "09031:whenRevealed:1", cardCode: "09031", lines: ["09031:A:1"], timing: "whenRevealed", instructions: [{ verb: "AssignDamage", amount: X, pick: MY_CHARACTER, who: "eachSeat" }, { verb: "ExhaustEach", pick: DAMAGED }] },
  { id: "09031:shadow:1", cardCode: "09031", lines: ["09031:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: X, pick: MY_CHARACTER }] },

  // 09032 Find Shelter (side quest, 6 quest points; Surge is a keyword). Time 4. Forced: after the last time counter is removed each player deals 4 damage to a hero he controls; then 4 time counters are placed on it.
  { id: "09032:constant:1", cardCode: "09032", lines: ["09032:A:1"], timing: "constant", instructions: [{ verb: "Time", amount: 4 }] },
  { id: "09032:forced:1", cardCode: "09032", lines: ["09032:A:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [EACH_PLAYER_DAMAGES(MY_HERO, 4), { verb: "PlaceResourceTokens", amount: 4, on: "self" }] },

  // 09043 Angmar Orc, 09044 Angmar Marauder and 09045 Angmar Captain are Intruders in Chetwood's records (src/effects/authored/angmar-awakened/intruders-in-chetwood.ts).

  // 09052 Biting Wind. When Revealed: the first player assigns X damage among the characters committed to the quest, X the number committed. Shadow: 1 damage to the defending character.
  { id: "09052:whenRevealed:1", cardCode: "09052", lines: ["09052:A:1"], timing: "whenRevealed", instructions: [{ verb: "AssignDamage", amount: { count: COMMITTED }, pick: COMMITTED }] },
  { id: "09052:shadow:1", cardCode: "09052", lines: ["09052:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 09053 Freezing Blast (Doomed 2 is a keyword). When Revealed: each damaged character is removed from the quest. Shadow: +1 Attack for each damaged character the defending player controls.
  { id: "09053:whenRevealed:1", cardCode: "09053", lines: ["09053:A:2"], timing: "whenRevealed", instructions: [{ verb: "Each", pick: { ...COMMITTED, damaged: true }, instructions: [{ verb: "RemoveFromQuest" }] }] },
  { id: "09053:shadow:1", cardCode: "09053", lines: ["09053:A:3"], timing: "shadow", instructions: [ATTACKER_PLUS(FOR_EACH_DAMAGED_CHARACTER)] },

  // 09054 Cold from Angmar. When Revealed: each player deals 1 damage to a hero he controls; it is attached to the current quest (the side quest that is current, else the main quest card), as a Condition attachment: while it is attached the printed text box of each damaged
  // character is treated as blank, its keywords and Traits stay.
  {
    id: "09054:whenRevealed:1",
    cardCode: "09054",
    lines: ["09054:A:1"],
    timing: "whenRevealed",
    instructions: [EACH_PLAYER_DAMAGES(MY_HERO, 1), { verb: "AttachToQuest" }],
  },
  {
    id: "09054:constant:1",
    cardCode: "09054",
    lines: ["09054:A:1"],
    timing: "constant",
    condition: { kind: "not", condition: IN_STAGING },
    instructions: [
      { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: DAMAGED },
      { verb: "ModifyStat", stat: "keepsKeywords", amount: 1, until: "whileSourceInPlay", holders: DAMAGED },
    ],
  },

  // 09055 Make Camp (side quest, 6 quest points; Surge is a keyword). Characters cannot be healed while it is in the staging area. Response: after it is defeated each player heals up to 3 damage from a hero he controls.
  { id: "09055:constant:1", cardCode: "09055", lines: ["09055:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "cannotBeHealed", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
  {
    id: "09055:response:1",
    cardCode: "09055",
    lines: ["09055:A:3"],
    timing: "response",
    trigger: "questDefeated",
    subject: "self",
    instructions: [EACH_PLAYER([{ verb: "Pick", pick: { ...MY_HERO, damaged: true } }, { verb: "Heal", amount: 3, target: "picked" }])],
  },

  // 09056 Ruins of Arnor. In play (the staging area or the active location), after the When Revealed effect of a treachery card is canceled each player raises his threat by 2. Shadow: +1 Attack; if the attack destroys a character the defending player raises his threat by 2.
  {
    id: "09056:forced:1",
    cardCode: "09056",
    lines: ["09056:A:1"],
    timing: "forced",
    trigger: "whenRevealedCanceled",
    subject: { type: "treachery", control: "any" },
    condition: { kind: "any", conditions: [IN_STAGING, ACTIVE] },
    instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }],
  },
  { id: "09056:shadow:1", cardCode: "09056", lines: ["09056:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS(1), { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor", when: { kind: "x", min: 1 } }] }] },

  // 09057 Ancient Causeway. Forced: when it is explored each player raises his threat by 2.
  { id: "09057:forced:1", cardCode: "09057", lines: ["09057:A:1"], timing: "forced", trigger: "locationExplored", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },

  // 09058 Tragic Discovery. When Revealed: each player raises his threat by the Threat of the active location (0 with none). Shadow: the defending player either raises his threat by 3 or the attack is considered undefended.
  { id: "09058:whenRevealed:1", cardCode: "09058", lines: ["09058:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "activeLocation" }, who: "eachSeat" }] },
  {
    id: "09058:shadow:1",
    cardCode: "09058",
    lines: ["09058:A:2"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3, who: "actor" }] }, { id: "undefended", instructions: [{ verb: "ConsiderUndefended" }] }] }],
  },

  // 09059 Search the Ruins (side quest, 8 quest points; Surge is a keyword). Forced: at the end of the refresh phase each player raises his threat by 2. Response: after it is defeated each player reduces his threat by 3.
  { id: "09059:forced:1", cardCode: "09059", lines: ["09059:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [REFRESH_ENDS, IN_STAGING] }, instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
  { id: "09059:response:1", cardCode: "09059", lines: ["09059:A:3"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "LowerThreat", amount: 3, who: "eachSeat" }] },

  // 09069 Scattered Among the Hills. Setup: the Orc deck is shuffled and the encounter deck is shuffled (the piles set Orc Ambush and Amon Forn aside, make Exposed Ridge the active location and stage Hunting the Orcs and a Weathered Hilltop). Side B: the first Weather
  // treachery revealed each round gains surge; after the active location is explored the top card of the Orc deck is revealed for the first player and resolved as a card revealed from the encounter deck (2 cards with 3 or more players); an empty Orc deck is ignored.
  { id: "09069:setup:1", cardCode: "09069", lines: ["09069:A:1"], timing: "setup", instructions: [{ verb: "ShufflePile", pile: "angmarOrcs" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "09069:constant:1", cardCode: "09069", lines: ["09069:B:1"], timing: "constant", instructions: [{ verb: "FirstTraitSurge", trait: "Weather" }] },
  {
    id: "09069:forced:1",
    cardCode: "09069",
    lines: ["09069:B:2"],
    timing: "forced",
    trigger: "activeExplored",
    instructions: [
      { verb: "AddFromPile", pile: "angmarOrcs", to: "staging", reveal: true, who: "firstPlayer" },
      { verb: "AddFromPile", pile: "angmarOrcs", to: "staging", reveal: true, who: "firstPlayer", when: { kind: "less", left: 2, right: { players: true } } },
    ],
  },

  // 09070 Cornered Animals. When Revealed: the current phase ends once the effect has finished; the encounter discard pile and the Orc deck are shuffled into the encounter deck; Orc Ambush and Amon Forn are revealed (keywords, When Revealed) and added to the staging area. Side B: each damaged character
  // gets -1 Willpower; at the beginning of the quest phase the first player either discards 1 resource token from Savage Counter-attack or an additional encounter card is revealed this phase (an option that cannot change the game is not offered); defeating the stage wins the game.
  {
    id: "09070:whenRevealed:1",
    cardCode: "09070",
    lines: ["09070:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "EndPhase" },
      { verb: "ShuffleEncounterDiscard" },
      { verb: "ShufflePileIntoEncounterDeck", pile: "angmarOrcs" },
      { verb: "StageSetAside", code: ORC_AMBUSH, reveal: true },
      { verb: "StageSetAside", code: AMON_FORN, reveal: true },
    ],
  },
  { id: "09070:constant:1", cardCode: "09070", lines: ["09070:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "whileSourceInPlay", holders: DAMAGED }] },
  {
    id: "09070:forced:1",
    cardCode: "09070",
    lines: ["09070:B:2"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "discard", requires: { kind: "tokens", code: SAVAGE_COUNTER_ATTACK, min: 1 }, instructions: [{ verb: "RemoveResourceTokens", code: SAVAGE_COUNTER_ATTACK, amount: 1 }] },
          { id: "reveal", instructions: [{ verb: "RevealMore", amount: 1 }] },
        ],
      },
    ],
  },
  { id: "09070:constant:2", cardCode: "09070", lines: ["09070:B:3"], timing: "constant", instructions: [] },

  // 09071 Hunting the Orcs (objective, Mission). Forced: after an enemy is defeated 1 resource token goes on it; with at least X tokens (3 more than the players) it is flipped to Savage Counter-attack, tokens and all, which enters play.
  {
    id: "09071:forced:1",
    cardCode: HUNTING_THE_ORCS,
    lines: ["09071:A:1"],
    timing: "forced",
    trigger: "enemyDestroyed",
    instructions: [{ verb: "PlaceResourceTokens", amount: 1, on: "self" }, { verb: "FlipInPlace", code: HUNTING_THE_ORCS, into: SAVAGE_COUNTER_ATTACK, entersPlay: true, when: AT_LEAST_X_TOKENS }],
  },

  // 09072 Savage Counter-attack (objective, Mission). Forced: after it enters play the quest advances to stage 2A; after an enemy attacks and destroys a character 1 resource token is discarded from it; with no resource token on it the players lose the game.
  { id: "09072:forced:1", cardCode: SAVAGE_COUNTER_ATTACK, lines: ["09072:A:1"], timing: "forced", trigger: "enteredPlay", subject: "self", instructions: [{ verb: "AdvanceStage" }] },
  {
    id: "09072:forced:2",
    cardCode: SAVAGE_COUNTER_ATTACK,
    lines: ["09072:A:2"],
    timing: "forced",
    trigger: "characterDestroyedByAttack",
    subject: { type: "character", control: "any" },
    instructions: [{ verb: "RemoveResourceTokens", code: SAVAGE_COUNTER_ATTACK, amount: 1 }],
  },
  {
    id: "09072:constant:1",
    cardCode: SAVAGE_COUNTER_ATTACK,
    lines: ["09072:A:3"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "tokens", code: SAVAGE_COUNTER_ATTACK, min: 1 } },
    instructions: [{ verb: "LoseGame", reason: "Savage Counter-attack held no resource token" }],
  },

  // 10159 The Weather Hills (campaign card). Setup: Mysterious Omens joins the Campaign Pool and the encounter deck; Protect the Innocent is added to the staging area with the damage the Campaign Log noted for it (after the quest card's Setup). Its Resolution is in the box's
  // campaign file (angmar-awakened.ts).
  {
    id: "10159:campaignSetup:1",
    cardCode: "10159",
    lines: ["10159:A:2"],
    timing: "campaignSetup",
    instructions: [{ verb: "AddToPool", code: MYSTERIOUS_OMENS }, { verb: "ShuffleIntoEncounterDeck", code: MYSTERIOUS_OMENS }, { verb: "AddToStaging", code: PROTECT_THE_INNOCENT }, { verb: "PlaceLoggedDamageOn", code: PROTECT_THE_INNOCENT }],
  },

  // 10160 Mysterious Omens (side quest, 9 quest points; Surge is a keyword). Forced: after it becomes the current quest each player discards 1 card at random from his hand. When it is defeated it leaves the Campaign Pool, and starting with the first player each player may
  // choose 1 of the five boons not yet taken and attach it to a hero he controls (the Resolution records the boons with their heroes).
  { id: "10160:forced:1", cardCode: MYSTERIOUS_OMENS, lines: ["10160:A:2"], timing: "forced", trigger: "becameCurrentQuest", subject: "self", instructions: [EACH_PLAYER([{ verb: "DiscardRandomFromHand" }])] },
  { id: "10160:forced:2", cardCode: MYSTERIOUS_OMENS, lines: ["10160:A:3"], timing: "forced", trigger: "questDefeated", subject: "self", instructions: [{ verb: "RemoveFromCampaignPool" }, { verb: "ChooseBoon", codes: BOONS }] },

  // The five boons (Permanent is a keyword; the Setup that attaches each to a hero is a template, except Cunning's, which also adds 2 resources to that hero's pool). Each Action or Response is limited to once per game.
  // 10161 Cunning. Action: attached hero gets +2 Willpower, +2 Attack and +2 Defense until the end of the phase.
  { id: "10161:setup:1", cardCode: "10161", lines: ["10161:A:2"], timing: "setup", instructions: [{ verb: "AttachSelf", to: { kind: "hero" } }, { verb: "AddResources", amount: 2, to: "host" }] },
  {
    id: "10161:action:1",
    cardCode: "10161",
    lines: ["10161:A:3"],
    timing: "action",
    limit: "oncePerGame",
    instructions: [
      { verb: "ModifyStat", stat: "willpower", amount: 2, until: "endOfPhase", target: "host" },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", target: "host" },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", target: "host" },
    ],
  },
  // 10162 Hardy. Attached hero gets +2 hit points. Action: ready attached hero.
  { id: "10162:constant:1", cardCode: "10162", lines: ["10162:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "hitPoints", amount: 2, until: "whileSourceInPlay", target: "host" }] },
  { id: "10162:action:1", cardCode: "10162", lines: ["10162:A:4"], timing: "action", limit: "oncePerGame", instructions: [{ verb: "Ready", target: "host" }] },
  // 10163 Resolute. Response: cancel up to 2 points of damage just dealt to attached hero.
  { id: "10163:response:1", cardCode: "10163", lines: ["10163:A:4"], timing: "response", trigger: "damageDealt", subject: "host", limit: "oncePerGame", instructions: [{ verb: "CancelDamage", amount: 2 }] },
  // 10164 Ruthless. Action: move any amount of damage from attached hero to an enemy engaged with you.
  {
    id: "10164:action:1",
    cardCode: "10164",
    lines: ["10164:A:4"],
    timing: "action",
    limit: "oncePerGame",
    condition: { kind: "all", conditions: [{ kind: "canPick", pick: { type: "hero", control: "you", isHost: true, damaged: true } }, { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you" } }] },
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "you", isHost: true, damaged: true } },
      { verb: "ChooseX", min: 1, max: [{ stat: "damage", of: "picked" }] },
      { verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you" } },
      { verb: "MoveDamage", amount: { x: true } },
    ],
  },
  // 10165 Stalwart. Planning Action: the host's controller may play an attachment from their discard pile on attached hero (the permission lasts the phase and is used up by the play).
  {
    id: "10165:action:1",
    cardCode: "10165",
    lines: ["10165:A:4"],
    timing: "action",
    limit: "oncePerGame",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "ModifyStat", stat: "attachmentFromDiscard", amount: 1, until: "endOfPhase", target: "host" }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
