import type { Effect } from "../../../catalog/boundary.ts";

// Records for the Dream-chaser Campaign Expansion's own cards (data/cards/DCCE.json), added as each scenario phase uses them. Read from the scan
// ledger (data/printed/dream-chaser.json). Rules: dcce.hard-expert, dcce.gaining-xp, dcce.scalable-upgradable, dcce.encounter-cards, dcce.sailing-tests,
// dcce.boarding (data/rules/entries.json).
// "When X leaves play, remove it from the game." (a Modification boon, either side)
const removedWhenLeaving = (code: string, line: string, id: number): Effect => ({ id: `${code}:triggered:${id}`, cardCode: code, lines: [line], timing: "triggered", trigger: "leftPlay", subject: "self", instructions: [{ verb: "RemoveSourceFromGame" }] });

// "Attached Ship gets +N <stat>" (a Modification boon, either side).
const hostGets = (code: string, line: string, id: number, stat: "defense" | "attack" | "willpower" | "hitPoints", amount: number): Effect => ({
  id: `${code}:constant:${id}`,
  cardCode: code,
  lines: [line],
  timing: "constant",
  instructions: [{ verb: "ModifyStat", stat, amount, until: "whileSourceInPlay", target: "host" }],
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

// A condition that always holds, for the "cannot be canceled" of a card that prints no condition (`uncancelable` takes one; as in families/sidequests.ts).
const ALWAYS = { kind: "count", pick: { type: "hero", control: "any" }, min: 0 } as const;

export const RECORDS: readonly Effect[] = [
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

  // 11172 Armor Plating, 11173 Ballista, 11174 Enlarged Quarters, 11175 Extra Sails: the Modification boons each ship-objective is fitted with (the campaign card's Setup),
  // on both sides. When one leaves play it is removed from the game; its Upgraded side adds a Response.
  removedWhenLeaving("11172", "11172:A:1", 1),
  hostGets("11172", "11172:A:2", 1, "defense", 1),
  removedWhenLeaving("11172", "11172:B:1", 2),
  hostGets("11172", "11172:B:2", 2, "defense", 1),
  {"id":"11172:response:1","cardCode":"11172","lines":["11172:B:3"],"timing":"response","trigger":"defended","subject":"host","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"hasShadow":true,"attackingEnemy":false}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"hasShadow":true,"attackingEnemy":false}},{"verb":"DiscardShadow"}]},
  removedWhenLeaving("11173", "11173:A:1", 1),
  hostGets("11173", "11173:A:2", 1, "attack", 1),
  removedWhenLeaving("11173", "11173:B:1", 2),
  hostGets("11173", "11173:B:2", 2, "attack", 1),
  {"id":"11173:constant:3","cardCode":"11173","lines":["11173:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"11173:response:1","cardCode":"11173","lines":["11173:B:3"],"timing":"response","trigger":"attacked","subject":"host","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},{"verb":"DamageCard","amount":1},{"verb":"DiscardResources","amount":1,"target":"picked"}]},
  removedWhenLeaving("11174", "11174:A:1", 1),
  hostGets("11174", "11174:A:2", 1, "hitPoints", 3),
  {"id":"11174:constant:2","cardCode":"11174","lines":["11174:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"sailsAnyTest","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  removedWhenLeaving("11174", "11174:B:1", 2),
  hostGets("11174", "11174:B:2", 3, "hitPoints", 3),
  {"id":"11174:constant:4","cardCode":"11174","lines":["11174:B:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"sailsAnyTest","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"sailingExtra","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  removedWhenLeaving("11175", "11175:A:1", 1),
  hostGets("11175", "11175:A:2", 1, "willpower", 1),
  removedWhenLeaving("11175", "11175:B:1", 2),
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
];

export const REPLACES: readonly string[] = [];
