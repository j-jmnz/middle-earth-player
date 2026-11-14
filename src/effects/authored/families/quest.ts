import type { Effect } from "../../../catalog/boundary.ts";

// Authored records for the quest phase, locations, travel, progress, threat and engagement (docs/agents/effect-authoring.md). A card's other lines may have records in pool/<pack>.ts.
// The vocabulary they use is src/catalog/families/quest.ts; the engine behind it is src/rules/families/quest/.

const STAGING_ENEMY = { type: "enemy", control: "any", stagingOnly: true } as const;
const STAGING_NON_UNIQUE_ENEMY = { type: "enemy", control: "any", stagingOnly: true, nonUnique: true } as const;
const STAGING_LOCATION = { type: "location", control: "any", stagingOnly: true } as const;
const QUESTING_HOBBIT = { type: "character", control: "you", trait: "Hobbit", committed: true } as const;
const EXHAUSTED_DUNEDAIN = { type: "character", control: "you", trait: "Dúnedain", state: "exhausted" } as const;
const READY_CHARACTER = { type: "character", control: "you", state: "ready" } as const;
const SPARE_CHARACTER = { type: "character", control: "you", state: "ready", committed: false } as const;
const HERO_WEAPON = { type: "attachment", control: "you", trait: "Weapon", state: "ready", on: { type: "hero", control: "you" } } as const;
const ORC = { type: "enemy", control: "any", trait: "Orc" } as const;
// "Guarding a card": a player card is attached to the enemy (the engine has no Guarded keyword; 19112:A:1).
const GUARDING = { type: "enemy", control: "any", hasAttachment: { playerCard: true } } as const;
const WITH_ATTACHMENT = { type: "location", control: "any", stagingOnly: true, hasAttachment: { playerCard: true } } as const;

