import type { Effect } from "../../catalog/boundary.ts";

// Records for Escape from Dol Guldur (Mirkwood Paths part 3, campaign card 01131): the encounter cards no template reads, the three quest
// cards, the three guarded objectives and the campaign card. Appointed by Fate (01134), which the campaign card attaches, is in pool/RevCore.ts.
// Every line is read from the scan ledger (data/printed/mirkwood-paths.json).
// Rules: rr.guarded, rr.objective-cards, rr.staging, rr.shadow-effects, rr.attachment-cards, rr.campaign-cards (data/rules/entries.json).
const NOT_UNDEFENDED = {"kind":"not","condition":{"kind":"undefended"}} as const;
const STAGING_OBJECTIVE = {"type":"objective","control":"any","stagingOnly":true,"who":"firstPlayer"} as const;
// An objective a player claimed: attached to a hero.
const CLAIMED = {"type":"objective","control":"any","attached":true} as const;
const ON_HERO = {"kind":"matches","card":"host","pick":{"type":"hero","control":"any"}} as const;
// "Counts as an attachment" (Item is the trait the objectives print).
const COUNTS_AS = {"verb":"CountsAs","cardType":"attachment","trait":"Item"} as const;
const GROUP_ALLY_LIMIT = {"verb":"LimitPlays","cardType":"ally","max":1} as const;

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 01101 Dungeon Jailor: after the players quest unsuccessfully (once a round, whatever the number of players) the first player shuffles an
  // unclaimed objective from the staging area into the encounter deck; its guard is discarded with it.
  {"id":"01101:forced:1","cardCode":"01101","lines":["01101:A:1"],"timing":"forced","trigger":"questFailed","limit":"oncePerRound","condition":{"kind":"all","conditions":[{"kind":"sourceIn","zone":"staging"},{"kind":"canPick","pick":STAGING_OBJECTIVE}]},"instructions":[{"verb":"Pick","pick":STAGING_OBJECTIVE},{"verb":"MoveEncounterCard","card":"picked","to":"shuffle"}]},
  // 01102 Nazgûl of Dol Guldur: no attachment can be played on it; it comes into the staging area from out of play when the prisoner is rescued;
  // a shadow effect dealt to it costs the engaged player a character.
  {"id":"01102:constant:1","cardCode":"01102","lines":["01102:A:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotHaveAttachments","amount":1,"until":"whileSourceInPlay","target":"self"}]},
  {"id":"01102:forced:1","cardCode":"01102","lines":["01102:A:2"],"timing":"forced","trigger":"prisonerRescued","subject":{"type":"hero","control":"any"},"instructions":[{"verb":"MoveEncounterCard","card":"self","to":"staging"}]},
  {"id":"01102:forced:2","cardCode":"01102","lines":["01102:A:3"],"timing":"forced","trigger":"shadowEffectResolved","subject":"self","instructions":[{"verb":"Pick","pick":{"type":"character","control":"you"}},{"verb":"Discard","target":{"kind":"picked"}}]},
  // 01103 Cavern Guardian (Doomed 1 is a keyword): the defending player discards an attachment he controls (all of them when undefended). A discarded
  // objective returns to the staging area (families/objectives.ts).
  {"id":"01103:shadow:1","cardCode":"01103","lines":["01103:A:2"],"timing":"shadow","instructions":[{"verb":"Pick","pick":{"type":"attachment","control":"you"},"when":NOT_UNDEFENDED},{"verb":"DiscardPicked","when":NOT_UNDEFENDED},{"verb":"Each","pick":{"type":"attachment","control":"you"},"instructions":[{"verb":"DiscardPicked"}],"when":{"kind":"undefended"}}]},
  // 01104 Under the Shadow: the staging area's total Threat is higher by the number of players until the end of the phase; as a Shadow card the
  // defending player raises his threat by the number of enemies he is engaged with.
  {"id":"01104:whenRevealed:1","cardCode":"01104","lines":["01104:A:1"],"timing":"whenRevealed","instructions":[{"verb":"ModifyStat","stat":"moreStagingThreat","amount":{"players":true},"until":"endOfPhase","target":"table"}]},
  {"id":"01104:shadow:1","cardCode":"01104","lines":["01104:A:2"],"timing":"shadow","instructions":[{"verb":"RaiseThreat","amount":{"count":{"type":"enemy","control":"any","engaged":"you"}},"who":"actor"}]},
  // 01105 Iron Shackles: attached to the top of the first player's deck (the next draw from it discards Iron Shackles instead, families/dungeon-deck.ts);
  // as a Shadow card its When Revealed effect resolves.
  {"id":"01105:whenRevealed:1","cardCode":"01105","lines":["01105:A:1"],"timing":"whenRevealed","instructions":[{"verb":"AttachToDeck","who":"firstPlayer"}]},
  {"id":"01105:constant:1","cardCode":"01105","lines":["01105:A:1"],"timing":"constant","instructions":[{"verb":"CountsAs","cardType":"attachment","trait":"Condition"}]},
  {"id":"01105:shadow:1","cardCode":"01105","lines":["01105:A:2"],"timing":"shadow","instructions":[{"verb":"ResolveWhenRevealed","card":"self"}]},
  // 01107 Tower Gate: each player's top deck card becomes an Orc Guard engaged with him after the players travel here.
  {"id":"01107:forced:1","cardCode":"01107","lines":["01107:A:1"],"timing":"forced","trigger":"traveled","subject":"self","instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"PlaceOrcGuard"}]}]},
  // 01108 Gandalf's Map, 01109 Dungeon Torch, 01110 Shadow Key: guarded when revealed, claimed for 2 threat once free of encounters, then attached to a hero
  // with a Forced effect each (a claimed objective that is detached returns to the staging area, families/objectives.ts).
  ...objective("01108", "A:3", [{"id":"01108:constant:2","cardCode":"01108","lines":["01108:A:3"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"cannotAttack","amount":1,"until":"whileSourceInPlay","target":"host"},{"verb":"ModifyStat","stat":"cannotDefend","amount":1,"until":"whileSourceInPlay","target":"host"}]}]),
  ...objective("01109", "A:3", [{"id":"01109:forced:1","cardCode":"01109","lines":["01109:A:3"],"timing":"forced","trigger":"endOfRound","condition":ON_HERO,"instructions":[{"verb":"RaiseThreat","amount":2,"who":"hostController"}]}]),
  ...objective("01110", "A:3", [{"id":"01110:forced:1","cardCode":"01110","lines":["01110:A:3"],"timing":"forced","trigger":"endOfRound","condition":ON_HERO,"instructions":[{"verb":"DamageCard","amount":1,"target":"host"}]}]),
  // 01123 The Necromancer's Tower: Setup turns the Nazgûl faceup beside the quest deck and attaches an encounter card to each objective; When
  // Revealed takes a prisoner; the players play at most 1 ally a round and cannot advance without a claimed objective.
  {"id":"01123:setup:1","cardCode":"01123","lines":["01123:A:1"],"timing":"setup","instructions":[{"verb":"TurnFaceUp","code":"01102"},{"verb":"Each","pick":{"type":"objective","control":"any","stagingOnly":true},"instructions":[{"verb":"GuardObjective","target":"picked"}]}]},
  {"id":"01123:whenRevealed:1","cardCode":"01123","lines":["01123:B:1"],"timing":"whenRevealed","instructions":[{"verb":"TakePrisoner"}]},
  {"id":"01123:constant:1","cardCode":"01123","lines":["01123:B:2"],"timing":"constant","instructions":[GROUP_ALLY_LIMIT]},
  {"id":"01123:constant:2","cardCode":"01123","lines":["01123:B:3"],"timing":"constant","condition":{"kind":"count","pick":CLAIMED,"max":0},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 01124 Through the Caverns: progress placed on it rescues the prisoner (a Response); the stage advances only with the prisoner rescued and all 3 objectives.
  {"id":"01124:response:1","cardCode":"01124","lines":["01124:B:1"],"timing":"response","trigger":"progressPlaced","subject":"self","condition":{"kind":"prisoner","is":true},"instructions":[{"verb":"RescuePrisoner","damage":1}]},
  {"id":"01124:constant:1","cardCode":"01124","lines":["01124:B:2"],"timing":"constant","instructions":[GROUP_ALLY_LIMIT]},
  {"id":"01124:constant:2","cardCode":"01124","lines":["01124:B:3"],"timing":"constant","condition":{"kind":"any","conditions":[{"kind":"prisoner","is":true},{"kind":"count","pick":CLAIMED,"max":2}]},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 01125 Out of the Dungeons: each quest phase begins with an Orc Guard for each player; the stage cannot be defeated while the Nazgûl is in
  // play, and defeating it with none in play wins the game (the last stage's defeat is the win).
  {"id":"01125:forced:1","cardCode":"01125","lines":["01125:B:1"],"timing":"forced","trigger":"beginningOfPhase","condition":{"kind":"phase","is":"Quest"},"instructions":[{"verb":"ForEachPlayer","order":"firstFirst","instructions":[{"verb":"PlaceOrcGuard"}]}]},
  {"id":"01125:constant:1","cardCode":"01125","lines":["01125:B:2"],"timing":"constant","condition":{"kind":"inPlay","code":"01102","is":true},"instructions":[{"verb":"Restrict","what":"advance"}]},
  // 01131 Escape from Dol Guldur (campaign card). Setup: Mendor enters play and Appointed by Fate goes on a hero of the first player's choice.
  // Forced: the prisoner is the hero the Campaign Log names, Mendor is captured with it and the card is flipped. Response (side B): the first
  // claimed objective frees Mendor with 1 damage. Resolution: a Mendor still in play and a Mendor's Support for each player go to the next campaign.
  {"id":"01131:campaignSetup:1","cardCode":"01131","lines":["01131:A:2"],"timing":"campaignSetup","instructions":[{"verb":"PutObjectiveAllyIntoPlay","code":"01135"},{"verb":"AttachChosen","code":"01134"}]},
  {"id":"01131:forced:1","cardCode":"01131","lines":["01131:A:3"],"timing":"forced","trigger":"prisonerTaken","condition":{"kind":"faceUp","side":"A"},"instructions":[{"verb":"SelectLoggedPrisoner"},{"verb":"CaptureWithPrisoner","code":"01135"},{"verb":"FlipCard"}]},
  {"id":"01131:response:1","cardCode":"01131","lines":["01131:B:1"],"timing":"response","trigger":"claimed","limit":"oncePerGame","condition":{"kind":"faceUp","side":"B"},"instructions":[{"verb":"FreeCaptive","code":"01135","damage":1}]},
  {"id":"01131:resolution:1","cardCode":"01131","lines":["01131:B:2"],"timing":"resolution","instructions":[{"verb":"CarryOver","codes":["01135"],"when":{"kind":"inPlay","code":"01135","is":true}},{"verb":"CarryOver","codes":["01132"],"eachPlayer":true,"when":{"kind":"inPlay","code":"01135","is":true}}]},
];

// A guarded objective: Guarded when it is revealed (01108:A:1), the Action that claims it (A:2) with its attachment rule, and its own effect.
function objective(code: string, _line: string, own: readonly Effect[]): Effect[] {
  return [
    {"id":`${code}:whenRevealed:1`,"cardCode":code,"lines":[`${code}:A:1`],"timing":"whenRevealed","instructions":[{"verb":"GuardObjective"}]},
    {"id":`${code}:action:1`,"cardCode":code,"lines":[`${code}:A:2`],"timing":"action","condition":{"kind":"all","conditions":[{"kind":"sourceIn","zone":"staging"},{"kind":"freeOfEncounters"}]},"cost":{"kind":"raiseThreat","amount":2},"instructions":[{"verb":"Pick","pick":{"type":"hero","control":"you"}},{"verb":"ClaimObjective"}]},
    {"id":`${code}:constant:1`,"cardCode":code,"lines":[`${code}:A:2`],"timing":"constant","instructions":[COUNTS_AS]},
    ...own,
  ];
}

export const AUTHORED_REPLACES: readonly string[] = [];
