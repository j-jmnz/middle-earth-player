import type { Effect, PickSpec } from "../../../catalog/boundary.ts";

import { ALWAYS } from "../conditions.ts";

// Records for the Dream-chaser Campaign Expansion's own cards (data/cards/DCCE.json), added as each scenario phase uses them. Read from the scan
// ledger (data/printed/dream-chaser.json). Rules: dcce.hard-expert, dcce.gaining-xp, dcce.scalable-upgradable, dcce.encounter-cards, dcce.sailing-tests,
// dcce.boarding (data/rules/entries.json).

// "Attached Ship gets +N <stat>" (a Modification boon, either side).
const hostGets = (code: string, line: string, id: number, stat: "defense" | "attack" | "willpower" | "hitPoints", amount: number): Effect => ({
  id: `${code}:constant:${id}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  // "Attached Ship gets ...": the Modification boons go on a Ship, so no other character takes one when an effect moves it.
  instructions: [{ verb: "AttachesTo", host: { kind: "character", trait: "Ship" } }, { verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "host" }],
});

// A threat raise the Hard/Expert Mode card makes when a character is healed or readied by a player card effect (the refresh phase and a rule's ready are not one).
const healedOrReadied = (id: number, trigger: "healed" | "readied"): Effect => ({
  id: `11217:forced:${id}`,
  cardCode: "11217",
  lines: ["11217:B:3"],
  timing: "forced",
  trigger,
  subject: { type: "character", control: "any" },
  condition: { kind: "byPlayerCard" },
  instructions: [{ verb: "RaiseThreat", amount: 1 }],
});

// "If you control a <sphere> hero" (11195:A:2 to A:5).
const controlsHero = (sphere: "leadership" | "tactics" | "spirit" | "lore") => ({ kind: "count", pick: { type: "hero", control: "you", sphere }, min: 1 }) as const;


// 11180 Spyglass: "Action: Exhaust Spyglass to choose one: Look at a shadow card. / Look at the top and bottom card of your deck. / Place 1 progress on a location (2 progress instead if it is
// Uncharted)." The Upgraded side may discard the shadow card, looks at any deck, and places 4 progress instead on an Uncharted location.
const SHADOW_ENEMY = { type: "enemy", control: "any", staging: true, facedownShadow: true } as const;
const ANY_LOCATION = { type: "location", control: "any" } as const;
type Options = Extract<Effect["instructions"][number], { verb: "Choose" }>["options"];
const spyglass = (side: "A" | "B"): Effect => {
  const upgraded = side === "B";
  const lines = [`11180:${side}:2`, `11180:${side}:3`, `11180:${side}:4`, `11180:${side}:5`];
  const LOST_ISLAND = { type: "location", control: "any", uncharted: true } as const;
  const shadow: Options = [
    { id: "shadow", requires: { kind: "canPick", pick: SHADOW_ENEMY }, instructions: upgraded ? [{ verb: "Pick", pick: SHADOW_ENEMY }, { verb: "LookAtShadow", target: "picked" }, { verb: "MayDiscardShadow" }] : [{ verb: "Pick", pick: SHADOW_ENEMY }, { verb: "LookAtShadow", target: "picked" }] },
  ];
  const decks: Options = upgraded
    ? [
        { id: "player", instructions: [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "LookAtTop", count: 1, deck: "picked" }, { verb: "LookAtBottom", count: 1, deck: "picked" }] },
        { id: "encounter", instructions: [{ verb: "LookAtTop", count: 1 }, { verb: "LookAtBottom", count: 1, deck: "encounter" }] },
      ]
    : [{ id: "decks", instructions: [{ verb: "LookAtTop", count: 1, deck: "own" }, { verb: "LookAtBottom", count: 1 }] }];
  const progress: Options = [
    {
      id: "progress",
      instructions: [
        { verb: "Pick", pick: ANY_LOCATION },
        { verb: "PlaceProgressOn", amount: 1, target: "picked", when: { kind: "not", condition: { kind: "matches", card: "picked", pick: LOST_ISLAND } } },
        { verb: "PlaceProgressOn", amount: upgraded ? 4 : 2, target: "picked", when: { kind: "matches", card: "picked", pick: LOST_ISLAND } },
      ],
    },
  ];
  const options: Options = [...shadow, ...decks, ...progress];
  return { id: `11180:action:${upgraded ? 2 : 1}`, cardCode: "11180", lines, timing: "action", cost: { kind: "exhaustSelf" }, instructions: [{ verb: "Choose", who: "actor", options }] };
};


// 11183 Black Key (boon, attached to Calphon by the campaign card of Raid on the Grey Havens): "Attached character gets +1 Willpower, +1 Attack, and +1 Defense" on both sides. The Upgraded side
// adds a Response (a resource on the character after it quests successfully) and an Action (3 resources from it to ready it and the Key).
const blackKeyStats = (side: "A" | "B", id: number): Effect => ({
  id: `11183:constant:${id}`,
  cardCode: "11183",
  lines: [`11183:${side}:2`],
  timing: "constant",
  // Only while the host is a character: Captain Sahír, who carries the Key as an objective ally, is an enemy on his stage 2 side (12093:A:1) and the text names "attached character".
  condition: { kind: "matches", card: "host", pick: { type: "character", control: "any" } },
  instructions: [
    { verb: "ModifyStat", stat: "willpower", amount: 1, until: "whileSourceInPlay", target: "host" },
    { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
    { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
  ],
});

// 11184 to 11187 Galdor's Counsel (events the campaign card of Raid on the Grey Havens lets each player take into hand): X is the level of the card in the Campaign Log (half of it, rounded up, for
// Leadership and Lore), plus 1 for each copy the players chose at the campaign card's Setup ("For this game, X is plus 1 for each of those copies", 0 in any other game). Each adds itself to the victory display.
const counsel = (code: string, id: number, instructions: Effect["instructions"]): Effect => ({
  id: `${code}:action:${id}`,
  cardCode: code,
  lines: [`${code}:A:1`],
  timing: "action",
  cost: { kind: "playEvent" },
  instructions: [...instructions, { verb: "AddSourceToVictory" }],
});
type Amount = Extract<Effect["instructions"][number], { verb: "DamageCard" }>["amount"];
const HALF_LEVEL_PLUS_CHOSEN: Amount = { level: true, halved: true, plusChosen: true };
const LEVEL_PLUS_CHOSEN: Amount = { level: true, plusChosen: true };
const counselX = (halved: boolean): Amount => (halved ? HALF_LEVEL_PLUS_CHOSEN : LEVEL_PLUS_CHOSEN);

// 11189 Parrying Cutlass and 11190 Throwing Axe (Permanent, Restricted weapons, a hero's, earned at the Resolution of Raid on the Grey Havens): the bonus grows by `extra` while the hero holds `stat` tokens.
const weaponBonus = (code: string, line: string, id: number, stat: "defense" | "attack", base: number, extra: Amount): Effect => ({
  id: `${code}:constant:${id}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [
    // "Attached hero gets ...": a weapon goes on a hero, whoever moves it.
    { verb: "AttachesTo", host: { kind: "hero" } },
    { verb: "ModifyStat", stat, amount: base, until: "whileSourceInPlay", target: "host" },
    { verb: "ModifyStat", stat, amount: extra, until: "whileSourceInPlay", target: "host" },
  ],
});
// "+2 instead" at 2 or more resource tokens (or damage tokens) is the base plus 1 more: 0 at fewer than 2, 1 at 2 or more.
const FROM_TWO = (of: "resources" | "damage"): Amount => ({ stat: of, of: "host", plus: -1, limit: 1 });

