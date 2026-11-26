import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as THE_OATH } from "../the-oath.ts";
import { AUTHORED_EFFECTS as TOWER_OF_CIRITH_UNGOL } from "../return-of-the-king/the-tower-of-cirith-ungol.ts";
import { AUTHORED_EFFECTS as ATTACK_ON_DOL_GULDUR } from "../standalone-scenarios/attack-on-dol-guldur.ts";
import { AUTHORED_EFFECTS as MURDER } from "../standalone-scenarios/murder-at-the-prancing-pony.ts";
import { AUTHORED_EFFECTS as STONE_OF_ERECH } from "../standalone-scenarios/the-stone-of-erech.ts";
import { RECORDS as M } from "../pool/M.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Long Arm of Mordor (haradrim cycle part 3, no campaign card). Every line is read from the scan ledger (data/printed/haradrim.json); a line a template already writes (pnpm data build) or another card prints word for word needs no record
// here. See docs/scenarios/haradrim/the-long-arm-of-mordor.md, Readings, for each reading. The heroes in the staging area (staged and guarded heroes) are the haradrim family's (src/rules/families/haradrim/staged.ts) on the Captives of The Uruk-hai (families/captives): a
// hero in the staging area is a Captive held by no card, a guarded hero a Captive held by its Orc with the flag Lost in Mirkwood's Carried Away uses, so its release is that card's ReleaseGuardedHero. The piles deal Uruk Chieftain, the objective-heroes and the copies of
// Sauron's Enforcers (one for each player); the Setup record here moves the heroes, gives each player an objective-hero and removes the rest.
// Rules: hrd.objective-heroes, hrd.objective-hero-elimination, hrd.heroes-in-the-staging-area, hrd.guarded-heroes, hrd.stage-number, hrd.side-quests-in-play, hrd.encounter-side-quests, rr.player-elimination, rr.blank, rr.immune, rr.guarded, rr.forced, rr.travel, rr.engaged, rr.first-player, rr.attachment-cards, rr.modifiers, rr.resource-match, rr.the-word-choose, rr.step-6-4-3 (data/rules/entries.json).
type Cond = NonNullable<Effect["condition"]>;
type Instruction = Effect["instructions"][number];

