import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for attachments on enemies, locations, quests and threat dials: Traps, Guarded, played unattached (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.

// "If unattached": the source is attached to no card.
const unattached = { kind: "matches", card: "self", pick: { type: "attachment", control: "any", attached: false } } as const;

// "Play ~ into the staging area unattached. If unattached, attach ~ to the next eligible enemy that enters the staging area."
function stagingTrap(code: string, play: string, attach: string, constant = 1, triggered = 1): Effect[] {
  return [
    { id: `${code}:constant:${constant}`, cardCode: code, lines: [play], timing: "constant", instructions: [{ verb: "PlayInto", into: "staging" }] },
    {
      id: `${code}:triggered:${triggered}`,
      cardCode: code,
      lines: [attach],
      timing: "triggered",
      trigger: "addedToStaging",
      subject: { type: "enemy", control: "any", staging: true },
      condition: unattached,
      instructions: [{ verb: "AttachSourceTo", card: "subject" }],
    },
  ];
}

// "Play into your play area unattached. While unattached, attach to the next eligible enemy that engages you."
function engageTrap(code: string): Effect[] {
  return [
    { id: `${code}:constant:1`, cardCode: code, lines: [`${code}:A:1`], timing: "constant", instructions: [{ verb: "PlayInto", into: "playArea" }] },
    {
      id: `${code}:triggered:1`,
      cardCode: code,
      lines: [`${code}:A:2`],
      timing: "triggered",
      trigger: "engaged",
      eventSeat: "you",
      subject: { type: "enemy", control: "any" },
      condition: unattached,
      instructions: [{ verb: "AttachSourceTo", card: "subject" }],
    },
  ];
}

// "Guarded (X)": the keyword, and the attachment put into play once its guard leaves play.
function guarded(code: string, lines: string[], types: ("enemy" | "location")[], constant: number): Effect[] {
  return [
    { id: `${code}:constant:${constant}`, cardCode: code, lines, timing: "constant", instructions: [{ verb: "Guarded", types }] },
    { id: `${code}:triggered:1`, cardCode: code, lines: [lines[0] ?? ""], timing: "triggered", trigger: "unguarded", instructions: [{ verb: "PutAttachmentIntoPlay", card: "self", unguarded: true }] },
  ];
}

const BOTH: ("enemy" | "location")[] = ["enemy", "location"];

export const RECORDS: readonly Effect[] = [
  // Path of Need: "Heroes do not exhaust to attack, defend, or commit to a quest while attached location is the active location."
  {
    id: "04103:constant:2",
    cardCode: "04103",
    lines: ["04103:A:2"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "noExhaustAttack", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any" }, when: { kind: "hostActive" } },
      { verb: "ModifyStat", stat: "noExhaustDefend", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any" }, when: { kind: "hostActive" } },
      { verb: "ModifyStat", stat: "noExhaustQuest", amount: 1, until: "whileSourceInPlay", holders: { type: "hero", control: "any" }, when: { kind: "hostActive" } },
    ],
  },
  // Ranger Spikes (its third line is in pool/HoN.ts as 05017:constant:1).
  ...stagingTrap("05017", "05017:A:1", "05017:A:2", 2),
  // Ithilien Pit.
  ...stagingTrap("06064", "06064:A:1", "06064:A:2"),
  { id: "06064:constant:2", cardCode: "06064", lines: ["06064:A:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "attackableByAny", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  // Poisoned Stakes: "At the end of each round, deal 2 damage to attached enemy."
  ...stagingTrap("06115", "06115:A:1", "06115:A:2"),
  {
    id: "06115:triggered:2",
    cardCode: "06115",
    lines: ["06115:A:3"],
    timing: "triggered",
    trigger: "endOfRound",
    condition: { kind: "matches", card: "host", pick: { type: "enemy", control: "any" } },
    instructions: [{ verb: "DamageCard", amount: 2, target: "host" }],
  },
  // Secret Vigil: "Response: When attached enemy is destroyed, reduce each player's threat by the attached enemy's printed Threat."
  {
    id: "09012:response:1",
    cardCode: "09012",
    lines: ["09012:A:3"],
    timing: "response",
    trigger: "hostDefeated",
    instructions: [{ verb: "LowerThreat", amount: { stat: "threat", of: "other", printed: true }, who: "eachSeat" }],
  },
  // The Long Defeat: "Attach to a quest card in play. Limit 1 per quest." "Response: After attached quest card is defeated, each
  // player either draws 2 cards or heals up to 5 damage from among characters he controls."
  { id: "10122:constant:1", cardCode: "10122", lines: ["10122:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", host: { kind: "quest" }, limitPerHost: true }] },
  {
    id: "10122:response:1",
    cardCode: "10122",
    lines: ["10122:A:2"],
    timing: "response",
    trigger: "hostDefeated",
    instructions: [
      {
        verb: "ForEachPlayer",
        order: "firstFirst",
        instructions: [
          {
            verb: "Choose",
            who: "actor",
            options: [
              { id: "draw", instructions: [{ verb: "Draw", amount: 2 }] },
              {
                id: "heal",
                requires: { kind: "canPick", pick: { type: "character", control: "you", damaged: true } },
                instructions: [{ verb: "HealAmong", amount: 5, pick: { type: "character", control: "you" } }],
              },
            ],
          },
        ],
      },
    ],
  },
  // Favor of the Valar: "Attach to a player's threat dial. Limit 1 per player." (its Forced is the quest family's).
  { id: "10124:constant:1", cardCode: "10124", lines: ["10124:A:1"], timing: "constant", instructions: [{ verb: "PlayInto", into: "threatDial", limitPerPlayer: true }] },
  // Explorer's Almanac: "Progress from questing successfully may be placed on the attached location before it is placed on the
  // current quest."
  { id: "11011:constant:2", cardCode: "11011", lines: ["11011:A:2"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "takesProgressFirst", amount: 1, until: "whileSourceInPlay", target: "host" }] },
  // Entangling Nets (its third line, "Attached enemy gets -2 Attack and -2 Defense", is the defense family's).
  ...stagingTrap("12064", "12064:A:1", "12064:A:2"),
  // Hithlain: "Response: After a player plays a Silvan ally from his hand, place 1 progress on attached location."
  {
    id: "12088:response:1",
    cardCode: "12088",
    lines: ["12088:A:2"],
    timing: "response",
    trigger: "played",
    subject: { type: "ally", control: "any", trait: "Silvan" },
    instructions: [{ verb: "PlaceProgressOn", amount: 1, target: "host" }],
  },
  // Interrogation: "Action: Choose an enemy with an attached Trap card. Look at the top X cards of the encounter deck, where X
  // is that enemy's printed Threat. You may discard 1 of those cards. Return the rest to the top of the deck, in the same order."
  {
    id: "12090:action:1",
    cardCode: "12090",
    lines: ["12090:A:1"],
    timing: "action",
    instructions: [
      { verb: "Pick", pick: { type: "enemy", control: "any", staging: true, hasAttachment: { trait: "Trap" } } },
      { verb: "LookAtEncounterCards", amount: { stat: "threat", of: "picked", printed: true } },
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "discard", instructions: [{ verb: "PickEncounter", from: "looked" }, { verb: "MoveEncounterCard", to: "discard" }] },
          { id: "keep", instructions: [] },
        ],
      },
    ],
  },
  // The Road Goes Ever On: "Attach to a quest card in play." (its Response is the sidequests family's).
  { id: "16012:constant:1", cardCode: "16012", lines: ["16012:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", host: { kind: "quest" } }] },
  // Followed: "While attached enemy is engaged with you, reduce the total Threat in the staging area by X, where X is attached
  // enemy's printed Threat."
  ...engageTrap("17139"),
  {
    id: "17139:constant:2",
    cardCode: "17139",
    lines: ["17139:A:3"],
    timing: "constant",
    instructions: [
      {
        verb: "ModifyStat",
        stat: "lessStagingThreat",
        amount: { stat: "threat", of: "host", printed: true },
        until: "whileSourceInPlay",
        target: "table",
        when: { kind: "matches", card: "host", pick: { type: "enemy", control: "any", engaged: "you" } },
      },
    ],
  },
  // The Guarded cards of the Hobbit saga and of the later boxes.
  ...guarded("18011", ["18011:A:1"], BOTH, 3),
  ...guarded("19010", ["19010:A:1"], BOTH, 3),
  ...guarded("19029", ["19029:A:1"], BOTH, 3),
  ...guarded("19058", ["19058:A:1"], BOTH, 3),
  ...guarded("19093", ["19093:A:1"], BOTH, 2),
  ...guarded("19117", ["19117:A:1"], ["enemy"], 3),
  // Woodmen's Path: "Attach to a location with no progress tokens on it." "While attached location is the active location,
  // reduce its quest point value to 1."
  { id: "19030:constant:1", cardCode: "19030", lines: ["19030:A:1"], timing: "constant", instructions: [{ verb: "AttachesTo", hosts: [{ type: "location", control: "any", progress: false }] }] },
  { id: "19030:constant:2", cardCode: "19030", lines: ["19030:A:2"], timing: "constant", instructions: [{ verb: "SetStat", stat: "questPoints", value: 1, target: "host", when: { kind: "hostActive" } }] },
  // Outmatched: "Response: After attached enemy resolves its attack, ready the defending character."
  ...engageTrap("19062"),
  { id: "19062:response:1", cardCode: "19062", lines: ["19062:A:3"], timing: "response", trigger: "attackResolved", subject: "host", instructions: [{ verb: "Ready", target: "other" }] },
  // The King's Return: "Action: Search your deck for a Guarded attachment and put it into play. Shuffle your deck."
  {
    id: "19147:action:1",
    cardCode: "19147",
    lines: ["19147:A:1"],
    timing: "action",
    instructions: [
      { verb: "Pick", pick: { type: "card", control: "you", from: "deck", cardType: "attachment", guarded: true, intoPlay: true } },
      { verb: "PutAttachmentIntoPlay", card: "picked" },
      { verb: "ShuffleDeck" },
    ],
  },
  // Mithril Shirt: its second line prints the keyword again before "Attach to a hero." (its Response is the defense family's).
  ...guarded("19152", ["19152:A:1"], ["location"], 1),
  { id: "19152:constant:2", cardCode: "19152", lines: ["19152:A:2"], timing: "constant", instructions: [{ verb: "AttachesTo", host: { kind: "hero" } }] },
  // Put Off Pursuit: "Response: After attached location is explored, discard cards from the encounter deck until a location is
  // discarded. Add that location to the staging area to choose an non-unique enemy in the staging area and shuffle it into the
  // encounter deck."
  {
    id: "21008:response:1",
    cardCode: "21008",
    lines: ["21008:A:2"],
    timing: "response",
    trigger: "hostLeftPlay",
    condition: { kind: "subjectExplored" },
    instructions: [
      { verb: "DiscardUntil", type: "location" },
      { verb: "MoveEncounterCard", to: "staging" },
      { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, nonUnique: true }, when: { kind: "matches", card: "picked", pick: { type: "location", control: "any" }, inPlay: true } },
      { verb: "MoveEncounterCard", to: "shuffle", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: true } },
    ],
  },
  // Durin's Axe: its second line prints the keywords again before "Attach to a hero. Attached hero gets +2 Attack." (its Response
  // is in pool).
  ...guarded("22006", ["22006:A:1"], ["enemy"], 1),
  {
    id: "22006:constant:2",
    cardCode: "22006",
    lines: ["22006:A:2"],
    timing: "constant",
    instructions: [
      { verb: "AttachesTo", host: { kind: "hero" } },
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", target: "host" },
    ],
  },
  // Stone of Elostirion: "Guarded (location). Restricted."
  ...guarded("22084", ["22084:A:1"], ["location"], 2),
  // Thrór's Key: "Response: After a location is added to the staging area, attach Thrór's Key to that location. While attached
  // to a location, Thrór's Key gains: 'Treat attached location's printed text box as blank, except for traits.'"
  {
    id: "132016:response:1",
    cardCode: "132016",
    lines: ["132016:A:2"],
    timing: "response",
    trigger: "addedToStaging",
    subject: { type: "location", control: "any", staging: true },
    instructions: [
      { verb: "AttachSourceTo", card: "subject" },
      { verb: "ModifyStat", stat: "blankText", amount: 1, until: "whileSourceInPlay", target: "host", when: { kind: "matches", card: "host", pick: { type: "location", control: "any" } } },
    ],
  },
  // Damrod: "Reduce the cost of the first Trap card you play each round by 1 (to a minimum of 0)." "Response: After a Trap card
  // you control is attached to an enemy, draw 1 card."
  { id: "144003:constant:1", cardCode: "144003", lines: ["144003:A:1"], timing: "constant", instructions: [{ verb: "ReduceCostOf", pick: { type: "card", control: "you", trait: "Trap" }, amount: 1, firstEachRound: true, min: 0 }] },
  {
    id: "144003:response:1",
    cardCode: "144003",
    lines: ["144003:A:2"],
    timing: "response",
    trigger: "attached",
    subject: { type: "attachment", control: "you", trait: "Trap" },
    condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any" } },
    instructions: [{ verb: "Draw", amount: 1 }],
  },
  // Ambush: both sentences of its first line, and "Combat Action: The engaged player discards Ambush to declare an attack
  // against the attached enemy."
  ...stagingTrap("144009", "144009:A:1", "144009:A:1"),
  {
    id: "144009:action:1",
    cardCode: "144009",
    lines: ["144009:A:2"],
    timing: "action",
    anyPlayer: true,
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Combat" }, { kind: "matches", card: "host", pick: { type: "enemy", control: "any", engaged: "you" } }] },
    instructions: [{ verb: "ChooseAttackers", target: "host", discardSource: true }],
  },
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
