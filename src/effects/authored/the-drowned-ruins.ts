import type { Condition, Effect, Instruction, PickSpec } from "../../catalog/boundary.ts";

import { ALWAYS, MANY_PLAYERS } from "./conditions.ts";
import { copyLine, withCopies } from "./reprint.ts";
import { AUTHORED_EFFECTS as RAID } from "./raid-on-the-grey-havens.ts";
import { AUTHORED_EFFECTS as NUMENOR } from "./the-fate-of-numenor.ts";
import { AUTHORED_EFFECTS as DEPTHS } from "./the-thing-in-the-depths.ts";

// Records for The Drowned Ruins (Dream-chaser part 7, campaign card 11200): the campaign card, the two quest stages, the Grotto and Underwater locations and the encounter cards. Every line is read from the scan
// ledger (data/printed/dream-chaser.json) and is covered (pnpm effects open lists none). The Grotto deck and the flip are the uncharted family's (src/rules/families/uncharted/grotto.ts), the Stormcaller Elite's
// attack the grapple family's. The Command events and Círdan's Blessing (boons) are in pool/DCCEDrownedRuins.ts.
// Rules: dcce.grotto-deck, dcce.setup-the-drowned-ruins, dcce.campaign-setup-the-drowned-ruins, dcce.campaign-mode, dcce.gaining-xp, dcce.scalable-upgradable, dcce.encounter-cards, rr.active-location, rr.victory,
// rr.explored, rr.engaged, rr.cannot, rr.winning-the-game (data/rules/entries.json).

const FEW_PLAYERS = { kind: "not", condition: MANY_PLAYERS } as const satisfies Condition;
// A double-sided location, whichever side it shows (dcce.grotto-deck).
const DOUBLE_SIDED: PickSpec = { type: "location", control: "any", doubleSided: true };
// "Response: After you travel to X, you may flip it to its Underwater side." (12098:A:2, 12099:A:1, 12100:A:2)
const flipOnTravel = (code: string, line: string): Effect => ({ id: `${code}:response:1`, cardCode: code, lines: [line], timing: "response", trigger: "traveled", subject: "self", instructions: [{ verb: "FlipDoubleSided" }] });

// The active location is an Underwater location (the Underwater side of a double-sided location, or Drowned Cave).
const UNDERWATER_ACTIVE = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: "Underwater" } } as const satisfies Condition;
const NOT_UNDERWATER_ACTIVE = { kind: "not", condition: UNDERWATER_ACTIVE } as const satisfies Condition;
const ACTIVE = { kind: "sourceIn", zone: "activeLocation" } as const satisfies Condition;
const UNDEAD_ENEMY = { type: "enemy", control: "any", staging: true, trait: "Undead" } as const;
// An Underwater location in the victory display.
const UNDERWATER_IN_VICTORY = { type: "card", control: "any", from: "victory", trait: "Underwater" } as const;

// "Players cannot play attachments or allies" while an Underwater location is active (12092:B:1, 12093:B:1): every player is barred from playing, whoever controls the stage; a card put into play is not played (rr.play-and-put-into-play).
const NO_ALLIES_OR_ATTACHMENTS: Instruction[] = [
  { verb: "CannotPlay", pick: { type: "card", control: "you", cardType: "ally" }, anyPlayer: true },
  { verb: "CannotPlay", pick: { type: "card", control: "you", cardType: "attachment" }, anyPlayer: true },
];
// "If X is the active location at the end of the quest phase": the Forced effect of an Underwater side.
const END_OF_QUEST_ACTIVE = { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, ACTIVE] } as const satisfies Condition;
// "Then, you may flip X to its Grotto side": the first player decides.
const MAY_FLIP_BACK: Instruction = { verb: "Choose", who: "firstPlayer", options: [{ id: "flip", instructions: [{ verb: "FlipDoubleSided" }] }, { id: "stay", instructions: [] }] };
// The flip after a discard of tokens or cards that must be resolved in full first ("Then, you may flip", rr.then): offered only when no pool or deck came up short.
const MAY_FLIP_AFTER_FULL: Instruction = { verb: "Choose", who: "firstPlayer", options: [{ id: "flip", requires: { kind: "thenResolves" }, instructions: [{ verb: "FlipDoubleSided" }] }, { id: "stay", instructions: [] }] };
// The scenario's objective allies, in play under the first and the last player (they count as allies in play, not as objectives).
const OBJECTIVE_ALLY: PickSpec = { type: "ally", control: "any", names: ["Captain Sahír", "Na'asiyah"] };
// "Choose a card type and discard each card in your hand that is not of the chosen type": one option for each card type a player's hand can hold (a hero never is).
const HAND_TYPES = ["ally", "attachment", "event", "player-side-quest", "treasure"] as const;

