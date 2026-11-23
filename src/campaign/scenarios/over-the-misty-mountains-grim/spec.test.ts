// Rules: hob.setup-over-the-misty-mountains-grim, hob.active-and-inactive-encounter-decks, hob.bilbo-baggins-ohauh, rr.reveal, rr.search, rr.victory, rr.shadow-effects, rr.delayed-effects (data/rules/entries.json); docs/scenarios/the-hobbit.md (Over the Misty Mountains Grim).
import { answer, attack, cardSpecs, committed, count, damageOn, endPhase, quest, resourcesOn, resolve, reveal, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Over the Misty Mountains Grim (the-hobbit part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
const GIANT = "131064";
const BOULDERS = "131072";
const AXEMAN = "131058";

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
];

if (ROWS.length > 0) cardSpecs("over-the-misty-mountains-grim", ROWS);
