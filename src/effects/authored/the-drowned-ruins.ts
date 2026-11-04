import type { Condition, Effect } from "../../catalog/boundary.ts";

import { copyLine, withCopies } from "./reprint.ts";
import { AUTHORED_EFFECTS as RAID } from "./raid-on-the-grey-havens.ts";
import { AUTHORED_EFFECTS as NUMENOR } from "./the-fate-of-numenor.ts";
import { AUTHORED_EFFECTS as DEPTHS } from "./the-thing-in-the-depths.ts";

// Records for The Drowned Ruins (Dream-chaser part 7, campaign card 11200): the campaign card and the encounter cards and quest/location lines that read with the vocabulary the schema has today. Every line is read
// from the scan ledger (data/printed/dream-chaser.json). The lines that need the Grotto deck (dcce.grotto-deck: the Grotto side up on entering the staging area, the Underwater side only on a flip, Shrine to
// Morgoth set aside), a flip that keeps or removes progress on a Grotto location, a table-wide "players cannot play", the Command events' choice of up to X options and a few other mechanics stay open:
// pnpm effects:open lists them, and the report of this file's author says what each needs. Command and Círdan's Blessing (boons) are in pool/DCCE.ts.
// Rules: dcce.grotto-deck, dcce.setup-the-drowned-ruins, dcce.campaign-setup-the-drowned-ruins, dcce.campaign-mode, dcce.gaining-xp, dcce.scalable-upgradable, dcce.encounter-cards, rr.active-location, rr.victory,
// rr.explored, rr.engaged, rr.cannot, rr.winning-the-game (data/rules/entries.json).

// The active location is an Underwater location (the Underwater side of a double-sided location, or Drowned Cave).
const UNDERWATER_ACTIVE = { kind: "matches", card: "activeLocation", pick: { type: "location", control: "any", trait: "Underwater" } } as const satisfies Condition;
const NOT_UNDERWATER_ACTIVE = { kind: "not", condition: UNDERWATER_ACTIVE } as const satisfies Condition;
const ACTIVE = { kind: "sourceIn", zone: "activeLocation" } as const satisfies Condition;
const UNDEAD_ENEMY = { type: "enemy", control: "any", staging: true, trait: "Undead" } as const;
// An Underwater location in the victory display.
const UNDERWATER_IN_VICTORY = { type: "card", control: "any", from: "victory", trait: "Underwater" } as const;

const COMMAND_AND_BLESSING = ["11201", "11202", "11203", "11204", "11205", "11206", "11207", "11208"];

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 11200 The Drowned Ruins (campaign card). Setup (Campaign Mode): Black Key (boon) is set aside and attached to Captain Sahír once the quest card's Setup has put him into play (ScenarioDefinition.afterSetup),
    // Revenant is shuffled into the encounter deck, each player may take one copy of Command into hand and one player one copy of Círdan's Blessing (the campaign checklist asks; the copies are earned at the
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
        { verb: "ChooseCards", codes: ["11205", "11206", "11207", "11208"], who: "firstPlayer", to: "hand", optional: true, unearned: true, afterMulligan: true },
        { verb: "TradeDamageForThreat", damage: 1, threat: 1 },
      ],
    },
    { id: "11200:resolution:1", cardCode: "11200", lines: ["11200:B:1"], timing: "resolution", instructions: [{ verb: "EarnDealt", codes: COMMAND_AND_BLESSING }] },
    copyLine("11179:B:4", "11200:B:4"),
    copyLine("11194:B:5", "11200:B:5"),
    copyLine("11182:B:8", "11200:B:6"),
    { id: "11200:resolution:7", cardCode: "11200", lines: ["11200:B:7"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 1, when: { kind: "count", pick: UNDERWATER_IN_VICTORY, min: 5 } }] },
    { id: "11200:resolution:10", cardCode: "11200", lines: ["11200:B:8"], timing: "resolution", instructions: [{ verb: "GainXp", amount: 2, when: { kind: "inVictory", code: "12094", is: true } }] },

    // 12092 The Grotto, side B: the players cannot advance unless 3 Underwater locations are in the victory display (rr.cannot).
    { id: "12092:constant:2", cardCode: "12092", lines: ["12092:B:3"], timing: "constant", condition: { kind: "count", pick: UNDERWATER_IN_VICTORY, max: 2 }, instructions: [{ verb: "Restrict", what: "advance" }] },

    // 12094 Shrine to Morgoth (Grotto side). While it is in the victory display the players have escaped and win (rr.winning-the-game; as 11026:B:2 does for the Shrine of the Uncharted deck).
    { id: "12094:constant:2", cardCode: "12094", lines: ["12094:A:3"], timing: "constant", condition: { kind: "sourceIn", zone: "victory" }, instructions: [{ verb: "WinGame" }] },

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
        { verb: "Choose", who: "firstPlayer", options: [{ id: "return", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] }, { id: "stay", instructions: [] }] },
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
