import type { Condition, Effect, PickSpec } from "../../../catalog/boundary.ts";

// Authored records for putting cards into play, leaving play, delayed returns, control changes and card type changes (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.

// A card that is put into play from the hand is not offered while a copy of it (a unique card) is in play.
const CAN_ENTER: Condition = { kind: "matches", card: "self", pick: { type: "ally", control: "any", intoPlay: true } };
// "If your threat is 20 or less and this is the first time you played a copy of ~ this round": the event goes back to the hand.
const AGAIN: Condition = { kind: "all", conditions: [{ kind: "threat", max: 20 }, { kind: "copiesPlayedThisRound", max: 0, you: true }] };
const EXHAUSTED_SELF: Condition = { kind: "matches", card: "self", pick: { type: "character", control: "any", state: "exhausted" } };
const ALLY_IN_HAND: PickSpec = { type: "card", control: "you", from: "hand", cardType: "ally" };

export const RECORDS: readonly Effect[] = [
  // Brok Ironfist: put into play from the hand after a Dwarf hero you control leaves play.
  { id: "01019:response:1", cardCode: "01019", lines: ["01019:A:1"], timing: "response", trigger: "leftPlay", subject: { type: "hero", control: "you", trait: "Dwarf" }, fromHand: true, condition: CAN_ENTER, instructions: [{ verb: "PutIntoPlay" }] },
  // Landroval: return him to his owner's hand to put the destroyed hero back into play with 1 damage token (once per game).
  { id: "02053:response:1", cardCode: "02053", lines: ["02053:A:3"], timing: "response", trigger: "characterDestroyed", subject: { type: "hero", control: "any" }, limit: "oncePerGame", cost: { kind: "returnSelfToHand" }, instructions: [{ verb: "PutIntoPlay", card: "subject", who: "owner", damage: 1 }] },
  // Eagles of the Misty Mountains: another Eagle character that left play may be attached facedown to it.
  { id: "02119:response:1", cardCode: "02119", lines: ["02119:A:2"], timing: "response", trigger: "leftPlay", subject: { type: "character", control: "any", trait: "Eagle", other: true }, instructions: [{ verb: "AttachFacedown" }] },
  // Veteran of Nanduhirion: enters play with 1 damage token on it, placed before anything answers its entering play.
  { id: "03006:triggered:1", cardCode: "03006", lines: ["03006:A:1"], timing: "triggered", trigger: "enteredPlay", subject: "self", instructions: [{ verb: "PlaceDamage", amount: 1 }] },
  // Bofur: Quest Action from the hand, exhausted and committed; back to the hand at the end of the phase if the quest succeeded.
  {
    id: "04006:action:1",
    cardCode: "04006",
    lines: ["04006:A:1"],
    timing: "action",
    fromHand: true,
    cost: { kind: "resources", amount: 1, sphere: "spirit" },
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, CAN_ENTER] },
    instructions: [
      { verb: "PutIntoPlay", exhausted: true, committed: true },
      { verb: "Delay", until: "endOfPhase", instructions: [{ verb: "ReturnToHand", target: "self", when: { kind: "questSucceeded" } }] },
    ],
  },
  // Rider of the Mark: give control of it to another player (once per round).
  { id: "04033:action:1", cardCode: "04033", lines: ["04033:A:1"], timing: "action", limit: "oncePerRound", cost: { kind: "resources", amount: 1, sphere: "spirit" }, condition: { kind: "otherPlayer" }, instructions: [{ verb: "Pick", pick: { type: "player", control: "other" } }, { verb: "ChangeControl", to: "picked" }] },
  // Master of Lore: name a card type; the next Lore card of that type costs 1 less this phase (to a minimum of 1).
  {
    id: "05016:action:1",
    cardCode: "05016",
    lines: ["05016:A:1"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: (["ally", "attachment", "event", "player-side-quest"] as const).map((cardType) => ({
          id: cardType,
          instructions: [{ verb: "ReduceNextCost" as const, pick: { type: "card" as const, control: "you" as const, sphere: "lore" as const, cardType }, amount: 1, until: "endOfPhase" as const, min: 1 }],
        })),
      },
    ],
  },
  // Denethor: discarded as soon as his Willpower is 0 or less.
  { id: "06057:constant:2", cardCode: "06057", lines: ["06057:A:2"], timing: "constant", instructions: [{ verb: "DiscardWhen", stat: "willpower", max: 0 }] },
  // Swift and Silent, Noiseless Movement, Courage Awakened: back to the hand the first time each round at threat 20 or less.
  { id: "08003:action:1", cardCode: "08003", lines: ["08003:A:1"], timing: "action", instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Ready", target: "picked" }, { verb: "ReturnEventToHand", when: AGAIN }] },
  { id: "08033:action:1", cardCode: "08033", lines: ["08033:A:1"], timing: "action", instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true } }, { verb: "ModifyStat", stat: "noEngagementChecks", amount: 1, until: "endOfRound", target: "picked" }, { verb: "ReturnEventToHand", when: AGAIN }] },
  { id: "08061:action:1", cardCode: "08061", lines: ["08061:A:1"], timing: "action", instructions: [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "ModifyStat", stat: "willpower", amount: 2, until: "endOfPhase", target: "picked" }, { verb: "ReturnEventToHand", when: AGAIN }] },
  // Blue Mountain Trader: another player gains control of it, then moves 1 resource from one of their heroes to one of yours,
  // or it is discarded. That player makes the choice (SwitchActor); "a hero you control" is then the other player's.
  {
    id: "08006:action:1",
    cardCode: "08006",
    lines: ["08006:A:1"],
    timing: "action",
    limit: "oncePerRound",
    condition: { kind: "otherPlayer" },
    instructions: [
      { verb: "Pick", pick: { type: "player", control: "other" } },
      { verb: "ChangeControl", to: "picked" },
      { verb: "SwitchActor", to: "picked" },
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "move",
            requires: { kind: "canPick", pick: { type: "hero", control: "you", hasResources: true } },
            instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", hasResources: true } }, { verb: "Pick", pick: { type: "hero", control: "other" } }, { verb: "MoveResources", amount: 1 }],
          },
          { id: "discard", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
        ],
      },
    ],
  },
  // Herald of Anórien: giving it doomed 2 as it is played is the Response's first step; the chosen player may then put an ally
  // with printed cost 2 or lower into play from their hand.
  {
    id: "08057:response:1",
    cardCode: "08057",
    lines: ["08057:A:1"],
    timing: "response",
    trigger: "played",
    subject: "self",
    instructions: [{ verb: "Doomed", amount: 2 }, { verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "PutIntoPlayFromHand", pick: { ...ALLY_IN_HAND, maxCost: 2 }, from: "picked" }],
  },
  // Follow Me!: take the first player token and draw 1 card.
  { id: "08085:action:1", cardCode: "08085", lines: ["08085:A:1"], timing: "action", instructions: [{ verb: "TakeFirstPlayer" }, { verb: "Draw", amount: 1 }] },
  // Defender of the West: the first player controls the attached ally.
  { id: "08093:constant:2", cardCode: "08093", lines: ["08093:A:2"], timing: "constant", instructions: [{ verb: "ControlledBy", who: "firstPlayer", card: "host" }] },
  // Curious Brandybuck: from the hand after you travel, under any player's control.
  { id: "10006:response:1", cardCode: "10006", lines: ["10006:A:2"], timing: "response", trigger: "traveled", subject: { type: "location", control: "any" }, fromHand: true, instructions: [{ verb: "PutIntoPlay", who: "choose" }] },
  // Ranger of Cardolan: from the hand after you engage an enemy, with a Dúnedain hero; shuffled into its owner's deck at the end
  // of the round if it is still in play.
  {
    id: "10010:response:1",
    cardCode: "10010",
    lines: ["10010:A:1"],
    timing: "response",
    trigger: "engaged",
    eventSeat: "you",
    fromHand: true,
    cost: { kind: "resources", amount: 1, sphere: "neutral" },
    condition: { kind: "count", pick: { type: "hero", control: "you", trait: "Dúnedain" }, min: 1 },
    instructions: [{ verb: "PutIntoPlay", until: "endOfRound", then: "shuffleIntoDeck" }],
  },
  // Elven Jeweler: discard 2 other cards from your hand to put it into play from your hand.
  {
    id: "10033:action:1",
    cardCode: "10033",
    lines: ["10033:A:1"],
    timing: "action",
    fromHand: true,
    condition: { kind: "count", pick: { type: "card", control: "you", from: "hand" }, min: 2 },
    instructions: [{ verb: "DiscardFromHand", amount: 2 }, { verb: "PutIntoPlay" }],
  },
  // Reinforcements: up to 2 allies from the players' hands, each under any player's control, back to their owners' hands at the
  // end of the phase.
  {
    id: "10085:action:1",
    cardCode: "10085",
    lines: ["10085:A:2"],
    timing: "action",
    instructions: [{ verb: "PutIntoPlayFromHand", pick: { type: "card", control: "any", from: "hand", cardType: "ally" }, from: "any", upTo: 2, anyController: true, until: "endOfPhase", then: "returnToHand" }],
  },
  // Éothain: ready him after a Rohan ally is discarded from play by a card effect.
  { id: "10141:response:1", cardCode: "10141", lines: ["10141:A:1"], timing: "response", trigger: "discardedFromPlay", subject: { type: "ally", control: "any", trait: "Rohan" }, condition: EXHAUSTED_SELF, instructions: [{ verb: "Ready" }] },
  // Sword-thain: the attached ally is a hero.
  { id: "10149:constant:2", cardCode: "10149", lines: ["10149:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "heroType", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  // Prince Imrahil: with a hero in his controller's discard pile he is a hero (rr.card-types), like an ally with Sword-thain.
  { id: "145005:constant:1", cardCode: "145005", lines: ["145005:A:1"], timing: "constant", condition: { kind: "count", pick: { type: "hero", control: "you", from: "discard" }, min: 1 }, instructions: [{ verb: "ModifyStat", stat: "heroType", amount: 1, until: "whileSourceInPlay" }] },
  // Vanish from Sight: your threat is treated as 20 at most until the end of the phase.
  { id: "12011:action:1", cardCode: "12011", lines: ["12011:A:2"], timing: "action", instructions: [{ verb: "ModifyStat", stat: "threatCeiling", amount: 20, until: "endOfPhase", target: "actorSeat" }] },
  // Ceorl: any player may spend 1 Spirit resource to ready him, then may give control of him to another player.
  {
    id: "12058:action:1",
    cardCode: "12058",
    lines: ["12058:A:1"],
    timing: "action",
    anyPlayer: true,
    limit: "oncePerPhase",
    cost: { kind: "resources", amount: 1, sphere: "spirit" },
    instructions: [
      { verb: "Ready" },
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "give", requires: { kind: "otherPlayer" }, instructions: [{ verb: "Pick", pick: { type: "player", control: "other" } }, { verb: "ChangeControl", to: "picked" }] },
          { id: "keep", instructions: [] },
        ],
      },
    ],
  },
  // Dwarven Sellsword, Wilyador: discarded at the end of the round unless the players as a group spend a resource.
  {
    id: "12083:forced:1",
    cardCode: "12083",
    lines: ["12083:A:1"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "spend", requires: { kind: "resources", min: 1, sphere: "leadership", group: true }, instructions: [{ verb: "SpendResources", amount: 1, sphere: "leadership", group: true }] },
          { id: "discard", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
        ],
      },
    ],
  },
  {
    id: "22117:forced:1",
    cardCode: "22117",
    lines: ["22117:A:3"],
    timing: "forced",
    trigger: "endOfRound",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "spend", requires: { kind: "resources", min: 1, group: true }, instructions: [{ verb: "SpendResources", amount: 1, group: true }] },
          { id: "discard", instructions: [{ verb: "Discard", target: { kind: "self" } }] },
        ],
      },
    ],
  },
  // Eryn Galen Settler: discard it when the active location is explored, to discard a staging location of the same title.
  { id: "17035:response:1", cardCode: "17035", lines: ["17035:A:1"], timing: "response", trigger: "activeExplored", cost: { kind: "discardSelf" }, instructions: [{ verb: "DiscardSameTitle" }] },
  // Bard son of Brand: when a character leaves play, its attachments go back to their owners' hands (once per phase).
  { id: "18002:response:1", cardCode: "18002", lines: ["18002:A:2"], timing: "response", trigger: "leftPlayWithAttachments", subject: { type: "character", control: "any" }, limit: "oncePerPhase", instructions: [{ verb: "ReturnAttachments" }] },
  // Horn of the Mark: when a character that shares a trait with the attached hero leaves play, exhaust it to draw 1 card.
  { id: "22035:response:1", cardCode: "22035", lines: ["22035:A:2"], timing: "response", trigger: "leftPlay", subject: { type: "character", control: "any", sharesTrait: "host" }, cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Draw", amount: 1 }] },
  // Horns! Horns! Horns!: each player may put one ally into play from their hand; shuffled into their owners' decks at the end
  // of the phase if still in play.
  {
    id: "22056:action:1",
    cardCode: "22056",
    lines: ["22056:A:2"],
    timing: "action",
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "PutIntoPlayFromHand", pick: ALLY_IN_HAND, until: "endOfPhase", then: "shuffleIntoDeck" }] }],
  },
  // Soldier of Isengard: control passes to a player whose threat the doomed keyword raised.
  { id: "22057:response:1", cardCode: "22057", lines: ["22057:A:2"], timing: "response", trigger: "doomedRaised", eventSeat: "other", instructions: [{ verb: "ChangeControl", to: "eventSeat" }] },
  // Gwaihir: ready him after an Eagle ally enters or leaves play (once per phase).
  { id: "22108:response:1", cardCode: "22108", lines: ["22108:A:3"], timing: "response", trigger: "enteredOrLeftPlay", subject: { type: "ally", control: "any", trait: "Eagle" }, limit: "oncePerPhase", condition: EXHAUSTED_SELF, instructions: [{ verb: "Ready" }] },
  // Desperate Alliance: a hero you control, with its resources and attachments, is another player's until the end of the phase.
  {
    id: "132010:action:1",
    cardCode: "132010",
    lines: ["132010:A:1"],
    timing: "action",
    limit: "oncePerPhase",
    condition: { kind: "otherPlayer" },
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "you" } }, { verb: "Pick", pick: { type: "player", control: "other" } }, { verb: "ChangeControl", card: "picked", to: "picked", until: "endOfPhase" }],
  },
  // Gamling: exhaust him to return a Rohan ally you control that was discarded from play to your hand.
  { id: "144007:response:1", cardCode: "144007", lines: ["144007:A:1"], timing: "response", trigger: "discardedFromPlay", subject: { type: "ally", control: "you", trait: "Rohan" }, cost: { kind: "exhaustSelf" }, instructions: [{ verb: "TakeIntoHand" }] },
  // Elfhelm: spend 1 resource from a Rohan hero's pool to put him into play from your hand; discarded at the end of the phase.
  {
    id: "146006:action:1",
    cardCode: "146006",
    lines: ["146006:A:1"],
    timing: "action",
    fromHand: true,
    condition: { kind: "all", conditions: [CAN_ENTER, { kind: "canPick", pick: { type: "hero", control: "you", trait: "Rohan", hasResources: true } }] },
    instructions: [{ verb: "Pick", pick: { type: "hero", control: "you", trait: "Rohan", hasResources: true } }, { verb: "SpendFrom", amount: 1 }, { verb: "PutIntoPlay", until: "endOfPhase", then: "discard" }],
  },
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
