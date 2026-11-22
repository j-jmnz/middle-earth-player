import type { Effect } from "../../../catalog/boundary.ts";
import { PLAYS } from "./costs-plays.ts";

// Authored records for costs: discounts, resource matches, who pays for what, icons, optional doomed (docs/agents/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
const DISTINCT_THREE = { verb: "PayDistinctHeroes", min: 3 } as const;
// "You may give ~ doomed N when you play it from your hand. If you do, it gains: Response: After you play ~, ...": the Response
// is the choice; taking it gives the card its Doomed (each player raises their threat, rr.doomed-x).
const doomed = (amount: number) => ({ verb: "RaiseThreat", amount, who: "eachSeat" }) as const;
// Linhir Sea-captain: exactly one hero's pool paid for it.
const SINGLE_PAYER = { kind: "count", pick: { type: "hero", control: "any", paidFor: "subject" }, min: 1, max: 1 } as const;
const icon = (stat: "leadershipIcon" | "loreIcon" | "tacticsIcon" | "spiritIcon") => ({ verb: "ModifyStat", stat, amount: 1, until: "endOfPhase", target: "host" }) as const;
// Bartering: a ready player attachment on a character you control.
const ON_CHARACTER = { type: "attachment", control: "you", state: "ready", playerCard: true, on: { type: "character", control: "you" } } as const;
const LOWER_THREAT_HEROES = { type: "hero", control: "any", lowerThreatCost: true } as const;

