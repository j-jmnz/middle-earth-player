// Rules: rr.cancel, rr.replacement-effects, rr.search, rr.first-player, rr.travel, rr.immune, rr.optional-engagement, rr.engagement-check, rr.active-location, rr.explored, dwd.immune-to-card-effects, dwd.last-player, dwd.cave-torch-the-long-dark, faq.lasting-effects (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attackersOf, cardSpecs, damageOn, deckCount, endPhase, endRound, exhausted, flag, handCount, offers, progressOn, quest, resolve, reveal, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Into the Pit (dwarrowdelf part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
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
];

if (ROWS.length > 0) cardSpecs("into-the-pit", ROWS);
else describe("into-the-pit card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
