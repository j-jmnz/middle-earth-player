// Bump when a change to the engine can move a game that was replayed from its intents: a rule, a verb, the shuffle,
// the order of ids. A save made on another engine version drops its open scenario and keeps its log.
// 10 (phase 29): a controlled objective ally with printed combat stats (Gildor, Mendor) is an ally for every pick of a character or an ally,
// which can add a candidate to a choice of a replayed Fellowship game.
// 11 (phase 32 review): a location whose Response puts progress on the quest (Goblin Trail, 41014:A:2) is answered after the stage its progress
// advanced reveals, and The Eaves of Mirkwood bars only the Responses that cancel: both can move a replayed game of The Oath.
// 12: a full quest stage that was held back advances as soon as nothing holds it (To the River... once no Hill Troll is in play),
// not at the next quest resolution (stage-reveal.ts, advanceFreed): a replayed game can reach the next stage sooner.
// 13 (main, phases 15 and 16 review): while a Peril card's staging resolves, an "any player may" Response is offered only to the revealing seat, in every scenario
// (mec109.peril, responses.ts), which can leave out an offer of a replayed game; the Breaking of the Fellowship fixes (the extra reveals of stage 4B, Drums in the
// Deep, the first player lock, the 4B Response) move only that scenario.
// 14 (main): an enemy that attacks from the staging area makes the additional attack its shadow grants, and its shadow card's "after this attack" effect runs, whether or not
// the enemy is flagged (the Balrog, the Watcher in the Water, Uruk from Mordor, a Storm of Howls attacker); Lost in the Dark's "no progress" choice holds for the table
// (the lasting ModifyStat `table` target): replayed Ring Goes South, Journey in the Dark and Caves of Nibin-Dûm games can move.
// 15 (main): a two-seat planning phase goes on in player order from the first player, so seat 0 has its planning window in a round seat 1 is first (it had
// none, pass.ts); a "cannot attack" effect (Mr. Underhill, Feint and every other BarAttack) used on the enemy attacking that player, before its damage, ends that
// attack (effect-verbs.ts): replayed
// two-seat games of every scenario can move.
// 13 (Dream-chaser, phase 39 review): the quest phase lists Commit only in its pass window, so an attack window with no usable Action
// skips instead of opening (Battle-fury played in the quest phase): a replayed game can take a different path.
// 14 (Dream-chaser, phase 39b review): a Sailing test shifts the heading off-course as it opens, before the commit (dcce.sailing-tests, step 1), and holds the
// cards looked at for a Done when no symbol is left to answer, so a replayed Sailing game has one more window and a different heading while it commits.
// 15 (Dream-chaser, phase 40): a ship-enemy's Boarding resolves as its own event after the Responses to the engagement, a damage effect of an encounter or campaign card
// reaches a card that is immune to player card effects (DamageCard), a shadow effect that reveals an encounter card runs in a frame, a quest stage that prints
// Victory goes to the victory display in a game with ships, and a quest ordered by its quest deck advances in that order: a replayed Sailing or Boarding game
// takes a different path.
// 16 (Dream-chaser, phase 40 fix pass): naming a card (NameCard) offers the title of every card of the game, not the titles in the decks; the excess damage of Sudden Storms'
// attack is its own number (0 with none, no longer the characters destroyed); Ballista's Response is heard after its Ship has attacked; the Hard and Expert Mode
// card hold against every effect, and the Expert card raises threat only for a heal or ready a player card made: a replayed Voyage Across Belegaer game can offer
// a different choice or take a different path.
// 17: the merge of the separate-staging engine (phases 15 and 16: a staging area and a quest stage for each seat) and the Dream-chaser engine (phases 37 to 40: sea,
// ships, the Heading card, Corsairs): a replayed game of either side keeps its path, and a save made before the merge drops its open scenario.
// 18 (Dream-chaser, phase 41 fix pass): the Scramble in A Fateful Discovery changes which card lies behind each Lost Island instead of the places of the instances, an explored
// location is heard by the Fate quest cards when it leaves play (in the staging area too) and a double-sided one reaches the victory display on its real side, Revenant holds its
// damage limit as a constant, a quest stage takes the progress of a quest effect as questing does, and the campaign card's Ominous Fate XP line is taken once: a replayed
// Fate of Númenor or Voyage Across Belegaer game can take a different path.
// 19 (Dream-chaser, phase 43): a Pick from an objective ally that has an encounter card back (a ship-objective, Calaerion, Calphon) is not a player card effect (dcce.encounter-cards), so it can target
// cards that are immune to player card effects, and the Corsair Skiff offers its Boarding branch only while the Corsair deck or its discard pile holds a card: a replayed Voyage Across Belegaer,
// Fate of Númenor or Raid on the Grey Havens game can take a different path.
export const ENGINE_VERSION = 19;
