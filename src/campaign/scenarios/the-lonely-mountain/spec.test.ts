// Rules: rr.setup, rr.forced, rr.response, rr.action, rr.travel, rr.first-player, rr.modifiers, rr.immune, rr.active-location, rr.winning-the-game, rr.quest-advancement, rr.attachment-cards, rr.effects, hob.burgle, hob.indestructible, faq.additional-attacks, faq.enemy-attacks-outside-combat, faq.progress-without-advancing (data/rules/entries.json); docs/scenarios/the-hobbit/the-lonely-mountain.md (The Lonely Mountain).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, drew, endPhase, flag, handCount, notWon, progressOn, quest, resolve, respond, resourcesOn, reveal, stat, travel, window, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Lonely Mountain (the-hobbit part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The quest deck is the real one (`stages`). What a row cannot say (a burgle attempt, which
// stops in its action window, the quest stages that make one, Secret Entrance's Travel with its look, Pretending to Sleep with two players, the quest deck's loop) is a test beside this file, each titled with its line id (burgle.test.ts, quest.test.ts, encounter.test.ts).
const STAGES = ["132071", "132072", "132073", "132074"] as const;
const TREASURES = ["132020", "132021", "132022", "132023", "132024"];
const BILBO = { code: "132001", resources: 3 };
const END_OF_ROUND = { seat: null, phase: "End of round" } as const;
const stacked = (count: number) => TREASURES.slice(0, count).map((code) => ({ code, to: "132043" }));

