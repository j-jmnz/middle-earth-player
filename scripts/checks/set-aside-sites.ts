// The engine functions that put a card in the set-aside zone, or draw with the game's seed in a file that reads the set-aside cards, file by file, each file sorted into what the table's
// Set aside list does with those cards (src/play/store/set-aside.ts; docs/design-system-table.md, Reading panels):
//   - `public`: named by the Setup or by the card, or seen by the players before it was set aside. The list names it.
//   - `secret`: the players must not see it (a random pick left facedown, a facedown deck). Its `verbs` each have an AsideSecret in their family (src/catalog/family-manifest.ts), so the list only counts it.
//   - `notListed`: no set-aside card in the players' sense: a quest stage, the options of a choice, a loot deck, the sets a kit's Quick-build left out.
// A file that both sets cards aside in the open and hides some is `secret`. `functions` are the top-level functions of the file that hold a site.
//
// What set-aside-sites.test.ts holds: a file with a site is listed here, and its `functions` are exactly the functions that hold one, so a new function that sets a card aside (or a new seeded
// draw) fails until someone reads it and sorts it; a `secret` file names verbs, and each has a declaration. What it cannot hold: it reads source text, so it misses a destination kept in a variable
// or built by a helper, a call from another file to a listed function, a new site added inside a listed function, and a verb that hides a card where it lies with no seeded draw. A reviewer
// of a new set-aside verb checks those by hand (docs/agents/effect-authoring.md, Mechanic families).
export type AsideGroup = "public" | "secret" | "notListed";
export type AsideSite = { readonly functions: readonly string[]; readonly group: AsideGroup; readonly why: string; readonly verbs?: readonly string[] };

