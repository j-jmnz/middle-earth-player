// The shape of a game: the scenario state the reducer returns, its seats, cards, windows and undo log. The helpers that read
// and build it are in state.ts, which re-exports every type here.
import type { Instruction, ScenarioDefinition } from "../../catalog/boundary.ts";

import type { DelayedEffect, Frame, GameEvent, HideFailure, Modifier, PendingAttack, PendingStrike, UsedEffect } from "../windows/frame-types.ts";
import type { EngineStep, PlayerIntent } from "./intents.ts";
import type { CampaignFacts, ResolutionLog } from "./campaign-state.ts";
import type { SeaState } from "../families/sea/types.ts";
import type { UnchartedState } from "../families/uncharted/types.ts";
import type { PileZone } from "./piles.ts";
import type { Discount } from "./discount-types.ts";

export type { Discount };
export type {
  DelayedEffect,
  EffectData,
  CancelOffer,
  Frame,
  FrameData,
  FrameName,
  GameEvent,
  EscapeData,
  EscapeResult,
  FortitudeData,
  FortitudeResult,
  HideData,
  HideFailure,
  HideResult,
  Modifier,
  PendingAttack,
  PendingStrike,
  ResponseOffer,
  ResumeData,
  UsedEffect,
  QueueItem,
} from "../windows/frame-types.ts";

export type ZoneName =
  | "deck"
  | "hand"
  | "discard"
  | "heroes"
  | "play"
  | "engaged"
  | "seatStaging"
  | "seatQuest"
  | "staging"
  | "activeLocation"
  | "secondActiveLocation"
  | "questDeck"
  | "questStage"
  | "encounterDeck"
  | "encounterDiscard"
  | "burdenDeck"
  // The Corsair deck and its own discard pile (dcce.corsair-deck): out of play, like the encounter deck and its discard pile.
  | "corsairDeck"
  | "corsairDiscard"
  // The Uncharted deck (dcce.uncharted-deck), out of play, every card Lost Island side up; the Stormcaller's area (dcce.stormcallers-area) and the Island Map (dcce.island-map), in play, outside the staging area.
  | "unchartedDeck" | "stormcallerArea" | "islandMap"
  // The decks beside the encounter deck in Ered Mithrin (emce.caves-deck, emce.evil-creatures-deck), out of play (core/piles.ts): the Caves deck, the Evil Creatures deck and its own discard pile, and the two encounter sets Lost in Mirkwood sets aside.
  | PileZone
  | "victory"
  | "setAside"
  | "removed"
  | "shadow"
  | "attached"
  // Facedown under a location, out of play (141049:A:1). The card's host is the location.
  | "under"
  // The campaign card next to the quest deck (rr.campaign-cards). Placed only when the card has an ability that works during
  // the scenario (a Response, a Forced effect, a constant, an Action), so it is in play: 141056:A:2.
  | "campaign"
  // The Nightmare setup card next to the quest deck, side A faceup, on Nightmare (docs/brief.md, Nightmare): in play all game.
  | "nightmare"
  // The Hard/Expert Mode card next to the quest deck, on the side the players chose (dcce.hard-expert): in play all game. A zone of its own, so
  // nothing that reads the Nightmare setup card reads it.
  | "modeCard"
  // The Ring-bearer, and the cards attached to it, facedown under the Watcher in the Water (mec109.stage-4): in play, controlled by nobody; the host is the Watcher.
  | "captive"
  // Out of play, facedown, under no player's control, still owned (`CardInstance.owner`): a card captured underneath another card (the host), or in a player's captured deck (no host, listed in `Seat.captured`; mec108.captured-cards, mec108.captured-deck).
  | "captured"
  | "grappled"; // Facedown on a location in the staging area by Grapple (dcce.grapple): in play, not in it, controlled by nobody; the host is the location.

export type CardFace = "up" | "down" | "A" | "B";

