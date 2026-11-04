import type { Effect } from "../../catalog/boundary.ts";

// Records for the cards of The Ring Goes South (scenario 4) that no template in scripts/data/effects/templates.ts reads in full.
// The second active location, the Ring-bearer facedown under the Watcher and the enemy engaged with every player are the south
// family's vocabulary (src/catalog/families/south.ts). A Setup record states the printed order; the scenario's definition runs the
// scenario's piles, so nothing is placed twice. Damage on a location is a count of its own that card text reads ("X is the number
// of damage here"); it does not explore or destroy the location.
const LUST = "142084";
const REDHORN = "142029";
const DOORS = "142030";
const WATCHER = "142024";
const GREAT_WARG_CHIEF = "142025";
const ACTIVE = { type: "location", control: "any", active: true, who: "firstPlayer" } as const;
const X_DAMAGE_HERE = { stat: "damage", of: "self" } as const;
const WARG_IN_STAGING = { type: "enemy", control: "any", stagingOnly: true, trait: "Warg" } as const;
const ENGAGED_THIS_ROUND = { kind: "matches", card: "attacker", pick: { type: "enemy", control: "any", engagedThisRound: true } } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // The boons 142011 to 142014 (Sting, Mithril Shirt, Glamdring, Andúril) are in src/effects/authored/families/misc.ts.

  // 142020 The Council of Elrond. 1B: the faceup cards are assigned in the order the card prints (played for no cost, to the owner's
  // hand, discarded, shuffled into the owner's deck); then the first player either shuffles Lust for the Ring in or each player
  // raises their threat by 5; the quest advances to stage 2.
  {"id":"142020:setup:1","cardCode":"142020","lines":["142020:A:1"],"timing":"setup","instructions":[{"verb":"SetAside","code":LUST},{"verb":"SetAside","code":REDHORN},{"verb":"SetAside","code":DOORS},{"verb":"SetAside","code":WATCHER},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"142020:forced:1","cardCode":"142020","lines":["142020:B:1"],"timing":"forced","trigger":"endOfPhase","condition":{"kind":"phase","is":"Planning"},"instructions":[{"verb":"AssignFaceup","cards":4,"outcomes":["play","hand","discard","shuffle"]},{"verb":"Choose","who":"firstPlayer","options":[{"id":"lust","requires":{"kind":"outOfPlay","code":LUST},"instructions":[{"verb":"ShuffleOutOfPlayIntoEncounterDeck","code":LUST}]},{"id":"threat","instructions":[{"verb":"RaiseThreat","amount":5,"who":"eachSeat"}]}]},{"verb":"AdvanceStage"}]},

  // 142021 The Nine Walkers. X is twice the number of players.
  {"id":"142021:whenRevealed:1","cardCode":"142021","lines":["142021:A:1"],"timing":"whenRevealed","instructions":[{"verb":"MakeSetAsideActive","code":REDHORN},{"verb":"RevealUntilThreat","threat":{"players":true,"times":2}}]},
  {"id":"142021:constant:1","cardCode":"142021","lines":["142021:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"mustTravel","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"142021:forced:1","cardCode":"142021","lines":["142021:B:2"],"timing":"forced","trigger":"engaged","instructions":[{"verb":"Pick","pick":ACTIVE},{"verb":"PlaceDamage","amount":1,"card":"picked"}]},

  // 142022 The Hunt is Up! Each player searches in turn; while Great Warg Chief is in the encounter deck or its discard pile, the
  // first search takes it.
  {"id":"142022:whenRevealed:1","cardCode":"142022","lines":["142022:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","type":"enemy","to":"staging","require":GREAT_WARG_CHIEF}]},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"142022:constant:1","cardCode":"142022","lines":["142022:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"mustTravel","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"142022:forced:1","cardCode":"142022","lines":["142022:B:2"],"timing":"forced","trigger":"encounterEnteredPlay","subject":{"type":"location","control":"any"},"instructions":[{"verb":"PlaceDamage","amount":1,"card":"subject"}]},
  {"id":"142022:forced:2","cardCode":"142022","lines":["142022:B:3"],"timing":"forced","trigger":"engaged","instructions":[{"verb":"Pick","pick":ACTIVE},{"verb":"PlaceDamage","amount":1,"card":"picked"}]},

  // 142023 The Gates of Moria. The Ring-bearer and each card attached to it go facedown under the Watcher, out of every player's
  // control but in play. Doors of Durin explored wins (it has no quest points to fill: the stage is won some other way).
  {"id":"142023:whenRevealed:1","cardCode":"142023","lines":["142023:A:1"],"timing":"whenRevealed","instructions":[{"verb":"MakeSetAsideActive","code":DOORS},{"verb":"AddSetAsideToStaging","code":WATCHER},{"verb":"CaptureRingBearer","under":WATCHER}]},
  {"id":"142023:constant:1","cardCode":"142023","lines":["142023:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraActiveLocation","amount":1,"until":"whileSourceInPlay","target":"table"},{"verb":"ModifyStat","stat":"mustTravel","amount":1,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"142023:forced:1","cardCode":"142023","lines":["142023:B:2"],"timing":"forced","trigger":"engaged","instructions":[{"verb":"Each","pick":{"type":"location","control":"any","active":true},"instructions":[{"verb":"PlaceDamage","amount":1,"card":"picked"}]}]},
  {"id":"142023:triggered:1","cardCode":"142023","lines":["142023:B:3"],"timing":"triggered","trigger":"leftPlay","subject":{"type":"location","control":"any","names":["Doors of Durin"]},"condition":{"kind":"subjectExplored"},"instructions":[{"verb":"WinGame"}]},

  // 142024 Watcher in the Water (Indestructible and the immunity are keywords). It stays in the staging area, is considered engaged
  // with each player (it attacks each one, and any character may attack it) and adds no Threat there (rr.engaged). A:3 is its
  // sixth damage token.
  {"id":"142024:constant:1","cardCode":"142024","lines":["142024:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"engagedWithAll","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotBeEngaged","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"noThreatContribution","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"attackableByAny","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"142024:forced:1","cardCode":"142024","lines":["142024:A:3"],"timing":"forced","trigger":"damaged","subject":"self","condition":{"kind":"damageReached","nth":6},"instructions":[{"verb":"ReleaseRingBearer","damage":1}]},

  // 142025 Great Warg Chief
  {"id":"142025:forced:1","cardCode":"142025","lines":["142025:A:2"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"DiscardUntil","type":"enemy","trait":"Warg"},{"verb":"MoveEncounterCard","to":"engaged"}]},

  // 142026 Hound of Sauron (Surge is a keyword)
  {"id":"142026:constant:1","cardCode":"142026","lines":["142026:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":{"count":{"type":"enemy","control":"any","stagingOnly":true},"times":5},"subtract":true,"until":"whileSourceInPlay"}]},
  {"id":"142026:shadow:1","cardCode":"142026","lines":["142026:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfAttack","target":"attacker","when":{"kind":"not","condition":ENGAGED_THIS_ROUND}},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfAttack","target":"attacker","when":ENGAGED_THIS_ROUND}]},

  // 142027 Howling Warg
  {"id":"142027:forced:1","cardCode":"142027","lines":["142027:A:1"],"timing":"forced","trigger":"attacks","instructions":[{"verb":"Pick","pick":ACTIVE},{"verb":"PlaceDamage","amount":1,"card":"picked"}]},

  // 142028 Crebain from Dunland (Peril is a keyword)
  {"id":"142028:whenRevealed:1","cardCode":"142028","lines":["142028:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"exhaust","requires":{"kind":"canPick","pick":{"type":"hero","control":"you","state":"ready"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]},{"id":"engage","instructions":[{"verb":"Engage","target":"self"}]}]}]},
  {"id":"142028:forced:1","cardCode":"142028","lines":["142028:A:3"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"RevealEncounter","who":"eventSeat"}]},

  // 142029 Redhorn Pass (the immunity is a keyword). X is the damage it held when it was explored.
  {"id":"142029:forced:1","cardCode":"142029","lines":["142029:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"AssignDamage","amount":X_DAMAGE_HERE,"pick":{"type":"character","control":"you"},"who":"eachSeat"}]},

  // 142030 Doors of Durin (the immunity is a keyword). The players lose at 9 damage tokens.
  {"id":"142030:constant:1","cardCode":"142030","lines":["142030:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"progressAfterOthers","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"progressNeedsRingBearer","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"142030:constant:2","cardCode":"142030","lines":["142030:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"loseAtDamage","amount":9,"until":"whileSourceInPlay"}]},

  // 142031 Tree-crowned Hill: as a group, the players decide which characters are exhausted, so the first player chooses.
  {"id":"142031:constant:1","cardCode":"142031","lines":["142031:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"threat","amount":-1,"until":"whileSourceInPlay","target":"enemies"}]},
  {"id":"142031:forced:1","cardCode":"142031","lines":["142031:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"Repeat","times":X_DAMAGE_HERE,"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","state":"ready","who":"firstPlayer"}},{"verb":"Exhaust","target":{"kind":"picked"}}]}]},

  // 142032 Hills of Hollin
  {"id":"142032:constant:1","cardCode":"142032","lines":["142032:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":5,"until":"whileSourceInPlay","holders":{"type":"enemy","control":"any","stagingOnly":true}}]},
  {"id":"142032:forced:1","cardCode":"142032","lines":["142032:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"RaiseThreat","amount":X_DAMAGE_HERE,"who":"eachSeat"}]},

  // 142033 Redhorn Foothills: while it is the active location it has the Forced effect on enemies added to the staging area.
  {"id":"142033:forced:1","cardCode":"142033","lines":["142033:A:1"],"timing":"forced","trigger":"addedToStaging","subject":{"type":"enemy","control":"any"},"condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-5,"until":"endOfRound","target":"subject"}]},
  {"id":"142033:forced:2","cardCode":"142033","lines":["142033:A:2"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"DiscardRandomFromHand","amount":X_DAMAGE_HERE}]}]},

  // 142034 Eregion
  {"id":"142034:forced:1","cardCode":"142034","lines":["142034:A:1"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"Repeat","times":X_DAMAGE_HERE,"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"any","who":"firstPlayer"}},{"verb":"DiscardPicked"}]}]},
  {"id":"142034:shadow:1","cardCode":"142034","lines":["142034:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you"}},{"verb":"DiscardPicked"}]},

  // 142035 Regiments of Crows
  {"id":"142035:whenRevealed:1","cardCode":"142035","lines":["142035:A:1"],"timing":"whenRevealed","instructions":[{"verb":"Each","pick":{"type":"location","control":"any","active":true},"instructions":[{"verb":"PlaceDamage","amount":3,"card":"picked"}]}]},
  {"id":"142035:shadow:1","cardCode":"142035","lines":["142035:A:2"],"timing":"shadow","instructions":[{"verb":"DamageActiveLocation"}]},

  // 142036 Snowdrifts: attached to an active location that has none (Limit 1 per location), it caps the progress placed there
  // each round at 3; otherwise it gains surge.
  {"id":"142036:whenRevealed:1","cardCode":"142036","lines":["142036:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AttachToActiveLocation"},{"verb":"GainSurge","when":{"kind":"not","condition":{"kind":"x","min":1}}}]},
  {"id":"142036:constant:1","cardCode":"142036","lines":["142036:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"progressCap","amount":3,"until":"whileSourceInPlay","target":"host"}]},

  // 142037 Bitter Cold
  {"id":"142037:whenRevealed:1","cardCode":"142037","lines":["142037:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"discard","instructions":[{"verb":"DiscardEach","pick":{"type":"ally","control":"you"}}]},{"id":"threat","instructions":[{"verb":"RaiseThreat","amount":{"count":{"type":"ally","control":"you"}},"who":"actor"}]}]}]}]},

  // 142038 Storm of Howls
  {"id":"142038:whenRevealed:1","cardCode":"142038","lines":["142038:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"attack","requires":{"kind":"canPick","pick":WARG_IN_STAGING},"instructions":[{"verb":"PickHighestEngagement","trait":"Warg"},{"verb":"AttackFromStaging"}]},{"id":"engagement","instructions":[{"verb":"ModifyStat","stat":"engagementCost","amount":-20,"until":"endOfRound","holders":WARG_IN_STAGING}]}]},{"verb":"GainSurge","when":{"kind":"not","condition":{"kind":"count","pick":WARG_IN_STAGING,"min":1}}}]},

  // 142084 Lust for the Ring (Peril and Surge are keywords). A Condition attachment with a Forced effect of its own.
  {"id":"142084:whenRevealed:1","cardCode":"142084","lines":["142084:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelf","to":{"kind":"hero","control":"any","exceptSphere":"fellowship"}}]},
  {"id":"142084:forced:1","cardCode":"142084","lines":["142084:A:2"],"timing":"forced","trigger":"exhausted","subject":{"type":"card","control":"any","names":["The One Ring"]},"instructions":[{"verb":"RaiseThreat","amount":1,"who":"eachSeat"},{"verb":"SetStatUntil","stat":"willpower","value":0,"until":"endOfRound","holders":{"type":"hero","control":"any","isHost":true}}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
