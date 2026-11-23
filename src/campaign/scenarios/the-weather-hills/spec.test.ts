// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.orc-deck, mec108.setup-the-weather-hills, mec108.campaign-setup-the-weather-hills, mec108.campaign-mode, faq.enemy-attacks-outside-combat, faq.side-quest-current-quest-text, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.travel, rr.blank, rr.destroy, rr.first-player, rr.campaign-pool, ltp.permanent (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, defend, endPhase, flag, handCount, notWon, progressOn, quest, resolve, resourcesOn, reveal, stat, threat, travel, zone, exhausted, lost, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Weather Hills (angmar-awakened part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (a damaged hero, a tally across rounds, a card field) is a
// test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side.
const CORNERED = "09025";
const AMON = "09026";
const HILLTOP = "09027";
const RIDGE = "09028";
const VALLEY = "09029";
const CAMP = "09030";
const ICE = "09031";
const FIND = "09032";
const ORC = "09043";
const MARAUDER = "09044";
const AMBUSH = "09046";
const BITING = "09052";
const FREEZING = "09053";
const COLD = "09054";
const MAKE = "09055";
const RUINS = "09056";
const CAUSEWAY = "09057";
const TRAGIC = "09058";
const SEARCH = "09059";
const STAGE1 = "09069";
const STAGE2 = "09070";
const HUNT = "09071";
const SAVAGE = "09072";
const OMENS = "10160";
const PROTECT = "10158";
const BOONS = ["10161", "10162", "10163", "10164", "10165"];
const DAMAGED_ALLY = { code: "ally", damage: 1 };