export type CardInstance = {
  id: string;
  code: string;
  zone: ZoneName;
  exhausted: boolean;
  // The phase the card was last readied in, `<round>:<phase>`, kept only while it cannot be readied more than once per phase
  // (readyOncePerPhase, 22134:B:2). Absent otherwise.
  readiedIn?: string;
  damage: number;
  progress: number;
  resources: number;
  host: string | null;
  attachments: readonly string[];
  committed: boolean;
  // The side quest a committed character quests on instead of the current quest (families/sidequests/quest.ts). Absent for the
  // current quest.
  questTo?: string;
  shadowId: string | null;
  // Shadow cards dealt beyond the first ("deal it an additional shadow card", 141069:A:2), in the order dealt. Absent
  // when there are none.
  extraShadowIds?: readonly string[];
  face: CardFace;
  controller: number | null;
  // The seat whose card it is, when another seat has taken control of it (Wandering Took, Stand and Fight). A discarded
  // card goes to its owner's discard pile.
  owner?: number;
  // Order in which the card entered play. Forced effects resolve oldest first.
  enteredPlay: number;
  // A hero card taken from the collection (families/misc/collection.ts): the id of the card whose effect brought it out.
  collection?: string;
  // A card put into play for a time ("At the end of the round, or if those heroes leave play, remove them from the game", 11212:A:2): when it leaves play it is removed from the game
  // (keywords.ts defeatedDestination). The end of the round is a delayed effect of the PutIntoPlay that set this.
  temporary?: true;
  // On an attachment: the id of the hero card from the collection attached to it, whose game text and resource icon its host has.
  lends?: string;
  // A double-sided card whose two sides are two catalog cards (the Grotto and Underwater locations, dcce.grotto-deck): the code of the side it does not show. `code` is the side it shows,
  // so every read of the card (traits, Threat, records) sees the side faceup; a flip swaps the two (families/uncharted/grotto.ts).
  other?: string;
  // A card held facedown as part of a prisoner (the hero, the cards attached to it, Mendor captured with it): it is blank and unusable
  // until it is rescued (families/prisoner.ts, 01123:B:1).
  prisoner?: true;
  // The place the prisoner hero had among its seat's heroes, so a rescued (or swapped back) hero returns where it was (families/prisoner.ts).
  heroSlot?: number;
  // A hero an enemy guards (Carried Away, 18074:A:1): in play, facedown under the guard (the captive zone), controlled by no one. Its owner stays in the game while it is held (families/wilderland/carried.ts); `owner` is the seat that gets it back.
  guardedHero?: true;
  // A Captive of The Uruk-hai (families/captives): a hero faceup in the captive zone under To Isengard! or an enemy, in play, controlled by nobody. `owner` is the seat it belongs to, `heroSlot` its place among that seat's heroes.
  captive?: true;
  // A player card an enemy holds, faceup: under it (Hobgoblin, 18050:A:2) or attached to it (a boon Shagrat guards, 146069:B:1). It returns to its owner's hand once the holder is out of play (families/wilderland/kings.ts returnHeld). Set by GuardWithDeckTop and GuardWithSetAside.
  held?: true;
  // The damage on a card set aside "out of play (Do not remove damage tokens from it)" (Cold-Drake, 19024:A:1) stays on it as it enters play again. Set only by SetAsideInPlay with keepDamage.
  keepsDamage?: true;
  // An enemy attached to a character as an attachment (Wraith of Carn Dûm, 101157:A:1): it has no enemy text while it lies there, hears no leaving of play, and returns to the staging area as an enemy when its host leaves play (families/angmar/reanimate/attached.ts).
  asAttachment?: true | "discard";
  // A player card lying faceup on an enemy as an attachment with no title and no game text, taken from the top of a deck (Nameless Thing, dwd.nameless-enemies, families/nameless): its printed cost is its only active part. Set only by AttachDeckTop, and cleared once the card has left the enemy.
  nameless?: true;
  // The enemy Lost in Mirkwood's stage 4A named the nemesis, until it leaves play (18076:A:1, families/wilderland/nemesis.ts).
  nemesis?: true;
  // An objective a player claimed and attached to a hero: when it leaves that hero it returns to the staging area, uncontrolled
  // (families/objectives.ts, 01108:A:2).
  claimed?: true;
  // An encounter card attached to a guarded objective as its guard (rr.guarded): it is unlinked from the objective when it leaves play,
  // or when it attaches itself to another card (families/objectives.ts).
  guard?: true;
  // The effect record that set a guarded treasure up (Lost in Mirkwood, families/wilderland/mirkwood.ts): the settle sweep credits the claim to it. Set only on a treasure a record's AttachRandomTreasure guarded.
  setUpBy?: string;
  // A card of the encounter deck or its discard pile that a search "shuffles into the second encounter deck": SetAsideEncounterDeck keeps it in the deck when it sets the rest aside (families/sea/swap.ts, 11215:B:1).
  carried?: true;
  // The named deck the card was dealt into, when that deck has a discard pile of its own (core/piles.ts): the card goes back to that discard pile, not the encounter discard pile, when it
  // leaves play (emce.evil-creatures-deck). Absent on every other card.
  deck?: "evilCreatures";
};

