import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TitD player cards whose lines no template reads (data/cards/TitD.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 12030 Lanwyn (line 1 is Ranged). "After ... is revealed" is the window before the card's effects resolve (where The Door is
  // Closed! cancels them): the encounterRevealed event.
  {"id":"12030:response:1","cardCode":"12030","lines":["12030:A:2"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"card","control":"any","keyword":"surge"},"limit":"twicePerPhase","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"ready","requires":{"kind":"matches","card":"self","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready"}]},
    {"id":"willpower","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":2,"until":"endOfPhase"}]}]}]},
  // 12032 Captain's Wisdom
  {"id":"12032:action:1","cardCode":"12032","lines":["12032:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Resource"},{"kind":"canPick","pick":{"type":"hero","control":"you","trait":"Noble","state":"ready"}}]},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you","trait":"Noble","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"AddResources","amount":2,"to":"picked"}]},
  // 12034 Raiment of War (line 1, the host and "counts as 2 Restricted attachments", is open)
  {"id":"12034:constant:2","cardCode":"12034","lines":["12034:A:2"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"},
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host"},
    {"verb":"ModifyStat","stat":"hitPoints","amount":2,"until":"whileSourceInPlay","target":"host"}]},
  // 12035 Sam Gamgee (line 2 is open)
  {"id":"12035:constant:1","cardCode":"12035","lines":["12035:A:1"],"timing":"constant","instructions":[{"verb":"ReduceCost","amount":2,"when":{"kind":"count","pick":{"type":"character","control":"you","names":["Frodo Baggins"]},"min":1}}]},
  // 12037 Mirkwood Explorer: he quested successfully when he was committed and his controller's quest succeeded.
  {"id":"12037:response:1","cardCode":"12037","lines":["12037:A:1"],"timing":"response","trigger":"questSucceeded","eventSeat":"you","condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","committed":true}},"instructions":[{"verb":"PlaceProgressOn","amount":1,"target":"self"}]},
  // 12038 Guarded Ceaselessly
  {"id":"12038:constant:1","cardCode":"12038","lines":["12038:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"location","control":"any"}]}]},
  {"id":"12038:action:1","cardCode":"12038","lines":["12038:A:2"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"character","control":"you","traits":["Ranger","Scout"],"state":"ready"}},"instructions":[{"verb":"Pick","pick":{"type":"character","control":"you","traits":["Ranger","Scout"],"state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"ModifyStat","stat":"threat","amount":-2,"until":"endOfPhase","target":"host"}]},
];

export const REPLACES: readonly string[] = [];
