// Rules: hrd.heat-tracker, hrd.side-quests, rr.forced, rr.travel, rr.cannot, rr.engaged, rr.search, rr.shadow-effects, rr.modifiers, rr.blank, rr.active-location, rr.explored (data/rules/entries.json); ledger lines of Desert Crossing (data/printed/haradrim.json).
import { describe, it } from "vitest";

import { announce, notWon, quest, answer, attack, cardSpecs, classFlag, count, counter, damageOn, deckCount, endRound, exhausted, flag, handCount, lost, progressOn, resolve, respond, window, stagingThreat, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Desert Crossing (haradrim part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28. `temperature` in a layout is the heat tracker as the Setup left it.
const MAIN = "16068";
const LAST = "16070";

const MIDDLE = "16069";

const ROWS: readonly Row[] = [
  // 16068:B:2 "Forced: At the end of the round, increase the temperature by 4." 16068:B:3 "If the temperature is 60 or higher, the players lose the game." Scorching Sun (+4) takes 56 to 60 exactly.
  { line: "16068:B:2", name: "Forced: at the end of the round the temperature rises by 4", layout: { stage: MAIN, temperature: 31 }, act: endRound, expect: counter("temperature", 35) },
  { line: "16068:B:3", name: "the players lose the game as soon as the temperature is 60", layout: { stage: MAIN, temperature: 56 }, act: resolve("16030", "whenRevealed"), expect: [counter("temperature", 60), lost] },

  // 16069:A:1 "When Revealed: Increase the temperature by 2. Shuffle the encounter discard pile into the encounter deck and reveal 1 encounter card per player." Two players reveal the two cards of the shuffled pile.
  { line: "16069:A:1", name: "When Revealed: the temperature rises by 2, the discard pile is shuffled in and each player reveals a card", layout: { stage: MIDDLE, seats: 2, temperature: 20, deck: ["f0"], discard: ["f3"] }, act: resolve("16069", "whenRevealed"), expect: [counter("temperature", 22), zone("f0", "staging"), zone("f3", "staging")] },
  // 16069:B:1 "Forced: At the end of the round, increase the temperature by 4. Then, each player assigns X damage among characters he controls, where X is the tens digit of the temperature." 36 becomes 40: 4 damage, not 3.
  { line: "16069:B:1", name: "Forced: at the end of the round the temperature rises by 4, then X damage is assigned, X read after the rise", layout: { stage: MIDDLE, temperature: 36 }, act: endRound, expect: [counter("temperature", 40), damageOn("dh1", 4)] },
  // 16069:B:2 "If the temperature is 60 or higher, the players lose the game."
  { line: "16069:B:2", name: "the players lose the game as soon as the temperature is 60", layout: { stage: MIDDLE, temperature: 56 }, act: resolve("16030", "whenRevealed"), expect: [counter("temperature", 60), lost] },

  // 16070:B:3 "While at least 1 Were-worm is in play, the players cannot defeat this stage. If the players defeat this stage, they win the game. If the temperature is 60 or higher, the players lose the game." The heroes' 4 Willpower beats the Threat.
  { line: "16070:B:3", name: "this stage cannot be defeated while a Were-worm is in play: the quest is not won", layout: { stage: LAST, progress: 14, temperature: 10, staging: ["16028"] }, act: quest("success"), expect: notWon },
  { line: "16070:B:3", name: "the players lose the game as soon as the temperature is 60", layout: { stage: LAST, temperature: 56 }, act: resolve("16030", "whenRevealed"), expect: [counter("temperature", 60), lost] },

  // 16023:A:3 "Response: When Seek Shade is defeated, reduce the temperature by 10."
  { line: "16023:A:3", name: "Response: the temperature falls by 10 when the side quest is defeated", layout: { stage: MAIN, temperature: 25, staging: [{ code: "16023", progress: 6 }] }, act: [announce("questDefeated", "16023"), respond("16023")], expect: counter("temperature", 15) },

  // 16025:A:1 "While the temperature is 40 or higher, Burnt Sands gets +2 Threat." It has Threat 2 and counts in the staging area.
  { line: "16025:A:1", name: "In the staging area it gets +2 Threat at a temperature of 40 or higher", layout: { stage: MAIN, temperature: 40, staging: ["16025"] }, act: [], expect: stat("16025", "threat", 4) },

  // 16026:A:1 "X is the tens digit of the temperature." Threat X.
  { line: "16026:A:1", name: "X, the Threat of Scorched Hamada, is the tens digit of the temperature", layout: { stage: MAIN, temperature: 30, staging: ["16026"] }, act: [], expect: stat("16026", "threat", 3) },

  // 16022:A:1 "... Make that location the active location." The shuffled pile holds the old active location (the discard pile includes it) and the deck's one other location; the seed picks the new one.
  { line: "16022:A:1", name: "When Revealed: the active location is discarded and a location found in the reshuffled deck becomes the active location", layout: { stage: MAIN, seed: 1, active: "16026", deck: ["16027", "f0"] }, act: resolve("16022", "whenRevealed"), expect: [zone("16027", "activeLocation"), zone("16026", "encounterDiscard")] },

  // 16023:A:2 "Forced: At the end of the round, remove X progress from the main quest. X is the tens digit of the temperature." 31 and 51 end the round at 35 and 55 whichever Forced effect goes first.
  { line: "16023:A:2", name: "Forced: at the end of the round the main quest loses X progress, X the tens digit of the temperature", layout: { stage: MAIN, progress: 5, temperature: 31, staging: ["16023"] }, act: endRound, expect: progressOn(MAIN, 2) },
  { line: "16023:A:2", name: "Forced: the progress removed stops at 0 on the main quest", layout: { stage: MAIN, progress: 3, temperature: 51, staging: ["16023"] }, act: endRound, expect: progressOn(MAIN, 0) },

  // 16024:A:1 "Carrion Bird gets -1 engagement cost for each damaged character in play." It costs 40; two damaged allies, one of each player, and an undamaged one.
  { line: "16024:A:1", name: "Carrion Bird gets -1 engagement cost for each damaged character of any player", layout: { seats: 2, staging: ["16024"], play: [{ code: "ally", damage: 1 }, { code: "ally", damage: 2, seat: 1 }, "ally"] }, act: [], expect: stat("16024", "engagementCost", 38) },
  // 16024:A:2 "Forced: After Carrion Bird engages you, discard a damaged character you control."
  { line: "16024:A:2", name: "Forced: after it engages you, a damaged character you control is discarded and an undamaged one stays", layout: { engaged: ["16024"], play: [{ code: "ally", damage: 1 }, "ally"] }, act: announce("engaged", "16024"), expect: [count("ally", "discard", 1), count("ally", "play", 1)] },

  // 16025:A:2 "Forced: After Burnt Sands becomes the active location, increase the temperature by 2."
  { line: "16025:A:2", name: "Forced: after Burnt Sands becomes the active location the temperature rises by 2", layout: { stage: MAIN, temperature: 20, active: "16025" }, act: announce("becameActive", "16025"), expect: counter("temperature", 22) },

  // 16026:A:2 "Forced: After Scorched Hamada becomes the active location, assign X damage among characters in play." X is the tens digit.
  { line: "16026:A:2", name: "Forced: after it becomes the active location X damage is assigned among characters in play, X the tens digit", layout: { stage: MAIN, phase: "Travel", temperature: 30, staging: ["16026"] }, act: travel("16026"), expect: damageOn("dh1", 3) },
  // 16026:A:3 "Shadow: Raise your threat by X, where X is the tens digit of the temperature."
  { line: "16026:A:3", name: "Shadow: the defending player raises his threat by the tens digit of the temperature", layout: { temperature: 40 }, act: attack("f0", { shadow: "16026", undefended: true }), expect: threat(32) },

  // 16027:A:1 "While Parched Wadi is in the staging area, each Creature enemy gets +1 Threat and +1 Attack." Carrion Bird (Creature, 2 Threat, 2 Attack) in the staging area, the Scorpion (Creature, 3 and 3) engaged, the filler enemy (no Creature, 0 Threat and 1 Attack) in the staging area.
  { line: "16027:A:1", name: "While in the staging area each Creature enemy, staged or engaged, gets +1 Threat and +1 Attack, a non-Creature none", layout: { staging: ["16027", "16024", "f0"], engaged: ["16055"] }, act: [], expect: [stat("16024", "threat", 3), stat("16024", "attack", 3), stat("16055", "threat", 4), stat("16055", "attack", 4), stat("f0", "threat", 0), stat("f0", "attack", 1)] },
  // 16027:A:2 "Forced: After Parched Wadi becomes the active location, shuffle the encounter discard pile into the encounter deck and discard cards from the top until a Creature enemy is discarded. Add that enemy to the staging area."
  { line: "16027:A:2", name: "Forced: after it becomes the active location a Creature enemy found in the reshuffled discard pile is added to the staging area", layout: { stage: MAIN, deck: ["f0"], discard: ["16024", "f3"], active: "16027" }, act: announce("becameActive", "16027"), expect: [zone("16024", "staging"), zone("f0", "encounterDiscard")] },

  // 16028:A:1 "X is the tens digit of the temperature." Threat, Attack and Defense are printed X.
  { line: "16028:A:1", name: "X, its Threat, Attack and Defense, is the tens digit of the temperature", layout: { temperature: 30, staging: ["16028"] }, act: [], expect: [stat("16028", "threat", 3), stat("16028", "attack", 3), stat("16028", "defense", 3)] },
  // 16028:A:2 "Forced: After Were-worm engages you, it makes an immediate attack. (Do not deal it a shadow card.)"
  { line: "16028:A:2", name: "Forced: after it engages you it attacks at once and the encounter deck loses no shadow card", layout: { temperature: 30, engaged: ["16028"], deck: ["f0", "f0"] }, act: announce("engaged", "16028"), expect: [window("defense"), deckCount(2)] },
  // 16028:A:3 "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the temperature is 40 or higher)." The filler enemy has Attack 1.
  { line: "16028:A:3", name: "Shadow: the attacking enemy gets +2 Attack at 40 or higher", layout: { temperature: 40 }, act: attack("f0", { shadow: "16028", undefended: true }), expect: damageOn("dh1", 3) },

  // 16029:A:1 "When Revealed: Each player assigns X damage among characters he controls, where X is the tens digit of the temperature."
  { line: "16029:A:1", name: "When Revealed: each player assigns X damage among his own characters, X the tens digit of the temperature", layout: { seats: 2, temperature: 20 }, act: resolve("16029", "whenRevealed"), expect: [damageOn("dh1", 2), damageOn("dh3", 2)] },
  // 16029:A:2 "Shadow: Attacking enemy gets +X Attack, where X is the tens digit of the temperature."
  { line: "16029:A:2", name: "Shadow: the attacking enemy gets +X Attack, X the tens digit of the temperature", layout: { temperature: 30 }, act: attack("f0", { shadow: "16029", undefended: true }), expect: damageOn("dh1", 4) },

  // 16030:A:2 "When Revealed: Increase the temperature by 4."
  { line: "16030:A:2", name: "When Revealed: the temperature rises by 4", layout: { temperature: 30 }, act: resolve("16030", "whenRevealed"), expect: counter("temperature", 34) },
  { line: "16030:A:2", name: "When Revealed: a rise to 60 loses the game at once, from the card's own When Revealed", layout: { stage: MAIN, temperature: 58 }, act: resolve("16030", "whenRevealed"), expect: lost },
  // 16030:A:3 "Shadow: Either increase the temperature by 2, or return attacking enemy to the staging area after this attack."
  { line: "16030:A:3", name: "Shadow: the option temperature raises it by 2 and the enemy stays engaged", layout: { temperature: 30 }, act: [attack("f0", { shadow: "16030", undefended: true }), answer("temperature")], expect: [counter("temperature", 32), zone("f0", "engaged")] },
  { line: "16030:A:3", name: "Shadow: the option return puts the attacking enemy back in the staging area after the attack", layout: { temperature: 30 }, act: [attack("f0", { shadow: "16030", undefended: true }), answer("return")], expect: [counter("temperature", 30), zone("f0", "staging")] },

  // 16048:A:1 "Characters cannot be readied by player card effects."
  { line: "16048:A:1", name: "Characters cannot be readied by player card effects: the characters of every player hold the lock", layout: { staging: ["16048"], play: ["ally"] }, act: [], expect: [flag("dh1", "cannotReadyByPlayerCard"), flag("ally", "cannotReadyByPlayerCard")] },
  // 16048:A:2 "Response: When this stage is defeated, each player readies 1 hero he controls."
  { line: "16048:A:2", name: "Response: each player readies 1 hero when the side quest is defeated", layout: { seats: 2, staging: [{ code: "16048", progress: 6 }], exhaustedCards: ["dh1", "dh3"] }, act: [announce("questDefeated", "16048"), respond("16048")], expect: [exhausted("dh1", false), exhausted("dh3", false)] },

  // 16049:A:1 "While Towering Dunes is in the staging area, progress cannot be placed on locations in the staging area not named Towering Dunes."
  { line: "16049:A:1", name: "While in the staging area the other staged locations take no progress and it takes its own", layout: { staging: ["16049", "16026", "16025"] }, act: [], expect: [flag("16026", "noProgressPlaced"), flag("16025", "noProgressPlaced"), flag("16049", "noProgressPlaced", false)] },
  // 16049:A:2 "Forced: After Towering Dunes becomes the active location, reveal the top card of the encounter deck."
  { line: "16049:A:2", name: "Forced: after it becomes the active location the top card of the encounter deck is revealed", layout: { stage: MAIN, active: "16049", deck: ["f0", "f3"] }, act: announce("becameActive", "16049"), expect: [zone("f0", "staging"), zone("f3", "encounterDeck")] },

  // 16050:A:1 "While Desert Oasis is the active location, it gains: \"Response: When Desert Oasis is explored, heal 4 damage from among characters in play.\""
  { line: "16050:A:1", name: "Response: when it is explored damage is healed from among characters in play, the actor choosing each one", layout: { stage: MAIN, active: { code: "16050", progress: 2 }, play: [{ code: "ally", damage: 1 }] }, act: [announce("activeExplored", "16050"), respond("16050")], expect: damageOn("ally", 0) },
  // 16050:A:2 "Forced: After Desert Oasis becomes the active location, each player exhausts a character he controls."
  { line: "16050:A:2", name: "Forced: after it becomes the active location each player exhausts a character he controls", layout: { stage: MAIN, seats: 2, active: "16050" }, act: announce("becameActive", "16050"), expect: [exhausted("dh1"), exhausted("dh3")] },

  // 16051:A:1 "When Revealed: Each player either discards his hand, or assigns X damage among characters he controls. X is the number of cards in his hand."
  { line: "16051:A:1", name: "When Revealed: the option discard empties the hand", layout: { hand: ["filler", "filler"] }, act: [resolve("16051", "whenRevealed"), answer("discard")], expect: [handCount(0), damageOn("dh1", 0)] },
  { line: "16051:A:1", name: "When Revealed: the option damage assigns X damage, X the cards in the hand, and keeps the hand", layout: { hand: ["filler", "filler"] }, act: [resolve("16051", "whenRevealed"), answer("damage")], expect: [damageOn("dh1", 2), handCount(2)] },
  // 16051:A:2 "Shadow: Either discard the highest cost attachment you control, or assign X damage among characters you control where X is the number of attachments you control."
  { line: "16051:A:2", name: "Shadow: the option discard discards an attachment you control", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: [attack("f0", { shadow: "16051", undefended: true }), answer("discard")], expect: count("attachment", "discard", 1) },
  { line: "16051:A:2", name: "Shadow: the option damage assigns X damage, X the attachments you control, and discards none", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: [attack("f0", { shadow: "16051", undefended: true }), answer("damage")], expect: [damageOn("dh1", 3), count("attachment", "discard", 0)] },

  // 16052:A:1 "When Revealed: Each player exhausts a character he controls and deals 1 damage to that character."
  { line: "16052:A:1", name: "When Revealed: each player exhausts a character he controls and deals 1 damage to that character", layout: { play: ["ally"] }, act: [resolve("16052", "whenRevealed"), answer("ally")], expect: [exhausted("ally"), damageOn("ally", 1), damageOn("dh1", 0)] },
  // 16052:A:2 "Shadow: Exhaust a character you control."
  { line: "16052:A:2", name: "Shadow: a character you control is exhausted", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "16052", undefended: true }), answer("ally")], expect: exhausted("ally") },

  // 16053:A:1 "Treat the printed text box of each damaged character as if it were blank (except for Traits)."
  { line: "16053:A:1", name: "Treat the printed text box of each damaged character as if it were blank, an undamaged one not", layout: { staging: ["16053"], play: [{ code: "ally", damage: 1 }, { code: "ally" }] }, act: [], expect: [classFlag("ally", "blankText")] },
  // 16053:A:2 "Response: When this stage is defeated, heal 1 damage from each character in play." A healed character is no longer blank: it has its text back.
  { line: "16053:A:2", name: "Response: 1 damage is healed from each character in play, and a healed character holds its text again", layout: { staging: [{ code: "16053", progress: 6 }], play: [{ code: "ally", damage: 1 }] }, act: [announce("questDefeated", "16053"), respond("16053")], expect: [damageOn("ally", 0), classFlag("ally", "blankText", false)] },

  // 16054:A:2 "Forced: After the players travel to a location, Sand Viper engages the first player."
  { line: "16054:A:2", name: "Forced: after the players travel Sand Viper engages the first player", layout: { stage: MAIN, phase: "Travel", staging: ["place", "16054"] }, act: travel("place"), expect: zone("16054", "engaged") },

  // 16055:A:1 "Forced: After Giant Scorpion damages a character, that character cannot ready until the end of the round." The Scorpion (Attack 3) beats the defending hero (Defense 2).
  { line: "16055:A:1", name: "Forced: the character the Scorpion damages cannot ready until the end of the round", layout: { engaged: ["16055"] }, act: attack("16055"), expect: [flag("dh1", "cannotReady"), exhausted("dh1")] },
  // 16055:A:2 "Shadow: If this attack deals damage, the defending character cannot ready until the end of the round."
  { line: "16055:A:2", name: "Shadow: if the attack deals damage the defending character cannot ready until the end of the round", layout: {}, act: attack("f0", { shadow: "16055", undefended: true }), expect: flag("dh1", "cannotReady") },

  // 16068:B:1 "Forced: After an ally enters play, either exhaust it, or deal 1 damage to it."
  { line: "16068:B:1", name: "Forced: after an ally enters play the option exhaust exhausts it", layout: { stage: MAIN, play: ["ally"] }, act: [announce("enteredPlay", "ally"), answer("exhaust")], expect: [exhausted("ally"), damageOn("ally", 0)] },
  { line: "16068:B:1", name: "Forced: after an ally enters play the option damage deals 1 damage to it", layout: { stage: MAIN, play: ["ally"] }, act: [announce("enteredPlay", "ally"), answer("damage")], expect: [damageOn("ally", 1), exhausted("ally", false)] },

  // 16070:A:1 "When Revealed: Increase the temperature by 2. Each player searches the encounter deck, discard pile, and victory display for a Were-worm and adds it to the staging area, if able. Shuffle the encounter deck."
  { line: "16070:A:1", name: "When Revealed: the temperature rises by 2 and each player adds a Were-worm from the deck, the discard pile or the victory display", layout: { stage: LAST, seats: 2, temperature: 30, deck: ["16028", "f0"], discard: ["16028"], victory: ["16028"] }, act: resolve("16070", "whenRevealed"), expect: [counter("temperature", 32), count("16028", "staging", 2)] },
  { line: "16070:A:1", name: "When Revealed: a Were-worm that lies only in the victory display is found there", layout: { stage: LAST, temperature: 30, deck: ["f0"], victory: ["16028"] }, act: resolve("16070", "whenRevealed"), expect: zone("16028", "staging") },
  // 16070:B:1 "During the quest phase, add X Threat to the total Threat in the staging area, where X is the tens digit of the temperature." Carrion Bird has Threat 2.
  { line: "16070:B:1", name: "During the quest phase X Threat is added to the total Threat in the staging area, X the tens digit", layout: { stage: LAST, phase: "Quest", temperature: 30, staging: ["16024"] }, act: [], expect: stagingThreat(5) },
  // 16070:B:2 "Forced: At the end of the round, increase the temperature by 4."
  { line: "16070:B:2", name: "Forced: at the end of the round the temperature rises by 4", layout: { stage: LAST, temperature: 31 }, act: endRound, expect: counter("temperature", 35) },
];

if (ROWS.length > 0) cardSpecs("desert-crossing", ROWS);
else describe("desert-crossing card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
