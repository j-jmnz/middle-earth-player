import type { Effect } from "../../../catalog/boundary.ts";

// Records for the TSF player cards whose lines no template reads (data/cards/TSF.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 06002 Warrior of Lossarnach
  {"id":"06002:constant:1","cardCode":"06002","lines":["06002:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","trait":"Outlands"}}]},
  // 06004 Knights of the Swan
  {"id":"06004:constant:1","cardCode":"06004","lines":["06004:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","trait":"Outlands"}}]},
  // 06005 Gondorian Shield. "Limit 1 per hero" is its own printed line, and the engine reads one AttachesTo per card, so the
  // host rule and the limit are one record (it replaces the generated 06005:constant:1).
  {"id":"06005:constant:1","cardCode":"06005","lines":["06005:A:1","06005:A:2"],"timing":"constant","instructions":[{"verb":"AttachesTo","host":{"kind":"hero"},"limitPerHost":true}]},
  {"id":"06005:constant:2","cardCode":"06005","lines":["06005:A:3"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"defense","amount":1,"until":"whileSourceInPlay","target":"host","when":{"kind":"not","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","trait":"Gondor"}}}},
    {"verb":"ModifyStat","stat":"defense","amount":2,"until":"whileSourceInPlay","target":"host","when":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","trait":"Gondor"}}}]},
  // 06006 Ethir Swordsman
  {"id":"06006:constant:1","cardCode":"06006","lines":["06006:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","trait":"Outlands"}}]},
  // 06007 Ring of Barahir (lines 1 and 3 are the generated 06007:constant:1 and :2). It is an Artifact, so it counts itself.
  {"id":"06007:constant:3","cardCode":"06007","lines":["06007:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":{"count":{"type":"attachment","control":"any","attachedTo":"host","trait":"Artifact"}},"until":"whileSourceInPlay","target":"host"}]},
  // 06008 Anfalas Herdsman
  {"id":"06008:constant:1","cardCode":"06008","lines":["06008:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"hitPoints","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","trait":"Outlands"}}]},
  // 06009 Mithrandir's Advice: with no such hero it would draw nothing, so it cannot be played (rr.cost).
  {"id":"06009:action:1","cardCode":"06009","lines":["06009:A:1"],"timing":"action","condition":{"kind":"count","pick":{"type":"hero","control":"you","printedIcon":"lore"},"min":1},"instructions":[{"verb":"Draw","amount":{"count":{"type":"hero","control":"you","printedIcon":"lore"}}}]},
];

export const REPLACES: readonly string[] = [
  // Gondorian Shield: the generated host record without line 2's "Limit 1 per hero".
  "06005:constant:1",
];