export const ASIDE_SITES: Readonly<Record<string, AsideSite>> = {
  "core/destroy.ts": { functions: ["defeatedDestination"], group: "notListed", why: "A quest card that is discarded or defeated goes set aside; quest cards are never listed." },
  "setup/setup.ts": { functions: ["mulliganSeat", "shuffleZone", "startScenario"], group: "public", why: "The cards a player's campaign answer sets aside at Setup: the player named them." },
  "setup/search.ts": { functions: ["searchSetup"], group: "public", why: "A card whose Setup effect runs waits set aside while it resolves; the Setup names it." },
  "setup/verbs.ts": { functions: ["runSetupVerb"], group: "public", why: "SetAside: the cards the scenario's Setup names. The engine's facedown default says nothing; a card the Setup hides is declared by the verb that hides it (HideSuspectAndHideout, ShuffleRandomSetAside)." },
  "interpret/verbs.ts": { functions: ["discardRandom", "shuffleEncounterDeck"], group: "public", why: "AddSetAsideToStaging and the shuffles take named set-aside cards out; none is put there." },
  "families/angmar/set-aside.ts": { functions: ["takeOrSpawnSetAside"], group: "public", why: "A named copy from the supply, faceup." },
  "families/angmar/burdens.ts": { functions: ["attachRandomBurden"], group: "public", why: "AttachRandomBurden attaches one of the named burdens faceup; the players see which, so the rest are known." },
  "families/angmar/ettenmoors.ts": { functions: ["stageRandomGuardedPair"], group: "public", why: "StageRandomGuardedPair reveals its pair; the safe locations and side quests left were named by the Setup." },
  "families/armies/advance.ts": { functions: ["jointAdvance"], group: "notListed", why: "The other stages played together are set aside when the quest advances; quest stages are never listed." },
  "families/armies/stages.ts": { functions: ["putStagesIntoPlay"], group: "notListed", why: "The Battle of Five Armies' stage that puts the others into play is set aside; quest stages are never listed." },
  "families/attachments/dial.ts": { functions: ["detachFromDial"], group: "public", why: "DetachFromDial: a named card comes back from a threat dial." },
  "families/attachments/play.ts": { functions: ["startGuard"], group: "public", why: "A guarded player card waits faceup while its guard is searched." },
  "families/black-gate/embassy.ts": { functions: ["layFaceup"], group: "public", why: "The embassy's row is laid faceup." },
  "families/breaking/areas.ts": { functions: ["discardArea"], group: "notListed", why: "A seat's quest stage." },
  "families/breaking/index.ts": { functions: ["advanceToStage", "discardSharedStage", "shuffleSetAsideIntoDiscard", "startRandomSeparateStage"], group: "notListed", why: "Quest stages, the random separate stage among them." },
  "families/burgle/stack.ts": { functions: ["stackUnder"], group: "public", why: "StackUnder: the Setup names the Erebor treasures; they leave the set-aside zone to lie facedown under The Lonely Mountain, so none stays set aside and the shuffle only orders the stack." },
  "families/campaign/aside.ts": { functions: ["setAsideHeroWithAttachments", "setAsideLogged"], group: "public", why: "A named hero with his attachments, and the cards the campaign log records." },
  "families/campaign/index.ts": { functions: ["run"], group: "public", why: "SetAsideEachPlayer: a named card for each player." },
  "families/captured/deck.ts": { functions: ["prepareCapturedDeck", "setAsideCapturedBoons"], group: "public", why: "The boons of a captured hero, faceup; the captured deck is not in the set-aside zone." },
  "families/captured/join.ts": { functions: ["advanceTogether", "join"], group: "notListed", why: "A seat's quest stage." },
  "families/captured/rescue.ts": { functions: ["rescueRandom"], group: "public", why: "The boons set aside for a hero come back to it." },
  "families/caves/index.ts": { functions: ["setAsideInPlay"], group: "public", why: "SetAsideInPlay: a named card leaves play in front of the players (Cold-Drake, with its damage)." },
  "families/deck/moves.ts": { functions: ["shuffleSeatDeck"], group: "notListed", why: "A seat's own deck is shuffled with the game's seed; no set-aside card is drawn or hidden." },
  "families/encounter/replace-deck.ts": { functions: ["replaceEncounterDeck"], group: "public", why: "A named set leaves the set-aside zone for the new encounter deck." },
  "families/investigation/deck.ts": { functions: ["hideSuspectAndHideout", "removeRandomInvestigation"], group: "secret", why: "The Suspect and the Hideout the seed picks stay set aside facedown (50701:A:1).", verbs: ["HideSuspectAndHideout"] },
  "families/haradrim/orcs-stage.ts": { functions: ["defeatOrcsStage"], group: "notListed", why: "The Orcs' stage the Orcs defeat goes set aside as the next one takes its place; quest stages are never listed." },
  "families/haradrim/capture.ts": { functions: ["attachRandomSetAside"], group: "public", why: "AttachRandomSetAside attaches one of the Captures the Setup named, faceup; the players see which, so the Captures left set aside are known." },
  "families/island/cards.ts": { functions: ["placeSecrets", "shuffleIntoPlayerDeck"], group: "public", why: "PlaceSecrets moves the named cards under the Temple locations, where they are hidden; none stays set aside." },
  "families/misc/collection.ts": { functions: ["choose"], group: "notListed", why: "The cards a choice offers out of the collection (`collection`)." },
  "families/nightmare/dungeon.ts": { functions: ["takeMorePrisoners"], group: "public", why: "Reads a named set-aside copy, or the stage set aside when it was defeated." },
  "families/nightmare/index.ts": { functions: ["setAsideFromDeck"], group: "public", why: "SetAsideFromDeck: every copy of a named card." },
  "families/pelargir/underworld.ts": { functions: ["buildUnderworldDeck", "hideOneAside"], group: "secret", why: "The underworld deck lies set aside facedown and the Villain and the Plot the seed picks stay set aside facedown (06011:A:1); the others leave the game.", verbs: ["BuildUnderworldDeck", "HideOneAside"] },
  "families/pelargir/hidden.ts": { functions: ["randomHidden", "takeHidden"], group: "secret", why: "A hidden card is the top card of the encounter deck set aside facedown in a player's play area, and a random pick among them stays unseen (06117:B:1, 06128:A:3).", verbs: ["TakeHiddenCard"] },
  "families/pelargir/stage-remove.ts": { functions: ["removeStage"], group: "notListed", why: "RemoveStage: a quest stage taken out of the quest deck is set aside; quest stages are never listed." },
  "families/poison/stages.ts": { functions: ["advanceOtherPlayers"], group: "notListed", why: "The shared quest stage a lone player leaves is set aside; quest stages are never listed." },
  "families/quest/branch.ts": { functions: ["branchFrom"], group: "notListed", why: "Quest stages." },
  "families/ring-maker/outofplay.ts": { functions: ["shuffleHandCardIntoOutOfPlay", "shuffleIntoOutOfPlayDecks"], group: "public", why: "ShuffleIntoOutOfPlayDecks takes the Setup's named Mugash and Guards out of the set-aside zone into the facedown out-of-play decks (a zone of its own, no table pile); the Guards left stay set aside and named. ShuffleHandCardIntoOutOfPlay is a seeded draw from a hand, not from the set-aside cards." },
  "families/sea/dreadnaught.ts": { functions: ["engageRandomSetAside"], group: "public", why: "EngageRandomSetAside puts its pick into play at once; the enemies left were named by the Setup." },
  "families/sea/random.ts": { functions: ["shuffleRandomSetAside"], group: "secret", why: "Each Send for Help is set aside facedown, and the ones left would tell which went into the encounter deck (dcce.campaign-setup-a-storm-on-cobas-haven). A pick among copies of one card (Gondorian Warship) hides nothing.", verbs: ["ShuffleRandomSetAside"] },
  "families/sea/swap.ts": { functions: ["setAsideEncounterDeck"], group: "secret", why: "The first encounter deck lies set aside facedown (12148:B:1).", verbs: ["SetAsideEncounterDeck"] },
  "families/sea/takeover.ts": { functions: ["setAsideSelf"], group: "public", why: "SetAsideSelf: the source card leaves play in front of the players." },
  "families/sidequests/encounter.ts": { functions: ["setAsideEncounterCards"], group: "public", why: "A player's own cards with the Encounter keyword." },
  "families/sidequests/loot.ts": { functions: ["dealLootDeck"], group: "notListed", why: "A seat's loot deck: a shuffled deck (`lootDecks`)." },
  "families/stormcaller/stage.ts": { functions: ["advanceStormcaller"], group: "notListed", why: "The Stormcaller's quest stage." },
  "families/uncharted/deck.ts": { functions: ["scramble"], group: "public", why: "A named Lost Island joins the staging area." },
  "families/wilderland/discard-pool.ts": { functions: ["setAsideDiscardForPool"], group: "public", why: "SetAsideDiscardForPool: the top card of the faceup discard pile." },
  "families/wilderland/flip.ts": { functions: ["flipOver"], group: "public", why: "FlipOver: a card in play, turned to the side its text names." },
  "families/wilderland/gundabad.ts": { functions: ["flipCurrentQuest", "shuffleDeck"], group: "notListed", why: "A quest stage." },
  "families/wilderland/hide.ts": { functions: ["hideRandomLoot"], group: "public", why: "HideRandomLoot moves every named Loot out of the set-aside zone, one under a card and the rest into the deck; none stays." },
  "families/wilderland/mirkwood.ts": { functions: ["freeTreasures"], group: "public", why: "A treasure free of encounters waits while the first player picks its bearer." },
  "families/wilderland/moria.ts": { functions: ["chooseStageToFlip"], group: "notListed", why: "A quest stage." },
  "families/wilderland/random-stage.ts": { functions: ["leaveStage", "randomStageFrom"], group: "notListed", why: "A quest stage." },
  "families/wilderland/treasure.ts": { functions: ["attachRandomTreasure", "claimRandomTreasure", "drawTreasures", "take"], group: "public", why: "The random treasure is dealt faceup for the players to claim." },
  "families/wizards-quest/hidden.ts": { functions: ["revealHidden"], group: "secret", why: "The cards Hidden Threat hid wait set aside facedown for their reveal, one at a time (51241:A:1).", verbs: ["HideUnderQuest"] },
  "families/wizards-quest/quick.ts": { functions: ["buildQuickDeck", "setAside"], group: "notListed", why: "The Quick-build's sets left out are no part of the game (BuildQuickDeck declares them, AsideUnused); the quest cards not chosen are quest cards." },
  "families/wizards-quest/top.ts": { functions: ["searchTopReveal"], group: "public", why: "SearchTopReveal: the card is revealed at once." },
};
