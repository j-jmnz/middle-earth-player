// Rules: rr.search, rr.reveal, rr.forced, rr.guarded, rr.explored, rr.travel, rr.step-4-2, rr.doomed-x, rr.attachment-cards, rr.cancel, rr.victory, rr.quest-advancement, rr.shadow-effects, mec108.side-quests, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json); docs/brief.md (The Wizard's Quest).
import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, endPhase, exhausted, flag, handCount, heldBy, offers, quest, resolve, respond, resourcesOn, reveal, stat, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Wizard's Quest (standalone-scenarios part 10): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
const F0 = ["f0", "f0", "f0", "f0", "f0", "f0"];
const RHOSGOBEL = "51010";
const RIDER = "51011";
const ADVANCING = { phase: "Quest", deck: ["f0"] } as const;
const BEGINNING_OF = (phase: "Quest" | "Travel") => ({ seat: null, phase }) as const;
// The 0 cost card of the encounter deck, then a card of cost 3 and one of cost 1: the top 5 cards a stage's When Revealed searches.
const TOP = ["51012", "51014", "51034", "f0", "f0"];

const ROWS: readonly Row[] = [
  // 51001 Radagast's Request.
  { line: "51001:A:1", name: "Setup: 7 of the 8 sets stay, the first player's stages are chosen and the 0 cost enemy or location of highest Threat joins the staging area", layout: { stage: "51001", deck: ["51012", "51015", "51018", "51021", "51024", "51028", "51031", "51034"] }, act: resolve("51001", "setup"), expect: [deckCount(6)] },
  { line: "51001:B:1", name: "Forced: when Rhosgobel is explored in the staging area it flips and Rider of Mirkwood joins the staging area", layout: { stage: "51001", staging: [RHOSGOBEL] }, act: announce("locationExplored", RHOSGOBEL), expect: [count(RIDER, "staging", 1)] },
  { line: "51001:B:1", name: "as the active location it flips once", layout: { stage: "51001", active: RHOSGOBEL }, act: announce("activeExplored", RHOSGOBEL), expect: [count(RIDER, "staging", 1)] },
  { line: "51001:B:2", name: "the players cannot advance while Rhosgobel is in play", layout: { stage: "51001", progress: 10, staging: [RHOSGOBEL], ...ADVANCING }, act: quest("success"), expect: [zone("51001", "questStage")] },
  // 51003 A Fork in the Road.
  { line: "51003:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51003", deck: TOP }, act: resolve("51003", "whenRevealed"), expect: [zone("51014", "encounterDiscard")] },
  { line: "51003:A:1", name: "with two or more players a card of cost 2 or less is found", layout: { stage: "51003", seats: 2, deck: ["51012", "51021", "51034", "f0", "f0"] }, act: resolve("51003", "whenRevealed"), expect: [zone("51021", "staging")] },
  { line: "51003:B:1", name: "When Revealed: a location of cost 2 or less joins the staging area with a resource on it", layout: { stage: "51003", deck: ["51044", "51013", "f0"] }, act: resolve("51003", "whenRevealed"), expect: [zone("51013", "staging"), resourcesOn("51013", 1)] },
  { line: "51003:B:2", name: "while the stage holds fewer than 5 progress a location with a resource is immune to player card effects", layout: { stage: "51003", staging: [{ code: "51044", resources: 1 }] }, act: [], expect: [flag("51044", "immuneToPlayerCards")] },
  { line: "51003:B:2", name: "the stage cannot be defeated while a location with a resource is in play", layout: { stage: "51003", progress: 5, staging: [{ code: "51044", resources: 1 }], ...ADVANCING }, act: quest("success"), expect: [zone("51003", "questStage")] },
  // 51004 Carried Away.
  { line: "51004:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51004", deck: TOP }, act: resolve("51004", "whenRevealed"), expect: [zone("51014", "encounterDiscard")] },
  { line: "51004:B:1", name: "When Revealed: each player's ally of highest cost lies under the stage", layout: { stage: "51004", play: ["ally"] }, act: resolve("51004", "whenRevealed"), expect: [zone("ally", "under")] },
  { line: "51004:B:2", name: "Forced: when the stage is defeated each held ally returns to its owner's hand", layout: { stage: "51004", play: ["ally"] }, act: [resolve("51004", "whenRevealed"), announce("questCardDefeated", "51004")], expect: [zone("ally", "hand")] },
  // 51005 A New Terror Abroad.
  { line: "51005:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 1 or less, which is revealed", layout: { stage: "51005", deck: TOP }, act: resolve("51005", "whenRevealed"), expect: [zone("51014", "encounterDiscard")] },
  { line: "51005:B:1", name: "the stage has 5 more quest points for each player", layout: { stage: "51005", seats: 2 }, act: [], expect: [stat("51005", "questPoints", 15)] },
  { line: "51005:B:2", name: "Forced: at the beginning of the quest phase Rider of Mirkwood attacks the first player from the staging area", layout: { stage: "51005", phase: "Quest", staging: [RIDER], deck: F0 }, act: [announce("beginningOfPhase", undefined, BEGINNING_OF("Quest")), endPhase], expect: [damageOn("dh1", 6)] },
  // 51007 The Necromancer's Tower.
  { line: "51007:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less", layout: { stage: "51007", deck: ["51012", "51021", "f0", "f0", "f0"] }, act: resolve("51007", "whenRevealed"), expect: [zone("51021", "staging")] },
  { line: "51007:B:1", name: "Forced: cards are discarded until a treachery, which is revealed in full, Doomed included", layout: { stage: "51007", threat: [30, 30], deck: ["f0", "51023", "f0"] }, act: announce("stagingStepBegins"), expect: [zone("51023", "attached"), threat(31)] },
  { line: "51007:B:2", name: "the players win the game when the stage is defeated", layout: { stage: "51007" }, act: resolve("51007", "questResolution"), expect: [won] },
  // 51008 Dungeons of the Necromancer.
  { line: "51008:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less", layout: { stage: "51008", deck: ["51012", "51044", "f3", "f0", "f0"] }, act: resolve("51008", "whenRevealed"), expect: [zone("51044", "staging")] },
  { line: "51008:B:1", name: "When Revealed: each player's hero lies under the first enemy discarded", layout: { stage: "51008", deck: ["f3", "f0"] }, act: resolve("51008", "whenRevealed"), expect: [zone("dh1", "captive")] },
  { line: "51008:B:2", name: "the players win the game when the stage is defeated", layout: { stage: "51008" }, act: resolve("51008", "questResolution"), expect: [won] },
  // 51009 Return to Rhosgobel.
  { line: "51009:A:1", name: "When Revealed: the top 5 cards are searched for a card with cost 2 or less", layout: { stage: "51009", deck: ["51012", "51021", "f0", "f0", "f0"] }, act: resolve("51009", "whenRevealed"), expect: [zone("51021", "staging")] },
  { line: "51009:B:1", name: "Rider of Mirkwood has engagement cost 0", layout: { stage: "51009", staging: [RIDER] }, act: [], expect: [stat(RIDER, "engagementCost", 0)] },
  { line: "51009:B:2", name: "with no progress on the stage Rider of Mirkwood cannot take damage", layout: { stage: "51009", staging: [RIDER] }, act: [], expect: [flag(RIDER, "cannotTakeDamage")] },
  { line: "51009:B:2", name: "otherwise its damage cannot exceed the progress on the stage", layout: { stage: "51009", progress: 3, staging: [RIDER] }, act: [], expect: [stat(RIDER, "damageCeiling", 3)] },
  { line: "51009:B:3", name: "the stage cannot be defeated while Rider of Mirkwood is in play", layout: { stage: "51009", progress: 10, engaged: [RIDER], ...ADVANCING }, act: quest("success"), expect: [zone("51009", "questStage")] },
  { line: "51009:B:3", name: "the players win the game when the stage is defeated", layout: { stage: "51009" }, act: resolve("51009", "questResolution"), expect: [won] },
  // 51010 Rhosgobel and 51011 Rider of Mirkwood.
  { line: "51010:A:2", name: "Response: after the players travel to it each hero gains 1 resource and each player draws 1 card", layout: { phase: "Travel", staging: [RHOSGOBEL], deckOf: ["f0", "f0"] }, act: [travel(RHOSGOBEL), respond(RHOSGOBEL)], expect: [resourcesOn("dh1", 2), handCount(2)] },
  { line: "51011:A:2", name: "Threat X: 1 more than the stage number", layout: { stage: "51003", staging: [RIDER] }, act: [], expect: [stat(RIDER, "threat", 3)] },
  { line: "51011:A:3", name: "it cannot leave the staging area unless the players are at stage 3", layout: { stage: "51005", staging: [RIDER] }, act: [], expect: [flag(RIDER, "cannotLeaveStaging")] },
];

cardSpecs("the-wizards-quest", ROWS);
