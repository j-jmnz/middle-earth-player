// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.travel, rr.active-location, rr.engaged, rr.victory, rr.quest-advancement, mec113.saga-staging-rules (data/rules/entries.json); docs/brief.md (The Old Forest).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, damageOn, deckCount, endPhase, endRound, flag, handCount, progressOn, quest, resolve, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Old Forest (standalone-scenarios part 4): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The lines a row cannot express (the random stage and its
// timing, the play limit, the seeded choices) are tests in stages.test.ts, each titled with its line id.
const FILLERS = ["f0", "f0", "f0", "f0", "f0"];
const END_OF_PLANNING = { seat: null, phase: "Planning" } as const;
const END_OF_ROUND = { seat: null } as const;
const WALL = "147015";
const GULLEY = "147013";
const WOODS = "147014";
const FOREST = "147016";
const WILLOW = "147007";
const WITHYWINDLE = "147011";
const THREE_VICTORIES = [GULLEY, FOREST, WOODS];

const ROWS: readonly Row[] = [
  { line: "147001:A:1", name: "Setup: each player searches the encounter deck for a location and adds it to the staging area", layout: { stage: "147001", deck: ["147012", "f0"] }, act: resolve("147001", "setup"), expect: [zone("147012", "staging")] },
  { line: "147002:A:1", name: "When Revealed: fewer locations in the staging area than players, a location is searched for and added", layout: { stage: "147002", deck: ["147012", "f0"] }, act: resolve("147002", "whenRevealed"), expect: [zone("147012", "staging")] },
  { line: "147002:B:1", name: "Forced: at the end of the planning phase each player exhausts a hero he controls", layout: { stage: "147002", phase: "Planning" }, act: announce("endOfPhase", undefined, END_OF_PLANNING), expect: [{ expect: "exhausted", code: "dh1", value: true }] },
  { line: "147002:B:2", name: "Forced: with X Victory points in the victory display the quest advances to stage 3A", layout: { stage: "147002", phase: "Quest", victory: THREE_VICTORIES, setAside: [], deck: FILLERS }, act: quest("success"), expect: [zone("147006", "questStage")] },
  { line: "147003:A:1", name: "When Revealed: a location is searched for when the staging area holds fewer than the players", layout: { stage: "147003", deck: ["147012", "f0"] }, act: resolve("147003", "whenRevealed"), expect: [zone("147012", "staging")] },
  { line: "147003:B:1", name: "Forced: at the beginning of the round all progress comes off every location in play", layout: { stage: "147003", staging: [{ code: "147012", progress: 1 }] }, act: announce("beginningOfPhase", undefined, { seat: null, phase: "Resource" }), expect: [progressOn("147012", 0)] },
  { line: "147003:B:2", name: "Forced: with X Victory points the quest advances to stage 3A", layout: { stage: "147003", phase: "Quest", victory: THREE_VICTORIES, deck: FILLERS }, act: quest("success"), expect: [zone("147006", "questStage")] },
  { line: "147004:A:1", name: "When Revealed: a location is searched for when the staging area holds fewer than the players", layout: { stage: "147004", deck: ["147012", "f0"] }, act: resolve("147004", "whenRevealed"), expect: [zone("147012", "staging")] },
  { line: "147004:B:1", name: "Forced: at the end of the round a random location of the victory display is discarded", layout: { stage: "147004", victory: [GULLEY] }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [zone(GULLEY, "encounterDiscard")] },
  { line: "147004:B:2", name: "Forced: with X Victory points the quest advances to stage 3A", layout: { stage: "147004", phase: "Quest", victory: THREE_VICTORIES, deck: FILLERS }, act: quest("success"), expect: [zone("147006", "questStage")] },
  { line: "147005:A:1", name: "When Revealed: a location is searched for when the staging area holds fewer than the players", layout: { stage: "147005", deck: ["147012", "f0"] }, act: resolve("147005", "whenRevealed"), expect: [zone("147012", "staging")] },
  { line: "147005:B:2", name: "Forced: with X Victory points the quest advances to stage 3A", layout: { stage: "147005", phase: "Quest", victory: THREE_VICTORIES, deck: FILLERS }, act: quest("success"), expect: [zone("147006", "questStage")] },
  { line: "147005:B:1", name: "Forced: at the beginning of the quest phase the first player reveals 1 additional encounter card", layout: { stage: "147005", phase: "Quest", deck: FILLERS }, act: [announce("beginningOfPhase", undefined, { seat: null, phase: "Quest" }), quest("success")], expect: [deckCount(3)] },
  { line: "147011:A:3", name: "while it is the active location the first player reveals 1 additional encounter card in the quest phase", layout: { stage: "147002", active: WITHYWINDLE, phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [deckCount(3)] },
  { line: "147006:A:1", name: "When Revealed: Old Man Willow and Withywindle join the staging area, then players minus 1 encounter cards are revealed", layout: { stage: "147006", seats: 2, setAside: [WILLOW, WITHYWINDLE], deck: FILLERS }, act: resolve("147006", "whenRevealed"), expect: [zone(WILLOW, "staging"), zone(WITHYWINDLE, "staging"), deckCount(4)] },
  { line: "147006:B:1", name: "Old Man Willow cannot leave the staging area and is considered engaged with each player", layout: { stage: "147006", staging: [WILLOW] }, act: [], expect: [flag(WILLOW, "cannotLeaveStaging"), flag(WILLOW, "engagedWithAll"), flag(WILLOW, "attackableByAny")] },
  { line: "147007:A:2", name: "Forced: when Old Man Willow attacks a random location of the victory display is discarded and the defending player raises his threat by its Victory points", layout: { stage: "147006", staging: [WILLOW], victory: [GULLEY], deck: FILLERS }, act: attack(WILLOW, { undefended: true }), expect: [zone(GULLEY, "encounterDiscard"), threat(30)] },
  { line: "147009:A:1", name: "Forced: after it engages a player he assigns damage for each location in the victory display", layout: { engaged: ["147009"], victory: [GULLEY, WOODS] }, act: announce("engaged", "147009", {}), expect: [damageOn("dh1", 2)] },
  { line: "147010:A:2", name: "Forced: after it engages a player he discards a non-objective attachment he controls", layout: { engaged: ["147010"], attached: [{ code: "attachment", to: "dh1" }] }, act: announce("engaged", "147010", {}), expect: [zone("attachment", "discard")] },
  { line: "147010:A:3", name: "Shadow: the defending player discards a non-objective attachment he controls", layout: { engaged: ["f3"], attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "147010", undefended: true }), expect: [zone("attachment", "discard")] },
  { line: "147011:A:2", name: "the players cannot win the game while Withywindle is in play", layout: { stage: "147006", progress: 17, staging: [WITHYWINDLE], phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [{ expect: "notWon" }] },
  { line: "147012:A:3", name: "Shadow: the defending player discards each ally card in his hand", layout: { engaged: ["f3"], hand: ["ally", "ally", "event"] }, act: attack("f3", { shadow: "147012", undefended: true }), expect: [handCount(1)] },
  { line: "147014:A:1", name: "no character is healed while Strange Woods is in the staging area", layout: { staging: [WOODS] }, act: [], expect: [flag("dh1", "cannotBeHealed")] },
  { line: "147014:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: WOODS, undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "147015:A:1", name: "Threat X: the number of players", layout: { seats: 2, staging: [WALL] }, act: [], expect: [stat(WALL, "threat", 2)] },
  { line: "147015:A:2", name: "progress must be placed on Wall of Trees before it can be placed on the current quest", layout: { stage: "147006", staging: [WALL], phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [progressOn("147006", 0)] },
  { line: "147016:A:2", name: "Shadow: with no location in the staging area it is added to the staging area", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: FOREST, undefended: true }), expect: [zone(FOREST, "staging")] },
  { line: "147017:A:2", name: "When Revealed: a location of the victory display returns to the staging area", layout: { victory: [GULLEY], deck: FILLERS }, act: resolve("147017", "whenRevealed"), expect: [zone(GULLEY, "staging")] },
  { line: "147017:A:2", name: "with none there it gains surge", layout: { deck: FILLERS }, act: { act: "reveal", code: "147017" }, expect: [deckCount(4)] },
  { line: "147017:A:2", name: "with a location returned it does not gain surge", layout: { victory: [GULLEY], deck: FILLERS }, act: { act: "reveal", code: "147017" }, expect: [zone(GULLEY, "staging"), deckCount(5)] },
  { line: "147018:A:1", name: "When Revealed: each player removes a committed character from the quest and deals it 2 damage", layout: { committed: ["dh1"] }, act: resolve("147018", "whenRevealed"), expect: [damageOn("dh1", 2)] },
  { line: "147018:A:1", name: "3 damage when the character is an ally", layout: { play: ["ally"], committed: ["ally"] }, act: resolve("147018", "whenRevealed"), expect: [damageOn("ally", 3)] },
  { line: "147018:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "147018", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "147019:A:2", name: "When Revealed: a questing hero is removed from the quest and Song of Sleep is attached to it", layout: { committed: ["dh1"] }, act: resolve("147019", "whenRevealed"), expect: [zone("147019", "attached"), flag("dh1", "cannotReady")] },
  { line: "147020:A:2", name: "When Revealed: progress on the staging area's locations is discarded", layout: { staging: [{ code: "147012", progress: 2 }] }, act: resolve("147020", "whenRevealed"), expect: [progressOn("147012", 0)] },
  { line: "147020:A:2", name: "a non-unique active location is switched with a location of the staging area", layout: { active: "place", staging: ["147012"] }, act: resolve("147020", "whenRevealed"), expect: [zone("147012", "activeLocation"), zone("place", "staging")] },
  { line: "147021:A:2", name: "When Revealed: at the end of the phase each player raises his threat by the enemies in the staging area", layout: { staging: ["f3", "f0"], phase: "Travel", deck: FILLERS }, act: [resolve("147021", "whenRevealed"), endPhase], expect: [threat(30)] },
  { line: "147022:A:1", name: "When Revealed: the chosen player gains control of Tom Bombadil, ready and committed to the quest", layout: { deck: FILLERS }, act: resolve("147022", "whenRevealed"), expect: [zone("147022", "play")] },
  { line: "147022:A:1", name: "At the end of the round Tom is discarded and then the encounter discard pile, Tom in it, is shuffled into the encounter deck", layout: { deck: FILLERS, discard: ["f0", "f0"] }, act: [resolve("147022", "whenRevealed"), endPhase, endRound], expect: [zone("147022", "encounterDeck"), deckCount(7)] },
];

if (ROWS.length > 0) cardSpecs("the-old-forest", ROWS);
else describe("the-old-forest card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
