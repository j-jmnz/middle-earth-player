import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as FELLOWSHIP_OF_THE_RING } from "./fellowship-of-the-ring.ts";
import { AUTHORED_EFFECTS as FIRE_IN_THE_NIGHT } from "./fire-in-the-night.ts";
import { AUTHORED_EFFECTS as LOST_IN_MIRKWOOD } from "./lost-in-mirkwood.ts";
import { copyLine, withCopies } from "./reprint.ts";

// Records for The Ghost of Framsburg (Ered Mithrin part 7, campaign card 12189): the Loot objectives, the locations with the Discover keyword, the encounter cards no template reads, Fram's Shade, the three quest stages and the campaign card. Ashen Brazier (12190),
// Gundabad Hunter (12191) and Gundabad Stalker (12192) are in pool/EMCE.ts. Every line is read from the scan ledger (data/printed/ered-mithrin.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here.
// A Loot objective's text claims it "if unattached", so it stays in play unattached until the claim: it carries `returnsToStagingArea` (families/objectives/claimed.ts; docs/brief.md, Ered Mithrin, agent recommendation).
// A Loot objective enters play only through the Discover keyword of the active location, which attaches it to the location as a guarded objective (emce.discover, emce.loot); once nothing guards it the first player claims it (`ClaimWhenFree`) and attaches it to a hero.
// "The Loot objectives the players control" is a count of the claimed ones (`lootKeyword`, `controlled`). The Discover keyword is a Forced effect of the location when it becomes the active location; the Response of Crypt Key adjusts its value before it resolves (families/wilderland/discover.ts).
// Rules: emce.discover, emce.loot, emce.setup-the-ghost-of-framsburg, emce.guarded-x, emce.treasure, emce.campaign-pool-encounter, emce.immune, rr.guarded, rr.first-player, rr.travel (data/rules/entries.json).
export const LOOT: PickSpec = { type: "objective", control: "any", controlled: true, lootKeyword: true };
// X, the number of Loot objectives the players control: Fram's Shade's Threat, Attack and Defense, and the number of shadow cards it is dealt (19098:A:2, 19098:A:3).
const LOOT_COUNT = { count: LOOT } as const;
const FRAMS_SHADE: PickSpec = { type: "card", control: "any", names: ["Fram's Shade"], engagedEnemies: true };
const FRAMS_SHADE_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Fram's Shade"] };
// "X is the tens digit of the first player's threat" (19099:A:1, 19103:A:2).
const TENS = { firstPlayerTens: true } as const;
export const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]) => ({ verb: "ForEachPlayer" as const, order: "firstFirst" as const, instructions });
// The Discover value of the active location is at least 1: Old Lantern and Crypt Key have something to work on.
export const HAS_DISCOVER: Condition = { kind: "not", condition: { kind: "discoverUnavailable" } };
const ACTIVE_LOCATION_IS_DARK: Condition = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: "Dark" } };
// The X of the running effect is 1 or more: the characters the attack destroyed ("If this attack destroys a character", 19107:A:2), the Hazard cards a Discover revealed (19103:A:3).
export const X_AT_LEAST_1: Condition = { kind: "x", min: 1 };
// "Discover X" is a Forced effect of the location once it is the active location.
export const discoverKeyword = (code: string, line: string, amount: Extract<Instruction, { verb: "Discover" }>["amount"]): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [line], timing: "forced", trigger: "becameActive", subject: "self", instructions: [{ verb: "Discover", amount }] });
// The Loot keyword and the claim of the objective once it is free (19094 to 19096, and Ashen Brazier in pool/EMCE.ts).
export const lootRecords = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "Loot" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "ClaimWhenFree" }, { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
];
// True while the players control fewer than `min` Loot objectives: what a stage or The Cursed Tomb restricts (travel, advance) on.
export const FEWER_LOOT_THAN = (min: number): Condition => ({ kind: "not", condition: { kind: "count", pick: LOOT, min } });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 12189 The Ghost of Framsburg (campaign card). Setup: hero changes cost no threat; Ashen Brazier, Gundabad Hunter and Gundabad Stalker are shuffled into the encounter deck; a player may search their deck for a unique boon ally; with Isolde's line 3 treacheries, with Beldis's
    // 3 non-unique locations are removed from the game. Side B ignores the Deep keyword. After Fram's Shade engages a player at stage 1B or 2B the first player looks at 3 random undiscovered treasures and one is attached to it as a guarded objective (once per game for the group).
    // Any player may raise each player's threat by 1 to shuffle the encounter discard pile into the encounter deck (every player pays, as for the Response of Forked Passage, 18055:A:2). Resolution: the players discover each treasure they control; Gundabad Hunter or Gundabad Stalker joins
    // the pool; the discard pile is shuffled in and cards discarded until 2 Hazard cards are, and the group chooses one for the pool.
    {
      id: "12189:campaignSetup:1",
      cardCode: "12189",
      lines: ["12189:A:2"],
      timing: "campaignSetup",
      instructions: [
        { verb: "WaiveThreatPenalty" },
        { verb: "ShuffleIntoEncounterDeck", code: "12190" },
        { verb: "ShuffleIntoEncounterDeck", code: "12191" },
        { verb: "ShuffleIntoEncounterDeck", code: "12192" },
        { verb: "SearchBoonAllyToHand" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "isolde", count: 3, cardType: "treachery" },
        { verb: "RemoveFromEncounterDeckIfLogged", line: "beldis", count: 3, cardType: "location", nonUnique: true },
      ],
    },
    copyLine("12187:A:3", "12189:B:1"),
    {
      id: "12189:response:1",
      cardCode: "12189",
      lines: ["12189:B:2"],
      timing: "response",
      trigger: "engaged",
      subject: FRAMS_SHADE,
      limit: "oncePerGameGroup",
      condition: { kind: "any", conditions: [{ kind: "onStage", stage: 1 }, { kind: "onStage", stage: 2 }] },
      instructions: [{ verb: "AttachRandomTreasure", to: "subject" }],
    },
    {
      id: "12189:action:1",
      cardCode: "12189",
      lines: ["12189:B:3"],
      timing: "action",
      anyPlayer: true,
      condition: { kind: "encounterHas", piles: "discard" },
      instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }, { verb: "ShuffleEncounterDiscard" }],
    },
    { id: "12189:resolution:1", cardCode: "12189", lines: ["12189:B:4"], timing: "resolution", instructions: [{ verb: "DiscoverTreasure" }] },
    { id: "12189:resolution:2", cardCode: "12189", lines: ["12189:B:5"], timing: "resolution", instructions: [{ verb: "ChooseCards", codes: ["12191", "12192"], who: "firstPlayer", to: "pool", only: true }] },
    { id: "12189:resolution:3", cardCode: "12189", lines: ["12189:B:6"], timing: "resolution", instructions: [{ verb: "ChooseHazardForPool", count: 2 }] },

    // 19094 Crypt Key (Loot). Response: when the players travel to a Discover location, exhaust it to increase or decrease the location's Discover value by 1; the Discover keyword is held back to the end of the travel step so this comes first.
    ...lootRecords("19094"),
    {
      id: "19094:response:1",
      cardCode: "19094",
      lines: ["19094:A:3"],
      timing: "response",
      trigger: "traveled",
      subject: { type: "location", control: "any" },
      cost: { kind: "exhaustSelf" },
      condition: HAS_DISCOVER,
      instructions: [
        { verb: "Pick", pick: { type: "location", control: "any", active: true } },
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "increase", instructions: [{ verb: "ModifyStat", stat: "discoverValue", amount: 1, until: "endOfPhase", target: "picked" }] },
            { id: "decrease", instructions: [{ verb: "ModifyStat", stat: "discoverValue", amount: -1, until: "endOfPhase", target: "picked" }] },
          ],
        },
      ],
    },
    // 19095 Old Lantern (Loot). Action: exhaust it, a player looks at the top X cards of their deck, X the Discover value of the active location, adds one to hand and puts the rest on the bottom of the deck.
    ...lootRecords("19095"),
    {
      id: "19095:action:1",
      cardCode: "19095",
      lines: ["19095:A:3"],
      timing: "action",
      cost: { kind: "exhaustSelf" },
      condition: HAS_DISCOVER,
      instructions: [
        { verb: "Pick", pick: { type: "player", control: "any" } },
        { verb: "SwitchActor", to: "picked" },
        { verb: "LookAtTop", count: { discoverValue: true }, deck: "own" },
        { verb: "Pick", pick: { type: "card", control: "you", from: "deck", looked: true } },
        { verb: "MovePicked", to: "hand" },
        { verb: "Each", pick: { type: "card", control: "you", from: "deck", looked: true }, instructions: [{ verb: "PutOnDeck", position: "bottom", target: "picked" }] },
      ],
    },
    // 19096 Scatha's Teeth (Loot). Action: exhaust it and the attached hero, a player reduces their threat by 2.
    ...lootRecords("19096"),
    {
      id: "19096:action:1",
      cardCode: "19096",
      lines: ["19096:A:3"],
      timing: "action",
      cost: [{ kind: "exhaustSelf" }, { kind: "exhaustHost" }],
      instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "LowerThreat", amount: 2, who: "picked" }],
    },

    // 19097 The Cursed Tomb. The players cannot travel to it unless they control 3 Loot objectives. After they travel to it Fram's Shade is searched for in the encounter deck and discard pile and added to the staging area, the deck is shuffled, and Fram's Shade
    // makes an immediate attack against each player in turn order.
    { id: "19097:constant:1", cardCode: "19097", lines: ["19097:A:2"], timing: "constant", condition: FEWER_LOOT_THAN(3), instructions: [{ verb: "Restrict", what: "travel" }] },
    {
      id: "19097:forced:1",
      cardCode: "19097",
      lines: ["19097:A:3"],
      timing: "forced",
      trigger: "traveled",
      subject: "self",
      instructions: [{ verb: "SearchToStaging", code: "19098" }, { verb: "ShuffleEncounterDeck" }, EACH_PLAYER([{ verb: "Pick", pick: FRAMS_SHADE_ENEMY }, { verb: "AttackFromStaging", orEngaged: true }])],
    },
    // 19098 Fram's Shade. +1 Threat, Attack and Defense for each Loot objective the players control; dealt that many shadow cards (at least 1).
    {
      id: "19098:constant:2",
      cardCode: "19098",
      lines: ["19098:A:2"],
      timing: "constant",
      instructions: ["threat", "attack", "defense"].map((stat) => ({ verb: "ModifyStat" as const, stat: stat as "threat" | "attack" | "defense", amount: LOOT_COUNT, until: "whileSourceInPlay" as const, target: "self" as const })),
    },
    { id: "19098:constant:3", cardCode: "19098", lines: ["19098:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "dealtShadows", amount: LOOT_COUNT, until: "whileSourceInPlay", target: "self" }] },
    // 19099 Crypt Stalker. Threat, Attack and Defense X, the tens digit of the first player's threat. When it attacks the defending player raises their threat by 1. The Shadow: raise your threat by 2, or return the attacking enemy to the staging area.
    {
      id: "19099:constant:1",
      cardCode: "19099",
      lines: ["19099:A:1"],
      timing: "constant",
      instructions: ["threat", "attack", "defense"].map((stat) => ({ verb: "ModifyStat" as const, stat: stat as "threat" | "attack" | "defense", amount: TENS, until: "whileSourceInPlay" as const, target: "self" as const })),
    },
    { id: "19099:forced:1", cardCode: "19099", lines: ["19099:A:2"], timing: "forced", trigger: "attacks", subject: "self", instructions: [{ verb: "RaiseThreat", amount: 1 }] },
    {
      id: "19099:shadow:1",
      cardCode: "19099",
      lines: ["19099:A:3"],
      timing: "shadow",
      instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2 }] }, { id: "staging", instructions: [{ verb: "ReturnToStaging", target: { kind: "attacker" } }] }] }],
    },
    // 19100 Evil Spectre. When destroyed it is shuffled back into the encounter deck if the active location has the Dark trait. The Shadow: +1 Attack, +2 instead if the active location has the Dark trait.
    { id: "19100:forced:1", cardCode: "19100", lines: ["19100:A:1"], timing: "forced", trigger: "enemyDestroyed", subject: "self", condition: ACTIVE_LOCATION_IS_DARK, instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },
    {
      id: "19100:shadow:1",
      cardCode: "19100",
      lines: ["19100:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: ACTIVE_LOCATION_IS_DARK },
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: ACTIVE_LOCATION_IS_DARK } },
      ],
    },
    // 19101 Forgotten Crypt. After it becomes the active location cards are discarded from the encounter deck until an Undead enemy is, which is added to the staging area; a Loot objective of the encounter discard pile is attached to that enemy as a guarded objective.
    {
      id: "19101:forced:1",
      cardCode: "19101",
      lines: ["19101:A:2"],
      timing: "forced",
      trigger: "becameActive",
      subject: "self",
      instructions: [{ verb: "DiscardUntil", type: "enemy", trait: "Undead" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }, { verb: "AttachLootFromDiscard" }],
    },
    // 19102 Haunted Hall. Discover 4. While it is in the staging area it gains: after a player places progress on a Dark location in the staging area they raise their threat by 1.
    discoverKeyword("19102", "19102:A:1", 4),
    {
      id: "19102:forced:2",
      cardCode: "19102",
      lines: ["19102:A:2"],
      timing: "forced",
      trigger: "progressPlaced",
      subject: { type: "location", control: "any", stagingOnly: true, trait: "Dark" },
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }],
    },
    // 19103 Hidden Staircase. Discover X and Threat X, X the tens digit of the first player's threat. After the keyword resolves each player's threat is reduced by X if no Hazard card was revealed by it.
    discoverKeyword("19103", "19103:A:1", TENS),
    { id: "19103:constant:1", cardCode: "19103", lines: ["19103:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: TENS, until: "whileSourceInPlay", target: "self" }] },
    { id: "19103:forced:2", cardCode: "19103", lines: ["19103:A:3"], timing: "forced", trigger: "discovered", subject: "self", instructions: [{ verb: "LowerThreat", amount: TENS, who: "eachSeat", when: { kind: "not", condition: X_AT_LEAST_1 } }] },
    // 19104 Moonlit Passage. Discover 2. In the staging area, no player's threat is reduced by more than 1 a round by player card effects. The Shadow: raise your threat by 1.
    discoverKeyword("19104", "19104:A:1", 2),
    {
      id: "19104:constant:1",
      cardCode: "19104",
      lines: ["19104:A:2"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "ModifyStat", stat: "playerThreatReductionCap", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }],
    },
    { id: "19104:shadow:1", cardCode: "19104", lines: ["19104:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: 1 }] },
    // 19105 Cursed Tower. Discover 3. While it is in the staging area it gains: after a player plays an event they raise their threat by 1. The Shadow discards a non-objective attachment the defender controls.
    discoverKeyword("19105", "19105:A:1", 3),
    {
      id: "19105:forced:2",
      cardCode: "19105",
      lines: ["19105:A:2"],
      timing: "forced",
      trigger: "played",
      subject: { type: "card", control: "any", cardType: "event" },
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [{ verb: "RaiseThreat", amount: 1, who: "eventSeat" }],
    },
    copyLine("141071:A:2", "19105:A:3"),
    // 19106 Abandoned Ruins. When Revealed: each player in turn resolves the Discover keyword of the active location; if the active location has none, Abandoned Ruins gains surge and doomed 2. The Shadow gives the attacker an additional attack against you.
    {
      id: "19106:whenRevealed:1",
      cardCode: "19106",
      lines: ["19106:A:1"],
      timing: "whenRevealed",
      instructions: [EACH_PLAYER([{ verb: "ResolveDiscover" }]), { verb: "GainSurge", when: { kind: "discoverUnavailable" } }, { verb: "Doomed", amount: 2, when: { kind: "discoverUnavailable" } }],
    },
    copyLine("18035:A:2", "19106:A:2"),
    // 19107 Terrible Shadows. When Revealed: each character gets -1 Willpower, Attack and Defense until the end of the round. The Shadow: the attacker gets +1 Attack; if the attack destroys a character, the defending player raises their threat by 3.
    {
      id: "19107:whenRevealed:1",
      cardCode: "19107",
      lines: ["19107:A:1"],
      timing: "whenRevealed",
      instructions: ["willpower", "attack", "defense"].map((stat) => ({ verb: "ModifyStat" as const, stat: stat as "willpower" | "attack" | "defense", amount: -1, until: "endOfRound" as const, target: "characters" as const })),
    },
    {
      id: "19107:shadow:1",
      cardCode: "19107",
      lines: ["19107:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" }, { verb: "AfterAttack", instructions: [{ verb: "RaiseThreat", amount: 3, when: X_AT_LEAST_1 }] }],
    },
    // 19108 Slammed Shut. When Revealed: each player chooses and exhausts a character they control; until the end of the round no player card effect readies a character.
    {
      id: "19108:whenRevealed:1",
      cardCode: "19108",
      lines: ["19108:A:2"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([{ verb: "Pick", pick: { type: "character", control: "you", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }]),
        { verb: "ModifyStat", stat: "cannotReadyByPlayerCard", amount: 1, until: "endOfRound", target: "characters" },
      ],
    },

    // 19109 The Haunted Keep (stage 1). Setup: The Cursed Tomb is set aside by the scenario's piles; each player searches the encounter deck for a different location and adds it to the staging area; the deck is shuffled.
    // Side B: the stage cannot be defeated unless the players control a Loot objective.
    {
      id: "19109:setup:1",
      cardCode: "19109",
      lines: ["19109:A:1"],
      timing: "setup",
      instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "location", to: "staging", different: true }]), { verb: "ShuffleEncounterDeck" }],
    },
    { id: "19109:constant:1", cardCode: "19109", lines: ["19109:B:1"], timing: "constant", condition: FEWER_LOOT_THAN(1), instructions: [{ verb: "Restrict", what: "advance" }] },
    // 19110 Searching the Ruins (stage 2). When Revealed: the encounter discard pile is shuffled in and each player reveals an encounter card. Side B: at the beginning of the quest phase the first player chooses, raise each player's threat by 2 or discard
    // from the encounter deck until a location is discarded and add it to the staging area; the stage cannot be defeated unless the players control 2 Loot objectives.
    { id: "19110:whenRevealed:1", cardCode: "19110", lines: ["19110:A:1"], timing: "whenRevealed", instructions: [{ verb: "ShuffleEncounterDiscard" }, EACH_PLAYER([{ verb: "RevealEncounter" }])] },
    {
      id: "19110:forced:1",
      cardCode: "19110",
      lines: ["19110:B:1"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Quest" },
      instructions: [
        {
          verb: "Choose",
          who: "firstPlayer",
          options: [
            { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
            { id: "location", instructions: [{ verb: "DiscardUntil", type: "location" }, { verb: "MoveEncounterCard", card: "picked", to: "staging" }] },
          ],
        },
      ],
    },
    { id: "19110:constant:1", cardCode: "19110", lines: ["19110:B:2"], timing: "constant", condition: FEWER_LOOT_THAN(2), instructions: [{ verb: "Restrict", what: "advance" }] },
    // 19111 The Cursed Shade (stage 3). When Revealed: the first player adds The Cursed Tomb to the staging area; each other player searches the encounter deck and discard pile for a non-unique Undead enemy and adds it to the staging area; the deck is shuffled.
    // Side B: Fram's Shade is immune to player card effects; it gains victory 6 while The Cursed Tomb is in the victory display; the stage cannot be defeated unless Fram's Shade is in the victory display (defeating the last stage wins the game, rr.quest-advancement).
    {
      id: "19111:whenRevealed:1",
      cardCode: "19111",
      lines: ["19111:A:1"],
      timing: "whenRevealed",
      instructions: [
        EACH_PLAYER([
          { verb: "AddSetAsideToStaging", code: "19097", when: { kind: "firstPlayer" } },
          { verb: "SearchMove", type: "enemy", trait: "Undead", nonUnique: true, to: "staging", when: { kind: "not", condition: { kind: "firstPlayer" } } },
        ]),
        { verb: "ShuffleEncounterDeck" },
      ],
    },
    { id: "19111:constant:1", cardCode: "19111", lines: ["19111:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: FRAMS_SHADE }] },
    {
      id: "19111:constant:2",
      cardCode: "19111",
      lines: ["19111:B:2"],
      timing: "constant",
      condition: { kind: "inVictory", code: "19097", is: true },
      instructions: [{ verb: "ModifyStat", stat: "gainsVictory", amount: 6, until: "whileSourceInPlay", holders: FRAMS_SHADE }],
    },
    { id: "19111:constant:3", cardCode: "19111", lines: ["19111:B:3"], timing: "constant", condition: { kind: "inVictory", code: "19098", is: false }, instructions: [{ verb: "Restrict", what: "advance" }] },
  ],
  { pool: [...FELLOWSHIP_OF_THE_RING, ...FIRE_IN_THE_NIGHT, ...LOST_IN_MIRKWOOD] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
