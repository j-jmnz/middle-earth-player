import type { Effect } from "../../catalog/boundary.ts";

// The six campaign cards of The Two Towers (143071, 143077, 143081, 144067, 144069, 144073; Setup on the front, Resolution on the back, ledger data/printed/the-two-towers.json). Their vocabulary is the campaign
// family's (src/catalog/families/campaign.ts): the checklist deals the Setup verbs (src/campaign/checklist-two-towers.ts) and the Resolution runs the rest (src/rules/families/campaign/resolution.ts).
// The Fellowship burden sets a Setup removes are Hall of Beorn's burden set of each burden (data/cards/TBR.json, TRD.json); the Two Towers' own are Helm's Deep and The Road to Isengard (ToS.json).
const FELLOWSHIP_SETS = ["A Shadow of the Past", "Flight to the Ford", "The Ring Goes South"];
const TWO_TOWERS_SETS = ["Helm's Deep", "The Road to Isengard"];
const GILDOR = "141077";
const MR_UNDERHILL = "141017";
const SKILL_BOONS = ["143015", "143016", "143017", "143018"];
const BEYOND_ALL_HOPE = "143019";
const PALANTIR = "143020";
const POISONED_COUNSELS = "143021";
const SARUMAN_S_VOICE = "143068";
const BRACE_OF_CONEYS = "144014";
const SEARCHING_EYE = "144015";
const BLACK_GATE = "144027";
const HEAVY_BURDEN = "144052";

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 143071 The Uruk-hai. Setup: Gildor Inglorion and Mr. Underhill leave the pool, and the burdens of the Fellowship's first three sets are left out of the encounter deck. Resolution: with the pursuit value at 25 or lower the
  // players choose (the first player answering) between a Skill boon for each player and Beyond All Hope for one player, who takes a fallen hero (an option only while the list holds one); a player left with more than 3
  // non-Fellowship heroes removes heroes from the log.
  {"id":"143071:campaignSetup:1","cardCode":"143071","lines":["143071:A:2"],"timing":"campaignSetup","instructions":[{"verb":"RemovePoolCards","codes":[GILDOR,MR_UNDERHILL]},{"verb":"RemoveBurdenSets","sets":FELLOWSHIP_SETS}]},
  {"id":"143071:resolution:1","cardCode":"143071","lines":["143071:B:1"],"timing":"resolution","instructions":[
    {"verb":"ChooseOption","name":"uruk","options":[{"id":"boons"},{"id":"hope","needsFallen":true}],"who":"firstPlayer","when":{"kind":"pursuit","max":25}},
    {"verb":"ChooseCards","codes":SKILL_BOONS,"who":"eachSeat","to":"hero","when":{"kind":"picked","name":"uruk","option":"boons"}},
    {"verb":"ReviveFallenHero","code":BEYOND_ALL_HOPE,"when":{"kind":"picked","name":"uruk","option":"hope"}},
    {"verb":"TrimHeroes","limit":3}]},

  // 143077 Helm's Deep. Setup: no +1 for changing heroes; the same three burden sets are left out of the encounter deck. Resolution: each player holding a copy of Poisoned Counsels earns it.
  {"id":"143077:campaignSetup:1","cardCode":"143077","lines":["143077:A:2"],"timing":"campaignSetup","instructions":[{"verb":"WaiveThreatPenalty"},{"verb":"RemoveBurdenSets","sets":FELLOWSHIP_SETS}]},
  {"id":"143077:resolution:1","cardCode":"143077","lines":["143077:B:1"],"timing":"resolution","instructions":[{"verb":"EarnHeldCopies","codes":[POISONED_COUNSELS]}]},

  // 143081 The Road to Isengard. Setup: Saruman's Voice is shuffled into the encounter deck; the same three sets are left out. Resolution: Saruman's Voice if any player holds 3 or fewer cards, the Palantír of Orthanc for the first player if any holds 3 or more (both when the hands differ).
  {"id":"143081:campaignSetup:1","cardCode":"143081","lines":["143081:A:2"],"timing":"campaignSetup","instructions":[{"verb":"ShuffleIntoEncounterDeck","code":SARUMAN_S_VOICE},{"verb":"RemoveBurdenSets","sets":FELLOWSHIP_SETS}]},
  {"id":"143081:resolution:1","cardCode":"143081","lines":["143081:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":[SARUMAN_S_VOICE],"when":{"kind":"anyHand","max":3}},{"verb":"Earn","codes":[PALANTIR],"forFirstPlayer":true,"when":{"kind":"anyHand","min":3}}]},

  // 144067 The Passage of the Marshes. Setup: no +1 for changing heroes, a copy of The Searching Eye in each deck, the burdens of Helm's Deep and The Road to Isengard left out of the encounter deck and each player's deck.
  // Resolution: each player takes a permanent +2 starting threat penalty or earns a copy of The Searching Eye, and the log records which.
  {"id":"144067:campaignSetup:1","cardCode":"144067","lines":["144067:A:2"],"timing":"campaignSetup","instructions":[{"verb":"WaiveThreatPenalty"},{"verb":"ShuffleIntoEachDeck","code":SEARCHING_EYE},{"verb":"RemoveBurdenSets","sets":TWO_TOWERS_SETS,"playerDecks":true}]},
  {"id":"144067:resolution:1","cardCode":"144067","lines":["144067:B:1"],"timing":"resolution","instructions":[
    {"verb":"ChooseOption","name":"marshes","options":[{"id":"penalty"},{"id":"searchingEye"}],"who":"eachSeat"},
    {"verb":"ThreatPenaltyForPick","name":"marshes","option":"penalty","amount":2},
    {"verb":"EarnForPick","name":"marshes","option":"searchingEye","codes":[SEARCHING_EYE]}]},

  // 144069 Journey to the Cross-roads. Setup: each player adds 1 resource to each hero or shuffles a copy of Brace of Coneys into their deck; the two Two Towers burden sets are left out. Resolution: each copy shuffled in is earned, and the
  // enemies under The Black Gate are recorded.
  {"id":"144069:campaignSetup:1","cardCode":"144069","lines":["144069:A:2"],"timing":"campaignSetup","instructions":[{"verb":"ChooseCopyOrResources","code":BRACE_OF_CONEYS,"resources":1},{"verb":"RemoveBurdenSets","sets":TWO_TOWERS_SETS,"playerDecks":true}]},
  {"id":"144069:resolution:1","cardCode":"144069","lines":["144069:B:1"],"timing":"resolution","instructions":[{"verb":"EarnDealt","codes":[BRACE_OF_CONEYS]},{"verb":"RecordUnderneath","code":BLACK_GATE}]},

  // 144073 Shelob's Lair. Setup: A Heavy Burden goes on the Ring-bearer; the two Two Towers burden sets are left out. Resolution: A Heavy Burden joins the pool.
  {"id":"144073:campaignSetup:1","cardCode":"144073","lines":["144073:A:2"],"timing":"campaignSetup","instructions":[{"verb":"AttachToRingBearer","code":HEAVY_BURDEN},{"verb":"RemoveBurdenSets","sets":TWO_TOWERS_SETS,"playerDecks":true}]},
  {"id":"144073:resolution:1","cardCode":"144073","lines":["144073:B:1"],"timing":"resolution","instructions":[{"verb":"Earn","codes":[HEAVY_BURDEN]}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
