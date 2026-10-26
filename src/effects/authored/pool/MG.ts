import type { Effect } from "../../../catalog/boundary.ts";

// Records for the MG player cards whose lines no template reads (data/cards/MG.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 19113 Greenwood Defender
  {"id":"19113:response:1","cardCode":"19113","lines":["19113:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"ModifyStat","stat":"noExhaustDefend","amount":1,"until":"endOfRound","target":"self"}]},
  // 19114 Elf Guide: returning the Silvan ally is the cost.
  {"id":"19114:action:1","cardCode":"19114","lines":["19114:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand","target":"picked"},{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"AddResources","amount":1,"to":"picked"}]},
  // 19117 Sting (line 1, Guarded, is no longer open). Line 4 answers two events: declared as an attacker, declared as a defender.
  {"id":"19117:constant:2","cardCode":"19117","lines":["19117:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  {"id":"19117:response:1","cardCode":"19117","lines":["19117:A:4"],"timing":"response","trigger":"declaredAttacker","subject":"host","instructions":[{"verb":"DamageCard","amount":1,"target":"other"}]},
  {"id":"19117:response:2","cardCode":"19117","lines":["19117:A:4"],"timing":"response","trigger":"declaredDefender","subject":"host","instructions":[{"verb":"DamageCard","amount":1,"target":"other"}]},
  // 19118 Round Shield: the shadow effect has just triggered in an enemy attack.
  {"id":"19118:response:1","cardCode":"19118","lines":["19118:A:2"],"timing":"response","trigger":"shadowPending","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ModifyStat","stat":"defense","amount":2,"until":"endOfAttack","target":"host"}]},
  // 19120 Armor of Erebor
  {"id":"19120:constant:1","cardCode":"19120","lines":["19120:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character"},"hosts":[{"type":"character","control":"any","traits":["Dale","Dwarf"]}]}]},
  {"id":"19120:constant:2","cardCode":"19120","lines":["19120:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"sentinel","amount":1,"until":"whileSourceInPlay","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
