// Bump when a change to the engine can move a game that was replayed from its intents: a rule, a verb, the shuffle,
// the order of ids. A save made on another engine version drops its open scenario and keeps its log.
// 10 (phase 29): a controlled objective ally with printed combat stats (Gildor, Mendor) is an ally for every pick of a character or an ally,
// which can add a candidate to a choice of a replayed Fellowship game.
// 11 (phase 32 review): a location whose Response puts progress on the quest (Goblin Trail, 41014:A:2) is answered after the stage its progress
// advanced reveals, and The Eaves of Mirkwood bars only the Responses that cancel: both can move a replayed game of The Oath.
export const ENGINE_VERSION = 11;