export type Seat = {
  threat: number;
  deck: readonly string[];
  hand: readonly string[];
  discard: readonly string[];
  heroes: readonly string[];
  play: readonly string[];
  engaged: readonly string[];
  // This seat's own staging area, once stage 2B has created the separate areas (`ScenarioState.separate`): the ids of its encounter cards, a
  // subset of `ScenarioState.staging`, which keeps every staging card in any area (families/breaking/areas.ts).
  staging: readonly string[];
  // The seat's player side quest (zone seatQuest), not a stage of the scenario's quest.
  questStage: string | null;
  // The seat's own quest stage while stages are separate (the stage 3 and 4 cards, zone questStage); `ScenarioState.questStage` is then null.
  // Absent in every other game (families/breaking/areas.ts).
  stage?: string;
  // The seat's own active location while stages are separate (the card, zone activeLocation); `ScenarioState.activeLocation` and `secondActiveLocation` then mirror the
  // seats' (seat 0's and seat 1's) for code that reads them outside a seat's view (families/breaking/areas.ts). Absent in every other game.
  active?: string;
  // This seat's captured deck, top card first (the cards in the zone `captured` with no host that this seat owns; mec108.captured-deck, families/captured/). Absent in a game with none.
  captured?: readonly string[];
  // The seat whose staging area and stage this seat shares after it joined that player (mec108.joining-another-player, families/captured/join.ts): its own staging, stage and active location are empty then. Absent while it has an area of its own.
  joined?: number;
  // The hero this seat chose to start with in Escape from Mount Gram (families/captured/deck.ts): the table's round-1 note reads its threat cost, and a hero rescued later is not it.
  startHero?: string;
  eliminated: boolean;
  // Encounter cards attached to the top of this seat's deck, oldest first (Iron Shackles, 01105:A:1; families/dungeon.ts). Absent when none.
  deckAttached?: readonly string[];
};

export type Phase =
  | "Setup"
  | "Mulligan"
  | "Beginning of round"
  | "Resource"
  | "Planning"
  | "Quest"
  | "Travel"
  | "Encounter"
  | "Combat"
  | "Refresh"
  | "End of round";

export type ModeName =
  | "mulligan"
  | "afterOpening"
  | "beginRound"
  | "resourceGrant"
  | "resourceActions"
  | "planning"
  | "questCommit"
  | "staging"
  | "resolution"
  | "travel"
  | "optionalEngage"
  | "engagement"
  | "combatStart"
  | "combatShadows"
  | "combatActions"
  | "enemyAttacks"
  | "playerAttacks"
  | "refresh"
  | "endRound"
  | "stopped";

export type Window =
  | { kind: "mulligan" }
  | { kind: "pass" }
  | { kind: "travel" }
  | { kind: "optionalEngage" }
  | { kind: "chooseEnemy"; reason: "engagement" | "attack"; seat: number; options: readonly string[] }
  | { kind: "defense"; enemyId: string; seat: number }
  // `seat`: separate stages total archery per stage, and only that stage's seat assigns it (mec109.multiple-staging-areas).
  | { kind: "archery"; total: number; seat?: number }
  // `targets`: a card opened the window (OfferAttacks): the seat may attack only these enemies, each once, as extra attacks.
  | { kind: "playerAttack"; targets?: readonly string[] }
  | { kind: "hideCommit"; seat: number }
  | { kind: "fortitudeCommit"; seat: number }
  | { kind: "escapeCommit"; seat: number }
  | { kind: "frameAction" }
  | { kind: "choose"; seat: number; options: readonly string[] }
  | { kind: "cancelOffer"; seat: number }
  | { kind: "response"; seat: number }
  // A card shown to a player (the top of the encounter deck). The player closes it with a pass.
  | { kind: "look"; seat: number; cardIds: readonly string[]; side?: "A" }
  // The scenario is won: a player answers the choice that Resolution instruction `step` opens.
  | { kind: "resolution"; step: number; seat: number };

