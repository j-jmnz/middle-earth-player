import type { Effect } from "../../../catalog/boundary.ts";

// The campaign cards of The Return of the King (145066, 145070, 145078, 146069, 146074, 146079; Setup on the front, Resolution on the back, ledger data/printed/the-return-of-the-king.json). Their vocabulary is the campaign
// family's (src/catalog/families/campaign.ts): the checklist deals the Setup verbs (src/campaign/checklist.ts) and the Resolution runs the rest (src/rules/setup/resolution.ts, src/rules/families/campaign/saga-end.ts).
// Written here: the Setup of the cards that only change the pool, the decks and the hand (145066, 145070, 146074), every Resolution, and the Setup and Forced of The Tower of Cirith Ungol (146069, whose boons and Heavy Burden its scenario builds), and the Setup tokens and the Forced timer of Mount Doom (146079). 145078's Setup and Forced are in pelennor/stages.ts.
const FELLOWSHIP_AND_TWO_TOWERS_SETS = ["A Shadow of the Past", "Flight to the Ford", "The Ring Goes South", "The Passage of the Marshes", "Shelob's Lair"];
const ANDURIL = "142014";
const OVERCOME_BY_FEAR = "145016";
const ARMY_OF_THE_DEAD_ENEMY = "145067";
const ARMY_OF_THE_DEAD_BOON = "145068";
const WRAITH_ON_WINGS = "145062";
const ESQUIRE_OF_ROHAN = "145014";
const ESQUIRE_OF_GONDOR = "145015";
const CORSAIR_FLEET = ["145071", "145072"];
const SHAGRAT = "146020";
const LAST_OF_THE_COMPANY = "146014";
const HEAVY_BURDEN = "144052";
const ESCAPE_FROM_CIRITH_UNGOL = "Escape from Cirith Ungol";
const THREE_BURDEN_SETS = ["Helm's Deep", "The Road to Isengard", "The Passing of the Grey Company"];
const BLACK_GATE = "146024";
const GWAIHIR = "146041";

