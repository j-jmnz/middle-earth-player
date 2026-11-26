import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

// Records for The Three Trials (The Ring-maker part 5, no campaign card): the five stages (the trial loop: each stage 2A sets cards aside into play and marks the current trial's Key, each 2B ends when a hero holds that Key and advances to a stage of the players' choice), the three Guardians
// (Time X and the Forced effect that hits the engaged player), the three Keys, the four Barrow locations and the encounter cards no template reads. Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints
// word for word needs no record here. The verbs of the box are in src/catalog/families/ring-maker.ts (the trial loop) and src/catalog/families/angmar.ts (Time X).
// Rules: rm.current-trial, rm.setup-the-three-trials, rm.time-x, rm.immune-to-player-card-effects, rr.reveal, rr.search, rr.engaged, rr.objective-cards, rr.attachment-cards, rr.attacks-outside-the-combat-phase, rr.travel, rr.cost, rr.setup, rr.forced, rr.cannot, rr.quest-advancement (data/rules/entries.json).
const STAGE_1 = "08035";
const STAGE_3 = "08039";
const TRIAL_STAGES = ["08036", "08037", "08038"];
const GUARDIANS: readonly [code: string, key: string, time: number][] = [
  ["08040", "08043", 2],
  ["08041", "08044", 3],
  ["08042", "08045", 4],
];

const GUARDIAN_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Guardian" };
const STAGED_GUARDIAN: PickSpec = { type: "enemy", control: "any", stagingOnly: true, trait: "Guardian" };
// "Key objectives the players control": a Key attached to a hero (claimed), not one lying on a Guardian or in the staging area.
const KEYS: PickSpec = { type: "objective", control: "any", trait: "Key", controlled: true };
const READY_KEY: PickSpec = { type: "objective", control: "any", trait: "Key", controlled: true, state: "ready" };
const OWN_ALLY: PickSpec = { type: "ally", control: "you" };
const OWN_CHARACTER: PickSpec = { type: "character", control: "you" };
const ANY_ALLY: PickSpec = { type: "ally", control: "any" };
const TIME_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, timeCounter: true };
const ENGAGED_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", seats: "engaged", instructions });
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ATTACKER_IS_GUARDIAN: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", trait: "Guardian" } };
const KEYS_COUNT = { count: KEYS } as const;

// "The players advance to a stage 2A quest of their choice. If all stage 2 quests have been defeated, advance to stage 3A" (08035:B:1, 08036:B:2 to 08038:B:2).
const ADVANCE: Instruction = { verb: "AdvanceToChosenStage", codes: TRIAL_STAGES, otherwise: STAGE_3 };
// "Randomly choose 1 of the remaining set aside ..." and the Key that shares a Trait with the card just picked; the Key is the current trial's (`trialKey`).
const pickSetAside = (cardType: "enemy" | "location" | "objective", trait: string, more?: { sharesTraitWithPicked: true; trialKey: true }): Instruction => ({ verb: "PickSetAside", cardType, trait, ...more });
const PICK_KEY = pickSetAside("objective", "Key", { sharesTraitWithPicked: true, trialKey: true });
const PICK_RANDOM_KEY: Instruction = { verb: "PickSetAside", cardType: "objective", trait: "Key", trialKey: true };
const stage = (id: string, line: string, timing: "whenRevealed" | "constant", instructions: Instruction[], condition?: Condition): Effect => ({ id, cardCode: id.slice(0, 5), lines: [line], timing, ...(condition ? { condition } : {}), instructions }) as Effect;
// The 2B of each trial: the Guardians engage the first player (the sweep of families/ring-maker/trial-sweeps.ts) and, when a hero holds the current trial's Key, the cards the trial names go to the victory display and the players choose the next stage.
const trialEnd = (code: string, line: string, toVictory: Instruction[]): Effect => ({ id: `${code}:triggered:1`, cardCode: code, lines: [line], timing: "triggered", trigger: "trialKeyControlled", instructions: [...toVictory, ADVANCE] }) as Effect;
const engages: Instruction = { verb: "EngageSeat", who: "firstPlayer", trait: "Guardian" };

