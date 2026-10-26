import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for constants and responses no other family takes, and the saga heroes and One Ring cards (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [
  // Healing, and Conditions: "choose a player. Heal ... each hero controlled by that player" is a Pick of a player and an Each over the
  // cards that player controls (Pick `controlledBy: "picked"`).
  // 01061 Miner of the Iron Hills: "choose and discard 1 Condition attachment from play".
  {"id":"01061:response:1","cardCode":"01061","lines":["01061:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"any","trait":"Condition"}},{"verb":"Discard","target":{"kind":"picked"}}]},
  // 01068 Beorn's Hospitality.
  {"id":"01068:action:1","cardCode":"01068","lines":["01068:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"Each","pick":{"type":"hero","control":"any","controlledBy":"picked"},"instructions":[{"verb":"Heal","all":true}]}]},
  // 02102 Silvan Tracker: the refresh phase announces each card that readies, with the phase.
  {"id":"02102:response:1","cardCode":"02102","lines":["02102:A:1"],"timing":"response","trigger":"readied","subject":{"type":"character","control":"any","trait":"Silvan"},"condition":{"kind":"phase","is":"Refresh"},"instructions":[{"verb":"Heal","amount":1,"target":"subject"}]},
  // 04083 Warden of Healing: up to 2 different damaged characters; then the controller may pay 2 Lore to ready it.
  {"id":"04083:action:1","cardCode":"04083","lines":["04083:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[
    {"verb":"Each","pick":{"type":"character","control":"any","damaged":true},"upTo":2,"instructions":[{"verb":"Heal","amount":1}]},
    {"verb":"Choose","who":"actor","options":[{"id":"ready","requires":{"kind":"resources","min":2,"sphere":"lore"},"instructions":[{"verb":"SpendResources","amount":2,"sphere":"lore"},{"verb":"Ready","target":"self"}]},{"id":"skip","instructions":[]}]}]},
  // 04128 Elrond: his own healing is quiet, so it does not answer itself.
  {"id":"04128:response:1","cardCode":"04128","lines":["04128:A:2"],"timing":"response","trigger":"healed","subject":{"type":"character","control":"any"},"instructions":[{"verb":"HealQuietly","amount":1,"target":"subject"}]},
  // 09011 Athelas: heal all damage on a character; then the controller may discard a Condition attachment from it.
  {"id":"09011:action:1","cardCode":"09011","lines":["09011:A:2"],"timing":"action","cost":[{"kind":"exhaustHost"},{"kind":"discardSelf"}],"instructions":[
    {"verb":"Pick","pick":{"type":"character","control":"any"}},{"verb":"Heal","all":true},
    {"verb":"Choose","who":"actor","options":[{"id":"discard","requires":{"kind":"canPick","pick":{"type":"attachment","control":"any","trait":"Condition","onPicked":true}},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"any","trait":"Condition","onPicked":true}},{"verb":"Discard","target":{"kind":"picked"}}]},{"id":"keep","instructions":[]}]}]},
  // 10147 Galadhrim Healer.
  {"id":"10147:response:1","cardCode":"10147","lines":["10147:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"Each","pick":{"type":"hero","control":"any","controlledBy":"picked"},"instructions":[{"verb":"Heal","amount":1}]}]},
  // 22111 Dale Messenger.
  {"id":"22111:response:1","cardCode":"22111","lines":["22111:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"Each","pick":{"type":"character","control":"any","controlledBy":"picked","hasAttachment":{"playerCard":true}},"instructions":[{"verb":"Heal","amount":1}]}]},
  // 142005 Elrond: choose one of three.
  {"id":"142005:response:1","cardCode":"142005","lines":["142005:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"heal","requires":{"kind":"canPick","pick":{"type":"hero","control":"any","damaged":true}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any","damaged":true}},{"verb":"Heal","all":true}]},
    {"id":"discard","requires":{"kind":"canPick","pick":{"type":"attachment","control":"any","trait":"Condition"}},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"any","trait":"Condition"}},{"verb":"Discard","target":{"kind":"picked"}}]},
    {"id":"draw","instructions":[{"verb":"DrawEach","amount":1}]}]}]},

  // Constants: stats counted from the table, hosts, and flags.
  // 06057 Denethor: -1 Willpower for each damaged hero you control (a negative amount).
  {"id":"06057:constant:1","cardCode":"06057","lines":["06057:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"hero","control":"you","damaged":true},"negative":true},"until":"whileSourceInPlay"}]},
  // 12064 Entangling Nets (lines 1 and 2, the trap, are the attachments family's).
  {"id":"12064:constant:2","cardCode":"12064","lines":["12064:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":-2,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"defense","amount":-2,"until":"whileSourceInPlay","target":"host"}]},
  // 02119 Eagles of the Misty Mountains: +1 Attack and Defense for each attachment facedown under it.
  {"id":"02119:constant:1","cardCode":"02119","lines":["02119:A:1"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"attack","amount":{"facedown":true},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"defense","amount":{"facedown":true},"until":"whileSourceInPlay"}]},
  // 19002 Guardian of Esgaroth: +1 to each for each different player card attachment, at most +3.
  {"id":"19002:constant:1","cardCode":"19002","lines":["19002:A:1"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"willpower","amount":{"count":{"type":"attachment","control":"any","attachedTo":"source","playerCard":true},"distinct":true,"limit":3},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"attachment","control":"any","attachedTo":"source","playerCard":true},"distinct":true,"limit":3},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"defense","amount":{"count":{"type":"attachment","control":"any","attachedTo":"source","playerCard":true},"distinct":true,"limit":3},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"hitPoints","amount":{"count":{"type":"attachment","control":"any","attachedTo":"source","playerCard":true},"distinct":true,"limit":3},"until":"whileSourceInPlay"}]},
  // 04005 Keeping Count: +1 Attack for each token another copy holds above this one.
  {"id":"04005:constant:2","cardCode":"04005","lines":["04005:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"resourcesAboveCopies":true},"until":"whileSourceInPlay","target":"host"}]},
  // 132005 Bombur counts as two when Dwarf characters are counted.
  {"id":"132005:constant:1","cardCode":"132005","lines":["132005:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"countsAsTwoDwarves","amount":1,"until":"whileSourceInPlay"}]},
  // 22027 Lothíriel gains the Rohan trait while Éomer is in play.
  {"id":"22027:constant:1","cardCode":"22027","lines":["22027:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"traitRohan","amount":1,"until":"whileSourceInPlay","when":{"kind":"count","pick":{"type":"character","control":"any","names":["Éomer"]},"min":1}}]},
  // 146012 Friend of Friends.
  {"id":"146012:constant:1","cardCode":"146012","lines":["146012:A:2"],"timing":"constant","condition":{"kind":"count","pick":{"type":"attachment","control":"any","names":["Friend of Friends"],"other":true},"min":1},"instructions":[
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 12034 Raiment of War: a Warrior host; it counts as 2 Restricted attachments.
  {"id":"12034:constant:1","cardCode":"12034","lines":["12034:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","trait":"Warrior"}},{"verb":"ModifyStat","stat":"countsAsRestricted","amount":2,"until":"whileSourceInPlay"}]},
  // 144010 Snowmane loses the restricted keyword on Théoden.
  {"id":"144010:constant:2","cardCode":"144010","lines":["144010:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"losesRestricted","amount":1,"until":"whileSourceInPlay","when":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","names":["Théoden"]}}}]},

  // The Artifacts and Master attachments of the saga.
  // 142011 Sting, 142012 Mithril Shirt.
  {"id":"142011:constant:2","cardCode":"142011","lines":["142011:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"142012:constant:2","cardCode":"142012","lines":["142012:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 142013 Glamdring: a Warrior hero or Gandalf; draws a card when its character destroys an Orc.
  {"id":"142013:constant:2","cardCode":"142013","lines":["142013:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Warrior"},{"type":"hero","control":"any","names":["Gandalf"]}]}]},
  {"id":"142013:response:1","cardCode":"142013","lines":["142013:A:3"],"timing":"response","trigger":"attackDestroyed","subject":"host","condition":{"kind":"matches","card":"other","pick":{"type":"enemy","control":"any","trait":"Orc"}},"instructions":[{"verb":"Draw","amount":1}]},
  // 142014 Andúril: a Noble hero or Aragorn, +1 Willpower, Attack and Defense.
  {"id":"142014:constant:1","cardCode":"142014","lines":["142014:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Noble"},{"type":"hero","control":"any","names":["Aragorn"]}]}]},
  {"id":"142014:constant:2","cardCode":"142014","lines":["142014:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 22009 Inner Strength, 22033 Strength and Courage, 22085 Well Preserved: they go on the hero with The One Ring (an attachment with the Ring trait).
  {"id":"22009:constant:1","cardCode":"22009","lines":["22009:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","hasAttachment":{"trait":"Ring"}}],"limitPerHost":true},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"22033:constant:1","cardCode":"22033","lines":["22033:A:1","22033:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","hasAttachment":{"trait":"Ring"}}],"limitPerHost":true},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"22033:response:1","cardCode":"22033","lines":["22033:A:3"],"timing":"response","trigger":"declaredAttacker","subject":"host","cost":[{"kind":"exhaustCode","code":"21001"},{"kind":"raiseThreat","amount":1}],"instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"stat":"attack","of":"host","printed":true},"until":"endOfAttack","target":"host"}]},
  {"id":"22085:constant:1","cardCode":"22085","lines":["22085:A:1","22085:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","hasAttachment":{"trait":"Ring"}}],"limitPerHost":true},{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 17064 The Free Peoples.
  {"id":"17064:constant:1","cardCode":"17064","lines":["17064:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"distinctTraits","min":9}}]},
  {"id":"17064:action:1","cardCode":"17064","lines":["17064:A:2"],"timing":"action","instructions":[{"verb":"Ready","target":"allCharacters"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"you"}}]},
  // 18001 Brand son of Bain: the attachment was played on a Dale character that had none before it.
  {"id":"18001:response:1","cardCode":"18001","lines":["18001:A:2"],"timing":"response","trigger":"attached","eventSeat":"you","subject":{"type":"attachment","control":"you"},"condition":{"kind":"matches","card":"other","pick":{"type":"character","control":"any","trait":"Dale","maxAttachments":1}},"instructions":[{"verb":"Draw","amount":1}]},
  // 02080 Gildor's Counsel: played in the commitment window, before any character is committed.
  {"id":"02080:constant:1","cardCode":"02080","lines":["02080:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"all","conditions":[{"kind":"step","is":"beforeStaging"},{"kind":"count","pick":{"type":"character","control":"any","committed":true},"max":0}]}}]},
  // 08010 The White Council: X is the number of players.
  {"id":"08010:constant:1","cardCode":"08010","lines":["08010:A:1"],"timing":"constant","instructions":[{"verb":"FixedX","amount":{"players":true}}]},
  // 08034 Leaf Brooch: the first event of the host's printed sphere played each round gains Secrecy 1.
  {"id":"08034:constant:2","cardCode":"08034","lines":["08034:A:2"],"timing":"constant","instructions":[{"verb":"GrantSecrecy","pick":{"type":"card","control":"you","cardType":"event"},"amount":1,"hostSphere":true,"firstEachRound":true}]},

  // Events and Actions.
  // 02058 Infighting: choose how much damage moves from one enemy to another.
  {"id":"02058:action:1","cardCode":"02058","lines":["02058:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"damaged":true}},"instructions":[
    {"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"damaged":true}},
    {"verb":"ChooseX","min":0,"max":[{"stat":"damage","of":"picked"}]},
    {"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"different":true}},
    {"verb":"MoveDamage","amount":{"x":true}}]},
  // 02073 Keen-eyed Took: each player's deck is looked at in turn.
  {"id":"02073:response:1","cardCode":"02073","lines":["02073:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"LookAtTop","deck":"own"}]}]},
  // 04105 Heavy Stroke: the same damage again.
  {"id":"04105:response:1","cardCode":"04105","lines":["04105:A:1"],"timing":"response","trigger":"attackDamaged","subject":{"type":"character","control":"any","trait":"Dwarf"},"cost":{"kind":"playEvent"},"limit":"oncePerPhase","condition":{"kind":"matches","card":"other","inPlay":true},"instructions":[{"verb":"DamageCard","amount":{"x":true},"target":"other"}]},
  // 05005 Mutual Accord.
  {"id":"05005:action:1","cardCode":"05005","lines":["05005:A:1"],"timing":"action","instructions":[
    {"verb":"Each","pick":{"type":"card","control":"any","trait":"Gondor"},"instructions":[{"verb":"ModifyStat","stat":"traitRohan","amount":1,"until":"endOfPhase","target":"picked"}]},
    {"verb":"Each","pick":{"type":"card","control":"any","trait":"Rohan"},"instructions":[{"verb":"ModifyStat","stat":"traitGondor","amount":1,"until":"endOfPhase","target":"picked"}]}]},
  // 06010 A Good Harvest: name a sphere.
  {"id":"06010:action:1","cardCode":"06010","lines":["06010:A:1"],"timing":"action","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"leadership","instructions":[{"verb":"ModifyStat","stat":"spendAsLeadership","amount":1,"until":"endOfPhase","target":"actorSeat"}]},
    {"id":"tactics","instructions":[{"verb":"ModifyStat","stat":"spendAsTactics","amount":1,"until":"endOfPhase","target":"actorSeat"}]},
    {"id":"spirit","instructions":[{"verb":"ModifyStat","stat":"spendAsSpirit","amount":1,"until":"endOfPhase","target":"actorSeat"}]},
    {"id":"lore","instructions":[{"verb":"ModifyStat","stat":"spendAsLore","amount":1,"until":"endOfPhase","target":"actorSeat"}]}]}]},
  // 06143 Hidden Cache: spend 1 resource (the player's choice of pool) to draw.
  {"id":"06143:action:1","cardCode":"06143","lines":["06143:A:2"],"timing":"action","condition":{"kind":"resources","min":1},"instructions":[{"verb":"SpendResources","amount":1},{"verb":"Draw","amount":1}]},
  // 10146 Tale of Tinúviel: exhaust one, ready the other; the exhausted character's printed Willpower is added to the other's.
  {"id":"10146:action:1","cardCode":"10146","lines":["10146:A:1"],"timing":"action","condition":{"kind":"any","conditions":[{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Noldor","state":"ready"}},{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Dúnedain","state":"ready"}}]},"instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"noldor","requires":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Noldor","state":"ready"}},{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Dúnedain"}}]},"instructions":[
      {"verb":"Pick","pick":{"type":"character","control":"any","trait":"Noldor","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"AddToX","amount":{"stat":"willpower","of":"picked","printed":true}},
      {"verb":"Pick","pick":{"type":"character","control":"any","trait":"Dúnedain"}},{"verb":"Ready","target":"picked"},
      {"verb":"ModifyStat","stat":"willpower","amount":{"x":true},"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":{"x":true},"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":{"x":true},"until":"endOfPhase","target":"picked"}]},
    {"id":"dunedain","requires":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Dúnedain","state":"ready"}},{"kind":"canPick","pick":{"type":"character","control":"any","trait":"Noldor"}}]},"instructions":[
      {"verb":"Pick","pick":{"type":"character","control":"any","trait":"Dúnedain","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"AddToX","amount":{"stat":"willpower","of":"picked","printed":true}},
      {"verb":"Pick","pick":{"type":"character","control":"any","trait":"Noldor"}},{"verb":"Ready","target":"picked"},
      {"verb":"ModifyStat","stat":"willpower","amount":{"x":true},"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":{"x":true},"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":{"x":true},"until":"endOfPhase","target":"picked"}]}]}]},
  // 11001 Círdan the Shipwright: after the resource phase's draw, discard one of the cards just drawn.
  {"id":"11001:forced:1","cardCode":"11001","lines":["11001:A:2"],"timing":"forced","trigger":"resourceDrawn","eventSeat":"you","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"hand","drawn":true}},{"verb":"DiscardPicked"}]},
  // 12061 Revealed in Wrath: a non-unique enemy's text box is blank until the end of the phase.
  {"id":"12061:action:1","cardCode":"12061","lines":["12061:A:2"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true}},{"verb":"ModifyStat","stat":"blankText","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 131012 Spare Hood and Cloak.
  {"id":"131012:action:1","cardCode":"131012","lines":["131012:A:2"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","notHost":true}},{"verb":"Ready","target":"picked"},{"verb":"AttachSourceTo","card":"picked"}]},
  // 132009 Straight Shot: exhaust a Weapon attachment to discard a non-unique enemy with 0 Defense.
  {"id":"132009:action:1","cardCode":"132009","lines":["132009:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"attachment","control":"you","trait":"Weapon","state":"ready"}},{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true,"maxDefense":0}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"attachment","control":"you","trait":"Weapon","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"nonUnique":true,"maxDefense":0}},{"verb":"Discard","target":{"kind":"picked"}}]},
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
