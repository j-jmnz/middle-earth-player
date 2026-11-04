import type { Effect, PickSpec } from "../../catalog/boundary.ts";

import { AUTHORED_EFFECTS as CAVES } from "./the-caves-of-nibin-dum.ts";
import { reprint } from "./reprint.ts";

// Records for the cards of Journey in the Dark (scenario 5, campaign card 142039) that no template in scripts/data/effects/templates.ts reads in
// full: the three quest cards, Doom, Doom, Doom and the Balrog, the encounter cards, and the burdens the campaign card deals (Pursued by the Enemy,
// Shadow of Fear, Overcome by Grief, Grievous Wound). The campaign card's Setup and Resolution are in fellowship-of-the-ring.ts. Every line is read
// from the scan ledger (data/printed/fellowship-of-the-ring.json). The moria family (src/catalog/families/moria.ts) is the vocabulary the scenario
// adds: damage tokens that count down on Doom, Doom, Doom, the Balrog engaged with the first player from the staging area, the Great Bridge's
// sacrifice, and the burden objectives that attach to a hero. Damage on Doom, Doom, Doom is a count of its own, as on a location.
// Rules: rr.step-3-3, rr.search, rr.travel, rr.engaged, rr.cancel, rr.first-player, rr.campaign-cards, rr.active-location, rr.quest-advancement,
// rr.winning-the-game, rr.optional-engagement, rr.objective-cards (data/rules/entries.json).
const DOOM = "142043";
const BALROG = "142044";
const BRIDGE = "142050";
const CHIEFTAIN = "142045";
const BALROG_IN_STAGING: PickSpec = {"type":"enemy","control":"any","stagingOnly":true,"names":["The Balrog"]};
const THREAT_35 = {"kind":"threat","min":35} as const;
const NOT_IN_STAGING = {"kind":"not","condition":{"kind":"sourceIn","zone":"staging"}} as const;
const IN_STAGING = {"kind":"sourceIn","zone":"staging"} as const;
const MY_CHARACTER = {"type":"character","control":"you"} as const;
const PHASE_QUEST = {"kind":"phase","is":"Quest"} as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 142040 The Long Dark of Moria. Setup: the piles set the Balrog, the Great Bridge and Chamber of Mazarbul aside and put Doom, Doom, Doom in the
  // staging area; this record (rules/families/quest/setup.ts runs it) places its 10 damage tokens and has each player add a different location, found in
  // the encounter deck, which the encounter deck is shuffled after. 1B: each optional engagement takes a damage token off Doom, Doom, Doom.
  {"id":"142040:setup:1","cardCode":"142040","lines":["142040:A:1"],"timing":"setup","instructions":[{"verb":"PlaceDamageOn","code":DOOM,"amount":10},{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","type":"location","to":"staging","different":true}]},{"verb":"ShuffleEncounterDeck"}]},
  {"id":"142040:forced:1","cardCode":"142040","lines":["142040:B:1"],"timing":"forced","trigger":"optionallyEngaged","instructions":[{"verb":"RemoveDamageFrom","code":DOOM,"amount":1}]},

  // 142041 Drums in the Deep. With no enemy in the staging area when the quest phase begins the first player reveals one more card (the Balrog, though
  // it is considered engaged, is in the staging area); the stage cannot be defeated without 3 resource tokens for each player on it, one placed for
  // each enemy defeated.
  {"id":"142041:forced:1","cardCode":"142041","lines":["142041:B:1"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"all","conditions":[PHASE_QUEST,{"kind":"count","pick":{"type":"enemy","control":"any","stagingOnly":true},"max":0}]},"instructions":[{"verb":"RevealMore","amount":1}]},
  {"id":"142041:constant:1","cardCode":"142041","lines":["142041:B:2"],"timing":"constant","condition":{"kind":"not","condition":{"kind":"tokens","code":"142041","min":3,"perPlayer":true}},"instructions":[{"verb":"Restrict","what":"advance"}]},
  {"id":"142041:forced:2","cardCode":"142041","lines":["142041:B:3"],"timing":"forced","trigger":"enemyDestroyed","instructions":[{"verb":"PlaceToken","amount":1}]},

  // 142042 The Bridge of Khazad-dûm. 3A: the Great Bridge joins the staging area, then each player in turn reveals a card and removes a damage token from
  // Doom, Doom, Doom. 3B: at most 5 progress on the stage each round (the active location still takes its share first); the stage cannot be defeated while
  // the Great Bridge is in play; defeating it wins the game (rr.winning-the-game: the last stage, nothing to run).
  {"id":"142042:whenRevealed:1","cardCode":"142042","lines":["142042:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AddSetAsideToStaging","code":BRIDGE},{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"RevealEncounter"},{"verb":"RemoveDamageFrom","code":DOOM,"amount":1}]}]},
  {"id":"142042:constant:1","cardCode":"142042","lines":["142042:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"questProgressCap","amount":5,"until":"whileSourceInPlay","target":"table"}]},
  {"id":"142042:constant:2","cardCode":"142042","lines":["142042:B:2"],"timing":"constant","condition":{"kind":"inPlay","code":BRIDGE,"is":true},"instructions":[{"verb":"Restrict","what":"advance"}]},
  {"id":"142042:constant:3","cardCode":"142042","lines":["142042:B:3"],"timing":"constant","instructions":[]},

  // 142043 Doom, Doom, Doom. At the end of the quest phase a token comes off, the Balrog joins the staging area when none is left, and the Balrog, if in
  // play, attacks the first player (it is considered engaged with them).
  {"id":"142043:forced:1","cardCode":"142043","lines":["142043:A:1"],"timing":"forced","trigger":"endOfPhase","condition":PHASE_QUEST,"instructions":[{"verb":"RemoveDamageFrom","code":DOOM,"amount":1},{"verb":"AddSetAsideToStaging","code":BALROG,"when":{"kind":"damageHere","max":0}}]},
  {"id":"142043:forced:2","cardCode":"142043","lines":["142043:A:2"],"timing":"forced","trigger":"endOfPhase","condition":PHASE_QUEST,"instructions":[{"verb":"Pick","pick":BALROG_IN_STAGING},{"verb":"AttackFromStaging","who":"firstPlayer"}]},

  // 142044 The Balrog (Indestructible is a keyword). Nobody engages it, it is immune to player card effects with the shadow cards dealt to it, it stays in the
  // staging area but is considered engaged with the first player (adds no Threat there), and only the first player declares attackers against it.
  {"id":"142044:constant:1","cardCode":"142044","lines":["142044:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotBeOptionallyEngaged","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"immuneToPlayerCards","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"shadowsImmune","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"142044:constant:2","cardCode":"142044","lines":["142044:A:2"],"timing":"constant","condition":IN_STAGING,"instructions":[{"verb":"ModifyStat","stat":"engagedWithFirst","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"cannotBeEngaged","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"noThreatContribution","amount":1,"until":"whileSourceInPlay"}]},

  // 142045 Orc-chieftain: no attachments, no ally defends against it; it engages the first player at the beginning of each encounter phase.
  {"id":"142045:constant:1","cardCode":"142045","lines":["142045:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay"},{"verb":"Restrict","what":"defend","allies":true}]},
  {"id":"142045:forced:1","cardCode":"142045","lines":["142045:A:2"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"phase","is":"Encounter"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Engage","target":"self","when":{"kind":"firstPlayer"}}]}]},

  // 142046 Great Cave-troll prints the same two lines as the Cave-troll of The Caves of Nibin-Dûm (41030): no attachments, and the excess of its combat damage
  // takes that much progress off the quest.
  ...reprint(CAVES, "41030", "142046"),

  // 142047 Uruk from Mordor. It makes an attack against the first player as it is revealed, from the staging area. The Shadow adds 1 Attack, and the
  // attacker attacks again when the attack destroyed a character.
  {"id":"142047:whenRevealed:1","cardCode":"142047","lines":["142047:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AttackFromStaging","target":"self","who":"firstPlayer"}]},

  // 142048 Moria Orc: the revealing player removes a damage token from Doom, Doom, Doom or reveals one more card; the Shadow raises the defender's threat
  // by the enemies engaged with them.
  {"id":"142048:whenRevealed:1","cardCode":"142048","lines":["142048:A:1"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"doom","instructions":[{"verb":"RemoveDamageFrom","code":DOOM,"amount":1}]},{"id":"reveal","instructions":[{"verb":"RevealEncounter"}]}]}]},
  {"id":"142048:shadow:1","cardCode":"142048","lines":["142048:A:2"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"who":"actor"}]},

  // 142049 Moria Archer (Peril and Archery 2 are keywords). X is the number of players: the revealing player assigns X damage among their characters.
  {"id":"142049:whenRevealed:1","cardCode":"142049","lines":["142049:A:2","142049:A:3"],"timing":"whenRevealed","instructions":[{"verb":"AssignDamage","amount":{"players":true},"pick":MY_CHARACTER}]},

  // 142050 The Great Bridge (immune is a keyword). Once explored, any player may discard a hero to deal X damage (the hero's threat cost) to the Balrog, which
  // then loses all keywords; the response is offered only while the Balrog is in play, so no hero is given up for nothing.
  {"id":"142050:response:1","cardCode":"142050","lines":["142050:A:2"],"timing":"response","trigger":"leftPlay","subject":"self","anyPlayer":true,"condition":{"kind":"all","conditions":[{"kind":"subjectExplored"},{"kind":"inPlay","code":BALROG,"is":true}]},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"SacrificeForDamage","code":BALROG}]},

  // 142051 Chamber of Mazarbul (immune is a keyword). The players cannot advance while it is in play. Travel: each player finds a different enemy in the encounter
  // deck or discard pile and adds it to the staging area; the first search must take Orc-chieftain while one of them holds it.
  {"id":"142051:constant:1","cardCode":"142051","lines":["142051:A:2"],"timing":"constant","instructions":[{"verb":"Restrict","what":"advance"}]},
  {"id":"142051:travel:1","cardCode":"142051","lines":["142051:A:3"],"timing":"travel","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"SearchMove","type":"enemy","to":"staging","different":true,"require":CHIEFTAIN}]},{"verb":"ShuffleEncounterDeck"}]},

  // 142052 Mines of Moria: in the staging area, progress goes on it before the quest; the Shadow discards one non-objective attachment of the defending player, two
  // when their threat is 35 or more.
  {"id":"142052:constant:1","cardCode":"142052","lines":["142052:A:1"],"timing":"constant","condition":IN_STAGING,"instructions":[{"verb":"ModifyStat","stat":"progressFirstRequired","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"142052:shadow:1","cardCode":"142052","lines":["142052:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you","nonObjective":true}},{"verb":"DiscardPicked"},{"verb":"Pick","pick":{"type":"attachment","control":"you","nonObjective":true},"when":THREAT_35},{"verb":"DiscardPicked","when":THREAT_35}]},

  // 142053 Many-pillared Hall: +1 Threat for each one in play (itself too); the Shadow adds 1 Attack, 2 when the defending player's threat is 35 or more.
  {"id":"142053:constant:1","cardCode":"142053","lines":["142053:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threat","amount":{"count":{"type":"location","control":"any","names":["Many-pillared Hall"]}},"until":"whileSourceInPlay"}]},

  // 142054 Darkened Stairway: explored, the top card of the encounter deck is discarded, and a location goes to the staging area.
  {"id":"142054:forced:1","cardCode":"142054","lines":["142054:A:1"],"timing":"forced","trigger":"leftPlay","subject":"self","condition":{"kind":"subjectExplored"},"instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"MoveEncounterCard","card":"picked","to":"staging","when":{"kind":"matches","card":"picked","pick":{"type":"location","control":"any"}}}]},

  // 142055 Ancient Guardroom: while active, every enemy in play gets -1 Attack. Travel: the top card of the encounter deck is discarded and each player raises their
  // threat by its Threat.
  {"id":"142055:constant:1","cardCode":"142055","lines":["142055:A:1"],"timing":"constant","condition":{"kind":"sourceIn","zone":"activeLocation"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":-1,"until":"whileSourceInPlay","target":"enemies"}]},
  {"id":"142055:travel:1","cardCode":"142055","lines":["142055:A:2"],"timing":"travel","instructions":[{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"RaiseThreat","amount":{"stat":"threat","of":"discardTop"},"who":"eachSeat"}]},

  // 142056 They Are Coming! (Doomed 2 is a keyword): the discard pile goes back into the deck, then one enemy for each player is discarded from the top and
  // added to the staging area.
  {"id":"142056:whenRevealed:1","cardCode":"142056","lines":["142056:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ShuffleEncounterDiscard"},{"verb":"DiscardUntilEnemies","perPlayer":1,"to":"staging"}]},

  // 142057 We Cannot Get Out: each player assigns damage for each of their exhausted characters; the Shadow, for each enemy engaged with the defender.
  {"id":"142057:whenRevealed:1","cardCode":"142057","lines":["142057:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"AssignDamage","amount":{"count":{"type":"character","control":"you","state":"exhausted"}},"pick":MY_CHARACTER}]}]},
  {"id":"142057:shadow:1","cardCode":"142057","lines":["142057:A:2"],"timing":"shadow","instructions":[{"verb":"AssignDamage","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"pick":MY_CHARACTER}]},

  // 142058 Deep Fissure (Peril is a keyword): a committed character of the revealing player leaves the quest, the top card of the encounter deck is discarded, and the
  // character is discarded when its printed Willpower is below the card's Threat.
  {"id":"142058:whenRevealed:1","cardCode":"142058","lines":["142058:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","committed":true}},{"verb":"RemoveFromQuest"},{"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"Discard","target":{"kind":"previous"},"when":{"kind":"less","left":{"stat":"willpower","of":"previous","printed":true},"right":{"stat":"threat","of":"discardTop"}}}]},

  // 142059 Fool of a Took! (Doomed 1 is a keyword): remove a damage token from Doom, Doom, Doom, or the Balrog, if in play, attacks the first player; the Shadow
  // reveals a card when the attack destroyed a character.
  {"id":"142059:whenRevealed:1","cardCode":"142059","lines":["142059:A:2"],"timing":"whenRevealed","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"doom","instructions":[{"verb":"RemoveDamageFrom","code":DOOM,"amount":1}]},{"id":"balrog","requires":{"kind":"inPlay","code":BALROG,"is":true},"instructions":[{"verb":"Pick","pick":BALROG_IN_STAGING},{"verb":"AttackFromStaging","who":"firstPlayer"}]}]}]},
  {"id":"142059:shadow:1","cardCode":"142059","lines":["142059:A:3"],"timing":"shadow","instructions":[{"verb":"AfterAttack","instructions":[{"verb":"RevealEncounter","when":{"kind":"x","min":1}}]}]},

  // 142085 Shadow of Fear (Doomed 1 and Surge are keywords): every character in play is blank until the end of the round; the Shadow takes the defender's Defense away
  // (as 01086:A:2).
  {"id":"142085:whenRevealed:1","cardCode":"142085","lines":["142085:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"blankText","amount":1,"until":"endOfRound","holders":{"type":"character","control":"any"}}]},
  {"id":"142085:shadow:1","cardCode":"142085","lines":["142085:A:3"],"timing":"shadow","instructions":[{"verb":"ModifyStat","stat":"defense","amount":{"stat":"defense","of":"defender","negative":true},"until":"endOfAttack","target":"defender"}]},

  // 142086 Pursued by the Enemy (Doomed 1 and Surge are keywords): each enemy engaged with a player attacks (the Balrog, in the staging area, does not).
  {"id":"142086:whenRevealed:1","cardCode":"142086","lines":["142086:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ImmediateAttackEach"}]},

  // 142087 Overcome by Grief, a burden objective dealt to the staging area. After a character is destroyed it attaches to a hero (the first player chooses); attached
  // it counts as a Condition attachment, and after a character its hero's player controls is destroyed it exhausts the hero, which cannot ready that round.
  {"id":"142087:forced:1","cardCode":"142087","lines":["142087:A:2"],"timing":"forced","trigger":"characterDestroyed","condition":IN_STAGING,"instructions":[{"verb":"AttachSelf","to":{"kind":"hero","control":"any"}}]},
  {"id":"142087:constant:1","cardCode":"142087","lines":["142087:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  {"id":"142087:forced:2","cardCode":"142087","lines":["142087:A:2"],"timing":"forced","trigger":"characterDestroyed","subject":{"type":"character","control":"any","controlledBy":"host"},"condition":NOT_IN_STAGING,"instructions":[{"verb":"Exhaust","target":{"kind":"ref","ref":"host"}},{"verb":"ModifyStat","stat":"cannotReady","amount":1,"until":"endOfRound","target":"host"}]},

  // 142088 Grievous Wound, a burden objective dealt to the staging area. After a hero takes damage it attaches to that hero; attached it counts as a Condition
  // attachment, and after the attached hero exhausts it deals 1 damage to it.
  {"id":"142088:forced:1","cardCode":"142088","lines":["142088:A:2"],"timing":"forced","trigger":"damaged","subject":{"type":"hero","control":"any"},"condition":IN_STAGING,"instructions":[{"verb":"AttachToSubject"}]},
  {"id":"142088:constant:1","cardCode":"142088","lines":["142088:A:2"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  {"id":"142088:forced:2","cardCode":"142088","lines":["142088:A:2"],"timing":"forced","trigger":"exhausted","subject":"host","condition":NOT_IN_STAGING,"instructions":[{"verb":"DamageCard","amount":1,"target":"host"}]},
];

// The played goldens store this shape of "Cannot have attachments." (the card as target); the generated twin writes it without a target.
export const AUTHORED_REPLACES: readonly string[] = ["142046:constant:1"];
