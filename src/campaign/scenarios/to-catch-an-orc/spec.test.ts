// Rules: rm.out-of-play-deck, rm.searches-x, rm.time-x, rr.forced, rr.constant-ability, rr.the-word-choose, rr.effects, rr.then, rr.explored, rr.attachment-cards, rr.setup (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, defend, exhausted, flag, handCount, lost, progressOn, quest, resourcesOn, respond, reveal, resolve, stat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";
import type { Dealt } from "../../../../test/harness/layout.ts";

// Card specs for To Catch an Orc (the-ring-maker part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// The verbs' own cases (the Setup deal with 1 and 2 players, a Search with fewer cards than X, an empty hand, a held card, the Guard's sweep) are in src/rules/families/ring-maker/outofplay.test.ts; the rows here
// run the printed cards on the moments the lines name. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; dh1 and dh2 are the first seat's, dh3 the second's.
const MUGASH = "07024";
const GUARD = "07025";
const METHEDRAS_ORC = "07026";
const METHEDRAS = "07027";
const ORC_CAVE = "07028";
const LAIR = "07029";
const TERRITORY = "07030";
const SKIRMISHER = "07038";
const HUNTER = "07039";
const HOUND = "07040";
const PARTY = "07041";
const WOLF = "07053";
const LANDS = "07054";
const COVER = "07055";
const STAGE_1 = "07062";
const STAGE_2 = "07063";
const STAGE_3 = "07064";
// A card of an out-of-play deck of the first seat: the owner is the seat, so a discard goes to its pile.
const MUGASH_ON_DH1 = { code: MUGASH, to: "dh1", encounter: true } as const;
const MUGASH_ON_DH2 = { code: MUGASH, to: "dh2", encounter: true } as const;
const MUGASH_ON_DH3 = { code: MUGASH, to: "dh3", encounter: true } as const;
const dealt = (n: number, code = "filler", seat?: number): Dealt[] => Array.from({ length: n }, () => (seat === undefined ? code : { code, seat }));

