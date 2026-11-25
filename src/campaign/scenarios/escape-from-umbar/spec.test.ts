// Rules: hrd.setup-escape-from-umbar, hrd.side-quests, hrd.current-quest, rr.forced, rr.travel, rr.then, rr.cannot, rr.engaged, rr.shadow-effects (data/rules/entries.json); ledger lines of Escape from Umbar (data/printed/haradrim.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, defend, exhausted, classFlag, flag, handCount, progressOn, resolve, resourcesOn, respond, stat, threat, travel, zone, attackersOf, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Escape from Umbar (haradrim part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot express is a test titled with its line id in lines.test.ts.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28.
const STAGE_1 = "16066";
const SOLDIER = "16042";

const ROWS: readonly Row[] = [
  // 16014:A:1 "Forced: After an enemy attacks and destroys a character, remove X progress from the main quest, X is the attacking enemy's Threat." The Soldier has Threat 3 and kills the ally defending.
  { line: "16014:A:1", name: "Forced: an enemy that destroys a character takes progress off the main quest equal to its Threat", layout: { stage: STAGE_1, progress: 5, staging: ["16014"], engaged: [SOLDIER], play: ["ally"], deck: ["f0"] }, act: [attack(SOLDIER), defend("ally")], expect: progressOn(STAGE_1, 2) },

  // 16015:A:2 "Forced: When Umbar Sentry attacks, either remove 1 progress token from the main quest, or Umbar Sentry gets +2 Attack for this attack." The Sentry has Attack 2; undefended, the second option makes the hero take 4.
  { line: "16015:A:2", name: "Forced: the option Attack gives the attacking Sentry +2 Attack for this attack", layout: { stage: STAGE_1, progress: 3, engaged: ["16015"], deck: ["f0"] }, act: [attack("16015", { undefended: true }), answer("attack")], expect: [damageOn("dh1", 4), progressOn(STAGE_1, 3)] },

  // 16016:A:2 "Forced: After Narrow Alleyway leaves play, put the enemy under it into play, engaged with the first player."
  { line: "16016:A:2", name: "Forced: the enemy under the Alleyway comes into play engaged with the first player when the Alleyway leaves play", layout: { stage: STAGE_1, play: [], staging: ["16016"], under: [{ code: "16015", to: "16016" }], seats: 2, firstPlayer: 1 }, act: announce("leftPlay", "16016"), expect: zone("16015", "engaged") },

  // 16017:A:1 "While Umbar Street is the active location, each enemy gets -1 engagement cost for each progress token on the main quest." The Soldier costs 32.
  { line: "16017:A:1", name: "While active, each enemy gets -1 engagement cost for each progress token on the main quest", layout: { stage: STAGE_1, progress: 3, active: "16017", staging: [SOLDIER] }, act: [], expect: stat(SOLDIER, "engagementCost", 29) },

  // 16017:A:2 "Shadow: Discard an attachment you control."
  { line: "16017:A:2", name: "Shadow: the defending player discards an attachment he controls", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: attack("f0", { shadow: "16017" }), expect: count("attachment", "discard", 1) },


  // 16019:A:1 "X is the number of engaged enemies." 16019:A:2 "Travel: Assign X damage among characters in play to travel here."
  { line: "16019:A:1", name: "X, the Threat of Port of Harad, is the number of engaged enemies", layout: { stage: STAGE_1, staging: ["16019"], engaged: [SOLDIER, "16015"] }, act: [], expect: stat("16019", "threat", 2) },
  { line: "16019:A:2", name: "Travel: X damage is assigned among the characters in play, X the number of engaged enemies", layout: { stage: STAGE_1, phase: "Travel", staging: ["16019"], engaged: [SOLDIER, "16015"] }, act: [travel("16019")], expect: damageOn("dh1", 2) },

  // 16020:A:1 "While Haradrim Estate is in the staging area, progress cannot be placed here."
  { line: "16020:A:1", name: "In the staging area no progress can be placed on it", layout: { stage: STAGE_1, staging: ["16020"] }, act: [], expect: flag("16020", "noProgressPlaced") },

  // 16021:A:1 "When Revealed: Either remove all progress from the main quest, or assign X damage among characters in play. X is the number of progress tokens on the main quest."
  { line: "16021:A:1", name: "When Revealed: the first option removes all progress from the main quest", layout: { stage: STAGE_1, progress: 4 }, act: [resolve("16021", "whenRevealed"), answer("remove")], expect: progressOn(STAGE_1, 0) },
  { line: "16021:A:1", name: "When Revealed: the second option assigns X damage, X the progress on the main quest, and leaves the progress", layout: { stage: STAGE_1, progress: 4 }, act: [resolve("16021", "whenRevealed"), answer("damage")], expect: [damageOn("dh1", 4), progressOn(STAGE_1, 4)] },

  // 16021:A:2 "Shadow: Attacking enemy makes an additional attack against you after this one."
  { line: "16021:A:2", name: "Shadow: the attacking enemy makes an additional attack against the defender", layout: { deck: ["f0", "f0"] }, act: attack("f0", { shadow: "16021" }), expect: attackersOf("dh1", ["f0", "f0"]) },

  // 16041:A:1 "While Southron Captain is in the staging area, each other Harad enemy gets +1 Threat." 16041:A:2 "While Southron Captain is engaged with you, each other Harad enemy engaged with you gets +1 Attack."
  { line: "16041:A:1", name: "In the staging area each other Harad enemy gets +1 Threat, the Captain itself none", layout: { stage: STAGE_1, staging: ["16041", SOLDIER] }, act: [], expect: [stat(SOLDIER, "threat", 4), stat("16041", "threat", 2)] },
  { line: "16041:A:2", name: "Engaged with you, each other Harad enemy engaged with you gets +1 Attack, the Captain itself none", layout: { stage: STAGE_1, engaged: ["16041", SOLDIER] }, act: [], expect: [stat(SOLDIER, "attack", 4), stat("16041", "attack", 5)] },

  // 16042:A:2 "Shadow: Choose a non-unique enemy in the staging area. Engage it and deal it a shadow card." The first player chooses (an encounter card has no controller).
  { line: "16042:A:2", name: "Shadow: the enemy chosen in the staging area engages the defending player", layout: { stage: STAGE_1, staging: ["f3"], deck: ["f0", "f0"] }, act: attack("f0", { shadow: SOLDIER, undefended: true }), expect: zone("f3", "engaged") },

  // 16043:A:2 "Forced: After Southron Archer engages you, either remove 2 progress tokens from the main quest, or discard an ally you control."
  { line: "16043:A:2", name: "Forced: the option Ally discards an ally the player controls", layout: { stage: STAGE_1, progress: 3, engaged: ["16043"], play: ["ally"] }, act: [announce("engaged", "16043"), answer("ally")], expect: [count("ally", "discard", 1), progressOn(STAGE_1, 3)] },

  // 16044:A:2 "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if it was engaged this round)." Undefended, the Soldier (Attack 3) hits for 4.
  { line: "16044:A:2", name: "Shadow: the attacking enemy gets +1 Attack", layout: { stage: STAGE_1, engaged: [SOLDIER], deck: ["f0"] }, act: attack(SOLDIER, { shadow: "16044", undefended: true }), expect: damageOn("dh1", 4) },

  // 16045:A:3 "Response: When this stage is defeated, each player draws a card."
  { line: "16045:A:3", name: "Response: each player draws a card when the side quest is defeated", layout: { stage: STAGE_1, seats: 2, staging: [{ code: "16045", progress: 8 }], deckOf: ["filler"] }, act: [announce("questDefeated", "16045"), respond("16045")], expect: [handCount(1), handCount(1, 1)] },

  // 16046:A:1 "When Revealed: Each player must choose: either raise your threat by 1 for each character you control, or discard a character you control."
  { line: "16046:A:1", name: "When Revealed: the option threat raises the player's threat by 1 for each character he controls", layout: { play: ["ally"] }, act: [resolve("16046", "whenRevealed"), answer("threat")], expect: threat(31) },
  { line: "16046:A:1", name: "When Revealed: the option discard discards a character the player controls (the first one offered, a hero)", layout: { play: ["ally"] }, act: [resolve("16046", "whenRevealed"), answer("discard")], expect: [zone("dh1", "discard"), threat(28)] },

  // 16046:A:2 "Shadow: Attacking enemy gets +1 Attack. If this attack destroys a character, raise each player's threat by 1."
  { line: "16046:A:2", name: "Shadow: a character destroyed by the attack raises each player's threat by 1", layout: { engaged: ["16041"], play: ["ally"], deck: ["f0"], seats: 2 }, act: [attack("16041", { shadow: "16046" }), defend("ally")], expect: [threat(29), threat(29, 1)] },

  // 16047:A:1 "When Revealed: Each player exhausts a character he controls. Until the end of the combat phase, exhausted characters cannot ready."
  { line: "16047:A:1", name: "When Revealed: each player exhausts a character he controls", layout: { play: ["ally"] }, act: resolve("16047", "whenRevealed"), expect: [exhausted("dh1"), classFlag("dh1", "cannotReadyByPlayerCard")] },

  // 16047:A:2 "Shadow: Until the end of the round, defending character cannot ready."
  { line: "16047:A:2", name: "Shadow: the defending character cannot ready until the end of the round", layout: { engaged: [SOLDIER], deck: ["f0"] }, act: attack(SOLDIER, { shadow: "16047" }), expect: flag("dh1", "cannotReady") },

  // 16066:A:1 "Setup: Add 'Seize them!' to the staging area. Each player adds 1 different location to the staging area and puts 1 copy of Umbar Sentry into play engaged with him. Shuffle the encounter deck."
  { line: "16066:A:1", name: "Setup: each player adds a different location to the staging area and takes a Sentry engaged", layout: { stage: STAGE_1, seats: 2, deck: ["16016", "16016", "16017", "16015", "16015"] }, act: resolve("16066", "setup"), expect: [count("16016", "staging", 1), count("16017", "staging", 1), count("16015", "engaged", 2)] },

  // 16067:A:1 "When Revealed: End the current phase. Shuffle the encounter discard pile into the encounter deck. Starting with the first player, each player discards cards from the top of the encounter deck until he discards an enemy, and puts that enemy into play engaged with him."
  { line: "16067:A:1", name: "When Revealed: the discard pile is shuffled into the deck and each player takes the enemy he discards engaged", layout: { stage: "16067", seats: 2, deck: ["treachery", "16015"], discard: ["16041", "treachery"] }, act: resolve("16067", "whenRevealed"), expect: [count("16015", "engaged", 1), count("16041", "engaged", 1)] },

  // 16067:B:2 "Forced: At the beginning of the quest phase, if any player is not engaged with an enemy, discard cards from the top of the encounter deck until an enemy is discarded and add it to the staging area."
  { line: "16067:B:2", name: "Forced: a player who is not engaged makes the deck discard until an enemy, which goes to the staging area", layout: { stage: "16067", phase: "Quest", seats: 2, engaged: ["16043"], deck: ["treachery", "16015", "16041"] }, act: announce("beginningOfPhase"), expect: [zone("16015", "staging"), zone("16041", "encounterDeck")] },

  // 16040:A:1 "When Revealed: Discard cards from the encounter deck until a Harad enemy is discarded. Add that enemy to the staging area and place a resource token on it. That enemy is 'the Champion.' While this stage is in play, the Champion gets +2 Threat, +2 Attack, +2 Defense and gains: 'Immune to player card effects. ...'" The Archer is 2 Threat, 4 Attack, 3 Defense.
  { line: "16040:A:1", name: "When Revealed: the first Harad enemy discarded goes to the staging area with a resource token and gets +2 Threat, Attack and Defense and immunity to player card effects", layout: { stage: STAGE_1, deck: ["treachery", "16043", "16015"] }, act: resolve("16040", "whenRevealed"), expect: [zone("16043", "staging"), resourcesOn("16043", 1), stat("16043", "threat", 4), stat("16043", "attack", 6), stat("16043", "defense", 5), flag("16043", "immuneToPlayerCards"), zone("treachery", "encounterDiscard")] },

  // 16016:A:1 "Response: After the players travel here, choose a non-unique enemy engaged with a player and place it faceup under this location. While an enemy is under this location, that enemy is considered to be out of play."
  { line: "16016:A:1", name: "Response: after the players travel here, an engaged non-unique enemy goes under the location, out of play", layout: { stage: STAGE_1, phase: "Travel", staging: ["16016"], engaged: ["16015"] }, act: [travel("16016"), respond("16016")], expect: zone("16015", "under") },
];

if (ROWS.length > 0) cardSpecs("escape-from-umbar", ROWS);
else describe("escape-from-umbar card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
