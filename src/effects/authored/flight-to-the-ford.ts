import type { Effect } from "../../catalog/boundary.ts";

// Records for the cards of Flight to the Ford (scenario 3) that no template in scripts/data/effects/templates.ts reads in full.
// The burden deck and the Ring-bearer's life are the burden family's vocabulary (src/catalog/families/burden.ts). The Ring-bearer
// is the hero with the Ring-bearer trait (the one The One Ring is attached to). Lines 141029:B:4 and 141057:A:3 are marked inert
// in the printed-text ledger: each restates a rule the engine applies (rr.winning-the-game, mec109.ringbearers-life).
const RING = "141085";
const RING_BEARER = { type: "hero", control: "any", trait: "Ring-bearer" } as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 141028 Pursued by the Enemy. The Setup record states the printed order; the definition runs the scenario's piles (the burden
  // deck is shuffled when the game is dealt, the life is the definition's, the Fell Rider is placed once for each player), so
  // nothing is placed twice. B:1 is the generated 141028:constant:1.
  {"id":"141028:setup:1","cardCode":"141028","lines":["141028:A:1"],"timing":"setup","instructions":[{"verb":"ShuffleBurdenDeck"},{"verb":"AttachToRingBearer","code":"141057"},{"verb":"SetAside","code":"141059"},{"verb":"SetAside","code":"141068"},{"verb":"AddToStaging","code":"141058"},{"verb":"AddToStaging","code":"141063"},{"verb":"SetLife","value":15},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"141028:forced:1","cardCode":"141028","lines":["141028:B:2"],"timing":"forced","trigger":"endOfRound","instructions":[{"verb":"ReduceLife","amount":1}]},
  // 141029 Race to Rivendell. The Nazgûl in play are read each time the quest points are, so the +15 follows them. Defeating this
  // stage wins (B:4, inert).
  {"id":"141029:whenRevealed:1","cardCode":"141029","lines":["141029:B:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":"141059"},{"verb":"AddSetAsideToStaging","code":"141068"}]},
  {"id":"141029:constant:1","cardCode":"141029","lines":["141029:B:2"],"timing":"constant","condition":{"kind":"enemyInPlay","trait":"Nazgûl","is":true},"instructions":[{"verb":"ModifyStat","stat":"questPoints","amount":15,"until":"whileSourceInPlay"}]},
  {"id":"141029:forced:1","cardCode":"141029","lines":["141029:B:3"],"timing":"forced","trigger":"endOfRound","instructions":[{"verb":"ReduceLife","amount":1}]},

  // 141056 Flight to the Ford (the campaign card, in the game beside the quest deck). Any player may cancel an attack by shuffling
  // the top card of the burden deck into the encounter deck, as many times as there are burden cards and attacks. Its back (B:1)
  // is the generated-in-phase-12 record 141056:resolution:1.
  {"id":"141056:response:1","cardCode":"141056","lines":["141056:A:2"],"timing":"response","trigger":"enemyAttacks","subject":{"type":"enemy","control":"any"},"anyPlayer":true,"condition":{"kind":"burdenDeck"},"instructions":[{"verb":"MoveBurden","to":"encounterShuffle"},{"verb":"CancelAttack"}]},

  // 141057 An Evil Wound: attached to the Ring-bearer, who cannot be healed and takes damage as a loss of life (A:3 is inert).
  {"id":"141057:constant:1","cardCode":"141057","lines":["141057:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"ringBearer"}},{"verb":"ModifyStat","stat":"cannotBeHealed","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"141057:constant:2","cardCode":"141057","lines":["141057:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"damageToLife","amount":1,"until":"whileSourceInPlay","target":"host"}]},

  // 141058 The Last Bridge (line 1 is immune; X is its Threat)
  {"id":"141058:constant:1","cardCode":"141058","lines":["141058:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"players":true},"until":"whileSourceInPlay"}]},
  {"id":"141058:travel:1","cardCode":"141058","lines":["141058:A:3"],"timing":"travel","instructions":[{"verb":"RevealBurden"}]},

  // 141059 Ford of Bruinen (line 1 is immune). A location leaves play with a leftPlay event only when it is explored.
  {"id":"141059:response:1","cardCode":"141059","lines":["141059:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","instructions":[{"verb":"Each","pick":{"type":"enemy","control":"any"},"instructions":[{"verb":"MoveEncounterCard","card":"picked","to":"discard"}]}]},
  {"id":"141059:travel:1","cardCode":"141059","lines":["141059:A:3"],"timing":"travel","instructions":[{"verb":"RevealEncounter"}]},

  // 141060 The Troll's Camp
  {"id":"141060:constant:1","cardCode":"141060","lines":["141060:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"heroes"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"heroes"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"heroes"}]},

  // 141061 Ettenmoors
  {"id":"141061:constant:1","cardCode":"141061","lines":["141061:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"noShadowDealt","amount":1,"until":"whileSourceInPlay","target":"enemies","trait":"Nazgûl"}]},
  {"id":"141061:forced:1","cardCode":"141061","lines":["141061:A:2"],"timing":"forced","trigger":"progressPlaced","instructions":[{"verb":"ReduceLife","amount":1}]},

  // 141062 The Old Road: any player may use it in a campaign game while the burden deck has a card.
  {"id":"141062:action:1","cardCode":"141062","lines":["141062:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"campaign"},{"kind":"burdenDeck"}]},"instructions":[{"verb":"MoveBurden","to":"encounterTop"},{"verb":"PlaceProgressOn","amount":4,"target":"self"}]},

  // 141063 Fell Rider (line 1 is the generated 141063:constant:1)
  {"id":"141063:forced:1","cardCode":"141063","lines":["141063:A:2"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Encounter"},{"kind":"sourceIn","zone":"staging"}]},"instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"life","instructions":[{"verb":"ReduceLife","amount":1}]},{"id":"engage","instructions":[{"verb":"Engage","target":"self"}]}]}]},

  // 141064 Stricken Dumb. "Reveal an additional encounter card" is surge (rr.surge). "You" is the player who revealed it.
  {"id":"141064:whenRevealed:1","cardCode":"141064","lines":["141064:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"burden","requires":{"kind":"burdenDeck"},"instructions":[{"verb":"MoveBurden","to":"encounterShuffle"},{"verb":"GainSurge"}]},{"id":"threat","instructions":[{"verb":"RaiseThreat","amount":3,"who":"eachSeat"},{"verb":"EndQuestPhase"}]}]}]},

  // 141065 The Enemy is Upon Us!: the attacks are made one after the other; the shadow clause reads the X of the effect an attack
  // leaves for its end, the characters it destroyed.
  {"id":"141065:whenRevealed:1","cardCode":"141065","lines":["141065:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ImmediateAttackEach"},{"verb":"GainSurge","when":{"kind":"noneReturned"}}]},
  {"id":"141065:shadow:1","cardCode":"141065","lines":["141065:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"RemoveAllQuestProgress","when":{"kind":"x","min":1}}]}]},

  // 141066 Pain Assailed Him
  {"id":"141066:whenRevealed:1","cardCode":"141066","lines":["141066:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ReduceLife","amount":1},{"verb":"SetStatUntil","stat":"willpower","value":0,"until":"endOfRound","holders":RING_BEARER},{"verb":"SetStatUntil","stat":"attack","value":0,"until":"endOfRound","holders":RING_BEARER},{"verb":"SetStatUntil","stat":"defense","value":0,"until":"endOfRound","holders":RING_BEARER}]},
  {"id":"141066:shadow:1","cardCode":"141066","lines":["141066:A:2"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"ReduceLife","amount":1,"when":{"kind":"x","min":1}}]}]},

  // 141067 The Nine are Abroad: the text boxes of the characters in play now are blank, keywords included (rr.blank); their traits stay.
  {"id":"141067:whenRevealed:1","cardCode":"141067","lines":["141067:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"blankText","amount":1,"until":"endOfRound","holders":{"type":"character","control":"any"}},{"verb":"GainSurge","when":{"kind":"count","pick":{"type":"enemy","control":"any","stagingOnly":true,"trait":"Nazgûl"},"min":1}}]},

  // 141080 Weight of the Ring (line 1 is Surge). It is a Condition attachment with a Forced effect of its own.
  {"id":"141080:whenRevealed:1","cardCode":"141080","lines":["141080:A:2"],"timing":"whenRevealed","instructions":[{"verb":"AttachSelfToRingBearer"}]},
  {"id":"141080:forced:1","cardCode":"141080","lines":["141080:A:2"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"exhaust","requires":{"kind":"exhausted","code":RING,"is":false},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":RING}}]},{"id":"reveal","instructions":[{"verb":"RevealMore","amount":1}]}]}]},

  // 141081 Fear of Discovery
  {"id":"141081:whenRevealed:1","cardCode":"141081","lines":["141081:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"exhaust","requires":{"kind":"canPick","pick":{...RING_BEARER,"state":"ready"}},"instructions":[{"verb":"Pick","pick":{...RING_BEARER,"state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]},{"id":"reveal","instructions":[{"verb":"GainSurge"}]}]}]},
  {"id":"141081:shadow:1","cardCode":"141081","lines":["141081:A:3"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":3,"who":"actor"}]},

  // 141082 Eaten Alive!: the first player deals one damage at a time, X times, to a hero they control.
  {"id":"141082:whenRevealed:1","cardCode":"141082","lines":["141082:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Repeat","times":{"players":true},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","who":"firstPlayer"}},{"verb":"DamageCard","amount":1,"target":"picked"}]}]},
  {"id":"141082:shadow:1","cardCode":"141082","lines":["141082:A:3"],"timing":"shadow","instructions":[{"verb":"DamageCard","amount":1,"target":"defender"}]},

  // 141083 Panicked
  {"id":"141083:whenRevealed:1","cardCode":"141083","lines":["141083:A:2"],"timing":"whenRevealed","instructions":[{"verb":"RaiseThreat","amount":3,"who":"firstPlayer"},{"verb":"PassFirstPlayer"}]},
  {"id":"141083:shadow:1","cardCode":"141083","lines":["141083:A:3"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]},

  // 141084 Overcome by Terror
  // "If The One Ring is already exhausted" is the other branch of one choice, so exhausting it does not also discard.
  {"id":"141084:whenRevealed:1","cardCode":"141084","lines":["141084:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"firstPlayer","options":[{"id":"exhaust","requires":{"kind":"exhausted","code":RING,"is":false},"instructions":[{"verb":"Exhaust","target":{"kind":"byCode","code":RING},"who":"firstPlayer"}]},{"id":"discard","requires":{"kind":"exhausted","code":RING,"is":true},"instructions":[{"verb":"DiscardRandomFromHand","amount":2,"who":"firstPlayer"}]}]}]},
  {"id":"141084:shadow:1","cardCode":"141084","lines":["141084:A:3"],"timing":"shadow","instructions":[{"verb":"DiscardRandomFromHand"}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