// 11192 Black Key (burden, attached to the Stormcaller by the campaign card of Flight of the Stormcaller): the attached enemy gets +1 Threat, +1 Attack, +1 Defense and gains immune to player card effects;
// side A adds a Forced effect for Captain Sahír. The Upgraded side (B) drops it.
const blackKeyBurden = (side: "A" | "B", id: number): Effect => ({
  id: `11192:constant:${id}`,
  cardCode: "11192",
  lines: [`11192:${side}:2`],
  timing: "constant",
  instructions: [
    { verb: "ModifyStat", stat: "threat", amount: 1, until: "whileSourceInPlay", target: "host" },
    { verb: "ModifyStat", stat: "attack", amount: 1, until: "whileSourceInPlay", target: "host" },
    { verb: "ModifyStat", stat: "defense", amount: 1, until: "whileSourceInPlay", target: "host" },
    { verb: "ModifyStat", stat: "immuneToPlayerCards", amount: 1, until: "whileSourceInPlay", target: "host" },
  ],
});

// 11193 Calaerion (objective ally the campaign card puts into play under the player with the Dream-chaser): the Action readies a ship or an ally and gives +1 Willpower, +1 Attack and +1 Defense.
const calaerionBoost = (until: "endOfPhase" | "endOfRound"): Effect["instructions"] => [
  { verb: "Ready", target: "picked" },
  { verb: "ModifyStat", stat: "willpower", amount: 1, until, target: "picked" },
  { verb: "ModifyStat", stat: "attack", amount: 1, until, target: "picked" },
  { verb: "ModifyStat", stat: "defense", amount: 1, until, target: "picked" },
];
// Captain Sahír "in play": engaged, in the staging area or in the Stormcaller's area (11192:A:3).
const BLACK_KEY_SAHIR: PickSpec = { type: "enemy", control: "any", staging: true, inStormcallerArea: true, names: ["Captain Sahír"] };
const DREAM_CHASER_SHIP: PickSpec = { type: "character", control: "any", names: ["Dream-chaser"] };
const ANOTHER_ALLY: PickSpec = { type: "ally", control: "any", other: true };

