// Rules: rr.guarded, rr.objective-cards, rr.attachment-cards, rr.first-player, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.search, sotm.reset-the-quest-deck (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, defend, endPhase, exhausted, flag, handCount, progressOn, quest, resolve, resourcesOn, respond, reveal, revealedBy, stagingThreat, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Hunt for Gollum (shadows-of-mirkwood part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (a host, a cost, a legal intent, a card field)
// is a test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side. A Clue "attached" in a layout is a claimed one.
const CLUE = "02014";
const OLD_FORD = "02015";
const NINGLOR = "02017";
const EAST = "02018";
const WEST = "02019";
const HUNTERS = "02021";
const WITH_CLUE = [{ code: CLUE, to: "dh1" }] as const;

const ROWS: readonly Row[] = [
  { line: "02011:A:1", name: "Setup: each player reveals 1 encounter card", layout: { seats: 2, deck: ["f0", "f3"] }, act: resolve("02011", "setup"), expect: [revealedBy("f0", 0), revealedBy("f3", 1)] },
  { line: "02011:B:1", name: "the first player (the second seat here) looks at the top 3, reveals 1 and discards the other 2", layout: { seats: 2, firstPlayer: 1, progress: 0, deck: ["f0", "f0", "f3", "treachery", "place", "f0"] }, act: [quest("success"), answer("f3")], expect: [revealedBy("f3", 1), zone("treachery", "encounterDiscard"), zone("place", "encounterDiscard")] },
  { line: "02012:B:1", name: "the first player (the second seat here) looks at the top 2, reveals 1 and discards the other", layout: { seats: 2, firstPlayer: 1, stage: "02012", phase: "Planning", deck: ["f0", "f3", "place", "place", "place", "treachery"] }, act: [endPhase, endPhase, answer("f3")], expect: [revealedBy("f3", 1), zone("f0", "encounterDiscard")] },
  { line: "02013:B:1", name: "the quest deck resets to stage 2B, with no progress on the quest, when no hero has a Clue attached", layout: { stage: "02013", progress: 5 }, act: [announce("endOfPhase")], expect: [zone("02012", "questStage"), zone("02013", "questDeck"), progressOn("02012", 0)] },
  { line: "02014:A:1", name: "Guarded: the next encounter card is revealed and guards it when it is revealed", layout: { deck: ["f3", "f0"] }, act: reveal(CLUE), expect: [revealedBy("f3", 0), zone(CLUE, "staging")] },
  { line: "02014:A:2", name: "Response after a successful quest: the claim attaches it to a committed hero", layout: { stage: "02012", progress: 8, staging: [CLUE] }, act: [quest("success"), respond(CLUE), answer("dh1")], expect: zone(CLUE, "attached") },

  { line: "02015:A:1", name: "Threat X is the number of ally cards in play, every player's", layout: { seats: 2, play: ["ally", { code: "ally", seat: 1 }], staging: [OLD_FORD] }, act: [], expect: stagingThreat(2) },
  { line: "02015:A:2", name: "Shadow: allies with a printed cost lower than the Riverland locations in play (staging area included) are discarded", layout: { staging: [NINGLOR, EAST], play: ["ally"] }, act: attack("f3", { shadow: OLD_FORD }), expect: zone("ally", "discard") },

  { line: "02017:A:1", name: "while it is the active location, 1 progress comes off the current quest at the end of the round", layout: { progress: 3, active: NINGLOR }, act: announce("endOfRound"), expect: progressOn("02011", 2) },
  { line: "02017:A:2", name: "Shadow: 1 progress comes off the current quest", layout: { progress: 3 }, act: attack("f3", { shadow: NINGLOR }), expect: progressOn("02011", 2) },
  { line: "02017:A:2", name: "and 2 when the attack is undefended", layout: { progress: 3 }, act: attack("f3", { shadow: NINGLOR, undefended: true }), expect: progressOn("02011", 1) },

  { line: "02018:A:2", name: "Shadow: with no Clue hero the enemy returns to the staging area after its attack", layout: {}, act: attack("f3", { shadow: EAST }), expect: zone("f3", "staging") },
  { line: "02019:A:2", name: "Shadow: with no Clue hero the enemy's base Attack is added once more for this attack", layout: {}, act: attack("f3", { shadow: WEST, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "02020:A:1", name: "each player discards the top card of his deck: the Threat rises by the printed costs", layout: { seats: 2, deckOf: [{ code: "c3", seat: 0 }, { code: "c2", seat: 1 }] }, act: reveal("02020"), expect: [stat("02020", "threat", 6), zone("c3", "discard")] },

  { line: "02021:A:1", name: "+2 Attack for each Clue card in play: one in the staging area, one on a hero", layout: { staging: [HUNTERS, CLUE], attached: WITH_CLUE }, act: [], expect: [stat(HUNTERS, "attack", 6), stat(HUNTERS, "threat", 6)] },
  { line: "02021:A:2", name: "Shadow: 1 damage to each hero with a Clue attached, whoever controls it", layout: { seats: 2, attached: [{ code: CLUE, to: "dh3" }] }, act: [attack("f3", { shadow: HUNTERS }), defend("dh2")], expect: [damageOn("dh3", 1), damageOn("dh1", 0), damageOn("dh2", 0)] },
  { line: "02021:A:2", name: "and 3 when the attack is undefended", layout: { attached: [{ code: CLUE, to: "dh2" }] }, act: attack("f3", { shadow: HUNTERS, undefended: true }), expect: [damageOn("dh2", 3), damageOn("dh1", 1)] },

  { line: "02022:A:1", name: "the first player shuffles a Clue card from the staging area into the encounter deck", layout: { staging: [CLUE], deck: ["f0"] }, act: reveal("02022"), expect: [zone(CLUE, "encounterDeck")] },
  { line: "02022:A:1", name: "a Clue attached to a hero goes back too", layout: { attached: WITH_CLUE, deck: ["f0"] }, act: reveal("02022"), expect: zone(CLUE, "encounterDeck") },
  { line: "02022:A:1", name: "with no Clue card in play it gains Surge: the next card is revealed", layout: { deck: ["f3"] }, act: reveal("02022"), expect: revealedBy("f3", 0) },

  { line: "02023:A:2", name: "all progress comes off every Riverland location, the staging area's included", layout: { staging: [{ code: NINGLOR, progress: 2 }, { code: EAST, progress: 1 }, { code: "place", progress: 1 }], deck: ["f0"] }, act: reveal("02023"), expect: [progressOn(NINGLOR, 0), progressOn(EAST, 0), progressOn("place", 1)] },
  { line: "02023:A:3", name: "Shadow: its When Revealed effect is resolved", layout: { staging: [{ code: NINGLOR, progress: 2 }] }, act: attack("f3", { shadow: "02023" }), expect: progressOn(NINGLOR, 0) },
  { line: "02024:A:1", name: "each hero discards 1 resource", layout: { heroResources: 2, deck: ["f0"] }, act: reveal("02024"), expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1), exhausted("dh1", false)] },
  { line: "02024:A:1", name: "and a hero with none to discard exhausts", layout: { deck: ["f0"] }, act: reveal("02024"), expect: [exhausted("dh1"), exhausted("dh2")] },

  { line: "900402:A:1", name: "Ravenous Hawk comes out of the cards the stage looks at and is put into play engaged with the player", layout: { stage: "02012", deck: ["900402", "f3", "place"] }, act: [announce("beginningOfPhase")], expect: [zone("900402", "engaged"), zone("f3", "staging"), zone("place", "encounterDeck")] },
  { line: "900403:A:1", name: "Hunting Warg that entered play this round fetches Hunters from Mordor at the beginning of the refresh phase", layout: { phase: "Combat", deck: ["f0", HUNTERS] }, act: [reveal("900403"), endPhase], expect: zone(HUNTERS, "staging") },
  { line: "900404:A:2", name: "Shadow: a player controlling no Clue discards the whole hand", layout: { hand: ["filler", "filler"] }, act: attack("f3", { shadow: "900404" }), expect: handCount(0) },
  { line: "900405:A:2", name: "Shadow: the attacker gets +1 Defense for each Clue card in play until the end of the round", layout: { staging: [CLUE, CLUE] }, act: attack("f3", { shadow: "900405" }), expect: stat("f3", "defense", 3) },
  { line: "900406:A:1", name: "no progress is placed on it while it is in the staging area", layout: { staging: ["900406"] }, act: [], expect: flag("900406", "noProgressPlaced") },
  { line: "900407:A:1", name: "When Revealed: a Clue card of the encounter discard pile is attached to a Mordor enemy, with no Surge", layout: { staging: [HUNTERS], discard: [CLUE], deck: ["f3"] }, act: reveal("900407"), expect: [zone(CLUE, "staging"), zone("f3", "encounterDeck")] },
  { line: "900407:A:1", name: "and Surge when no Clue card could be attached", layout: { staging: [HUNTERS], deck: ["f3"] }, act: reveal("900407"), expect: revealedBy("f3", 0) },
  { line: "900407:A:2", name: "Shadow: the Clue card is attached to a Mordor enemy in play", layout: { staging: [HUNTERS], discard: [CLUE] }, act: attack("f3", { shadow: "900407" }), expect: zone(CLUE, "staging") },
  { line: "900408:A:3", name: "Shadow: an undefended attack's damage goes to a hero with a Clue attached", layout: { attached: [{ code: CLUE, to: "dh2" }] }, act: attack("f3", { shadow: "900408", undefended: true }), expect: [damageOn("dh2", 1), damageOn("dh1", 0)] },
  { line: "900409:A:1", name: "The Trail Goes Cold attached to the active location: the location's Threat counts in the staging area", layout: { active: NINGLOR, deck: ["f0"] }, act: reveal("900409"), expect: stagingThreat(2) },
  { line: "900409:A:2", name: "and it gains Surge when no location is active", layout: { deck: ["f3"] }, act: reveal("900409"), expect: revealedBy("f3", 0) },
];

if (ROWS.length > 0) cardSpecs("the-hunt-for-gollum", ROWS);
else describe("the-hunt-for-gollum card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
