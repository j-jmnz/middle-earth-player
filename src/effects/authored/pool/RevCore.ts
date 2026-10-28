import type { Effect } from "../../../catalog/boundary.ts";

// Records for the Revised Core Set boons and burdens whose lines no template reads (data/cards/RevCore.json): the Passage Through
// Mirkwood cards 01132 to 01137 and the Journey Along the Anduin ones, Valor and Scarred (01133, 01138; the Escape from Dol Guldur ones are
// written with their scenario).
// An id here that a template also produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 01132 Mendor's Support (boon). "Only one copy ... each round" is the play restriction every other copy shares (19086:constant:1).
  {"id":"01132:constant:1","cardCode":"01132","lines":["01132:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"copiesPlayedThisRound","max":0}}]},
  {"id":"01132:action:1","cardCode":"01132","lines":["01132:A:2"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"character","control":"any","names":["Mendor"]}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"any","names":["Mendor"]}},{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfRound","target":"picked"},{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfRound","target":"picked"},{"verb":"ModifyStat","stat":"defense","amount":2,"until":"endOfRound","target":"picked"}]},
  // 01135 Mendor (objective ally). The first player controls him (the saga heroes' pattern), a defeated quest card readies him and draws a card
  // for each player, and he leaves the game when he leaves play (01129:A:3 loses the game before that matters in this scenario).
  {"id":"01135:constant:1","cardCode":"01135","lines":["01135:A:2"],"timing":"constant","instructions":[{"verb":"ControlledBy","who":"firstPlayer","card":"self"}]},
  {"id":"01135:response:1","cardCode":"01135","lines":["01135:A:3"],"timing":"response","trigger":"questCardDefeated","subject":{"type":"card","control":"any"},"instructions":[{"verb":"Ready","target":"self"},{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Draw","amount":1}]}]},
  {"id":"01135:triggered:1","cardCode":"01135","lines":["01135:A:4"],"timing":"triggered","trigger":"leftPlay","subject":"self","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"removed"}]},
  // 01136 Ungoliant's Swarm (burden enemy): the engaged player exhausts 2 characters; as a Shadow card it comes into play engaged with the defender.
  {"id":"01136:forced:1","cardCode":"01136","lines":["01136:A:1"],"timing":"forced","trigger":"engaged","subject":"self","instructions":[{"verb":"Repeat","times":2,"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]}]},
  {"id":"01136:shadow:1","cardCode":"01136","lines":["01136:A:2"],"timing":"shadow","instructions":[{"verb":"MoveEncounterCard","card":"self","to":"engaged"}]},
  // 01137 Lingering Venom (burden treachery): each player chooses between exhausting every damaged character and 2 damage on the most damaged hero.
  {"id":"01137:whenRevealed:1","cardCode":"01137","lines":["01137:A:2"],"timing":"whenRevealed","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[{"id":"exhaust","instructions":[{"verb":"ExhaustEach","pick":{"type":"character","control":"you","damaged":true}}]},{"id":"damage","instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","mostDamaged":true}},{"verb":"DamageCard","amount":2,"target":"picked"}]}]}]}]},
  {"id":"01137:shadow:1","cardCode":"01137","lines":["01137:A:3"],"timing":"shadow","instructions":[{"verb":"ExhaustEach","pick":{"type":"character","control":"you","damaged":true}}]},
  // 01133 Valor (boon, attached to a hero by 01130's Response): Permanent, Limit 1 per hero. When its hero is declared as an attacker it may exhaust
  // Valor to heal 1 damage from the hero and deal 1 damage to the enemy it attacks.
  {"id":"01133:constant:1","cardCode":"01133","lines":["01133:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"},"limitPerHost":true}]},
  {"id":"01133:response:1","cardCode":"01133","lines":["01133:A:2"],"timing":"response","trigger":"declaredAttacker","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Heal","amount":1,"target":"host"},{"verb":"DamageCard","amount":1,"target":"other"}]},
  // 01138 Scarred (burden, attached to a hero by 01130's Forced effect): Permanent, Limit 1 per hero. When a character its controller controls is destroyed, that player raises threat by 1.
  {"id":"01138:constant:1","cardCode":"01138","lines":["01138:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"},"limitPerHost":true}]},
  {"id":"01138:forced:1","cardCode":"01138","lines":["01138:A:2"],"timing":"forced","trigger":"characterDestroyed","subject":{"type":"character","control":"you"},"instructions":[{"verb":"RaiseThreat","amount":1,"who":"actor"}]},
];

export const REPLACES: readonly string[] = [];
