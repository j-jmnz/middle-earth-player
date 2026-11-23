// Rules: rr.cancel, rr.replacement-effects, rr.search, rr.first-player, rr.travel, rr.immune, rr.optional-engagement, rr.engagement-check, rr.active-location, rr.explored, dwd.immune-to-card-effects, dwd.last-player, dwd.cave-torch-the-long-dark, faq.lasting-effects (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, deckCount, defend, endPhase, endRound, exhausted, flag, handCount, offers, progressOn, quest, resolve, reveal, revealedBy, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Into the Pit (dwarrowdelf part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
const ROWS: readonly Row[] = [
  { line: "03048:A:1", name: "East-gate keeps its progress when Cave In removes it from the quest and the active location", layout: { active: { code: "03016", progress: 3 }, progress: 2 }, act: reveal("03048"), expect: [progressOn("03016", 3), progressOn("03064", 0)] },
  { line: "03048:A:1", name: "and Cave In gains surge when East-gate and the quest hold no progress", layout: { active: "03016", deck: ["f0", "f0"] }, act: reveal("03048"), expect: [deckCount(1)] },
  { line: "03016:A:1", name: "Dreadful Gap cannot return East-gate to the staging area", layout: { active: "03016" }, act: reveal("03052"), expect: [zone("03016", "activeLocation"), zone("03052", "staging")] },
  { line: "03065:B:2", name: "an enemy revealed from the encounter deck is discarded instead of staying in the staging area", layout: { stage: "03065", deck: ["f0"] }, act: reveal("03060"), expect: [zone("03060", "encounterDiscard")] },
  { line: "03035:A:1", name: "Goblin Follower engages the last player first and is not discarded", layout: { stage: "03065", deck: ["f0"] }, act: reveal("03035"), expect: [zone("03035", "engaged")] },
  { line: "03065:B:1", name: "each player searches for an enemy and Patrol Leader is the choice while it is in the deck", layout: { stage: "03065", deck: ["03060", "03014"] }, act: resolve("03065", "whenRevealed"), expect: [zone("03014", "staging")] },
  { line: "03065:B:3", name: "with no enemy in play the stage advances at once", layout: { stage: "03065" }, act: endRound, expect: [zone("03066", "questStage")] },
  { line: "03053:A:1", name: "a player who discards a random card from his hand does not give Fouled Well surge", layout: { hand: ["f0"], deck: ["f0", "f0"] }, act: [reveal("03053"), answer("discard")], expect: [handCount(0), deckCount(2)] },
  { line: "03053:A:1", name: "a player who does not discard gives it surge", layout: { hand: ["f0"], deck: ["f0", "f0"] }, act: [reveal("03053"), answer("keep")], expect: [handCount(1), deckCount(1)] },
  { line: "03040:A:1", name: "each enemy and location in the staging area gets +1 Threat, +3 for a Dark location", layout: { staging: ["03038", "03060"] }, act: reveal("03040"), expect: [stat("03038", "threat", 8), stat("03060", "threat", 4)] },
  { line: "03040:A:1", name: "a Cave Torch exhausted cancels the whole effect", layout: { staging: ["03038", "03060"], attached: [{ code: "03041", to: "dh1" }], deck: ["f0"] }, act: [reveal("03040"), answer("exhaust")], expect: [exhausted("03041"), stat("03038", "threat", 5), stat("03060", "threat", 3)] },
  { line: "03018:A:1", name: "while it is the active location no player plays a card from his hand", layout: { active: "03018", hand: ["attachment"], phase: "Planning" }, act: [], expect: [offers("PlayCard", "attachment", false)] },
  { line: "901002:A:1", name: "the first player finds Patrol Sentry, Patrol Leader and one more Orc for a solo game", layout: { stage: "901002", deck: ["03014", "901003", "901004", "901005"] }, act: resolve("901002", "whenRevealed"), expect: [zone("901003", "staging"), zone("03014", "staging")] },
  { line: "901002:B:1", name: "its quest points are 1 plus the number of players", layout: { stage: "901002", seats: 2 }, act: [], expect: [stat("901002", "questPoints", 3)] },
  { line: "901002:B:2", name: "Forced: an enemy destroyed places 1 progress on the stage", layout: { stage: "901002", progress: 0, staging: ["03060"] }, act: announce("enemyDestroyed", "03060"), expect: [progressOn("901002", 1)] },
  { line: "901001:A:2", name: "each exhaust of the Cave Torch puts a damage token on the setup card", layout: { staging: ["03038"], attached: [{ code: "03041", to: "dh1" }], deck: ["f0"], nightmare: "901001" }, act: announce("exhausted", "03041"), expect: [damageOn("901001", 1)] },
  { line: "901001:A:2", name: "and the 5th removes the Torch from the game", layout: { staging: ["03038"], attached: [{ code: "03041", to: "dh1" }], deck: ["f0"], nightmare: { code: "901001", damage: 4 } }, act: announce("exhausted", "03041"), expect: [zone("03041", "removed")] },
  { line: "901003:A:1", name: "Forced: after a Cave Torch exhausts a Patrol Sentry engaged with a player makes an immediate attack against him", layout: { engaged: ["901003"], attached: [{ code: "03041", to: "dh1" }], deck: ["f0", "f0"] }, act: [announce("exhausted", "03041"), endPhase], expect: [attackersOf("dh1", ["901003"])] },
  { line: "901005:A:2", name: "Shadow Dweller makes no engagement check while a Cave Torch is in play", layout: { staging: ["901005"], attached: [{ code: "03041", to: "dh1" }] }, act: [], expect: [flag("901005", "noEngagementChecks")] },
  { line: "901007:A:3", name: "no progress can be placed on Narrow Fissure while a Cave Torch is ready", layout: { staging: ["901007"], attached: [{ code: "03041", to: "dh1" }] }, act: [], expect: [flag("901007", "noProgressPlaced")] },
  { line: "901006:A:1", name: "its quest points are the Dark locations in play", layout: { staging: ["901006", "03038"], active: "03036" }, act: [], expect: [stat("901006", "questPoints", 3)] },
  { line: "901008:A:2", name: "it attaches to a non-Dark location, which gains the Dark trait and 3 quest points", layout: { staging: ["03017"], deck: ["f0"] }, act: reveal("901008"), expect: [stat("03017", "questPoints", 5)] },
  { line: "901004:A:2", name: "with a Dark active location Goblin Lurker gets +3 Attack and -40 engagement cost", layout: { staging: ["901004"], active: "03036" }, act: [], expect: [stat("901004", "attack", 5), stat("901004", "engagementCost", 10)] },
  { line: "03016:A:1", name: "East-gate is immune to card effects", layout: { active: "03016" }, act: [], expect: [flag("03016", "immuneToCardEffects")] },
  { line: "03016:A:3", name: "Forced: after East-gate is explored First Hall joins the staging area", layout: { active: { code: "03016", progress: 6 }, setAside: ["03017"], progress: 0 }, act: [quest("success")], expect: [zone("03017", "staging")] },
  { line: "03060:A:1", name: "a player at 25 threat cannot optionally engage Goblin Scout", layout: { staging: ["03060"] }, act: [], expect: [flag("03060", "optionalEngageThreat")] },
  { line: "03041:A:2", name: "Action: exhaust Cave Torch to place up to 3 progress on a Dark location", layout: { staging: ["03038"], attached: [{ code: "03041", to: "dh1" }], deck: ["f0"] }, act: [resolve("03041", "action"), answer("x3")], expect: [progressOn("03038", 3), exhausted("03041")] },
  { line: "03038:A:1", name: "Action: every player raises his threat by 1 to place 1 progress on Zigil Mineshaft", layout: { staging: ["03038"] }, act: resolve("03038", "action"), expect: [progressOn("03038", 1), threat(29)] },
  { line: "901008:A:2", name: "the location it is attached to is a Dark location for every Dark text (Branching Paths gives it +1 Threat)", layout: { staging: ["03036", "03017"], deck: ["f0"] }, act: reveal("901008"), expect: [stat("03017", "threat", 3)] },

  // Lines of the first pass of Finish: each record a row, the judge's fixes with theirs.
  { line: "03048:A:1", name: "East-gate's tokens do not count: with the quest card empty Cave In gains surge", layout: { active: { code: "03016", progress: 3 }, deck: ["f0", "f0"] }, act: reveal("03048"), expect: [progressOn("03016", 3), deckCount(1)] },
  { line: "03015:A:2", name: "Shadow: the defending player raises his threat by 2", layout: {}, act: attack("f3", { shadow: "03015" }), expect: threat(30) },
  { line: "03016:A:2", name: "no player can optionally engage an enemy while East-gate is in play", layout: { phase: "Encounter", staging: ["03061"], active: "03016" }, act: [], expect: [offers("Engage", undefined, false)] },
  { line: "03016:A:2", name: "and no engagement check is made for it", layout: { phase: "Encounter", staging: ["03061"], active: "03016" }, act: endPhase, expect: [zone("03061", "staging")] },
  { line: "03017:A:1", name: "Travel: each player raises his threat by 3", layout: { seats: 2, staging: ["03017"] }, act: resolve("03017", "travel"), expect: [threat(31, 0), threat(31, 1)] },
  { line: "03017:A:2", name: "Forced: after First Hall is explored Bridge of Khazad-dûm joins the staging area", layout: { active: { code: "03017", progress: 1 }, setAside: ["03018"], progress: 0 }, act: [quest("success")], expect: [zone("03018", "staging")] },
  { line: "03019:A:1", name: "Travel: the first player exhausts a character he controls", layout: { staging: ["03019"] }, act: [resolve("03019", "travel"), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false)] },
  { line: "03019:A:2", name: "Shadow: the defending player chooses and exhausts a character he controls", layout: { staging: ["03019"] }, act: [resolve("03019", "shadow"), answer("dh2")], expect: [exhausted("dh2"), exhausted("dh1", false)] },
  { line: "03035:A:2", name: "Shadow: +2 Attack when the attacked player is the last player (the only player of a solo game)", layout: {}, act: attack("f3", { shadow: "03035", undefended: true }), expect: [damageOn("dh1", 3)] },
  { line: "03035:A:2", name: "and +1 when he is not (the first player of two)", layout: { seats: 2 }, act: attack("f3", { shadow: "03035", undefended: true }), expect: [damageOn("dh1", 2)] },
  { line: "03036:A:1", name: "while Branching Paths is in the staging area each Dark location gets +1 Threat", layout: { staging: ["03036", "03038"] }, act: [], expect: [stat("03038", "threat", 6), stat("03036", "threat", 2)] },
  { line: "03036:A:2", name: "Forced: after it is explored the players look at 3 cards, reveal 1 and move the others to the bottom", layout: { active: { code: "03036", progress: 2 }, deck: ["f0", "f3", "place", "treachery"], progress: 0 }, act: [quest("success"), answer("f3")], expect: [revealedBy("f3", 0)] },
  { line: "03039:A:2", name: "When Revealed: the locations of the encounter discard pile go back into the deck", layout: { discard: ["place", "f0"], deck: ["f3"] }, act: resolve("03039", "whenRevealed"), expect: [zone("place", "encounterDeck"), zone("f0", "encounterDiscard")] },
  { line: "03041:A:3", name: "Forced: after the Torch exhausts the top card is discarded and an enemy joins the staging area", layout: { attached: [{ code: "03041", to: "dh1" }], deck: ["f3", "f0"] }, act: announce("exhausted", "03041"), expect: [zone("f3", "staging")] },
  { line: "03049:A:1", name: "each player exhausts a character and discards the top card of his deck", layout: { deckOf: ["c3"], deck: ["f0"] }, act: [reveal("03049"), answer("dh1")], expect: [exhausted("dh1"), zone("c3", "discard")] },
  { line: "03050:A:2", name: "Shadow: 1 damage to the defending character", layout: {}, act: [attack("f3", { shadow: "03050" }), defend("dh1")], expect: [damageOn("dh1", 1)] },
  { line: "03050:A:2", name: "and +2 Attack instead when the attack is undefended", layout: {}, act: attack("f3", { shadow: "03050", undefended: true }), expect: [damageOn("dh1", 3)] },
  { line: "03051:A:1", name: "the first player discards a questing character he controls", layout: { committed: ["dh1"], deck: ["f0"] }, act: reveal("03051"), expect: [zone("dh1", "discard")] },
  { line: "03051:A:2", name: "Shadow: the defending character is discarded from play", layout: {}, act: [attack("f3", { shadow: "03051" }), defend("dh1")], expect: [zone("dh1", "discard")] },
  { line: "03052:A:2", name: "X is the number of characters in play, every player's", layout: { seats: 2, play: ["ally"], staging: ["03052"] }, act: [], expect: [stat("03052", "questPoints", 4)] },
  { line: "03061:A:1", name: "+2 Attack when its attack is undefended", layout: {}, act: attack("03061", { undefended: true }), expect: [damageOn("dh1", 5)] },
  { line: "03061:A:2", name: "Shadow: Goblin Swordsman is added to the staging area", layout: {}, act: attack("f3", { shadow: "03061" }), expect: [zone("03061", "staging")] },
  { line: "03062:A:1", name: "When Revealed: the first player attaches it to one of his heroes", layout: { deck: ["f0"] }, act: reveal("03062"), expect: [zone("03062", "attached")] },
  { line: "03063:A:1", name: "while in the staging area Goblin Tunnels removes 1 progress when a Goblin is revealed", layout: { staging: ["03063"], progress: 2, deck: ["f0"] }, act: reveal("03060"), expect: [progressOn("03064", 1)] },
  { line: "03064:A:1", name: "Setup: the first player attaches Cave Torch to a hero", layout: { deck: ["f0"] }, act: [resolve("03064", "setup"), answer("dh2")], expect: [zone("03041", "play")] },
  { line: "03064:B:1", name: "When Revealed: each player reveals 1 encounter card", layout: { seats: 2, stage: "03064", deck: ["f0", "f3"] }, act: resolve("03064", "whenRevealed"), expect: [revealedBy("f0", 0), revealedBy("f3", 1)] },
  { line: "03064:B:2", name: "the stage cannot be advanced until Bridge of Khazad-dûm is in the victory display", layout: { progress: 6 }, act: quest("success"), expect: [zone("03064", "questStage")] },
  { line: "03066:B:1", name: "the heroes collect no resources in the resource phase", layout: { stage: "03066" }, act: [], expect: [flag("dh1", "noCollection")] },

  { line: "03040:A:1", name: "a card that arrives in the staging area later gets no Threat", layout: { staging: ["03060"], deck: ["f0"] }, act: [reveal("03040"), reveal("03038")], expect: [stat("03060", "threat", 4), stat("03038", "threat", 5)] },
  { line: "03040:A:1", name: "a location made Dark by Shadow-fall gets +3", layout: { staging: ["03017"], deck: ["f0", "f0"] }, act: [reveal("901008"), reveal("03040")], expect: [stat("03017", "threat", 5)] },
  { line: "03060:A:1", name: "a player at 25 threat or more cannot optionally engage it", layout: { phase: "Encounter", staging: ["03060"], threat: [40, 28] }, act: [], expect: [offers("Engage", undefined, false)] },
  { line: "901002:B:3", name: "a successful quest places no progress on Goblin Ambush", layout: { stage: "901002", progress: 0 }, act: quest("success"), expect: [progressOn("901002", 0)] },
  { line: "901002:A:1", name: "with two players the first player alone searches for Patrol Sentry, Patrol Leader and 1 more Orc", layout: { seats: 2, stage: "901002", deck: ["03060", "03014", "901003", "901004", "901005"] }, act: resolve("901002", "whenRevealed"), expect: [zone("901003", "staging"), zone("03014", "staging")] },
  // The audit's lines (each printed line read from data/printed): the Travel cost, the Shadows, the Nightmare constants. Dark locations: Branching Paths 03036, Zigil Mineshaft 03038; First Hall 03017 is not Dark.
  // 03037 Lightless Passage A:1: "Travel: Players must exhaust a Cave Torch to travel here."
  // The round runs on to its end, where the refresh readies the Torch: its own Forced (03041:A:3) shows it was exhausted, the top enemy of the encounter deck joining the staging area.
  { line: "03037:A:1", name: "the players exhaust the Cave Torch to travel here", layout: { phase: "Travel", staging: ["03037"], attached: [{ code: "03041", to: "dh1" }], deck: ["f3", "f0"] }, act: travel("03037"), expect: [zone("03037", "activeLocation"), zone("f3", "staging")] },
  { line: "03037:A:1", name: "with no Cave Torch in play the players cannot travel here", layout: { phase: "Travel", staging: ["03037"] }, act: [], expect: offers("Travel", undefined, false) },
  // 03040 Burning Low A:2: "Shadow: Attacking enemy gets +2 Attack." (f3 has 1 Attack.)
  { line: "03040:A:2", name: "Shadow: the attacking enemy gets +2 Attack", layout: {}, act: attack("f3", { shadow: "03040", undefended: true }), expect: damageOn("dh1", 3) },
  // 03063 Goblin Tunnels A:2: "Shadow: Attacking enemy gets +1 Attack. (+3 Attack instead if attacking enemy is a Goblin.)" Goblin Scout 03060 has 1 Attack.
  { line: "03063:A:2", name: "Shadow: a non-Goblin attacking enemy gets +1 Attack", layout: {}, act: attack("f3", { shadow: "03063", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "03063:A:2", name: "Shadow: a Goblin attacking enemy gets +3 Attack instead", layout: {}, act: attack("03060", { shadow: "03063", undefended: true }), expect: damageOn("dh1", 4) },
  // 901003 Patrol Sentry A:2: "Shadow: Add Patrol Sentry to the staging area."
  { line: "901003:A:2", name: "Shadow: Patrol Sentry is added to the staging area", layout: {}, act: attack("f3", { shadow: "901003" }), expect: zone("901003", "staging") },
  // 901004 Goblin Lurker A:1: "Cannot be optionally engaged." A:3: "Shadow: Attacking enemy gets +1 Attack. (+3 Attack instead if the active location is a Dark location.)"
  { line: "901004:A:1", name: "no player can optionally engage Goblin Lurker", layout: { phase: "Encounter", staging: ["901004"] }, act: [], expect: offers("Engage", undefined, false) },
  { line: "901004:A:3", name: "Shadow: the attacking enemy gets +1 Attack with no Dark active location", layout: { active: "03017" }, act: attack("f3", { shadow: "901004", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "901004:A:3", name: "Shadow: +3 Attack instead when the active location is Dark", layout: { active: "03036" }, act: attack("f3", { shadow: "901004", undefended: true }), expect: damageOn("dh1", 4) },
  // 901005 Shadow Dweller A:3: "Shadow: Shuffle Shadow Dweller back into the encounter deck."
  { line: "901005:A:3", name: "Shadow: Shadow Dweller is shuffled into the encounter deck, not discarded", layout: {}, act: attack("f3", { shadow: "901005" }), expect: zone("901005", "encounterDeck") },
  // 901006 Twisting Shadows A:2: "When Revealed: Remove all progress from each Dark location in play." A:3: "Shadow: Attacking enemy gets +1 Attack for each Dark location in play."
  { line: "901006:A:2", name: "all progress leaves the Dark active location; the quest and a non-Dark location keep theirs", layout: { active: { code: "03036", progress: 2 }, staging: [{ code: "03017", progress: 1 }], progress: 2, deck: ["f0"] }, act: reveal("901006"), expect: [progressOn("03036", 0), progressOn("03017", 1), progressOn("03064", 2)] },
  { line: "901006:A:3", name: "Shadow: +1 Attack for each Dark location in play, in the staging area and active", layout: { staging: ["03038"], active: "03036" }, act: attack("f3", { shadow: "901006", undefended: true }), expect: damageOn("dh1", 3) },
  // 901007 Narrow Fissure A:2: "Each Dark location in play gets +2 quest points." It is a Hazard, not Dark (1 quest point).
  { line: "901007:A:2", name: "the Dark active location gets +2 quest points, Narrow Fissure does not", layout: { staging: ["901007"], active: "03036" }, act: [], expect: [stat("03036", "questPoints", 5), stat("901007", "questPoints", 1)] },
  // 901008 Shadow-fall A:3: "Shadow: Attacking enemy gets +3 Defense this phase." The end of the phase is in card-lines.test.ts.
  { line: "901008:A:3", name: "Shadow: the attacking enemy has +3 Defense after the attack, in the same phase", layout: {}, act: [attack("f3", { shadow: "901008" }), defend("dh1")], expect: stat("f3", "defense", 4) },
];

if (ROWS.length > 0) cardSpecs("into-the-pit", ROWS);
else describe("into-the-pit card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
