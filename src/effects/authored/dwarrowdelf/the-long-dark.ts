import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { RECORDS as TDOM } from "../pool/TDoM.ts";
import { AUTHORED_EFFECTS as THE_REDHORN_GATE } from "./the-redhorn-gate.ts";
import { copyLine, withCopies } from "../reprint.ts";

// Records for The Long Dark (Dwarrowdelf part 7, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). PASS is a keyword (the build reads it from the printed line, src/catalog/keyword-line.ts), so the lines that print only it have no record. A Lost line's record is
// a `forced` effect on the trigger `lost` (src/rules/families/long-dark/lost.ts); a locate test (LocateTest) is followed by instructions that read its result (`lastLocateFailed`, `lastLocatePassed`). The Twists and Turns and Deeps of Moria cards, Cave Torch and +1 Defense (04088:A:2, a template)
// have their records elsewhere. The Nightmare deck's records are in ../nightmare/the-long-dark.ts. The readings are in docs/brief.md (The Long Dark).
// Rules: dwd.lost-effects, dwd.locate-test, dwd.locate-test-example, dwd.cave-torch-the-long-dark, dwd.setup-the-long-dark, dwd.last-player, dwd.revealing-enemies, rr.in-play-and-out-of-play, rr.shadow-effects, rr.first-player, rr.next-player, faq.next-player, rr.forced, rr.attachment-cards, rr.active-location,
// rr.damage, rr.defending-player, rr.effects, rr.travel, rr.step-4-2, rr.running-out-of-cards, faq.last-encounter-card (data/rules/entries.json).
const TORCH = "03041";
const FAILED: Condition = { kind: "lastLocateFailed" };
const PASSED: Condition = { kind: "lastLocatePassed" };
const UNDEFENDED: Condition = { kind: "undefended" };
const LOCATE: Instruction = { verb: "LocateTest", who: "firstPlayer" };
/** "Trigger all Lost: effects in play", part of a failed test. */
const LOST_IF_FAILED: Instruction = { verb: "TriggerLost", mode: "all", when: FAILED };
const ATTACHED: Condition = { kind: "sourceIn", zone: "attached" };
const EVERY_CHARACTER: PickSpec = { type: "character", control: "any" };
const READY_CHARACTER: PickSpec = { type: "character", control: "you", state: "ready" };
const OWN_ALLY: PickSpec = { type: "ally", control: "you" };
const TREACHERY_DISCARDED: Condition = { kind: "matches", card: "picked", pick: { type: "treachery", control: "any" } };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies(
  [
    // 04086 Journey in the Black Pit. Setup: the first player attaches Cave Torch to a hero of any player (the Torch is set aside by the scenario data; it is removed from the game if it would leave play, dwd.cave-torch-the-long-dark), then the encounter deck is shuffled. B:1: cards are discarded until X locations
    // lie in the discard pile, X the players less one (at least 1); they are added to the staging area and the other cards discarded are shuffled back. B:2: each location has +1 Threat; after an unsuccessful quest the Lost effects trigger.
    {
      id: "04086:setup:1",
      cardCode: "04086",
      lines: ["04086:A:1"],
      timing: "setup",
      instructions: [{ verb: "SetAside", code: TORCH }, { verb: "Pick", pick: { type: "hero", control: "any", attachable: TORCH, who: "firstPlayer" } }, { verb: "AttachSetAside", code: TORCH, removeWhenLeaving: true }, { verb: "ShuffleEncounterDeck" }],
    },
    {
      id: "04086:whenRevealed:1",
      cardCode: "04086",
      lines: ["04086:B:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "DiscardUntilEnemies", perPlayer: 1, less: 1, atLeast: 1, to: "staging", cardType: "location", returnOthers: true }],
    },
    { id: "04086:constant:1", cardCode: "04086", lines: ["04086:B:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any" } }] },
    { id: "04086:forced:1", cardCode: "04086", lines: ["04086:B:2"], timing: "forced", trigger: "questFailed", instructions: [{ verb: "TriggerLost", mode: "all" }] },

    // 04087 Continuing Eastward. B:1: the first player makes a locate test; when it is failed as many cards are revealed as there are players, then the Lost effects trigger (a passed test triggers no ill effects, dwd.locate-test). B:2: after an unsuccessful quest the Lost effects trigger. B:3: defeating the stage wins the game.
    {
      id: "04087:whenRevealed:1",
      cardCode: "04087",
      lines: ["04087:B:1"],
      timing: "whenRevealed",
      instructions: [LOCATE, { verb: "Repeat", times: { players: true }, instructions: [{ verb: "RevealEncounter", who: "firstPlayer", when: FAILED }] }, LOST_IF_FAILED],
    },
    { id: "04087:forced:1", cardCode: "04087", lines: ["04087:B:2"], timing: "forced", trigger: "questFailed", instructions: [{ verb: "TriggerLost", mode: "all" }] },
    copyLine("04013:B:4", "04087:B:3"),

    // 04088 Durin's Greaves. A:1: the first player attaches it to a hero of any player (it is discarded to the encounter discard pile when the hero leaves play, rr.attachment-cards). A:2 (+1 Defense) is a template.
    { id: "04088:whenRevealed:1", cardCode: "04088", lines: ["04088:A:1"], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "hero", control: "any" } }] },

    // 04089 Abandoned Mine. Lost: the two Goblin enemies most recently discarded come back to the staging area, not revealed. 04090 Dwarven Forge. Lost: each player in turn discards a card of his choice from his hand. 04091 Silent Caverns. Lost: every character of every player is exhausted.
    { id: "04089:forced:1", cardCode: "04089", lines: ["04089:A:1"], timing: "forced", trigger: "lost", instructions: [{ verb: "ReturnFromDiscard", trait: "Goblin", count: 2 }] },
    { id: "04090:forced:1", cardCode: "04090", lines: ["04090:A:1"], timing: "forced", trigger: "lost", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromHand", amount: 1 }] }] },
    { id: "04091:forced:1", cardCode: "04091", lines: ["04091:A:1"], timing: "forced", trigger: "lost", instructions: [{ verb: "ExhaustEach", pick: EVERY_CHARACTER }] },

    // 04092 Twisting Passage. A:1: progress that would be placed on it waits for the first player's locate test (the engine holds the placement for a card with this record, `progressHeldBy`); a passed test places it all, a failed one places none and triggers the Lost effects.
    { id: "04092:forced:1", cardCode: "04092", lines: ["04092:A:1"], timing: "forced", trigger: "progressWouldBePlaced", instructions: [LOCATE, { verb: "PlaceHeldProgress", when: PASSED }, LOST_IF_FAILED] },

    // 04093 Fatigue. When Revealed: each player exhausts a ready character, then it gains surge when some player controls no unexhausted character. Shadow: the defending player exhausts a ready character he controls.
    { id: "04093:whenRevealed:1", cardCode: "04093", lines: ["04093:A:1"], timing: "whenRevealed", instructions: [{ verb: "EachExhaustsOne" }, { verb: "GainSurge", when: { kind: "playerWithoutReady" } }] },
    { id: "04093:shadow:1", cardCode: "04093", lines: ["04093:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: READY_CHARACTER }, { verb: "Exhaust", target: { kind: "picked" } }] },

    // 04094 Foul Air: a failed test deals 2 damage to every character of every player, then the Lost effects trigger. 04096 Vast and Intricate: a failed test raises every player's threat by 7, removes every progress token from play (the quest card, the locations, any side quest) and triggers the Lost effects.
    { id: "04094:whenRevealed:1", cardCode: "04094", lines: ["04094:A:1"], timing: "whenRevealed", instructions: [LOCATE, { verb: "DamageEach", amount: 2, pick: EVERY_CHARACTER, when: FAILED }, LOST_IF_FAILED] },
    {
      id: "04096:whenRevealed:1",
      cardCode: "04096",
      lines: ["04096:A:1"],
      timing: "whenRevealed",
      instructions: [
        LOCATE,
        { verb: "RaiseThreat", amount: 7, who: "eachSeat", when: FAILED },
        { verb: "RemoveAllQuestProgress", when: FAILED },
        { verb: "RemoveAllProgress", pick: { type: "location", control: "any", progress: true }, when: FAILED },
        { verb: "RemoveAllProgress", pick: { type: "card", control: "any", questCard: true }, when: FAILED },
        LOST_IF_FAILED,
      ],
    },

    // 04095 Gathering Ground. When Revealed: it attaches to the location in the staging area with the highest Threat plus remaining quest points (the first player chooses among those tied; with no location it is discarded). Counts as a Condition attachment: each enemy revealed from the encounter deck gains surge.
    {
      id: "04095:whenRevealed:1",
      cardCode: "04095",
      lines: ["04095:A:1"],
      timing: "whenRevealed",
      instructions: [{ verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true, highestThreatPlusRemaining: true, who: "firstPlayer" } }, { verb: "AttachSelfToPicked", unlimited: true }],
    },
    { id: "04095:constant:1", cardCode: "04095", lines: ["04095:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
    { id: "04095:constant:2", cardCode: "04095", lines: ["04095:A:1"], timing: "constant", condition: ATTACHED, instructions: [{ verb: "EnemiesGainSurge" }] },

    // 04097 Cave Spider. A:1: the first player draws 1 card, then (only if he drew, rr.then) chooses and discards 4 from his hand. A:2: the player it engages discards 1 card of his choice.
    { id: "04097:whenRevealed:1", cardCode: "04097", lines: ["04097:A:1"], timing: "whenRevealed", instructions: [{ verb: "Draw", who: "firstPlayer" }, { verb: "ActAs", who: "firstPlayer" }, { verb: "DiscardFromHand", amount: 4, when: { kind: "drew" } }] },
    { id: "04097:forced:1", cardCode: "04097", lines: ["04097:A:2"], timing: "forced", trigger: "engaged", subject: "self", instructions: [{ verb: "DiscardFromHand", amount: 1 }] },

    // 04098 Goblin Sneak. A:1: after it engages a player the top card of the encounter deck is discarded; when it is a treachery the Sneak engages the next player (a new engagement: this Forced effect fires again). A:2: the shadow card is added to the staging area, as Goblin Swordsman's.
    {
      id: "04098:forced:1",
      cardCode: "04098",
      lines: ["04098:A:1"],
      timing: "forced",
      trigger: "engaged",
      subject: "self",
      instructions: [{ verb: "MoveEncounterCard", card: "deckTop", to: "discard" }, { verb: "EngageNextPlayer", announces: true, when: TREACHERY_DISCARDED }],
    },
    copyLine("41041:A:2", "04098:A:2"),

    // 04099 Goblin Warlord. Lost: each player discards an ally he controls from play. Shadow: the Lost effects trigger (the Warlord's own only when a copy is in play: a shadow card is not in play).
    { id: "04099:forced:1", cardCode: "04099", lines: ["04099:A:1"], timing: "forced", trigger: "lost", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: OWN_ALLY }, { verb: "DiscardPicked" }] }] },
    { id: "04099:shadow:1", cardCode: "04099", lines: ["04099:A:2"], timing: "shadow", instructions: [{ verb: "TriggerLost", mode: "all" }] },

    // 04100 Rock Adder. A:1: it cannot be attacked until its attack has placed damage on a character this round (a Forced effect on `attackDamagedCharacter` notes it). A:2: when the attack is undefended the defending player discards a character he controls from play.
    { id: "04100:constant:1", cardCode: "04100", lines: ["04100:A:1"], timing: "constant", condition: { kind: "flag", stat: "dealtDamageThisRound", holder: "self", is: false }, instructions: [{ verb: "ModifyStat", stat: "cannotBeAttacked", amount: 1, until: "whileSourceInPlay", target: "self" }] },
    { id: "04100:forced:1", cardCode: "04100", lines: ["04100:A:1"], timing: "forced", trigger: "attackDamagedCharacter", subject: "self", instructions: [{ verb: "ModifyStat", stat: "dealtDamageThisRound", amount: 1, until: "endOfRound", target: "self" }] },
    { id: "04100:shadow:1", cardCode: "04100", lines: ["04100:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: { type: "character", control: "you" }, when: UNDEFENDED }, { verb: "Discard", target: { kind: "picked" }, when: UNDEFENDED }] },
  ],
  { pool: [...TDOM, ...THE_REDHORN_GATE] },
);

export const AUTHORED_REPLACES: readonly string[] = [];
