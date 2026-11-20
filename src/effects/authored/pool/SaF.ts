import type { Effect } from "../../../catalog/boundary.ts";

// Records for the SaF player cards whose lines no template reads (data/cards/SaF.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 04129 We Are Not Idle. X is chosen from 0 to the ready Dwarf heroes the player controls (rr.the-letter-x): with X = 0 no hero
  // exhausts and the card still draws 1. The X resources go to any hero ("a hero's resource pool"); with X = 0 none is picked.
  {"id":"04129:action:1","cardCode":"04129","lines":["04129:A:1"],"timing":"action","instructions":[
    {"verb":"ChooseX","min":0,"max":[{"count":{"type":"hero","control":"you","trait":"Dwarf","state":"ready"}}]},
    {"verb":"Repeat","times":{"x":true},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","trait":"Dwarf","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}}]},
    {"verb":"Pick","pick":{"type":"hero","control":"any"},"when":{"kind":"less","left":0,"right":{"x":true}}},
    {"verb":"AddResources","amount":{"x":true},"to":"picked","when":{"kind":"less","left":0,"right":{"x":true}}},
    {"verb":"Draw","amount":1}]},
  // 04130 Hardy Leadership (line 1 is the generated 04130:constant:1). "Each Dwarf": every Dwarf character in play.
  {"id":"04130:constant:2","cardCode":"04130","lines":["04130:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"any","trait":"Dwarf"}}]},
  // 04133 Miruvor (line 1 is the generated 04133:constant:1). Two of the four, then Miruvor goes to the discard pile, or to the
  // top of the deck when that is one of the two. The discard comes last: once Miruvor leaves play it has no attached hero.
  {"id":"04133:action:1","cardCode":"04133","lines":["04133:A:2"],"timing":"action","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"ready+resource","instructions":[{"verb":"Ready","target":"host"},{"verb":"AddResources","amount":1,"to":"host"},{"verb":"Discard","target":{"kind":"self"}}]},
    {"id":"ready+willpower","instructions":[{"verb":"Ready","target":"host"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","target":"host"},{"verb":"Discard","target":{"kind":"self"}}]},
    {"id":"ready+deck","instructions":[{"verb":"Ready","target":"host"},{"verb":"PutOnDeck","position":"top","target":"self"}]},
    {"id":"resource+willpower","instructions":[{"verb":"AddResources","amount":1,"to":"host"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","target":"host"},{"verb":"Discard","target":{"kind":"self"}}]},
    {"id":"resource+deck","instructions":[{"verb":"AddResources","amount":1,"to":"host"},{"verb":"PutOnDeck","position":"top","target":"self"}]},
    {"id":"willpower+deck","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound","target":"host"},{"verb":"PutOnDeck","position":"top","target":"self"}]}]}]},
  // 04134 Master of the Forge
  {"id":"04134:action:1","cardCode":"04134","lines":["04134:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":5,"cardType":"attachment"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 04135 Peace, and Thought
  {"id":"04135:action:1","cardCode":"04135","lines":["04135:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Refresh"},{"kind":"count","pick":{"type":"hero","control":"you","state":"ready"},"min":2}]},"instructions":[
    {"verb":"Pick","pick":{"type":"hero","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"Pick","pick":{"type":"hero","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"Draw","amount":5}]},
  // 04137 Vilya: "Attach to Elrond" is any Elrond character (the hero 04128, the ally 142005).
  {"id":"04137:constant:1","cardCode":"04137","lines":["04137:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"character","name":"Elrond"}},{"verb":"GrantIcon","sphere":"spirit"}]},
];

export const REPLACES: readonly string[] = [];
