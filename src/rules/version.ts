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
export const ENGINE_VERSION = 13;
