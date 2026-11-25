import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS as STORM } from "../a-storm-on-cobas-haven.ts";
import { copyLine, withCopies } from "../reprint.ts";
import { timeOption } from "./time-option.ts";

// Records for Into Fangorn (The Ring-maker part 3, The Voice of Isengard, no campaign card): Mugash as a Guarded objective lying on Edge of Fangorn, the three Huorns with Hinder, the Forest locations whose abilities do not stack, the encounter cards no template reads and the three quest stages.
// Every line is read from the scan ledger (data/printed/the-ring-maker.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record here. Time X is the angmar family's (src/catalog/families/angmar.ts: a constant `Time`, the Forced effect
// `lastTimeCounterRemoved`); the verbs and the trigger the box adds (a card chosen from the discard pile, the refresh cap, `timeCounterRemoved`) are in src/catalog/families/ring-maker.ts. Hinder is two constant flags that exist only in the combat phase and a Forced effect at its start.
// Rules: rm.hinder, rm.does-not-stack, rm.time-x, rm.immune-to-player-card-effects, rr.guarded, rr.objective-cards, rr.attachment-cards, rr.forced, rr.first-player, rr.the-word-choose, rr.search, rr.setup, rr.cannot, rr.cancel, rr.attacks-outside-the-combat-phase, rr.refresh-phase, rr.quest-advancement, rr.travel (data/rules/entries.json).
const MUGASH = "07031";
const EDGE = "07032";
const STAGE_2 = "07066";
const STAGE_3 = "07067";
const MUGASH_NAME = "Mugash";
const EACH_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", instructions });
// The player a card is engaged with: its Forced effects of the resource phase are about him ("the engaged player").
const ENGAGED_PLAYER = (instructions: Extract<Instruction, { verb: "ForEachPlayer" }>["instructions"]): Instruction => ({ verb: "ForEachPlayer", order: "firstFirst", seats: "engaged", instructions });
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const ATTACHED: Condition = { kind: "sourceIn", zone: "attached" };
const ENGAGED: Condition = { kind: "sourceIn", zone: "engaged" };
const COMBAT: Condition = { kind: "phase", is: "Combat" };
const THREE_PLAYERS: Condition = { kind: "count", pick: { type: "player", control: "any" }, min: 3 };
const READY_HERO: PickSpec = { type: "hero", control: "you", state: "ready" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const OWN_CHARACTER: PickSpec = { type: "character", control: "you" };
const COMMITTED_HERO: PickSpec = { type: "hero", control: "any", committed: true };
const ACTIVE_LOCATION: PickSpec = { type: "location", control: "any", active: true };
// The Forest locations in the staging area (Ancient Forest) and in play (Tangled Woods): Edge of Fangorn is one, and takes both, which come from encounter cards.
const STAGED_FOREST: PickSpec = { type: "location", control: "any", stagingOnly: true, trait: "Forest" };
const FOREST_IN_PLAY: PickSpec = { type: "location", control: "any", trait: "Forest" };
// "A hero with Mugash attached" and "Mugash in play" (staged, attached to Edge of Fangorn or to a hero).
const HERO_WITH_MUGASH: PickSpec = { type: "hero", control: "any", hasAttachment: { names: [MUGASH_NAME] } };
const MUGASH_IN_PLAY: PickSpec = { type: "card", control: "any", names: [MUGASH_NAME], allInPlay: true };
const MUGASH_ATTACHED: Condition = { kind: "canPick", pick: HERO_WITH_MUGASH };
const NO_MUGASH: Condition = { kind: "not", condition: MUGASH_ATTACHED };
const SHUFFLED: Instruction = { verb: "ShuffleEncounterDeck" };
// "Shuffle Mugash into the encounter deck" (07065:B:2, 07066:B:2) from wherever he is: in play (attached to Edge of Fangorn or to a hero, or lying in the staging area) or out of play (the encounter discard pile). His old guard stays where it is.
const SHUFFLE_MUGASH: Instruction[] = [
  { verb: "Pick", pick: MUGASH_IN_PLAY, when: { kind: "canPick", pick: MUGASH_IN_PLAY } },
  { verb: "MoveEncounterCard", card: "picked", to: "shuffle", when: { kind: "canPick", pick: MUGASH_IN_PLAY } },
  { verb: "ShuffleOutOfPlayIntoEncounterDeck", code: MUGASH, when: { kind: "outOfPlay", code: MUGASH } },
];
// "Return the active location to the staging area" (07052:A:1 and A:2).
const RETURN_ACTIVE: Instruction = { verb: "MoveEncounterCard", card: "activeLocation", to: "staging" };
// The quest stage's Time X and its reveal count: the angmar family's constant record (07065:B:1 to 07067:B:1).
const time = (code: string, amount: number, line: string): Effect => ({ id: `${code}:constant:1`, cardCode: code, lines: [line], timing: "constant", instructions: [{ verb: "Time", amount }] });

// Hinder (rm.hinder), the same on the three Huorns: while engaged, in the combat phase only, the enemy makes no attack and is dealt no shadow card (the flags are rebuilt from the phase, so an attack by a card effect or in another phase is made and dealt one); at the beginning of the combat phase it removes 1 progress from
// the current quest, else from the active location, else nothing. "Cannot have attachments" holds always.
const hinder = (code: string): Effect[] => [
  { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", condition: { kind: "all", conditions: [ENGAGED, COMBAT] }, instructions: [{ verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", target: "self" }, { verb: "ModifyStat", stat: "noShadowDealt", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: `${code}:constant:2`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  {
    id: `${code}:forced:1`,
    cardCode: code,
    lines: [`${code}:A:1`],
    timing: "forced",
    trigger: "beginningOfPhase",
    condition: { kind: "all", conditions: [COMBAT, ENGAGED] },
    instructions: [
      { verb: "RemoveProgressFromQuest", amount: 1, when: { kind: "questProgress" } },
      { verb: "RemoveProgressFrom", amount: 1, target: "activeLocation", when: { kind: "not", condition: { kind: "questProgress" } } },
    ],
  },
];

// A Forced effect of the resource phase of an engaged Huorn (07033:A:2, 07034:A:2, 07035:A:2).
const resourcePhase = (code: string, instructions: Instruction[]): Effect => ({ id: `${code}:forced:2`, cardCode: code, lines: [`${code}:A:2`], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Resource" }, ENGAGED] }, instructions });

// The two stages that return Mugash: "shuffle Mugash into the encounter deck and advance to stage 3 / 3A" (07065:B:2, 07066:B:2). The advance is a jump (AdvanceToStage), which no restriction on the stage's own advance holds back.
const timeOut = (code: string): Effect => ({ id: `${code}:forced:1`, cardCode: code, lines: [`${code}:B:2`], timing: "forced", trigger: "lastTimeCounterRemoved", subject: "self", instructions: [...SHUFFLE_MUGASH, { verb: "AdvanceToStage", code: STAGE_3, again: true }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 07031 Mugash (objective). Guarded: the line of every Guarded objective, resolved each time he is revealed. Action: any player exhausts a ready hero to claim him when he is free of encounters (the guard gone, Edge of Fangorn included); he attaches to the hero. He lies on Edge of Fangorn from Setup: while it
  // is in play he is attached and cannot be claimed; when it leaves play, or the hero he is attached to is discarded, he goes to the staging area (`returnsToStagingArea`). Forced: after the hero takes damage (a hero destroyed by damage included) he returns to the top of the encounter deck.
  copyLine("12134:A:1", "07031:A:1"),
  {
    id: "07031:action:1",
    cardCode: MUGASH,
    lines: ["07031:A:2"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [IN_STAGING, { kind: "freeOfEncounters" }, { kind: "canPick", pick: READY_HERO }] },
    instructions: [{ verb: "Pick", pick: READY_HERO }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "ClaimObjective" }],
  },
  { id: "07031:constant:1", cardCode: MUGASH, lines: ["07031:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "returnsToStagingArea", amount: 1, until: "whileSourceInPlay", target: "self" }] },
  { id: "07031:forced:1", cardCode: MUGASH, lines: ["07031:A:3"], timing: "forced", trigger: "damaged", subject: "host", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "deckTop" }] },

  // 07032 Edge of Fangorn. Immune to player card effects is its keyword. Travel: the first player searches the encounter deck and discard pile for a Huorn and adds it to the staging area, two with 3 or more players; the deck is shuffled. The travel completes with none found.
  {
    id: "07032:travel:1",
    cardCode: EDGE,
    lines: ["07032:A:2"],
    timing: "travel",
    instructions: [{ verb: "SearchMove", type: "enemy", trait: "Huorn", to: "staging" }, { verb: "SearchMove", type: "enemy", trait: "Huorn", to: "staging", when: THREE_PLAYERS }, SHUFFLED],
  },

  // 07033 Dark-Hearted Huorn, 07034 Angry Huorn, 07035 Deadly Huorn. Hinder, Cannot have attachments; Forced at the beginning of each resource phase: the engaged player raises his threat by 2; the Huorn attacks the engaged player (the attack of a card effect, outside the combat phase: made, and dealt a
  // shadow card); the engaged player deals 3 damage to a character he controls (one instance).
  ...hinder("07033"),
  resourcePhase("07033", [ENGAGED_PLAYER([{ verb: "RaiseThreat", amount: 2, who: "actor" }])]),
  ...hinder("07034"),
  resourcePhase("07034", [{ verb: "ImmediateAttack" }]),
  ...hinder("07035"),
  resourcePhase("07035", [ENGAGED_PLAYER([{ verb: "Pick", pick: OWN_CHARACTER }, { verb: "DamageCard", amount: 3, target: "picked" }])]),

  // 07036 Heart of Fangorn. In the staging area each player keeps the characters beyond 5 that would ready exhausted, of his own choice (a Forced effect at the beginning of the refresh phase marks them). The Shadow line is the one the build writes.
  { id: "07036:forced:1", cardCode: "07036", lines: ["07036:A:1"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, IN_STAGING] }, instructions: [EACH_PLAYER([{ verb: "CapRefresh", amount: 5 }])] },

  // 07037 The Forest's Malice. When Revealed: each Huorn engaged with a player makes an immediate attack (made in the encounter phase, dealt a shadow card); with no attack made each player searches the encounter deck and discard pile for a Huorn and puts it into play engaged with him; the deck is shuffled.
  // It cannot be canceled (a treachery is in the staging area while its When Revealed resolves).
  {
    id: "07037:whenRevealed:1",
    cardCode: "07037",
    lines: ["07037:A:1"],
    timing: "whenRevealed",
    uncancelable: IN_STAGING,
    instructions: [{ verb: "ImmediateAttackEach", trait: "Huorn", notStaging: true }, EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Huorn", to: "engaged", when: { kind: "noneReturned" } }]), SHUFFLED],
  },

  // 07050 Ancient Forest. In the staging area every Forest location there gets +1 Threat and +3 quest points; with two copies, once (does not stack). Shadow: the defending player exhausts a character he controls.
  {
    id: "07050:constant:1",
    cardCode: "07050",
    lines: ["07050:A:1"],
    timing: "constant",
    condition: IN_STAGING,
    instructions: [
      { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: STAGED_FOREST, doesNotStack: true },
      { verb: "ModifyStat", stat: "questPoints", amount: 3, until: "whileSourceInPlay", holders: STAGED_FOREST, doesNotStack: true },
    ],
  },
  { id: "07050:shadow:1", cardCode: "07050", lines: ["07050:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },

  // 07051 Tangled Woods. In the staging area each Forest location in play gains "Travel: Exhaust a hero to travel here" (the flag travelExhaust: one cost, however many copies lie there).
  { id: "07051:constant:1", cardCode: "07051", lines: ["07051:A:1"], timing: "constant", condition: IN_STAGING, instructions: [{ verb: "ModifyStat", stat: "travelExhaust", amount: 1, until: "whileSourceInPlay", holders: FOREST_IN_PLAY, doesNotStack: true }] },

  // 07052 Turned Around. When Revealed: the first player chooses (for the players): a time counter comes off the current quest, or the active location returns to the staging area; an option that cannot happen is not offered. Shadow: an undefended attack returns the active location.
  {
    id: "07052:whenRevealed:1",
    cardCode: "07052",
    lines: ["07052:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Choose", who: "firstPlayer", options: [timeOption(), { id: "location", requires: { kind: "canPick", pick: ACTIVE_LOCATION }, instructions: [RETURN_ACTIVE] }] }],
  },
  { id: "07052:shadow:1", cardCode: "07052", lines: ["07052:A:2"], timing: "shadow", instructions: [{ ...RETURN_ACTIVE, when: { kind: "undefended" } }] },

  // 07056 Low on Provisions. When Revealed: each player assigns X damage among the characters he controls, X their number when it resolves. Shadow: +1 Attack, +1 more when the defending character is undamaged (an undefended attack has none).
  { id: "07056:whenRevealed:1", cardCode: "07056", lines: ["07056:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "AssignDamage", amount: { count: OWN_CHARACTER }, pick: OWN_CHARACTER }])] },
  {
    id: "07056:shadow:1",
    cardCode: "07056",
    lines: ["07056:A:2"],
    timing: "shadow",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker" },
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "matches", card: "defender", pick: { type: "character", control: "any", damaged: false } } },
    ],
  },

  // 07057 Off Track. Surge is its keyword. When Revealed: the first player attaches it to a location in play that holds no Off Track (none: it is discarded); it counts as a Condition attachment. The location gets +2 quest points; Forced at the end of each refresh phase, wherever the location is in play:
  // an additional time counter comes off the current quest.
  { id: "07057:whenRevealed:1", cardCode: "07057", lines: ["07057:A:2"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: { type: "location", control: "any", who: "firstPlayer" } }, { verb: "AttachSelfToPicked" }] },
  {
    id: "07057:constant:1",
    cardCode: "07057",
    lines: ["07057:A:2"],
    timing: "constant",
    instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "AttachesTo", hosts: [{ type: "location", control: "any" }], limitPerHost: true }],
  },
  { id: "07057:constant:2", cardCode: "07057", lines: ["07057:A:2"], timing: "constant", condition: ATTACHED, instructions: [{ verb: "ModifyStat", stat: "questPoints", amount: 2, until: "whileSourceInPlay", target: "host" }] },
  { id: "07057:forced:1", cardCode: "07057", lines: ["07057:A:2"], timing: "forced", trigger: "endOfPhase", condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, ATTACHED] }, instructions: [{ verb: "RemoveTimeFromQuest", amount: 1 }] },

  // 07058 In Need of Rest. When Revealed: the player removes a hero committed to the quest from it and attaches this to that hero (none committed: discarded); a Condition attachment. Forced: after a time counter comes off the current quest, the attached hero takes 1 damage.
  { id: "07058:whenRevealed:1", cardCode: "07058", lines: ["07058:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: COMMITTED_HERO }, { verb: "RemoveFromQuest" }, { verb: "AttachSelfToPicked" }] },
  { id: "07058:constant:1", cardCode: "07058", lines: ["07058:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }, { verb: "AttachesTo", host: { kind: "hero" }, limitPerHost: true }] },
  { id: "07058:forced:1", cardCode: "07058", lines: ["07058:A:1"], timing: "forced", trigger: "timeCounterRemoved", condition: ATTACHED, instructions: [{ verb: "DamageCard", amount: 1, target: "host" }] },

  // 07065 Into the Woods. Setup: Edge of Fangorn is in the staging area (the piles) and Mugash lies on it, claimed by nobody; the deck is shuffled and each player but the last reveals a card (X, the players less 1). Side B: Time 4; after the last counter Mugash is shuffled into the deck and the quest jumps to stage 3;
  // the players cannot advance without him attached to a hero.
  {
    id: "07065:setup:1",
    cardCode: "07065",
    lines: ["07065:A:1"],
    timing: "setup",
    instructions: [{ verb: "AttachSetAsideTo", code: MUGASH, to: "Edge of Fangorn", uncontrolled: true, claimed: true }, SHUFFLED, EACH_PLAYER([{ verb: "RevealEncounter", when: { kind: "not", condition: { kind: "lastPlayer" } } }])],
  },
  time("07065", 4, "07065:B:1"),
  timeOut("07065"),
  { id: "07065:constant:2", cardCode: "07065", lines: ["07065:B:3"], timing: "constant", condition: NO_MUGASH, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 07066 Escape from Fangorn. When Revealed: each player searches the encounter deck and discard pile for a Huorn and adds it to the staging area; the deck is shuffled. Side B: Time 4; after the last counter Mugash is shuffled in and the quest jumps to stage 3A; the stage cannot be defeated without Mugash attached
  // to a hero; defeating it wins the game.
  { id: "07066:whenRevealed:1", cardCode: STAGE_2, lines: ["07066:A:1"], timing: "whenRevealed", instructions: [EACH_PLAYER([{ verb: "SearchMove", type: "enemy", trait: "Huorn", to: "staging" }]), SHUFFLED] },
  time(STAGE_2, 4, "07066:B:1"),
  timeOut(STAGE_2),
  { id: "07066:constant:2", cardCode: STAGE_2, lines: ["07066:B:3"], timing: "constant", condition: NO_MUGASH, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "07066:questResolution:1", cardCode: STAGE_2, lines: ["07066:B:4"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

  // 07067 The Angry Forest. Side B: Time 3; after the last counter 5 cards are discarded from the top of the encounter deck, each player chooses an enemy or objective in the discard pile, reveals it and adds it to the staging area, and 3 counters go on the stage. Forced: after progress is placed on it, with 6 or more on it and
  // Mugash attached to a hero, the quest jumps back to stage 2A.
  time(STAGE_3, 3, "07067:B:1"),
  {
    id: "07067:forced:1",
    cardCode: STAGE_3,
    lines: ["07067:B:2"],
    timing: "forced",
    trigger: "lastTimeCounterRemoved",
    subject: "self",
    instructions: [{ verb: "DiscardEncounterTop", count: 5 }, EACH_PLAYER([{ verb: "RevealChosenFromDiscard", types: ["enemy", "objective"] }]), { verb: "PlaceResourceTokens", amount: 3, on: "self" }],
  },
  {
    id: "07067:forced:2",
    cardCode: STAGE_3,
    lines: ["07067:B:3"],
    timing: "forced",
    trigger: "progressPlaced",
    subject: "self",
    condition: { kind: "all", conditions: [{ kind: "less", left: 5, right: { stat: "progress", of: "self" } }, MUGASH_ATTACHED] },
    instructions: [{ verb: "AdvanceToStage", code: STAGE_2, again: true }],
  },
], { pool: STORM });

export const AUTHORED_REPLACES: readonly string[] = [];
