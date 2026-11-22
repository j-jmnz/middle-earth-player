import type { Effect } from "../../../catalog/boundary.ts";

// Records for the VoI player cards whose lines no template reads (data/cards/VoI.json). An id here that a template also
// produces replaces the generated record; list it in REPLACES.
//
// "After you raise your threat from the Doomed keyword": Doomed X makes each player raise their threat when a card with it
// is played (rr.doomed-x), and the engine raises it exactly where it announces `played` (planning.ts playCard). So the
// trigger is a card with the printed doomed keyword being played, by any player.
export const RECORDS: readonly Effect[] = [
  // 07001 Éomer
  {"id":"07001:response:1","cardCode":"07001","lines":["07001:A:1"],"timing":"response","trigger":"leftPlay","subject":{"type":"character","control":"any"},"limit":"oncePerRound","instructions":[{"verb":"ModifyStat","stat":"attack","amount":2,"until":"endOfRound"}]},
  // 07004 Orthanc Guard
  {"id":"07004:response:1","cardCode":"07004","lines":["07004:A:1"],"timing":"response","trigger":"doomedRaised","eventSeat":"you","instructions":[{"verb":"Ready"}]},
  // 07005 Isengard Messenger
  {"id":"07005:response:1","cardCode":"07005","lines":["07005:A:1"],"timing":"response","trigger":"doomedRaised","eventSeat":"you","limit":"twicePerRound","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound"}]},
  // 07006 Westfold Outrider. An enemy not engaged with you is in the staging area or engaged with another player.
  {"id":"07006:action:1","cardCode":"07006","lines":["07006:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"any","conditions":[{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}}]},"instructions":[
    {"verb":"Choose","who":"actor","options":[
      {"id":"staging","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true}},{"verb":"Engage","target":"picked"}]},
      {"id":"otherPlayer","requires":{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"other"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"other"}},{"verb":"Engage","target":"picked"}]}]}]},
  // 07007 Westfold Horse-breeder
  {"id":"07007:response:1","cardCode":"07007","lines":["07007:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","top":10,"cardType":"attachment","trait":"Mount"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
  // 07008 Rohan Warhorse
  {"id":"07008:constant:1","cardCode":"07008","lines":["07008:A:1"],"timing":"constant","instructions":[{"verb":"AttachesTo","hosts":[{"type":"hero","control":"any","spheres":["tactics"]},{"type":"hero","control":"any","trait":"Rohan"}]}]},
  {"id":"07008:response:1","cardCode":"07008","lines":["07008:A:2"],"timing":"response","trigger":"attackDestroyed","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Ready","target":"host"}]},
  // 07010 Keys of Orthanc (line 1 is the generated 07010:constant:1)
  {"id":"07010:response:1","cardCode":"07010","lines":["07010:A:2"],"timing":"response","trigger":"doomedRaised","eventSeat":"you","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"AddResources","amount":1,"to":"host"}]},
  // 07011 Legacy of Númenor (line 1 is Doomed)
  {"id":"07011:action:1","cardCode":"07011","lines":["07011:A:2"],"timing":"action","instructions":[{"verb":"Each","pick":{"type":"hero","control":"any"},"instructions":[{"verb":"AddResources","amount":1,"to":"picked"}]}]},
  // 07012 Deep Knowledge (line 1 is Doomed)
  {"id":"07012:action:1","cardCode":"07012","lines":["07012:A:2"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Draw","amount":2}]}]},
  // 07013 The Wizard's Voice (line 1 is Doomed)
  {"id":"07013:action:1","cardCode":"07013","lines":["07013:A:2"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"BarAttack","until":"endOfPhase"}]}]},
  // 07014 Power of Orthanc (line 1 is Doomed). Discard, not DiscardPicked: an encounter Condition has no owner's pile.
  {"id":"07014:action:1","cardCode":"07014","lines":["07014:A:2"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"discard","requires":{"kind":"canPick","pick":{"type":"attachment","control":"any","trait":"Condition"}},"instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"any","trait":"Condition"}},{"verb":"Discard","target":{"kind":"picked"}}]},
    {"id":"skip","instructions":[]}]}]}]},
  // 07015 The Seeing-stone (line 1 is Doomed)
  {"id":"07015:action:1","cardCode":"07015","lines":["07015:A:2"],"timing":"action","instructions":[{"verb":"Pick","pick":{"type":"card","control":"you","from":"deck","keyword":"doomed"}},{"verb":"MovePicked","to":"hand"},{"verb":"ShuffleDeck"}]},
];

export const REPLACES: readonly string[] = [];