// 11198 Starla (the ally the campaign card of Temple of the Deceived places under a Temple location): X is half her level, rounded up (dcce.scalable-upgradable); she is played when she is discarded from a hand or a deck,
// and places progress on a location when she exhausts.
const starlaStat = (stat: "willpower" | "attack" | "defense"): Effect["instructions"][number] => ({ verb: "ModifyStat", stat, amount: { level: true, halved: true }, until: "whileSourceInPlay" });
// 11210 Gavin (objective ally; an Encounter-keyword player card): his When Revealed takes him into play under a player the first player chooses, committed to the quest, and adds a resource to Lanwyn when she is
// in play. The other two lines (his Planning Action shuffles a random set-aside Send for Help in with him; he is removed from the game when he leaves play by anything but that) stay open.
export const FIRST_PLAYER_CHOOSES = { verb: "Pick", pick: { type: "player", control: "any", who: "firstPlayer" } } as const;
const LANWYN: PickSpec = { type: "hero", control: "any", names: ["Lanwyn"] };

export const RECORDS: readonly Effect[] = [
  // 11198 Starla, 11199 Recurring Nightmare. Recurring Nightmare: Defense X (the number of players); when it leaves play it is shuffled into a player's deck, the first player choosing whose; when it enters a hand it is added to the staging area.
  { id: "11198:constant:1", cardCode: "11198", lines: ["11198:A:1"], timing: "constant", instructions: [starlaStat("willpower"), starlaStat("attack"), starlaStat("defense")] },
  { id: "11198:response:1", cardCode: "11198", lines: ["11198:A:2"], timing: "response", trigger: "discardedFromHand", subject: "self", instructions: [{ verb: "PutIntoPlay", card: "self" }] },
  { id: "11198:response:2", cardCode: "11198", lines: ["11198:A:2"], timing: "response", trigger: "discardedFromDeck", subject: "self", instructions: [{ verb: "PutIntoPlay", card: "self" }] },
  {
    id: "11198:response:3",
    cardCode: "11198",
    lines: ["11198:A:3"],
    timing: "response",
    trigger: "exhausted",
    subject: "self",
    condition: { kind: "canPick", pick: ANY_LOCATION },
    instructions: [{ verb: "Pick", pick: ANY_LOCATION }, { verb: "PlaceProgressOn", amount: 1, target: "picked" }],
  },
  { id: "11199:constant:1", cardCode: "11199", lines: ["11199:A:1"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "defense", amount: { players: true }, until: "whileSourceInPlay" }] },
  // (leaves play by any route: the engine announces an encounter card's leaving only to a card that hears `exitedPlay`)
  { id: "11199:triggered:1", cardCode: "11199", lines: ["11199:A:2"], timing: "triggered", trigger: "exitedPlay", subject: "self", instructions: [{ verb: "ShuffleIntoPlayerDeck" }] },
  { id: "11199:forced:1", cardCode: "11199", lines: ["11199:A:3"], timing: "forced", trigger: "enteredHand", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }] },

  // 11192 Black Key (burden), both sides.
  blackKeyBurden("A", 1),
  {
    id: "11192:forced:1",
    cardCode: "11192",
    lines: ["11192:A:3"],
    timing: "forced",
    trigger: "endOfPhase",
    condition: { kind: "all", conditions: [{ kind: "phase", is: "Quest" }, { kind: "canPick", pick: BLACK_KEY_SAHIR }] },
    instructions: [{ verb: "Each", pick: BLACK_KEY_SAHIR, instructions: [{ verb: "PlaceResourceTokens", amount: { players: true }, on: "picked" }] }],
  },
  blackKeyBurden("B", 2),

  // 11193 Calaerion, both sides. Side A: Action, spend 3 resources and exhaust him to ready the Dream-chaser and give it +1 Willpower, Attack and Defense until the end of the phase. Side B (Upgraded):
  // Response, after a card is discarded from the encounter deck, shuffle it into that deck (once a round); Action, spend 2 resources and exhaust him to ready another ally and give it the bonus until the end of the round.
  {
    id: "11193:action:1",
    cardCode: "11193",
    lines: ["11193:A:2"],
    timing: "action",
    cost: [{ kind: "exhaustSelf" }, { kind: "resources", amount: 3 }],
    condition: { kind: "canPick", pick: DREAM_CHASER_SHIP },
    instructions: [{ verb: "Pick", pick: DREAM_CHASER_SHIP }, ...calaerionBoost("endOfPhase")],
  },
  { id: "11193:response:1", cardCode: "11193", lines: ["11193:B:2"], timing: "response", trigger: "discardedFromEncounterDeck", limit: "oncePerRound", instructions: [{ verb: "MoveEncounterCard", card: "subject", to: "shuffle" }] },
  {
    id: "11193:action:2",
    cardCode: "11193",
    lines: ["11193:B:3"],
    timing: "action",
    cost: [{ kind: "exhaustSelf" }, { kind: "resources", amount: 2 }],
    condition: { kind: "canPick", pick: ANOTHER_ALLY },
    instructions: [{ verb: "Pick", pick: ANOTHER_ALLY }, ...calaerionBoost("endOfRound")],
  },

  // 11217 Hard/Expert Mode card: "If you win the game, resolve this card's resolution." Hard (side A) gains 1 XP, Expert (side B) gains 2 XP.
  {"id":"11217:resolution:1","cardCode":"11217","lines":["11217:A:3"],"timing":"resolution","instructions":[{"verb":"GainXp","amount":1}]},
  {"id":"11217:resolution:2","cardCode":"11217","lines":["11217:B:4"],"timing":"resolution","instructions":[{"verb":"GainXp","amount":2}]},
  // 11217 Hard/Expert Mode card (dcce.hard-expert), in play next to the quest deck all game on the side the players chose. Hard: a player's threat cannot be reduced by more
  // than 1 each round; Expert: it cannot be reduced at all (both name no source: any effect). Both: after a player draws any number of cards that player raises their threat by that
  // number (the event cardsDrawn, whose amount is the effect's X); Expert: after a character is healed or readied by a player card effect (not by the refresh phase), its
  // controller raises their threat by 1.
  {"id":"11217:constant:1","cardCode":"11217","lines":["11217:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threatReductionCap","amount":1,"until":"whileSourceInPlay","target":"eachSeat"}]},
  {"id":"11217:forced:1","cardCode":"11217","lines":["11217:A:2"],"timing":"forced","trigger":"cardsDrawn","instructions":[{"verb":"RaiseThreat","amount":{"x":true}}]},
  {"id":"11217:constant:2","cardCode":"11217","lines":["11217:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threatReductionBarred","amount":1,"until":"whileSourceInPlay","target":"eachSeat"}]},
  {"id":"11217:forced:2","cardCode":"11217","lines":["11217:B:2"],"timing":"forced","trigger":"cardsDrawn","instructions":[{"verb":"RaiseThreat","amount":{"x":true}}]},
  healedOrReadied(3, "healed"),
  healedOrReadied(4, "readied"),

  // 11180 Spyglass (boon, attached to Calphon by the campaign card of The Fate of Númenor), both sides.
  spyglass("A"),
  spyglass("B"),

  // 11181 Revenant (burden, shuffled into the encounter deck by the campaign card of The Fate of Númenor; Immune to player card effects is a keyword): +2 Attack and +2 Defense for each resource on the
  // campaign card; no more than 2 damage is placed on it at a time; once destroyed it is shuffled into the encounter deck and the campaign card gains a resource.
  {"id":"11181:constant:1","cardCode":"11181","lines":["11181:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"resources","ofNamed":"The Fate of Númenor","times":2},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"defense","amount":{"stat":"resources","ofNamed":"The Fate of Númenor","times":2},"until":"whileSourceInPlay","target":"self"}]},
  // The damage limit is a replacement effect held for as long as Revenant is in play, however it entered (the smallest limit counts); a constant, not a Forced trigger on one way in (scripts/checks/effect-coverage.test.ts, REPLACEMENT_RECORDS).
  {"id":"11181:constant:2","cardCode":"11181","lines":["11181:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"damageLimit","amount":2,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"11181:forced:1","cardCode":"11181","lines":["11181:A:4"],"timing":"forced","trigger":"enemyDestroyed","subject":"self","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"shuffle"},{"verb":"AddCampaignResource","amount":1}]},

  // 11183 Black Key (boon), both sides.
  blackKeyStats("A", 1),
  blackKeyStats("B", 2),
  {
    id: "11183:response:1",
    cardCode: "11183",
    lines: ["11183:B:3"],
    timing: "response",
    trigger: "questSucceeded",
    eventSeat: "you",
    condition: { kind: "matches", card: "host", pick: { type: "character", control: "any", questedThisRound: true } },
    instructions: [{ verb: "AddResources", amount: 1, to: "host" }],
  },
  { id: "11183:action:1", cardCode: "11183", lines: ["11183:B:4"], timing: "action", cost: [{ kind: "exhaustSelf" }, { kind: "resources", amount: 3, from: "host" }], instructions: [{ verb: "Ready", target: "host" }] },

  // 11184 Galdor's Counsel (Leadership), 11185 (Tactics), 11186 (Spirit), 11187 (Lore).
  counsel("11184", 1, [{ verb: "Pick", pick: { type: "hero", control: "any" } }, { verb: "AddResources", amount: counselX(true), to: "picked" }]),
  counsel("11185", 1, [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true, nonUnique: true } }, { verb: "DamageCard", amount: counselX(false), target: "picked" }]),
  counsel("11186", 1, [{ verb: "Pick", pick: { type: "location", control: "any", stagingOnly: true, nonUnique: true } }, { verb: "PlaceProgressOn", amount: counselX(false), target: "picked" }]),
  counsel("11187", 1, [
    { verb: "Choose", who: "actor", options: [{ id: "top", instructions: [{ verb: "LookAtTop", count: counselX(true), deck: "own" }] }, { id: "bottom", instructions: [{ verb: "LookAtBottom", count: counselX(true) }] }] },
    { verb: "Each", pick: { type: "card", control: "you", from: "deck", looked: true }, upTo: "any", instructions: [{ verb: "MovePicked", to: "hand" }] },
    {
      verb: "Repeat",
      times: { count: { type: "card", control: "you", from: "deck", looked: true, different: true } },
      instructions: [
        { verb: "Pick", pick: { type: "card", control: "you", from: "deck", looked: true, different: true } },
        { verb: "Choose", who: "actor", options: [{ id: "top", instructions: [{ verb: "PutOnDeck", position: "top" }] }, { id: "bottom", instructions: [{ verb: "PutOnDeck", position: "bottom" }] }] },
      ],
    },
  ]),

  // 11189 Parrying Cutlass: +1 Defense (+2 at 2 or more resources in the hero's pool); the Upgraded side +2 (+3) and a Response that takes a resource from the enemy the hero defends against.
  weaponBonus("11189", "11189:A:2", 1, "defense", 1, FROM_TWO("resources")),
  weaponBonus("11189", "11189:B:2", 2, "defense", 2, FROM_TWO("resources")),
  {
    id: "11189:response:1",
    cardCode: "11189",
    lines: ["11189:B:3"],
    timing: "response",
    trigger: "declaredDefender",
    subject: "host",
    cost: { kind: "exhaustSelf" },
    condition: { kind: "canPick", pick: { type: "enemy", control: "any", attackingEnemy: true, hasResources: true } },
    instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", attackingEnemy: true, hasResources: true } }, { verb: "DiscardResources", amount: 1, target: "picked" }, { verb: "AddResources", amount: 1, to: "host" }],
  },

  // 11190 Throwing Axe: +1 Attack (+2 at 2 or more damage on the hero); the Upgraded side +2 (+3) and an Action, once a game, that either deals 1 damage to an enemy or tosses the axe. The toss is thrown at the
  // table: the player says which enemy it stopped on (4 damage to it) or that it missed (the use is spent either way).
  weaponBonus("11190", "11190:A:2", 1, "attack", 1, FROM_TWO("damage")),
  weaponBonus("11190", "11190:B:2", 2, "attack", 2, FROM_TWO("damage")),
  {
    id: "11190:action:1",
    cardCode: "11190",
    lines: ["11190:B:3"],
    timing: "action",
    limit: "oncePerGame",
    instructions: [
      {
        verb: "Choose",
        who: "actor",
        options: [
          { id: "damage", requires: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true } }, instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: 1, target: "picked" }] },
          { id: "hit", requires: { kind: "canPick", pick: { type: "enemy", control: "any", staging: true } }, instructions: [{ verb: "Pick", pick: { type: "enemy", control: "any", staging: true } }, { verb: "DamageCard", amount: 4, target: "picked" }] },
          { id: "miss", instructions: [] },
        ],
      },
    ],
  },

  // 11172 Armor Plating, 11173 Ballista, 11174 Enlarged Quarters, 11175 Extra Sails: the Modification boons each ship-objective is fitted with (the campaign card's Setup),
  // on both sides. When one leaves play it is removed from the game; its Upgraded side adds a Response.
  hostGets("11172", "11172:A:2", 1, "defense", 1),
  hostGets("11172", "11172:B:2", 2, "defense", 1),
  {"id":"11172:response:1","cardCode":"11172","lines":["11172:B:3"],"timing":"response","trigger":"defended","subject":"host","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"hasShadow":true,"attackingEnemy":false}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"hasShadow":true,"attackingEnemy":false}},{"verb":"DiscardShadow"}]},
  hostGets("11173", "11173:A:2", 1, "attack", 1),
  hostGets("11173", "11173:B:2", 2, "attack", 1),
  {"id":"11173:constant:3","cardCode":"11173","lines":["11173:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"11173:response:1","cardCode":"11173","lines":["11173:B:3"],"timing":"response","trigger":"attacked","subject":"host","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},{"verb":"DamageCard","amount":1},{"verb":"DiscardResources","amount":1,"target":"picked"}]},
  hostGets("11174", "11174:A:2", 1, "hitPoints", 3),
  {"id":"11174:constant:2","cardCode":"11174","lines":["11174:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"sailsAnyTest","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  hostGets("11174", "11174:B:2", 3, "hitPoints", 3),
  {"id":"11174:constant:4","cardCode":"11174","lines":["11174:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"sailsAnyTest","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"sailingExtra","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  hostGets("11175", "11175:A:2", 1, "willpower", 1),
  hostGets("11175", "11175:B:2", 2, "willpower", 1),
  {"id":"11175:response:1","cardCode":"11175","lines":["11175:B:3"],"timing":"response","trigger":"engaged","subject":{"type":"enemy","control":"any","trait":"Ship","nonUnique":true,"staging":true},"eventSeat":"you","cost":[{"kind":"exhaustSelf"},{"kind":"resources","amount":1}],"instructions":[{"verb":"ModifyStat","stat":"boarding","amount":-1,"until":"endOfPhase","target":"subject"}]},

  // 11176 Ominous Fate (burden, the campaign card adds it to the pool): it cannot be canceled. When Revealed, each player either reveals an encounter card, raises their
  // threat by X or deals X damage divided among characters they control (X is the campaign card's part number); the players may add it to the victory display.
  // Shadow: reveal an encounter card.
  {
    "id": "11176:whenRevealed:1",
    "cardCode": "11176",
    "lines": ["11176:A:2", "11176:A:3"],
    "timing": "whenRevealed",
    "uncancelable": ALWAYS,
    "instructions": [
      {"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[
        {"id":"reveal","instructions":[{"verb":"RevealEncounter"}]},
        {"id":"threat","instructions":[{"verb":"RaiseThreat","amount":{"part":true}}]},
        {"id":"damage","instructions":[{"verb":"AssignDamage","amount":{"part":true},"pick":{"type":"character","control":"you"}}]}
      ]}]},
      {"verb":"Choose","who":"firstPlayer","options":[{"id":"victory","instructions":[{"verb":"AddToVictory","target":"self"}]},{"id":"discard","instructions":[]}]}
    ]
  },
  {"id":"11176:shadow:1","cardCode":"11176","lines":["11176:A:4"],"timing":"shadow","uncancelable":ALWAYS,"instructions":[{"verb":"RevealEncounter"}]},

  // 11177 Thunderstruck (burden): +2 hit points per player, no more than 4 damage each round. Shadow: it joins the staging area, or 2 damage to the defending character.
  {"id":"11177:constant:1","cardCode":"11177","lines":["11177:A:4"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":{"players":true,"times":2},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"damageCap","amount":4,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"11177:shadow:1","cardCode":"11177","lines":["11177:A:5"],"timing":"shadow","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"staging","instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]},{"id":"damage","instructions":[{"verb":"DamageCard","amount":2,"target":"defender"}]}]}]},

  // 11178 Crowley (burden, shuffled into the Corsair deck): +1 Threat, Attack, Defense and hit point for each resource on him, and Victory 3 at 3 or more (also from the
  // victory display, where the score reads it). Forced: when he engages you he gets a resource; at the end of the combat phase he returns to the staging area.
  {"id":"11178:constant:1","cardCode":"11178","lines":["11178:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"stat":"resources","of":"self"},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"attack","amount":{"stat":"resources","of":"self"},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"defense","amount":{"stat":"resources","of":"self"},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"hitPoints","amount":{"stat":"resources","of":"self"},"until":"whileSourceInPlay","target":"self"},{"verb":"ModifyStat","stat":"gainsVictory","amount":3,"until":"whileSourceInPlay","target":"self","when":{"kind":"matches","card":"self","pick":{"type":"enemy","control":"any","staging":true,"minResources":3}}}]},
  {"id":"11178:constant:2","cardCode":"11178","lines":["11178:A:1"],"timing":"constant","condition":{"kind":"all","conditions":[{"kind":"sourceIn","zone":"victory"},{"kind":"matches","card":"self","pick":{"type":"card","control":"any","minResources":3,"from":"victory"}}]},"instructions":[{"verb":"ModifyStat","stat":"gainsVictory","amount":3,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"11178:forced:1","cardCode":"11178","lines":["11178:A:2"],"timing":"forced","trigger":"engaged","subject":"self","eventSeat":"you","instructions":[{"verb":"AddResources","amount":1,"to":"self"}]},
  {"id":"11178:forced:2","cardCode":"11178","lines":["11178:A:2"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"sourceIn","zone":"engaged"}]},"instructions":[{"verb":"ReturnToStaging","target":{"kind":"self"}}]},

  // 11195 Come Together (event the campaign card of The Thing in the Depths adds to a hand; Scalable): Action, X is its level (plus 1 when the campaign card gave it this game): choose up to X characters; it joins
  // the victory display; until the end of the round each of them gets +2 Defense with a Leadership hero, +2 Attack with a Tactics hero, +2 Willpower with a Spirit hero, and with a Lore hero gains a Trait of the
  // player's choice and heals 2 damage.
  {
    id: "11195:action:1",
    cardCode: "11195",
    lines: ["11195:A:1", "11195:A:2", "11195:A:3", "11195:A:4", "11195:A:5"],
    timing: "action",
    cost: { kind: "playEvent" },
    instructions: [
      {
        verb: "Each",
        pick: { type: "character", control: "any" },
        upTo: { level: true, plusChosen: true },
        instructions: [
          { verb: "ModifyStat", stat: "defense", amount: 2, until: "endOfRound", target: "picked", when: controlsHero("leadership") },
          { verb: "ModifyStat", stat: "attack", amount: 2, until: "endOfRound", target: "picked", when: controlsHero("tactics") },
          { verb: "ModifyStat", stat: "willpower", amount: 2, until: "endOfRound", target: "picked", when: controlsHero("spirit") },
          { verb: "GainChosenTrait", when: controlsHero("lore") },
          { verb: "Heal", amount: 2, target: "picked", when: controlsHero("lore") },
        ],
      },
      { verb: "AddSourceToVictory" },
    ],
  },

  // 11196 Sea Serpent (burden the campaign card of The Thing in the Depths adds to the staging area; Immune to player card effects is a keyword). Both sides: its Threat and Defense are X, the number of players
  // (twice that on the Enraged side B); after it attacks and destroys an ally the defending player deals X damage divided among the characters they control. Side A: after it is destroyed it returns to the staging area on its side B (the move comes first because a move to the staging area resets a card to side A, so the flip after it sticks). Side B: at the end of the round it makes an attack against the first player.
  ...(["A", "B"] as const).flatMap((side): Effect[] => {
    const x = { players: true, ...(side === "B" ? { times: 2 } : {}) } as const;
    return [
      {
        id: `11196:constant:${side === "A" ? 1 : 2}`,
        cardCode: "11196",
        lines: [`11196:${side}:2`],
        timing: "constant",
        instructions: [{ verb: "ModifyStat", stat: "threat", amount: x, until: "whileSourceInPlay" }, { verb: "ModifyStat", stat: "defense", amount: x, until: "whileSourceInPlay" }],
      },
      {
        id: `11196:forced:${side === "A" ? 1 : 2}`,
        cardCode: "11196",
        lines: [`11196:${side}:3`],
        timing: "forced",
        trigger: "characterDestroyedByAttack",
        subject: { type: "ally", control: "any" },
        condition: { kind: "matches", card: "other", pick: { type: "enemy", control: "any", names: ["Sea Serpent"] } },
        instructions: [{ verb: "AssignDamage", amount: x, pick: { type: "character", control: "you" } }],
      },
    ];
  }),
  { id: "11196:forced:3", cardCode: "11196", lines: ["11196:A:4"], timing: "forced", trigger: "enemyDestroyed", subject: "self", instructions: [{ verb: "MoveEncounterCard", card: "self", to: "staging" }, { verb: "FlipCard" }] },
  { id: "11196:forced:4", cardCode: "11196", lines: ["11196:B:4"], timing: "forced", trigger: "endOfRound", instructions: [{ verb: "AttackFirstPlayer" }] },
  { id: "11210:whenRevealed:1", cardCode: "11210", lines: ["11210:A:5"], timing: "whenRevealed", instructions: [FIRST_PLAYER_CHOOSES, { verb: "TakeRevealedCard", who: "picked", committed: true }, { verb: "Pick", pick: LANWYN }, { verb: "AddResources", amount: 1, to: "picked", when: { kind: "canPick", pick: LANWYN } }] },

  // 11216 The Black Sword (burden objective the campaign card of The City of Corsairs attaches to Captain Sahír; Immune to player card effects is a keyword). It enters play (is attached) with 3 resources on it (side B: 2), Captain
  // Sahír gets +2 Attack (side A only) and gains indestructible, and after he attacks for the first time each round he attacks each other player in turn order.
  { id: "11216:triggered:1", cardCode: "11216", lines: ["11216:A:2"], timing: "triggered", trigger: "attached", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount: 3, on: "self" }] },
  { id: "11216:triggered:2", cardCode: "11216", lines: ["11216:B:2"], timing: "triggered", trigger: "attached", subject: "self", instructions: [{ verb: "PlaceResourceTokens", amount: 2, on: "self" }] },
  {
    id: "11216:constant:1",
    cardCode: "11216",
    lines: ["11216:A:3"],
    timing: "constant",
    instructions: [
      { verb: "ModifyStat", stat: "attack", amount: 2, until: "whileSourceInPlay", holders: BLACK_KEY_SAHIR },
      { verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", holders: BLACK_KEY_SAHIR },
    ],
  },
  { id: "11216:constant:2", cardCode: "11216", lines: ["11216:B:3"], timing: "constant", instructions: [{ verb: "ModifyStat", stat: "indestructible", amount: 1, until: "whileSourceInPlay", holders: BLACK_KEY_SAHIR }] },
  { id: "11216:forced:1", cardCode: "11216", lines: ["11216:A:4", "11216:B:4"], timing: "forced", trigger: "attackResolved", subject: BLACK_KEY_SAHIR, limit: "oncePerRound", instructions: [{ verb: "AttackOtherPlayers", target: "subject" }] },
];

export const REPLACES: readonly string[] = [];
