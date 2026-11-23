import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as PERIL } from "./peril-in-pelargir.ts";
import { RECORDS as REVCORE } from "../pool/RevCore.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for Into Ithilien (Against the Shadow part 2, no campaign card). Every line is read from the scan ledger (data/printed/against-the-shadow.json). Keywords (Surge, Immune, Doomed, Battle, Siege, Archery printed as a keyword) are
// the cards' own; the Battle and Siege stages keep an empty record for the reminder text. The piles place Celador, Ithilien Road (the active location) and the Southron Companies, so the Setup record is empty. The readings are in
// docs/scenarios/against-the-shadow/into-ithilien.md (Readings). Celador and the Ithilien Guardians are ally objectives (ats.ally-objectives): the flag `committedInStaging` commits them while they lie in the staging area (families/pelargir/committed.ts).
// Rules: ats.ally-objectives, rr.current-quest, hon.battle, hon.siege, hon.archery, rr.step-3-4, rr.removed-from-game, rr.gains, rr.surge, rr.active-location, rr.engagement-check, rr.step-5-2, rr.step-5-3, rr.optional-engagement, rr.quest-advancement,
// rr.ownership-and-control, rr.search, rr.doomed-x, rr.attachment-cards, rr.engaged, rr.step-6-4-2, rr.step-6-4-3, rr.step-6-4-4, faq.enemy-attacks-outside-combat, faq.immune-expanded, faq.lasting-effects, faq.errata.05029 (data/rules/entries.json).
const CELADOR = "Celador";
const COMMITTED_CHARACTER: PickSpec = { type: "character", control: "any", committed: true };
const OWN_COMMITTED: PickSpec = { type: "character", control: "you", committed: true };
const BATTLE_OR_SIEGE: Condition = { kind: "any", conditions: [{ kind: "questKeyword", keyword: "battle", is: true }, { kind: "questKeyword", keyword: "siege", is: true }] };
// "A keyword" on the current quest card: Battle, Siege and Archery X print one; the Siege that stage 4 gains counts (`questKeywords` reads printed keywords only).
const QUEST_HAS_KEYWORD: Condition = { kind: "any", conditions: [{ kind: "questKeywords", is: true }, { kind: "questKeyword", keyword: "battle", is: true }, { kind: "questKeyword", keyword: "siege", is: true }] };
const NOT_KEYWORD: Condition = { kind: "all", conditions: [{ kind: "questKeywords", is: false }, { kind: "questKeyword", keyword: "battle", is: false }, { kind: "questKeyword", keyword: "siege", is: false }] };
const HARAD: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Harad" };
const NOT_HARAD: Condition = { kind: "not", condition: { kind: "matches", card: "attacker", pick: HARAD } };
const IS_HARAD: Condition = { kind: "matches", card: "attacker", pick: HARAD };
const ARCHERY_PLAYERS: Instruction = { verb: "ModifyStat", stat: "archeryPlayers", amount: 1, until: "whileSourceInPlay" };
const REMOVE_PROGRESS: Instruction = { verb: "RemoveProgressFromQuest", amount: { stat: "threat", of: "attacker" } };
const SKIPS_NEXT_STAGE: Instruction = { verb: "ModifyStat", stat: "skipsNextStage", amount: 1, until: "whileSourceInPlay", target: "self" };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 05025 Celador (ally objective, Gondor Ranger). A:1: while he lies in the staging area he is committed to the current quest: `committedInStaging` counts his Willpower, Attack under Battle or Defense under Siege in the quest total and makes him a character
    // committed to the quest for every pick and count; `guardedAlly` makes him an ally in play that leaves play as a guarded ally does (announced, hit by effects on characters), under nobody's control. Both end when a player takes control of him and he leaves the staging area.
    // A:2: two Forced effects, one for each event: after the players quest unsuccessfully (the event is queued for each seat: the first player's hears it, as 19155:A:2) and after any character leaves play (a hero, an ally, a Guardian once a player controls it), 1 damage to him.
    // The Guardian that leaves play after a player took control is an objective in the discard pile by then, so a third record hears the Ranger objectives. A:3: the copy of Mendor's line.
    {
      id: "05025:constant:1",
      cardCode: "05025",
      lines: ["05025:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "staging" },
      instructions: [
        { verb: "ModifyStat", stat: "committedInStaging", amount: 1, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "guardedAlly", amount: 1, until: "whileSourceInPlay", target: "self" },
      ],
    },
    { id: "05025:forced:1", cardCode: "05025", lines: ["05025:A:2"], timing: "forced", trigger: "questFailed", condition: { kind: "firstPlayer" }, instructions: [{ verb: "DamageCard", amount: 1, target: "self" }] },
    {
      id: "05025:forced:2",
      cardCode: "05025",
      lines: ["05025:A:2"],
      timing: "forced",
      trigger: "leftPlay",
      subject: { type: "character", control: "any", other: true },
      instructions: [{ verb: "DamageCard", amount: 1, target: "self" }],
    },
    {
      id: "05025:forced:3",
      cardCode: "05025",
      lines: ["05025:A:2"],
      timing: "forced",
      trigger: "leftPlay",
      subject: { type: "objective", control: "any", trait: "Ranger", other: true },
      instructions: [{ verb: "DamageCard", amount: 1, target: "self" }],
    },
    copyLine("01135:A:4", "05025:A:3"),

    // 05026 Ithilien Guardian (ally objective). A:1: as Celador's. A:2: it is added to the staging area as any revealed objective is (rr.objective-cards), and gains surge. A:3 (Shadow): 2 damage to the attacking enemy.
    copyLine("05025:A:1", "05026:A:1"),
    { id: "05026:whenRevealed:1", cardCode: "05026", lines: ["05026:A:2"], timing: "whenRevealed", instructions: [{ verb: "GainSurge" }] },
    { id: "05026:shadow:1", cardCode: "05026", lines: ["05026:A:3"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 2, target: "attacker" }] },

    // 05027 Southron Company. A:1: +2 Threat and +2 Attack while the current quest card has the battle or siege keyword, a keyword it gained included (stage 4 gains siege). A:2 (Shadow): +1 Attack, or +2 instead if the current quest card has a keyword.
    {
      id: "05027:constant:1",
      cardCode: "05027",
      lines: ["05027:A:1"],
      timing: "constant",
      condition: BATTLE_OR_SIEGE,
      instructions: [
        { verb: "ModifyStat", stat: "threat", amount: 2, until: "whileSourceInPlay", target: "self" },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "self" },
      ],
    },
    {
      id: "05027:shadow:1",
      cardCode: "05027",
      lines: ["05027:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: NOT_KEYWORD },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: QUEST_HAS_KEYWORD },
      ],
    },

    // 05028 Ithilien Road. A:1: while it is the active location every enemy in the staging area has engagement cost 0 (a cost the stat clamps at 0, as 142032:A:1 raises it). A:2 (Shadow): the attacking enemy returns to the staging area after the attack, as 05045:A:2 reads.
    {
      id: "05028:constant:1",
      cardCode: "05028",
      lines: ["05028:A:1"],
      timing: "constant",
      condition: { kind: "sourceIn", zone: "activeLocation" },
      instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -99, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true } }],
    },
    copyLine("05045:A:2", "05028:A:2"),

    // 05029 Blocking Wargs (Surge is a keyword). A:2: 1 damage to each character committed to the quest, the ally objectives in the staging area included (the card has no parenthetical: faq.errata.05029). A:3 (Shadow): 1 damage to the defending character; an undefended attack has none.
    { id: "05029:whenRevealed:1", cardCode: "05029", lines: ["05029:A:2"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 1, pick: COMMITTED_CHARACTER }] },
    { id: "05029:shadow:1", cardCode: "05029", lines: ["05029:A:3"], timing: "shadow", instructions: [{ verb: "DamageCard", amount: 1, target: "defender" }] },

    // 05046 Overgrown Trail. A:1: any player exhausts a ready Ranger character he controls (an ally objective no player controls cannot pay), 3 progress on the Trail. A:2 (Shadow): X progress comes off the current quest, X the attacking enemy's current Threat.
    {
      id: "05046:action:1",
      cardCode: "05046",
      lines: ["05046:A:1"],
      timing: "action",
      condition: { kind: "canPick", pick: { type: "character", control: "you", trait: "Ranger", state: "ready" } },
      instructions: [{ verb: "Pick", pick: { type: "character", control: "you", trait: "Ranger", state: "ready" } }, { verb: "Exhaust", target: { kind: "picked" } }, { verb: "PlaceProgressOn", amount: 3, target: "self" }],
    },
    { id: "05046:shadow:1", cardCode: "05046", lines: ["05046:A:2"], timing: "shadow", instructions: [REMOVE_PROGRESS] },

    // 05047 Secluded Glade (Immune to player card effects is a keyword, set by data/overrides.json). A:2 (Shadow): as Overgrown Trail's.
    copyLine("05046:A:2", "05047:A:2"),

    // 05048 Lost Companion. A:1 step 1: each player in turn removes a character he controls from the quest, if able (ally objectives are controlled by no one). Step 2: when any player has no character committed to the quest, every character goes back: the removal runs for
    // each player with none and takes every committed character, which is the same as one removal when any player has none. Celador and the Guardians stay committed by their own text.
    {
      id: "05048:whenRevealed:1",
      cardCode: "05048",
      lines: ["05048:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: OWN_COMMITTED }, { verb: "RemoveFromQuest" }] },
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [{ verb: "Each", pick: COMMITTED_CHARACTER, instructions: [{ verb: "RemoveFromQuest" }], when: { kind: "not", condition: { kind: "canPick", pick: OWN_COMMITTED } } }],
        },
      ],
    },

    // 05049 Morgul Spider. A:1: until the end of the round +1 Attack for each character not committed to a quest, counted again as the game changes (faq.lasting-effects): the When Revealed effect sets the flag for the round and the constant counts while it holds.
    // Celador and the Guardians in the staging area are committed, so they are not counted.
    { id: "05049:whenRevealed:1", cardCode: "05049", lines: ["05049:A:1"], timing: "whenRevealed", instructions: [{ verb: "ModifyStat", stat: "attackForUncommitted", amount: 1, until: "endOfRound", target: "self" }] },
    {
      id: "05049:constant:1",
      cardCode: "05049",
      lines: ["05049:A:1"],
      timing: "constant",
      condition: { kind: "flag", stat: "attackForUncommitted", holder: "self" },
      instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: { type: "character", control: "any", committed: false } }, until: "whileSourceInPlay", target: "self" }],
    },

    // 05050 Forest Bat. A:1: the first player chooses a questing hero (not an ally), 2 damage, and the hero leaves the quest. A:2 (Shadow): the defending player raises his threat by the attacking enemy's current Threat.
    {
      id: "05050:whenRevealed:1",
      cardCode: "05050",
      lines: ["05050:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "any", committed: true, who: "firstPlayer" } }, { verb: "DamageCard", amount: 2, target: "picked" }, { verb: "RemoveFromQuest" }],
    },
    { id: "05050:shadow:1", cardCode: "05050", lines: ["05050:A:2"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: { stat: "threat", of: "attacker" }, who: "actor" }] },

    // 05051 Watcher in the Wood. A:1: each player raises his threat by the total number of questing characters (the ally objectives committed in the staging area count), then the Watcher gains surge if the current quest has battle or siege: the test is made after the raise,
    // so a raise that takes a threat to 37 counts on stage 4. A:2 (Shadow): each player raises his threat by the enemies engaged with him.
    {
      id: "05051:whenRevealed:1",
      cardCode: "05051",
      lines: ["05051:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "RaiseThreat", amount: { count: COMMITTED_CHARACTER }, who: "eachSeat" }, { verb: "GainSurge", when: BATTLE_OR_SIEGE }],
    },
    {
      id: "05051:shadow:1",
      cardCode: "05051",
      lines: ["05051:A:2"],
      timing: "shadow",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: { count: { type: "enemy", control: "any", engaged: "you" } }, who: "actor" }] }],
    },

    // 05052 Southron Mercenaries. A:1 and A:2: Archery X, X the players in the game (as 142070:A:1 and A:2). A:3 (Shadow): +1 Attack, or +3 instead if the attacking enemy has the Harad trait.
    { id: "05052:constant:1", cardCode: "05052", lines: ["05052:A:1", "05052:A:2"], timing: "constant", instructions: [ARCHERY_PLAYERS] },
    {
      id: "05052:shadow:1",
      cardCode: "05052",
      lines: ["05052:A:3"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: NOT_HARAD },
        { verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: IS_HARAD },
      ],
    },

    // 05053 Haradrim Elite. A:1: when it enters play (revealed, or searched into the staging area) it makes an immediate attack from the staging area against the first player, dealt a shadow card (faq.enemy-attacks-outside-combat). A:2 (Shadow): it attacks again after this attack, with a new shadow card.
    { id: "05053:forced:1", cardCode: "05053", lines: ["05053:A:1"], timing: "forced", trigger: "addedToStaging", subject: "self", instructions: [{ verb: "AttackFromStaging", target: "self", who: "firstPlayer" }] },
    { id: "05053:shadow:1", cardCode: "05053", lines: ["05053:A:2"], timing: "shadow", instructions: [{ verb: "ImmediateAttack", afterThis: true }] },

    // 05054 Mûmak. A:1: no attachment can be attached to it. A:2: it takes at most 3 damage each round, from any source.
    { id: "05054:constant:1", cardCode: "05054", lines: ["05054:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "05054:constant:2", cardCode: "05054", lines: ["05054:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "damageCap", amount: 3, until: "whileSourceInPlay", target: "self" }] },

    // 05055 Southron Support (Doomed 3 is a keyword). A:2: each player in turn searches the encounter deck and discard pile for a Harad enemy and adds it to the staging area, if able; then the encounter deck is shuffled.
    {
      id: "05055:whenRevealed:1",
      cardCode: "05055",
      lines: ["05055:A:2"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", trait: "Harad", to: "staging" }] }, { verb: "ShuffleEncounterDeck" }],
    },

    // 05068 Ambush in Ithilien (stage 1). A:1: the piles place Celador, Ithilien Road as the active location and one Southron Company for each player. B:1: Battle (the keyword is the card's own, the reminder text carries no rule). B:2: completed with Celador in the staging area
    // (not removed from the game, not under a player's control) the quest goes to stage 3, bypassing stage 2.
    { id: "05068:setup:1", cardCode: "05068", lines: ["05068:A:1"], timing: "setup", instructions: [] },
    { id: "05068:constant:1", cardCode: "05068", lines: ["05068:B:1"], timing: "constant", instructions: [] },
    {
      id: "05068:constant:2",
      cardCode: "05068",
      lines: ["05068:B:2"],
      timing: "constant",
      condition: { kind: "canPick", pick: { type: "objective", control: "any", names: [CELADOR], stagingOnly: true } },
      instructions: [SKIPS_NEXT_STAGE],
    },

    // 05069 Southron Counter-attack (stage 2). B:1: Siege (reminder text). B:2 and B:3: Archery X, X the players in the game, applied while this quest card is in play. B:4: completed, the quest goes to stage 4, bypassing stage 3.
    { id: "05069:constant:1", cardCode: "05069", lines: ["05069:B:1"], timing: "constant", instructions: [] },
    { id: "05069:constant:2", cardCode: "05069", lines: ["05069:B:2", "05069:B:3"], timing: "constant", instructions: [ARCHERY_PLAYERS] },
    { id: "05069:constant:3", cardCode: "05069", lines: ["05069:B:4"], timing: "constant", instructions: [SKIPS_NEXT_STAGE] },

    // 05070 The Hidden Way (stage 3). B:1: the first player takes control of every Ranger objective in the staging area (Celador, the Guardians). B:2: no engagement checks and no optional engagement while this stage is current.
    { id: "05070:whenRevealed:1", cardCode: "05070", lines: ["05070:B:1"], timing: "whenRevealed", instructions: [{ verb: "TakeControlOfStagedObjectives", trait: "Ranger" }] },
    {
      id: "05070:constant:1",
      cardCode: "05070",
      lines: ["05070:B:2"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "whileSourceInPlay", target: "table" },
        { verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "table" },
      ],
    },

    // 05071 Approaching Cair Andros (stage 4). B:1: while any player's threat is 37 or higher the stage has siege (a standing condition). B:2: at the end of each round each player raises his threat by 2, with the Refresh phase's own raise. B:3: defeating it wins the game (the last stage).
    {
      id: "05071:constant:1",
      cardCode: "05071",
      lines: ["05071:B:1"],
      timing: "constant",
      condition: { kind: "less", left: 36, right: { highestThreat: true } },
      instructions: [{ verb: "ModifyStat", stat: "siege", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    { id: "05071:forced:1", cardCode: "05071", lines: ["05071:B:2"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "RaiseThreat", amount: 2, who: "eachSeat" }] },
    { id: "05071:constant:2", cardCode: "05071", lines: ["05071:B:3"], timing: "constant", instructions: [] },
  ],
  { pool: [...PERIL, ...REVCORE] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
