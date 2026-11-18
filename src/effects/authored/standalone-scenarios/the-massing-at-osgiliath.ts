import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Massing at Osgiliath (standalone-scenarios cycle part 1, no campaign card). Every line is read from the scan ledger (data/printed/). The players "have crossed the Anduin" on stage 4, Race to Minas Tirith (00019:B:2):
// the condition `onStage` 4 reads it live. Rules: rr.keywords, rr.defending-player, rr.travel, rr.active-location, rr.shadow-effects, faq.lasting-effects, faq.triggering-forced-effects (data/rules/entries.json).
const CROSSED: Condition = { kind: "onStage", stage: 4 };
const NOT_CROSSED: Condition = { kind: "not", condition: CROSSED };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const SCOUT_ENEMY: PickSpec = { type: "enemy", control: "any", trait: "Scout" };
const A_CHARACTER: PickSpec = { type: "character", control: "any" };
// "After ~ attacks and destroys a character": the destruction names the attacking enemy as the other card, and `isSource` keeps it to the copy that attacked (as helms-deep.ts).
const THIS_ENEMY: PickSpec = { type: "enemy", control: "any", isSource: true };
const ALLY_IN_HAND: PickSpec = { type: "card", control: "you", from: "hand", cardType: "ally" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
const ATTACK_PLUS = (amount: number, when?: Condition): Extract<Instruction, { verb: "ModifyStat" }> => ({ verb: "ModifyStat", stat: "attack", amount, until: "endOfAttack", target: "attacker", ...(when ? { when } : {}) });
const SELF_STAT = (stat: "attack" | "threat", amount: number): Instruction => ({ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "self" });
const ALLIES_IN_HAND = (min: number): Extract<Condition, { kind: "count" }> => ({ kind: "count", pick: ALLY_IN_HAND, min });
// The stage's travel bars: players cannot travel to locations with this Trait (as 145075:B:3).
const NO_TRAVEL = (...traits: readonly string[]): Instruction[] => traits.map((trait) => ({ verb: "Restrict", what: "travel", trait }));

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 00001 The Witch-king. Players cannot play attachments on him (noPlayerAttachments: player card attachments only, an encounter card may still attach); each character gets -1 Willpower while he is in the staging area; after he attacks (defended or not) the defending player either raises his threat by 3 or he returns to the staging area
  // (raising threat that would eliminate the player is allowed). He leaves the staging area only by an engagement check or an optional engagement.
  { id: "00001:constant:1", cardCode: "00001", lines: ["00001:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "00001:constant:2", cardCode: "00001", lines: ["00001:A:2"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "willpower", amount: -1, until: "whileSourceInPlay", holders: A_CHARACTER }] },
  {
    id: "00001:forced:1",
    cardCode: "00001",
    lines: ["00001:A:3"],
    timing: "forced",
    trigger: "attackResolved",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eventSeat" }] }, { id: "staging", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }],
  },

  // 00002 Snaga Scouts. At the beginning of the encounter phase every copy in play, in the staging area or engaged with another player, engages the player with the lowest threat; the first player chooses among tied players (agent recommendation (no ruling found), docs/brief.md).
  { id: "00002:forced:1", cardCode: "00002", lines: ["00002:A:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Encounter" }, instructions: [{ verb: "EngageLowestThreat" }] },

  // 00003 Wolves from Mordor. After they attack and destroy a character they shuffle into the encounter deck. Shadow: 2 damage to the defending character.
  { id: "00003:forced:1", cardCode: "00003", lines: ["00003:A:1"], timing: "forced", trigger: "characterDestroyedByAttack", subject: A_CHARACTER, condition: { kind: "matches", card: "other", pick: THIS_ENEMY }, instructions: [{ verb: "MoveEncounterCard", card: "self", to: "shuffle" }] },
  { id: "00003:shadow:1", cardCode: "00003", lines: ["00003:A:2"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 2, target: "defender" }] },

  // 00004 Wainriders. Each point of damage its attack places raises the defending player's threat by 1 (the flag damageToThreat, rules/families/defense/excess.ts).
  { id: "00004:constant:1", cardCode: "00004", lines: ["00004:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageToThreat", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 00005 Wainrider Captain. When Revealed: the top Scout enemy of the encounter discard pile (the top 2 once the players have crossed the Anduin) goes to the staging area, not revealed. Shadow: an undefended attack by a Scout enemy gets +2 Attack.
  {
    id: "00005:whenRevealed:1",
    cardCode: "00005",
    lines: ["00005:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ReturnFromDiscard", trait: "Scout", count: 1, when: NOT_CROSSED }, { verb: "ReturnFromDiscard", trait: "Scout", count: 2, when: CROSSED }],
  },
  { id: "00005:shadow:1", cardCode: "00005", lines: ["00005:A:2"], timing: "shadow", instructions: [ATTACK_PLUS(2, { kind: "all", conditions: [{ kind: "undefended" }, { kind: "matches", card: "attacker", pick: SCOUT_ENEMY }] })] },

  // 00006 Uruk Vanguard. +3 Attack once the players have crossed the Anduin. Shadow: +1 Attack, +2 instead once crossed.
  { id: "00006:constant:1", cardCode: "00006", lines: ["00006:A:1"], timing: "constant", condition: CROSSED, instructions: [SELF_STAT("attack", 3)] },
  { id: "00006:shadow:1", cardCode: "00006", lines: ["00006:A:2"], timing: "shadow", instructions: [ATTACK_PLUS(1, NOT_CROSSED), ATTACK_PLUS(2, CROSSED)] },

  // 00007 Captured Watchtower. +3 Threat once crossed. Shadow: the defending characters are removed from combat and the attack is undefended.
  { id: "00007:constant:1", cardCode: "00007", lines: ["00007:A:1"], timing: "constant", condition: CROSSED, instructions: [SELF_STAT("threat", 3)] },
  { id: "00007:shadow:1", cardCode: "00007", lines: ["00007:A:2"], timing: "shadow", instructions: [{ verb: "ConsiderUndefended" }] },

  // 00008 Emyn Arnen Overlook. While in play, the first Scout enemy revealed each round gains surge and doomed 2 (the marker FirstTraitSurge with `doomed`, rules/families/angmar/weather.ts).
  { id: "00008:constant:1", cardCode: "00008", lines: ["00008:A:1"], timing: "constant", instructions: [{ verb: "FirstTraitSurge", trait: "Scout", type: "enemy", doomed: 2 }] },

  // 00009 Morgulduin. While active it deals 1 damage to each character that commits to the quest, the Ranger of Ithilien that enters committed included. Shadow: before the players have crossed it replaces the active location (which returns to the staging area) and becomes the active location itself.
  { id: "00009:forced:1", cardCode: "00009", lines: ["00009:A:1"], timing: "forced", trigger: "committed", subject: A_CHARACTER, condition: ACTIVE, instructions: [{ verb: "DamageCard", amount: 1, target: "subject" }] },
  { id: "00009:shadow:1", cardCode: "00009", lines: ["00009:A:2"], timing: "shadow", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "activeLocation", when: NOT_CROSSED }] },

  // 00010 Pelennor Fields. Once crossed, while in the staging area: when the players are faced with the option to travel they must travel to a location named Pelennor Fields or raise each player's threat by 3 (TravelOrRaiseThreat, rules/families/sea/streets.ts).
  { id: "00010:constant:1", cardCode: "00010", lines: ["00010:A:1"], timing: "constant", condition: { kind: "all", conditions: [CROSSED, IN_STAGING] }, instructions: [{ verb: "TravelOrRaiseThreat", amount: 3 }] },

  // 00011 Ruins of Osgiliath. +3 Threat until the players have crossed.
  { id: "00011:constant:1", cardCode: "00011", lines: ["00011:A:1"], timing: "constant", condition: NOT_CROSSED, instructions: [SELF_STAT("threat", 3)] },

  // 00012 Cut Off. When Revealed: each player discards every ally card from his hand. Shadow: the defending player discards 1 ally card from his hand (2 if the attack is undefended; he must hold that many) or the attacking enemy gets +3 Attack.
  { id: "00012:whenRevealed:1", cardCode: "00012", lines: ["00012:A:2"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "DiscardEach", pick: ALLY_IN_HAND }])] },
  {
    id: "00012:shadow:1",
    cardCode: "00012",
    lines: ["00012:A:3"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "discard", requires: { kind: "all", conditions: [{ kind: "undefended", is: false }, ALLIES_IN_HAND(1)] }, instructions: [{ verb: "Pick", pick: ALLY_IN_HAND }, { verb: "DiscardPicked" }] },
          {
            id: "discardTwo",
            requires: { kind: "all", conditions: [{ kind: "undefended" }, ALLIES_IN_HAND(2)] },
            instructions: [{ verb: "Pick", pick: ALLY_IN_HAND }, { verb: "DiscardPicked" }, { verb: "Pick", pick: { ...ALLY_IN_HAND, different: true } }, { verb: "DiscardPicked" }],
          },
          { id: "attack", instructions: [ATTACK_PLUS(3)] },
        ],
      },
    ],
  },

  // 00013 Dark Pursuit. When Revealed: the total Threat of the staging area is raised, for the phase, by 1 for each Scout enemy in play, counted live (an encounter card's lasting effect, faq.lasting-effects); with no Scout enemy in play it gains surge.
  {
    id: "00013:whenRevealed:1",
    cardCode: "00013",
    lines: ["00013:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "RaiseStagingThreat", live: "scoutEnemiesInPlay", until: "endOfPhase" }, { verb: "GainSurge", when: { kind: "count", pick: { ...SCOUT_ENEMY, staging: true }, max: 0 } }],
  },

  // 00014 Massing at Osgiliath. When Revealed: until the end of the phase each card revealed gains doomed 1 (doomed 3 once crossed), recalculated as each is revealed.
  { id: "00014:whenRevealed:1", cardCode: "00014", lines: ["00014:A:2"], timing: "whenRevealed", instructions: [{ verb: "RevealedGainDoomed", amount: 1, instead: { stage: 4, amount: 3 }, until: "endOfPhase" }] },

  // 00015 Ranger of Ithilien (objective ally). When Revealed: the first player takes control of it, exhausted and (in the quest phase) committed to the quest, then it gains surge. Shadow: 2 damage to the attacking enemy; the defending player may
  // exhaust a ready character he controls to take control of it (it enters play ready), else it is discarded like any shadow card.
  {
    id: "00015:whenRevealed:1",
    cardCode: "00015",
    lines: ["00015:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "TakeControl", who: "firstPlayer" }, { verb: "Exhaust", target: { kind: "ref", ref: "self" } }, { verb: "CommitToQuest", target: "self", when: { kind: "phase", is: "Quest" } }, { verb: "GainSurge" }],
  },
  {
    id: "00015:shadow:1",
    cardCode: "00015",
    lines: ["00015:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "DamageCard", amount: 2, target: "attacker" },
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "take", requires: { kind: "canPick", pick: READY_CHARACTER }, instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "TakeControl", who: "actor" }] },
          { id: "decline", instructions: [] },
        ],
      },
    ],
  },

  // 00016 Beyond Expectations (stage 1). Setup: the scenario's piles search the Scouts, one of each title per player, into the staging area, set the Witch-king aside and shuffle the rest (the record owns the line). 1B: no travel to West Bank locations.
  { id: "00016:setup:1", cardCode: "00016", lines: ["00016:A:1"], timing: "setup", instructions: [] },
  { id: "00016:constant:1", cardCode: "00016", lines: ["00016:B:1"], timing: "constant", instructions: NO_TRAVEL("West Bank") },

  // 00017 Through the Ruins (stage 2). No travel to West Bank locations. Each player may play or put into play at most 1 card from his hand each round (LimitHandPlaysPerRound, rules/families/wilderland/rounds.ts).
  { id: "00017:constant:1", cardCode: "00017", lines: ["00017:B:1"], timing: "constant", instructions: NO_TRAVEL("West Bank") },
  { id: "00017:constant:2", cardCode: "00017", lines: ["00017:B:2"], timing: "constant", instructions: [{ verb: "LimitHandPlaysPerRound", max: 1 }] },

  // 00018 Anduin Crossing (stage 3). Progress from card effects cannot go on the quest card or the active location (the flag noEffectProgress); no travel to East Bank or West Bank locations; before committing, a player chooses a hero or a Ranger of Ithilien he controls and discards it
  // (the choice comes at the beginning of the quest phase; a player who commits nothing pays nothing and his characters cannot commit).
  { id: "00018:constant:1", cardCode: "00018", lines: ["00018:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noEffectProgress", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "00018:constant:2", cardCode: "00018", lines: ["00018:B:2"], timing: "constant", instructions: NO_TRAVEL("East Bank", "West Bank") },
  {
    id: "00018:forced:1",
    cardCode: "00018",
    lines: ["00018:B:3"],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "phase", is: "Quest" },
    instructions: [
      EACH_PLAYER([
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "hero", requires: { kind: "canPick", pick: { type: "hero", control: "you" } }, instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] },
            { id: "ranger", requires: { kind: "canPick", pick: { type: "ally", control: "you", names: ["Ranger of Ithilien"] } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", names: ["Ranger of Ithilien"] } }, { verb: "Discard", target: { kind: "picked" } }] },
            { id: "none", instructions: [{ verb: "ModifyStat", stat: "cannotQuest", amount: 1, until: "endOfPhase", target: "ownCharacters" }] },
          ],
        },
      ]),
    ],
  },

  // 00019 Race to Minas Tirith (stage 4). When Revealed: the set-aside Witch-king is added to the staging area (not revealed). The players have crossed the Anduin (the stage itself). No travel to East Bank locations. Defeating this stage wins the game (the last stage: the engine's win).
  { id: "00019:whenRevealed:1", cardCode: "00019", lines: ["00019:B:1"], timing: "whenRevealed", instructions: [{ verb: "StageSetAside", code: "00001" }] },
  { id: "00019:constant:1", cardCode: "00019", lines: ["00019:B:2"], timing: "constant", instructions: NO_TRAVEL("East Bank") },
  { id: "00019:constant:2", cardCode: "00019", lines: ["00019:B:3"], timing: "constant", instructions: [] },
];

export const AUTHORED_REPLACES: readonly string[] = [];
