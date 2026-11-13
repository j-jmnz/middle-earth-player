import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as WASTES } from "./the-wastes-of-eriador.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Across the Ettenmoors (Angmar Awakened part 6, campaign card 10182): the three quest stages, Amarthiúl, the four safe objective-locations, the twelve encounter cards of the set and the Losing Time burden (10183). Every line is read from the scan ledger
// (data/printed/angmar-awakened.json); a line a template already writes (pnpm data build) needs no record here. The Eriador Wilds and Foul Weather cards are the records of Intruders in Chetwood and The Weather Hills. The vocabulary the box added is in src/catalog/families/angmar.ts
// (the Safe keyword and what a safe location does, the reveal of a discarded side quest, the Losing Time clock) and in the families it reuses (objectives: Guarded; encounter: DiscardUntil; sidequests; costs).
// Rules: mec108.safe, mec108.objective-locations, mec108.side-quests-in-play, mec108.objective-allies, mec108.immune, mec108.campaign-setup-across-the-ettenmoors, mec108.campaign-mode, rr.guarded, rr.active-location, rr.travel, rr.reveal, rr.surge, rr.doomed-x, rr.search,
// rr.first-player, rr.forced, rr.effects, rr.the-word-choose, rr.blank, rr.damage, rr.hit-points, rr.step-6-4-2, rr.running-out-of-cards, rr.in-play-and-out-of-play, rr.optional-engagement, faq.simultaneous-effects, faq.triggering-forced-effects, faq.lasting-effects,
// faq.additional-attacks, faq.progress-without-advancing (data/rules/entries.json).
const STAGE_1 = "10064";
const LOSING_TIME = "10183";
const SAFE_LOCATIONS = ["10068", "10069", "10070", "10071"];
const SIDE_QUESTS = ["10081", "10082", "10083"];

const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const PHASE_QUEST: Condition = { kind: "phase", is: "Quest" };
const NO_SAFE: Condition = { kind: "safeActive", is: false };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ATTACKER_PLUS = (stat: "attack" | "defense", amount: Extract<Instruction, { verb: "ModifyStat" }>["amount"], when?: Condition): Instruction => ({ verb: "ModifyStat", stat, amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });
const MY_DAMAGED_CHARACTERS = { count: { type: "character", control: "you", damaged: true } } as const;
// An encounter side quest in play: the staging area holds each, a guard attached to a location and the current quest among them (mec108.side-quests-in-play).
const ENCOUNTER_SIDE_QUEST: PickSpec = { type: "card", control: "any", cardType: "encounter-side-quest" };
const ENEMY_IN_STAGING: PickSpec = { type: "enemy", control: "any", stagingOnly: true };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const NO_REST_FREE: NonNullable<PickSpec["hasAttachment"]> = { names: ["No Rest"], none: true };
const EXHAUSTED_HERO_WITHOUT: PickSpec = { type: "hero", control: "any", state: "exhausted", who: "firstPlayer", hasAttachment: NO_REST_FREE };
const READY_HERO_WITHOUT: PickSpec = { type: "hero", control: "any", state: "ready", who: "firstPlayer", hasAttachment: NO_REST_FREE };
const TROLL_OR_GIANT_FOUND: Condition = { kind: "any", conditions: [{ kind: "searchable", trait: "Troll", type: "enemy" }, { kind: "searchable", trait: "Giant", type: "enemy" }] };
const ENEMY_ABOVE_THREAT: PickSpec = { type: "enemy", control: "any", stagingOnly: true, aboveThreat: true };

