import type { Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Antlered Crown (the-ring-maker cycle part 9, no campaign card): the three quest stages (Time X, the Raven deck), Chief Turch, Raven Chief and Raven Chief's Camp, the Raven enemies, the locations that print Time X and the three treacheries. Every line is
// read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) needs no record here. The Raven deck is a named deck (src/rules/core/piles.ts DECKS, `pile: raven`) built by `FormPile` (wilderland family); its readings are in
// docs/scenarios/the-ring-maker/the-antlered-crown.md. The time verbs `RemoveTimeCounters` (targets locations and active, distribute), `PlaceTimeCounters` and the amount `timeOfActive` are the angmar family's; `DealShadowTo` with `from: raven` is the defense family's.
// Rules: rm.raven-deck, rm.time-x, faq.reveal-and-add, rr.then, rr.forced, rr.first-player, rr.ownership-and-control, rr.in-play-and-out-of-play, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.surge, rr.doomed-x, rr.lasting-effects, rr.immune (data/rules/entries.json).
const STAGE_1 = "08147";
const STAGE_2 = "08148";
const STAGE_3 = "08149";
const TURCH = "08150";
const RAVEN_CHIEF = "08151";
const CAMP = "08152";
const WARRIOR = "08153";
const SKIRMISHER = "08154";
const WAR_CAMP = "08155";
const VILLAGE = "08156";
const BATTLEFIELD = "08157";
const COUNTRY = "08158";
const RAISING_THE_CRY = "08159";
const FIERCE_FOLK = "08160";
const DRIVEN_BACK = "08161";
// The six enemies of Dunland Warriors and Dunland Raiders, the Raven deck (rm.raven-deck).
const RAVEN_ENEMIES = ["07042", "07043", "07044", "07046", "07047", "07048"];
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const OWN_CHARACTER: PickSpec = { type: "character", control: "you" };
const STAGING_LOCATION: PickSpec = { type: "location", control: "any", stagingOnly: true };
// An active location that holds a time counter: what a counter can be taken from.
const ACTIVE_WITH_COUNTER: PickSpec = { type: "location", control: "any", active: true, timeCounter: true };
// "The Raven deck" enemy a player chooses at Setup: one title each (rm.raven-deck, 08147:A:1).
const RAVEN_CHOICE: PickSpec = { type: "enemy", control: "any", from: "ravenDeck", different: true };
const PLACE_ON_SELF = (amount: number): Instruction => ({ verb: "PlaceResourceTokens", amount, on: "self" });
const REVEAL_RAVEN: Instruction = { verb: "AddFromPile", pile: "raven", to: "staging", reveal: true };
const REMOVE_ACTIVE: Instruction = { verb: "RemoveTimeCounters", target: "active" };
const ATTACKER_PLUS = (amount: Extract<Instruction, { verb: "ModifyStat" }>["amount"]): Instruction => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker" });
const timeKeyword = (id: string, code: string, line: string, amount: number): Effect => ({ id, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "Time", amount }] });
// A location's Time X and its Forced effect, one printed line ("Time 3. Forced: After the last time counter is removed from this location, ...").
const location = (code: string, amount: number, forced: Instruction[], line = `${code}:A:1`): Effect[] => [
  timeKeyword(`${code}:constant:1`, code, line, amount),
  { id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: forced },
];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 08147 Battle for Dunland (stage 1). Setup, in printed order: the first player controls Chief Turch (the set-aside objective enters play); Dunland Battlefield (active) and Raven War-camp (staging area) are placed by the piles and get their time counters as revealed cards do;
  // the Raven deck is created from the six set-aside enemies; each player in turn chooses an enemy of another title from it and adds it to the staging area (an add, not a reveal); both decks are shuffled. B:1 Time 3. B:2: after the last counter 1 counter comes off each location
  // in play (a location that loses its last counter fires its Forced effect after this one resolves) and 3 counters go back.
  {
    id: "08147:setup:1",
    cardCode: STAGE_1,
    lines: ["08147:A:1"],
    timing: "setup",
    instructions: [
      { verb: "TakeControlOfSetAside", code: TURCH },
      { verb: "PlaceTimeCounters", target: "locationsWithNone" },
      { verb: "FormPile", pile: "raven", codes: RAVEN_ENEMIES },
      EACH_PLAYER([{ verb: "Pick", pick: RAVEN_CHOICE }, { verb: "AddPickedToStaging" }]),
      { verb: "ShuffleEncounterDeck" },
      { verb: "ShufflePile", pile: "raven" },
    ],
  },
  timeKeyword("08147:constant:1", STAGE_1, "08147:B:1", 3),
  { id: "08147:forced:1", cardCode: STAGE_1, lines: ["08147:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "RemoveTimeCounters", target: "locations" }, PLACE_ON_SELF(3)] },

  // 08148 The Raven Clan (stage 2). A:1: the Raven discard pile is shuffled into the Raven deck, then each player in turn, the first player first, takes the top card and adds it to the staging area (an add, not a reveal). B:2: a reveal from the Raven deck, added to the staging area.
  // B:3: each location in the staging area has +2 quest points (it ends when the location becomes the active location).
  { id: "08148:whenRevealed:1", cardCode: STAGE_2, lines: ["08148:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleDiscardIntoPile", pile: "raven" }, EACH_PLAYER([{ verb: "AddFromPile", pile: "raven", to: "staging" }])] },
  timeKeyword("08148:constant:1", STAGE_2, "08148:B:1", 3),
  { id: "08148:forced:1", cardCode: STAGE_2, lines: ["08148:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [REVEAL_RAVEN, PLACE_ON_SELF(3)] },
  { id: "08148:constant:2", cardCode: STAGE_2, lines: ["08148:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 2, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },

  // 08149 The Last Stage (stage 3). A:1: Raven Chief and his Camp join the staging area from the set-aside pile (no reveal; the Camp gets its Time 3 counters as it enters), then X cards, the players minus 1, are taken from the Raven deck and added (no reveal; none solo).
  // B:2: each engaged enemy makes an attack (outside the combat phase, dealt a shadow card, the whole attack), then 2 counters go back. B:3: at the end of the round, with Raven Chief in the victory display, the players win.
  {
    id: "08149:whenRevealed:1",
    cardCode: STAGE_3,
    lines: ["08149:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "AddSetAsideToStaging", code: RAVEN_CHIEF }, { verb: "AddSetAsideToStaging", code: CAMP }, { verb: "AddFromPile", pile: "raven", to: "staging", count: { players: true, plus: -1 } }],
  },
  timeKeyword("08149:constant:1", STAGE_3, "08149:B:1", 2),
  { id: "08149:forced:1", cardCode: STAGE_3, lines: ["08149:B:2"], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [{ verb: "ImmediateAttackEach" }, PLACE_ON_SELF(2)] },
  { id: "08149:forced:2", cardCode: STAGE_3, lines: ["08149:B:3"], timing: "forced", trigger: "endOfRound", condition: { kind: "inVictory", code: RAVEN_CHIEF, is: true }, instructions: [{ verb: "WinGame" }] },

  // 08150 Chief Turch (objective ally). The first player controls him, and control follows the first player token (recommended reading, as Nalir 08068:A:1). A:2: Immune to player card effects (the keyword), and he does not exhaust to defend.
  { id: "08150:constant:1", cardCode: TURCH, lines: ["08150:A:1"], timing: "constant", instructions: [{ verb: "GainControlWhenFree", who: "firstPlayer" }] },
  { id: "08150:constant:2", cardCode: TURCH, lines: ["08150:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noExhaustDefend", amount: 1, until: "whileSourceInPlay" }] },

  // 08151 Raven Chief. Cannot have attachments; while Raven Chief's Camp is in play he cannot be damaged. Forced: when he attacks, 1 time counter comes off the active location, if able.
  { id: "08151:constant:1", cardCode: RAVEN_CHIEF, lines: ["08151:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "08151:constant:2", cardCode: RAVEN_CHIEF, lines: ["08151:A:1"], timing: "constant", condition: { kind: "inPlay", code: CAMP, is: true }, instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "08151:forced:1", cardCode: RAVEN_CHIEF, lines: ["08151:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [REMOVE_ACTIVE] },

  // 08152 Raven Chief's Camp. Time 3. Forced: after the last counter, each damaged character of every player is exhausted, then 3 counters go back.
  ...location(CAMP, 3, [{ verb: "ExhaustEach", pick: { type: "character", control: "any", damaged: true } }, PLACE_ON_SELF(3)], `${CAMP}:A:2`),

  // 08153 Raven Warrior. Forced: after it engages a player, X time counters come off the locations in play, X the cards in that player's hand when it resolves; the first player divides them one at a time (recommended reading).
  // Shadow: the defending player discards an attachment he controls, if he has one.
  { id: "08153:forced:1", cardCode: WARRIOR, lines: ["08153:A:1"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "RemoveTimeCounters", target: "locations", amount: { hand: true }, distribute: "firstPlayer" }] },
  { id: "08153:shadow:1", cardCode: WARRIOR, lines: ["08153:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },

  // 08154 Raven Skirmisher. When Revealed: the first player chooses to remove 1 counter from the active location (only while it holds one) or to reveal an additional encounter card. Shadow: the attacker gets +X Attack, X the printed Time X of the active location.
  {
    id: "08154:whenRevealed:1",
    cardCode: SKIRMISHER,
    lines: ["08154:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "time", requires: { kind: "canPick", pick: ACTIVE_WITH_COUNTER }, instructions: [REMOVE_ACTIVE] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
  },
  { id: "08154:shadow:1", cardCode: SKIRMISHER, lines: ["08154:A:2"], timing: "shadow", instructions: [ATTACKER_PLUS({ timeOfActive: true })] },

  // 08155 Raven War-camp. Time 3. Forced: after the last counter, each player in turn, the first player first, draws the top card of the Raven deck and puts it into play engaged with him (no reveal; no new counters are placed).
  ...location(WAR_CAMP, 3, [{ verb: "AddFromPile", pile: "raven", to: "engaged", who: "eachSeat" }]),

  // 08156 Raven Village. Time 2. Forced: after the last counter, the top card of the Raven deck is revealed and added to the staging area. Shadow: the attacking enemy is dealt 2 additional shadow cards from the Raven deck, one after the other.
  ...location(VILLAGE, 2, [REVEAL_RAVEN]),
  { id: "08156:shadow:1", cardCode: VILLAGE, lines: ["08156:A:2"], timing: "shadow", instructions: [{ verb: "DealShadowTo", target: "attacker", from: "raven" }, { verb: "DealShadowTo", target: "attacker", from: "raven" }] },

  // 08157 Dunland Battlefield. Time 3. Forced: after the last counter, each player in turn assigns X damage among his characters, X the cards in his hand. Shadow: 1 damage to the defending character.
  ...location(BATTLEFIELD, 3, [EACH_PLAYER([{ verb: "AssignDamage", amount: { hand: true }, pick: OWN_CHARACTER }])]),
  { id: "08157:shadow:1", cardCode: BATTLEFIELD, lines: ["08157:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

  // 08158 Raven Country. Time 4. Forced: after the last counter, each player raises his threat by the cards in his hand. Shadow: the defending player assigns X damage among his characters, X the printed Time X of the active location.
  ...location(COUNTRY, 4, [EACH_PLAYER([{ verb: "RaiseThreat", amount: { hand: true }, who: "actor" }])]),
  { id: "08158:shadow:1", cardCode: COUNTRY, lines: ["08158:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: { timeOfActive: true }, pick: OWN_CHARACTER }] },

  // 08159 Raising the Cry. When Revealed: 1 counter comes off each location in play, then each location in play with no counter gets its printed X (the Forced effect of a location whose last counter went follows the whole effect); with no location in the staging area it gains surge, checked last.
  {
    id: "08159:whenRevealed:1",
    cardCode: RAISING_THE_CRY,
    lines: ["08159:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "RemoveTimeCounters", target: "locations" }, { verb: "PlaceTimeCounters", target: "locationsWithNone" }, { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: STAGING_LOCATION } } }],
  },

  // 08160 Fierce Folk (Doomed 3 is the keyword). When Revealed: each player draws 3 cards; until the end of the round players cannot play events. Shadow: +1 Attack; a character this attack destroys takes 1 counter off the active location.
  { id: "08160:whenRevealed:1", cardCode: FIERCE_FOLK, lines: ["08160:A:2"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "Draw", amount: 3 }]), { verb: "ModifyStat", stat: "cannotPlayEvents", amount: 1, until: "endOfRound", target: "table" }] },
  { id: "08160:shadow:1", cardCode: FIERCE_FOLK, lines: ["08160:A:3"], timing: "shadow", instructions: [ATTACKER_PLUS(1), { verb: "AfterAttack", instructions: [{ ...REMOVE_ACTIVE, when: { kind: "x", min: 1 } }] }] },

  // 08161 Driven Back. When Revealed: all progress comes off each location in the staging area (the active location is untouched); the total Threat in the staging area is raised by 1 for each progress removed, until the end of the phase (recommended reading); surge when none was removed.
  {
    id: "08161:whenRevealed:1",
    cardCode: DRIVEN_BACK,
    lines: ["08161:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "RemoveAllProgress", pick: STAGING_LOCATION, remember: true }, { verb: "RaiseStagingThreat", amount: { x: true }, until: "endOfPhase", when: { kind: "x", min: 1 } }, { verb: "GainSurge", when: { kind: "not", condition: { kind: "x", min: 1 } } }],
  },
];

export const AUTHORED_REPLACES: readonly string[] = [];
