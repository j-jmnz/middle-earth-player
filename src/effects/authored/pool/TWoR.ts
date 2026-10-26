import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TWoR player cards whose lines no template reads (data/cards/TWoR.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 18001 Brand son of Bain (line 2 is no longer open)
  {"id":"18001:constant:1","cardCode":"18001","lines":["18001:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","trait":"Dale","hasAttachment":{"playerCard":true}}}]},
  // 18003 Redwater Sentry (line 1 is no longer open)
  {"id":"18003:constant:2","cardCode":"18003","lines":["18003:A:2"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","hasAttachment":{"trait":"Armor"}}},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay"}]},
  // 18004 North Realm Lookout
  {"id":"18004:constant:1","cardCode":"18004","lines":["18004:A:1"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","hasAttachment":{"trait":"Item"}}},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"}]},
  // 18005 Warrior of Dale (line 1 is no longer open)
  {"id":"18005:constant:2","cardCode":"18005","lines":["18005:A:2"],"timing":"constant","condition":{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","hasAttachment":{"trait":"Weapon"}}},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"ranged","amount":1,"until":"whileSourceInPlay"}]},
  // 18006 Long Lake Trader. An attachment is controlled by the controller of the card it is attached to (rr.attachment-cards),
  // so "an Item attachment from a character you control" is an Item attachment you control. The new host is any card the
  // attachment may be attached to.
  {"id":"18006:action:1","cardCode":"18006","lines":["18006:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"attachment","control":"you","trait":"Item"}},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you","trait":"Item"}},{"verb":"Pick","pick":{"type":"character","control":"any","hostForPicked":true}},{"verb":"AttachPicked"}]},
  // 18007 Hauberk of Mail
  {"id":"18007:constant:1","cardCode":"18007","lines":["18007:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Dale","Warrior"]}],"limitPerHost":true}]},
  {"id":"18007:constant:2","cardCode":"18007","lines":["18007:A:2"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"},
    {"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","keyword":"sentinel"}}}]},
  // 18008 King of Dale (line 2 is no longer open)
  {"id":"18008:constant:1","cardCode":"18008","lines":["18008:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","traits":["Dale","Esgaroth"]}]}]},
  // 18009 Bow of Yew (line 2 is Restricted). The defending enemy is the enemy the attack is declared against.
  {"id":"18009:constant:1","cardCode":"18009","lines":["18009:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Dale","Warrior"]}]}]},
  {"id":"18009:response:1","cardCode":"18009","lines":["18009:A:3"],"timing":"response","trigger":"declaredAttacker","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"DamageCard","amount":1,"target":"other"}]},
  // 18010 Map of Rhovanion
  {"id":"18010:constant:1","cardCode":"18010","lines":["18010:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Dale","Scout"]}],"limitPerHost":true}]},
  {"id":"18010:response:1","cardCode":"18010","lines":["18010:A:2"],"timing":"response","trigger":"committed","subject":"host","condition":{"kind":"matches","card":"activeLocation"},"instructions":[{"verb":"PlaceProgressOn","amount":1,"target":"activeLocation"}]},
  // 18011 Necklace of Girion (line 1, Guarded, is no longer open; line 2 is the generated 18011:constant:1)
  {"id":"18011:constant:2","cardCode":"18011","lines":["18011:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"extraResource","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 18012 Traffic from Dale
  {"id":"18012:action:1","cardCode":"18012","lines":["18012:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Planning"},{"kind":"copiesPlayedThisRound","max":0},{"kind":"canPick","pick":{"type":"hero","control":"you","trait":"Dale"}}]},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","trait":"Dale"}},{"verb":"AddResources","amount":{"count":{"type":"character","control":"you","hasAttachment":{"playerCard":true}}},"to":"picked"}]},
  // 18013 To Arms!
  {"id":"18013:action:1","cardCode":"18013","lines":["18013:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"ally","control":"any","hasAttachment":{"playerCard":true}}},{"verb":"Ready","target":"picked"}]},
  // 18014 Valour of the North: one record per declaration. The enemy is the event's other card.
  {"id":"18014:response:1","cardCode":"18014","lines":["18014:A:1"],"timing":"response","trigger":"declaredAttacker","subject":{"type":"character","control":"any"},"cost":{"kind":"playEvent"},"condition":{"kind":"matches","card":"other","pick":{"type":"enemy","control":"any","hasAttachment":{}}},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"subject"},{"verb":"ModifyStat","stat":"defense","amount":3,"until":"endOfAttack","target":"subject"}]},
  {"id":"18014:response:2","cardCode":"18014","lines":["18014:A:1"],"timing":"response","trigger":"declaredDefender","subject":{"type":"character","control":"any"},"cost":{"kind":"playEvent"},"condition":{"kind":"matches","card":"other","pick":{"type":"enemy","control":"any","hasAttachment":{}}},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":3,"until":"endOfAttack","target":"subject"},{"verb":"ModifyStat","stat":"defense","amount":3,"until":"endOfAttack","target":"subject"}]},
];

export const REPLACES: readonly string[] = [];
