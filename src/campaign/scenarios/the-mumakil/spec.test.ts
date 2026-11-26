// Rules: rr.forced, rr.response, rr.victory, rr.engaged, rr.staging, rr.attachment-cards, rr.shadow-effects, rr.travel, rr.cannot, rr.blank, rr.explored (data/rules/entries.json); ledger lines of The Mûmakil (data/printed/haradrim.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, defend, deckCount, flag, quest, resolve, respond, reveal, stat, threat, travel, window, zone, attackersOf, committed, endPhase, notWon, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Mûmakil (haradrim part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The cases a row cannot express (an empty deck, a destroyed defender) are tests titled with their line id in lines.test.ts.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28. The Wild Mûmak has 9 hit points; the stand-in enemies f0 and f3 have Threat 0 and 3, Attack 1.
const STAGE_1 = "17026";
const STAGE_2 = "17027";
const MUMAK = "17015";
const TRAIL = "17020";
const WEAK = { code: MUMAK, seat: 0, damage: 6 } as const;

const ROWS: readonly Row[] = [
  // 17011:A:1 "Response: After the attached enemy is dealt any amount of damage, the engaged player shuffles his deck and discards the top card. If the discarded card's cost is equal to or greater than the attached enemy's remaining hit points, add Horse-hair Lasso and attached enemy to the victory display." (A real damage event is needed to offer it: lines.test.ts.)
  // 17012:A:1 "Response: After the players quest successfully, the engaged player discards the top card of the encounter deck. If its Threat is equal to or greater than the attached enemy's remaining hit points, add Poisoned Spear and attached enemy to the victory display." The Mûmak has 3 hit points left; the card has Threat 3.
  { line: "17012:A:1", name: "Response: a discarded encounter card with as much Threat as the enemy's remaining hit points sends the Spear and the Mûmak to the victory display", layout: { stage: STAGE_2, side: "B", engaged: [WEAK], attached: [{ code: "17012", to: MUMAK, encounter: true }], deck: ["f0", "f3", "f0"] }, act: [quest("success"), respond("17012")], expect: [zone("17012", "victory"), zone(MUMAK, "victory"), zone("f3", "encounterDiscard")] },

  // 17013:A:1 "Response: After the players travel to a location, if its printed Threat is equal to or greater than the attached enemy's remaining hit points, the engaged player adds Pit Trap and attached enemy to the victory display." Mûmak Trail has Threat 2; the Mûmak has 2 hit points left.
  { line: "17013:A:1", name: "Response: a location with as much printed Threat as the enemy's remaining hit points sends the Pit Trap and the Mûmak to the victory display", layout: { stage: STAGE_2, side: "B", phase: "Travel", staging: [TRAIL], engaged: [{ code: MUMAK, seat: 0, damage: 7 }], attached: [{ code: "17013", to: MUMAK, encounter: true }] }, act: [travel(TRAIL), respond("17013")], expect: [zone("17013", "victory"), zone(MUMAK, "victory")] },

  // 17014:A:1 "Response: After a character defends an attack against the attached enemy, if the defending character has more remaining hit points than the attached enemy, add Noose of Vines and attached enemy to the victory display." The hero keeps 2 of 6 hit points; the Mûmak has 1 left.
  { line: "17014:A:1", name: "Response: a defender with more remaining hit points than the enemy sends the Noose and the Mûmak to the victory display", layout: { stage: STAGE_2, side: "B", engaged: [{ code: MUMAK, seat: 0, damage: 8 }], attached: [{ code: "17014", to: MUMAK, encounter: true }], deck: ["f0", "f0"] }, act: [attack(MUMAK), respond("17014")], expect: [zone("17014", "victory"), zone(MUMAK, "victory")] },

  // 17015:A:2 "Cannot take more than 3 damage each round."
  { line: "17015:A:2", name: "Cannot take more than 3 damage each round", layout: { stage: STAGE_2, side: "B", engaged: [MUMAK] }, act: [], expect: stat(MUMAK, "damageCap", 3) },

  // 17015:A:3 "Forced: At the end of the round, the engaged player must choose: either return Wild Mûmak to the staging area, or Wild Mûmak makes an immediate attack against that player (it is dealt a shadow card and stays engaged)."
  { line: "17015:A:3", name: "Forced: the option staging returns the Mûmak to the staging area", layout: { stage: STAGE_2, side: "B", engaged: [MUMAK] }, act: [announce("endOfRound"), answer("staging")], expect: zone(MUMAK, "staging") },
  { line: "17015:A:3", name: "Forced: the option attack makes the Mûmak attack the engaged player, dealt a shadow card, and it stays engaged", layout: { stage: STAGE_2, side: "B", engaged: [MUMAK], deck: ["f0", "f0"] }, act: [announce("endOfRound"), answer("attack")], expect: [window("defense"), zone(MUMAK, "engaged"), deckCount(1)] },

  // 17016:A:1 "Cannot be optionally engaged." An engagement check still engages it (engagement cost 0).
  { line: "17016:A:1", name: "Cannot be optionally engaged, yet the engagement check engages it", layout: { stage: STAGE_2, side: "B", phase: "Encounter", staging: ["17016"] }, act: endPhase, expect: [flag("17016", "cannotBeOptionallyEngaged"), zone("17016", "engaged")] },

  // 17016:A:2 "Forced: After Harad Tiger attacks and destroys a character, return it to the staging area." The Tiger (Attack 4) destroys the ally.
  { line: "17016:A:2", name: "Forced: the Tiger that destroys a character returns to the staging area", layout: { stage: STAGE_2, side: "B", play: ["ally"], deck: ["f0"] }, act: [attack("17016"), defend("ally")], expect: [zone("ally", "discard"), zone("17016", "staging")] },

  // 17016:A:3 "Shadow: Attacking enemy makes an additional attack against you after this one."
  { line: "17016:A:3", name: "Shadow: the attacking enemy makes an additional attack against the defender", layout: { deck: ["f0", "f0"] }, act: attack("f0", { shadow: "17016" }), expect: attackersOf("dh1", ["f0", "f0"]) },

  // 17017:A:1 "Territorial Ape gets +X Threat and +X Attack, where X is the Threat of the active location." Mûmak Trail has Threat 2; the Ape has Threat 2 and Attack 2.
  { line: "17017:A:1", name: "+X Threat and +X Attack, X the Threat of the active location", layout: { stage: STAGE_2, side: "B", active: TRAIL, staging: ["17017"] }, act: [], expect: [stat("17017", "threat", 4), stat("17017", "attack", 4)] },

  // 17017:A:2 "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if a location was explored this round)." The attacker f0 has Attack 1; undefended, the hero takes 2 (the explored case is in lines.test.ts).
  { line: "17017:A:2", name: "Shadow: the attacking enemy gets +1 Attack when no location was explored", layout: { stage: STAGE_2, side: "B", deck: ["f0"] }, act: attack("f0", { shadow: "17017", undefended: true }), expect: damageOn("dh1", 2) },

  // 17018:A:2 "Forced: After Strangling Python damages a character, attach it to that character. (Counts as a Condition attachment with 'Attached character cannot ready'.)" The hero keeps 3 of 6 hit points.
  { line: "17018:A:2", name: "Forced: the Python that damages a character attaches to it, and the character cannot ready", layout: { stage: STAGE_2, side: "B", deck: ["f0"] }, act: attack("17018", { undefended: true }), expect: [zone("17018", "attached"), flag("dh1", "cannotReady"), damageOn("dh1", 3)] },

  // 17019:A:1 "Forced: After Giant Centipede damages a character, treat that character's text box as if it were blank until the end of the round."
  { line: "17019:A:1", name: "Forced: the character the Centipede damages has a blank text box", layout: { stage: STAGE_2, side: "B", deck: ["f0"] }, act: attack("17019", { undefended: true }), expect: flag("dh1", "blankText") },
  // 17019:A:2 "Shadow: Treat the defending character's text box as blank until the end of the round."
  { line: "17019:A:2", name: "Shadow: the defending character has a blank text box", layout: { deck: ["f0"] }, act: attack("f0", { shadow: "17019" }), expect: flag("dh1", "blankText") },

  // 17020:A:1 "While active, Response: When Mûmak Trail leaves play as an explored location, search the encounter deck and discard pile for a Wild Mûmak and add it to the staging area. Shuffle the encounter deck." It resolves before stage 1B's Forced effect shuffles a set-aside Mûmak in: the encounter deck holds none yet, so none is found and the Forced effect's Mûmak waits in the deck.
  { line: "17020:A:1", name: "Response: the explored Trail adds a Wild Mûmak from the encounter deck to the staging area (its order against stage 1B is in lines.test.ts)", layout: { stage: STAGE_1, active: TRAIL, deck: ["f0", MUMAK], setAside: [MUMAK] }, act: [quest("success"), respond(TRAIL)], expect: [count(MUMAK, "staging", 1), count(MUMAK, "encounterDeck", 1)] },
  // 17020:A:2 "Travel: Raise each player's threat by 1 to travel here."
  { line: "17020:A:2", name: "Travel: each player raises his threat by 1", layout: { stage: STAGE_2, side: "B", phase: "Travel", staging: [TRAIL] }, act: travel(TRAIL), expect: threat(30) },

  // 17021:A:2 "When Revealed: Choose a Wild Mûmak in the staging area to attack the first player. If no attacks were made, search the encounter deck and discard pile for Mûmak Trail, add it to the staging area. Shuffle the encounter deck."
  { line: "17021:A:2", name: "When Revealed: a Mûmak in the staging area attacks the first player and stays in the staging area", layout: { stage: STAGE_2, side: "B", staging: [MUMAK], deck: ["f0", TRAIL] }, act: reveal("17021"), expect: [window("defense"), zone(MUMAK, "staging"), zone(TRAIL, "encounterDeck")] },
  { line: "17021:A:2", name: "When Revealed: with no Mûmak in the staging area Mûmak Trail comes from the encounter deck", layout: { stage: STAGE_2, side: "B", deck: ["f0", TRAIL] }, act: reveal("17021"), expect: zone(TRAIL, "staging") },

  // 17022:A:1 "When Revealed: Each player discards the top 5 cards of his deck, then discards each card he controls that shares a title with one of those 5 cards."
  { line: "17022:A:1", name: "When Revealed: a card the player controls with the title of a discarded card is discarded", layout: { stage: STAGE_2, side: "B", play: ["ally"], deckOf: ["ally", "filler", "filler", "filler", "filler", "filler"] }, act: reveal("17022"), expect: [count("ally", "play", 0), count("ally", "discard", 2)] },
  // 17022:A:2 "Shadow: Attacking enemy gets +1 Attack. If this attack destroys a character, return attacking enemy to the staging area."
  { line: "17022:A:2", name: "Shadow: an enemy that destroys a character returns to the staging area", layout: { play: ["ally"], deck: ["f0"] }, act: [attack(MUMAK, { shadow: "17022" }), defend("ally")], expect: [zone("ally", "discard"), zone(MUMAK, "staging")] },

  // 17023:A:1 "When Revealed: The first player chooses a hero committed to the quest. Remove that hero from the quest and attach Terrible Fever to it. (Counts as a Condition attachment: 'Forced: At the end of the round, deal 1 damage to attached character.')"
  { line: "17023:A:1", name: "When Revealed: the committed hero is removed from the quest and the Fever attaches to it", layout: { stage: STAGE_2, side: "B", phase: "Quest", committed: ["dh1"] }, act: reveal("17023"), expect: [committed("dh1", false), zone("17023", "attached")] },
  // 17023:A:2 "Shadow: Defending character cannot ready until the end of the round."
  { line: "17023:A:2", name: "Shadow: the defending character cannot ready", layout: { deck: ["f0"] }, act: attack("f0", { shadow: "17023" }), expect: flag("dh1", "cannotReady") },

  // 17024:A:1 "When Revealed: Each player discards a random card from his hand and assigns X damage among characters he controls. X is the discarded card's cost." The card costs 2.
  { line: "17024:A:1", name: "When Revealed: the player assigns damage equal to the cost of the discarded card", layout: { stage: STAGE_2, side: "B", hand: ["c2"] }, act: reveal("17024"), expect: [count("c2", "discard", 1), damageOn("dh1", 2)] },
  // 17024:A:2 "Shadow: Discard a random card from your hand and assign X damage among characters you control. X is the discarded card's cost." The ally defends and takes 1.
  { line: "17024:A:2", name: "Shadow: the defending player discards a card and assigns damage equal to its cost", layout: { play: ["ally"], hand: ["c2"], deck: ["f0"] }, act: [attack("f0", { shadow: "17024" }), defend("ally")], expect: [count("c2", "discard", 1), damageOn("dh1", 2)] },

  // 17025:A:1 "Each location gets +1 Threat." Mûmak Trail has Threat 2.
  { line: "17025:A:1", name: "Each location gets +1 Threat", layout: { stage: STAGE_2, side: "B", staging: ["17025", TRAIL] }, act: [], expect: stat(TRAIL, "threat", 3) },
  // 17025:A:2 "Forced: When Guardians of the Jungle becomes the current quest, search the encounter deck and discard pile for a Territorial Ape and put it into play engaged with the first player."
  { line: "17025:A:2", name: "Forced: a Territorial Ape is put into play engaged with the first player", layout: { stage: STAGE_2, side: "B", seats: 2, firstPlayer: 1, staging: ["17025"], deck: ["f0", "17017"] }, act: announce("becameCurrentQuest", "17025"), expect: zone("17017", "engaged") },

  // 17026:A:1 "Setup: Set aside the Wild Mûmak and Capture objectives. Each player in turn chooses a location with a different title and adds it to the staging area. Shuffle the encounter deck."
  { line: "17026:A:1", name: "Setup: each player adds a location of another title to the staging area from the encounter deck", layout: { stage: STAGE_1, seats: 2, deck: ["16056", "16056", "16057", "f0"] }, act: resolve("17026", "setup"), expect: [zone("16056", "staging"), zone("16057", "staging"), count("16056", "encounterDeck", 1), flag("table", "noteExplored")] },
  // 17026:B:1 "Forced: After the active location leaves play as an explored location, shuffle 1 set-aside Wild Mûmak into the encounter deck."
  { line: "17026:B:1", name: "Forced: a set-aside Wild Mûmak is shuffled into the encounter deck", layout: { stage: STAGE_1, active: { code: "16056", progress: 1 }, deck: ["f0"], setAside: [MUMAK] }, act: quest("success"), expect: zone(MUMAK, "encounterDeck") },
  // 17026:B:2 "The players cannot advance unless the number of Wild Mûmak in play is equal to the number of players."
  { line: "17026:B:2", name: "The players cannot advance while the Wild Mûmak in play are fewer than the players", layout: { stage: STAGE_1, seats: 2, staging: [MUMAK], progress: 12 }, act: quest("success"), expect: zone(STAGE_1, "questStage") },
  { line: "17026:B:2", name: "The players cannot advance while the Wild Mûmak in play are more than the players", layout: { stage: STAGE_1, engaged: [MUMAK, MUMAK], progress: 12 }, act: quest("success"), expect: zone(STAGE_1, "questStage") },

  // 17027:A:1 "When Revealed: Starting with the first player, each player attaches 1 random set-aside Capture objective to a Wild Mûmak in play of his choice."
  { line: "17027:A:1", name: "When Revealed: the player attaches a random set-aside Capture to a Wild Mûmak", layout: { stage: STAGE_2, side: "A", staging: [MUMAK], setAside: ["17011"] }, act: resolve("17027", "whenRevealed"), expect: zone("17011", "attached") },
  // 17027:B:1 "Forced: At the beginning of the quest phase, if there is no active location, reveal an additional encounter card this phase."
  { line: "17027:B:1", name: "Forced: with no active location one more encounter card is revealed in the quest phase", layout: { stage: STAGE_2, side: "B", phase: "Planning", deck: ["f0", "f0", "f0"] }, act: [endPhase, endPhase], expect: deckCount(1) },
  // 17027:B:2 "This stage cannot be defeated while there are any Capture objectives in play. If the players defeat this stage, they win the game."
  { line: "17027:B:2", name: "This stage is not defeated while a Capture objective is in play, so the game is not won", layout: { stage: STAGE_2, side: "B", staging: [MUMAK], attached: [{ code: "17011", to: MUMAK, encounter: true }], progress: 99 }, act: endPhase, expect: notWon },
];

if (ROWS.length > 0) cardSpecs("the-mumakil", ROWS);
else describe("the-mumakil card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