export const AUTHORED_EFFECTS: readonly Effect[] = [
  // 145066 The Passing of the Grey Company. Setup: no +1 for changing heroes; the first player may raise each player's threat by 1 to search his deck for Andúril; the burdens of the five earlier burden sets are left out of the encounter deck.
  // Resolution: each Overcome by Fear on a threat dial joins the pool for that player; the Army of the Dead boon is earned if the Army is in the victory display.
  {"id":"145066:campaignSetup:1","cardCode":"145066","lines":["145066:A:1"],"timing":"campaignSetup","instructions":[{"verb":"WaiveThreatPenalty"},{"verb":"SearchDeckForCard","code":ANDURIL,"raiseThreat":1},{"verb":"RemoveBurdenSets","sets":FELLOWSHIP_AND_TWO_TOWERS_SETS}]},
  {"id":"145066:resolution:1","cardCode":"145066","lines":["145066:B:1"],"timing":"resolution","instructions":[
    {"verb":"EarnOnThreatDial","codes":[OVERCOME_BY_FEAR]},
    {"verb":"Earn","codes":[ARMY_OF_THE_DEAD_BOON],"when":{"kind":"any","conditions":[{"kind":"inVictory","code":ARMY_OF_THE_DEAD_ENEMY,"is":true},{"kind":"inVictory","code":ARMY_OF_THE_DEAD_BOON,"is":true}]}}]},

  // 145070 The Siege of Gondor. Setup: the Andúril search and the same five burden sets. Resolution: the resources on The Corsair Fleet are recorded in the notes, and the Army of the Dead boon leaves the pool.
  {"id":"145070:campaignSetup:1","cardCode":"145070","lines":["145070:A:1"],"timing":"campaignSetup","instructions":[{"verb":"SearchDeckForCard","code":ANDURIL,"raiseThreat":1},{"verb":"RemoveBurdenSets","sets":FELLOWSHIP_AND_TWO_TOWERS_SETS}]},
  {"id":"145070:resolution:1","cardCode":"145070","lines":["145070:B:1"],"timing":"resolution","instructions":[{"verb":"RecordTokens","codes":CORSAIR_FLEET,"as":"corsairFleet"},{"verb":"RemoveFromPoolByCode","codes":[ARMY_OF_THE_DEAD_BOON]}]},

  // 145078 The Battle of the Pelennor Fields. Resolution: each player earns a Wraith on Wings, and an Esquire on a hero is earned for that hero's controller.
  {"id":"145078:resolution:1","cardCode":"145078","lines":["145078:B:2"],"timing":"resolution","instructions":[{"verb":"Earn","codes":[WRAITH_ON_WINGS],"eachPlayer":true},{"verb":"EarnAttached","codes":[ESQUIRE_OF_GONDOR,ESQUIRE_OF_ROHAN]}]},

  // 146069 The Tower of Cirith Ungol. Setup: no +1 for changing heroes; A Heavy Burden, from the supply, is attached to the hero that has Last of the Company (the quest card's Setup attaches it, so this resolves after it); each player chooses an Item boon other than Andúril from the pool and sets it aside, out of play;
  // the burdens of Helm's Deep, The Road to Isengard and The Passing of the Grey Company are left out of the encounter deck. Forced: when the players advance to stage 3A, once its When Revealed has resolved the Heavy Burden moves to the Ring-bearer (one card, never a second copy) and each set-aside boon is attached to Shagrat as a guarded
  // objective, if he is in play (else it stays set aside); when Shagrat leaves play each guarded boon returns to its owner's hand (a marker: the settle loop does it). Resolution: with Shagrat in play, the boons attached to him are lost from the pool.
  {
    id: "146069:campaignSetup:1",
    cardCode: "146069",
    lines: ["146069:A:1"],
    timing: "campaignSetup",
    instructions: [
      { verb: "WaiveThreatPenalty" },
      { verb: "AttachToHeroWith", code: HEAVY_BURDEN, with: LAST_OF_THE_COMPANY },
      { verb: "SetAsideBoon", trait: "Item", except: ANDURIL },
      { verb: "RemoveBurdenSets", sets: THREE_BURDEN_SETS },
    ],
  },
  {
    id: "146069:forced:1",
    cardCode: "146069",
    lines: ["146069:B:1"],
    timing: "forced",
    trigger: "afterStageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: [ESCAPE_FROM_CIRITH_UNGOL] } },
    instructions: [{ verb: "MoveAttachment", code: HEAVY_BURDEN, to: "ringBearer" }],
  },
  {
    id: "146069:forced:2",
    cardCode: "146069",
    lines: ["146069:B:1"],
    timing: "forced",
    trigger: "afterStageRevealed",
    condition: { kind: "matches", card: "subject", pick: { type: "card", control: "any", names: [ESCAPE_FROM_CIRITH_UNGOL] } },
    instructions: [{ verb: "GuardWithSetAside", host: SHAGRAT, kind: "boon" }],
  },
  { id: "146069:forced:3", cardCode: "146069", lines: ["146069:B:1"], timing: "forced", trigger: "leftPlay", subject: { type: "enemy", control: "any", names: ["Shagrat"] }, instructions: [{ verb: "ReturnGuardedToHand" }] },
  {"id":"146069:resolution:1","cardCode":"146069","lines":["146069:B:2"],"timing":"resolution","instructions":[{"verb":"LoseGuardedBoons","host":SHAGRAT,"when":{"kind":"inPlay","code":SHAGRAT,"is":true}}]},

  // 146074 The Black Gate Opens. Setup: no +1 for changing heroes, the Andúril search and the five burden sets. Resolution: the tokens on The Black Gate are recorded; each Wraith on Wings in the victory display leaves the pool; the first
  // player's Gwaihir is earned; a hero in a discard pile is not a fallen hero.
  {"id":"146074:campaignSetup:1","cardCode":"146074","lines":["146074:A:1"],"timing":"campaignSetup","instructions":[{"verb":"WaiveThreatPenalty"},{"verb":"SearchDeckForCard","code":ANDURIL,"raiseThreat":1},{"verb":"RemoveBurdenSets","sets":FELLOWSHIP_AND_TWO_TOWERS_SETS}]},
  {"id":"146074:resolution:1","cardCode":"146074","lines":["146074:B:1"],"timing":"resolution","instructions":[
    {"verb":"RecordTokens","codes":[BLACK_GATE],"as":"blackGateTokens"},
    {"verb":"RemoveFromPoolByCode","codes":[WRAITH_ON_WINGS],"perCopyInVictory":true},
    {"verb":"Earn","codes":[GWAIHIR],"when":{"kind":"controls","code":GWAIHIR}},
    {"verb":"IgnoreDiscardedHeroes"}]},
  // The Black Gate Opens has no win (146073:B:3): it ends when the last player is eliminated, and that end runs this Resolution as a win does (user decision, 2026-11-12; docs/brief.md, The Return of the King). The campaign card is in the game for it, in the campaign zone.
  {"id":"146074:constant:1","cardCode":"146074","lines":["146074:B:1"],"timing":"constant","instructions":[{"verb":"ModifyStat","stat":"endsInDefeat","amount":1,"until":"whileSourceInPlay","target":"table"}]},

  // 146079 Mount Doom. Setup: no +1 for changing heroes; X resource tokens are placed on the card (the campaign card is kept in the game: it has a Forced), X the tokens recorded for The Black Gate in the campaign log (0 with no record); the burdens of Helm's Deep, The Road to Isengard and The Passing of the Grey Company
  // are left out of the encounter deck. Forced: at the end of each round one token comes off the card, and the players lose the game when none is left (a loss writes nothing): X tokens last X rounds. "Then" holds the loss to a token actually removed (rr.then): a card with none (X is 0) is inert. Resolution: the first player keeps The One Ring (the players lose the campaign) or destroys it (they win).
  {"id":"146079:campaignSetup:1","cardCode":"146079","lines":["146079:A:1"],"timing":"campaignSetup","instructions":[{"verb":"WaiveThreatPenalty"},{"verb":"PlaceTokensOnCampaignCard","amount":{"recorded":"blackGateTokens"}},{"verb":"RemoveBurdenSets","sets":THREE_BURDEN_SETS}]},
  {"id":"146079:forced:1","cardCode":"146079","lines":["146079:A:2"],"timing":"forced","trigger":"endOfRound","condition":{"kind":"not","condition":{"kind":"less","left":{"stat":"resources","of":"self"},"right":1}},"instructions":[{"verb":"RemoveResourceTokens","code":"146079","amount":1},{"verb":"LoseGame","reason":"No resource token is left on Mount Doom","when":{"kind":"less","left":{"stat":"resources","of":"self"},"right":1}}]},
  {"id":"146079:resolution:1","cardCode":"146079","lines":["146079:B:1"],"timing":"resolution","instructions":[{"verb":"ChooseOption","name":"ring","options":[{"id":"keep"},{"id":"destroy"}],"who":"firstPlayer"}]},
  {"id":"146079:resolution:2","cardCode":"146079","lines":["146079:B:2"],"timing":"resolution","instructions":[{"verb":"EndCampaign","result":"lost","when":{"kind":"picked","name":"ring","option":"keep"}}]},
  {"id":"146079:resolution:3","cardCode":"146079","lines":["146079:B:3"],"timing":"resolution","instructions":[{"verb":"EndCampaign","result":"won","when":{"kind":"picked","name":"ring","option":"destroy"}}]},
];

export const AUTHORED_REPLACES: readonly string[] = [];