const ROWS: readonly Row[] = [
  // 07062 Orders from Orthanc. Setup: the out-of-play decks; side B: each player searches a Mountain location, then the quest advances.
  { line: "07062:A:1", name: "Setup: one player moves 20 cards into his out-of-play deck and Mugash joins them; the Guards stay aside", layout: { stage: STAGE_1, side: "A", deckOf: dealt(25), setAside: [MUGASH, GUARD, GUARD, GUARD] }, act: resolve(STAGE_1, "setup"), expect: [count("filler", "outOfPlay0", 20), count(MUGASH, "outOfPlay0", 1), count(GUARD, "setAside", 3)] },
  { line: "07062:A:1", name: "Setup: two players each move 20 cards, and Mugash and one Guard are dealt one to each deck", layout: { seats: 2, stage: STAGE_1, side: "A", deckOf: dealt(25), setAside: [MUGASH, GUARD, GUARD, GUARD] }, act: resolve(STAGE_1, "setup"), expect: [count("filler", "outOfPlay0", 20), count("filler", "outOfPlay1", 20), count(GUARD, "setAside", 2)] },
  { line: "07062:B:1", name: "When Revealed: each player adds a Mountain location from the deck to the staging area and the quest advances", layout: { seats: 2, stage: STAGE_1, deck: ["f0", METHEDRAS, ORC_CAVE, "f0"] }, act: resolve(STAGE_1, "whenRevealed"), expect: [zone(METHEDRAS, "staging"), zone(ORC_CAVE, "staging"), zone(STAGE_2, "questStage")] },

  // 07063 Searching for Mugash: Time 2, the Forced effect of the last counter and the Response.
  { line: "07063:B:1", name: "Time 2: the stage the players advance to holds 2 time counters", layout: { stage: STAGE_1, progress: 0, deck: ["f0"] }, act: resolve(STAGE_1, "whenRevealed"), expect: resourcesOn(STAGE_2, 2) },
  { line: "07063:B:2", name: "Forced: after the last counter the encounter discard pile is shuffled in, 2 cards are revealed for each player and 2 counters go on the stage", layout: { stage: STAGE_2, discard: [WOLF] }, act: announce("lastTimeCounterRemoved", STAGE_2), expect: [zone(WOLF, "staging"), resourcesOn(STAGE_2, 2)] },
  { line: "07063:B:3", name: "Response: after a successful quest the progress is cancelled and a time counter is placed", layout: { stage: STAGE_2, timeCounters: 1, deck: ["f0"] }, act: [quest("success"), respond(STAGE_2)], expect: [progressOn(STAGE_2, 0), resourcesOn(STAGE_2, 2)] },
  { line: "07063:B:3", name: "Response: with Mugash in play the players advance to stage 3 instead, with its 3 counters", layout: { stage: STAGE_2, timeCounters: 1, attached: [MUGASH_ON_DH2], deck: ["f0"] }, act: [quest("success"), respond(STAGE_2), answer("advance")], expect: [zone(STAGE_3, "questStage"), resourcesOn(STAGE_3, 3)] },
  { line: "07063:B:3", name: "Response: when the active location took all the progress nothing is cancelled and no counter is placed", layout: { stage: STAGE_2, timeCounters: 1, active: LANDS, attached: [MUGASH_ON_DH2], deck: ["f0"] }, act: [quest("success"), respond(STAGE_2)], expect: [zone(STAGE_3, "questStage"), resourcesOn(STAGE_2, 1), progressOn(LANDS, 4)] },

  // 07064 The Wizard's Prize: Time 3, the Forced effect of the last counter, no progress without Mugash on a hero, and the win.
  { line: "07064:B:2", name: "Forced: after the last counter Mugash goes back to the staging area, 1 card is revealed per other player and 3 counters go on the stage", layout: { seats: 2, stage: STAGE_3, attached: [MUGASH_ON_DH3], deck: [WOLF, "f0"] }, act: announce("lastTimeCounterRemoved", STAGE_3), expect: [zone(MUGASH, "staging"), zone(WOLF, "staging"), resourcesOn(STAGE_3, 3)] },
  { line: "07064:B:2", name: "Forced: a solo game reveals no card, and Mugash in the staging area stays there", layout: { stage: STAGE_3, staging: [MUGASH], deck: [WOLF, "f0"] }, act: announce("lastTimeCounterRemoved", STAGE_3), expect: [zone(MUGASH, "staging"), zone(WOLF, "encounterDeck"), resourcesOn(STAGE_3, 3)] },
  { line: "07064:B:3", name: "No progress is placed on the stage while Mugash is not attached to a hero", layout: { stage: STAGE_3 }, act: quest("success"), expect: progressOn(STAGE_3, 0) },

  // 07024 Mugash: attached to a hero by his Forced effect, the hero cannot ready, and the players lose if it leaves play.
  { line: "07024:A:2", name: "Forced: after he is defeated the first player attaches him to a hero he controls and exhausts it", layout: { seats: 2, firstPlayer: 1, engaged: [{ code: MUGASH, seat: 0 }] }, act: announce("enemyDestroyed", MUGASH), expect: [zone(MUGASH, "attached"), exhausted("dh3"), exhausted("dh1", false)] },
  { line: "07024:A:2", name: "Forced: an exhausted hero takes him too, as the exhaustion is an effect and no cost", layout: { engaged: [HOUND, { code: MUGASH, seat: 0 }] }, act: [announce("engaged", HOUND), answer("dh1"), announce("enemyDestroyed", MUGASH), answer("dh1")], expect: [zone(MUGASH, "attached"), exhausted("dh1")] },
  { line: "07024:A:2", name: "The attached hero cannot ready", layout: { attached: [MUGASH_ON_DH1] }, act: [], expect: [flag("dh1", "cannotReady"), flag("dh2", "cannotReady", false)] },
  { line: "07024:A:2", name: "The players lose when the hero leaves play, also when Mugash goes back to the staging area in the same step", layout: { attached: [MUGASH_ON_DH1], engaged: [GUARD] }, act: attack(GUARD, { undefended: true }), expect: [lost, zone(MUGASH, "staging")] },

  // 07025 Mugash's Guard: engages the holder of Mugash; when it destroys a character Mugash returns to the staging area.
  { line: "07025:A:1", name: "A Guard in the staging area engages the player who controls the hero Mugash is attached to", layout: { seats: 2, staging: [GUARD], attached: [MUGASH_ON_DH3] }, act: announce("cardsDrawn", undefined, { seat: 0, amount: 1 }), expect: zone(GUARD, "engaged") },
  { line: "07025:A:2", name: "Forced: after it destroys a character Mugash returns to the staging area", layout: { attached: [MUGASH_ON_DH2], engaged: [GUARD] }, act: attack(GUARD, { undefended: true }), expect: zone(MUGASH, "staging") },

  // 07026 Methedras Orc: shuffles a random hand card into the out-of-play deck; the Shadow takes a time counter off when it destroys a character.
  { line: "07026:A:1", name: "Forced: when it attacks the defending player shuffles a random card of his hand into his out-of-play deck", layout: { engaged: [METHEDRAS_ORC], hand: ["ally"], piles: { outOfPlay0: ["filler", "filler"] } }, act: attack(METHEDRAS_ORC, { undefended: true }), expect: [handCount(0), count("ally", "outOfPlay0", 1), count("filler", "outOfPlay0", 2)] },
  { line: "07026:A:2", name: "Shadow: if the attack destroys a character a time counter comes off the current quest", layout: { stage: STAGE_2, timeCounters: 2, engaged: [GUARD] }, act: attack(GUARD, { shadow: METHEDRAS_ORC, undefended: true }), expect: resourcesOn(STAGE_2, 1) },

  // 07027 Methedras and 07028 Orc Cave: Threat while active and Searches X when explored.
  { line: "07027:A:1", name: "While Methedras is the active location each location in the staging area gets +1 Threat", layout: { active: METHEDRAS, staging: [LANDS] }, act: [], expect: stat(LANDS, "threat", 3) },
  { line: "07027:A:2", name: "Forced: explored, each player Searches 3: the enemy joins the staging area, 1 other card goes to the hand, the rest are discarded", layout: { active: METHEDRAS, piles: { outOfPlay0: [HOUND, "ally", "event", "filler"] } }, act: [announce("leftPlay", METHEDRAS, { explored: true }), answer("ally")], expect: [zone(HOUND, "staging"), handCount(1), count("event", "discard", 1), count("filler", "outOfPlay0", 1)] },
  { line: "07027:A:2", name: "Forced: with fewer than 3 cards left the player reveals the ones he has", layout: { active: METHEDRAS, piles: { outOfPlay0: ["ally"] } }, act: announce("leftPlay", METHEDRAS, { explored: true }), expect: [handCount(1), count("ally", "outOfPlay0", 0)] },
  { line: "07028:A:1", name: "Forced: explored, the first player Searches 5 and the other player searches nothing", layout: { seats: 2, active: ORC_CAVE, piles: { outOfPlay0: [HOUND, "ally", "event", "filler", "filler", "filler"], outOfPlay1: ["ally"] } }, act: [announce("leftPlay", ORC_CAVE, { explored: true }), answer("ally")], expect: [zone(HOUND, "staging"), handCount(1, 0), handCount(0, 1), count("filler", "discard", 2), count("event", "discard", 1), count("ally", "outOfPlay1", 1)] },
  { line: "07028:A:2", name: "Travel: the top X cards of the encounter deck are discarded and each Orc among them joins the staging area", layout: { seats: 2, phase: "Travel", staging: [ORC_CAVE], deck: [HUNTER, "place", WOLF] }, act: travel(ORC_CAVE), expect: [zone(HUNTER, "staging"), zone("place", "encounterDiscard"), zone(WOLF, "encounterDeck")] },

  // 07029 Mugash's Lair.
  { line: "07029:A:1", name: "Forced: at the beginning of the encounter phase each player reveals his top out-of-play card: an enemy joins the staging area, any other card is discarded", layout: { seats: 2, active: LAIR, phase: "Encounter", piles: { outOfPlay0: ["ally", "filler"], outOfPlay1: [HOUND] } }, act: announce("beginningOfPhase", LAIR), expect: [count("ally", "discard", 1), count("filler", "outOfPlay0", 1), zone(HOUND, "staging")] },
  { line: "07029:A:1", name: "Forced: a player whose out-of-play deck is empty reveals nothing", layout: { seats: 2, active: LAIR, phase: "Encounter", piles: { outOfPlay0: ["ally"] } }, act: announce("beginningOfPhase", LAIR), expect: [count("ally", "discard", 1), handCount(0, 1)] },
  { line: "07029:A:2", name: "Shadow: the defending player discards an attachment he controls", layout: { attached: [{ code: "attachment", to: "dh1" }], engaged: ["f0"] }, act: [attack("f0", { shadow: LAIR }), defend("dh1")], expect: count("attachment", "discard", 1) },
  // 07030 Orc Territory.
  { line: "07030:A:1", name: "When Revealed: the location is added to the staging area and, with the staging Threat below the committed Willpower, each engaged Orc attacks", layout: { deck: [LANDS, "f0"], engaged: [HUNTER], committed: ["dh1", "dh2"] }, act: reveal(TERRITORY), expect: [zone(LANDS, "staging"), window("defense")] },
  { line: "07030:A:1", name: "When Revealed: with the staging Threat not below the committed Willpower no Orc attacks", layout: { deck: [LANDS, "f0"], staging: [WOLF, ORC_CAVE], engaged: [HUNTER], committed: ["dh1", "dh2"] }, act: reveal(TERRITORY), expect: [zone(LANDS, "staging"), window("defense", false)] },

  // 07038 to 07041, 07053 to 07055: the Misty Mountain Orcs and Broken Lands.
  { line: "07038:A:1", name: "Forced: the engaged player deals 3 damage to one character he controls", layout: { engaged: [SKIRMISHER], stage: STAGE_2, timeCounters: 2 }, act: [announce("engaged", SKIRMISHER), answer("damage"), answer("dh2")], expect: [damageOn("dh2", 3), damageOn("dh1", 0), resourcesOn(STAGE_2, 2)] },
  { line: "07038:A:1", name: "Forced: or a time counter comes off the current quest", layout: { engaged: [SKIRMISHER], stage: STAGE_2, timeCounters: 2 }, act: [announce("engaged", SKIRMISHER), answer("time")], expect: [resourcesOn(STAGE_2, 1), damageOn("dh1", 0)] },
  { line: "07038:A:1", name: "Forced: with no time counter on the quest only the damage is offered", layout: { engaged: [SKIRMISHER], stage: STAGE_1 }, act: [announce("engaged", SKIRMISHER), answer("dh1")], expect: damageOn("dh1", 3) },
  { line: "07039:A:1", name: "When Revealed: the first player reveals 1 more encounter card", layout: { staging: [], deck: [WOLF, "f0"], stage: STAGE_2, timeCounters: 2 }, act: [reveal(HUNTER), answer("reveal")], expect: [zone(WOLF, "staging"), resourcesOn(STAGE_2, 2)] },
  { line: "07039:A:1", name: "When Revealed: or a time counter comes off the current quest", layout: { deck: [WOLF, "f0"], stage: STAGE_2, timeCounters: 2 }, act: [reveal(HUNTER), answer("time")], expect: [zone(WOLF, "encounterDeck"), resourcesOn(STAGE_2, 1)] },
  { line: "07040:A:2", name: "Forced: after it engages a player he exhausts a character he controls", layout: { engaged: [HOUND] }, act: [announce("engaged", HOUND), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false)] },
  { line: "07041:A:1", name: "When Revealed: each Orc enemy in play gets -15 engagement cost", layout: { engaged: [HUNTER], staging: [METHEDRAS_ORC], deck: ["f0", "f0"] }, act: reveal(PARTY), expect: [stat(HUNTER, "engagementCost", 20), stat(METHEDRAS_ORC, "engagementCost", 15), count("f0", "shadow", 2)] },
  { line: "07041:A:1", name: "When Revealed: with no Orc enemy in the staging area the card gains surge", layout: { engaged: [HUNTER], deck: ["f0", WOLF, "f0"] }, act: reveal(PARTY), expect: zone(WOLF, "staging") },
  { line: "07053:A:1", name: "While engaged it gets +1 Attack for each location in the staging area", layout: { engaged: [WOLF], staging: [LANDS, ORC_CAVE] }, act: [], expect: stat(WOLF, "attack", 3) },
  { line: "07053:A:2", name: "Shadow: the defending player exhausts a character he controls", layout: { engaged: ["f0"] }, act: [attack("f0", { shadow: WOLF, undefended: true }), answer("dh2")], expect: exhausted("dh2") },
  { line: "07054:A:1", name: "While Broken Lands is in the staging area progress cannot be placed on locations in the staging area", layout: { staging: [LANDS, METHEDRAS] }, act: [], expect: [flag(METHEDRAS, "noProgressPlaced"), flag(LANDS, "noProgressPlaced")] },
  { line: "07054:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each location in the staging area", layout: { staging: [ORC_CAVE, METHEDRAS], engaged: ["f0"] }, act: attack("f0", { shadow: LANDS, undefended: true }), expect: damageOn("dh1", 3) },
  { line: "07055:A:2", name: "When Revealed: the first player has 1 damage dealt to each exhausted character", layout: { engaged: [HOUND], stage: STAGE_2, timeCounters: 2 }, act: [announce("engaged", HOUND), answer("dh1"), reveal(COVER), answer("damage")], expect: [damageOn("dh1", 1), damageOn("dh2", 0), resourcesOn(STAGE_2, 2)] },
  { line: "07055:A:2", name: "When Revealed: or a time counter comes off the current quest", layout: { engaged: [HOUND], stage: STAGE_2, timeCounters: 2 }, act: [announce("engaged", HOUND), answer("dh1"), reveal(COVER), answer("time")], expect: [damageOn("dh1", 0), resourcesOn(STAGE_2, 1)] },
  { line: "07055:A:2", name: "When Revealed: with no exhausted character only the time counter is offered", layout: { stage: STAGE_2, timeCounters: 2 }, act: reveal(COVER), expect: resourcesOn(STAGE_2, 1) },
];

if (ROWS.length > 0) cardSpecs("to-catch-an-orc", ROWS);
else describe("to-catch-an-orc card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
