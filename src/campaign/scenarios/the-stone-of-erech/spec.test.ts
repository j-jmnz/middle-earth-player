// Rules: rr.forced, rr.action, rr.shadow-effects, rr.travel, rr.active-location, rr.reveal, rr.keywords, rr.first-player, rr.blank, rr.surge, faq.lasting-effects, faq.additional-attacks (data/rules/entries.json); docs/brief.md (The Stone of Erech).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, defend, exhausted, flag, quest, resolve, respond, reveal, stat, threat, travel, zone, deckCount, handCount, progressOn, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Stone of Erech (standalone-scenarios part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The Night objective in play is the layout's `night`
// (its progress with it); a Dusk or Midnight line is read with that card in play. The lines a row cannot express (the passive check at the limit, Derufin's journey, Spectral, a cancel offer) are tests in lines.test.ts.
const EVENTIDE = "50308";
const DUSK = "50309";
const MIDNIGHT = "50310";
const BEGINNING = { seat: null, phase: "Beginning of round" } as const;
const ENCOUNTER = { seat: null, phase: "Encounter" } as const;
const END_OF_ROUND = { seat: null } as const;
const FILLERS = ["f0", "f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [
  { line: "50301:A:1", name: "Setup puts Eventide into play beside the quest", layout: { stage: "50301", setAside: [EVENTIDE, DUSK, MIDNIGHT] }, act: resolve("50301", "setup"), expect: [zone(EVENTIDE, "nightObjective"), zone(DUSK, "setAside")] },
  { line: "50301:B:1", name: "When Revealed: one encounter card for each player is revealed", layout: { stage: "50301", seats: 2, deck: ["f0", "f0", "f0"] }, act: resolve("50301", "whenRevealed"), expect: [deckCount(1)] },
  { line: "50301:B:2", name: "the stage is not defeated while Tarlang's Neck is in the staging area", layout: { stage: "50301", progress: 5, staging: ["50307"] }, act: quest("success"), expect: [zone("50301", "questStage")] },
  { line: "50302:A:1", name: "When Revealed: the Stone joins the staging area with Derufin attached to it", layout: { stage: "50302", setAside: ["50306", "50304"] }, act: resolve("50302", "whenRevealed"), expect: [zone("50306", "staging"), zone("50304", "attached")] },
  { line: "50302:B:1", name: "the first player's choice: no one plans this round", layout: { stage: "50302" }, act: [announce("beginningOfPhase", undefined, BEGINNING), answer("skipPlanning")], expect: [flag("table", "skipPlanning")] },
  { line: "50302:B:1", name: "the first player's choice: no hero collects resources", layout: { stage: "50302" }, act: [announce("beginningOfPhase", undefined, BEGINNING), answer("noCollect")], expect: [flag("table", "noCollect")] },
  { line: "50303:A:1", name: "When Revealed: each player searches for an Oathbreaker, which is revealed and joins the staging area, with the Lord of the Dead", layout: { stage: "50303", setAside: ["50305"], deck: ["50315", "f0"] }, act: resolve("50303", "whenRevealed"), expect: [zone("50315", "staging"), zone("50305", "staging")] },
  { line: "50303:A:2", name: "the encounter deck is shuffled after the search", layout: { stage: "50303", setAside: ["50305"], deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0", "f0", "50315"] }, act: resolve("50303", "whenRevealed"), expect: [zone("50315", "staging"), deckCount(8)] },
  { line: "50303:B:1", name: "Midnight: the stage has Battle", layout: { stage: "50303", night: MIDNIGHT }, act: [], expect: [flag("50303", "battle")] },
  { line: "50303:B:2", name: "no progress can go on the stage while no player controls Derufin", layout: { stage: "50303" }, act: [], expect: [flag("table", "noQuestProgress")] },
  { line: "50304:A:2", name: "Dusk: Derufin gets -1 Willpower", layout: { night: DUSK, play: ["50304"] }, act: [], expect: [stat("50304", "willpower", 2)] },
  { line: "50304:A:3", name: "Midnight: Derufin gets -2 Willpower", layout: { night: MIDNIGHT, play: ["50304"] }, act: [], expect: [stat("50304", "willpower", 1)] },
  { line: "50305:A:2", name: "while a player is engaged with the Lord of the Dead his characters' text boxes are blank", layout: { engaged: ["50305"] }, act: [], expect: [flag("dh1", "blankText")] },
  { line: "50306:A:1", name: "its Threat is twice the number of players", layout: { seats: 2, staging: ["50306"] }, act: [], expect: [stat("50306", "threat", 4)] },
  { line: "50306:A:2", name: "while it is the active location a character with less than 2 Willpower cannot ready", layout: { active: "50306", night: MIDNIGHT, play: ["50304"] }, act: announce("beginningOfPhase", undefined, { seat: null, phase: "Refresh" }), expect: [flag("50304", "cannotReady")] },
  { line: "50306:A:3", name: "Travel: each character with less than 2 Willpower exhausts", layout: { phase: "Travel", night: MIDNIGHT, staging: ["50306"], play: ["50304"] }, act: travel("50306"), expect: [exhausted("50304"), exhausted("dh1", false)] },
  { line: "50307:A:1", name: "active, at the beginning of the encounter phase the first player may engage every enemy in the staging area", layout: { active: "50307", staging: ["f3", "f0"] }, act: [announce("beginningOfPhase", undefined, ENCOUNTER), answer("engageAll")], expect: [zone("f3", "engaged"), zone("f0", "engaged")] },
  { line: "50308:A:1", name: "at the end of the round Eventide gets 1 progress", layout: { night: EVENTIDE }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [progressOn(EVENTIDE, 1)] },
  { line: "50308:A:2", name: "at 4 progress Eventide goes to the victory display and Dusk comes into play", layout: { night: { code: EVENTIDE, progress: 3 }, setAside: [DUSK] }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [zone(EVENTIDE, "victory"), zone(DUSK, "nightObjective")] },
  { line: "50309:A:1", name: "at the end of the round Dusk gets 1 progress", layout: { night: { code: DUSK, progress: 1 } }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [progressOn(DUSK, 2)] },
  { line: "50309:A:2", name: "at 4 progress Dusk goes to the victory display and Midnight comes into play", layout: { night: { code: DUSK, progress: 3 }, setAside: [MIDNIGHT] }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [zone(DUSK, "victory"), zone(MIDNIGHT, "nightObjective")] },
  { line: "50310:A:1", name: "at the end of the round Midnight gets 1 progress and each player's threat rises by its progress", layout: { night: { code: MIDNIGHT, progress: 1 } }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [progressOn(MIDNIGHT, 2), threat(30)] },
  { line: "50311:A:1", name: "Midnight. Action: a player claims the Relic and attaches it to a hero he controls", layout: { night: MIDNIGHT, staging: ["50311"] }, act: [respond("50311"), answer("dh1")], expect: [zone("50311", "attached")] },
  { line: "50312:A:2", name: "When Revealed: players cannot play events until the end of the round", layout: {}, act: resolve("50312", "whenRevealed"), expect: [flag("table", "cannotPlayEvents")] },
  { line: "50312:A:3", name: "Shadow: Attacking enemy gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "50312", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "50312:A:3", name: "Shadow at Dusk: +2 Attack instead", layout: { night: DUSK, engaged: ["f3"] }, act: attack("f3", { shadow: "50312", undefended: true }), expect: [damageOn("dh1", 3)] },
  { line: "50312:A:3", name: "Shadow at Midnight: +3 Attack instead", layout: { night: MIDNIGHT, engaged: ["f3"] }, act: attack("f3", { shadow: "50312", undefended: true }), expect: [damageOn("dh1", 4)] },
  { line: "50313:A:2", name: "When Revealed: the topmost Undead enemy of the encounter discard pile goes to the staging area", layout: { discard: ["50314", "50315"] }, act: resolve("50313", "whenRevealed"), expect: [zone("50315", "staging"), zone("50314", "encounterDiscard")] },
  { line: "50314:A:2", name: "Dusk: Whisperer gets +1 Threat", layout: { night: DUSK, staging: ["50314"] }, act: [], expect: [stat("50314", "threat", 3)] },
  { line: "50314:A:3", name: "Midnight: Whisperer gets +2 Threat", layout: { night: MIDNIGHT, staging: ["50314"] }, act: [], expect: [stat("50314", "threat", 4)] },
  { line: "50314:A:3", name: "Midnight: Whisperer gains doomed 2 as it is revealed", layout: { night: MIDNIGHT, deck: ["f0"] }, act: reveal("50314"), expect: [threat(30)] },
  { line: "50315:A:2", name: "Dusk: Shadow Host Captain gets +1 Attack and +1 Defense", layout: { night: DUSK, staging: ["50315"] }, act: [], expect: [stat("50315", "attack", 5), stat("50315", "defense", 2)] },
  { line: "50315:A:3", name: "Midnight: Shadow Host Captain gets +2 Attack and +2 Defense", layout: { night: MIDNIGHT, staging: ["50315"] }, act: [], expect: [stat("50315", "attack", 6), stat("50315", "defense", 3)] },
  { line: "50316:A:2", name: "Shadow: the attacking enemy is dealt 1 additional shadow card", layout: { engaged: ["f3"], deck: FILLERS }, act: attack("f3", { shadow: "50316", undefended: true }), expect: [deckCount(4)] },
  { line: "50316:A:2", name: "Shadow at Dusk: 2 additional cards instead", layout: { night: DUSK, engaged: ["f3"], deck: FILLERS }, act: attack("f3", { shadow: "50316", undefended: true }), expect: [deckCount(3)] },
  { line: "50316:A:2", name: "Shadow at Midnight: 3 additional cards instead", layout: { night: MIDNIGHT, engaged: ["f3"], deck: FILLERS }, act: attack("f3", { shadow: "50316", undefended: true }), expect: [deckCount(2)] },
  { line: "50317:A:1", name: "while it is the active location each location in the staging area gets -1 Threat", layout: { active: "50317", staging: ["place"] }, act: [], expect: [stat("place", "threat", 1)] },
  { line: "50317:A:2", name: "Shadow: an attack that destroys a character adds 1 progress to the Night objective", layout: { night: EVENTIDE, engaged: ["50305"] }, act: attack("50305", { shadow: "50317", undefended: true }), expect: [progressOn(EVENTIDE, 1)] },
  { line: "50318:A:1", name: "When Revealed: it becomes the active location, the old one returning to the staging area", layout: { active: "place" }, act: resolve("50318", "whenRevealed"), expect: [zone("50318", "activeLocation"), zone("place", "staging")] },
  { line: "50318:A:2", name: "Dusk: Vale of Shadows gets +2 quest points", layout: { night: DUSK, staging: ["50318"] }, act: [], expect: [stat("50318", "questPoints", 5)] },
  { line: "50318:A:3", name: "Midnight: Vale of Shadows gets +4 quest points", layout: { night: MIDNIGHT, staging: ["50318"] }, act: [], expect: [stat("50318", "questPoints", 7)] },
  { line: "50319:A:1", name: "Forced: explored, the topmost Undead enemy of the discard pile comes into play engaged with the first player", layout: { active: "50319", discard: ["50315"], deck: ["treachery", "treachery"] }, act: quest("success"), expect: [zone("50315", "engaged")] },
  { line: "50319:A:2", name: "Shadow: a defending character with 0 Willpower takes 2 damage", layout: { engaged: ["f3"], attached: [{ code: "50325", to: "dh1" }] }, act: [attack("f3", { shadow: "50319" }), defend("dh1")], expect: [damageOn("dh1", 2)] },
  { line: "50320:A:1", name: "Dusk: Shadow of Dwimorberg gets +2 Threat", layout: { night: DUSK, staging: ["50320"] }, act: [], expect: [stat("50320", "threat", 3)] },
  { line: "50320:A:2", name: "Midnight: Shadow of Dwimorberg gets +4 Threat", layout: { night: MIDNIGHT, staging: ["50320"] }, act: [], expect: [stat("50320", "threat", 5)] },
  { line: "50321:A:1", name: "in the staging area, ready heroes lose their icons", layout: { staging: ["50321"] }, act: [], expect: [flag("dh1", "losesIcons")] },
  { line: "50321:A:2", name: "Planning Action: a player exhausts a hero he controls", layout: { phase: "Planning", staging: ["50321"] }, act: [respond("50321"), answer("dh1")], expect: [exhausted("dh1")] },
  { line: "50322:A:1", name: "When Revealed: each player searches for an Undead enemy and reveals it into the staging area", layout: { seats: 2, deck: ["50315", "50314", "f0"] }, act: resolve("50322", "whenRevealed"), expect: [zone("50315", "staging"), zone("50314", "staging")] },
  { line: "50322:A:3", name: "Shadow: Attacking enemy gets +1 Attack", layout: { engaged: ["f3"] }, act: attack("f3", { shadow: "50322", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "50322:A:3", name: "Shadow at Dusk: +2 Attack instead", layout: { night: DUSK, engaged: ["f3"] }, act: attack("f3", { shadow: "50322", undefended: true }), expect: [damageOn("dh1", 3)] },
  { line: "50322:A:3", name: "Shadow at Midnight: +3 Attack instead", layout: { night: MIDNIGHT, engaged: ["f3"] }, act: attack("f3", { shadow: "50322", undefended: true }), expect: [damageOn("dh1", 4)] },
  { line: "50323:A:1", name: "When Revealed: all characters get -1 Willpower until the end of the round", layout: { play: ["50304"] }, act: resolve("50323", "whenRevealed"), expect: [stat("dh1", "willpower", 1), stat("50304", "willpower", 2)] },
  { line: "50323:A:2", name: "Shadow at Dusk: the attacking enemy makes an additional attack", layout: { night: DUSK, engaged: ["f3"], deck: FILLERS }, act: attack("f3", { shadow: "50323", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "50324:A:1", name: "When Revealed: the first player has the hand passed (a solo player discards it)", layout: { hand: ["c1", "c1"] }, act: [resolve("50324", "whenRevealed"), answer("passHands")], expect: [handCount(0)] },
  { line: "50324:A:2", name: "Midnight: Groping Horror gains surge", layout: { night: MIDNIGHT, deck: ["f0", "f0", "f0"] }, act: reveal("50324"), expect: [deckCount(2)] },
  { line: "50325:A:1", name: "When Revealed: the first player attaches it to a hero, whose Willpower becomes 0", layout: {}, act: resolve("50325", "whenRevealed"), expect: [zone("50325", "attached"), stat("dh1", "willpower", 0)] },
  { line: "50326:A:1", name: "When Revealed: 1 damage to each character with less than 2 Willpower", layout: { play: ["50304"], attached: [{ code: "50325", to: "dh1" }] }, act: resolve("50326", "whenRevealed"), expect: [damageOn("dh1", 1), damageOn("dh2", 0)] },
  { line: "50326:A:1", name: "Dusk: less than 3 Willpower instead", layout: { night: DUSK }, act: resolve("50326", "whenRevealed"), expect: [damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "50327:A:2", name: "When Revealed: 1 progress on the Night objective", layout: { night: EVENTIDE }, act: resolve("50327", "whenRevealed"), expect: [progressOn(EVENTIDE, 1)] },
];

if (ROWS.length > 0) cardSpecs("the-stone-of-erech", ROWS);
else describe("the-stone-of-erech card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