export type UndoLog = {
  phase: Phase;
  snapshot: ScenarioState | null;
  cards: Readonly<Record<string, CardInstance>> | null;
  intents: readonly PlayerIntent[];
  steps: readonly (readonly EngineStep[])[];
};

export type ScenarioState = {
  scenarioId: string;
  seatCount: 1 | 2;
  seats: readonly [Seat, Seat];
  staging: readonly string[];
  activeLocation: string | null;
  secondActiveLocation: string | null;
  questDeck: readonly string[];
  questStage: string | null;
  encounterDeck: readonly string[];
  encounterDiscard: readonly string[];
  // Present only when the scenario makes a burden deck (Flight to the Ford) or sets the Ring-bearer's life.
  burdenDeck?: readonly string[];
  // The Corsair deck and its discard pile, present once a scenario deals a Corsair deck (dcce.corsair-deck; families/sea/corsair.ts).
  corsairDeck?: readonly string[];
  corsairDiscard?: readonly string[];
  // The decks of Ered Mithrin by zone name, present once a scenario deals one (core/piles.ts, families/wilderland/decks.ts).
  piles?: Readonly<Partial<Record<PileZone, readonly string[]>>>;
  // The Uncharted deck and the codes of the double-sided locations that go back into it, present once a scenario deals one (families/uncharted.ts).
  uncharted?: UnchartedState;
  // What the sea family keeps for a game with ships or the Stormcaller Elite: the heading, the cards that leave play by a route of their own, a
  // Sailing test in progress. Absent in every other game (families/sea/types.ts).
  sea?: SeaState;
  life?: number;
  victory: readonly string[];
  setAside: readonly string[];
  removed: readonly string[];
  cards: Readonly<Record<string, CardInstance>>;
  nextId: number;
  seed: number;
  seedCursor: number;
  phase: Phase;
  mode: ModeName;
  round: number;
  firstPlayer: number;
  activeSeat: number;
  window: Window | null;
  passed: readonly number[];
  mulliganTaken: boolean;
  // Cards each player does not draw in the starting hand (a Setup effect). The opening hand and a mulligan draw 6 minus this.
  openingHandReduction: number;
  mulliganSeats: readonly number[];
  lost: boolean;
  lossReason: string | null;
  failure: string | null;
  stageCleared: boolean;
  perilSeat: number | null;
  modifiers: readonly Modifier[];
  stack: readonly Frame[];
  frameSeq: number;
  // The phase the end-of-phase machinery last saw.
  boundaryPhase: Phase;
  clock: number;
  hideFailures: readonly HideFailure[];
  delayed: readonly DelayedEffect[];
  // Effects with a limit that have been used.
  uses: readonly UsedEffect[];
  revealCursor: { seats: readonly number[]; index: number } | null;
  // True between the two passes that resolve the quest.
  questResolved: boolean;
  // Stage 2B has created a staging area and a quest stage for each seat (`Seat.staging`, `Seat.stage`; families/breaking/areas.ts). Absent
  // in every other game and until then.
  separate?: true;
  // The heroes a card shuffled into their owners' decks (Lost and Alone, 04124:A:1): each is put into play when its owner draws it, and its seat is not out of heroes while it waits (families/deck/hero.ts). Absent in every game that shuffles none.
  heroesInDeck?: readonly string[];
  // Only on a seat's view of the state (families/breaking/areas.ts viewOf): the seat it is the view of. mergeView drops it.
  viewSeat?: number;
  // The seats whose stage has dealt its archery this combat phase while stages are separate (machine.ts startCombat).
  archeryDone?: readonly number[];
  // Phases still owed an additional instance, in the order they were asked for, and the mode the round goes on at once the additional instances are done (withMode, state.ts; "there is an
  // additional instance of the chosen phase", 11213:A:2). Absent in every game until a card asks for one.
  extraPhases?: readonly Phase[];
  extraResume?: ModeName;
  // The phase the running additional instance followed (the phase that ended as it began), for the phase rail; absent when none is running.
  extraFollowed?: Phase;
  // Which instance of a phase is running: enterMode counts up when an additional instance begins, and the end-of-phase machinery (triggers.ts crossBoundary) compares it with `boundarySeq`, the count it last
  // saw, so an instance of the phase in progress ends like any other phase. Absent in every game with no additional instance.
  phaseSeq?: number;
  boundarySeq?: number;
  // The seats that have had their travel opportunity this round while stages are separate: each seat in player order may travel to a location of its own
  // staging area (machine.ts, travel.ts).
  travelDone?: readonly number[];
  // Progress a stage 3B turned into cards to discard from the encounter deck, until the progress step is over (families/breaking/progress.ts).
  progressOwed?: readonly { seat: number; amount: number }[];
  stages: readonly { code: string; branch?: readonly string[]; look?: number; catchUp?: number; randomNext?: { codes: readonly string[]; otherwise?: string; remove?: true }; deck?: true }[];
  // The part number of the scenario's campaign card, in a campaign with XP (the amount `part`), and the campaign Setup instructions that resolve once the
  // quest card's Setup is done (ScenarioDefinition.afterSetup).
  part?: number;
  afterSetup?: { card: string; instructions: readonly Instruction[] };
  // The campaign Setup instructions that resolve after the quest card's Setup and before its side B's When Revealed (ScenarioDefinition.beforeReveal; Escape from Mount Gram).
  beforeReveal?: { card: string; instructions: readonly Instruction[] };
  // The pool cards whose Setup (AttachSelfToNamed) found no host yet and wait, set aside, for the quest card's Setup to put it into play (families/angmar/burdens.ts attachPending).
  pendingAttach?: readonly string[];
  // The damage each card has taken this round, for a card that takes no more than a number each round (the flag `damageCap`), and the threat each seat's
  // effects have lowered this round (the flag `threatReductionCap`). Kept only in a game that has such a card; cleared as the round ends.
  roundDamage?: Readonly<Record<string, number>>;
  // The damage healed from each character this round, for the flag `healCap` (145033:A:1). Kept only in a game that has such a card; cleared as the round ends.
  roundHealed?: Readonly<Record<string, number>>;
  threatLoweredBy?: Readonly<Record<number, number>>;
  // The threat each seat's player card effects have lowered this round (the flag `playerThreatReductionCap`, 19104:A:2). Kept only in a game that has such a card; cleared as the round ends.
  playerThreatLoweredBy?: Readonly<Record<number, number>>;
  // The location whose Discover keyword the travel step holds back until the Responses to the travel are done (emce.discover, families/wilderland/discover.ts); cleared when the keyword resolves.
  discoverHeld?: string;
  // The codes of the stages the quest advanced to, in order. Kept only by a quest that branches (BranchStage), for a Resolution that
  // reads which branch was taken ("If stage 3B was Beorn's Path", 01129:B:1).
  stagesReached?: readonly string[];
  // The defeated stage waits for the first player to choose the next one (LookAtStages): "due" until its record is pushed, "asking" while it runs.
  stageChoice?: "due" | "asking";
  // The final stage that holds the win (the flag `holdsWin`, 02106:B:2) was defeated and waits for its own Forced effect to win or reset the quest (`holdStage`, families/quest/branch.ts). Absent otherwise.
  stageHeld?: string;
  setup: readonly Instruction[];
  widgets: ScenarioDefinition["widgets"];
  resolution: ScenarioDefinition["resolution"];
  // The next Resolution instruction to run, the seat it is asking, and what the resolution has recorded so far.
  resolutionAt: number;
  resolutionSeat: number;
  resolutionLog: ResolutionLog;
  // The treasures a Resolution drew for the players to choose from (ChooseRandomTreasure), while the choice is open: drawn once, with the game's seed.
  resolutionOffer?: readonly string[];
  engagement: { ordinal: number; engagedThisPass: boolean } | null;
  resolvedAttacks: readonly string[];
  // The enemies that made an immediate attack (outside the combat phase, or in it without using up their attack) in this phase of this round, present only after one did; read by attackedThisPhase (families/wilderland/assault.ts).
  immediateAttacks?: { round: number; phase: Phase; enemies: readonly string[] };
  // "round:step" for each framework action window opened this round (rr.framework-steps), so each opens once, and
  // "round:traveled" once the travel opportunity is taken or declined.
  stepWindows: readonly string[];
  // The active player of the planning phase: the one seat that may play allies and attachments in the window
  // (rr.step-2-2). Each seat has its turn in player order (rr.step-2-3). Null outside the planning phase.
  planningSeat: number | null;
  // "seat:enemyId" for each attack a seat declared this combat phase: one per enemy (faq.limitations-on-attacks).
  declaredAttacks: readonly string[];
  pendingAttack: PendingAttack | null;
  // The round the first player was asked whether a side quest is the current quest (families/wilderland/night.ts); kept only in a game with encounter side quests.
  sideAsked?: number;
  // The game deals encounter side quests in its encounter deck, not in a side quest deck of its own (Intruders in Chetwood, mec108.side-quests): the side quest reads of families/wilderland/night-quest.ts apply. Set at the start (markSideQuests), absent in every other game.
  sideQuests?: true;
  // The game has a card that asks whether progress was placed on a side quest this round ("if no progress was placed on Lie Low this round", 10081:A:1): the engine notes each placement as `progressPlacedHere` (families/angmar/progress.ts). Set at the start (markProgressNoted), absent in every other game.
  progressNoted?: true;
  // The codes of the cards whose Forced effect hears `progressWouldBePlaced` (Twisting Passage, 04092:A:1): progress that would be placed on one of them in play waits for that effect (families/long-dark/hold.ts). Set at the start, absent in every other game.
  progressHeldBy?: readonly string[];
  pendingStrike: PendingStrike | null;
  // Events raised by code that cannot offer responses itself. settle announces them when no window is open.
  pendingEvents?: readonly GameEvent[];
  // The cards in play that hear their own leaving by any route (`exitedPlay`); settle announces one once it is out of play (families/island/hand.ts). Kept only in a game with such a card.
  exitWatch?: readonly string[];
  // The cards each seat drew in the draw step at the beginning of this round's resource phase ("choose and discard 1 of those
  // cards", families/misc/pick.ts).
  resourceDrawn?: Readonly<Record<number, readonly string[]>>;
  // Set while some card in play or in a hand can answer damage just dealt ("cancel X damage just dealt"): a character's lethal
  // damage then waits for those Responses before it destroys the character (settle keeps it current).
  holdLethal?: true;
  // The codes of the enemies dealt whose own Forced effect hears the damage dealt to them ("Before Patrol Leader is dealt damage, ...", 03014:A:1): the damage step offers them `damageDealt` like a character's. Absent in every other game (families/encounter/patrol.ts).
  enemyDamageHeard?: readonly string[];
  // The picks that span seats name the owner on each row of their sheet, as in the side quest games: a Setup line has the first player pick a hero of any player (Entering the Mines, 03064:A:1; families/encounter/seated.ts). Absent in every other game.
  seatedRows?: true;
  // The Setup lines of the players' heroes and contracts have been pushed (families/sidequests/setup.ts).
  playerSetup?: true;
  // The loot decks (The Burglar's Turn, 22024): the cards each seat chose at deckbuilding (`lootPlan`, codes), and the ids of the
  // loot deck each seat has built, top card first (families/sidequests/loot.ts).
  lootPlan?: readonly (readonly string[])[];
  lootDecks?: readonly (readonly string[])[];
  // The cards a player removed from the campaign pool during the game ("remove it from the campaign pool"), with the seat that
  // held the copy; the campaign log drops that entry when the scenario is won (campaign/log.ts).
  removedFromPool?: readonly { code: string; seat: number | null }[];
  // The campaign log's structured facts, when the scenario was started in Campaign Mode with any (CampaignFacts).
  campaignFacts?: CampaignFacts;
  // The Hard/Expert Mode card to put next to the quest deck at the end of setup (dcce.hard-expert); finishSetup places it.
  modeCard?: { code: string; side: "A" | "B" };
  // The cards the campaign card's Setup let each seat choose and the Resolution earns (Galdor's Counsel, 11182:A:2): the code and the seat that chose it, whether the copy is now in a hand, in play, in a
  // discard pile or in the victory display, and the cards a Forced effect of the campaign card gave (11194:A:3). Their number is the "for each of those copies" an amount reads (`plusChosen`); absent in a game with none.
  chosenAtSetup?: readonly { code: string; seat: number }[];
  // The pursuit value of The Uruk-hai (mec112.pursuit): the pursuit tracker beside the quest deck. Absent while the scenario sets none; the `pursuit` condition reads it.
  pursuit?: number;
  // Whether the encounter deck placed progress on the current quest stage itself in the last quest resolution under the Defense keyword (mec112.defense); absent in a game that never resolves one. The `encounterPlacedOnStage` condition reads it.
  defensePlaced?: boolean;
  // The cards each seat adds to its hand once every player has finished the mulligan (AddToHandAfterMulligan), by seat; dealt and
  // dropped when the opening hands are final.
  afterMulligan?: readonly (readonly string[])[];
  // Cost reductions waiting for the next matching card a seat plays (ReduceNextCost). They end with the phase or the round.
  discounts?: readonly Discount[];
  // The player cards played from a hand this round, in order ("the first time you played a copy of ~ this round", "the first
  // Rohan ally you play each round"). Only this round's are kept.
  // `paid`: the pools that paid for it and how much each (Linhir Sea-captain's "paid all of its cost from a single hero").
  // `phase`: the phase it was played in when that was not the Planning phase ("the first non-unique card you play each planning phase").
  played?: readonly { id: string; code: string; seat: number; round: number; phase?: string; paid?: readonly { heroId: string; amount: number }[] }[];
  // The allies that entered play this round and the clock reading the count was taken at, in a game whose cards limit it (LimitEntries, families/sea/entries.ts).
  entries?: { round: number; mark: number; count: number; bySeat?: readonly number[] };
  // The cards that spent resources this round ("each hero ... that did not spend any resources this round").
  spent?: { round: number; ids: readonly string[] };
  // This round's quest (rr.step-3-4): the characters committed to it, and the seats whose quest succeeded ("If you quest
  // successfully this phase", "After Hirgon quests successfully"). Kept only in a game that reads it (families/costs/pay.ts).
  quested?: { round: number; committed: readonly string[]; succeeded: readonly number[]; failed?: readonly number[] };
  // Each seat's starting threat level (rr.initial-threat-level), kept at setup only when a card of the game reads it (04053:A:2).
  startingThreat?: readonly number[];
  // The seats a card in play keeps in the game at the threat elimination level (10124:A:2): eliminateEmpties asks that card
  // instead of eliminating the seat. settle keeps it current (families/quest/threat.ts).
  threatSaves?: readonly number[];
  // The seats that control an ally in play which can gain the hero card type (Prince Imrahil, 145005:A:1): a seat with no heroes left
  // is not eliminated until the play sweep has given that ally the type (families/play/sweep.ts, rr.card-types).
  heroSavers?: readonly number[];
  // The main quest card in play prints the Dire keyword (mec113.dire, families/black-gate/dire.ts): each seat's threat elimination level is 99. Kept by settle; absent otherwise.
  dire?: true;
  // The Fortitude tests players failed this round (mec113.fortitude-tests, families/mount-doom/failures.ts), for "if a player has failed a Fortitude test this round". Kept only once a test is failed; the round ends them.
  fortitudeFailures?: readonly HideFailure[];
  // The Embassy from the Dark Tower (146072:B:1, families/black-gate/embassy.ts): the player cards placed faceup in front of the players and the encounter cards placed faceup (all lie set aside, faceup, while the Embassy lasts), the pairs made in the order they were
  // paired, and how many pairs the running effect has taken (`at`: the pair it is on is `pairs[at - 1]`). Kept from EmbassyDeal to EmbassyEnd.
  embassy?: { readonly players: readonly string[]; readonly encounter: readonly string[]; readonly pairs: readonly { readonly player: string; readonly encounter: string }[]; readonly at: number };
  // The stage the quest left when it advanced to `to` past stages that were never played (AdvanceToStage, families/quest/branch.ts noteSkippedStage): "After a quest card is defeated" names it.
  stageLeft?: { to: string; from: string; bypassed?: true };
  // Escape from Mount Gram's captured cards (families/captured/): the Capture X each card prints by code, the codes that are "in each player's staging area" and the cards of those codes now in play (`here`), the rescue the running
  // effect made (the cards it returned to hands), and the permanent boons a hero held when it was put into the captured deck, set aside until the hero returns (boon id, hero id). Absent in every other game.
  capture?: { x: Readonly<Record<string, number>>; everyArea: readonly string[]; here: readonly string[]; instead: readonly string[]; refresh?: true; none?: boolean };
  rescued?: readonly string[];
  heroBoons?: readonly (readonly [string, string])[];
  undo: UndoLog;
};
