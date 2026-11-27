import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Black Serpent (haradrim cycle part 7, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json). See docs/scenarios/haradrim/the-black-serpent.md, Readings, for each reading.
// The three Harad objectives are set aside by the piles; the Setup, stage 2A and stage 3A reveal or attach one at random (RevealRandomSetAside, AttachRandomSetAside). Guarded (X) is GuardObjective with `types` (hrd.guarded-x). An objective is "attached to an encounter card"
// while an encounter card guards it or it hangs on one (the pick filter `onEncounter`); the stages claim a Harad objective that nothing holds (ClaimUnattached) and refuse to advance while one is not on a hero.
// Rules: hrd.guarded-x, hrd.guarded-x-example, hrd.stage-number, rr.guarded, rr.objective-cards, rr.attachment-cards, rr.engaged, rr.first-player, rr.forced, rr.shadow-effects, rr.cancel, rr.travel, bts.valour
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];
type Option = Extract<Instruction, { verb: "Choose" }>["options"][number];

const SERPENT = "17094";
const STAGE_1 = "17106";
const STAGE_2 = "17107";
const STAGE_3 = "17108";

// A Harad objective a player controls (claimed, attached to a hero), and one an encounter card guards or hangs on.
const HARAD_CONTROLLED: PickSpec = { type: "objective", control: "any", trait: "Harad", controlled: true };
const MY_HARAD_OBJECTIVE: PickSpec = { type: "objective", control: "you", trait: "Harad", controlled: true };
const HARAD_ON_ENCOUNTER: PickSpec = { type: "objective", control: "any", trait: "Harad", onEncounter: true };
const HARAD_STAGED_FREE: PickSpec = { type: "objective", control: "any", trait: "Harad", stagingOnly: true, onEncounter: false };
const HARAD_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Harad" };
const HARAD_ENEMY_ENGAGED_WITH_YOU: PickSpec = { type: "enemy", control: "any", trait: "Harad", engaged: "you" };
const HERO_WITH_OBJECTIVE: PickSpec = { type: "hero", control: "any", holdsObjective: true };
const STAGED_LOCATION: PickSpec = { type: "location", control: "any" };
const STAGED_NON_UNIQUE_ENCOUNTER_CARD: PickSpec = { type: "card", control: "any", stagingOnly: true, nonUnique: true, nonObjective: true };

// "While <the objective> is attached to an encounter card".
const ATTACHED_TO_ENCOUNTER: Cond = { kind: "matches", card: "self", pick: { type: "objective", control: "any", onEncounter: true } };
const IN_STAGING: Cond = { kind: "sourceIn", zone: "staging" };
const ENCOUNTER_PHASE_END = { trigger: "endOfPhase", condition: { kind: "phase", is: "Encounter" } } as const;
// "The players cannot defeat this stage unless each Harad objective in play is attached to a hero": one in the staging area (free or guarded) or hanging on an encounter card.
const A_HARAD_OBJECTIVE_NOT_ON_A_HERO: Cond = { kind: "any", conditions: [{ kind: "canPick", pick: HARAD_ON_ENCOUNTER }, { kind: "canPick", pick: HARAD_STAGED_FREE }] };
// "If this attack destroys a character": the attack's X is the characters it destroyed.
const DESTROYED_A_CHARACTER: Cond = { kind: "x", min: 1 };
// The attack destroyed a character, a Harad objective is on a hero the defender controls and a non-unique encounter card is in the staging area (17102:A:2).
const CAN_ATTACH_TO_STAGED: Cond = { kind: "all", conditions: [DESTROYED_A_CHARACTER, { kind: "canPick", pick: MY_HARAD_OBJECTIVE }, { kind: "canPick", pick: STAGED_NON_UNIQUE_ENCOUNTER_CARD }] };
// "If attacking enemy is non-unique" (17101:A:3).
const NON_UNIQUE_ATTACKER: Cond = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", nonUnique: true } };
const STAGE_PROGRESS_IS_HELD: Cond = { kind: "stageProgress", min: 1 };
// X is the stage number of the main quest (hrd.stage-number).
const X = { stage: true } as const;

