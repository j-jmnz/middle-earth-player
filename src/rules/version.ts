// Bump when a change to the engine can move a game that was replayed from its intents: a rule, a verb, the shuffle,
// the order of ids. A save made on another engine version drops its open scenario and keeps its log.
// 10 (phase 29): a controlled objective ally with printed combat stats (Gildor, Mendor) is an ally for every pick of a character or an ally,
// which can add a candidate to a choice of a replayed Fellowship game.
// 11 (phase 32 review): a location whose Response puts progress on the quest (Goblin Trail, 41014:A:2) is answered after the stage its progress
// advanced reveals, and The Eaves of Mirkwood bars only the Responses that cancel: both can move a replayed game of The Oath.
// 12: a full quest stage that was held back advances as soon as nothing holds it (To the River... once no Hill Troll is in play),
// not at the next quest resolution (stage-reveal.ts, advanceFreed): a replayed game can reach the next stage sooner.
// 13 (phase 39 review): the quest phase lists Commit only in its pass window, so an attack window with no usable Action
// skips instead of opening (Battle-fury played in the quest phase): a replayed game can take a different path.
// 14 (phase 39b review): a Sailing test shifts the heading off-course as it opens, before the commit (dcce.sailing-tests, step 1), and holds the
// cards looked at for a Done when no symbol is left to answer, so a replayed Sailing game has one more window and a different heading while it commits.
// 15 (phase 40): a ship-enemy's Boarding resolves as its own event after the Responses to the engagement, a damage effect of an encounter or campaign card
// reaches a card that is immune to player card effects (DamageCard), a shadow effect that reveals an encounter card runs in a frame, a quest stage that prints
// Victory goes to the victory display in a game with ships, and a quest ordered by its quest deck advances in that order: a replayed Sailing or Boarding game
// takes a different path.
// 16 (phase 40 fix pass): naming a card (NameCard) offers the title of every card of the game, not the titles in the decks; the excess damage of Sudden Storms'
// attack is its own number (0 with none, no longer the characters destroyed); Ballista's Response is heard after its Ship has attacked; the Hard and Expert Mode
// card hold against every effect, and the Expert card raises threat only for a heal or ready a player card made: a replayed Voyage Across Belegaer game can offer
// a different choice or take a different path.
export const ENGINE_VERSION = 16;
