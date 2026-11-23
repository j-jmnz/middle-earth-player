// Rules: hob.setup-over-the-misty-mountains-grim, hob.active-and-inactive-encounter-decks, hob.bilbo-baggins-ohauh, rr.reveal, rr.search, rr.victory, rr.shadow-effects, rr.delayed-effects (data/rules/entries.json); docs/scenarios/the-hobbit.md (Over the Misty Mountains Grim).
import { announce, answer, attack, cardSpecs, committed, count, damageOn, endPhase, flag, progressOn, quest, resourcesOn, resolve, reveal, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Over the Misty Mountains Grim (the-hobbit part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
const GIANT = "131064";
const BOULDERS = "131072";
const AXEMAN = "131058";
const GOBLIN_KING = "131063";
const PORCH = "131066";
const ROOM = "131067";
const HIGH_PASS = "131069";
const CHAOS = "131071";
const BENT_SWORDS = "131062";

const ROWS: readonly Row[] = [
  { line: "131072:A:1", name: "When Revealed: the first player's questing character takes 3 damage and leaves the quest", layout: { stage: "131027", committed: ["dh1"] }, act: resolve(BOULDERS, "whenRevealed"), expect: [damageOn("dh1", 3), committed("dh1", false)] },
  { line: "131064:A:1", name: "a Stone-Giant in the staging area gives Galloping Boulders surge", layout: { stage: "131027", staging: [GIANT], committed: ["dh1"], deck: ["f3", "f0"] }, act: reveal(BOULDERS), expect: [zone("f3", "staging")] },
  { line: "131027:B:1", name: "When Revealed: a Stone-Giant is found in the encounter deck and the first player reveals a card", layout: { stage: "131027", deck: ["f0", GIANT, "f0", "f0"] }, act: resolve("131027", "whenRevealed"), expect: [zone(GIANT, "staging")] },
  { line: "131073:A:1", name: "When Revealed: the Stone-Giant in the staging area engages the player with the highest threat at the end of the quest phase", layout: { stage: "131027", seats: 2, threat: [30, 35], phase: "Quest", staging: [GIANT] }, act: [resolve("131073", "whenRevealed"), endPhase], expect: [zone(GIANT, "engaged")] },
  { line: "131073:A:1", name: "with no Stone-Giant in the staging area one is found in the encounter deck and stays in the staging area", layout: { stage: "131027", phase: "Quest", deck: ["f0", GIANT, "f0"] }, act: [resolve("131073", "whenRevealed"), endPhase], expect: [zone(GIANT, "staging")] },
  { line: "131072:A:2", name: "Shadow: the card goes on top of the encounter deck", layout: { stage: "131027" }, act: attack("f3", { shadow: BOULDERS, undefended: true }), expect: [zone(BOULDERS, "encounterDeck")] },
  { line: "131028:A:1", name: "When Revealed: the first deck is set aside, the second deck becomes the encounter deck and The Great Goblin joins the staging area", layout: { stage: "131028", side: "A", staging: [GIANT], deck: ["f0"], setAside: ["131063", "131062", "131058"] }, act: resolve("131028", "whenRevealed"), expect: [zone("131063", "staging"), zone(GIANT, "setAside"), count("131062", "setAside", 0), count("131058", "setAside", 0)] },
  { line: "131028:B:1", name: "the players cannot defeat the stage unless The Great Goblin is in the victory display", layout: { stage: "131028", progress: 20, phase: "Quest", deck: ["f0"] }, act: quest("success"), expect: [zone("131028", "questStage")] },
  { line: "131028:B:2", name: "Reveal 3 cards per player, fewer by the X Baggins resources Bilbo spends", layout: { stage: "131028", setAside: ["131063", AXEMAN, AXEMAN, AXEMAN, AXEMAN, AXEMAN], play: [{ code: "131001", resources: 2 }] }, act: [resolve("131028", "whenRevealed"), answer("x2")], expect: [count(AXEMAN, "staging", 1), resourcesOn("131001", 0)] },
  { line: "131028:B:2", name: "with no resource spent 3 cards are revealed for the player", layout: { stage: "131028", setAside: ["131063", AXEMAN, AXEMAN, AXEMAN, AXEMAN, AXEMAN], play: [{ code: "131001", resources: 2 }] }, act: [resolve("131028", "whenRevealed"), answer("x0")], expect: [count(AXEMAN, "staging", 3), resourcesOn("131001", 2)] },
  // 131026 A Short Rest.
  { line: "131026:B:1", name: "When Revealed: the player may search his deck for a treasure and add it to his hand", layout: { stage: "131026", deckOf: ["c1", "131020", "c2"] }, act: [resolve("131026", "whenRevealed"), answer("search")], expect: [zone("131020", "hand"), zone("131027", "questStage")] },
  { line: "131026:B:1", name: "or decline, and the treasure stays in the deck", layout: { stage: "131026", deckOf: ["c1", "131020", "c2"] }, act: [resolve("131026", "whenRevealed"), answer("decline")], expect: [zone("131020", "deck"), zone("131027", "questStage")] },
  // 131028 Down, Down to Goblin Town.
  { line: "131028:A:1", name: "When Revealed: every encounter card in play, the active location included, is discarded and set aside with the first deck", layout: { stage: "131028", side: "A", active: "place", staging: ["f3", "place"], engaged: ["f0"], deck: ["f0"], setAside: [GOBLIN_KING] }, act: resolve("131028", "whenRevealed"), expect: [count("place", "setAside", 2), zone("f3", "setAside")] },
  // 131062 Goblin Bent-Swords.
  { line: "131062:A:1", name: "with The Great Goblin in the victory display it gains surge", layout: { stage: "131027", victory: [GOBLIN_KING], deck: ["f3", "f0"] }, act: reveal(BENT_SWORDS), expect: [zone("f3", "staging")] },
  { line: "131062:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { stage: "131027", engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: BENT_SWORDS, undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "131062:A:2", name: "+2 Attack instead with The Great Goblin in the victory display", layout: { stage: "131027", victory: [GOBLIN_KING], engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: BENT_SWORDS, undefended: true }), expect: [damageOn("dh1", 3)] },
  // 131063 The Great Goblin and 131064 Stone-Giant.
  { line: "131063:A:1", name: "Forced: after he attacks, a card per player is discarded from the encounter deck and a Goblin enemy among them goes to the staging area", layout: { stage: "131027", engaged: [GOBLIN_KING], deck: [AXEMAN, "f3", "f0"] }, act: attack(GOBLIN_KING, { shadow: "f0", undefended: true }), expect: [zone(AXEMAN, "staging"), zone("f3", "encounterDeck")] },
  { line: "131063:A:1", name: "a card that is not a Goblin enemy stays in the discard pile", layout: { stage: "131027", engaged: [GOBLIN_KING], deck: ["f3", "f0", "f0"] }, act: attack(GOBLIN_KING, { shadow: "f0", undefended: true }), expect: [zone("f3", "encounterDiscard")] },
  { line: "131064:A:2", name: "Forced: after it engages a player, that player discards an ally he controls", layout: { stage: "131027", staging: [GIANT], play: ["ally"] }, act: announce("engaged", GIANT, { seat: 0 }), expect: [zone("ally", "discard")] },
  // 131066 Front Porch, 131067 Great Cavern Room and 131068 Overhanging Rock (its Action is in lines.test.ts).
  { line: "131066:A:1", name: "While it is the active location, players cannot attack Goblin enemies", layout: { stage: "131027", active: PORCH, staging: [AXEMAN], engaged: ["f3"] }, act: [], expect: [stat(AXEMAN, "cannotBeAttacked", 1), stat("f3", "cannotBeAttacked", 0)] },
  { line: "131066:A:2", name: "Action: the first player blanks Front Porch's text box until the end of the round", layout: { stage: "131027", active: PORCH }, act: resolve(PORCH, "action"), expect: [flag(PORCH, "blankText")] },
  { line: "131067:A:1", name: "While it is the active location: after a player engages a Goblin enemy, he deals 1 damage to a character he controls", layout: { stage: "131027", active: ROOM, staging: [AXEMAN] }, act: [announce("engaged", AXEMAN, { seat: 0 }), answer("dh2")], expect: [damageOn("dh2", 1), damageOn("dh1", 0)] },
  // 131069 The High Pass.
  { line: "131069:A:1", name: "X is the number of players in the game, and its Threat is X", layout: { stage: "131027", seats: 2, staging: [HIGH_PASS] }, act: [], expect: [stat(HIGH_PASS, "threat", 2)] },
  { line: "131069:A:2", name: "Forced: at the end of the round X progress tokens come off the current quest", layout: { stage: "131027", seats: 2, progress: 5, staging: [HIGH_PASS] }, act: announce("endOfRound", undefined, { seat: null, phase: "End of round" }), expect: [progressOn("131027", 3)] },
  // 131071 Chaos in the Cavern.
  { line: "131071:A:1", name: "When Revealed: all engaged enemies return to the staging area, then each Goblin enemy gets +1 Threat until the end of the phase", layout: { stage: "131027", engaged: [AXEMAN, "f3"] }, act: resolve(CHAOS, "whenRevealed"), expect: [zone(AXEMAN, "staging"), zone("f3", "staging"), stat(AXEMAN, "threat", 3), stat("f3", "threat", 3)] },
  { line: "131071:A:2", name: "Shadow: the attacking enemy returns to the staging area after its attack resolves", layout: { stage: "131027", engaged: ["f3"], deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: CHAOS, undefended: true }), expect: [zone("f3", "staging"), damageOn("dh1", 1)] },
];

if (ROWS.length > 0) cardSpecs("over-the-misty-mountains-grim", ROWS);
