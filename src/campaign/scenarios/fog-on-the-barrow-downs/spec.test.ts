// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.travel, rr.engaged, rr.victory, rr.quest-advancement, rr.immune, rr.lasting-effects, rr.surge, mec109.peril (data/rules/entries.json); docs/scenarios/standalone-scenarios.md (Fog on the Barrow-downs).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, damageOn, deckCount, defend, endPhase, endRound, flag, handCount, notWon, progressOn, quest, resolve, resourcesOn, reveal, stagingThreat, stat, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Fog on the Barrow-downs (standalone-scenarios part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The lines a row cannot express (the Setup shuffle,
// the split into separate staging areas, the return, an elimination while apart, the flags a seat holds) are tests in split.test.ts and lines.test.ts, each titled with its line id.
const FILLERS = ["f0", "f0", "f0", "f0", "f0"];
const END_OF_ROUND = { seat: null } as const;
const HOLLOW_CIRCLE = "148005";
const STANDING_STONES = "148006";
const BARROW = "148007";
const WIGHT = "148011";

const ROWS: readonly Row[] = [
  { line: "148001:B:1", name: "Skip the quest phase", layout: { stage: "148001" }, act: [], expect: [flag("table", "skipQuestPhase")] },
  { line: "148001:B:2", name: "Forced: at the end of the round 1 progress is placed on this stage", layout: { stage: "148001" }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [progressOn("148001", 1)] },
  { line: "148002:A:1", name: "When Revealed: Hollow Circle joins the staging area and each player reveals 1 encounter card", layout: { stage: "148002", seats: 2, setAside: [HOLLOW_CIRCLE], deck: FILLERS }, act: resolve("148002", "whenRevealed"), expect: [zone(HOLLOW_CIRCLE, "staging"), deckCount(3)] },
  { line: "148002:B:2", name: "the players cannot defeat this stage unless Hollow Circle is in the victory display", layout: { stage: "148002", progress: 13, phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [zone("148002", "questStage")] },
  { line: "148003:A:1", name: "When Revealed: Standing Stones joins the staging area, each other player reveals 1 card, and the discard pile and each Great Barrow are shuffled into the encounter deck", layout: { stage: "148003", seats: 2, setAside: [STANDING_STONES, BARROW], discard: ["f3"], deck: FILLERS }, act: resolve("148003", "whenRevealed"), expect: [zone(STANDING_STONES, "staging"), zone(BARROW, "encounterDeck"), zone("f3", "encounterDeck")] },
  { line: "148003:B:1", name: "progress cannot be placed on this stage while a Great Barrow is in play", layout: { stage: "148003", staging: [BARROW] }, act: [], expect: [flag("148003", "noProgressPlaced")] },
  { line: "148003:B:1", name: "a successful quest places none on this stage while a Great Barrow is in play", layout: { stage: "148003", staging: [BARROW], phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [progressOn("148003", 0)] },
  { line: "148003:B:3", name: "the players cannot defeat this stage unless Standing Stones is in the victory display", layout: { stage: "148003", progress: 15, phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [zone("148003", "questStage"), notWon] },
  { line: "148003:B:3", name: "with Standing Stones in the victory display and every player at this stage, defeating it wins the game", layout: { stage: "148003", progress: 15, victory: [STANDING_STONES], phase: "Quest", deck: FILLERS }, act: quest("success"), expect: [won] },
  { line: "148004:B:1", name: "Forced: a location revealed at this stage is canceled and discarded and its player raises his threat by its Threat", layout: { stage: "148004", deck: ["148010", "f0"] }, act: reveal("148010"), expect: [zone("148010", "encounterDiscard"), threat(30)] },
  { line: "148005:A:2", name: "Travel: each player searches the encounter deck for a Wight and puts it into play engaged with him", layout: { stage: "148002", phase: "Travel", staging: [HOLLOW_CIRCLE], deck: [WIGHT, "f0"] }, act: travel(HOLLOW_CIRCLE), expect: [zone(WIGHT, "engaged")] },
  { line: "148006:A:2", name: "Travel: the first player searches the encounter deck for a Great Barrow and adds it to the staging area", layout: { stage: "148003", phase: "Travel", staging: [STANDING_STONES], deck: [BARROW, "f0"] }, act: travel(STANDING_STONES), expect: [zone(BARROW, "staging")] },
  { line: "148008:A:1", name: "Threat X: 1 plus the facedown cards under it", layout: { staging: ["148008"], under: [{ code: "ally", to: "148008" }] }, act: [], expect: [stat("148008", "threat", 2)] },
  { line: "148008:A:2", name: "Forced: after it enters play each player places an ally he controls facedown under it", layout: { staging: ["148008"], play: ["ally"] }, act: announce("encounterEnteredPlay", "148008"), expect: [zone("ally", "under")] },
  { line: "148008:A:2", name: "When it leaves play as an explored location each ally under it returns to its owner's hand", layout: { staging: ["148008"], play: ["ally"] }, act: [announce("encounterEnteredPlay", "148008"), announce("locationExplored", "148008")], expect: [zone("ally", "hand")] },
  { line: "148009:A:1", name: "While it is in the staging area each Wight engaged with a player gets +1 Attack and +1 Defense", layout: { staging: ["148009"], engaged: [WIGHT] }, act: [], expect: [stat(WIGHT, "attack", 6), stat(WIGHT, "defense", 2)] },
  { line: "148010:A:2", name: "Shadow: the attacking enemy gets +2 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "148010", undefended: true }), expect: [damageOn("dh1", 3)] },
  { line: "148011:A:2", name: "Forced: after it attacks and destroys a character that character's controller raises his threat by 2", layout: { engaged: [WIGHT], play: ["ally"] }, act: [attack(WIGHT), defend("ally")], expect: [threat(30)] },
  { line: "148012:A:2", name: "Forced: after it attacks and destroys a character that character's controller discards a random card from his hand", layout: { engaged: ["148012"], hand: ["event", "event"], play: ["ally"] }, act: [attack("148012"), defend("ally")], expect: [handCount(1)] },
  { line: "148013:A:2", name: "Forced: after it attacks and destroys a character that character's controller discards all resources from each hero he controls", layout: { engaged: ["148013"], heroResources: 3, play: ["ally"] }, act: [attack("148013"), defend("ally")], expect: [resourcesOn("dh1", 0)] },
  { line: "148014:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "148014", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "148015:A:2", name: "When Revealed: each Wight engaged with the revealer contributes its Threat to the staging area", layout: { engaged: [WIGHT] }, act: resolve("148015", "whenRevealed"), expect: [stagingThreat(3)] },
  { line: "148015:A:2", name: "with no enemy engaged with him a Wight is searched for and put into play engaged with him", layout: { deck: [WIGHT, "f0"] }, act: resolve("148015", "whenRevealed"), expect: [zone(WIGHT, "engaged")] },
  { line: "148016:A:1", name: "When Revealed: each player discards the resources in his heroes' pools and raises his threat by 1 for each", layout: { heroResources: 2, deck: FILLERS }, act: resolve("148016", "whenRevealed"), expect: [resourcesOn("dh1", 0), threat(32)] },
  { line: "148016:A:1", name: "with no resource discarded it gains surge", layout: { deck: FILLERS }, act: reveal("148016"), expect: [deckCount(4)] },
  { line: "148016:A:2", name: "Shadow: the defending player raises his threat by 1 for each damage dealt by the attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "148016", undefended: true }), expect: [threat(29)] },
  { line: "148017:A:3", name: "Shadow: the attacking enemy cannot take damage until the end of the round", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "148017", undefended: true }), expect: [flag("f3", "cannotTakeDamage")] },
  { line: "148018:A:2", name: "When Revealed: Dreadful Song is attached to a questing hero and its Willpower is 0", layout: { committed: ["dh1"] }, act: resolve("148018", "whenRevealed"), expect: [zone("148018", "attached"), stat("dh1", "willpower", 0)] },
  { line: "148019:A:1", name: "When Revealed: the chosen player gains control of Tom Bombadil, ready and committed to the quest", layout: { deck: FILLERS }, act: resolve("148019", "whenRevealed"), expect: [zone("148019", "play")] },
  { line: "148019:A:1", name: "At the end of the round Tom is discarded and then the encounter discard pile, Tom in it, is shuffled into the encounter deck", layout: { stage: "148002", deck: FILLERS, discard: ["f0", "f0"] }, act: [resolve("148019", "whenRevealed"), endPhase, endRound], expect: [zone("148019", "encounterDeck"), deckCount(7)] },
];

if (ROWS.length > 0) cardSpecs("fog-on-the-barrow-downs", ROWS);
else describe("fog-on-the-barrow-downs card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
