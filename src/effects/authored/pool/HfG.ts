import type { Effect } from "../../../catalog/boundary.ts";

// Records for the HfG player cards whose lines no template reads (data/cards/HfG.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
export const RECORDS: readonly Effect[] = [
  // 02001 Bilbo Baggins: the extra draw is held by the first player's seat (the player filter read from the first player's side).
  {"id":"02001:constant:1","cardCode":"02001","lines":["02001:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraDraw","amount":1,"until":"whileSourceInPlay","holders":{"type":"player","control":"you","who":"firstPlayer"}}]},
  // 02002 Dúnedain Mark
  {"id":"02002:constant:2","cardCode":"02002","lines":["02002:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 02003 Campfire Tales
  {"id":"02003:action:1","cardCode":"02003","lines":["02003:A:1"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Draw","amount":1}]}]},
  // 02004 Winged Guardian
  {"id":"02004:constant:1","cardCode":"02004","lines":["02004:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveRestricted","amount":1,"until":"whileSourceInPlay"}]},
  // 02005 The Eagles Are Coming!: every Eagle card among the top 5 goes to the hand.
  {"id":"02005:action:1","cardCode":"02005","lines":["02005:A:1"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"card","control":"you","from":"deck","top":5,"trait":"Eagle"},"upTo":"any","instructions":[{"verb":"MovePicked","to":"hand"}]},{"verb":"ShuffleDeck"}]},
  // 02006 Westfold Horse-breaker
  {"id":"02006:action:1","cardCode":"02006","lines":["02006:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"any"}},{"verb":"Ready","target":"picked"}]},
  // 02007 Mustering the Rohirrim
  {"id":"02007:action:1","cardCode":"02007","lines":["02007:A:1"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":10,"cardType":"ally","trait":"Rohan"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 02008 Rivendell Minstrel
  {"id":"02008:response:1","cardCode":"02008","lines":["02008:A:1"],"timing":"response","trigger":"played","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","trait":"Song"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 02010 Song of Kings
  {"id":"02010:constant:2","cardCode":"02010","lines":["02010:A:2"],"timing":"constant","instructions":[{"verb":"GrantIcon","sphere":"leadership"}]},
];

export const REPLACES: readonly string[] = [];
