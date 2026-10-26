import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for constants and responses no other family takes, and the saga heroes and One Ring cards (docs/plans/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
export const RECORDS: readonly Effect[] = [
  // Healing, and Conditions: "choose a player. Heal ... each hero controlled by that player" is a Pick of a player and an Each over the
  // cards that player controls (Pick `controlledBy: "picked"`).
  // 01061 Miner of the Iron Hills: "choose and discard 1 Condition attachment from play".
  {"id":"01061:response:1","cardCode":"01061","lines":["01061:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"attachment","control":"any","trait":"Condition"}},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"any","trait":"Condition"}},{"verb":"Discard","target":{"kind":"picked"}}]},
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
  {"id":"142013:constant:2","cardCode":"142013","lines":["142013:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Warrior"},{"type":"character","control":"any","names":["Gandalf"]}]}]},
  {"id":"142013:response:1","cardCode":"142013","lines":["142013:A:3"],"timing":"response","trigger":"attackDestroyed","subject":"host","condition":{"kind":"matches","card":"other","pick":{"type":"enemy","control":"any","trait":"Orc"}},"instructions":[{"verb":"Draw","amount":1}]},
  // 142014 Andúril: a Noble hero or Aragorn, +1 Willpower, Attack and Defense.
  {"id":"142014:constant:1","cardCode":"142014","lines":["142014:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","trait":"Noble"},{"type":"character","control":"any","names":["Aragorn"]}]}]},
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

  // The One Ring and the Master cards (player deck).
  // 21001 The One Ring: immune to non-Master card effects; its Setup waits for the opening hands (Delay `startOfGame`), attaches it
  // to a hero its player chooses and searches the deck for a Master card; it lowers the threat elimination level by 5; the
  // players lose if it leaves play. The last two sentences of the Setup line are constant and triggered, which a line that opens
  // with "Setup:" cannot name; the unlabelled line 2 stands for them (the coverage check allows any timing there).
  {"id":"21001:constant:1","cardCode":"21001","lines":["21001:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"immuneToNonMaster","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"21001:setup:1","cardCode":"21001","lines":["21001:A:3"],"timing":"setup","instructions":[{"verb":"Delay","until":"startOfGame","instructions":[
    {"verb":"PutIntoPlay","card":"self"},
    {"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","trait":"Master"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]}]},
  {"id":"21001:constant:2","cardCode":"21001","lines":["21001:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"you"}]},{"verb":"ModifyStat","stat":"eliminationReduction","amount":5,"until":"whileSourceInPlay","target":"actorSeat"}]},
  {"id":"21001:triggered:1","cardCode":"21001","lines":["21001:A:2"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  // 21009 The Master Ring: cancel the effects of the card just revealed, discard it, reveal another.
  {"id":"21009:response:1","cardCode":"21009","lines":["21009:A:1"],"timing":"response","trigger":"encounterRevealed","cost":[{"kind":"playEvent"},{"kind":"exhaustCode","code":"21001"},{"kind":"raiseThreat","amount":1}],"instructions":[{"verb":"CancelEffect"},{"verb":"DiscardCanceled"}]},
  // 21010 The Ruling Ring (the costs are the first instructions: an event's Action does not pay its record's costs).
  {"id":"21010:action:1","cardCode":"21010","lines":["21010:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"exhausted","code":"21001","is":false},{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"you","notTraits":["Nazgûl"]}}]},"instructions":[
    {"verb":"Exhaust","target":{"kind":"byCode","code":"21001"}},{"verb":"RaiseThreat","amount":1,"who":"actor"},
    {"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you","notTraits":["Nazgûl"]}},{"verb":"PreventAttacks","target":"picked","until":"endOfPhase"}]},
  // 21011 The Ring of Power.
  {"id":"21011:action:1","cardCode":"21011","lines":["21011:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"exhausted","code":"21001","is":false},{"kind":"canPick","pick":{"type":"hero","control":"any","hasAttachment":{"trait":"Ring"}}}]},"instructions":[
    {"verb":"Exhaust","target":{"kind":"byCode","code":"21001"}},{"verb":"RaiseThreat","amount":1,"who":"actor"},
    {"verb":"Pick","pick":{"type":"hero","control":"any","hasAttachment":{"trait":"Ring"}}},{"verb":"Ready","target":"picked"},
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfPhase","target":"picked"}]},
  // 21072 Sméagol, side A: 2 copies of Stinker join the encounter deck (side B, the Gollum enemy, has no data: see the handover).
  {"id":"21072:setup:1","cardCode":"21072","lines":["21072:A:2"],"timing":"setup","instructions":[{"verb":"ShuffleIntoEncounterDeck","code":"21071"},{"verb":"ShuffleIntoEncounterDeck","code":"21071"}]},

  // The saga heroes. "The first player gains control": ControlledBy; "the players lose the game": LoseGame when the hero leaves play.
  // 131001 Bilbo Baggins (Over Hill and Under Hill).
  {"id":"131001:constant:1","cardCode":"131001","lines":["131001:A:1"],"timing":"constant","instructions":[{"verb":"ControlledBy","who":"firstPlayer","card":"self"}]},
  {"id":"131001:constant:2","cardCode":"131001","lines":["131001:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noPlayerCardResources","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"131001:triggered:1","cardCode":"131001","lines":["131001:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  // 132001 Bilbo Baggins (The Hobbit saga): not counted against the hero limit; no resources from non-treasure cards; searches for treasures.
  {"id":"132001:constant:1","cardCode":"132001","lines":["132001:A:1"],"timing":"constant","instructions":[{"verb":"Restrict","what":"heroLimit"},{"verb":"ModifyStat","stat":"noNonTreasureResources","amount":1,"until":"whileSourceInPlay"},{"verb":"ControlledBy","who":"firstPlayer","card":"self"}]},
  {"id":"132001:action:1","cardCode":"132001","lines":["132001:A:2"],"timing":"action","cost":{"kind":"resources","amount":1,"sphere":"baggins","from":"self"},"condition":{"kind":"canPick","pick":{"type":"card","control":"you","from":"deck","cardType":"treasure"}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","cardType":"treasure"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  {"id":"132001:triggered:1","cardCode":"132001","lines":["132001:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  // 131019 Burglar Baggins, 132013 The Lucky Number.
  {"id":"131019:action:1","cardCode":"131019","lines":["131019:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"hero","control":"any","names":["Bilbo Baggins"]}},"instructions":[
    {"verb":"PayFromHero","name":"Bilbo Baggins"},{"verb":"Pick","pick":{"type":"hero","control":"any","names":["Bilbo Baggins"]}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":2,"until":"endOfPhase","target":"picked"}]},
  {"id":"132013:action:1","cardCode":"132013","lines":["132013:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"count","pick":{"type":"hero","control":"any","names":["Bilbo Baggins"]},"min":1},{"kind":"canPick","pick":{"type":"character","control":"any","exceptNames":["Bilbo Baggins"]}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"character","control":"any","exceptNames":["Bilbo Baggins"]}},
    {"verb":"ModifyStat","stat":"willpower","amount":{"stat":"willpower","ofNamed":"Bilbo Baggins"},"until":"endOfPhase","target":"picked"},
    {"verb":"ModifyStat","stat":"attack","amount":{"stat":"attack","ofNamed":"Bilbo Baggins"},"until":"endOfPhase","target":"picked"},
    {"verb":"ModifyStat","stat":"defense","amount":{"stat":"defense","ofNamed":"Bilbo Baggins"},"until":"endOfPhase","target":"picked"}]},
  // 143001, 145001, 146002 Aragorn.
  {"id":"143001:constant:1","cardCode":"143001","lines":["143001:A:1"],"timing":"constant","instructions":[{"verb":"ControlledBy","who":"firstPlayer","card":"self"}]},
  {"id":"143001:triggered:1","cardCode":"143001","lines":["143001:A:1"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"145001:constant:2","cardCode":"145001","lines":["145001:A:1"],"timing":"constant","instructions":[{"verb":"ControlledBy","who":"firstPlayer","card":"self"}]},
  {"id":"145001:triggered:1","cardCode":"145001","lines":["145001:A:1"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  {"id":"146002:constant:1","cardCode":"146002","lines":["146002:A:1"],"timing":"constant","instructions":[{"verb":"ControlledBy","who":"firstPlayer","card":"self"}]},
  {"id":"146002:triggered:1","cardCode":"146002","lines":["146002:A:3"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"LoseGame"}]},
  // 142001 Frodo Baggins: exhaust The One Ring (142091) and spend a Fellowship resource when he defends; the attack deals no damage.
  {"id":"142001:response:1","cardCode":"142001","lines":["142001:A:1"],"timing":"response","trigger":"declaredDefender","subject":"self","cost":{"kind":"resources","amount":1,"sphere":"fellowship"},"condition":{"kind":"exhausted","code":"142091","is":false},"instructions":[
    {"verb":"Exhaust","target":{"kind":"byCode","code":"142091"}},{"verb":"ModifyStat","stat":"dealsNoDamage","amount":1,"until":"endOfPhase","target":"other"},{"verb":"RaiseThreat","amount":2,"who":"eachSeat"}]},
  // 144013 Speak Your Promise!: the Ring-bearer readies; the enemy's Attack and Defense drop by the Ring-bearer's Willpower above its Threat.
  {"id":"144013:action:1","cardCode":"144013","lines":["144013:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"hero","control":"any","trait":"Ring-bearer"}},{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"you"}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"hero","control":"any","trait":"Ring-bearer"}},{"verb":"Ready","target":"picked"},{"verb":"AddToX","amount":{"stat":"willpower","of":"picked"}},
    {"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you"}},{"verb":"AddToX","amount":{"stat":"threat","of":"picked","negative":true}},
    {"verb":"ModifyStat","stat":"attack","amount":{"x":true,"negative":true},"until":"endOfPhase","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":{"x":true,"negative":true},"until":"endOfPhase","target":"picked"}]},

  // Cards from the collection (hero swaps; the collection is every deck-legal hero card: families/misc-collection.ts).
  // 22090 Helm of Secrecy.
  {"id":"22090:action:1","cardCode":"22090","lines":["22090:A:2"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"hero","control":"you"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"SwapHero"}]},
  // 22146 Thorongil: another version of the host is attached to it; the host has its game text and resource icon while Thorongil is in play.
  {"id":"22146:response:1","cardCode":"22146","lines":["22146:A:2"],"timing":"response","trigger":"attached","subject":"self","eventSeat":"you","instructions":[{"verb":"AttachCollectionHero"}]},

  // 19033 Wild Stallion: a Planning Action attaches it to another ally, where it counts as a Restricted Mount attachment.
  {"id":"19033:action:1","cardCode":"19033","lines":["19033:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Planning"},{"kind":"canPick","pick":{"type":"ally","control":"you","other":true}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"ally","control":"you","other":true}},{"verb":"AttachAsMount"}]},
  {"id":"19033:constant:2","cardCode":"19033","lines":["19033:A:2"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"traitMount","amount":1,"until":"whileSourceInPlay","when":{"kind":"matches","card":"host","pick":{"type":"ally","control":"any"}}},
    {"verb":"ModifyStat","stat":"countsAsRestricted","amount":1,"until":"whileSourceInPlay","when":{"kind":"matches","card":"host","pick":{"type":"ally","control":"any"}}},
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
