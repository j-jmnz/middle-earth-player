import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for Shadow and Flame (dwarrowdelf cycle part 9, no campaign card). Every line is read from the scan ledger (data/printed/dwarrowdelf.json). Surge and the keywords of Durin's Bane (Regenerate 3, Indestructible) are keywords; Setup's piles (Dark Pit set aside, Durin's Bane in the
// staging area) are the scenario's data. The Goblins of the Deep and Deeps of Moria cards have their records elsewhere. The Nightmare deck's records are in ../nightmare/shadow-and-flame.ts. Readings: docs/scenarios/dwarrowdelf.md (Shadow and Flame).
// Rules: dwd.durins-bane, dwd.regenerate, rr.engaged, rr.combat-phase, rr.hit-points, rr.damage, rr.cancel, rr.forced, rr.first-player, rr.shadow-effects, rr.attachment-cards, rr.quest-phase, rr.active-location, rr.refresh-phase, rr.winning-the-game, faq.additional-attacks, faq.enemy-attacks-outside-combat (data/rules/entries.json).
const BANE_CODE = "04150";
const BANE = "Durin's Bane";
const DURINS_BANE: PickSpec = { type: "enemy", control: "any", staging: true, names: [BANE] };
const BANE_IN_PLAY: Condition = { kind: "inPlay", code: BANE_CODE, is: true };
const IN_ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const ATTACKER_IS_BANE: Condition = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", names: [BANE] } };
const BANE_UNDAMAGED: Condition = { kind: "count", pick: { type: "enemy", control: "any", staging: true, names: [BANE], damaged: false }, min: 1 };
// The first player's questing hero, the one a card may remove from the quest to cancel its effect.
const FIRST_PLAYERS_QUESTING_HERO: PickSpec = { type: "hero", control: "you", committed: true, who: "firstPlayer" };
// The top card of the encounter deck the effect just discarded is a treachery card.
const DISCARDED_TREACHERY: Condition = { kind: "less", left: 0, right: { discardedMatching: { type: "treachery", control: "any" } } };
const MY_ALLY: PickSpec = { type: "ally", control: "you" };

/** "The first player may remove 1 questing hero he controls from the quest to cancel this effect" (04146:A:1, 04147:A:2): the first player either removes a hero (the hero stays exhausted) and the effect does not happen, or keeps it and `effect` runs on Durin's Bane. */
const cancelByRemoving = (effect: Instruction): Instruction => ({
  verb: "Choose",
  who: "firstPlayer",
  options: [
    { id: "remove", requires: { kind: "canPick", pick: FIRST_PLAYERS_QUESTING_HERO }, instructions: [{ verb: "Pick", pick: FIRST_PLAYERS_QUESTING_HERO }, { verb: "RemoveFromQuest" }] },
    { id: "keep", instructions: [{ verb: "Pick", pick: DURINS_BANE }, effect as never] },
  ],
});

/** A treachery that attaches itself to Durin's Bane when it is revealed (04145:A:1, 04152:A:1, 04153:A:1). */
const attachToBane = (code: string, line: string): Effect => ({ id: `${code}:whenRevealed:1`, cardCode: code, lines: [line], timing: "whenRevealed", instructions: [{ verb: "AttachSelf", to: { kind: "enemy", trait: "Balrog" } }] });

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 04138 Nearing the Gate. A:1: Setup leaves the shuffle (Dark Pit set aside and Durin's Bane staged are the data's piles). B:1: each player's threat becomes 0, then X cards, X the players less 1, are revealed one after another (none with one player).
  { id: "04138:setup:1", cardCode: "04138", lines: ["04138:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
  {
    id: "04138:whenRevealed:1",
    cardCode: "04138",
    lines: ["04138:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "SetThreat", value: 0 }] }, { verb: "RevealEncounter", times: { players: true, plus: -1 } }],
  },

  // 04139 The Rear Guard. B:1: at the end of the quest phase, with a hero committed to the quest this round, 4 progress go on the stage, bypassing the active location. B:2: with no hit points left on Durin's Bane the stage advances at once (it is in play all through stage 2, so a missing card is not read as 0 hit points).
  {
    id: "04139:forced:1",
    cardCode: "04139",
    lines: ["04139:B:1"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "committedThisRound" }] },
    instructions: [{ verb: "AddStageProgress", amount: 4 }],
  },
  {
    id: "04139:constant:1",
    cardCode: "04139",
    lines: ["04139:B:2"],
    timing: "constant",
    condition: { kind: "not", condition: { kind: "hitPointsLeft", code: BANE_CODE } },
    instructions: [{ verb: "ModifyStat", stat: "advanceNow", amount: 1, until: "whileSourceInPlay", target: "self" }],
  },

  // 04140 Last Lord of Moria. B:1: Durin's Bane attacks the first player at once, whatever his threat, and Dark Pit joins the staging area. B:2: the players cannot win while Durin's Bane is in play; with it gone (only Dark Pit's discard takes it out of play) they have won.
  {
    id: "04140:whenRevealed:1",
    cardCode: "04140",
    lines: ["04140:B:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "Pick", pick: DURINS_BANE }, { verb: "AttackFromStaging", who: "firstPlayer" }, { verb: "AddSetAsideToStaging", code: "04141" }],
  },
  { id: "04140:constant:1", cardCode: "04140", lines: ["04140:B:2"], timing: "constant", condition: BANE_IN_PLAY, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "04140:constant:2", cardCode: "04140", lines: ["04140:B:2"], timing: "constant", condition: { kind: "inPlay", code: BANE_CODE, is: false }, instructions: [{ verb: "WinGame" }] },

  // 04141 Dark Pit. While it is the active location any player has a Refresh Action: exhaust X characters (0 to 3), discard the top X cards of his deck, and if their combined printed cost is higher than the remaining hit points of Durin's Bane it is discarded from play (its discard supersedes "cannot leave the staging area", FAQ 3.026).
  {
    id: "04141:action:1",
    cardCode: "04141",
    lines: ["04141:A:1"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, IN_ACTIVE] },
    instructions: [
      { verb: "Each", pick: { type: "character", control: "you", state: "ready" }, upTo: 3, instructions: [{ verb: "Exhaust", target: { kind: "picked" } }] },
      { verb: "DiscardFromDeck", amount: { x: true } },
      { verb: "DiscardNamedFromPlay", name: BANE, when: { kind: "less", left: { stat: "hitPoints", ofNamed: BANE, remaining: true }, right: { discarded: "cost" } } },
    ],
  },

  // 04142 Second Hall. While it is the active location: after any character leaves play, 1 card is revealed from the encounter deck and added to the staging area. 04143 Second Deep. While Durin's Bane has no damage no progress can be placed on it.
  { id: "04142:forced:1", cardCode: "04142", lines: ["04142:A:1"], timing: "forced", trigger: "leftPlay", subject: { type: "character", control: "any" }, condition: IN_ACTIVE, instructions: [{ verb: "RevealEncounter" }] },
  { id: "04143:constant:1", cardCode: "04143", lines: ["04143:A:1"], timing: "constant", condition: BANE_UNDAMAGED, instructions: [{ verb: "ModifyStat", stat: "noProgressPlaced", amount: 1, until: "whileSourceInPlay", target: "self" }] },

  // 04144 Fires in the Deep. When Revealed: each player discards 1 ally he controls, if able; it gains surge when no player has an ally to discard (the same check as Chance Encounter's, made before the discards). Shadow: the defending player discards 1 ally he controls, if able.
  {
    id: "04144:whenRevealed:1",
    cardCode: "04144",
    lines: ["04144:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: { type: "ally", control: "any" } } } },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: MY_ALLY }, { verb: "Discard", target: { kind: "picked" } }] },
    ],
  },
  { id: "04144:shadow:1", cardCode: "04144", lines: ["04144:A:2"], timing: "shadow", instructions: [{ verb: "Pick", pick: MY_ALLY }, { verb: "Discard", target: { kind: "picked" } }] },

  // 04145 Counter-Spell (a Condition attachment on Durin's Bane). Forced: when a player plays an event, the top card of the encounter deck is discarded; a treachery cancels the effects of the event, discards the event player's hand and discards Counter-Spell.
  attachToBane("04145", "04145:A:1"),
  { id: "04145:constant:1", cardCode: "04145", lines: ["04145:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Condition" }] },
  {
    id: "04145:forced:1",
    cardCode: "04145",
    lines: ["04145:A:1"],
    timing: "forced",
    trigger: "played",
    subject: { type: "card", control: "any", cardType: "event" },
    instructions: [
      { verb: "DiscardEncounterTop", count: 1 },
      { verb: "CancelEventEffects", when: DISCARDED_TREACHERY },
      { verb: "DiscardHand", who: "eventSeat", when: DISCARDED_TREACHERY },
      { verb: "Discard", target: { kind: "self" }, when: DISCARDED_TREACHERY },
    ],
  },

  // 04146 Inner Flame. When Revealed: Durin's Bane gets +3 Attack until the end of the round; the first player may remove a questing hero from the quest to cancel it. Shadow (and 04149 Leaping Flame's): +3 Attack when the attacker is Durin's Bane.
  { id: "04146:whenRevealed:1", cardCode: "04146", lines: ["04146:A:1"], timing: "whenRevealed", instructions: [cancelByRemoving({ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfRound", target: "picked" })] },
  { id: "04146:shadow:1", cardCode: "04146", lines: ["04146:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "endOfAttack", target: "attacker", when: ATTACKER_IS_BANE }] },

  // 04147 Inner Shadow (Surge is a keyword). When Revealed: 5 damage are healed from Durin's Bane; the same removal cancels the heal only.
  { id: "04147:whenRevealed:1", cardCode: "04147", lines: ["04147:A:2"], timing: "whenRevealed", instructions: [cancelByRemoving({ verb: "Heal", amount: 5, target: "picked" })] },

  // 04148 Whip Lash. When Revealed: each player discards 1 attachment he controls, if able. Shadow: the defending player discards all attachments he controls when the attacker is Durin's Bane.
  { id: "04148:whenRevealed:1", cardCode: "04148", lines: ["04148:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "attachment", control: "you", controlled: true } }, { verb: "DiscardPicked" }] }] },
  { id: "04148:shadow:1", cardCode: "04148", lines: ["04148:A:2"], timing: "shadow", instructions: [{ verb: "DiscardEach", pick: { type: "attachment", control: "you", controlled: true }, when: ATTACKER_IS_BANE }] },

  // 04149 Leaping Flame. When Revealed: Durin's Bane makes an immediate attack against the first player, whatever his threat (a shadow card is dealt for it). The Shadow is Inner Flame's.
  { id: "04149:whenRevealed:1", cardCode: "04149", lines: ["04149:A:1"], timing: "whenRevealed", instructions: [{ verb: "Pick", pick: DURINS_BANE }, { verb: "AttackFromStaging", who: "firstPlayer" }] },
  copyLine("04146:A:2", "04149:A:2"),

  // 04150 Durin's Bane (Regenerate 3 and Indestructible are keywords). A:1: no player attachment is played on it. A:2: it cannot leave the staging area, is considered engaged with each player whose threat is 1 or greater (read live) and attacks each of them once in the combat phase; it keeps its Threat in the staging area.
  { id: "04150:constant:1", cardCode: BANE_CODE, lines: ["04150:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "noPlayerAttachments", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "04150:constant:2",
    cardCode: BANE_CODE,
    lines: ["04150:A:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotLeaveStaging", amount: 1, until: "whileSourceInPlay" },
      { verb: "ModifyStat", stat: "engagedWithThreatening", amount: 1, until: "whileSourceInPlay" },
      { verb: "ModifyStat", stat: "cannotBeEngaged", amount: 1, until: "whileSourceInPlay" },
    ],
  },

  // 04151 Ranging Goblin. When Revealed: each player deals 1 damage to a hero he controls. Forced: after a character leaves play, it and the top card of the encounter discard pile are shuffled into the encounter deck.
  { id: "04151:whenRevealed:1", cardCode: "04151", lines: ["04151:A:1"], timing: "whenRevealed", instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "DamageCard", amount: 1, target: "picked" }] }] },
  {
    id: "04151:forced:1",
    cardCode: "04151",
    lines: ["04151:A:2"],
    timing: "forced",
    trigger: "leftPlay",
    subject: { type: "character", control: "any" },
    instructions: [{ verb: "MoveEncounterCard", card: "discardTop", to: "shuffle" }, { verb: "MoveEncounterCard", card: "self", to: "shuffle" }],
  },

  // 04152 Fiery Sword, 04153 Many Thonged Whip (Weapon attachments on Durin's Bane). The Sword: attached enemy gets +3 Attack. The Whip: when Durin's Bane attacks, the defending player discards 1 card at random from his hand.
  attachToBane("04152", "04152:A:1"),
  { id: "04152:constant:1", cardCode: "04152", lines: ["04152:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Weapon" }] },
  { id: "04152:constant:2", cardCode: "04152", lines: ["04152:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: 3, until: "whileSourceInPlay", target: "host" }] },
  attachToBane("04153", "04153:A:1"),
  { id: "04153:constant:1", cardCode: "04153", lines: ["04153:A:1"], timing: "constant", instructions: [{ verb: "CountsAs", cardType: "attachment", trait: "Weapon" }] },
  { id: "04153:forced:1", cardCode: "04153", lines: ["04153:A:1"], timing: "forced", trigger: "attacks", subject: "host", instructions: [{ verb: "DiscardRandomFromHand" }] },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
