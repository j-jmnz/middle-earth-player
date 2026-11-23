// The engine files that put a card in the set-aside zone, or draw at random among the set-aside cards, each sorted into what the table's Set aside list does with those cards
// (src/play/store/set-aside.ts; docs/design-system-table.md, Reading panels):
//   - `public`: named by the Setup or by the card, or seen by the players before it was set aside. The list names it.
//   - `secret`: the players must not see it (a random pick left facedown, a facedown deck). Its `verbs` each have an AsideSecret in their family (src/catalog/family-manifest.ts), so the list only counts it.
//   - `notListed`: no set-aside card in the players' sense: a quest stage, the options of a choice, a loot deck, the sets a kit's Quick-build left out.
// set-aside-sites.test.ts fails while a file with such a site is not here, so a new verb is sorted when it is written. A file both sets cards aside in the open and hides some is `secret`.
export type AsideGroup = "public" | "secret" | "notListed";
export type AsideSite = { readonly group: AsideGroup; readonly why: string; readonly verbs?: readonly string[] };

export const ASIDE_SITES: Readonly<Record<string, AsideSite>> = {
  "core/keywords.ts": { group: "notListed", why: "A quest card that is discarded or defeated goes set aside; quest cards are never listed." },
  "setup/setup.ts": { group: "public", why: "The cards a player's campaign answer sets aside at Setup: the player named them." },
  "setup/search.ts": { group: "public", why: "A card whose Setup effect runs waits set aside while it resolves; the Setup names it." },
  "setup/verbs.ts": { group: "public", why: "SetAside: the cards the scenario's Setup names. The engine's facedown default says nothing; a card the Setup hides is declared by the verb that hides it (HideSuspectAndHideout, ShuffleRandomSetAside)." },
  "interpret/verbs.ts": { group: "public", why: "AddSetAsideToStaging and the shuffles take named set-aside cards out; none is put there." },
  "families/angmar/set-aside.ts": { group: "public", why: "A named copy from the supply, faceup." },
  "families/angmar/burdens.ts": { group: "public", why: "AttachRandomBurden attaches one of the named burdens faceup; the players see which, so the rest are known." },
  "families/angmar/ettenmoors.ts": { group: "public", why: "StageRandomGuardedPair reveals its pair; the safe locations and side quests left were named by the Setup." },
  "families/attachments/dial.ts": { group: "public", why: "DetachFromDial: a named card comes back from a threat dial." },
  "families/attachments/play.ts": { group: "public", why: "A guarded player card waits faceup while its guard is searched." },
  "families/black-gate/embassy.ts": { group: "public", why: "The embassy's row is laid faceup." },
  "families/breaking/areas.ts": { group: "notListed", why: "A seat's quest stage." },
  "families/breaking/index.ts": { group: "notListed", why: "Quest stages, the random separate stage among them." },
  "families/campaign/aside.ts": { group: "public", why: "A named hero with his attachments, and the cards the campaign log records." },
  "families/campaign/index.ts": { group: "public", why: "SetAsideEachPlayer: a named card for each player." },
  "families/captured/deck.ts": { group: "public", why: "The boons of a captured hero, faceup; the captured deck is not in the set-aside zone." },
  "families/captured/join.ts": { group: "notListed", why: "A seat's quest stage." },
  "families/captured/rescue.ts": { group: "public", why: "The boons set aside for a hero come back to it." },
  "families/caves/index.ts": { group: "public", why: "SetAsideInPlay: a named card leaves play in front of the players (Cold-Drake, with its damage)." },
  "families/encounter/replace-deck.ts": { group: "public", why: "A named set leaves the set-aside zone for the new encounter deck." },
  "families/investigation/deck.ts": { group: "secret", why: "The Suspect and the Hideout the seed picks stay set aside facedown (50701:A:1).", verbs: ["HideSuspectAndHideout"] },
  "families/island/cards.ts": { group: "public", why: "PlaceSecrets moves the named cards under the Temple locations, where they are hidden; none stays set aside." },
  "families/misc/collection.ts": { group: "notListed", why: "The cards a choice offers out of the collection (`collection`)." },
  "families/nightmare/dungeon.ts": { group: "public", why: "Reads a named set-aside copy, or the stage set aside when it was defeated." },
  "families/nightmare/index.ts": { group: "public", why: "SetAsideFromDeck: every copy of a named card." },
  "families/quest/branch.ts": { group: "notListed", why: "Quest stages." },
  "families/sea/dreadnaught.ts": { group: "public", why: "EngageRandomSetAside puts its pick into play at once; the enemies left were named by the Setup." },
  "families/sea/random.ts": { group: "secret", why: "Each Send for Help is set aside facedown, and the ones left would tell which went into the encounter deck (dcce.campaign-setup-a-storm-on-cobas-haven).", verbs: ["ShuffleRandomSetAside"] },
  "families/sea/swap.ts": { group: "secret", why: "The first encounter deck lies set aside facedown (12148:B:1).", verbs: ["SetAsideEncounterDeck"] },
  "families/sea/takeover.ts": { group: "public", why: "SetAsideSelf: the source card leaves play in front of the players." },
  "families/sidequests/encounter.ts": { group: "public", why: "A player's own cards with the Encounter keyword." },
  "families/sidequests/loot.ts": { group: "notListed", why: "A seat's loot deck: a shuffled deck (`lootDecks`)." },
  "families/stormcaller/stage.ts": { group: "notListed", why: "The Stormcaller's quest stage." },
  "families/uncharted/deck.ts": { group: "public", why: "A named Lost Island joins the staging area." },
  "families/wilderland/discard-pool.ts": { group: "public", why: "SetAsideDiscardForPool: the top card of the faceup discard pile." },
  "families/wilderland/flip.ts": { group: "public", why: "FlipOver: a card in play, turned to the side its text names." },
  "families/wilderland/gundabad.ts": { group: "notListed", why: "A quest stage." },
  "families/wilderland/hide.ts": { group: "public", why: "HideRandomLoot moves every named Loot out of the set-aside zone, one under a card and the rest into the deck; none stays." },
  "families/wilderland/mirkwood.ts": { group: "public", why: "A treasure free of encounters waits while the first player picks its bearer." },
  "families/wilderland/moria.ts": { group: "notListed", why: "A quest stage." },
  "families/wilderland/random-stage.ts": { group: "notListed", why: "A quest stage." },
  "families/wilderland/treasure.ts": { group: "public", why: "The random treasure is dealt faceup for the players to claim." },
  "families/wizards-quest/hidden.ts": { group: "secret", why: "The cards Hidden Threat hid wait set aside facedown for their reveal, one at a time (51241:A:1).", verbs: ["HideUnderQuest"] },
  "families/wizards-quest/quick.ts": { group: "notListed", why: "The Quick-build's sets left out are no part of the game (BuildQuickDeck declares them, AsideUnused); the quest cards not chosen are quest cards." },
  "families/wizards-quest/top.ts": { group: "public", why: "SearchTopReveal: the card is revealed at once." },
};