// The Safe keyword and its effects on one of the four objective-locations (mec108.safe, mec108.objective-locations). "Guarded. Safe." (A:1): the Guarded keyword reveals the next card of the encounter deck as its guard when the location is revealed from the deck, and Safe is the marker
// the engine reads (`Safe`). While the location is the active location: enemies make no engagement checks, the "when revealed" effects of treacheries are ignored (the treachery is still revealed and keeps its keywords), and the text boxes of encounter side quests are blank. When the players
// travel to it, every engaged enemy returns to the staging area; at the end of the quest phase it is added to the victory display. The A:3 Response is the card's own.
const safeLocation = (code: string): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "GuardObjective" }] },
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "Safe" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: `${code}:constant:3`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "treacheryRevealIgnored", amount: 1, until: "whileSourceInPlay", target: "table" }] },
  { id: `${code}:constant:4`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: ENCOUNTER_SIDE_QUEST }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:1`], timing: "forced", trigger: "traveled", instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", who: "each", pick: "all" } }] },
  { id: `${code}:forced:2`, cardCode: code, lines: [`${code}:A:1`], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [PHASE_QUEST, ACTIVE] }, instructions: [{ verb: "AddToVictory", target: "self" }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 10064 Into the Ettenmoors (1A/1B). Setup: a random side quest guards a random safe location, both in the staging area, the other side quests and safe locations are shuffled into the encounter deck (the Trollspawn per player are dealt staged) and the first player takes control of Amarthiúl.
  // 1B: at the beginning of the quest phase with no encounter side quest in play, cards are discarded until a side quest is, which is revealed and added to the staging area (with none in the deck it runs out); when a side quest is defeated its printed quest points are placed on this stage.
  { id: "10064:setup:1", cardCode: STAGE_1, lines: ["10064:A:1"], timing: "setup", instructions: [
    { verb: "StageRandomGuardedPair" },
    ...[...SIDE_QUESTS, ...SAFE_LOCATIONS].map((code): Instruction => ({ verb: "ShuffleSetAsideIntoEncounterDeck", code })),
    { verb: "ShuffleEncounterDeck" },
    { verb: "PutSetAsideInPlay", name: "Amarthiúl", to: "firstPlayer" }] },
  { id: "10064:forced:1", cardCode: STAGE_1, lines: ["10064:B:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "all", conditions: [PHASE_QUEST, { kind: "count", pick: ENCOUNTER_SIDE_QUEST, max: 0 }] }, instructions: [{ verb: "DiscardUntil", type: "encounter-side-quest" }, { verb: "RevealCard" }] },
  { id: "10064:forced:2", cardCode: STAGE_1, lines: ["10064:B:2"], timing: "forced", trigger: "questCardDefeated", subject: { type: "card", control: "any", cardType: "encounter-side-quest" }, instructions: [{ verb: "AddStageProgress", amount: { stat: "questPoints", of: "subject", printed: true } }] },
  { id: "10064:forced:3", cardCode: STAGE_1, lines: ["10064:B:2"], timing: "forced", trigger: "questCardDefeated", subject: { type: "card", control: "any", cardType: "player-side-quest" }, instructions: [{ verb: "AddStageProgress", amount: { stat: "questPoints", of: "subject", printed: true } }] },

  // 10065 A Miserable Journey (2A/2B). When Revealed: the encounter discard pile is shuffled into the encounter deck, cards are discarded until a side quest is, and it is revealed and added to the staging area, if able. 2B: one more card is revealed in the quest phase unless a safe location is active.
  { id: "10065:whenRevealed:1", cardCode: "10065", lines: ["10065:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "DiscardUntil", type: "encounter-side-quest" }, { verb: "RevealCard" }] },
  { id: "10065:forced:1", cardCode: "10065", lines: ["10065:B:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "all", conditions: [PHASE_QUEST, NO_SAFE] }, instructions: [{ verb: "RevealMore", amount: 1 }] },
  // 10066 Journey's End (3A/3B). The same When Revealed. 3B: each damaged character gets -2 Willpower unless a safe location is active; defeating the stage wins the game.
  copyLine("10065:A:1", "10066:A:1"),
  { id: "10066:constant:1", cardCode: "10066", lines: ["10066:B:1"], timing: "constant", condition: NO_SAFE, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -2, until: "whileSourceInPlay", holders: { type: "character", control: "any", damaged: true } }] },

  { id: "10066:questResolution:1", cardCode: "10066", lines: ["10066:B:2"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

  // 10067 Amarthiúl (objective ally, set aside until the Setup of 10064). Response: after an enemy engages a player, control of him goes to that player (as 10016, The Wastes of Eriador).
  copyLine("10016:A:1", "10067:A:1"),

  // 10068 Secluded Cave, 10069 The Hoarwell, 10070 Abandoned Camp, 10071 Patch of Woods (objective-locations, Guarded and Safe, Immune to player card effects). Response: after you travel to the location, each player draws 3 cards (Secluded Cave); heal 1 damage from each character in
  // play (The Hoarwell); each player may return 1 card from their discard pile to their hand (Abandoned Camp); each player adds 1 resource to each of their heroes' pools (Patch of Woods).
  ...SAFE_LOCATIONS.flatMap(safeLocation),
  { id: "10068:response:1", cardCode: "10068", lines: ["10068:A:3"], timing: "response", trigger: "traveled", instructions: [EACH_PLAYER([{ verb: "Draw", amount: 3 }])] },
  { id: "10069:response:1", cardCode: "10069", lines: ["10069:A:3"], timing: "response", trigger: "traveled", instructions: [{ verb: "Each", pick: { type: "character", control: "any" }, instructions: [{ verb: "Heal", amount: 1, target: "picked" }] }] },
  { id: "10070:response:1", cardCode: "10070", lines: ["10070:A:3"], timing: "response", trigger: "traveled", instructions: [EACH_PLAYER([{ verb: "Choose", who: "actor", options: [
    { id: "return", requires: { kind: "canPick", pick: { type: "card", control: "you", from: "discard" } }, instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "discard" } }, { verb: "MovePicked", to: "hand" }] },
    { id: "skip", instructions: [] },
  ] }])] },
  { id: "10071:response:1", cardCode: "10071", lines: ["10071:A:3"], timing: "response", trigger: "traveled", instructions: [EACH_PLAYER([{ verb: "HeroesGainResources", amount: 1 }])] },

  // 10072 Savage Trollspawn. While engaged it gets +1 Attack for each damaged character (hero or ally) the engaged player controls. Shadow: the attacking enemy gets +1 Attack for each damaged character the defending player controls (counted as the shadow resolves).
  { id: "10072:constant:1", cardCode: "10072", lines: ["10072:A:1"], timing: "constant", condition: { kind: "sourceIn", zone: "engaged" }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: MY_DAMAGED_CHARACTERS, until: "whileSourceInPlay" }] },
  { id: "10072:shadow:1", cardCode: "10072", lines: ["10072:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS("attack", MY_DAMAGED_CHARACTERS)] },

  // 10073 Coldfell Giant. Forced: after it engages you, 1 damage to each of 3 different characters you control (each one, with fewer than 3). Shadow: if the defending character has damage on it, the attacking enemy makes an additional attack after this one.
  { id: "10073:forced:1", cardCode: "10073", lines: ["10073:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "Repeat", times: 3, instructions: [
    // One round: the engaged player picks a character not yet hit and it takes 1 damage; with none left to pick the round does nothing (rr.effects: as much as able). The damage sits in the option so it is gated on this round's pick, not on a later one.
    { verb: "Choose", who: "actor", options: [{ id: "hit", requires: { kind: "canPick", pick: { type: "character", control: "you", different: true } }, instructions: [{ verb: "Pick", pick: { type: "character", control: "you", different: true } }, { verb: "DamageCard", amount: 1, target: "picked" }] }] }] }] },
  { id: "10073:shadow:1", cardCode: "10073", lines: ["10073:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: true } }, instructions: [{ verb: "ImmediateAttack" }] }] },

  // 10074 Cruel Mountain-troll. Each point of excess combat damage it deals takes 1 progress from each quest card in play (families/defense/excess.ts).
  { id: "10074:constant:1", cardCode: "10074", lines: ["10074:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "excessToEachQuest", amount: 1, until: "whileSourceInPlay" }] },

  // 10075 Ruthless Hill-troll. +2 Attack and +2 Defense while it has 3 or more damage. Shadow: the defending player chooses a location with the safe keyword in play and shuffles it (not its guard) into the encounter deck.
  { id: "10075:constant:1", cardCode: "10075", lines: ["10075:A:1"], timing: "constant", condition: { kind: "matches", card: "self", pick: { type: "enemy", control: "any", minDamage: 3 } }, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "defense", amount: 2, until: "whileSourceInPlay" }] },
  { id: "10075:shadow:1", cardCode: "10075", lines: ["10075:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "objective", control: "any", safe: true } }, { verb: "ReleaseGuards" }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }] },

  // 10076 Goblin Pursuer. Damaged characters cannot be declared as attackers or defenders against it (checked at the declaration). Shadow: +1 Attack, +3 instead if the attack is undefended (a template writes it).
  { id: "10076:constant:1", cardCode: "10076", lines: ["10076:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damagedCannotFace", amount: 1, until: "whileSourceInPlay" }] },

  // 10077 Troll-fells (location). While it is the active location, Weather cards gain Doomed 1 (on top of a printed Doomed). When Revealed: unless it is revealed guarding a safe location, the first player searches the encounter deck and discard pile for a location with the safe keyword
  // (the safe filter keeps the pool objectives out) and adds it to the staging area, guarded by Troll-fells; the encounter deck is shuffled.
  { id: "10077:constant:1", cardCode: "10077", lines: ["10077:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "GainsDoomed", amount: 1, pick: { type: "treachery", control: "any", trait: "Weather" } }] },
  { id: "10077:whenRevealed:1", cardCode: "10077", lines: ["10077:A:2"], timing: "whenRevealed", condition: { kind: "not", condition: { kind: "matches", card: "self", pick: { type: "location", control: "any", guardsObjectiveLocation: true } } }, instructions: [
    { verb: "SearchMove", type: "objective", safe: true, to: "staging", remember: true }, { verb: "AttachGuard", guard: "self", to: "picked" }, { verb: "ShuffleEncounterDeck" }] },

  // 10078 Barren Moorland (location). While in the staging area it has the Forced effect: when an ally enters play, its controller exhausts it or deals it 1 damage. Travel: 1 damage to each exhausted character.
  { id: "10078:forced:1", cardCode: "10078", lines: ["10078:A:1"], timing: "forced", trigger: "enteredPlay", subject: { type: "ally", control: "any" }, condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "Choose", who: "actor", options: [
    { id: "exhaust", requires: { kind: "matches", card: "subject", pick: { type: "ally", control: "any", state: "ready" } }, instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "subject" } }] },
    { id: "damage", instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] },
  ] }] },
  { id: "10078:travel:1", cardCode: "10078", lines: ["10078:A:2"], timing: "travel", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", state: "exhausted" } }] },

  // 10079 Arador's Bane (treachery). When Revealed: each player in turn either engages an enemy in the staging area with a higher engagement cost than their threat, or searches the encounter deck and discard pile for a Troll or Giant enemy and adds it to the staging area (the deck is shuffled);
  // each enemy engaged this way is dealt 2 shadow cards.
  { id: "10079:whenRevealed:1", cardCode: "10079", lines: ["10079:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Choose", who: "actor", options: [
    { id: "engage", requires: { kind: "canPick", pick: ENEMY_ABOVE_THREAT }, instructions: [{ verb: "Pick", pick: ENEMY_ABOVE_THREAT }, { verb: "Engage", target: "picked" }, { verb: "DealShadowTo", target: "picked" }, { verb: "DealShadowTo", target: "picked" }] },
    { id: "search", requires: TROLL_OR_GIANT_FOUND, instructions: [{ verb: "SearchMove", traits: ["Troll", "Giant"], type: "enemy", to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
  ] }])] },

  // 10080 No Rest (treachery, a Condition attachment). When Revealed: attach it to an exhausted hero (the first player chooses among every player's heroes without one), else to a ready hero without one. Attached hero cannot ready and collects no resources in the resource phase.
  // Discarded when the players travel to a safe location.
  { id: "10080:whenRevealed:1", cardCode: "10080", lines: ["10080:A:1"], timing: "whenRevealed", instructions: [
    { verb: "Pick", pick: EXHAUSTED_HERO_WITHOUT, when: { kind: "canPick", pick: EXHAUSTED_HERO_WITHOUT } },
    { verb: "Pick", pick: READY_HERO_WITHOUT, when: { kind: "not", condition: { kind: "canPick", pick: EXHAUSTED_HERO_WITHOUT } } },
    { verb: "AttachSelfToPicked" }] },
  { id: "10080:constant:1", cardCode: "10080", lines: ["10080:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "AttachesTo", host: { kind: "hero" }, limitPerHost: true }, { verb: "ModifyStat", stat: "cannotReady", amount: 1, until: "whileSourceInPlay", target: "host" }, { verb: "ModifyStat", stat: "noCollection", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  { id: "10080:triggered:1", cardCode: "10080", lines: ["10080:A:1"], timing: "triggered", trigger: "traveled", subject: { type: "objective", control: "any", safe: true }, instructions: [{ verb: "Discard", target: { kind: "self" } }] },

  // 10081 Lie Low (encounter side quest). Forced: at the end of the quest phase, if no progress was placed on it this round, each enemy gets -20 engagement cost until the end of the round. Response: after it is defeated, the first player shuffles an enemy of the staging area into the encounter deck.
  { id: "10081:forced:1", cardCode: "10081", lines: ["10081:A:1"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [PHASE_QUEST, { kind: "flag", stat: "progressPlacedHere", holder: "self", is: false }] }, instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -20, until: "endOfRound", target: "enemies" }] },
  { id: "10081:response:1", cardCode: "10081", lines: ["10081:A:2"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "Pick", pick: { ...ENEMY_IN_STAGING, who: "firstPlayer" } }, { verb: "MoveEncounterCard", card: "picked", to: "shuffle" }] },

  // 10082 Forage for Food (encounter side quest). Forced: after resources are spent from a hero's pool, 1 damage to that hero (once for each hero whose pool paid). Response: after it is defeated, heal 1 damage from each hero.
  { id: "10082:forced:1", cardCode: "10082", lines: ["10082:A:1"], timing: "forced", trigger: "heroResourcesSpent", subject: { type: "hero", control: "any" }, instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] },
  { id: "10082:response:1", cardCode: "10082", lines: ["10082:A:2"], timing: "response", trigger: "questDefeated", subject: "self", instructions: [{ verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "Heal", amount: 1, target: "picked" }] }] },

  // 10083 Scavenge for Supplies (encounter side quest). Each player card costs 1 more to play. Forced: when it is defeated, the first player searches the encounter deck and discard pile for a Troll enemy and puts it into play engaged with the player with the highest threat (the deck is shuffled);
  // then each player in turn may play a card from their hand at no cost.
  { id: "10083:constant:1", cardCode: "10083", lines: ["10083:A:1"], timing: "constant", instructions: [{ verb: "IncreaseCost", amount: 1, pick: { type: "card", control: "any" } }] },
  { id: "10083:forced:1", cardCode: "10083", lines: ["10083:A:2"], timing: "forced", trigger: "questDefeated", subject: "self", instructions: [
    { verb: "PickHighestThreat" }, { verb: "SearchMove", trait: "Troll", type: "enemy", to: "engaged", engagedSeat: "picked" }, { verb: "ShuffleEncounterDeck" },
    EACH_PLAYER([{ verb: "Choose", who: "actor", options: [
      { id: "play", requires: { kind: "canPick", pick: { type: "card", control: "you", from: "hand" } }, instructions: [{ verb: "PlayFromHand", pick: { type: "card", control: "you" }, free: true }] },
      { id: "skip", instructions: [] },
    ] }])] },

  // 10182 Across the Ettenmoors (campaign card). Setup: the five Losing Time treacheries are set aside, out of play. Forced: at the beginning of the quest phase 1 resource goes on this card; with 3 or more, 3 come off to reveal a set-aside Losing Time (a full reveal: it ends in the encounter
  // discard pile). Resolution: each Losing Time in the encounter deck or discard pile joins the Campaign Pool, and the characters that carry a Determination are marked determined.
  { id: "10182:campaignSetup:1", cardCode: "10182", lines: ["10182:A:2"], timing: "campaignSetup", instructions: [1, 2, 3, 4, 5].map((): Instruction => ({ verb: "SetAside", code: LOSING_TIME })) },
  { id: "10182:forced:1", cardCode: "10182", lines: ["10182:A:3"], timing: "forced", trigger: "beginningOfPhase", condition: PHASE_QUEST, instructions: [{ verb: "PlaceToken", amount: 1 }, { verb: "RevealSetAsideForTokens", code: LOSING_TIME, tokens: 3 }] },
  { id: "10182:resolution:1", cardCode: "10182", lines: ["10182:B:1"], timing: "resolution", instructions: [{ verb: "EarnEncounterCopies", codes: [LOSING_TIME] }, { verb: "RecordDetermined", code: "10172" }] },

  // 10183 Losing Time (treachery, burden; Surge is a keyword). When Revealed: each player in turn raises their threat by 3 or exhausts a hero they control. Shadow: the defending player chooses whether the attacking enemy gets +3 Attack or +3 Defense until the end of the phase.
  { id: "10183:whenRevealed:1", cardCode: LOSING_TIME, lines: ["10183:A:2"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Choose", who: "actor", options: [
    { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3 }] },
    { id: "exhaust", requires: { kind: "canPick", pick: READY_HERO }, instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }] },
  ] }])] },
  { id: "10183:shadow:1", cardCode: LOSING_TIME, lines: ["10183:A:3"], timing: "shadow", instructions: [{ verb: "Choose", who: "actor", options: [
    { id: "attack", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfPhase", target: "attacker" }] },
    { id: "defense", instructions: [{ verb: "ModifyStat", stat: "defense", amount: 3, until: "endOfPhase", target: "attacker" }] },
  ] }] },
], { pool: WASTES });

export const AUTHORED_REPLACES: readonly string[] = [];