const STAGE = { stage: true } as const;
const OBJECTIVE_HEROES = ["16031", "16032", "16033", "16034"];
const CHIEFTAIN = "16061";
// The enemy filters the lines name.
const NON_UNIQUE_ORC: PickSpec = { type: "enemy", control: "any", staging: true, trait: "Orc", nonUnique: true };
const GUARD: PickSpec = { type: "enemy", control: "any", staging: true, guardsHero: true };
const CHIEFTAIN_ENEMY: PickSpec = { type: "enemy", control: "any", staging: true, names: ["Uruk Chieftain"] };
// An objective-hero is the defending character (Southron Boma's Shadow).
const DEFENDER_OBJECTIVE: Cond = { kind: "matches", card: "defender", pick: { type: "hero", control: "any", names: ["Kahliel", "Firyal", "Yazan", "Jubayr"] } };
// The Mordor Warg: an Orc in play that carries none.
const WARG_HOST: PickSpec = { type: "enemy", control: "any", staging: true, allInPlay: true, trait: "Orc", who: "firstPlayer", hasAttachment: { names: ["Mordor Warg"], none: true } };
const THREAT_ABOVE: Cond = { kind: "threatAboveWillpower" };
// "Each player ... chooses a hero he owns in the staging area, takes control of that hero, and exhausts it" (16071:B:3, 16072:B:3).
const EACH_TAKES_A_HERO: Instruction = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ReleaseStagedHero" }] };
// "Damage from undefended attacks must be dealt to a hero in the staging area, if able" and "the first card each player plays each phase does not require a resource match".
const UNDEFENDED_TO_STAGED: Instruction = { verb: "ModifyStat", stat: "undefendedToStaged", amount: 1, until: "whileSourceInPlay", target: "table" };
const FIRST_CARD_NEEDS_NO_MATCH: Instruction = { verb: "IgnoreResourceMatch", pick: { type: "card", control: "you" }, firstEachPhase: true, anyPlayer: true };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 16031 Kahliel. At the beginning of the planning phase he may add 1 resource to the pool of a hero in play (a hero in the staging area is immune to player card effects: it is not offered).
    {
      id: "16031:response:1",
      cardCode: "16031",
      lines: ["16031:A:1"],
      timing: "response",
      trigger: "beginningOfPhase",
      condition: { kind: "phase", is: "Planning" },
      instructions: [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "AddResources", amount: 1, to: "picked" }],
    },
    // "If Kahliel leaves play, you are eliminated from the game" (and its three twins, copied below): the seat that controlled the objective-hero when it left play (the event's seat; the card, out of play, has no controller to compare), however it leaves play. It cannot be modified or blanked.
    { id: "16031:triggered:1", cardCode: "16031", lines: ["16031:A:2"], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "EliminatePlayer" }] },

    // 16032 Firyal. After she commits to a quest she looks at the top card of the encounter deck, then may discard it (17008:A:1's form).
    {
      id: "16032:response:1",
      cardCode: "16032",
      lines: ["16032:A:1"],
      timing: "response",
      trigger: "committed",
      subject: "self",
      instructions: [
        { verb: "LookAtTop" },
        {
          verb: "Choose",
          who: "actor",
          options: [
            { id: "discard", requires: { kind: "matches", card: "picked" }, instructions: [{ verb: "MoveEncounterCard", to: "discard" }] },
            { id: "keep", instructions: [] },
          ],
        },
      ],
    },

    // 16033 Yazan: Ranged is a keyword; 16033:A:2 is 17004:A:2 (copied below); an enemy that guards a hero is immune to player card effects, so he cannot choose it.

    // 16034 Jubayr: Sentinel is a keyword. After he is declared as a defender, once each phase, he discards 1 facedown shadow card from a non-unique enemy (before the shadow cards are revealed).
    {
      id: "16034:response:1",
      cardCode: "16034",
      lines: ["16034:A:2"],
      timing: "response",
      trigger: "declaredDefender",
      subject: "self",
      limit: "oncePerPhase",
      condition: { kind: "canPick", pick: { type: "enemy", control: "any", nonUnique: true, facedownShadow: true } },
      instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", nonUnique: true, facedownShadow: true } }, { verb: "DiscardShadowOf" }],
    },

    // 16035 Sauron's Enforcers. X, its Threat, Attack and Defense, is the stage number of the main quest (41027:A:1's form); at the end of the round the first player assigns X damage among all characters in play: heroes in the staging area and guarded heroes, the
    // allies and the objective-heroes of every player too (damage is no player card effect).
    {
      id: "16035:constant:1",
      cardCode: "16035",
      lines: ["16035:A:1"],
      timing: "constant",
      instructions: (["threat", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: STAGE, until: "whileSourceInPlay", target: "self" })),
    },
    {
      id: "16035:forced:1",
      cardCode: "16035",
      lines: ["16035:A:2"],
      timing: "forced",
      trigger: "endOfRound",
      instructions: [{ verb: "AssignDamage", amount: STAGE, pick: { type: "character", control: "any", captive: "include", who: "firstPlayer" } }],
    },

    // 16036 Southron Boma. X, its Threat, is the stage number; Travel: each player spends 1 resource (copied below); Shadow: an objective-hero that defends is readied and the attack deals it no damage.
    { id: "16036:constant:1", cardCode: "16036", lines: ["16036:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: STAGE, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "16036:shadow:1",
      cardCode: "16036",
      lines: ["16036:A:3"],
      timing: "shadow",
      instructions: [{ verb: "Ready", target: "defender", when: DEFENDER_OBJECTIVE }, { verb: "ModifyStat", stat: "dealsNoDamage", amount: 1, until: "endOfAttack", target: "attacker", when: DEFENDER_OBJECTIVE }],
    },

    // 16037 Village Hut. After the players travel here the first player discards the top card of his deck; an ally goes into play under his control, exhausted. (Travel: copied below.)
    {
      id: "16037:response:1",
      cardCode: "16037",
      lines: ["16037:A:1"],
      timing: "response",
      trigger: "traveled",
      instructions: [
        { verb: "ActAs", who: "firstPlayer" },
        { verb: "DiscardFromDeck", amount: 1 },
        { verb: "Pick", pick: { type: "card", control: "you", from: "discard", looked: true, cardType: "ally" } },
        { verb: "PutIntoPlay", card: "picked", who: "actor", exhausted: true },
      ],
    },

    // 16038 Savage Attack. Each player in turn chooses: discard his highest cost ally, or reveal the top card of the encounter deck (a player with no ally can only reveal). (Shadow: copied below.)
    {
      id: "16038:whenRevealed:1",
      cardCode: "16038",
      lines: ["16038:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            {
              verb: "Choose",
              who: "actor",
              options: [
                { id: "ally", requires: { kind: "canPick", pick: { type: "ally", control: "you", highestCost: true } }, instructions: [{ verb: "Pick", pick: { type: "ally", control: "you", highestCost: true } }, { verb: "DiscardPicked" }] },
                { id: "reveal", instructions: [{ verb: "RevealEncounter" }] },
              ],
            },
          ],
        },
      ],
    },

    // 16039 Overrun by Orcs. X is twice the stage number for the total Threat in the staging area until the end of the phase; Shadow: the defending player assigns X (the stage number) damage among the characters he controls.
    { id: "16039:whenRevealed:1", cardCode: "16039", lines: ["16039:A:1"], timing: "whenRevealed", instructions: [{ verb: "RaiseStagingThreat", amount: { stage: true, times: 2 }, until: "endOfPhase" }] },
    { id: "16039:shadow:1", cardCode: "16039", lines: ["16039:A:2"], timing: "shadow", instructions: [{ verb: "AssignDamage", amount: STAGE, pick: { type: "character", control: "you" } }] },

    // 16057 Forest Clearing. When it is explored the top card of the encounter deck is discarded; an enemy is added to the staging area (51026:A:1's form). (Shadow: copied below.)
    {
      id: "16057:forced:1",
      cardCode: "16057",
      lines: ["16057:A:1"],
      timing: "forced",
      trigger: "locationExplored",
      subject: "self",
      instructions: [
        { verb: "MoveEncounterCard", card: "deckTop", to: "discard" },
        { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" } } },
      ],
    },

    // 16058 Dense Jungle. When it is explored the top card of the encounter deck is discarded; a location is added to the staging area (51152:A:1's form).
    {
      id: "16058:forced:1",
      cardCode: "16058",
      lines: ["16058:A:1"],
      timing: "forced",
      trigger: "locationExplored",
      subject: "self",
      instructions: [
        { verb: "MoveEncounterCard", card: "deckTop", to: "discard" },
        { verb: "MoveEncounterCard", card: "picked", to: "staging", when: { kind: "matches", card: "picked", pick: { type: "location", control: "any" } } },
      ],
    },
    { id: "16058:shadow:1", cardCode: "16058", lines: ["16058:A:2"], timing: "shadow", instructions: [{ verb: "DiscardRandomFromHand" }] },

    // 16059 Overgrown. It attaches to the staging location with the highest current Threat that carries no Overgrown (the first player chooses among a tie; with none it is discarded); attached, it is a Condition that gives the location +1 Threat and immunity to player card effects.
    {
      id: "16059:whenRevealed:1",
      cardCode: "16059",
      lines: ["16059:A:2"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true, highestThreat: true, who: "firstPlayer", hasAttachment: { names: ["Overgrown"], none: true } } },
        { verb: "AttachSelfToPicked", when: { kind: "canPick", pick: { type: "location", control: "any", stagingOnly: true, hasAttachment: { names: ["Overgrown"], none: true } } } },
      ],
    },
    {
      id: "16059:constant:1",
      cardCode: "16059",
      lines: ["16059:A:2"],
      timing: "constant",
      instructions: [
        { verb: "CountsAs", cardType: "attachment", trait: "Condition" },
        { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "host" },
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
      ],
    },

    // 16060 Uruks of the Eye (an encounter side quest: its constant text holds while it is in the staging area). Each Orc enemy in the staging area gets -5 engagement cost; each Orc engaged with a player gets +1 Threat.
    { id: "16060:constant:1", cardCode: "16060", lines: ["16060:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -5, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true, trait: "Orc" } }] },
    { id: "16060:constant:2", cardCode: "16060", lines: ["16060:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", trait: "Orc" } }] },

    // 16061 Uruk Chieftain. It cannot have player card attachments or be optionally engaged; while the player it is engaged with is engaged with another Orc enemy it takes no damage; at the end of the encounter phase it engages the player engaged with the most
    // non-unique Orc enemies (the first player chooses among a tie, every player at 0).
    {
      id: "16061:constant:1",
      cardCode: "16061",
      lines: ["16061:A:1"],
      timing: "constant",
      instructions: [{ verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "cannotBeOptionallyEngaged", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "16061:constant:2",
      cardCode: "16061",
      lines: ["16061:A:2"],
      timing: "constant",
      condition: { kind: "all", conditions: [{ kind: "sourceIn", zone: "engaged" }, { kind: "count", pick: { type: "enemy", control: "any", engaged: "you", trait: "Orc", other: true }, min: 1 }] },
      instructions: [{ verb: "ModifyStat", stat: "cannotTakeDamage", amount: 1, until: "whileSourceInPlay", target: "self" }],
    },
    {
      id: "16061:forced:1",
      cardCode: "16061",
      lines: ["16061:A:3"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "phase", is: "Encounter" },
      instructions: [{ verb: "EngageSeatWithMost", pick: { type: "enemy", control: "any", trait: "Orc", nonUnique: true } }],
    },

    // 16062 Uruk of Mordor. An ally with less Willpower than its Threat cannot defend against it; Shadow: +1 Attack, or +2 instead when its Threat is greater than the defending character's Willpower (an undefended attack: +1).
    { id: "16062:constant:1", cardCode: "16062", lines: ["16062:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defendersBelowThreat", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    {
      id: "16062:shadow:1",
      cardCode: "16062",
      lines: ["16062:A:2"],
      timing: "shadow",
      instructions: [
        { verb: "ModifyStat", stat: "attack", amount: 1, until: "endOfAttack", target: "attacker", when: { kind: "not", condition: THREAT_ABOVE } },
        { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfAttack", target: "attacker", when: THREAT_ABOVE },
      ],
    },

    // 16063 Uruk Warg-rider. +X Attack while it attacks a character with less Willpower than its Threat, X the difference. (Shadow: generated.)
    { id: "16063:constant:1", cardCode: "16063", lines: ["16063:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { willpowerGap: true }, until: "whileSourceInPlay", target: "self" }] },

    // 16064 Mordor Warg. It attaches to an Orc enemy in play that carries none (the first player chooses; with none it is discarded) and that enemy returns to the staging area; a Mount attachment: +2 Threat, Attack, Defense and hit points, and when its host leaves play it is
    // added to the staging area.
    {
      id: "16064:whenRevealed:1",
      cardCode: "16064",
      lines: ["16064:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "Pick", pick: WARG_HOST },
        { verb: "AttachEnemyToPicked", when: { kind: "canPick", pick: WARG_HOST } },
        { verb: "ReturnToStaging", target: { kind: "picked" }, when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", staging: true, trait: "Orc", hasAttachment: { names: ["Mordor Warg"] } } } },
        { verb: "MoveEncounterCard", card: "self", to: "discard", when: { kind: "not", condition: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any", staging: true, trait: "Orc" } } } },
      ],
    },
    {
      id: "16064:constant:1",
      cardCode: "16064",
      lines: ["16064:A:1"],
      timing: "constant",
      instructions: [
        { verb: "CountsAs", cardType: "attachment", trait: "Mount" },
        ...(["threat", "attack", "defense", "hitPoints"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: 2, until: "whileSourceInPlay", target: "host" })),
      ],
    },

    // 16065 Fear of Mordor. Each ally in play gets -1 Willpower, Attack and Defense until the end of the round (141071:A:1's form); Shadow: an additional attack when the attacker's Threat is greater than the defending character's Willpower.
    {
      id: "16065:whenRevealed:1",
      cardCode: "16065",
      lines: ["16065:A:1"],
      timing: "whenRevealed",
      instructions: (["willpower", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: -1, until: "endOfRound", target: "allies" })),
    },
    { id: "16065:shadow:1", cardCode: "16065", lines: ["16065:A:2"], timing: "shadow", instructions: [{ verb: "AfterAttack", when: THREAT_ABOVE, instructions: [{ verb: "ImmediateAttack" }] }] },

    // 16071 Surprise Attack. Setup (the piles set Uruk Chieftain aside, deal the objective-heroes aside and add a copy of Sauron's Enforcers for each player): each hero moves to the staging area, each player in turn takes an objective-hero with 2 resources, the others leave the game.
    {
      id: "16071:setup:1",
      cardCode: "16071",
      lines: ["16071:A:1"],
      timing: "setup",
      instructions: [
        { verb: "MoveHeroesToStaging" },
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "TakeObjectiveHero", codes: OBJECTIVE_HEROES, resources: 2 }] },
        ...OBJECTIVE_HEROES.map((code): Instruction => ({ verb: "RemoveSetAside", code })),
      ],
    },
    { id: "16071:constant:1", cardCode: "16071", lines: ["16071:B:1"], timing: "constant", instructions: [UNDEFENDED_TO_STAGED] },
    { id: "16071:constant:2", cardCode: "16071", lines: ["16071:B:2"], timing: "constant", instructions: [FIRST_CARD_NEEDS_NO_MATCH] },
    // After progress is placed from questing successfully, each player takes control of a hero he owns in the staging area, exhausted; the quest advances to stage 2A at once (the stage has no quest points).
    { id: "16071:forced:1", cardCode: "16071", lines: ["16071:B:3"], timing: "forced", trigger: "questProgressPlacedOnStage", instructions: [EACH_TAKES_A_HERO, { verb: "AdvanceToStage", code: "16072" }] },

    // 16072 Find the Others. When this stage is defeated each player takes control of one more hero he owns in the staging area, exhausted.
    { id: "16072:forced:1", cardCode: "16072", lines: ["16072:B:3"], timing: "forced", trigger: "questCardDefeated", subject: "self", instructions: [EACH_TAKES_A_HERO] },

    // 16073 Free the Captives. Each player searches the encounter deck and discard pile for an Orc enemy and adds it to the staging area, the deck is shuffled, and the first player attaches each hero in the staging area to a different Orc enemy there.
    {
      id: "16073:whenRevealed:1",
      cardCode: "16073",
      lines: ["16073:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", type: "enemy", trait: "Orc", to: "staging" }] }, { verb: "ShuffleEncounterDeck" }, { verb: "GuardStagedHeroes" }],
    },
    // While an enemy guards a hero it gets +1 Threat, Attack and Defense and is immune to player card effects (11192:A:2's form); the hero returns to its owner, exhausted, when the guard leaves play (18074:B:2's form: the user ruling for Lost in Mirkwood holds for any way
    // the guard leaves play); the stage cannot be defeated while an enemy guards a hero.
    {
      id: "16073:constant:1",
      cardCode: "16073",
      lines: ["16073:B:1"],
      timing: "constant",
      instructions: [
        ...(["threat", "attack", "defense"] as const).map((stat): Instruction => ({ verb: "ModifyStat", stat, amount: 1, until: "whileSourceInPlay", holders: GUARD })),
        { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", holders: GUARD },
      ],
    },
    { id: "16073:forced:1", cardCode: "16073", lines: ["16073:B:2"], timing: "forced", trigger: "leftPlay", subject: { type: "card", control: "any", guardsHero: true }, instructions: [{ verb: "ReleaseGuardedHero" }] },
    { id: "16073:constant:2", cardCode: "16073", lines: ["16073:B:3"], timing: "constant", condition: { kind: "canPick", pick: GUARD }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 16074 Escape into the Jungle. Uruk Chieftain comes from the set-aside cards, the discard pile is shuffled into the deck and 1 card per player is revealed; the Chieftain takes no non-combat damage; each non-unique Orc enemy gets -10 engagement cost; after the Chieftain
    // engages a player it attacks at once (it is dealt a shadow card); the stage cannot be defeated while the Chieftain is in play, and defeating it wins the game.
    {
      id: "16074:whenRevealed:1",
      cardCode: "16074",
      lines: ["16074:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "AddSetAsideToStaging", code: CHIEFTAIN }, { verb: "ShuffleEncounterDiscard" }, { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RevealEncounter" }] }],
    },
    { id: "16074:constant:1", cardCode: "16074", lines: ["16074:B:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "cannotTakeNonCombatDamage", amount: 1, until: "whileSourceInPlay", holders: CHIEFTAIN_ENEMY }] },
    { id: "16074:constant:2", cardCode: "16074", lines: ["16074:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "engagementCost", amount: -10, until: "whileSourceInPlay", holders: NON_UNIQUE_ORC }] },
    { id: "16074:forced:1", cardCode: "16074", lines: ["16074:B:3"], timing: "forced", trigger: "engaged", subject: CHIEFTAIN_ENEMY, instructions: [{ verb: "ImmediateAttack", target: "subject" }] },
    { id: "16074:constant:3", cardCode: "16074", lines: ["16074:B:4"], timing: "constant", condition: { kind: "inPlay", code: CHIEFTAIN, is: true }, instructions: [{ verb: "Restrict", what: "advance" }] },
    { id: "16074:questResolution:1", cardCode: "16074", lines: ["16074:B:4"], timing: "questResolution", instructions: [{ verb: "WinGame" }] },

    // The twins of the other cards' lines.
    copyLine("17004:A:2", "16033:A:2"),
    copyLine("50718:A:3", "16036:A:2"),
    copyLine("41015:A:2", "16037:A:2"),
    copyLine("146063:A:2", "16038:A:2"),
    copyLine("50317:A:1", "16056:A:1"),
    copyLine("50919:A:3", "16057:A:2"),
    copyLine("16031:A:2", "16032:A:2"),
    copyLine("16031:A:2", "16033:A:3"),
    copyLine("16031:A:2", "16034:A:3"),
    copyLine("16071:B:1", "16072:B:1"),
    copyLine("16071:B:2", "16072:B:2"),
  ],
  { pool: [...M, ...MURDER, ...THE_OATH, ...TOWER_OF_CIRITH_UNGOL, ...STONE_OF_ERECH, ...ATTACK_ON_DOL_GULDUR] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