const ROWS: readonly Row[] = [
  // 132036 Dark Bats. "Forced: After Dark Bats damages a character, attach it to that character." Dark Bats (2 Attack) against an undefended hero.
  { line: "132036:A:1", name: "after it damages a character it attaches to that character", layout: { stages: STAGES, engaged: ["132036"], deck: ["f0", "f0", "f0"] }, act: attack("132036", { undefended: true }), expect: [damageOn("dh1", 2), zone("132036", "attached")] },
  // 132039 A Bare Patch (its Response is a burgle attempt: burgle.test.ts).
  { line: "132039:A:1", name: "attached, Smaug the Magnificent has -3 Defense", layout: { stages: STAGES, staging: ["132041"], attached: [{ code: "132039", to: "132041" }] }, act: [], expect: [stat("132041", "defense", 5)] },
  // 132040 Smaug the Golden.
  { line: "132040:A:1", name: "Smaug the Golden cannot be engaged", layout: { stages: STAGES, staging: ["132040"] }, act: [], expect: [flag("132040", "cannotBeEngaged")] },
  { line: "132040:A:2", name: "X is the number of committed characters without the Burglar trait", layout: { stages: STAGES, staging: ["132040"], committed: ["dh1", "dh2"] }, act: [], expect: [stat("132040", "threat", 2)] },
  { line: "132040:A:2", name: "a committed Burglar does not count", layout: { stages: STAGES, staging: ["132040"], heroes: [BILBO], committed: ["dh1", "132001"] }, act: [], expect: [stat("132040", "threat", 1)] },
  { line: "132040:A:3", name: "Forced: after the 6th progress token is placed on him the players advance to stage 4A", layout: { stages: STAGES, stage: "132072", staging: [{ code: "132040", progress: 6 }] }, act: announce("progressPlaced", "132040"), expect: [zone("132074", "questStage")] },
  // 132041 Smaug the Magnificent.
  { line: "132041:A:2", name: "he stays in the staging area, is considered engaged with the first player and cannot be engaged", layout: { stages: STAGES, staging: ["132041"] }, act: [], expect: [flag("132041", "cannotLeaveStaging"), flag("132041", "engagedWithFirst"), flag("132041", "cannotBeEngaged"), flag("132041", "cannotBeOptionallyEngaged")] },
  { line: "132041:A:3", name: "Forced: a shadow card with a burgle effect gives him an additional attack with a new shadow card", layout: { stages: STAGES, deck: ["f0", "f0", "f0"] }, act: attack("132041", { shadow: "132042", undefended: true }), expect: [deckCount(2)] },
  // 132042 Croaking Crows (its burgle effect: burgle.test.ts).
  { line: "132042:A:2", name: "Forced: when a location is revealed from the encounter deck, 1 progress goes on Smaug the Golden", layout: { stages: STAGES, staging: ["132040", "132042"], deck: ["f0"] }, act: reveal("132044"), expect: [progressOn("132040", 1)] },
  // 132043 The Lonely Mountain (its Action: burgle.test.ts).
  { line: "132043:A:1", name: "with 5 cards under it its Threat is 2 and it is immune to player card effects and cannot leave the staging area", layout: { stages: STAGES, staging: ["132043"], under: stacked(5) }, act: [], expect: [stat("132043", "threat", 2), flag("132043", "immuneToPlayerCards"), flag("132043", "cannotLeaveStaging")] },
  { line: "132043:A:1", name: "with 1 card under it its Threat is 10", layout: { stages: STAGES, staging: ["132043"], under: stacked(1) }, act: [], expect: [stat("132043", "threat", 10), flag("132043", "cannotLeaveStaging")] },
  // 132044 Great Hall.
  { line: "132044:A:1", name: "Forced: while active it puts 1 progress on Smaug the Golden at the end of the round", layout: { stages: STAGES, active: "132044", staging: ["132040"] }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [progressOn("132040", 1)] },
  // 132045 Secret Entrance.
  { line: "132045:A:1", name: "while active the Lonely Mountain's Threat is halved, rounded up", layout: { stages: STAGES, active: "132045", staging: ["132043"], under: stacked(3) }, act: [], expect: [stat("132043", "threat", 3)] },
  { line: "132045:A:2", name: "Travel: another type on top returns Secret Entrance to the staging area", layout: { stages: STAGES, phase: "Travel", staging: ["132045"], deck: ["treachery", "f0"] }, act: [travel("132045"), answer("dh1"), answer("location")], expect: [zone("132045", "staging")] },
  // 132046 Desolation of Smaug.
  { line: "132046:A:1", name: "while active the first treachery revealed each round gains surge, the second does not", layout: { stages: STAGES, active: "132046", deck: ["f0", "f0"] }, act: [reveal("treachery"), reveal("treachery")], expect: [deckCount(1)] },
  // 132047 Western Slopes.
  { line: "132047:A:1", name: "Response: leaving play explored, the first player draws 2 cards", layout: { stages: STAGES, stage: "132073", active: { code: "132047", progress: 4 }, staging: ["132040"], deckOf: ["filler", "filler", "filler"] }, act: [quest("success"), respond("132047")], expect: [drew(2)] },
  { line: "132047:A:1", name: "Response: or 1 progress comes off Smaug the Golden", layout: { stages: STAGES, stage: "132073", active: { code: "132047", progress: 4 }, staging: [{ code: "132040", progress: 2 }] }, act: [quest("success"), respond("132047"), answer("remove")], expect: [progressOn("132040", 1)] },
  // 132048 Pretending to Sleep (with two players: encounter.test.ts).
  { line: "132048:A:2", name: "When Revealed: 1 progress on Smaug the Golden, then X Baggins resources are spent, X being his progress", layout: { stages: STAGES, staging: ["132040"], heroes: [BILBO], deck: ["f0", "f0"] }, act: [reveal("132048"), answer("spend")], expect: [progressOn("132040", 1), resourcesOn("132001", 2)] },
  { line: "132048:A:2", name: "When Revealed: or the players advance to stage 4A", layout: { stages: STAGES, stage: "132072", staging: ["132040"], heroes: [BILBO], deck: ["f0", "f0"] }, act: [reveal("132048"), answer("advance")], expect: [zone("132074", "questStage"), resourcesOn("132001", 3)] },
  // 132049 Known to an Ounce.
  { line: "132049:A:1", name: "When Revealed: each player discards 2 cards at random and each Dragon gets +1 Threat for each event discarded", layout: { stages: STAGES, staging: ["132041"], hand: ["c1", "c1"] }, act: resolve("132049", "whenRevealed"), expect: [handCount(0), stat("132041", "threat", 8)] },
  { line: "132049:A:1", name: "a Dragon that enters play later in the phase has the Threat bonus too (faq.lasting-effects)", layout: { stages: STAGES, hand: ["c1", "c1"], deck: ["f0", "f0"] }, act: [resolve("132049", "whenRevealed"), reveal("132041")], expect: [handCount(0), stat("132041", "threat", 8)] },
  { line: "132049:A:1", name: "Until the end of the phase: the Threat bonus is gone once the phase ends", layout: { stages: STAGES, staging: ["132041"], hand: ["c1", "c1"] }, act: [resolve("132049", "whenRevealed"), endPhase], expect: [handCount(0), stat("132041", "threat", 6)] },
  { line: "132049:A:1", name: "a second reveal in the same phase discards 2 more cards and adds its own bonus to the first", layout: { stages: STAGES, staging: ["132041"], hand: ["c1", "c1", "c1", "c1"] }, act: [resolve("132049", "whenRevealed"), resolve("132049", "whenRevealed")], expect: [handCount(0), stat("132041", "threat", 10)] },
  { line: "132049:A:1", name: "cards that are not events raise no Threat", layout: { stages: STAGES, staging: ["132041"], hand: ["ally", "ally"] }, act: resolve("132049", "whenRevealed"), expect: [handCount(0), stat("132041", "threat", 6)] },
  { line: "132049:A:1", name: "with two players each discards 2 cards at random and all the events count", layout: { stages: STAGES, seats: 2, staging: ["132041"], hand: ["c1", "c1"] }, act: resolve("132049", "whenRevealed"), expect: [handCount(0), stat("132041", "threat", 10)] },
  // 132050 Belching Fire.
  { line: "132050:A:1", name: "When Revealed: each Dragon in the staging area attacks the player with the highest total Willpower committed", layout: { stages: STAGES, staging: ["132041"], committed: ["dh1"] }, act: resolve("132050", "whenRevealed"), expect: [window("defense")] },
  { line: "132050:A:1", name: "the attack deals no shadow card", layout: { stages: STAGES, staging: ["132041"], committed: ["dh1"], deck: ["f0", "f0"] }, act: resolve("132050", "whenRevealed"), expect: [window("defense"), deckCount(2)] },
  // 132051 Dragon-Spell.
  { line: "132051:A:1", name: "When Revealed: it attaches to the hero with the most resources, a tie to the first player's choice, and takes 1 Willpower for each resource", layout: { stages: STAGES, heroResources: 2 }, act: [reveal("132051"), answer("dh2")], expect: [stat("dh2", "willpower", 0), stat("dh1", "willpower", 2)] },
  { line: "132051:A:1", name: "When Revealed: a hero that has a Dragon-Spell is passed over", layout: { stages: STAGES, heroResources: 2, attached: [{ code: "132051", to: "dh1" }] }, act: reveal("132051"), expect: [stat("dh2", "willpower", 0), stat("dh1", "willpower", 0)] },
  { line: "132051:A:1", name: "Forced: when the hero spends resources it takes damage equal to the number spent", layout: { stages: STAGES, heroResources: 3, attached: [{ code: "132051", to: "dh1" }] }, act: announce("heroResourcesSpent", "dh1", { amount: 2 }), expect: [damageOn("dh1", 2)] },
  { line: "132051:A:1", name: "When Revealed: the hero with the most resources already has a Dragon-Spell, so it goes to the richest of the others", layout: { stages: STAGES, heroes: [{ code: "132001", resources: 3 }], heroResources: 2, attached: [{ code: "132051", to: "132001" }] }, act: [reveal("132051"), answer("dh1")], expect: [stat("dh1", "willpower", 0), stat("dh2", "willpower", 2)] },
  // 132071 A Warm Welcome.
  { line: "132071:A:1", name: "Setup: the five Erebor treasures are stacked facedown under The Lonely Mountain", layout: { stages: STAGES, stage: "132071", side: "A", staging: ["132043"], setAside: TREASURES }, act: resolve("132071", "setup"), expect: [count("132020", "under", 1), count("132024", "under", 1), count("132022", "setAside", 0)] },
  { line: "132071:B:1", name: "skip the Quest phase", layout: { stages: STAGES, stage: "132071" }, act: [], expect: [flag("table", "skipQuestPhase")] },
  { line: "132071:B:2", name: "Forced: at the end of the round the players advance to stage 2", layout: { stages: STAGES, stage: "132071" }, act: announce("endOfRound", undefined, END_OF_ROUND), expect: [zone("132072", "questStage")] },
  // 132072 The Burglar's Turn (B:1 is a burgle attempt: quest.test.ts).
  { line: "132072:B:2", name: "Forced: after the first player's unsuccessful burgle attempt Smaug the Golden attacks the first player", layout: { stages: STAGES, stage: "132072", staging: ["132040"] }, act: announce("burgleFailed"), expect: [window("defense")] },
  // 132073 Inside Information.
  { line: "132073:A:1", name: "When Revealed: Smaug the Golden is set aside and Smaug the Magnificent and A Bare Patch join the staging area", layout: { stages: STAGES, stage: "132073", side: "A", staging: ["132040"], setAside: ["132041", "132039"] }, act: resolve("132073", "whenRevealed"), expect: [zone("132040", "setAside"), zone("132041", "staging"), zone("132039", "staging")] },
  { line: "132073:B:1", name: "the players cannot defeat the stage while Smaug the Magnificent is in play", layout: { stages: STAGES, stage: "132073", progress: 20, staging: ["132041"] }, act: endPhase, expect: [zone("132073", "questStage"), notWon] },
  { line: "132073:B:2", name: "Forced: progress above his remaining hit points sets Smaug the Magnificent aside", layout: { stages: STAGES, stage: "132073", progress: 5, staging: [{ code: "132041", damage: 16 }] }, act: announce("progressPlaced", "132073"), expect: [zone("132041", "setAside")] },
  { line: "132073:B:2", name: "Forced: damage that leaves him with fewer hit points than the progress sets him aside", layout: { stages: STAGES, stage: "132073", progress: 5, staging: [{ code: "132041", damage: 16 }] }, act: announce("damaged", "132041"), expect: [zone("132041", "setAside")] },
  { line: "132073:B:3", name: "the stage is the last one: defeated it wins the game", layout: { stages: STAGES, stage: "132073", progress: 20 }, act: announce("questCardDefeated", "132073"), expect: [flag("132073", "holdsWin"), won] },
  // 132074 Thieves! Fire! Murder!
  { line: "132074:A:1", name: "When Revealed: Smaug the Golden is set aside and Smaug the Magnificent joins the staging area", layout: { stages: STAGES, stage: "132074", side: "A", staging: [{ code: "132040", progress: 4 }], setAside: ["132041"] }, act: resolve("132074", "whenRevealed"), expect: [zone("132040", "setAside"), zone("132041", "staging"), flag("132074", "holdsWin")] },
  { line: "132074:B:1", name: "Forced: when the stage is defeated Smaug the Magnificent and A Bare Patch are set aside, Smaug the Golden returns and the quest is at stage 2B", layout: { stages: STAGES, stage: "132074", progress: 7, staging: [{ code: "132041", damage: 5 }, "132039"], setAside: ["132040"] }, act: announce("questCardDefeated", "132074"), expect: [zone("132041", "setAside"), zone("132039", "setAside"), zone("132040", "staging"), zone("132072", "questStage"), progressOn("132072", 0)] },
];

if (ROWS.length > 0) cardSpecs("the-lonely-mountain", ROWS);
else describe("the-lonely-mountain card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