export const RECORDS: readonly Effect[] = [
  // 01015 Son of Arnor: an enemy in the staging area or engaged with another player.
  {"id":"01015:response:1","cardCode":"01015","lines":["01015:A:1"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"canPick","pick":{"type":"enemy","control":"any","staging":true,"engaged":"other"}},"instructions":[{"verb":"Pick","pick":{"type":"enemy","control":"any","staging":true,"engaged":"other"}},{"verb":"Engage","target":"picked"}]},
  // 02055 Escort from Edoras (line 1 is 02055:constant:1).
  {"id":"02055:forced:1","cardCode":"02055","lines":["02055:A:2"],"timing":"forced","trigger":"committedQuestResolved","subject":"self","instructions":[{"verb":"Discard","target":{"kind":"self"}}]},
  // 02095 Boromir: "a single player" is the player chosen.
  {"id":"02095:action:2","cardCode":"02095","lines":["02095:A:2"],"timing":"action","cost":{"kind":"discardSelf"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"DamageEach","amount":2,"engagedWith":"picked"}]},
  // 02100 Elfhelm: the gained Response, while he is ready.
  {"id":"02100:response:1","cardCode":"02100","lines":["02100:A:1"],"timing":"response","trigger":"threatRaisedByEncounter","eventSeat":"you","condition":{"kind":"matches","card":"self","pick":{"type":"character","control":"any","state":"ready"}},"instructions":[{"verb":"LowerThreat","amount":1,"who":"actor"}]},
  // 02121 West Road Traveller: switching needs an active location.
  {"id":"02121:response:1","cardCode":"02121","lines":["02121:A:1"],"timing":"response","trigger":"played","subject":"self","eventSeat":"you","condition":{"kind":"all","conditions":[{"kind":"matches","card":"activeLocation"},{"kind":"canPick","pick":STAGING_LOCATION}]},"instructions":[{"verb":"Pick","pick":STAGING_LOCATION},{"verb":"MakeActive"}]},
  // 03005 Ever Onward: the failed quest's threat waits for this Response (families/quest/threat.ts).
  {"id":"03005:response:1","cardCode":"03005","lines":["03005:A:1"],"timing":"response","trigger":"questFailed","eventSeat":"you","cost":{"kind":"playEvent"},"instructions":[{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"WaiveQuestThreat","who":"picked","until":"endOfPhase"}]},
  // 04007 Renewed Friendship: "that player" is the player who played the attachment.
  {"id":"04007:response:1","cardCode":"04007","lines":["04007:A:1"],"timing":"response","trigger":"played","eventSeat":"other","subject":{"type":"attachment","control":"other","on":{"type":"hero","control":"you"}},"cost":{"kind":"playEvent"},"instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"ready","requires":{"kind":"canPick","pick":{"type":"hero","control":"other","state":"exhausted"}},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"other","state":"exhausted"}},{"verb":"Ready","target":"picked"}]},
    {"id":"draw","instructions":[{"verb":"Draw","who":"eventSeat"}]},
    {"id":"threat","instructions":[{"verb":"LowerThreat","amount":2,"who":"eventSeat"}]}]}]},
  // 04008 Ravenhill Scout: up to 2, so the player chooses 1 or 2.
  {"id":"04008:action:1","cardCode":"04008","lines":["04008:A:1"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"count","pick":{"type":"location","control":"any"},"min":2},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"Pick","pick":{"type":"location","control":"any","different":true}},{"verb":"MoveProgress","from":"pickedBefore","amount":2,"choose":true}]},
  // 04032 Hail of Stones: X is chosen, then that many characters exhaust.
  {"id":"04032:action:1","cardCode":"04032","lines":["04032:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"canPick","pick":STAGING_ENEMY},{"kind":"canPick","pick":READY_CHARACTER}]},"instructions":[
    {"verb":"ChooseX","max":[{"count":READY_CHARACTER}]},
    {"verb":"Repeat","times":{"x":true},"instructions":[{"verb":"Pick","pick":READY_CHARACTER},{"verb":"Exhaust","target":{"kind":"picked"}}]},
    {"verb":"Pick","pick":STAGING_ENEMY},{"verb":"DamageCard","amount":{"x":true}}]},
  // 04053 Aragorn: the refresh phase's action window (7.4) is the engine's "End of round" phase.
  {"id":"04053:action:1","cardCode":"04053","lines":["04053:A:2"],"timing":"action","limit":"oncePerGame","condition":{"kind":"any","conditions":[{"kind":"phase","is":"Refresh"},{"kind":"phase","is":"End of round"}]},"instructions":[{"verb":"ResetThreat"}]},
  // 06056 Pippin: the gained Response, while each of his controller's heroes is a Hobbit.
  {"id":"06056:response:1","cardCode":"06056","lines":["06056:A:1"],"timing":"response","trigger":"engaged","eventSeat":"you","subject":{"type":"enemy","control":"any"},"condition":{"kind":"heroesAll","trait":"Hobbit"},"cost":{"kind":"raiseThreat","amount":3},"instructions":[{"verb":"ReturnToStaging","target":{"kind":"subject"}},{"verb":"BarEngagement","what":"engage","until":"endOfRound","target":"subject"}]},
  // 07003 Saruman: the chosen card goes facedown under Saruman, out of play, and comes back to the staging area when he leaves play.
  {"id":"07003:response:1","cardCode":"07003","lines":["07003:A:3"],"timing":"response","trigger":"enteredPlay","subject":"self","condition":{"kind":"any","conditions":[{"kind":"canPick","pick":STAGING_NON_UNIQUE_ENEMY},{"kind":"canPick","pick":{"type":"location","control":"any","stagingOnly":true,"nonUnique":true}}]},"instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"enemy","requires":{"kind":"canPick","pick":STAGING_NON_UNIQUE_ENEMY},"instructions":[{"verb":"Pick","pick":STAGING_NON_UNIQUE_ENEMY},{"verb":"PlaceUnderSelf"}]},
    {"id":"location","requires":{"kind":"canPick","pick":{"type":"location","control":"any","stagingOnly":true,"nonUnique":true}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any","stagingOnly":true,"nonUnique":true}},{"verb":"PlaceUnderSelf"}]}]}]},
  // 08060 Pursuing the Enemy.
  {"id":"08060:action:1","cardCode":"08060","lines":["08060:A:1"],"timing":"action","condition":{"kind":"canPick","pick":{"type":"ally","control":"you","trait":"Silvan"}},"instructions":[{"verb":"Pick","pick":{"type":"ally","control":"you","trait":"Silvan"}},{"verb":"ReturnToHand","target":"picked"},{"verb":"Pick","pick":{"type":"player","control":"any"}},{"verb":"DamageEach","amount":1,"engagedWith":"picked"}]},
  // 08140 Captain of Gondor.
  {"id":"08140:response:1","cardCode":"08140","lines":["08140:A:2"],"timing":"response","trigger":"optionallyEngaged","eventSeat":"you","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound","target":"host"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound","target":"host"}]},
  // 09002 Halbarad (line 1 is 09002:constant:1).
  {"id":"09002:constant:2","cardCode":"09002","lines":["09002:A:2"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"extraOptionalEngage","amount":1,"until":"whileSourceInPlay","target":"actorSeat"}]},
  // 09013 Star Brooch (line 1 is 09013:constant:1).
  {"id":"09013:constant:2","cardCode":"09013","lines":["09013:A:2"],"timing":"constant","condition":{"kind":"hasEngaged"},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"cannotReduceWillpower","amount":1,"until":"whileSourceInPlay","target":"host"}]},
  // 10006 Curious Brandybuck.
  {"id":"10006:forced:1","cardCode":"10006","lines":["10006:A:1"],"timing":"forced","trigger":"activeExplored","instructions":[{"verb":"PutOnDeck","position":"bottom","target":"self"}]},
  // 10007 Hobbit Pony: while the quest is still to be resolved.
  {"id":"10007:action:1","cardCode":"10007","lines":["10007:A:2"],"timing":"action","cost":[{"kind":"exhaustSelf"},{"kind":"exhaustHost"}],"condition":{"kind":"all","conditions":[{"kind":"step","is":"beforeResolution"},{"kind":"matches","card":"host","pick":{"type":"hero","control":"any","committed":false}}]},"instructions":[{"verb":"CommitToQuest","target":"host"}]},
  // 10030 Descendants of Kings: the event prints no timing label, so its text resolves when it is played (in any action window).
  {"id":"10030:triggered:1","cardCode":"10030","lines":["10030:A:1"],"timing":"triggered","trigger":"played","subject":"self","instructions":[
    {"verb":"ChooseX","max":[{"count":{"type":"enemy","control":"any","engaged":"you"}},{"count":EXHAUSTED_DUNEDAIN}]},
    {"verb":"Repeat","times":{"x":true},"instructions":[{"verb":"Pick","pick":EXHAUSTED_DUNEDAIN},{"verb":"Ready","target":"picked"}]}]},
  // 10117 Doom Hangs Still: the Planning Action and the Valour Planning Action are one choice.
  {"id":"10117:action:1","cardCode":"10117","lines":["10117:A:1","10117:A:2"],"timing":"action","condition":{"kind":"phase","is":"Planning"},"instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"waive","instructions":[{"verb":"WaiveQuestThreat","who":"eachSeat","until":"endOfRound"}]},
    {"id":"valour","requires":{"kind":"threat","min":40,"valour":true},"instructions":[{"verb":"RaiseThreat","amount":2,"who":"eachSeat"},{"verb":"SkipQuestPhase"}]}]}]},
  // 10124 Favor of the Valar: settle keeps its seat from elimination until this resolves (families/quest/threat.ts).
  {"id":"10124:forced:1","cardCode":"10124","lines":["10124:A:2"],"timing":"forced","trigger":"wouldBeEliminated","eventSeat":"you","instructions":[{"verb":"SetThreat","value":45},{"verb":"Discard","target":{"kind":"self"}}]},
  // 11005 Grappling Hook: the hook is discarded once its character is committed.
  {"id":"11005:action:1","cardCode":"11005","lines":["11005:A:2"],"timing":"action","cost":{"kind":"exhaustHost"},"condition":{"kind":"all","conditions":[{"kind":"step","is":"beforeResolution"},{"kind":"matches","card":"host","pick":{"type":"character","control":"any","committed":false}}]},"instructions":[{"verb":"CommitToQuest","target":"host","stat":"attack"},{"verb":"Discard","target":{"kind":"self"}}]},
  // 11009 Lindon Navigator.
  {"id":"11009:constant:1","cardCode":"11009","lines":["11009:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"noExhaustQuest","amount":1,"until":"whileSourceInPlay"},{"verb":"ModifyStat","stat":"commitsExhausted","amount":1,"until":"whileSourceInPlay"}]},
  {"id":"11009:forced:1","cardCode":"11009","lines":["11009:A:2"],"timing":"forced","trigger":"committedQuestResolved","subject":"self","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"discard","instructions":[{"verb":"Discard","target":{"kind":"self"}}]},
    {"id":"hand","requires":{"kind":"handHasCard"},"instructions":[{"verb":"DiscardFromHand","amount":1}]}]}]},
  // 12035 Sam Gamgee (line 1 is 12035:constant:1): Sam's controller pays the Spirit resource.
  {"id":"12035:response:1","cardCode":"12035","lines":["12035:A:2"],"timing":"response","trigger":"threatRaised","limit":"oncePerRound","cost":{"kind":"resources","amount":1,"sphere":"spirit"},"instructions":[{"verb":"Ready"},{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"endOfRound"},{"verb":"ModifyStat","stat":"attack","amount":1,"until":"endOfRound"},{"verb":"ModifyStat","stat":"defense","amount":1,"until":"endOfRound"}]},
  // 12036 Elevenses.
  {"id":"12036:constant:1","cardCode":"12036","lines":["12036:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"step","is":"afterStaging"}}]},
  {"id":"12036:action:1","cardCode":"12036","lines":["12036:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Quest"},{"kind":"canPick","pick":QUESTING_HOBBIT}]},"instructions":[
    {"verb":"ChooseX","max":[{"count":QUESTING_HOBBIT}]},
    {"verb":"Repeat","times":{"x":true},"instructions":[{"verb":"Pick","pick":QUESTING_HOBBIT},{"verb":"Ready","target":"picked"},{"verb":"RemoveFromQuest"}]},
    {"verb":"LowerThreat","amount":{"x":true},"who":"actor"}]},
  // 12037 Mirkwood Explorer (line 1 is 12037:response:1).
  {"id":"12037:action:1","cardCode":"12037","lines":["12037:A:2"],"timing":"action","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":{"type":"location","control":"any"}},"instructions":[{"verb":"Pick","pick":{"type":"location","control":"any"}},{"verb":"MoveProgress","from":"self","all":true}]},
  // 12065 Arrows from the Trees.
  {"id":"12065:constant:1","cardCode":"12065","lines":["12065:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"step","is":"afterEngagementChecks"}}]},
  {"id":"12065:action:1","cardCode":"12065","lines":["12065:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Encounter"},{"kind":"engagedThisPhase","is":false}]},"instructions":[
    {"verb":"DamageEach","amount":1,"pick":STAGING_ENEMY},
    {"verb":"Choose","who":"actor","options":[
      {"id":"spend","requires":{"kind":"resources","min":3,"sphere":"tactics","group":true},"instructions":[{"verb":"SpendResources","amount":3,"sphere":"tactics","group":true},{"verb":"DamageEach","amount":2,"pick":STAGING_ENEMY}]},
      {"id":"keep","instructions":[]}]}]},
  // 12082 Argalad.
  {"id":"12082:action:1","cardCode":"12082","lines":["12082:A:2"],"timing":"action","limit":"oncePerRound","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":STAGING_ENEMY},"instructions":[{"verb":"Pick","pick":STAGING_ENEMY},{"verb":"LowerCardThreat","amount":{"stat":"attack","of":"self"},"until":"endOfPhase"},{"verb":"DamageCard","amount":{"x":true}}]},
  // 12086 Battle-fury (line 2 is the attack family's).
  {"id":"12086:constant:1","cardCode":"12086","lines":["12086:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"step","is":"beforeStaging"}}]},
  // 12116 Windfola (lines 1 and 2 are 12116:constant:1 and 2).
  {"id":"12116:response:1","cardCode":"12116","lines":["12116:A:3"],"timing":"response","trigger":"removedFromQuest","subject":"host","cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"CommitToQuest","target":"host"}]},
  // 131013 Thrór's Map.
  {"id":"131013:action:1","cardCode":"131013","lines":["131013:A:2"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Travel"},{"kind":"canPick","pick":STAGING_LOCATION}]},"instructions":[{"verb":"Pick","pick":STAGING_LOCATION},{"verb":"MakeActive"}]},
  // 131016 Goblin-cleaver.
  {"id":"131016:action:1","cardCode":"131016","lines":["131016:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Combat"},{"kind":"canPick","pick":HERO_WEAPON},{"kind":"canPick","pick":{"type":"enemy","control":"any","engaged":"you"}}]},"instructions":[
    {"verb":"Pick","pick":HERO_WEAPON},{"verb":"Exhaust","target":{"kind":"picked"}},
    {"verb":"Pick","pick":{"type":"enemy","control":"any","engaged":"you"}},
    {"verb":"DamageCard","amount":2,"when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":ORC}}},
    {"verb":"DamageCard","amount":3,"when":{"kind":"matches","card":"picked","pick":ORC}}]},
  // 131017 Late Adventurer.
  {"id":"131017:action:1","cardCode":"131017","lines":["131017:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"step","is":"beforeResolution"},{"kind":"canPick","pick":SPARE_CHARACTER}]},"instructions":[{"verb":"Pick","pick":SPARE_CHARACTER},{"verb":"Exhaust","target":{"kind":"picked"}},{"verb":"CommitToQuest"}]},
  // 131018 Expecting Mischief (line 2 is the encounter family's).
  {"id":"131018:constant:1","cardCode":"131018","lines":["131018:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"step","is":"beforeStaging"}}]},
  // 141015 Hobbit Pipe: any event card's effect, whoever played it.
  {"id":"141015:response:1","cardCode":"141015","lines":["141015:A:2"],"timing":"response","trigger":"threatLowered","eventSeat":"you","subject":{"type":"card","control":"any","cardType":"event"},"cost":{"kind":"exhaustSelf"},"instructions":[{"verb":"Draw"}]},
  // 144010 Snowmane.
  {"id":"144010:response:1","cardCode":"144010","lines":["144010:A:3"],"timing":"response","trigger":"questedSuccessfully","subject":"host","instructions":[{"verb":"Ready","target":"host"}]},
  // 145007 Ghân-buri-Ghân: X is his Willpower.
  {"id":"145007:constant:1","cardCode":"145007","lines":["145007:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"willpower","amount":{"stat":"threat","of":"activeLocation"},"until":"whileSourceInPlay"}]},
  {"id":"145007:action:1","cardCode":"145007","lines":["145007:A:2"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"all","conditions":[{"kind":"step","is":"canTravel"},{"kind":"canPick","pick":STAGING_LOCATION}]},"instructions":[{"verb":"Pick","pick":STAGING_LOCATION},{"verb":"TravelTo"}]},
  // 145013 Banner of Elendil (line 1 is 145013:constant:1).
  {"id":"145013:constant:2","cardCode":"145013","lines":["145013:A:2"],"timing":"constant","condition":{"kind":"matches","card":"host","pick":{"type":"character","control":"any","committed":true}},"instructions":[{"verb":"ModifyStat","stat":"willpower","amount":1,"until":"whileSourceInPlay","holders":{"type":"character","control":"you","committed":true,"notHost":true}}]},
  // 146007 Elladan and 146008 Elrohir (line 1 of each is its constant:1).
  {"id":"146007:response:1","cardCode":"146007","lines":["146007:A:2"],"timing":"response","trigger":"optionallyEngaged","eventSeat":"you","subject":ORC,"instructions":[{"verb":"Ready"}]},
  {"id":"146008:response:1","cardCode":"146008","lines":["146008:A:2"],"timing":"response","trigger":"optionallyEngaged","eventSeat":"you","subject":ORC,"instructions":[{"verb":"Ready"}]},
  // 17034 Backtrack: X is chosen, up to the progress on the quest.
  {"id":"17034:constant:1","cardCode":"17034","lines":["17034:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"questKeywords","is":false}}]},
  {"id":"17034:action:1","cardCode":"17034","lines":["17034:A:2"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"questProgress"},{"kind":"canPick","pick":STAGING_LOCATION}]},"instructions":[{"verb":"Pick","pick":STAGING_LOCATION},{"verb":"MoveProgress","from":"quest","choose":true}]},
  // 19009 Grey Cloak.
  {"id":"19009:action:1","cardCode":"19009","lines":["19009:A:2"],"timing":"action","cost":[{"kind":"exhaustHost"},{"kind":"discardSelf"}],"condition":{"kind":"all","conditions":[{"kind":"phase","is":"Encounter"},{"kind":"canPick","pick":STAGING_NON_UNIQUE_ENEMY}]},"instructions":[{"verb":"Pick","pick":STAGING_NON_UNIQUE_ENEMY},{"verb":"BarEngagement","what":"checks","until":"endOfPhase"}]},
  // 19010 The Arkenstone: "that player" is the next player, the one whose hero it went to when there are two.
  {"id":"19010:action:1","cardCode":"19010","lines":["19010:A:4"],"timing":"action","limit":"oncePerRound","condition":{"kind":"canPick","pick":{"type":"hero","control":"other"}},"instructions":[{"verb":"LowerThreat","amount":2,"who":"actor"},{"verb":"Pick","pick":{"type":"hero","control":"other"}},{"verb":"ReattachSelf"},{"verb":"RaiseThreat","amount":2,"who":"otherPlayer"}]},
  // 19026 Haldan: X is the number of attachments the location had.
  {"id":"19026:response:1","cardCode":"19026","lines":["19026:A:2"],"timing":"response","trigger":"activeExplored","instructions":[{"verb":"Draw","amount":{"x":true}}]},
  // 19034 South Away!
  {"id":"19034:action:1","cardCode":"19034","lines":["19034:A:1"],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"phase","is":"Travel"},{"kind":"canPick","pick":WITH_ATTACHMENT}]},"instructions":[{"verb":"Pick","pick":WITH_ATTACHMENT},{"verb":"MakeActive"},{"verb":"LowerThreat","amount":{"stat":"attachments","of":"activeLocation"},"who":"eachSeat"}]},
  // 19059 Forest Road Traveler.
  {"id":"19059:constant:1","cardCode":"19059","lines":["19059:A:1"],"timing":"constant","instructions":[
    {"verb":"ModifyStat","stat":"willpower","amount":{"stat":"attachments","of":"activeLocation"},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"attack","amount":{"stat":"attachments","of":"activeLocation"},"until":"whileSourceInPlay"},
    {"verb":"ModifyStat","stat":"defense","amount":{"stat":"attachments","of":"activeLocation"},"until":"whileSourceInPlay"}]},
  // 19112 Bilbo Baggins: the damage waits for the players to quest successfully this phase.
  {"id":"19112:response:1","cardCode":"19112","lines":["19112:A:1"],"timing":"response","trigger":"committed","condition":{"kind":"canPick","pick":STAGING_ENEMY},"instructions":[
    {"verb":"Pick","pick":STAGING_ENEMY},
    {"verb":"ModifyStat","stat":"willpower","amount":{"stat":"threat","of":"picked"},"until":"endOfPhase","target":"self"},
    {"verb":"Delay","until":"questSucceeded","subject":"picked","instructions":[
      {"verb":"DamageCard","amount":1,"when":{"kind":"not","condition":{"kind":"matches","card":"picked","pick":GUARDING}}},
      {"verb":"DamageCard","amount":2,"when":{"kind":"matches","card":"picked","pick":GUARDING}}]}]},
  // 22007 Charge into Battle (line 2 is the attack family's).
  {"id":"22007:constant:1","cardCode":"22007","lines":["22007:A:1"],"timing":"constant","instructions":[{"verb":"PlayOnlyIf","condition":{"kind":"step","is":"afterStaging"}}]},
  // 22029 Need Drives Them.
  {"id":"22029:action:1","cardCode":"22029","lines":["22029:A:1"],"timing":"action","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"ReadyAll","when":{"kind":"threat","min":40,"valour":true}}]}]},
  // 22054 Saruman (line 3 is 22054:response:1).
  {"id":"22054:constant:1","cardCode":"22054","lines":["22054:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"threatReductionToOne","amount":1,"until":"whileSourceInPlay","target":"actorSeat"}]},
  // 22061 Rohirrim Scout.
  {"id":"22061:action:1","cardCode":"22061","lines":["22061:A:1"],"timing":"action","cost":{"kind":"discardSelf"},"condition":{"kind":"canPick","pick":STAGING_NON_UNIQUE_ENEMY},"instructions":[{"verb":"Pick","pick":STAGING_NON_UNIQUE_ENEMY},{"verb":"BarEngagement","what":"checks","until":"endOfRound"}]},
  // 22113 Eagle Emissary (line 1 is 22113:constant:1).
  {"id":"22113:forced:1","cardCode":"22113","lines":["22113:A:2"],"timing":"forced","trigger":"questedSuccessfully","subject":"self","instructions":[{"verb":"Choose","who":"actor","options":[
    {"id":"pay","requires":{"kind":"resources","min":1,"sphere":"tactics"},"instructions":[{"verb":"SpendResources","amount":1,"sphere":"tactics"}]},
    {"id":"discard","instructions":[{"verb":"Discard","target":{"kind":"self"}}]}]}]},
  // 22137 Aragorn.
  {"id":"22137:action:1","cardCode":"22137","lines":["22137:A:2"],"timing":"action","limit":"oncePerRound","cost":{"kind":"exhaustSelf"},"condition":{"kind":"canPick","pick":STAGING_LOCATION},"instructions":[{"verb":"Pick","pick":STAGING_LOCATION},{"verb":"LowerCardThreat","amount":{"stat":"willpower","of":"self"},"until":"endOfPhase"},{"verb":"PlaceProgressOn","amount":{"x":true},"target":"picked"}]},
  // 22142 Westfold Lancer.
  {"id":"22142:response:1","cardCode":"22142","lines":["22142:A:1"],"timing":"response","trigger":"questedSuccessfully","subject":"self","cost":{"kind":"discardSelf"},"condition":{"kind":"canPick","pick":STAGING_NON_UNIQUE_ENEMY},"instructions":[{"verb":"Pick","pick":STAGING_NON_UNIQUE_ENEMY},{"verb":"DamageCard","amount":2}]},
  // 06036 Trained for War (line 1 is the pool's PlayOnlyIf): a quest that has Siege keeps it (hon.siege), otherwise the current
  // quest gains Battle until the end of the phase (hon.battle).
  {"id":"06036:action:1","cardCode":"06036","lines":["06036:A:2"],"timing":"action","instructions":[{"verb":"ModifyStat","stat":"battle","amount":1,"until":"endOfPhase","target":"currentQuest","when":{"kind":"questKeyword","keyword":"siege","is":false}}]},
];

// Generated record ids an authored record here replaces.
export const REPLACES: readonly string[] = [];
