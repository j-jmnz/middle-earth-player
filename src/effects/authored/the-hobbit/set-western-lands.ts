import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

import { copyLine, withCopies } from "../reprint.ts";

// Registered by the-hobbit.ts (the cycle's file). The records of the Western Lands encounter set (131035, 131039 to 131041, 131055 to 131057), which We Must Away, Ere Break of Day and Over the Misty Mountains Grim both deal. Every line is read from the scan ledger (data/printed/the-hobbit.json);
// the readings are in docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md (We Must Away, Ere Break of Day). The Doomed 1 of No Campfire is the keyword the build reads.
// Rules: rr.reveal, rr.discard-pile-and-victory-display, rr.forced, rr.response, rr.explored, rr.resources, rr.doomed-x, rr.the-word-choose, rr.attachment-cards, hob.bilbo-baggins-ohauh (data/rules/entries.json).
const BILBO: PickSpec = { type: "hero", control: "any", names: ["Bilbo Baggins"] };
const HERO_WITH_RESOURCES: PickSpec = { type: "hero", control: "you", hasResources: true };
const IN_STAGING: Condition = { kind: "sourceIn", zone: "staging" };
const DEALT_DAMAGE: Condition = { kind: "dealt", min: 1 };

export const WESTERN_LANDS_EFFECTS: readonly Effect[] = withCopies([
  // 131035 A Suspicious Crow. When Revealed: the top card of the encounter discard pile, whatever its type, is revealed in full (found out of the deck, so its keywords and When Revealed resolve) and added to the staging area; with the pile empty nothing happens.
  {
    id: "131035:whenRevealed:1",
    cardCode: "131035",
    lines: ["131035:A:1"],
    timing: "whenRevealed",
    instructions: [{ verb: "ResolveWhenRevealed", card: "discardTop", reveal: true }],
  },
  // Shadow: once the attack has ended and dealt damage, the shadow card goes back into the encounter deck.
  {
    id: "131035:shadow:1",
    cardCode: "131035",
    lines: ["131035:A:2"],
    timing: "shadow",
    instructions: [{ verb: "AfterAttack", instructions: [{ verb: "ShuffleShadowIntoEncounterDeck", code: "131035", when: DEALT_DAMAGE }] }],
  },

  // 131039 Dreary Hills. Forced: each player discards 1 card at random from his hand. "After placing 1 or more progress tokens" is heard for every placement on it, the one that explores it too (`progressPlacedOnSelf`, as Bottomless Chasm 901606:A:1 is read; docs/scenarios/the-hobbit/we-must-away-ere-break-of-day.md, We Must Away).
  {
    id: "131039:forced:1",
    cardCode: "131039",
    lines: ["131039:A:1"],
    timing: "forced",
    trigger: "progressPlacedOnSelf",
    subject: "self",
    instructions: [{ verb: "DiscardRandomFromHand", amount: 1, who: "eachSeat" }],
  },
  // Response: Bilbo Baggins (when in play) gains 1 resource once the location has left play explored.
  {
    id: "131039:response:1",
    cardCode: "131039",
    lines: ["131039:A:2"],
    timing: "response",
    trigger: "leftPlay",
    subject: "self",
    condition: { kind: "subjectExplored" },
    instructions: [{ verb: "Pick", pick: BILBO }, { verb: "AddResources", amount: 1, to: "picked" }],
  },
  copyLine("131039:A:2", "131040:A:2"),

  // 131040 Lone-Lands. Forced: each player removes 1 resource from the pool of one of his heroes, if able.
  {
    id: "131040:forced:1",
    cardCode: "131040",
    lines: ["131040:A:1"],
    timing: "forced",
    trigger: "progressPlacedOnSelf",
    subject: "self",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "Pick", pick: HERO_WITH_RESOURCES }, { verb: "DiscardResources", amount: 1, target: "picked" }] }],
  },

  // 131041 Cave Entrance. The Forced effect it gains in the staging area: at the end of the round X cards, one for each player, go from the top of the encounter discard pile to the bottom of the encounter deck.
  {
    id: "131041:forced:1",
    cardCode: "131041",
    lines: ["131041:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    condition: IN_STAGING,
    instructions: [{ verb: "Repeat", times: { players: true }, instructions: [{ verb: "MoveEncounterCard", card: "discardTop", to: "deckBottom" }] }],
  },

  // 131055 No Campfire. When Revealed: each player chooses to raise his threat by 4 or to reveal an additional encounter card.
  {
    id: "131055:whenRevealed:1",
    cardCode: "131055",
    lines: ["131055:A:2"],
    timing: "whenRevealed",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [{ verb: "Choose", who: "actor", options: [{ id: "threat", instructions: [{ verb: "RaiseThreat", amount: 4, who: "actor" }] }, { id: "reveal", instructions: [{ verb: "RevealEncounter" }] }] }],
      },
    ],
  },
  { id: "131055:shadow:1", cardCode: "131055", lines: ["131055:A:3"], timing: "shadow", instructions: [{ verb: "RaiseThreat", amount: 2, who: "actor" }] },

  // 131056 Wind-whipped Rain. When Revealed: every attachment in play but a treasure or an objective is discarded (a treasure and an objective are not attachments for a pick).
  { id: "131056:whenRevealed:1", cardCode: "131056", lines: ["131056:A:1"], timing: "whenRevealed", instructions: [{ verb: "DiscardAllInPlay", pick: { type: "attachment", control: "any" } }] },
  { id: "131056:shadow:1", cardCode: "131056", lines: ["131056:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "defense", amount: -1, until: "endOfAttack", target: "defender" }] },

  // 131057 More Like a Grocer. When Revealed: all the resources in Bilbo Baggins' pool (the Baggins resources) are discarded.
  { id: "131057:whenRevealed:1", cardCode: "131057", lines: ["131057:A:1"], timing: "whenRevealed", instructions: [{ verb: "Each", pick: BILBO, instructions: [{ verb: "DiscardResources", all: true, target: "picked" }] }] },
  { id: "131057:shadow:1", cardCode: "131057", lines: ["131057:A:2"], timing: "shadow", instructions: [{ verb: "ResolveWhenRevealed", card: "self" }] },
]);