const ROWS: readonly Row[] = [
  { line: "09025:A:1", name: "Forced when it engages a player: it makes an immediate attack", layout: { engaged: [{ code: CORNERED, seat: 0 }] }, act: [announce("engaged", CORNERED), endPhase], expect: damageOn("dh1", 2) },
  { line: "09025:A:2", name: "Shadow: +1 Attack (2 + 1 + ... over an undefended hero's 1 here: the filler enemy's Attack 1 becomes 2)", layout: {}, act: attack("f3", { shadow: CORNERED, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "09026:A:2", name: "while it is the active location an Orc enemy added to the staging area attacks the first player", layout: { active: AMON, staging: [MARAUDER] }, act: [announce("addedToStaging", MARAUDER), endPhase], expect: attackersOf("dh1", [MARAUDER]) },
  { line: "09026:A:2", name: "and an Orc enemy returned to the staging area does too", layout: { active: AMON, staging: [MARAUDER] }, act: [announce("returnedToStaging", MARAUDER), endPhase], expect: attackersOf("dh1", [MARAUDER]) },
  { line: "09026:A:3", name: "the players cannot win the game while it is in play: a full stage 2B is not defeated", layout: { stage: STAGE2, progress: 20, active: AMON }, act: quest("success"), expect: [progressOn(STAGE2, 20), notWon] },

  { line: "09027:A:1", name: "+1 Threat for each resource token on it", layout: { staging: [{ code: HILLTOP, resources: 2 }] }, act: [], expect: stat(HILLTOP, "threat", 3) },
  { line: "09027:A:2", name: "Forced after a Weather treachery is revealed from the encounter deck: a resource token goes on it", layout: { staging: [HILLTOP], deck: ["f0"] }, act: reveal(FREEZING), expect: resourcesOn(HILLTOP, 1) },

  { line: "09028:A:1", name: "while it is the active location, at the end of the refresh phase each player deals 1 damage to a character he controls", layout: { phase: "Refresh", active: RIDGE }, act: [announce("endOfPhase"), answer("dh2")], expect: damageOn("dh2", 1) },
  { line: "09028:A:2", name: "Shadow: +1 Attack for each damaged character the defending player controls", layout: { play: [DAMAGED_ALLY, { code: "ally", damage: 1 }] }, act: attack("f3", { shadow: RIDGE, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "09029:A:1", name: "while it is the active location, when it is explored 1 character is healed of all its damage", layout: { active: VALLEY, play: [{ code: "ally", damage: 1 }] }, act: resolve(VALLEY, "response"), expect: damageOn("ally", 0) },
  { line: "09029:A:2", name: "Travel: remove 1 resource token from the Mission objective", layout: { phase: "Travel", staging: [VALLEY, { code: HUNT, resources: 2 }] }, act: travel(VALLEY), expect: [zone(VALLEY, "activeLocation"), resourcesOn(HUNT, 1)] },

  { line: "09030:A:1", name: "while it is the active location, when it is explored 1 resource token goes on the Mission objective", layout: { active: CAMP, staging: [HUNT] }, act: resolve(CAMP, "response"), expect: resourcesOn(HUNT, 1) },
  { line: "09030:A:2", name: "Travel: the first player puts an Orc enemy from the encounter deck into play engaged with him", layout: { phase: "Travel", staging: [CAMP], deck: ["f0", ORC] }, act: travel(CAMP), expect: [zone(ORC, "engaged"), zone(CAMP, "activeLocation")] },

  { line: "09031:A:1", name: "When Revealed: each player assigns 1 damage (1 quest card in play), then every damaged character is exhausted", layout: { deck: ["f0"] }, act: [reveal(ICE), answer("dh1")], expect: [damageOn("dh1", 1), exhausted("dh1"), exhausted("dh2", false)] },
  { line: "09031:A:1", name: "X is 2 with a side quest staged", layout: { staging: [MAKE], deck: ["f0"] }, act: [reveal(ICE), answer("dh1"), answer("dh1")], expect: damageOn("dh1", 2) },
  { line: "09031:A:2", name: "Shadow: the defending player assigns X damage among the characters he controls", layout: {}, act: [attack("f3", { shadow: ICE, undefended: true }), answer("dh2")], expect: [damageOn("dh2", 1), damageOn("dh1", 1)] },

  { line: "09032:A:1", name: "Time 4: four time counters on it when it is revealed", layout: {}, act: reveal(FIND), expect: resourcesOn(FIND, 4) },
  { line: "09032:A:2", name: "Forced after the last time counter is removed: each player deals 4 damage to a hero, then 4 time counters are placed on it", layout: { staging: [{ code: FIND, resources: 0 }] }, act: [announce("lastTimeCounterRemoved", FIND), answer("dh1")], expect: [damageOn("dh1", 4), resourcesOn(FIND, 4)] },

  { line: "09052:A:1", name: "When Revealed: the first player assigns X damage among the committed characters, X the number committed", layout: { committed: ["dh1", "dh2"], deck: ["f0"] }, act: [reveal(BITING), answer("dh1"), answer("dh1")], expect: [damageOn("dh1", 2), damageOn("dh2", 0)] },
  { line: "09052:A:2", name: "Shadow: 1 damage to the defending character", layout: {}, act: attack(MARAUDER, { shadow: BITING }), expect: damageOn("dh1", 2) },

  { line: "09053:A:3", name: "Shadow: +1 Attack for each damaged character the defending player controls", layout: { play: [DAMAGED_ALLY] }, act: attack("f3", { shadow: FREEZING, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "09054:A:1", name: "When Revealed: each player deals 1 damage to a hero, and while it is attached the damaged character's text is blank but keywords stay", layout: { deck: ["f0"] }, act: [reveal(COLD), answer("dh1")], expect: [damageOn("dh1", 1), flag("dh1", "blankText"), flag("dh1", "keepsKeywords"), flag("dh2", "blankText", false)] },

  { line: "09055:A:2", name: "characters cannot be healed while it is in the staging area", layout: { staging: [MAKE] }, act: [], expect: flag("dh1", "cannotBeHealed") },

  { line: "09056:A:1", name: "in the staging area, after the When Revealed effect of a treachery is canceled each player raises his threat by 2", layout: { staging: [RUINS, ICE] }, act: announce("whenRevealedCanceled", ICE), expect: threat(30) },
  { line: "09056:A:1", name: "and it does as the active location", layout: { active: RUINS, staging: [ICE] }, act: announce("whenRevealedCanceled", ICE), expect: threat(30) },
  { line: "09056:A:2", name: "Shadow: +1 Attack, and if the attack destroys a character the defending player raises his threat by 2", layout: { play: ["ally"] }, act: [attack(MARAUDER, { shadow: RUINS }), defend("ally")], expect: [zone("ally", "discard"), threat(31)] },

  { line: "09057:A:1", name: "Forced when it is explored: each player raises his threat by 2", layout: { active: CAUSEWAY }, act: announce("activeExplored", CAUSEWAY), expect: threat(30) },

  { line: "09058:A:1", name: "When Revealed: each player raises his threat by the Threat of the active location", layout: { active: RIDGE }, act: reveal(TRAGIC), expect: threat(31) },
  { line: "09058:A:2", name: "Shadow: the defending player raises his threat by 3", layout: {}, act: [attack("f3", { shadow: TRAGIC }), answer("threat")], expect: threat(31) },
  { line: "09058:A:2", name: "or the attack is considered undefended", layout: {}, act: [attack("f3", { shadow: TRAGIC }), answer("undefended")], expect: [threat(28), damageOn("dh1", 1)] },

  { line: "09059:A:2", name: "Forced at the end of the refresh phase: each player raises his threat by 2", layout: { phase: "Refresh", staging: [SEARCH] }, act: resolve(SEARCH, "forced"), expect: threat(30) },
  { line: "09059:A:3", name: "Response after it is defeated: each player reduces his threat by 3", layout: { staging: [SEARCH] }, act: resolve(SEARCH, "response"), expect: threat(25) },

  { line: "09069:B:1", name: "the first Weather treachery revealed each round gains surge", layout: { stage: STAGE1, deck: ["f0"] }, act: reveal(FREEZING), expect: zone("f0", "staging") },
  { line: "09069:B:2", name: "after the active location is explored the top card of the Orc deck is revealed and added to the staging area", layout: { stage: STAGE1, active: RIDGE, piles: { angmarOrcDeck: [MARAUDER] } }, act: quest("success"), expect: zone(MARAUDER, "staging") },

  { line: "09070:A:1", name: "When Revealed: Orc Ambush and Amon Forn are revealed and added to the staging area, the discard pile and the Orc deck go into the encounter deck", layout: { stage: STAGE2, setAside: [AMBUSH, AMON], discard: ["f0"], piles: { angmarOrcDeck: [MARAUDER] } }, act: [resolve(STAGE2, "whenRevealed")], expect: [zone(AMBUSH, "staging"), zone(AMON, "staging"), zone("f0", "encounterDeck")] },
  { line: "09070:B:1", name: "each damaged character gets -1 Willpower", layout: { stage: STAGE2, play: [DAMAGED_ALLY] }, act: [], expect: [stat("ally", "willpower", 0), stat("dh1", "willpower", 2)] },
  { line: "09070:B:2", name: "Forced at the beginning of the quest phase: the first player discards 1 resource token from Savage Counter-attack", layout: { stage: STAGE2, staging: [{ code: SAVAGE, resources: 2 }] }, act: [announce("beginningOfPhase"), answer("discard")], expect: resourcesOn(SAVAGE, 1) },

  { line: "09071:A:1", name: "Forced after an enemy is defeated: 1 resource token goes on it", layout: { stage: STAGE1, staging: [HUNT], engaged: [{ code: "f3", seat: 0 }] }, act: resolve(HUNT, "forced"), expect: resourcesOn(HUNT, 1) },
  { line: "09071:A:1", name: "and at 3 more tokens than there are players it is flipped to Savage Counter-attack, which advances the quest to stage 2A", layout: { stage: STAGE1, staging: [{ code: HUNT, resources: 3 }], engaged: [{ code: "f3", seat: 0 }] }, act: resolve(HUNT, "forced"), expect: [zone(STAGE2, "questStage"), resourcesOn(SAVAGE, 4)] },

  { line: "09072:A:1", name: "After it enters play the quest advances to stage 2A", layout: { stage: STAGE1, staging: [SAVAGE] }, act: announce("enteredPlay", SAVAGE), expect: zone(STAGE2, "questStage") },
  { line: "09072:A:2", name: "after an enemy attacks and destroys a character 1 resource token is discarded from it", layout: { stage: STAGE2, play: ["ally"], staging: [{ code: SAVAGE, resources: 3 }] }, act: [attack(MARAUDER), defend("ally")], expect: [zone("ally", "discard"), resourcesOn(SAVAGE, 2)] },
  { line: "09072:A:3", name: "with no resource token on it the players lose the game", layout: { stage: STAGE2, staging: [{ code: SAVAGE, resources: 0 }] }, act: [announce("beginningOfPhase")], expect: lost },

  { line: "10159:A:2", name: "Setup: Mysterious Omens joins the encounter deck and Protect the Innocent is added to the staging area", layout: { campaign: true }, act: resolve("10159", "campaignSetup"), expect: [zone(OMENS, "encounterDeck"), zone(PROTECT, "staging")] },

  { line: "10160:A:2", name: "Forced after it becomes the current quest: each player discards 1 card at random from his hand", layout: { staging: [OMENS], hand: ["filler", "filler"] }, act: announce("becameCurrentQuest", OMENS), expect: handCount(1) },
  { line: "10160:A:3", name: "when it is defeated the first player may choose a boon and attach it to a hero", layout: { staging: [OMENS], setAside: BOONS }, act: [announce("questDefeated", OMENS), answer("10163"), answer("dh1")], expect: zone("10163", "play") },

  { line: "10161:A:2", name: "Setup: attached to a hero, who gets 2 resources", layout: {}, act: [resolve("10161", "setup"), answer("dh1")], expect: resourcesOn("dh1", 2) },
  { line: "10161:A:3", name: "Action: attached hero gets +2 Willpower, Attack and Defense until the end of the phase", layout: { attached: [{ code: "10161", to: "dh1" }] }, act: resolve("10161", "action"), expect: [stat("dh1", "willpower", 4), stat("dh1", "attack", 4), stat("dh1", "defense", 4)] },
  { line: "10162:A:3", name: "attached hero gets +2 hit points", layout: { attached: [{ code: "10162", to: "dh1" }] }, act: [], expect: [stat("dh1", "hitPoints", 8), stat("dh2", "hitPoints", 6)] },
  // The Setup of each boon (Hardy, Resolute, Ruthless, Stalwart): "Setup: Attach to a hero." The first player chooses the second hero, so the boon's own +X is read on that hero only.
  { line: "10162:A:2", name: "Setup: Hardy is attached to the hero chosen, who gets its +2 hit points", layout: {}, act: [resolve("10162", "setup"), answer("dh2")], expect: [zone("10162", "attached"), stat("dh2", "hitPoints", 8), stat("dh1", "hitPoints", 6)] },
  { line: "10163:A:2", name: "Setup: Resolute is attached to the hero chosen, who gets its +1 Willpower", layout: {}, act: [resolve("10163", "setup"), answer("dh2")], expect: [zone("10163", "attached"), stat("dh2", "willpower", 3), stat("dh1", "willpower", 2)] },
  { line: "10163:A:3", name: "attached hero gets +1 Willpower, and the other hero does not", layout: { attached: [{ code: "10163", to: "dh1" }] }, act: [], expect: [stat("dh1", "willpower", 3), stat("dh2", "willpower", 2)] },
  { line: "10164:A:2", name: "Setup: Ruthless is attached to the hero chosen, who gets its +1 Attack", layout: {}, act: [resolve("10164", "setup"), answer("dh2")], expect: [zone("10164", "attached"), stat("dh2", "attack", 3), stat("dh1", "attack", 2)] },
  { line: "10164:A:3", name: "attached hero gets +1 Attack, and the other hero does not", layout: { attached: [{ code: "10164", to: "dh1" }] }, act: [], expect: [stat("dh1", "attack", 3), stat("dh2", "attack", 2)] },
  { line: "10165:A:2", name: "Setup: Stalwart is attached to the hero chosen, who gets its +1 Defense", layout: {}, act: [resolve("10165", "setup"), answer("dh2")], expect: [zone("10165", "attached"), stat("dh2", "defense", 3), stat("dh1", "defense", 2)] },
  { line: "10165:A:3", name: "attached hero gets +1 Defense, and the other hero does not", layout: { attached: [{ code: "10165", to: "dh1" }] }, act: [], expect: [stat("dh1", "defense", 3), stat("dh2", "defense", 2)] },
];

if (ROWS.length > 0) cardSpecs("the-weather-hills", ROWS);
else describe("the-weather-hills card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