// The Guardian's Time X line: it holds X time counters when revealed and loses one at the end of each refresh phase; when the last goes the effect hits the engaged player (none engaged: nothing) and the Guardian puts its counters on again.
const guardian = (code: string, time: number, hit: Instruction[]): Effect[] => [
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:2`], timing: "constant", instructions: [{ verb: "Time", amount: time }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [...hit, { verb: "PlaceResourceTokens", amount: time, on: "self" }] },
];

// A Key (08043 to 08045): it is claimed by the first player the moment it lies unattached in the staging area, and goes back there when it is discarded; the Shadow line shuffles it into the encounter deck. Attached to a Guardian or a Barrow by a stage 2A it lies claimed on its host: the claim text works only unattached.
const key = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ClaimWhenFree" }, { verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: `${code}:forced:1`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "leftPlay", subject: "self", condition: { kind: "sourceIn", zone: "encounterDiscard" }, instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },
  { id: `${code}:forced:2`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "encounterDiscarded", subject: "self", condition: { kind: "sourceIn", zone: "encounterDiscard" }, instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },
  { id: `${code}:shadow:1`, cardCode: code, lines: [`${code}:A:3`], timing: "shadow", instructions: [{ verb: "ShuffleSelfIntoEncounterDeck" }] },
];

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 08035 The Trials Begin. Setup: the ten cards are set aside by the piles. 1B: the players advance to a stage 2A of their choice.
  { id: "08035:setup:1", cardCode: STAGE_1, lines: ["08035:A:1"], timing: "setup", instructions: [] },
  stage("08035:whenRevealed:1", "08035:B:1", "whenRevealed", [ADVANCE]),

  // 08036 The Trial of Strength. 2A: a random Guardian and Barrow are revealed (staging); the Key that shares a Trait with the Guardian lies on it. 2B: Guardians engage the first player; Barrows cannot be the active location and are immune to player card effects.
  stage("08036:whenRevealed:1", "08036:A:1", "whenRevealed", [pickSetAside("location", "Barrow"), { verb: "RevealCard" }, pickSetAside("enemy", "Guardian"), { verb: "RevealCard" }, PICK_KEY, { verb: "AttachPickedToPrevious" }]),
  stage("08036:constant:1", "08036:B:1", "constant", [engages]),
  stage("08036:constant:2", "08036:B:1", "constant", [{ verb: "Restrict", what: "travel", trait: "Barrow" }]),
  stage("08036:constant:3", "08036:B:1", "constant", [{ verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", staging: true, trait: "Barrow" } }]),
  trialEnd("08036", "08036:B:2", [{ verb: "AddInPlayToVictory", cardType: "location", trait: "Barrow" }]),

  // 08037 The Trial of Perseverance. 2A: a random Barrow is staged, a random Key lies on it, the Guardian that shares a Trait with the Key is revealed. 2B: Guardians engage the first player, cannot be damaged and cannot leave play except by a quest effect.
  stage("08037:whenRevealed:1", "08037:A:1", "whenRevealed", [pickSetAside("location", "Barrow"), { verb: "AddPickedToStaging" }, PICK_RANDOM_KEY, { verb: "AttachPickedToPrevious" }, { verb: "PickSetAside", cardType: "enemy", trait: "Guardian", sharesTraitWithPicked: true }, { verb: "RevealCard" }]),
  stage("08037:constant:1", "08037:B:1", "constant", [engages]),
  stage("08037:constant:2", "08037:B:1", "constant", [
    { verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", holders: GUARDIAN_ENEMY },
    { verb: "ModifyStat", stat: "cannotLeavePlay", amount: 1, until: "whileSourceInPlay", holders: GUARDIAN_ENEMY },
  ]),
  trialEnd("08037", "08037:B:2", [{ verb: "AddInPlayToVictory", cardType: "enemy", trait: "Guardian" }]),

  // 08038 The Trial of Intuition. 2A: a random Guardian and Barrow are revealed, the discard pile is shuffled in and the matching Key goes into the bottom 10 cards (the picks are made in the order that keeps the Guardian the card the Key is matched to; nothing between them reads the deck). 2B: Guardians engage the first player; progress is turned into discards from the encounter deck (the active location took its share first).
  stage("08038:whenRevealed:1", "08038:A:1", "whenRevealed", [pickSetAside("location", "Barrow"), { verb: "RevealCard" }, pickSetAside("enemy", "Guardian"), { verb: "RevealCard" }, { verb: "ShuffleEncounterDiscard" }, PICK_KEY, { verb: "ShufflePickedIntoBottom", count: 10 }]),
  stage("08038:constant:1", "08038:B:1", "constant", [engages]),
  stage("08038:constant:2", "08038:B:1", "constant", [{ verb: "ModifyStat", stat: "progressDiscards", amount: 1, until: "whileSourceInPlay", target: "currentQuest" }]),
  trialEnd("08038", "08038:B:2", [{ verb: "AddInPlayToVictory", cardType: "enemy", trait: "Guardian" }, { verb: "AddInPlayToVictory", cardType: "location", trait: "Barrow" }]),

  // 08039 The Antlered Crown. 3A: Hallowed Circle joins the staging area; each Guardian in the victory display is revealed again. 3B: each Guardian engages the player who controls the Key it shares a Trait with; the stage is defeated only with Hallowed Circle in the victory display, and defeating it wins.
  stage("08039:whenRevealed:1", "08039:A:1", "whenRevealed", [{ verb: "AddSetAsideToStaging", code: "08049" }, { verb: "RevealFromVictory", trait: "Guardian" }]),
  stage("08039:constant:1", "08039:B:1", "constant", [{ verb: "EngageSeat", who: "keyHolder", trait: "Guardian" }]),
  stage("08039:constant:2", "08039:B:2", "constant", [{ verb: "Restrict", what: "advance" }], { kind: "inVictory", code: "08049", is: false }),

  // 08040 to 08042 The Guardians. Cannot have non-Key attachments (the build writes it). Time X; the Forced effect on the engaged player.
  ...guardian("08040", 2, [ENGAGED_PLAYER([{ verb: "Pick", pick: OWN_ALLY, when: { kind: "canPick", pick: OWN_ALLY } }, { verb: "Discard", target: { kind: "picked" }, when: { kind: "canPick", pick: OWN_ALLY } }])]),
  ...guardian("08041", 3, [{ verb: "ImmediateAttack" }]),
  ...guardian("08042", 4, [ENGAGED_PLAYER([{ verb: "DamageEach", amount: 1, pick: OWN_CHARACTER }])]),

  // 08043 to 08045 The Keys of the Boar, the Wolf and the Raven.
  ...GUARDIANS.flatMap(([, keyCode]) => key(keyCode)),

  // 08046 Hill Barrow. Forced: when a Guardian attacks it is dealt 1 additional shadow card.
  { id: "08046:forced:1", cardCode: "08046", lines: ["08046:A:1"], timing: "forced", trigger: "attacks", subject: GUARDIAN_ENEMY, instructions: [{ verb: "DealShadowTo", target: "subject" }] },
  // 08047 Cave Barrow. The players, as a group, cannot have more than 5 allies in play: the table holds the limit and the first player discards the allies beyond it.
  { id: "08047:constant:1", cardCode: "08047", lines: ["08047:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "alliesLimit", amount: 5, until: "whileSourceInPlay", target: "table" }] },
  { id: "08047:triggered:1", cardCode: "08047", lines: ["08047:A:1"], timing: "triggered", trigger: "alliesOverLimit", instructions: [{ verb: "Each", pick: ANY_ALLY, upTo: 5, instructions: [], rest: [{ verb: "Discard", target: { kind: "picked" } }] }] },
  // 08048 Stone Barrow. Forced: after a Guardian attacks each player raises his threat by that enemy's Threat, as it stood.
  { id: "08048:forced:1", cardCode: "08048", lines: ["08048:A:1"], timing: "forced", trigger: "attackResolved", subject: GUARDIAN_ENEMY, instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "subject" }, who: "actor" }] }] },
  // 08049 Hallowed Circle. Threat X, X the players. Travel: the players exhaust 3 Key objectives (the Keys, not their heroes); the engine refuses the travel without 3 ready ones (travelCostUnpayable). Forced: after the players travel here each engaged Guardian makes an immediate attack.
  { id: "08049:constant:1", cardCode: "08049", lines: ["08049:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "08049:travel:1", cardCode: "08049", lines: ["08049:A:2"], timing: "travel", instructions: [1, 2, 3].flatMap((): Instruction[] => [{ verb: "Pick", pick: READY_KEY }, { verb: "Exhaust", target: { kind: "picked" } }]) },
  { id: "08049:forced:1", cardCode: "08049", lines: ["08049:A:3"], timing: "forced", trigger: "traveled", subject: "self", instructions: [{ verb: "ImmediateAttackEach", trait: "Guardian", notStaging: true }] },

  // 08050 Spirit of the Wild. Cannot have attachments (the build writes it). +1 Threat and +1 Attack for each Key the players control; Shadow: the attacker gets +1 Attack for each.
  { id: "08050:constant:2", cardCode: "08050", lines: ["08050:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: KEYS_COUNT, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "attack", amount: KEYS_COUNT, until: "whileSourceInPlay", target: "self" }] },
  { id: "08050:shadow:1", cardCode: "08050", lines: ["08050:A:3"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: KEYS_COUNT, until: "endOfAttack", target: "attacker" }] },
  // 08051 Cursed Forest. Travel: a Spirit enemy found in the encounter deck or discard pile is added to the staging area, not revealed; the deck is shuffled. Shadow: if the attack destroys a character, a time counter comes off an enemy.
  { id: "08051:travel:1", cardCode: "08051", lines: ["08051:A:1"], timing: "travel", instructions: [{ verb: "SearchMove", type: "enemy", trait: "Spirit", to: "staging" }, { verb: "ShuffleEncounterDeck" }] },
  { id: "08051:shadow:1", cardCode: "08051", lines: ["08051:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", instructions: [{ verb: "Pick", pick: TIME_ENEMY, when: { kind: "x", min: 1 } }, { verb: "RemoveTimeCounters", target: "picked", amount: 1, when: { kind: "x", min: 1 } }] }] },
  // 08052 Grim Foothills. Doomed 2 (keyword). Threat X, X the players. In the staging area progress goes on it before the active location.
  { id: "08052:constant:1", cardCode: "08052", lines: ["08052:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true }, until: "whileSourceInPlay", target: "self" }] },
  { id: "08052:constant:2", cardCode: "08052", lines: ["08052:A:3"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "progressFirstRequired", amount: 1, until: "whileSourceInPlay" }] },
  // 08053 Curse of the Wild Men. When Revealed: 1 damage to each non-unique character in play; surge with 3 Keys controlled. Shadow: +1 Attack for each Key.
  { id: "08053:whenRevealed:1", cardCode: "08053", lines: ["08053:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: { type: "character", control: "any", nonUnique: true } }, { verb: "GainSurge", when: { kind: "count", pick: KEYS, min: 3 } }] },
  { id: "08053:shadow:1", cardCode: "08053", lines: ["08053:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: KEYS_COUNT, until: "endOfAttack", target: "attacker" }] },
  // 08054 The Guardian's Fury. When Revealed: each Guardian makes an attack (a Guardian still staged attacks the first player); with none in play a random Guardian from the victory display is revealed. Shadow: a Guardian attacker makes one more attack.
  {
    id: "08054:whenRevealed:1",
    cardCode: "08054",
    lines: ["08054:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "ImmediateAttackEach", trait: "Guardian", notStaging: true },
      { verb: "Each", pick: STAGED_GUARDIAN, instructions: [{ verb: "AttackFromStaging", who: "firstPlayer" }] },
      { verb: "RevealFromVictory", trait: "Guardian", random: true, when: { kind: "not", condition: { kind: "canPick", pick: GUARDIAN_ENEMY } } },
    ],
  },
  { id: "08054:shadow:1", cardCode: "08054", lines: ["08054:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true, when: ATTACKER_IS_GUARDIAN }] },
  // 08055 Wild Tenacity. When Revealed: X time counters come off each enemy with Time, X the players. Shadow: a Guardian attacker is dealt 2 additional shadow cards.
  { id: "08055:whenRevealed:1", cardCode: "08055", lines: ["08055:A:1"], timing: "whenRevealed", instructions: [{ verb: "RemoveTimeCounters", target: "enemies", amount: 1, perPlayer: true }] },
  { id: "08055:shadow:1", cardCode: "08055", lines: ["08055:A:2"], timing: "shadow", instructions: [{ verb: "DealShadowTo", target: "attacker", when: ATTACKER_IS_GUARDIAN }, { verb: "DealShadowTo", target: "attacker", when: ATTACKER_IS_GUARDIAN }] },
];

export const AUTHORED_REPLACES: readonly string[] = [];