const COMMAND_AND_BLESSING = ["11201", "11202", "11203", "11204", "11205", "11206", "11207", "11208"];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 11200 The Drowned Ruins (campaign card). Setup (Campaign Mode): Black Key (boon) is set aside and attached to Captain Sahír once the quest card's Setup has put him into play (ScenarioDefinition.afterSetup),
    // Revenant is shuffled into the encounter deck, each player may take one copy of Command into hand and one player (whichever the players choose) one copy of Círdan's Blessing (the campaign checklist asks each seat in turn until one takes it; the copies are earned at the
    // Resolution), and each character in play may take 1 damage to lower its controller's threat by 1. The card stays in the game because Revenant places resources on it. Resolution: the chosen Command and
    // Círdan's Blessing copies join the pool; the XP list (the lines no template reads).
    {
      id: "11200:campaignSetup:1",
      cardCode: "11200",
      lines: ["11200:A:2", "11200:A:3"],
      timing: "campaignSetup",
      instructions: [
        { verb: "KeepCampaignCard" },
        { verb: "SetAside", code: "11183" },
        { verb: "ShuffleIntoEncounterDeck", code: "11181" },
        { verb: "AttachSetAsideTo", code: "11183", to: "Captain Sahír" },
        { verb: "ChooseCards", codes: ["11201", "11202", "11203", "11204"], who: "eachSeat", to: "hand", optional: true, unearned: true, afterMulligan: true },
        { verb: "ChooseCards", codes: ["11205", "11206", "11207", "11208"], who: "onePlayer", to: "hand", optional: true, unearned: true, afterMulligan: true },
        { verb: "TradeDamageForThreat", damage: 1, threat: 1 },
      ],
    },
    { id: "11200:resolution:1", cardCode: "11200", lines: ["11200:B:1"], timing: "resolution", instructions: [{ verb: "EarnDealt", codes: COMMAND_AND_BLESSING }] },
    // Written here, not copied from 11179:B:4: the Fate of Númenor line counts the resources on its own campaign card (11179).
    { id: "11200:resolution:3", cardCode: "11200", lines: ["11200:B:4"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, each: { kind: "tokens", code: "11200" }, max: 3 }] },
    copyLine("11194:B:5", "11200:B:5"),
    copyLine("11182:B:8", "11200:B:6"),
    { id: "11200:resolution:7", cardCode: "11200", lines: ["11200:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: UNDERWATER_IN_VICTORY, min: 5 } }] },
    { id: "11200:resolution:10", cardCode: "11200", lines: ["11200:B:8"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 2, when: { kind: "inVictory", code: "12094", is: true } }] },

    // 12092 The Grotto. Setup: Shrine to Morgoth is set aside by the scenario's piles; the Grotto deck is prepared, its top 2 locations (3 with 3 or more players) join the staging area Grotto side faceup, and the first
    // player takes control of Captain Sahír, the last player of Na'asiyah (dcce.grotto-deck). Side B: after a double-sided location is explored the top location of the Grotto deck joins the staging area.
    {
      id: "12092:setup:1",
      cardCode: "12092",
      lines: ["12092:A:1"],
      timing: "setup",
      instructions: [
        { verb: "PrepareGrottoDeck" },
        { verb: "AddFromGrottoDeck", count: 2, when: FEW_PLAYERS },
        { verb: "AddFromGrottoDeck", count: 3, when: MANY_PLAYERS },
        { verb: "PutSetAsideInPlay", name: "Captain Sahír" },
        { verb: "PutSetAsideInPlay", name: "Na'asiyah", to: "lastPlayer" },
      ],
    },
    { id: "12092:forced:2", cardCode: "12092", lines: ["12092:B:2"], timing: "forced", trigger: "locationExplored", subject: DOUBLE_SIDED, instructions: [{ verb: "AddFromGrottoDeck", count: 1 }] },
    // 12092 The Grotto, side B: the players cannot advance unless 3 Underwater locations are in the victory display (rr.cannot).
    { id: "12092:constant:2", cardCode: "12092", lines: ["12092:B:3"], timing: "constant", condition: { kind: "count", pick: UNDERWATER_IN_VICTORY, max: 2 }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 12094 Shrine to Morgoth (Grotto side). While it is in the victory display the players have escaped and win (rr.winning-the-game; as 11026:B:2 does for the Shrine of the Uncharted deck).
    { id: "12094:constant:2", cardCode: "12094", lines: ["12094:A:3"], timing: "constant", condition: { kind: "sourceIn", zone: "victory" }, instructions: [{ verb: "WinGame" }] },

    // 12094 Shrine to Morgoth (Grotto side). It cannot have attachments and cannot enter the staging area; at the beginning of the quest phase it flips to its Underwater side, keeping its progress.
    {
      id: "12094:constant:1",
      cardCode: "12094",
      lines: ["12094:A:1"],
      timing: "constant",
      instructions: [
        { verb: "ModifyStat", stat: "cannotHaveAttachments", amount: 1, until: "whileSourceInPlay" },
        { verb: "ModifyStat", stat: "cannotEnterStaging", amount: 1, until: "whileSourceInPlay" },
      ],
    },
    { id: "12094:forced:1", cardCode: "12094", lines: ["12094:A:2"], timing: "forced", trigger: "beginningOfPhase", condition: { kind: "phase", is: "Quest" }, instructions: [{ verb: "FlipDoubleSided", keepProgress: true }] },

    // The Grotto sides that may flip to their Underwater side once the players travel to them (dcce.grotto-deck).
    flipOnTravel("12098", "12098:A:2"),
    flipOnTravel("12099", "12099:A:1"),
    flipOnTravel("12100", "12100:A:2"),

    // 12092 The Grotto, side B, and 12093 Sahír's Betrayal, side B: while an Underwater location is the active location the players cannot play attachments or allies.
    { id: "12092:constant:1", cardCode: "12092", lines: ["12092:B:1"], timing: "constant", condition: UNDERWATER_ACTIVE, instructions: NO_ALLIES_OR_ATTACHMENTS },
    copyLine("12092:B:1", "12093:B:1"),

    // 12093 Sahír's Betrayal. When Revealed: the set aside Shrine to Morgoth becomes the active location; Captain Sahír flips to his enemy side and attacks the first player at once, then leaves the game; each player
    // searches the encounter deck and discard pile for an Undead enemy and adds it to the staging area; the encounter deck is shuffled.
    {
      id: "12093:whenRevealed:1",
      cardCode: "12093",
      lines: ["12093:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "MakeSetAsideActive", code: "12094" },
        { verb: "FlipEliteAndAttack", name: "Captain Sahír" },
        // The attack comes first, and the rest of the line follows it as printed: the removal, the Undead searches and the shuffle all wait for the attack's end (AfterAttack).
        {
          verb: "AfterAttack",
          instructions: [
            { verb: "RemoveNamedFromGame", name: "Captain Sahír" },
            { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SearchMove", trait: "Undead", type: "enemy", to: "staging" }] },
            { verb: "ShuffleEncounterDeck" },
          ],
        },
      ],
    },

    // 12095 Shrine to Morgoth (Underwater side): the same restrictions and victory as the Grotto side; Forced: at the end of the quest phase while it is the active location each player raises their threat by 5.
    copyLine("12094:A:1", "12095:A:1"),
    { id: "12095:forced:1", cardCode: "12095", lines: ["12095:A:2"], timing: "forced", trigger: "endOfPhase", condition: END_OF_QUEST_ACTIVE, instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "RaiseThreat", amount: 5, who: "actor" }] }] },
    copyLine("12094:A:3", "12095:A:3"),

    // 12098 Undersea Grotto, Grotto side: while it is the active location the first ally the players play each round costs 1 less.
    { id: "12098:constant:1", cardCode: "12098", lines: ["12098:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "ally" }, amount: 1, firstEachRound: true, anyPlayer: true }] },

    // 12099 Cursed Caverns, Grotto side: after the players explore it as the active location each player may raise their threat by 2 to draw the bottom card of their deck.
    {
      id: "12099:response:2",
      cardCode: "12099",
      lines: ["12099:A:2"],
      timing: "response",
      trigger: "activeExplored",
      subject: "self",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [{ verb: "Choose", who: "actor", options: [{ id: "draw", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }, { verb: "Draw", from: "bottom" }] }, { id: "decline", instructions: [] }] }],
        },
      ],
    },

    // 12101 Dark Abyss (Underwater side): characters cannot attack while it is the active location. Forced: at the end of the quest phase while it is active, 1 damage to each character in play; then the first player may flip it to its Grotto side.
    { id: "12101:constant:1", cardCode: "12101", lines: ["12101:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotAttack", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
    {
      id: "12101:forced:1",
      cardCode: "12101",
      lines: ["12101:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: END_OF_QUEST_ACTIVE,
      instructions: [{ verb: "Each", pick: { type: "character", control: "any" }, instructions: [{ verb: "DamageCard", amount: 1, target: "picked" }] }, MAY_FLIP_BACK],
    },

    // 12102 Twisting Hollow (Underwater side): characters cannot ready from card effects while it is the active location. Forced: at the end of the quest phase while it is active each player discards a character; then the first player may flip it.
    { id: "12102:constant:1", cardCode: "12102", lines: ["12102:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotReadyByEffect", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
    {
      id: "12102:forced:1",
      cardCode: "12102",
      lines: ["12102:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: END_OF_QUEST_ACTIVE,
      instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" } }, { verb: "Discard", target: { kind: "picked" } }] }, MAY_FLIP_BACK],
    },

    // 12103 Sunken Temple (Underwater side): attachments are blank (except for Traits) while it is the active location. Forced: at the end of the quest phase while it is active, 1 resource is discarded from each objective ally and each hero's pool; then the first player may flip it.
    { id: "12103:constant:1", cardCode: "12103", lines: ["12103:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: { type: "attachment", control: "any" } }] },
    {
      id: "12103:forced:1",
      cardCode: "12103",
      lines: ["12103:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: END_OF_QUEST_ACTIVE,
      instructions: [
        { verb: "Each", pick: OBJECTIVE_ALLY, instructions: [{ verb: "DiscardResources", amount: 1, target: "picked" }] },
        { verb: "Each", pick: { type: "hero", control: "any" }, instructions: [{ verb: "DiscardResources", amount: 1, target: "picked" }] },
        MAY_FLIP_AFTER_FULL,
      ],
    },

    // 12106 Into the Abyss. When Revealed: each player chooses a card type and discards each card in their hand that is not of that type; with no card discarded it gains surge.
    {
      id: "12106:whenRevealed:1",
      cardCode: "12106",
      lines: ["12106:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [{ verb: "Choose", who: "actor", options: HAND_TYPES.map((type) => ({ id: type, instructions: [{ verb: "DiscardEach", pick: { type: "card", control: "you", from: "hand", notCardType: type } }] })) }],
        },
        { verb: "GainSurge", when: { kind: "noneDiscarded" } },
      ],
    },

    // 12105 Powerful Undertow. When Revealed: the active location cannot be flipped this round; an Underwater active location resolves its Forced effect as if it were the end of the quest phase; with none, this card gains Doomed 3 instead.
    {
      id: "12105:whenRevealed:1",
      cardCode: "12105",
      lines: ["12105:A:1"],
      timing: "whenRevealed",
      instructions: [
        { verb: "ModifyStat", stat: "noFlipActive", amount: 1, until: "endOfRound", target: "table" },
        { verb: "ResolveActiveForced", phase: "Quest", when: UNDERWATER_ACTIVE },
        { verb: "Doomed", amount: 3, when: NOT_UNDERWATER_ACTIVE },
      ],
    },

    // 12108 Ancient Depths. When Revealed: the top location of the Grotto deck joins the staging area and flips to its Underwater side; this cannot be canceled.
    { id: "12108:whenRevealed:1", cardCode: "12108", lines: ["12108:A:1"], timing: "whenRevealed", uncancelable: ALWAYS, instructions: [{ verb: "AddFromGrottoDeck", count: 1, flip: true }] },

    // 12096 Sea-scorpion: +2 Attack while the active location is Underwater.
    { id: "12096:constant:1", cardCode: "12096", lines: ["12096:A:1"], timing: "constant", condition: UNDERWATER_ACTIVE, instructions: [{ verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay" }] },

    // 12097 Cave Eel: it cannot be engaged unless the active location is Underwater, and an engaged Cave Eel goes back to the staging area at the beginning of the encounter phase unless it is.
    { id: "12097:constant:1", cardCode: "12097", lines: ["12097:A:1"], timing: "constant", condition: NOT_UNDERWATER_ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay" }] },
    {
      id: "12097:forced:1",
      cardCode: "12097",
      lines: ["12097:A:2"],
      timing: "forced",
      trigger: "beginningOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Encounter" }, { kind: "sourceIn", zone: "engaged" }] },
      instructions: [{ verb: "ReturnToStaging", target: { kind: "self" }, when: NOT_UNDERWATER_ACTIVE }],
    },

    // 12100 Water-logged Halls: while it is the active location each Undead enemy in play gets -1 Threat.
    { id: "12100:constant:1", cardCode: "12100", lines: ["12100:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "threat", amount: -1, until: "whileSourceInPlay", holders: UNDEAD_ENEMY }] },

    // 12104 Drowned Cave. While it is the active location Undead enemies cannot be engaged, and the Undead enemies engaged when it becomes active return to the staging area. Forced: at the end of the quest phase
    // each player discards the top 10 cards of their deck, then the first player may return Drowned Cave to the staging area.
    { id: "12104:constant:1", cardCode: "12104", lines: ["12104:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay", holders: UNDEAD_ENEMY }] },
    {
      id: "12104:triggered:1",
      cardCode: "12104",
      lines: ["12104:A:1"],
      timing: "triggered",
      trigger: "becameActive",
      instructions: [{ verb: "ReturnToStaging", target: { kind: "engagedEnemies", trait: "Undead", who: "each", pick: "all" } }],
    },
    {
      id: "12104:forced:1",
      cardCode: "12104",
      lines: ["12104:A:2"],
      timing: "forced",
      trigger: "endOfPhase",
      condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, ACTIVE] },
      instructions: [
        { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: 10 }] },
        { verb: "Choose", who: "firstPlayer", options: [{ id: "return", requires: { kind: "thenResolves" }, instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }, { id: "stay", instructions: [] }] },
      ],
    },

    // 12106 Into the Abyss, Shadow: with an Underwater active location the attacking enemy brings a Creature enemy from the encounter deck or discard pile into the staging area.
    { id: "12106:shadow:1", cardCode: "12106", lines: ["12106:A:2"], timing: "shadow", instructions: [{ verb: "SearchMove", trait: "Creature", type: "enemy", to: "staging", when: UNDERWATER_ACTIVE }] },

    // 12107 Tangling and Grasping. When Revealed: each player removes a character they control from the quest, and with an Underwater active location it takes 2 damage. Shadow: as Quarter Deck's.
    {
      id: "12107:whenRevealed:1",
      cardCode: "12107",
      lines: ["12107:A:1"],
      timing: "whenRevealed",
      instructions: [
        {
          verb: "ForEachPlayer",
          order: "firstFirst",
          instructions: [
            { verb: "Pick", pick: { type: "character", control: "you", committed: true } },
            { verb: "RemoveFromQuest" },
            { verb: "DamageCard", amount: 2, target: "picked", when: UNDERWATER_ACTIVE },
          ],
        },
      ],
    },
    copyLine("12047:A:2", "12107:A:2"),
  ],
  { pool: [...NUMENOR, ...DEPTHS, ...RAID] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
