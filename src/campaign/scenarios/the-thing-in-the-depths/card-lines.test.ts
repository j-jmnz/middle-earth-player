// Rules: dcce.grapple, dcce.stormcaller-and-the-thing, rr.shadow-effects, rr.travel, rr.reveal, rr.search, rr.forced, rr.cannot, rr.hit-points, rr.quest-advancement (data/rules/entries.json).
import { describe, it } from "vitest";

import { answer, attack, cardSpecs, count, damageOn, deckCount, defend, exhausted, flag, progressOn, quest, resolve, resourcesOn, reveal, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Thing in the Depths (Dream-chaser part 5): one row for each printed line a single action can show, on a table of plain-number heroes (dh1 and dh2: 2 Willpower, 2 Attack, 2 Defense, 6 hit
// points) and the stand-ins f0 and f3 (1 Attack, 1 Defense, 3 hit points; Threat 0 and 3, engagement cost 50), ally (1/1/1, 2 hit points) and place (Threat 2, 2 quest points). `cardSpecs` runs each row again without
// the records of its line, where it must fail. The lines that need a choice between cards, a grappled enemy, two players or a false case are in card-lines-ship.test.ts and card-lines-beast.test.ts.
const ROWS: readonly Row[] = [
  // 12039 Take the Ship! B:3: "Progress cannot be placed on this stage unless Helm of the Stormcaller is in the victory display." The active location still takes its share.
  { line: "12039:B:3", name: "no progress is placed on the stage while Helm is not in the victory display; the active location still takes its share", layout: { stage: "12039", active: "place" }, act: quest("success"), expect: [zone("place", "encounterDiscard"), progressOn("12039", 0)] },

  // 12041 Defend the Ship! A:1: "Discard cards from the top of the encounter deck until X Tentacle enemies are discarded, where X is 1 more than the number of players in the game. Resolve the Grapple keyword on each of those enemies."
  { line: "12041:A:1", name: "with 1 player, 2 Tentacle enemies are discarded and grapple; a non-Tentacle enemy is discarded and the cards below stay in the deck", layout: { stage: "12041", staging: ["12045"], deck: ["12051", "f0", "12054", "12053"] }, act: resolve("12041", "whenRevealed"), expect: [zone("12051", "grappled"), zone("12054", "grappled"), zone("f0", "encounterDiscard"), zone("12053", "encounterDeck"), deckCount(1)] },
  // B:1: "During the travel phase, the players may travel to a location in the staging area even if another location is currently active. If they do, return the currently active location to the staging area."
  { line: "12041:B:1", name: "the players travel while a location is active, and that location returns to the staging area", layout: { stage: "12041", phase: "Travel", staging: ["12045"], active: "place" }, act: travel("12045"), expect: [zone("12045", "activeLocation"), zone("place", "staging")] },

  // 12042 Helm of the Stormcaller A:2: "+1 quest point for each resource token on a Raider enemy in play." It prints 1 quest point.
  { line: "12042:A:2", name: "gets +1 quest point for each resource on a Raider enemy in the staging area", layout: { staging: ["12042", { code: "11064", resources: 2 }] }, act: [], expect: stat("12042", "questPoints", 3) },

  // 12043 Forecastle Deck A:1: "After you travel to Forecastle Deck, search the encounter deck and discard pile for an enemy and reveal it."
  { line: "12043:A:1", name: "an enemy found in the discard pile is revealed into the staging area", layout: { phase: "Travel", staging: ["12043"], deck: ["f0"], discard: ["f3"] }, act: [travel("12043"), answer("f3")], expect: zone("f3", "staging") },
  // A:2: "Attacking enemy gets +1 Attack (+2 Attack instead if defending character has no resources on it or in its resource pool)."
  { line: "12043:A:2", name: "an undefended attack gets +1 Attack: there is no defending character", layout: {}, act: attack("f0", { shadow: "12043", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "12043:A:2", name: "the attack on a hero with an empty pool gets +2 Attack", layout: {}, act: [attack("f0", { shadow: "12043" }), defend("dh1")], expect: damageOn("dh1", 1) },
  { line: "12043:A:2", name: "the attack on an ally with no resources gets +2 Attack and destroys it", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "12043" }), defend("ally")], expect: zone("ally", "discard") },

  // 12044 Weather Deck A:2: "Shadow: Exhaust a character you control." (Its A:1 travel cost is in card-lines-ship.test.ts: the travel phase ends in a refresh that readies the character.)
  { line: "12044:A:2", name: "the defending player exhausts a character he controls", layout: {}, act: [attack("f0", { shadow: "12044", undefended: true }), answer("dh2")], expect: exhausted("dh2") },

  // 12045 Cargo Hold A:1: "While Cargo Hold is the active location, each enemy gets +1 Defense."
  { line: "12045:A:1", name: "each enemy, in the staging area or engaged, gets +1 Defense while it is active", layout: { active: "12045", staging: ["f0"], engaged: ["f3"] }, act: [], expect: [stat("f0", "defense", 2), stat("f3", "defense", 2)] },

  // 12046 Crew Quarters A:1: "Travel: Add 1 resource to each Raider card in play to travel here." A:2: "Attacking enemy gets +2 Attack."
  { line: "12046:A:1", name: "traveling here adds 1 resource to a Raider in the staging area", layout: { phase: "Travel", staging: ["12046", "11064"] }, act: travel("12046"), expect: [resourcesOn("11064", 1), zone("12046", "activeLocation")] },
  { line: "12046:A:2", name: "the attacking enemy gets +2 Attack", layout: {}, act: attack("f0", { shadow: "12046", undefended: true }), expect: damageOn("dh1", 3) },

  // 12047 Quarter Deck A:2: "Shadow: Discard an attachment you control."
  { line: "12047:A:2", name: "the defending player discards an attachment he controls", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: [attack("f0", { shadow: "12047" }), defend("dh1")], expect: zone("attachment", "discard") },
  { line: "12047:A:2", name: "of 2 attachments the defending player controls, 1 is discarded", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh2" }] }, act: [attack("f0", { shadow: "12047" }), defend("dh1")], expect: count("attachment", "discard", 1) },

  // 12048 Hold Steady! A:1: "Exhaust each character with 1 Defense or less." A:2: "If the defending character has 0 Defense, discard it. Otherwise, the defending character gets -2 Defense for this attack."
  { line: "12048:A:1", name: "an ally with 1 Defense is exhausted, the heroes with 2 are not", layout: { play: ["ally"], deck: ["f0"] }, act: reveal("12048"), expect: [exhausted("ally"), exhausted("dh1", false)] },
  { line: "12048:A:1", name: "a character of the second player with 1 Defense is exhausted too", layout: { seats: 2, play: [{ code: "ally", seat: 1 }], deck: ["f0"] }, act: reveal("12048"), expect: exhausted("ally") },
  { line: "12048:A:2", name: "a defender with 2 Defense gets -2 Defense for the attack", layout: {}, act: [attack("f0", { shadow: "12048" }), defend("dh1")], expect: damageOn("dh1", 1) },

  // 110063 The Thing in the Depths (the Campaign Expansion's card) A:2: "Cannot be engaged." A:3: "+3 hit points per player." It prints 8 on side A and 4 on side B.
  { line: "110063:A:2", name: "cannot be engaged on side A", layout: { staging: ["110063"] }, act: [], expect: flag("110063", "cannotBeEngaged") },
  { line: "110063:A:3", name: "gets +3 hit points for each of 2 players on side A", layout: { seats: 2, staging: ["110063"] }, act: [], expect: stat("110063", "hitPoints", 14) },
  { line: "110063:B:3", name: "cannot be engaged on side B", layout: { staging: [{ code: "110063", upgraded: true }] }, act: [], expect: flag("110063", "cannotBeEngaged") },
  { line: "110063:B:4", name: "gets +3 hit points for each of 2 players on side B, 4 + 6", layout: { seats: 2, staging: [{ code: "110063", upgraded: true }] }, act: [], expect: stat("110063", "hitPoints", 10) },

  // 12050 Eye of the Beast A:2: "Eye of the Beast cannot attack."
  { line: "12050:A:2", name: "cannot attack", layout: { engaged: ["12050"] }, act: [], expect: flag("12050", "cannotAttack") },

  // 12051 Thrashing Arm A:2: "At the end of the combat phase, if Thrashing Arm is engaged with you, deal 3 damage to a character you control." Its timing at the end of the phase is in card-lines-ship.test.ts.
  { line: "12051:A:2", name: "deals 3 damage to the character its engaged player chooses as the combat phase ends", layout: { phase: "Combat", engaged: ["12051"] }, act: [resolve("12051", "forced"), answer("dh2")], expect: [damageOn("dh2", 3), damageOn("dh1", 0)] },

  // 12053 Grasping Arm A:2: "When Grasping Arm attacks, the engaged player must exhaust a character he controls." A:3: "If this attack is undefended, resolve Grasping Arm's Grapple keyword."
  { line: "12053:A:2", name: "its engaged player exhausts the character he chooses when it attacks", layout: {}, act: [attack("12053", { undefended: true }), answer("dh2")], expect: exhausted("dh2") },
  { line: "12053:A:3", name: "an undefended attack grapples it with the location in the staging area", layout: { staging: ["12045"] }, act: attack("f0", { shadow: "12053", undefended: true }), expect: zone("12053", "grappled") },

  // 12054 Giant Arm A:3: "After this attack, either put Giant Arm into play engaged with you and deal it a shadow card, or resolve its Grapple keyword."
  { line: "12054:A:3", name: "after the attack the defending player may put it into play engaged with him", layout: { staging: ["12045"] }, act: [attack("f0", { shadow: "12054" }), defend("dh1"), answer("engage")], expect: zone("12054", "engaged") },

  // 12055 From the Depths A:1: "Discard the top 3 cards of the encounter deck. Resolve the Grapple keyword on each enemy discarded by this effect."
  { line: "12055:A:1", name: "the 3 cards below it are discarded and the enemies with Grapple among them grapple", layout: { staging: ["12045"], deck: ["12051", "f0", "12054", "f3"] }, act: reveal("12055"), expect: [zone("12051", "grappled"), zone("12054", "grappled"), zone("f0", "encounterDiscard"), zone("f3", "encounterDeck")] },

  // 11196 Sea Serpent A:2: "X is the number of players in the game." (Threat X, Defense X.) B:2: "X is twice the number of players in the game."
  { line: "11196:A:2", name: "has Threat and Defense 2 with 2 players on its Menacing side", layout: { seats: 2, staging: ["11196"] }, act: [], expect: [stat("11196", "threat", 2), stat("11196", "defense", 2)] },
  { line: "11196:B:2", name: "has Threat and Defense 4 with 2 players on its Enraged side", layout: { seats: 2, staging: [{ code: "11196", upgraded: true }] }, act: [], expect: [stat("11196", "threat", 4), stat("11196", "defense", 4)] },
  // A:3: "After Sea Serpent attacks and destroys an ally, the defending player deals X damage divided among characters they control." B:3 the same, X twice the players.
  { line: "11196:A:3", name: "after it destroys a defending ally the defending player deals 1 damage with 1 player", layout: { play: ["ally"] }, act: [attack("11196"), defend("ally"), answer("dh2")], expect: [zone("ally", "discard"), damageOn("dh2", 1)] },
  { line: "11196:B:3", name: "after it destroys a defending ally on its Enraged side the defending player deals 2 damage with 1 player", layout: { play: ["ally"], engaged: [{ code: "11196", seat: 0, upgraded: true }] }, act: [attack("11196"), defend("ally"), answer("dh2"), answer("dh2")], expect: [zone("ally", "discard"), damageOn("dh2", 2)] },
];

if (ROWS.length > 0) cardSpecs("the-thing-in-the-depths", ROWS);
else describe("the-thing-in-the-depths card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