const OWN: readonly Effect[] = [
  // "You must use resources from 3 different heroes' pools to pay for this card."
  { id: "01036:constant:1", cardCode: "01036", lines: ["01036:A:1"], timing: "constant", instructions: [DISTINCT_THREE] },
  { id: "08143:constant:1", cardCode: "08143", lines: ["08143:A:1"], timing: "constant", instructions: [DISTINCT_THREE] },
  { id: "10085:constant:1", cardCode: "10085", lines: ["10085:A:1"], timing: "constant", instructions: [DISTINCT_THREE] },
  { id: "19149:constant:1", cardCode: "19149", lines: ["19149:A:1"], timing: "constant", instructions: [DISTINCT_THREE] },
  // "Knight of the White Tower's resource cost must be paid from a single hero's resource pool."
  { id: "12139:constant:1", cardCode: "12139", lines: ["12139:A:1"], timing: "constant", instructions: [{ verb: "PayDistinctHeroes", max: 1 }] },

  // "Action: Pay 1 resource from attached hero's pool to attach ~ to another hero."
  ...["02002", "02051", "02097", "02117", "12084"].map(
    (code): Effect => ({
      id: `${code}:action:1`,
      cardCode: code,
      lines: [`${code}:A:3`],
      timing: "action",
      cost: { kind: "resources", amount: 1, from: "host" },
      condition: { kind: "count", pick: { type: "hero", control: "any" }, min: 2 },
      instructions: [{ verb: "Reattach" }],
    }),
  ),

  // Radagast: collects 1 resource each resource phase, which can pay for Creature cards played from the hand.
  {
    id: "02059:constant:1",
    cardCode: "02059",
    lines: ["02059:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "collectsResources", amount: 1, until: "whileSourceInPlay" },
      { verb: "PaysFor", pick: { type: "card", control: "you", trait: "Creature" } },
    ],
  },
  // "Action: Spend X resources from Radagast's pool to heal X wounds on any 1 Creature."
  {
    id: "02059:action:1",
    cardCode: "02059",
    lines: ["02059:A:2"],
    timing: "action",
    condition: {
      kind: "all",
      conditions: [
        { kind: "matches", card: "self", pick: { type: "ally", control: "any", hasResources: true } },
        { kind: "canPick", pick: { type: "character", control: "any", trait: "Creature", damaged: true } },
      ],
    },
    instructions: [
      { verb: "Pick", pick: { type: "character", control: "any", trait: "Creature", damaged: true } },
      { verb: "ChooseX", max: [{ stat: "resources", of: "self" }, { stat: "damage", of: "picked" }] },
      { verb: "DiscardResources", amount: { x: true }, target: "self" },
      { verb: "Heal", amount: { x: true }, target: "picked" },
    ],
  },

  // Narvi's Belt: "Exhaust ~ to give attached hero a Leadership, Lore, Tactics or Spirit icon until the end of the phase."
  {
    id: "03003:action:1",
    cardCode: "03003",
    lines: ["03003:A:2"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "leadership", instructions: [icon("leadershipIcon")] },
          { id: "lore", instructions: [icon("loreIcon")] },
          { id: "tactics", instructions: [icon("tacticsIcon")] },
          { id: "spirit", instructions: [icon("spiritIcon")] },
        ],
      },
    ],
  },

  // Good Meal: "Discard ~ to lower the cost of the next event you play this round that matches attached hero's sphere by 2."
  // The sphere is read from the host before Good Meal leaves it, so the discard comes last.
  {
    id: "04010:action:1",
    cardCode: "04010",
    lines: ["04010:A:2"],
    timing: "action",
    condition: { kind: "sourceIn", zone: "play" },
    instructions: [
      { verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "event" }, amount: 2, until: "endOfRound", hostSphere: true },
      { verb: "Discard", target: { kind: "self" } },
    ],
  },

  // Elrond, Hirluin the Fair, Kahliel: their pools may pay for some allies of other spheres.
  { id: "04128:constant:1", cardCode: "04128", lines: ["04128:A:1"], timing: "constant", instructions: [{ verb: "PaysFor", pick: { type: "card", control: "you", cardType: "ally" }, spheres: ["spirit", "leadership", "tactics"] }] },
  { id: "06001:constant:1", cardCode: "06001", lines: ["06001:A:2"], timing: "constant", instructions: [{ verb: "PaysFor", pick: { type: "card", control: "you", cardType: "ally", trait: "Outlands" } }] },
  { id: "17001:constant:1", cardCode: "17001", lines: ["17001:A:1"], timing: "constant", instructions: [{ verb: "PaysFor", pick: { type: "card", control: "you", cardType: "ally", trait: "Harad" } }] },

  // Attachments on this character cost less.
  { id: "05001:constant:1", cardCode: "05001", lines: ["05001:A:2"], timing: "constant", instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "attachment", traits: ["Weapon", "Armor"] }, amount: 2, onHost: "self" }] },
  { id: "18003:constant:1", cardCode: "18003", lines: ["18003:A:1"], timing: "constant", instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "attachment", trait: "Armor" }, amount: 1, onHost: "self" }] },
  { id: "18005:constant:1", cardCode: "18005", lines: ["18005:A:1"], timing: "constant", instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "attachment", trait: "Weapon" }, amount: 1, onHost: "self" }] },
  { id: "19091:constant:1", cardCode: "19091", lines: ["19091:A:1"], timing: "constant", instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "attachment", trait: "Item" }, amount: 1, onHost: "self" }] },

  // Gaining Strength: "Discard 2 resources from your hero's resource pool to add 3 resources to that hero's resource pool."
  {
    id: "06003:action:1",
    cardCode: "06003",
    lines: ["06003:A:1"],
    timing: "action",
    condition: { kind: "canPick", pick: { type: "hero", control: "you", minResources: 2 } },
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "you", minResources: 2 } },
      { verb: "DiscardResources", amount: 2 },
      { verb: "AddResources", amount: 3, to: "picked" },
    ],
  },

  // Threat costs: Mirlonde lowers each of your printed-Lore heroes'; Folco Boffin his own, for each Hobbit hero you control.
  { id: "06032:constant:1", cardCode: "06032", lines: ["06032:A:1"], timing: "constant", instructions: [{ verb: "ThreatCost", less: 1, holders: { type: "hero", control: "you", printedIcon: "lore" } }] },
  { id: "17109:constant:1", cardCode: "17109", lines: ["17109:A:1"], timing: "constant", instructions: [{ verb: "ThreatCost", less: { count: { type: "hero", control: "you", trait: "Hobbit" } } }] },

  // Gríma: "Lower the cost of the next card you play from your hand this round by 1. That card gains Doomed 1."
  { id: "07002:action:1", cardCode: "07002", lines: ["07002:A:1"], timing: "action", limit: "oncePerRound", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you" }, amount: 1, until: "endOfRound", doomed: 1 }] },

  // Optional doomed on play.
  {
    id: "08030:response:1",
    cardCode: "08030",
    lines: ["08030:A:1"],
    timing: "response",
    trigger: "played",
    subject: "self",
    eventSeat: "you",
    instructions: [doomed(2), { verb: "PlaceProgressOn", amount: 1, target: "eachStagingLocation" }, { verb: "PlaceProgressOn", amount: 1, target: "activeLocation" }],
  },
  {
    id: "08091:response:1",
    cardCode: "08091",
    lines: ["08091:A:1"],
    timing: "response",
    trigger: "played",
    subject: "self",
    eventSeat: "you",
    condition: { kind: "canPick", pick: { type: "card", control: "any", stagingOnly: true } },
    instructions: [
      doomed(1),
      { verb: "Pick", pick: { type: "card", control: "any", stagingOnly: true } },
      { verb: "ModifyStat", stat: "noThreatContribution", amount: 1, until: "endOfRound", target: "picked" },
    ],
  },
  {
    id: "08115:response:1",
    cardCode: "08115",
    lines: ["08115:A:1"],
    timing: "response",
    trigger: "played",
    subject: "self",
    eventSeat: "you",
    instructions: [
      doomed(1),
      { verb: "Pick", pick: { type: "character", control: "any" } },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfRound", target: "picked" },
      { verb: "ModifyStat", stat: "sentinel", amount: 1, until: "endOfRound", target: "picked" },
    ],
  },

  // Next-card discounts.
  { id: "08058:action:1", cardCode: "08058", lines: ["08058:A:2"], timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally", trait: "Silvan" }, amount: 1, until: "endOfPhase", min: 1, who: "any" }] },
  {
    id: "09010:action:1",
    cardCode: "09010",
    lines: ["09010:A:2"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, { kind: "count", pick: { type: "enemy", control: "any", engaged: "you" }, min: 1 }] },
    instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally", trait: "Dúnedain" }, amount: { count: { type: "enemy", control: "any", engaged: "you" } }, until: "endOfPhase" }],
  },
  { id: "10063:action:1", cardCode: "10063", lines: ["10063:A:1"], timing: "action", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "event", valour: true }, amount: 2, until: "endOfPhase" }] },
  {
    id: "11014:action:1",
    cardCode: "11014",
    lines: ["11014:A:2"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "handHasCard" },
    instructions: [
      { verb: "ChooseX", max: [{ hand: true }] },
      { verb: "DiscardFromHand", amount: { x: true } },
      { verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally", trait: "Noldor" }, amount: { x: true }, until: "endOfPhase", min: 1, who: "any" },
    ],
  },
  { id: "12141:response:1", cardCode: "12141", lines: ["12141:A:1"], timing: "response", trigger: "enteredPlay", subject: "self", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", sphere: "tactics" }, amount: 1, until: "endOfPhase" }] },
  { id: "17090:action:1", cardCode: "17090", lines: ["17090:A:1"], timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally", trait: "Harad" }, amount: 1, until: "endOfPhase" }] },
  {
    id: "18008:action:1",
    cardCode: "18008",
    lines: ["18008:A:2"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "phase", is: "Planning" },
    instructions: [
      {
        verb: "ReduceNextCost",
        pick: { type: "card", control: "you", cardType: "ally", trait: "Dale" },
        amount: { count: { type: "attachment", control: "any", attachedTo: "host", playerCard: true }, distinct: true },
        until: "endOfPhase",
        noMatch: true,
      },
    ],
  },
  {
    id: "18015:action:1",
    cardCode: "18015",
    lines: ["18015:A:1"],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Planning" }, { kind: "canPick", pick: ON_CHARACTER }] },
    instructions: [
      { verb: "Pick", pick: ON_CHARACTER },
      { verb: "ReturnToHand", target: "picked" },
      { verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "attachment" }, amount: { stat: "cost", of: "picked", printed: true }, until: "endOfPhase", who: "any" },
    ],
  },
  { id: "19119:response:1", cardCode: "19119", lines: ["19119:A:1"], timing: "response", trigger: "played", subject: "self", eventSeat: "you", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "attachment" }, amount: 2, until: "endOfPhase", who: "any" }] },
  {
    id: "19086:action:1",
    cardCode: "19086",
    lines: ["19086:A:2"],
    timing: "action",
    condition: { kind: "phase", is: "Planning" },
    instructions: [{ verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally" }, amount: 1, until: "endOfPhase", cannotQuest: true }] }],
  },
  {
    id: "19154:action:1",
    cardCode: "19154",
    lines: ["19154:A:2"],
    timing: "action",
    cost: { kind: "exhaustSelf" },
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "reduce", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you", cardType: "ally", trait: "Creature" }, amount: 2, until: "endOfPhase" }] },
          {
            id: "ready",
            requires: { kind: "canPick", pick: { type: "ally", control: "any", trait: "Creature", state: "exhausted" } },
            instructions: [{ verb: "Pick", pick: { type: "ally", control: "any", trait: "Creature", state: "exhausted" } }, { verb: "Ready", target: "picked" }],
          },
          {
            id: "return",
            requires: { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you", trait: "Creature", nonUnique: true } },
            instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", engaged: "you", trait: "Creature", nonUnique: true } }, { verb: "ReturnToStaging", target: { kind: "picked" } }],
          },
        ],
      },
    ],
  },
  { id: "22116:action:1", cardCode: "22116", lines: ["22116:A:1"], timing: "action", instructions: [{ verb: "ReduceNextCost", pick: { type: "card", control: "you" }, amount: { count: { type: "attachment", control: "you", trait: "Pipe" } }, until: "used" }] },

  // Resources.
  // Tighten Our Belts: "Only 1 copy of Tighten Our Belts can be played by the players each round" is part of the Action's
  // condition: with a copy already played this round, the event cannot be played.
  {
    id: "08086:action:1",
    cardCode: "08086",
    lines: ["08086:A:1"],
    timing: "action",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Refresh" }, { kind: "copiesPlayedThisRound", max: 0 }] },
    instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "HeroesGainResources", amount: 1, who: "picked", unspent: true }],
  },

  // Treebeard: cannot have restricted attachments, enters play exhausted, collects 1 resource that can pay for Ent cards.
  {
    id: "08146:constant:1",
    cardCode: "08146",
    lines: ["08146:A:1"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "cannotHaveRestricted", amount: 1, until: "whileSourceInPlay" },
      { verb: "EntersPlayExhausted" },
      { verb: "ModifyStat", stat: "collectsResources", amount: 1, until: "whileSourceInPlay" },
      { verb: "PaysFor", pick: { type: "card", control: "you", trait: "Ent" } },
    ],
  },

  // Resource icons.
  { id: "10115:constant:1", cardCode: "10115", lines: ["10115:A:1"], timing: "constant", condition: { kind: "hasEngaged" }, instructions: [{ verb: "ModifyStat", stat: "tacticsIcon", amount: 1, until: "whileSourceInPlay" }] },
  {
    id: "132004:constant:1",
    cardCode: "132004",
    lines: ["132004:A:1"],
    timing: "constant",
    condition: { kind: "count", pick: { type: "character", control: "you", trait: "Dwarf" }, min: 5 },
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay" },
      { verb: "ModifyStat", stat: "tacticsIcon", amount: 1, until: "whileSourceInPlay" },
    ],
  },
  { id: "18002:constant:1", cardCode: "18002", lines: ["18002:A:1"], timing: "constant", instructions: [{ verb: "PaysAsIcons", pick: { type: "card", control: "you", cardType: "attachment", trait: "Item" }, icons: ["leadership", "lore", "tactics"] }] },
  { id: "19145:constant:1", cardCode: "19145", lines: ["19145:A:1"], timing: "constant", instructions: [{ verb: "PaysAsIcons", pick: { type: "card", control: "you", cardType: "ally", trait: "Creature" }, icons: ["leadership", "spirit", "tactics"] }] },
  { id: "22054:constant:2", cardCode: "22054", lines: ["22054:A:2"], timing: "constant", instructions: [{ verb: "PaysAsIcons", pick: { type: "card", control: "you", cardType: "event", keyword: "doomed" }, icons: ["leadership", "spirit", "tactics"] }] },
  { id: "22062:constant:1", cardCode: "22062", lines: ["22062:A:1"], timing: "constant", instructions: [{ verb: "PaidByIcons", heroes: { type: "hero", control: "you", trait: "Rohan" }, icons: ["spirit"] }] },

  // Additional costs and who may not pay.
  { id: "12010:constant:1", cardCode: "12010", lines: ["12010:A:1"], timing: "constant", instructions: [{ verb: "PlayCost", discard: 2 }] },
  { id: "12109:constant:1", cardCode: "12109", lines: ["12109:A:1"], timing: "constant", instructions: [{ verb: "CannotPayFor", pick: { type: "card", control: "you", cardType: "ally" } }] },
  { id: "12118:constant:1", cardCode: "12118", lines: ["12118:A:1"], timing: "constant", instructions: [{ verb: "ExhaustToReduce", pick: { type: "character", control: "you", trait: "Healer" } }] },

  // Rune-master: "After a Signal attachment is attached to a hero, exhaust ~ to add 1 resource to that hero's resource pool."
  {
    id: "12110:response:1",
    cardCode: "12110",
    lines: ["12110:A:2"],
    timing: "response",
    trigger: "attached",
    subject: { type: "attachment", control: "any", trait: "Signal" },
    cost: { kind: "exhaustSelf" },
    instructions: [{ verb: "AddResources", amount: 1, to: "other", when: { kind: "matches", card: "other", pick: { type: "hero", control: "any" } } }],
  },

  // Linhir Sea-captain: if one hero's pool paid all of its cost, that hero and Linhir do not exhaust to quest this round.
  {
    id: "12115:response:1",
    cardCode: "12115",
    lines: ["12115:A:1"],
    timing: "response",
    trigger: "played",
    subject: "self",
    eventSeat: "you",
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "any", paidFor: "subject" }, when: SINGLE_PAYER },
      { verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "endOfRound", target: "picked", when: SINGLE_PAYER },
      { verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "endOfRound", when: SINGLE_PAYER },
    ],
  },

  // Inspiring Presence: +2 Defense to each hero with lower threat cost than the chosen hero; then the group may pay 2 Leadership
  // resources for +2 Attack to the same heroes.
  {
    id: "12143:action:1",
    cardCode: "12143",
    lines: ["12143:A:1"],
    timing: "action",
    condition: { kind: "canPick", pick: { type: "hero", control: "you" } },
    instructions: [
      { verb: "Pick", pick: { type: "hero", control: "you" } },
      { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfPhase", holders: LOWER_THREAT_HEROES },
      {
        verb: "Choose",
        who: "actor",
        options: [
          {
            id: "spend",
            requires: { kind: "resources", min: 2, sphere: "leadership", group: true },
            instructions: [
              { verb: "SpendResources", amount: 2, sphere: "leadership", group: true },
              { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfPhase", holders: LOWER_THREAT_HEROES },
            ],
          },
          { id: "decline", instructions: [] },
        ],
      },
    ],
  },

  // Théoden, Herugrim, Tom Cotton, Mirkwood Hunter: standing cost rules.
  { id: "143002:constant:1", cardCode: "143002", lines: ["143002:A:2"], timing: "constant", instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", cardType: "ally", trait: "Rohan" }, amount: 1, firstEachRound: true, min: 0 }] },
  { id: "143010:constant:2", cardCode: "143010", lines: ["143010:A:2"], timing: "constant", instructions: [{ verb: "ReduceCost", amount: 1, host: { type: "hero", control: "any", names: ["Théoden"] } }] },
  {
    id: "146004:constant:1",
    cardCode: "146004",
    lines: ["146004:A:1"],
    timing: "constant",
    instructions: [{ verb: "IgnoreResourceMatch", pick: { type: "card", control: "you", cardType: "ally", trait: "Hobbit" }, firstEachRound: true, when: { kind: "canPick", pick: { type: "enemy", control: "any", engaged: "you", aboveThreat: true } } }],
  },
  { id: "19087:constant:1", cardCode: "19087", lines: ["19087:A:2"], timing: "constant", instructions: [{ verb: "ReduceCost", amount: { count: { type: "card", control: "any", attachedTo: "activeLocation" } } }] },

  // Orc Disguise: "While an Orc is making an engagement check with you, it gets +5 engagement cost."
  {
    id: "146009:constant:2",
    cardCode: "146009",
    lines: ["146009:A:2"],
    timing: "constant",
    instructions: [{ verb: "ModifyStat", stat: "engagementCheckCost", amount: 5, until: "whileSourceInPlay", holders: { type: "enemy", control: "any", stagingOnly: true, trait: "Orc" } }],
  },

  // Steward of Orthanc: "When you play an event, give it Doomed 1 to draw a card." Once a round per player for every copy.
  {
    id: "17037:response:1",
    cardCode: "17037",
    lines: ["17037:A:1"],
    timing: "response",
    trigger: "played",
    subject: { type: "card", control: "you", cardType: "event" },
    eventSeat: "you",
    limit: "oncePerRoundGroupEachPlayer",
    instructions: [doomed(1), { verb: "Draw" }],
  },
];

export const RECORDS: readonly Effect[] = [...OWN, ...PLAYS];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
