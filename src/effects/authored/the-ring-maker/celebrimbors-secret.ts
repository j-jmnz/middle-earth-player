import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for Celebrimbor's Secret (the-ring-maker cycle part 8, no campaign card): the two quest stages (Time 3, the Scour keyword and Celebrimbor's Mould), Bellach and The Orcs' Search with the cards lying underneath it, the Ost-in-Edhil
// locations and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// `TriggerScour` and the `scour` trigger (the effect that follows the keyword), `BuryDamagedLocations`, `PlaceRandomHandUnder`, `PlaceDestroyedUnder`, `ExcessToActiveLocation` and the amount `facedownUnder` are the ring-maker family's
// (src/catalog/families/ring-maker.ts); the scenario's readings are in docs/scenarios/the-ring-maker/celebrimbors-secret.md.
// Rules: rm.scour, rm.the-orcs-search, rm.time-x, rr.search, rr.in-play-and-out-of-play, rr.immune, rr.forced, rr.engaged, rr.damage, rr.defending-player, rr.shadow-effects, rr.travel, rr.active-location, rr.refresh-phase, rm.does-not-stack (data/rules/entries.json).
const STAGE_1 = "08122";
const STAGE_2 = "08123";
const BELLACH = "08124";
const ORCS_SEARCH = "08125";
const MOULD = "08127";
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const BELLACH_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Bellach"] };
const OWN_CHARACTER: PickSpec = { type: "character", control: "you" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const LOCATION_IN_PLAY: PickSpec = { type: "location", control: "any", staging: true };
// "The cards underneath The Orcs' Search", read live where a card says X.
const UNDER_SEARCH = { facedownUnder: ORCS_SEARCH } as const;
const MOULD_NOT_ON_A_HERO: Condition = { kind: "attachedToHero", code: MOULD, is: false };
const MOULD_ON_A_HERO: Condition = { kind: "attachedToHero", code: MOULD, is: true };
const ACTIVE_LOCATION: Condition = { kind: "canPick", pick: { type: "location", control: "any", active: true } };
// "If this attack destroys a character": the attack's X is the characters it destroyed; "an ally": and the defender, out of play, was one.
const DESTROYED_A_CHARACTER: Condition = { kind: "x", min: 1 };
const DESTROYED_AN_ALLY: Condition = { kind: "all", conditions: [DESTROYED_A_CHARACTER, { kind: "matches", card: "other", pick: { type: "card", control: "any", cardType: "ally" }, inPlay: false }] };
const ATTACKER_PLUS_ONE: Instruction = { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" };
const DAMAGE_ACTIVE = (amount: number): Extract<Instruction, { verb: "DamageCard" }> => ({ verb: "DamageCard", amount, target: "activeLocation" });
const TRIGGER_EACH_SCOUR: Extract<Instruction, { verb: "TriggerScour" }> = { verb: "TriggerScour", scope: "inPlay" };
// The Scour effect of a card: a record that the verb TriggerScour runs with the card as its source.
const scour = (id: string, code: string, line: string, instructions: Instruction[], condition?: Condition): Effect => ({ id, cardCode: code, lines: [line], timing: "triggered", trigger: "scour", subject: "self", ...(condition ? { condition } : {}), instructions });

// The two quest stages print the same Time 3 and the same last-counter line.
const stage = (code: string, time: string, forced: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [time], timing: "constant", instructions: [{ verb: "Time", amount: 3 }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [forced], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [TRIGGER_EACH_SCOUR, { verb: "PlaceResourceTokens", amount: 3, on: "self" }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 08122 The Ruins of Ost-in-Edhil (stage 1). Setup: Bellach, The Orcs' Search and The Secret Chamber are added to the staging area by the piles; Celebrimbor's Mould is attached to The Secret Chamber, a claimed objective that returns to the staging area when the
  // location leaves play; each player, the first player first, adds a different Ost-in-Edhil location from the encounter deck and its discard pile, which a Forced effect of the location hears as it enters the staging area; the deck is shuffled.
  // B:1 and B:2: Time 3; after the last counter every Scour effect in play is triggered and 3 counters go back. B:3: Bellach is immune to player card effects and cannot be engaged. B:4: the stage is not advanced while the Mould is not attached to a hero
  // (it takes progress meanwhile and advances the moment the Mould is attached, `advanceFreed`; recommended reading).
  {
    id: "08122:setup:1",
    cardCode: STAGE_1,
    lines: ["08122:A:1"],
    timing: "setup",
    instructions: [
      { verb: "AttachSetAsideTo", code: MOULD, to: "The Secret Chamber", uncontrolled: true, claimed: true },
      EACH_PLAYER([{ verb: "SearchMove", type: "location", trait: "Ost-in-Edhil", to: "staging", different: true }]),
      { verb: "Each", pick: { type: "location", control: "any", staging: true, names: ["Ruined Plaza"] }, instructions: [{ verb: "AnnounceAddedToStaging", card: "picked" }] },
      { verb: "ShuffleEncounterDeck" },
    ],
  },
  ...stage(STAGE_1, "08122:B:1", "08122:B:2"),
  { id: "08122:constant:2", cardCode: STAGE_1, lines: ["08122:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: BELLACH_ENEMY }, { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: BELLACH_ENEMY }] },
  { id: "08122:constant:3", cardCode: STAGE_1, lines: ["08122:B:4"], timing: "constant", condition: MOULD_NOT_ON_A_HERO, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 08123 The Enemy's Servant (stage 2). A:1 (when revealed): every Scour effect in play is triggered, Bellach attacks the player who controls the Mould, from the staging area and dealt a shadow card, then the Mould is attached to Bellach (it leaves its hero).
  // B:3: Bellach is immune to player card effects and cannot be engaged unless the stage holds 12 progress. B:4: the stage is not defeated while the Mould is not attached to a hero; defeating it wins the game (the last stage).
  {
    id: "08123:whenRevealed:1",
    cardCode: STAGE_2,
    lines: ["08123:A:1"],
    timing: "whenRevealed",
    instructions: [TRIGGER_EACH_SCOUR, { verb: "Pick", pick: BELLACH_ENEMY }, { verb: "AttackScrollHolder", code: MOULD, card: "picked" }, { verb: "AttachObjectiveTo", code: MOULD, card: "picked", when: MOULD_ON_A_HERO }],
  },
  ...stage(STAGE_2, "08123:B:1", "08123:B:2"),
  {
    id: "08123:constant:2",
    cardCode: STAGE_2,
    lines: ["08123:B:3"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "stageProgress", min: 12 } },
    instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: BELLACH_ENEMY }, { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: BELLACH_ENEMY }],
  },
  { id: "08123:constant:3", cardCode: STAGE_2, lines: ["08123:B:4"], timing: "constant", condition: MOULD_NOT_ON_A_HERO, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 08124 Bellach. X, its Threat, is the number of cards underneath The Orcs' Search. Scour: each player, the first player first, searches the encounter deck and discard pile for an Orc enemy and adds it to the staging area; the deck is shuffled
  // (each player chooses the Orc; recommended reading).
  { id: "08124:constant:1", cardCode: BELLACH, lines: ["08124:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: UNDER_SEARCH, until: "whileSourceInPlay", target: "self" }] },
  scour("08124:triggered:1", BELLACH, "08124:A:2", [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging" }]), { verb: "ShuffleEncounterDeck" }]),

  // 08125 The Orcs' Search (objective). A:1: a location in play with damage equal to or more than its printed quest points goes facedown underneath it, the tokens and attachments discarded (a settle sweep). A:2: Forced at the end of the refresh phase, each
  // player raises his threat by 1 for each card underneath.
  { id: "08125:constant:1", cardCode: ORCS_SEARCH, lines: ["08125:A:1"], timing: "constant", instructions: [{ verb: "BuryDamagedLocations" }] },
  { id: "08125:forced:1", cardCode: ORCS_SEARCH, lines: ["08125:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "phase", is: "Refresh" }, instructions: [{ verb: "RaiseThreat", amount: { facedown: true }, who: "eachSeat" }] },

  // 08126 The Secret Chamber. X, its Threat, is the number of players (immune to player card effects: the build). Travel: remove 3 progress from the current quest. If it is placed underneath The Orcs' Search the players lose.
  { id: "08126:constant:1", cardCode: "08126", lines: ["08126:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "08126:travel:1", cardCode: "08126", lines: ["08126:A:2"], timing: "travel", instructions: [{ verb: "RemoveProgressFromQuest", amount: 3 }] },
  { id: "08126:triggered:1", cardCode: "08126", lines: ["08126:A:3"], timing: "triggered", trigger: "placedUnder", subject: "self", instructions: [{ verb: "LoseGame" }] },

  // 08127 Celebrimbor's Mould (objective). A:1: once free of encounters (nothing guards it, the Chamber or Bellach it lies on has left play) the first player claims it and attaches it to a hero he controls; lying on a card it returns to the staging area when that card
  // leaves play. A:2 (the build writes it, replaced here): the players lose when the hero it is attached to leaves play; on Bellach, it loses nothing.
  { id: "08127:constant:2", cardCode: MOULD, lines: ["08127:A:1"], timing: "constant", instructions: [{ verb: "ClaimWhenFree" }, { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: "08127:constant:1",
    cardCode: MOULD,
    lines: ["08127:A:2"],
    timing: "constant",
    condition: { kind: "matches", card: "host", pick: { type: "hero", control: "any" } },
    instructions: [{ verb: "ModifyStat", stat: "lossOnLeavingPlay", amount: 1, until: "whileSourceInPlay", target: "host" }],
  },

  // 08128 Bellach's Scout. When Revealed: the first player chooses to place 3 damage on the active location or to reveal an additional encounter card. Scour: 1 damage on the active location. Shadow: 1 damage on the active location.
  {
    id: "08128:whenRevealed:1",
    cardCode: "08128",
    lines: ["08128:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "damage", requires: ACTIVE_LOCATION, instructions: [DAMAGE_ACTIVE(3)] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
  },
  scour("08128:triggered:1", "08128", "08128:A:2", [DAMAGE_ACTIVE(1)]),
  { id: "08128:shadow:1", cardCode: "08128", lines: ["08128:A:3"], timing: "shadow", instructions: [DAMAGE_ACTIVE(1)] },

  // 08129 Prowling Orc. Forced: after it attacks, 1 damage on the active location. Scour: it engages the player with the highest threat (the first player chooses among those tied) and makes an immediate attack; in the discard pile (08133:A:1) it does so from there.
  { id: "08129:forced:1", cardCode: "08129", lines: ["08129:A:1"], timing: "forced", trigger: "attackResolved", subject: "self", instructions: [DAMAGE_ACTIVE(1)] },
  scour("08129:triggered:1", "08129", "08129:A:2", [{ verb: "Pick", pick: { type: "player", control: "any", highestThreat: true, who: "firstPlayer" } }, { verb: "EngageSelfWithPicked" }, { verb: "SwitchActor", to: "picked" }, { verb: "ImmediateAttack" }]),

  // 08130 Ruined Plaza. Forced: after it enters the staging area (Setup, a reveal, a return) 1 damage on it. Shadow: the defending player assigns X damage among characters he controls, X the cards underneath The Orcs' Search.
  { id: "08130:forced:1", cardCode: "08130", lines: ["08130:A:1"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "DamageCard", amount: 1, target: "self" }] },
  { id: "08130:shadow:1", cardCode: "08130", lines: ["08130:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: UNDER_SEARCH, pick: OWN_CHARACTER }] },

  // 08131 Collapsed Tower (Surge is its keyword). Scour: it returns to the staging area (from the active location or the discard pile) and takes 2 damage. Shadow: excess damage dealt by the attack goes on the active location, if able.
  scour("08131:triggered:1", "08131", "08131:A:2", [{ verb: "ReturnToStaging", target: { kind: "self" } }, { verb: "DamageCard", amount: 2, target: "self" }]),
  { id: "08131:shadow:1", cardCode: "08131", lines: ["08131:A:3"], timing: "shadow", instructions: [{ verb: "ExcessToActiveLocation" }] },

  // 08132 Ancient Foundation. Scour: the first player assigns X damage among locations in play, X the locations in play; a second copy does not add to it (the oldest copy in play holds the flag; in the discard pile it acts alone). Travel: place 1 damage on this location.
  { id: "08132:constant:1", cardCode: "08132", lines: ["08132:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "scoursAlone", amount: 1, until: "whileSourceInPlay", target: "self", doesNotStack: true }] },
  scour("08132:triggered:1", "08132", "08132:A:1", [{ verb: "AssignDamage", amount: { count: LOCATION_IN_PLAY }, pick: LOCATION_IN_PLAY }], {
    kind: "any",
    conditions: [{ kind: "sourceIn", zone: "encounterDiscard" }, { kind: "flag", stat: "scoursAlone", holder: "self" }],
  }),
  { id: "08132:travel:1", cardCode: "08132", lines: ["08132:A:2"], timing: "travel", instructions: [{ verb: "DamageCard", amount: 1, target: "self" }] },

  // 08133 City Remains. Forced: after progress is placed on it, the topmost Scour effect in the encounter discard pile is triggered, if there is one. Shadow: +1 Attack; if the attack destroys a character each player raises his threat by 1 for each card underneath The Orcs' Search.
  { id: "08133:forced:1", cardCode: "08133", lines: ["08133:A:1"], timing: "forced", trigger: "progressPlaced", subject: "self", instructions: [{ verb: "TriggerScour", scope: "topmostDiscard" }] },
  {
    id: "08133:shadow:1",
    cardCode: "08133",
    lines: ["08133:A:2"],
    timing: "shadow",
    instructions: [ATTACKER_PLUS_ONE, { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: UNDER_SEARCH, who: "eachSeat", when: DESTROYED_A_CHARACTER }] }],
  },

  // 08134 Discovered! When Revealed: the first player chooses to trigger each Scour effect in play, or each player (the first player first) places a random card from his hand facedown underneath The Orcs' Search. Shadow: a character the attack destroys goes
  // facedown underneath The Orcs' Search.
  {
    id: "08134:whenRevealed:1",
    cardCode: "08134",
    lines: ["08134:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [{ id: "scour", instructions: [TRIGGER_EACH_SCOUR] }, { id: "hand", instructions: [{ verb: "PlaceRandomHandUnder", code: ORCS_SEARCH }] }] }],
  },
  { id: "08134:shadow:1", cardCode: "08134", lines: ["08134:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "PlaceDestroyedUnder", code: ORCS_SEARCH, when: DESTROYED_A_CHARACTER }] }] },

  // 08135 Desecrated Ruins. When Revealed: with no active location it gains surge, checked before the 3 damage on the active location (a location the damage sends under The Orcs' Search gives no surge; recommended reading). Shadow: +1 Attack; if the attack destroys an ally, X damage on the active location, X that ally's cost.
  { id: "08135:whenRevealed:1", cardCode: "08135", lines: ["08135:A:1"], timing: "whenRevealed", instructions: [{ verb: "GainSurge", when: { kind: "not", condition: ACTIVE_LOCATION } }, DAMAGE_ACTIVE(3)] },
  {
    id: "08135:shadow:1",
    cardCode: "08135",
    lines: ["08135:A:2"],
    timing: "shadow",
    instructions: [ATTACKER_PLUS_ONE, { verb: "AfterAttack", instructions: [{ verb: "DamageCard", amount: { stat: "cost", of: "other" }, target: "activeLocation", when: DESTROYED_AN_ALLY }] }],
  },

  // 08136 Spies from Mordor. When Revealed: each player, the first player first, exhausts X characters he controls (X the cards underneath The Orcs' Search; all he has ready when fewer); with none exhausted, X being 0 or no character ready, it gains surge.
  // Shadow: the defending player discards a non-objective attachment he controls.
  {
    id: "08136:whenRevealed:1",
    cardCode: "08136",
    lines: ["08136:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "any", conditions: [{ kind: "less", left: UNDER_SEARCH, right: 1 }, { kind: "less", left: { count: { type: "character", control: "any", state: "ready" } }, right: 1 }] } },
      EACH_PLAYER([{ verb: "Each", pick: READY_CHARACTER, upTo: UNDER_SEARCH, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }], rest: [] }]),
    ],
  },
  { id: "08136:shadow:1", cardCode: "08136", lines: ["08136:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", nonObjective: true } }, { verb: "DiscardPicked" }] },
];

// The build writes 08127:A:2 for every host; here the loss holds for a hero host only (the Mould lies on Bellach after stage 2A: reading in docs/scenarios/the-ring-maker/celebrimbors-secret.md).
export const AUTHORED_REPLACES: readonly string[] = ["08127:constant:1"];
