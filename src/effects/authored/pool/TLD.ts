import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TLD player cards whose lines no template reads (data/cards/TLD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 04076 Háma
  {"id":"04076:response:1","cardCode":"04076","lines":["04076:A:1"],"timing":"response","trigger":"declaredAttacker","subject":"self","limit":"thricePerGameGroup","condition":{"kind":"canPick","pick":{"type":"card","control":"you","from":"discard","cardType":"event","sphere":"tactics"}},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"discard","cardType":"event","sphere":"tactics"}},{"verb":"MovePicked","to":"hand"},{"verb":"DiscardFromHand","amount":1}]},
  // 04077 Erestor. Discarding the card is the cost.
  {"id":"04077:action:1","cardCode":"04077","lines":["04077:A:1"],"timing":"action","limit":"oncePerRound","condition":{"kind":"handHasCard"},"instructions":[{"verb":"DiscardFromHand","amount":1},{"verb":"Draw","amount":1}]},
  // 04078 Fresh Tracks. An enemy that players ignore for engagement checks makes none (quest.ts engagementStep).
  {"id":"04078:response:1","cardCode":"04078","lines":["04078:A:1"],"timing":"response","trigger":"addedToStaging","subject":{"type":"enemy","control":"any"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"DamageCard","amount":1,"target":"subject"},{"verb":"ModifyStat","stat":"noEngagementChecks","amount":1,"until":"endOfRound","target":"subject"}]},
  // 04079 Erebor Battle Master
  {"id":"04079:constant:1","cardCode":"04079","lines":["04079:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":{"count":{"type":"ally","control":"you","trait":"Dwarf","other":true},"limit":4},"until":"whileSourceInPlay"}]},
  // 04080 Ring Mail
  {"id":"04080:constant:1","cardCode":"04080","lines":["04080:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"character","control":"any","traits":["Dwarf","Hobbit"]}]}]},
  {"id":"04080:constant:2","cardCode":"04080","lines":["04080:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 04081 Out of Sight (line 1 is Secrecy 3). The enemies engaged with you when it resolves cannot attack this phase; an enemy
  // engaged with you attacks only you.
  {"id":"04081:action:1","cardCode":"04081","lines":["04081:A:2"],"timing":"action","condition":{"kind":"hasEngaged"},"instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"endOfPhase","holders":{"type":"enemy","control":"any","engaged":"you"}}]},
  // 04082 Ever My Heart Rises. The players travel together, so each of them travels.
  {"id":"04082:constant:1","cardCode":"04082","lines":["04082:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","trait":"Dwarf"}}]},
  {"id":"04082:response:1","cardCode":"04082","lines":["04082:A:2"],"timing":"response","trigger":"traveled","subject":{"type":"location","control":"any","traits":["Mountain","Underground"]},"instructions":[{"verb":"Ready","target":"host"},{"verb":"LowerThreat","amount":1,"who":"actor"}]},
  // 04084 Word of Command. Exhausting the Istari character is the cost.
  {"id":"04084:action:1","cardCode":"04084","lines":["04084:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"character","control":"you","trait":"Istari","state":"ready"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","trait":"Istari","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 04085 Love of Tales (line 1 is the generated 04085:constant:1). A Song card played by any player.
  {"id":"04085:response:1","cardCode":"04085","lines":["04085:A:2"],"timing":"response","trigger":"played","subject":{"type":"card","control":"any","trait":"Song"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"AddResources","amount":1,"to":"host"}]},
];

export const REPLACES: readonly string[] = [];
