import type { Condition, Effect, Instruction, SimpleInstruction } from "../../../catalog/boundary.ts";

// Authored records for the encounter deck: look, move, discard, search, cancel and replace revealed cards, reveal triggers (docs/agents/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
//
// Conventions: "look at the top card" is LookAtTop, which picks that card, so "that card" / "the looked at card" is `picked`;
// "you may ..." is a Choose with an empty option; "search the top 5 cards for an X" is PickEncounter, and "if no X enters play"
// reads whether the pick found one; "then" (rr.then) puts a `when` on what follows when the first part can fail.
const isPicked = (type: "enemy" | "location" | "treachery" | "objective") => ({ kind: "matches", card: "picked", pick: { type, control: "any" } }) as const;

// "If that card is not an enemy": a card was looked at, and it is of another encounter type.
const NOT_ENEMY: Condition = { kind: "any", conditions: [isPicked("location"), isPicked("treachery"), isPicked("objective")] };

type EncounterType = "enemy" | "location" | "treachery" | "objective";

// "Name enemy, location, or treachery": one option per type.
function named(types: readonly EncounterType[], instructions: (type: EncounterType) => SimpleInstruction[]): Instruction {
  return { verb: "Choose", who: "actor", options: types.map((type) => ({ id: type, instructions: instructions(type) })) };
}