// "Either remove <amount> progress from the main quest, or ...": the option is offered only while the main quest holds progress.
const progressOption = (amount: number | { stage: true }): Option => ({ id: "progress", requires: STAGE_PROGRESS_IS_HELD, instructions: [{ verb: "RemoveProgressFromQuest", amount }] });
const noDamageOption = (target: "attacker" | "engaged"): Option => ({
  id: "noDamage",
  instructions: [
    target === "attacker"
      ? { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", target: "attacker" }
      : { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "endOfRound", holders: { type: "enemy", control: "any", engaged: "you" } },
  ],
});

// Guarded (X) (hrd.guarded-x): the objective is guarded by the first discarded card of a listed type when it is revealed.
// A Harad objective a hero holds that leaves play stays in play: it returns to the staging area (rr.objective-cards "Objective cards remain in play", agent recommendation: docs/scenarios/haradrim/the-black-serpent.md, Readings).
const guarded = (code: string, types: ("enemy" | "location")[]): Effect[] => [
  { id: `${code}:whenRevealed:1`, cardCode: code, lines: [`${code}:A:1`], timing: "whenRevealed", instructions: [{ verb: "GuardObjective", types }] },
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
];

// "Each Harad objective the players control" is a count of controlled objectives.
const HARAD_COUNT = { count: HARAD_CONTROLLED };

// The same Action on three objectives: exhaust it and raise your threat by 1 to ... (the player who controls it, a hero holds it).
const objectiveAction = (code: string, line: string, instructions: Instruction[]): Effect => ({
  id: `${code}:action:1`,
  cardCode: code,
  lines: [line],
  timing: "action",
  // Only the player who controls the objective may use it: a hero holds it, not the staging area or an encounter card (rr.guarded, rr.objective-cards).
  condition: { kind: "attachedToHero", code, is: true },
  cost: [{ kind: "exhaustSelf" }, { kind: "raiseThreat", amount: 1 }],
  instructions,
});

// "Attached encounter card": the card that guards the objective or the one it hangs on, of either type.
const ATTACHED_ENCOUNTER_CARD = (type: "enemy" | "location"): PickSpec => ({ type, control: "any", staging: true, linkedToSource: true });

// The claim and the "cannot defeat" lines every stage of The Black Serpent prints (17106:B:1, B:2).
const claimLine = (code: string, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "ClaimUnattached", trait: "Harad" }] });
const cannotDefeatLine = (code: string, line: string, id: string): Effect => ({ id, cardCode: code, lines: [line], timing: "constant", condition: A_HARAD_OBJECTIVE_NOT_ON_A_HERO, instructions: [{ verb: "Restrict", what: "advance" }] });

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 17091 Banner of the Serpent. Guarded (enemy or location). While attached to an encounter card each Harad enemy gets +1 Attack. Action: exhaust it and raise your threat by 1 to give each Harad enemy engaged with you -1 Attack until the end of the phase.
  ...guarded("17091", ["enemy", "location"]),
  {
    id: "17091:constant:2",
    cardCode: "17091",
    lines: ["17091:A:2"],
    timing: "constant",
    condition: ATTACHED_TO_ENCOUNTER,
    instructions: [{ verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", holders: HARAD_ENEMY }],
  },
  objectiveAction("17091", "17091:A:3", [{ verb: "ModifyStat", stat: "attack", amount: -1, until: "endOfPhase", holders: HARAD_ENEMY_ENGAGED_WITH_YOU }]),

  // 17092 The Serpent's Garb. Guarded (enemy). The attached encounter card gets +2 Threat and is immune to player card effects. Action: a Harad enemy in the staging area gets -2 Threat until the end of the phase.
  ...guarded("17092", ["enemy"]),
  {
    id: "17092:constant:2",
    cardCode: "17092",
    lines: ["17092:A:2"],
    timing: "constant",
    instructions: (["enemy", "location"] as const).flatMap((type): Instruction[] => [
      { verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", holders: ATTACHED_ENCOUNTER_CARD(type) },
      { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: ATTACHED_ENCOUNTER_CARD(type) },
    ]),
  },
  objectiveAction("17092", "17092:A:3", [
    { verb: "Pick", pick: { ...HARAD_ENEMY, stagingOnly: true } },
    { verb: "ModifyStat", stat: "threat", amount: -2, until: "endOfPhase", target: "picked" },
  ]),

  // 17093 Summons from Mordor. Guarded (location). While attached to an encounter card no player's threat can be reduced. Action: add 1 resource to the pool of the hero it is attached to.
  ...guarded("17093", ["location"]),
  {
    id: "17093:constant:2",
    cardCode: "17093",
    lines: ["17093:A:2"],
    timing: "constant",
    condition: ATTACHED_TO_ENCOUNTER,
    instructions: [{ verb: "ModifyStat", stat: "threatReductionBarred", amount: 1, until: "whileSourceInPlay", target: "eachSeat" }],
  },
  objectiveAction("17093", "17093:A:3", [{ verb: "AddResources", amount: 1, to: "host" }]),

  // 17094 The Black Serpent. A:1: it cannot leave the staging area or take damage (stage 3B's 6 progress end both: losesNoDamage, losesCannotLeaveStaging). X is the stage number of the main quest. A:2: +X Threat, Attack and Defense. A:3: at the end of the encounter phase the first
  // player chooses to remove X progress from the main quest (offered while it holds progress) or the Serpent makes an attack against the first player from the staging area.
  {
    id: "17094:constant:1",
    cardCode: SERPENT,
    lines: ["17094:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
      { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" },
    ],
  },
  {
    id: "17094:constant:2",
    cardCode: SERPENT,
    lines: ["17094:A:2"],
    timing: "constant",
    instructions: (["threat", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: X, until: "whileSourceInPlay", target: "self" })),
  },
  {
    id: "17094:forced:1",
    cardCode: SERPENT,
    lines: ["17094:A:3"],
    timing: "forced",
    ...ENCOUNTER_PHASE_END,
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [progressOption(X), { id: "attack", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] }] }],
  },

  // 17095 Serpent Guard. Forced: after it engages you, either remove 2 progress from the main quest, or the enemies engaged with you cannot take damage this round. Shadow: the defending player chooses between 2 progress and the attacker taking no damage this round.
  {
    id: "17095:forced:1",
    cardCode: "17095",
    lines: ["17095:A:1"],
    timing: "forced",
    trigger: "engaged",
    subject: "self",
    instructions: [{ verb: "Choose", who: "actor", options: [progressOption(2), noDamageOption("engaged")] }],
  },
  { id: "17095:shadow:1", cardCode: "17095", lines: ["17095:A:2"], timing: "shadow", instructions: [{ verb: "Choose", who: "actor", options: [progressOption(2), noDamageOption("attacker")] }] },

  // 17096 The Serpent's Redoubt. While in the staging area: after a player plays an ally from his hand, that player either removes 1 progress from the main quest or exhausts that ally. Travel: the first player searches the encounter deck and discard pile for an enemy
  // and puts it into play engaged with him; the encounter deck is shuffled.
  {
    id: "17096:forced:1",
    cardCode: "17096",
    lines: ["17096:A:1"],
    timing: "forced",
    trigger: "played",
    subject: { type: "card", control: "any", cardType: "ally" },
    condition: IN_STAGING,
    instructions: [{ verb: "Choose", who: "actor", options: [progressOption(1), { id: "exhaust", instructions: [{ verb: "Exhaust", target: { kind: "ref", ref: "subject" } }] }] }],
  },
  { id: "17096:travel:1", cardCode: "17096", lines: ["17096:A:2"], timing: "travel", instructions: [{ verb: "SearchMove", type: "enemy", to: "engagedFirstPlayer" }, { verb: "ShuffleEncounterDeck" }] },

  // 17097 Roofless Tower. While in the staging area: when a player plays an event, that player either removes 1 progress from the main quest or the event's effects are canceled (the event is still played). Travel: exhaust a hero.
  {
    id: "17097:forced:1",
    cardCode: "17097",
    lines: ["17097:A:1"],
    timing: "forced",
    trigger: "played",
    subject: { type: "card", control: "any", cardType: "event" },
    condition: IN_STAGING,
    instructions: [{ verb: "Choose", who: "actor", options: [progressOption(1), { id: "cancel", instructions: [{ verb: "CancelEventEffects" }] }] }],
  },
  {
    id: "17097:travel:1",
    cardCode: "17097",
    lines: ["17097:A:2"],
    timing: "travel",
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", state: "ready", who: "firstPlayer" } }, { verb: "Exhaust", target: { kind: "picked" } }],
  },

  // 17098 Desert Bastion. +1 Threat for each Harad objective the players control. Shadow: the attacking enemy gets +1 Attack for each of them.
  { id: "17098:constant:1", cardCode: "17098", lines: ["17098:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: HARAD_COUNT, until: "whileSourceInPlay", target: "self" }] },
  { id: "17098:shadow:1", cardCode: "17098", lines: ["17098:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: HARAD_COUNT, until: "endOfAttack", target: "attacker" }] },

  // 17099 Southron Camp. While in the staging area: at the end of the round all progress comes off each location in play. Travel: raise each player's threat by 1.
  {
    id: "17099:forced:1",
    cardCode: "17099",
    lines: ["17099:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    condition: IN_STAGING,
    instructions: [{ verb: "RemoveAllProgress", pick: STAGED_LOCATION }],
  },
  { id: "17099:travel:1", cardCode: "17099", lines: ["17099:A:2"], timing: "travel", instructions: [{ verb: "RaiseThreat", amount: 1, who: "eachSeat" }] },

  // 17100 Broken Courtyard (Surge is a keyword). While in the staging area the main quest takes no progress beyond its quest points. Shadow: either 2 progress comes off the main quest or the attacking enemy returns to the staging area after the attack.
  {
    id: "17100:constant:1",
    cardCode: "17100",
    lines: ["17100:A:2"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [{ verb: "ModifyStat", stat: "stageCapped", amount: 1, until: "whileSourceInPlay", target: "currentQuest" }],
  },
  {
    id: "17100:shadow:1",
    cardCode: "17100",
    lines: ["17100:A:3"],
    timing: "shadow",
    instructions: [{ verb: "Choose", who: "actor", options: [progressOption(2), { id: "staging", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }] }] }],
  },

  // 17101 Doomed 1 and Surge are keywords. When Revealed: 1 damage to each hero with an objective attached. Shadow: if the attacker is non-unique, the defending player either attaches a Harad objective he controls to it (it guards the objective, detached from the hero) or it makes an additional attack.
  { id: "17101:whenRevealed:1", cardCode: "17101", lines: ["17101:A:2"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: HERO_WITH_OBJECTIVE }] },
  {
    id: "17101:shadow:1",
    cardCode: "17101",
    lines: ["17101:A:3"],
    timing: "shadow",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "attach",
            requires: { kind: "all", conditions: [NON_UNIQUE_ATTACKER, { kind: "canPick", pick: MY_HARAD_OBJECTIVE }] },
            instructions: [{ verb: "Pick", pick: MY_HARAD_OBJECTIVE }, { verb: "AttachGuard", guard: "attacker", to: "picked", detach: true, stayEngaged: true }],
          },
          { id: "attack", requires: NON_UNIQUE_ATTACKER, instructions: [{ verb: "ImmediateAttack", afterThis: true }] },
        ],
      },
    ],
  },

  // 17102 When Revealed: the first player either reveals 2 encounter cards, or detaches a Harad objective from a hero, reveals it (its Guarded resolves) and adds it to the staging area. Shadow: if the attack destroys a character, the defending player attaches a Harad objective
  // he controls to a non-unique encounter card in the staging area.
  {
    id: "17102:whenRevealed:1",
    cardCode: "17102",
    lines: ["17102:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "reveal", instructions: [{ verb: "RevealEncounter", times: 2, who: "firstPlayer" }] },
          { id: "detach", requires: { kind: "canPick", pick: HARAD_CONTROLLED }, instructions: [{ verb: "Pick", pick: { ...HARAD_CONTROLLED, who: "firstPlayer" } }, { verb: "RevealDetached" }] },
        ],
      },
    ],
  },
  {
    id: "17102:shadow:1",
    cardCode: "17102",
    lines: ["17102:A:2"],
    timing: "shadow",
    instructions: [
      {
        verb: "AfterAttack",
        instructions: [
          { verb: "Pick", pick: MY_HARAD_OBJECTIVE, when: CAN_ATTACH_TO_STAGED },
          { verb: "Pick", pick: STAGED_NON_UNIQUE_ENCOUNTER_CARD, when: CAN_ATTACH_TO_STAGED },
          { verb: "AttachGuard", guard: "picked", to: "previous", detach: true, when: CAN_ATTACH_TO_STAGED },
        ],
      },
    ],
  },

  // 17103 When Revealed: the first player chooses between raising each player's threat by 3 and no progress being placed on quest cards until the end of the round. Shadow: +1 Attack; if the attack destroys a character, all progress comes off the main quest.
  {
    id: "17103:whenRevealed:1",
    cardCode: "17103",
    lines: ["17103:A:1"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "Choose",
        who: "firstPlayer",
        options: [
          { id: "threat", instructions: [{ verb: "RaiseThreat", amount: 3, who: "eachSeat" }] },
          { id: "noProgress", instructions: [{ verb: "ModifyStat", stat: "noQuestProgress", amount: 1, until: "endOfRound", target: "table" }] },
        ],
      },
    ],
  },
  {
    id: "17103:shadow:1",
    cardCode: "17103",
    lines: ["17103:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
      { verb: "AfterAttack", instructions: [{ verb: "RemoveAllQuestProgress", of: "stage", when: DESTROYED_A_CHARACTER }] },
    ],
  },

  // 17104 Don't Let Them Escape! (encounter side quest). A:1: while it is the current quest, all progress comes off the main quest at the end of the round. A:2: each time it becomes the current quest, 1 encounter card is revealed.
  {
    id: "17104:forced:1",
    cardCode: "17104",
    lines: ["17104:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    condition: { kind: "currentQuest", is: "self" },
    instructions: [{ verb: "RemoveAllQuestProgress", of: "stage" }],
  },
  { id: "17104:forced:2", cardCode: "17104", lines: ["17104:A:2"], timing: "forced", trigger: "becameCurrentQuest", subject: "self", instructions: [{ verb: "RevealEncounter" }] },

  // 17106 The Crossroads Fort. Setup: the Harad objectives are set aside and The Black Serpent is staged by the piles; the encounter deck is shuffled and the first player reveals a random set aside Harad objective (Guarded (X) resolves), adding it to the staging area.
  // B:1 claims every unguarded Harad objective in the staging area for a hero of the first player; B:2 stops the stage while one is not on a hero.
  {
    id: "17106:setup:1",
    cardCode: STAGE_1,
    lines: ["17106:A:1"],
    timing: "setup",
    instructions: [{ verb: "ShuffleEncounterDeck" }, { verb: "RevealRandomSetAside", trait: "Harad" }],
  },
  claimLine(STAGE_1, "17106:B:1"),
  cannotDefeatLine(STAGE_1, "17106:B:2", "17106:constant:2"),

  // 17107 Battle in the Camp. A:1: the encounter discard pile is shuffled into the deck and the first player reveals another random set aside Harad objective (none left: nothing). B:2: the Serpent is considered engaged with each player who controls a Harad objective.
  {
    id: "17107:whenRevealed:1",
    cardCode: STAGE_2,
    lines: ["17107:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ShuffleEncounterDiscard" }, { verb: "ActAs", who: "firstPlayer" }, { verb: "RevealRandomSetAside", trait: "Harad" }],
  },
  claimLine(STAGE_2, "17107:B:1"),
  {
    id: "17107:constant:2",
    cardCode: STAGE_2,
    lines: ["17107:B:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "engagedWithClaimers", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["The Black Serpent"] } },
      { verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["The Black Serpent"] }, when: { kind: "canPick", pick: HARAD_CONTROLLED } },
    ],
  },
  cannotDefeatLine(STAGE_2, "17107:B:3", "17107:constant:3"),

  // 17108 Defeat the Serpent. A:1: a random set aside Harad objective is attached to The Black Serpent (not revealed: no Guarded); the discard pile is shuffled into the deck and each player reveals 1 encounter card. B:2: with 6 progress here the Serpent loses its first sentence.
  {
    id: "17108:whenRevealed:1",
    cardCode: STAGE_3,
    lines: ["17108:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "Pick", pick: { type: "enemy", control: "any", staging: true, names: ["The Black Serpent"] } },
      { verb: "AttachRandomSetAside", trait: "Harad" },
      { verb: "ShuffleEncounterDiscard" },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] },
    ],
  },
  claimLine(STAGE_3, "17108:B:1"),
  {
    id: "17108:constant:2",
    cardCode: STAGE_3,
    lines: ["17108:B:2"],
    timing: "constant",
    condition: { kind: "stageProgress", min: 6 },
    instructions: (["losesNoDamage", "losesCannotLeaveStaging"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", staging: true, names: ["The Black Serpent"] } })),
  },
  cannotDefeatLine(STAGE_3, "17108:B:3", "17108:constant:3"),
];

export const AUTHORED_REPLACES: readonly string[] = [];
