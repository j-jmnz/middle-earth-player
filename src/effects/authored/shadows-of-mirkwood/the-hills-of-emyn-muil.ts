import type { Condition, Effect, Instruction, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Records for The Hills of Emyn Muil (Shadows of Mirkwood part 4, standalone, no campaign card). Every line is read from the scan ledger (data/printed/shadows-of-mirkwood.json). The stage has one quest point and two limits: the first treachery revealed
// each quest phase gains surge while no location is in the staging area, and the players cannot defeat it until no Emyn Muil location is in play and the victory display holds 20 Victory points. The Emyn Muil locations each bend the round while active
// (Amon Hen bars events, Amon Lhaw blanks attachments, Rauros Falls forces every character to quest, East Wall of Rohan taxes non-Rohan allies, The Outer Ridge raises the Threat of the staging area) or cost something to reach (Shores of Nen Hithoel, The Highlands, The North Stair).
// Rules: rr.surge, rr.victory, rr.active-location, rr.travel, rr.blank, rr.cannot, rr.step-6-4-3, rr.then, faq.lasting-effects, sotm.setup-the-hills-of-emyn-muil, sotm.emyn-muil-victory-points (data/rules/entries.json); the readings are in docs/scenarios/shadows-of-mirkwood/the-hills-of-emyn-muil.md (The Hills of Emyn Muil).
const ACTIVE: Condition = { kind: "sourceIn", zone: "activeLocation" };
const EMYN_MUIL_LOCATION: PickSpec = { type: "location", control: "any", trait: "Emyn Muil" };
const STAGED_LOCATION: PickSpec = { type: "location", control: "any", stagingOnly: true };
const ACTIVE_LOCATION: PickSpec = { type: "location", control: "any", active: true };
const LOCATION_IN_PLAY: PickSpec = { type: "location", control: "any" };
const ANY_ATTACHMENT: PickSpec = { type: "attachment", control: "any" };

// "Shadow: After this attack resolves, return attacking enemy to the staging area." (02087:A:2, 02088:A:2, 02089:A:2).
const RETURN_ATTACKER: Instruction = { verb: "AfterAttack", instructions: [{ verb: "ReturnToStaging", target: { kind: "self" } }] };

export const AUTHORED_EFFECTS: readonly Effect[] = withCopies([
  // 02082 The Hills of Emyn Muil (the one stage). Setup: Amon Hen and Amon Lhaw are already in the staging area (the piles); the encounter deck is shuffled. The first treachery revealed each quest phase gains surge when no location is in the staging area as it is
  // revealed (a later treachery is not the first either way). The stage cannot be defeated while an Emyn Muil location is in play or fewer than 20 Victory points are in the victory display; the progress it holds waits.
  { id: "02082:setup:1", cardCode: "02082", lines: ["02082:A:1"], timing: "setup", instructions: [{ verb: "ShuffleEncounterDeck" }] },
  {
    id: "02082:forced:1",
    cardCode: "02082",
    lines: ["02082:B:1"],
    timing: "forced",
    trigger: "revealed",
    byEncounterDeck: true,
    subject: { type: "treachery", control: "any" },
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "firstTreachery" }, { kind: "count", pick: STAGED_LOCATION, max: 0 }] },
    instructions: [{ verb: "GrantSurgeToSubject" }],
  },
  // Two records, one for each way the stage is held (a record's condition is one test; either one holds it).
  { id: "02082:constant:2", cardCode: "02082", lines: ["02082:B:2"], timing: "constant", condition: { kind: "canPick", pick: EMYN_MUIL_LOCATION }, instructions: [{ verb: "Restrict", what: "advance" }] },
  { id: "02082:constant:3", cardCode: "02082", lines: ["02082:B:2"], timing: "constant", condition: { kind: "not", condition: { kind: "victoryPoints", min: 20 } }, instructions: [{ verb: "Restrict", what: "advance" }] },

  // 02083 Amon Hen. Threat X, X twice the players. While active, players cannot play events.
  { id: "02083:constant:1", cardCode: "02083", lines: ["02083:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "threat", amount: { players: true, times: 2 }, until: "whileSourceInPlay", target: "self" }] },
  { id: "02083:constant:2", cardCode: "02083", lines: ["02083:A:2"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "CannotPlay", pick: { type: "card", control: "any", cardType: "event" }, anyPlayer: true }] },

  // 02084 Amon Lhaw. Threat X, X twice the players. While active, every attachment is treated as if its printed text box were blank, Traits included (rr.blank; no "except for Traits" here).
  copyLine("02083:A:1", "02084:A:1"),
  {
    id: "02084:constant:2",
    cardCode: "02084",
    lines: ["02084:A:2"],
    timing: "constant",
    condition: ACTIVE,
    instructions: [
      { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", holders: ANY_ATTACHMENT },
      { verb: "ModifyStat", stat: "blanksTraits", amount: 1, until: "whileSourceInPlay", holders: ANY_ATTACHMENT },
    ],
  },

  // 02085 East Wall of Rohan. While active, a character that is not a Rohan costs 2 more matching resources to play (a hero is never played, so the allies).
  {
    id: "02085:constant:1",
    cardCode: "02085",
    lines: ["02085:A:1"],
    timing: "constant",
    condition: ACTIVE,
    instructions: [{ verb: "IncreaseCost", amount: 2, pick: { type: "card", control: "any", cardType: "ally", notTraits: ["Rohan"] } }],
  },

  // 02086 The North Stair. Forced: after the players travel here, the top card of the encounter discard pile moves to the staging area and its When Revealed effects resolve (it is not revealed from the deck, so no Surge or Doomed).
  {
    id: "02086:forced:1",
    cardCode: "02086",
    lines: ["02086:A:1"],
    timing: "forced",
    trigger: "traveled",
    subject: "self",
    instructions: [{ verb: "MoveEncounterCard", card: "discardTop", to: "staging" }, { verb: "ResolveWhenRevealed", card: "picked" }],
  },

  // 02087 Rauros Falls. While active, every character must commit to the quest, if able. Shadow: after the attack resolves the attacker returns to the staging area (02088 and 02089 print it too).
  { id: "02087:constant:1", cardCode: "02087", lines: ["02087:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "mustCommit", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }] },
  { id: "02087:shadow:1", cardCode: "02087", lines: ["02087:A:2"], timing: "shadow", instructions: [RETURN_ATTACKER] },

  // 02088 Shores of Nen Hithoel. Travel: the first player discards an event card of his choice from his hand; with none he cannot pay, and the players cannot travel here.
  {
    id: "02088:travel:1",
    cardCode: "02088",
    lines: ["02088:A:1"],
    timing: "travel",
    instructions: [{ verb: "Pick", pick: { type: "card", control: "you", from: "hand", cardType: "event", who: "firstPlayer" } }, { verb: "DiscardPicked" }],
  },
  copyLine("02087:A:2", "02088:A:2"),

  // 02089 The Outer Ridge. While active, each location in the staging area gets +1 Threat (the active location is not in the staging area).
  { id: "02089:constant:1", cardCode: "02089", lines: ["02089:A:1"], timing: "constant", condition: ACTIVE, instructions: [{ verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", holders: { type: "location", control: "any", stagingOnly: true } }] },
  copyLine("02087:A:2", "02089:A:2"),

  // 02090 The Highlands. Travel: the first player reveals the top card of the encounter deck and adds it to the staging area (a card revealed, so Surge and Doomed resolve; a treachery resolves and is discarded).
  { id: "02090:travel:1", cardCode: "02090", lines: ["02090:A:1"], timing: "travel", instructions: [{ verb: "RevealEncounter", who: "firstPlayer" }] },

  // 02091 Impassable Chasm. When Revealed: the active location loses all its progress and returns to the staging area; with none, this card gains surge.
  {
    id: "02091:whenRevealed:1",
    cardCode: "02091",
    lines: ["02091:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "GainSurge", when: { kind: "not", condition: { kind: "canPick", pick: ACTIVE_LOCATION } } },
      { verb: "RemoveAllProgress", target: "activeLocation" },
      { verb: "ReturnToStaging", target: { kind: "activeLocation" } },
    ],
  },

  // 02092 Rockslide. When Revealed: 2 damage to each character committed to the quest. Shadow: the defending character is removed from combat and the attack is considered undefended.
  { id: "02092:whenRevealed:1", cardCode: "02092", lines: ["02092:A:1"], timing: "whenRevealed", instructions: [{ verb: "DamageEach", amount: 2, pick: { type: "character", control: "any", committed: true } }] },
  { id: "02092:shadow:1", cardCode: "02092", lines: ["02092:A:2"], timing: "shadow", instructions: [{ verb: "ConsiderUndefended" }] },

  // 02093 Slick Footing. When Revealed: 1 progress comes off each location in play (the staging area and the active location); then each player discards from the top of his deck as many cards as tokens were removed.
  {
    id: "02093:whenRevealed:1",
    cardCode: "02093",
    lines: ["02093:A:1"],
    timing: "whenRevealed",
    instructions: [
      { verb: "RemoveProgressEach", amount: 1, pick: LOCATION_IN_PLAY },
      { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "DiscardFromDeck", amount: { x: true }, when: { kind: "x", min: 1 } }] },
    ],
  },

  // 02094 Orc Horse Thieves (Doomed 2 is a keyword). +1 Attack for each location in the staging area.
  { id: "02094:constant:1", cardCode: "02094", lines: ["02094:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attack", amount: { count: STAGED_LOCATION }, until: "whileSourceInPlay", target: "self" }] },
]);

export const AUTHORED_REPLACES: readonly string[] = [];