export const RECORDS: readonly Effect[] = [
  // 01008 Eleanor: the canceled treachery goes to the discard pile, and the next card is revealed for the same player.
  {"id":"01008:response:1","cardCode":"01008","lines":["01008:A:1"],"timing":"response","trigger":"whenRevealedPending","subject":{"type":"treachery","control":"any"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"CancelEffect"},{"verb":"MoveEncounterCard","card":"subject","to":"discard"},{"verb":"RevealEncounter","who":"eventSeat"}]},
  // 01010 Denethor
  {"id":"01010:action:1","cardCode":"01010","lines":["01010:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"LookAtTop"},{"verb":"Choose","who":"actor","options":[
    {"id":"bottom","requires":{"kind":"matches","card":"picked"},"instructions":[{"verb":"MoveEncounterCard","to":"deckBottom"}]},
    {"id":"leave","instructions":[]}]}]},
  // 02009 Strider's Path: "after a location is revealed from the encounter deck" is the encounterRevealed window (as 19060).
  {"id":"02009:response:1","cardCode":"02009","lines":["02009:A:1"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"location","control":"any"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"TravelTo","target":"subject"}]},
  // 02080 Gildor's Counsel (line 1, when it may be played, is another record's).
  {"id":"02080:action:1","cardCode":"02080","lines":["02080:A:2"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"RevealFewer","amount":1,"min":1}]},
  // 02124 Rumour from the Earth: the event stays in the hand only if the Lore resource was paid.
  {"id":"02124:action:1","cardCode":"02124","lines":["02124:A:1"],"timing":"action","instructions":[{"verb":"LookAtTop"},{"verb":"Choose","who":"actor","options":[
    {"id":"return","requires":{"kind":"canPick","pick":{"type":"hero","control":"you","hasResources":true,"printedIcon":"lore"}},"instructions":[{"verb":"PayResources","amount":1,"sphere":"lore"},{"verb":"ReturnEventToHand","when":{"kind":"matches","card":"picked","pick":{"type":"hero","control":"any"}}}]},
    {"id":"discard","instructions":[]}]}]},
  // 02125 Shadow of the Past
  {"id":"02125:action:1","cardCode":"02125","lines":["02125:A:1"],"timing":"action","instructions":[{"verb":"MoveEncounterCard","card":"discardTop","to":"deckTop"}]},
  // 04009 Needful to Know (line 1 is Secrecy): raising the threat is the cost, paid as the event resolves.
  {"id":"04009:action:1","cardCode":"04009","lines":["04009:A:2"],"timing":"action","instructions":[{"verb":"RaiseThreat","amount":1},{"verb":"LookAtTop"},{"verb":"LowerThreat","amount":{"stat":"threat","of":"picked","printed":true},"who":"actor"}]},
  // 04037 The End Comes
  {"id":"04037:response:1","cardCode":"04037","lines":["04037:A:1"],"timing":"response","trigger":"leftPlay","subject":{"type":"character","control":"any","trait":"Dwarf"},"cost":{"kind":"playEvent"},"instructions":[{"verb":"ShuffleEncounterDiscard"}]},
  // 04060 Short Cut: a location enters play when it is placed in the staging area (rr.staging), or put into play.
  {"id":"04060:response:1","cardCode":"04060","lines":["04060:A:1"],"timing":"response","trigger":"encounterEnteredPlay","subject":{"type":"location","control":"any"},"cost":{"kind":"playEvent"},"condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"character","control":"you","trait":"Hobbit","state":"ready"}},{"kind":"matches","card":"subject","inPlay":true}]},"instructions":[
    {"verb":"Pick","pick":{"type":"character","control":"you","trait":"Hobbit","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"MoveEncounterCard","card":"subject","to":"shuffle"},{"verb":"RevealEncounter"}]},
  // 04102 Longbeard Elder
  {"id":"04102:response:1","cardCode":"04102","lines":["04102:A:1"],"timing":"response","trigger":"committed","subject":"self","instructions":[{"verb":"LookAtTop"},
    {"verb":"ProgressQuest","amount":1,"when":isPicked("location")},
    {"verb":"ModifyStat","stat":"willpower","amount":-1,"until":"endOfPhase","when":{"kind":"not","condition":isPicked("location")}}]},
  // 04132 A Elbereth! Gilthoniel! (line 1 is Secrecy): the engagement cost is read once the enemy is in the deck (printed).
  {"id":"04132:response:1","cardCode":"04132","lines":["04132:A:2"],"timing":"response","trigger":"attackResolved","eventSeat":"you","subject":{"type":"enemy","control":"any","nonUnique":true},"cost":{"kind":"playEvent"},"condition":{"kind":"matches","card":"subject","inPlay":true},"instructions":[
    {"verb":"MoveEncounterCard","card":"subject","to":"deckBottom"},{"verb":"RaiseThreatTo","amount":{"stat":"engagementCost","of":"subject","printed":true}}]},
  // 04136 Risk Some Light (line 1 is Secrecy)
  {"id":"04136:action:1","cardCode":"04136","lines":["04136:A:2"],"timing":"action","instructions":[{"verb":"LookAtTop","count":3},{"verb":"Choose","who":"actor","options":[
    {"id":"bottom","requires":{"kind":"matches","card":"picked"},"instructions":[{"verb":"PickEncounter","from":"looked"},{"verb":"MoveEncounterCard","to":"deckBottom"}]},
    {"id":"keep","instructions":[]}]},{"verb":"ArrangeEncounter"}]},
  // 04137 Vilya: the revealed card is played for no cost, or goes to the bottom of the deck.
  {"id":"04137:action:1","cardCode":"04137","lines":["04137:A:2"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"instructions":[{"verb":"LookAtTop","deck":"own"},{"verb":"Choose","who":"actor","options":[
    {"id":"play","requires":{"kind":"matches","card":"picked"},"instructions":[{"verb":"PlayRevealedFree"}]},
    {"id":"bottom","requires":{"kind":"matches","card":"picked"},"instructions":[{"verb":"PutOnDeck","position":"bottom"}]}]}]},
  // 05012 A Watchful Peace: a location leaves play this way only when it is explored (stage-reveal.ts announceLeftPlay).
  {"id":"05012:response:1","cardCode":"05012","lines":["05012:A:1"],"timing":"response","trigger":"leftPlay","subject":{"type":"location","control":"any","noVictory":true},"cost":{"kind":"playEvent"},"instructions":[{"verb":"MoveEncounterCard","card":"subject","to":"deckTop"}]},
  // 05015 Ithilien Tracker
  {"id":"05015:action:1","cardCode":"05015","lines":["05015:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"WatchReveals","effect":"threatZero","type":"enemy","until":"endOfPhase"}]},
  // 06061 Minas Tirith Lampwright: the next card revealed is the surge card's.
  {"id":"06061:response:1","cardCode":"06061","lines":["06061:A:1"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"card","control":"any","keyword":"surge"},"cost":{"kind":"discardSelf"},"instructions":[
    named(["enemy", "location", "treachery"], (type) => [{"verb":"WatchReveals","effect":"discard","type":type,"until":"endOfRound"}])]},
  // 06090 Palantir: the card type named is the branch chosen.
  {"id":"06090:action:1","cardCode":"06090","lines":["06090:A:2"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"condition":{"kind":"phase","is":"Planning"},"instructions":[
    named(["enemy", "location", "treachery", "objective"], (type) => [{"verb":"CountEncounterTop","top":3,"type":type},{"verb":"LookAtTop","count":3},{"verb":"Draw","amount":{"x":true}},{"verb":"CountEncounterTop","top":3,"type":type,"not":true},{"verb":"RaiseThreat","amount":{"x":true,"times":2}}])]},
  // 08008 Ithilien Lookout (line 1 is Secrecy)
  {"id":"08008:response:1","cardCode":"08008","lines":["08008:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"LookAtTop"},{"verb":"Choose","who":"actor","options":[
    {"id":"discard","requires":isPicked("enemy"),"instructions":[{"verb":"MoveEncounterCard","to":"discard"}]},
    {"id":"keep","instructions":[]}]}]},
  // 08031 Warden of Arnor: the first location revealed each round, while the attached character is committed.
  {"id":"08031:triggered:1","cardCode":"08031","lines":["08031:A:2"],"timing":"triggered","trigger":"firstLocationRevealed","subject":{"type":"location","control":"any"},"condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","committed":true}},"instructions":[{"verb":"PlaceProgressOn","amount":1,"target":"subject"}]},
  // 08062 Free to Choose
  {"id":"08062:response:1","cardCode":"08062","lines":["08062:A:1"],"timing":"response","trigger":"encounterThreatRaised","eventSeat":"you","cost":{"kind":"playEvent"},"instructions":[{"verb":"LowerThreatByRaise"}]},
  // 08089 Celduin Traveler (line 1 is Secrecy)
  {"id":"08089:response:1","cardCode":"08089","lines":["08089:A:2"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"LookAtTop"},{"verb":"Choose","who":"actor","options":[
    {"id":"discard","requires":isPicked("location"),"instructions":[{"verb":"MoveEncounterCard","to":"discard"}]},
    {"id":"keep","instructions":[]}]}]},
  // 08092 Wingfoot
  {"id":"08092:response:1","cardCode":"08092","lines":["08092:A:2"],"timing":"response","trigger":"committed","subject":"host","instructions":[
    named(["enemy", "location", "treachery"], (type) => [{"verb":"WatchReveals","effect":"readyHost","type":type,"until":"endOfPhase"}])]},
  // 09004 Dúnedain Hunter
  {"id":"09004:forced:1","cardCode":"09004","lines":["09004:A:1"],"timing":"forced","trigger":"enteredPlay","subject":"self","instructions":[
    {"verb":"PickEncounter","from":"deck","top":5,"type":"enemy","nonUnique":true},{"verb":"MoveEncounterCard","to":"engaged"},
    {"verb":"Discard","target":{"kind":"self"},"when":{"kind":"not","condition":isPicked("enemy")}},{"verb":"ShuffleEncounterDeck"}]},
  // 10036 Distant Stars
  {"id":"10036:action:1","cardCode":"10036","lines":["10036:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":{"type":"character","control":"you","traits":["Ranger","Scout"],"state":"ready"}},{"kind":"matches","card":"activeLocation","pick":{"type":"location","control":"any","nonUnique":true}}]},"instructions":[
    {"verb":"Pick","pick":{"type":"character","control":"you","traits":["Ranger","Scout"],"state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"MoveEncounterCard","card":"activeLocation","to":"discard"},{"verb":"PickEncounter","from":"deckAndDiscard","type":"location","nonUnique":true},{"verb":"MoveEncounterCard","to":"activeLocation"},{"verb":"ShuffleEncounterDeck"}]},
  // 10123 Quick Ears: canceling a card just revealed shuffles it back and reveals another (as 141001).
  {"id":"10123:response:1","cardCode":"10123","lines":["10123:A:1"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"enemy","control":"any"},"cost":{"kind":"playEvent"},"condition":{"kind":"canPick","pick":{"type":"hero","control":"you","traits":["Dúnedain","Ranger"],"state":"ready"}},"instructions":[
    {"verb":"Pick","pick":{"type":"hero","control":"you","traits":["Dúnedain","Ranger"],"state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"CancelEffect"}]},
  // 11008 Mariner's Compass: the location found and a location in the staging area change places.
  {"id":"11008:response:1","cardCode":"11008","lines":["11008:A:2"],"timing":"response","trigger":"beginningOfPhase","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Travel"},{"kind":"canPick","pick":{"type":"location","control":"any","stagingOnly":true}}]},"instructions":[
    {"verb":"PickEncounter","from":"deck","top":5,"type":"location"},
    {"verb":"Pick","pick":{"type":"location","control":"any","stagingOnly":true},"when":isPicked("location")},
    {"verb":"MoveEncounterCard","to":"deckTop"},{"verb":"MoveEncounterCard","card":"previous","to":"staging"},{"verb":"ShuffleEncounterDeck"}]},
  // 131018 Expecting Mischief (line 1, when it may be played, is another record's).
  {"id":"131018:action:1","cardCode":"131018","lines":["131018:A:2"],"timing":"action","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"WatchReveals","effect":"damage","type":"enemy","amount":2,"until":"endOfPhase"}]},
  // 132011 Ravens of the Mountain: the card looked at never leaves the top of the deck.
  {"id":"132011:action:1","cardCode":"132011","lines":["132011:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"hero","control":"you","state":"ready"}},"instructions":[
    {"verb":"Pick","pick":{"type":"hero","control":"you","state":"ready"}},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"ShuffleEncounterDeck"},{"verb":"LookAtTop"},
    {"verb":"ProgressQuest","amount":{"stat":"threat","of":"picked","printed":true}}]},
  // 142011 Sting: the hero exhausted to defend (it is exhausted once declared).
  {"id":"142011:response:1","cardCode":"142011","lines":["142011:A:3"],"timing":"response","trigger":"declaredDefender","subject":"host","condition":{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","state":"exhausted"}},"instructions":[
    {"verb":"MoveEncounterCard","card":"deckTop","to":"discard"},{"verb":"DamageCard","amount":{"stat":"threat","of":"picked","printed":true},"target":"attacker"}]},
  // 143004 Gimli: "after an enemy is revealed from the encounter deck" is the encounterRevealed window (as 10001).
  {"id":"143004:response:1","cardCode":"143004","lines":["143004:A:2"],"timing":"response","trigger":"encounterRevealed","subject":{"type":"enemy","control":"any"},"condition":{"kind":"matches","card":"self","pick":{"type":"ally","control":"any","state":"exhausted"}},"instructions":[{"verb":"Ready"}]},
  // 17005 Wait no Longer
  {"id":"17005:response:1","cardCode":"17005","lines":["17005:A:1"],"timing":"response","trigger":"beginningOfPhase","cost":{"kind":"playEvent"},"condition":{"kind":"phase","is":"Quest"},"instructions":[
    {"verb":"PickEncounter","from":"deck","top":5,"type":"enemy"},{"verb":"MoveEncounterCard","to":"engaged"},
    {"verb":"RevealFewer","amount":1,"min":0,"when":isPicked("enemy")},{"verb":"ShuffleEncounterDeck"}]},
  // 17008 Firyal
  {"id":"17008:response:1","cardCode":"17008","lines":["17008:A:1"],"timing":"response","trigger":"committed","subject":"self","instructions":[{"verb":"LookAtTop"},{"verb":"Choose","who":"actor","options":[
    {"id":"discard","requires":{"kind":"matches","card":"picked"},"instructions":[{"verb":"MoveEncounterCard","to":"discard"}]},
    {"id":"keep","instructions":[]}]}]},
  // 17033 Dunedain Pathfinder
  {"id":"17033:forced:1","cardCode":"17033","lines":["17033:A:1"],"timing":"forced","trigger":"enteredPlay","subject":"self","instructions":[
    {"verb":"PickEncounter","from":"deck","top":5,"type":"location","nonUnique":true},{"verb":"MoveEncounterCard","to":"staging"},
    {"verb":"Discard","target":{"kind":"self"},"when":{"kind":"not","condition":isPicked("location")}},{"verb":"ShuffleEncounterDeck"}]},
  // 17057 Hunting Party: the players have committed their characters when the staging step begins.
  {"id":"17057:response:1","cardCode":"17057","lines":["17057:A:2"],"timing":"response","trigger":"stagingStepBegins","cost":{"kind":"playEvent"},"condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","stagingOnly":true,"nonUnique":true}},"instructions":[
    {"verb":"Pick","pick":{"type":"enemy","control":"any","stagingOnly":true,"nonUnique":true}},{"verb":"MoveEncounterCard","to":"discard"},{"verb":"RevealEncounter"}]},
  // 19007 The Hidden Way
  {"id":"19007:response:1","cardCode":"19007","lines":["19007:A:1"],"timing":"response","trigger":"beginningOfPhase","cost":{"kind":"playEvent"},"condition":{"kind":"phase","is":"Quest"},"instructions":[
    {"verb":"PickEncounter","from":"deck","top":5,"type":"location"},{"verb":"MoveEncounterCard","to":"activeLocation"},
    {"verb":"RevealFewer","amount":1,"min":0,"when":isPicked("location")},{"verb":"ShuffleEncounterDeck"}]},
  // 21007 The Gathering Storm
  {"id":"21007:action:1","cardCode":"21007","lines":["21007:A:1"],"timing":"action","condition":{"kind":"phase","is":"Planning"},"instructions":[
    {"verb":"PickEncounter","from":"deck","top":5,"type":"enemy"},{"verb":"MoveEncounterCard","to":"staging"},
    {"verb":"ReduceNextCost","pick":{"type":"ally","control":"you"},"amount":{"stat":"threat","of":"picked"},"until":"endOfPhase","when":isPicked("enemy")},{"verb":"ShuffleEncounterDeck"}]},
  // 22004 Cautious Halfling
  {"id":"22004:response:1","cardCode":"22004","lines":["22004:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","instructions":[{"verb":"LookAtTop"},{"verb":"Draw","when":NOT_ENEMY}]},
  // 22058 Far-sighted (line 1 is Doomed 1)
  {"id":"22058:action:1","cardCode":"22058","lines":["22058:A:2"],"timing":"action","instructions":[{"verb":"LookAtTop","count":5}]},
  // 22114 Bilbo's Plan: the enemy discarded is added to the staging area, and then a location no more threatening is discarded.
  {"id":"22114:response:1","cardCode":"22114","lines":["22114:A:1"],"timing":"response","trigger":"attackDestroyed","eventSeat":"you","subject":{"type":"character","control":"you"},"cost":{"kind":"playEvent"},"instructions":[
    {"verb":"ShuffleEncounterDiscard"},{"verb":"DiscardUntil","type":"enemy"},{"verb":"MoveEncounterCard","to":"staging"},
    {"verb":"PickEncounter","from":"play","type":"location","nonUnique":true,"maxThreat":{"stat":"threat","of":"picked"},"when":isPicked("enemy")},
    {"verb":"MoveEncounterCard","to":"discard","when":isPicked("location")}]},
  // 22145 A Desperate Path: the treachery's "when revealed" effects resolve first; then the questing characters ready.
  {"id":"22145:response:1","cardCode":"22145","lines":["22145:A:1"],"timing":"response","trigger":"stagingStepEnds","cost":{"kind":"playEvent"},"instructions":[
    {"verb":"DiscardUntil","type":"treachery"},{"verb":"ResolveWhenRevealed","when":isPicked("treachery")},
    {"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfPhase","holders":{"type":"character","control":"you","committed":true},"when":isPicked("treachery")},
    {"verb":"Each","pick":{"type":"character","control":"you","committed":true},"instructions":[{"verb":"Ready","target":"picked"}]}]},
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
