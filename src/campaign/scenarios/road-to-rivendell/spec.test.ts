// Rules: dwd.ambush, rr.engagement-check, rr.engaged, rr.reveal, rr.search, rr.guarded, rr.explored (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, defend, exhausted, flag, progressOn, resolve, reveal, stagingThreat, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Road to Rivendell (dwarrowdelf part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). Build wrote the rows for the mechanics it added (Ambush's checks, Goblin Gate's gained ambush, Barren Hills,
// Orc Ambush, Goblin Gate's live quest points); Finish writes the rest. The stand-in heroes dh1 and dh2 have 2 Willpower, 2 Attack, 2 Defense; the first player's threat is the layout's first number.
const ROWS: readonly Row[] = [
  // 04043 Goblin Gate: while it is the active location the round's first enemy revealed from the deck gains ambush, so Crebain (cost 35, no ambush of its own) engages a first player with threat 40.
  { line: "04043:A:1", name: "the first enemy revealed gains ambush and engages the first player", layout: { active: "04043", deck: ["f0"], threat: [40, 0] }, act: reveal("04051"), expect: [zone("04051", "engaged"), flag("04051", "gainsAmbush")] },

  // 04045 Barren Hills: while active the ambush keyword has no effect.
  { line: "04045:A:1", name: "an enemy with ambush is not checked and stays in the staging area", layout: { active: "04045", threat: [40, 0] }, act: reveal("04049"), expect: zone("04049", "staging") },

  // 04048 Orc Ambush: every Orc in the staging area engages the first player; with none there the Orcs of the discard pile return to the staging area.
  { line: "04048:A:2", name: "each Orc enemy in the staging area engages the first player, whatever its engagement cost", layout: { staging: ["04049", "04050"], deck: ["f0"], threat: [0, 0] }, act: reveal("04048"), expect: [zone("04049", "engaged"), zone("04050", "engaged")] },
  { line: "04048:A:2", name: "with no Orc in the staging area every Orc enemy in the discard pile returns to it", layout: { discard: ["04049", "04050"], deck: ["f0"], threat: [0, 0] }, act: reveal("04048"), expect: [zone("04049", "staging"), zone("04050", "staging")] },

  // 04046 Sleeping Sentry: every ready character exhausts.
  { line: "04046:A:1", name: "every ready character is exhausted", layout: { deck: ["f0"] }, act: reveal("04046"), expect: [exhausted("dh1"), exhausted("dh2")] },

  // 04039 Orc Outpost: Goblin Gate is searched for and added to the staging area without being revealed, the deck is not shuffled, and it becomes the active location when there is none.
  { line: "04039:B:1", name: "Goblin Gate is found in the encounter deck and becomes the active location when there is none", layout: { stage: "04039", side: "B", deck: ["f0", "04043"] }, act: resolve("04039", "whenRevealed"), expect: zone("04043", "activeLocation") },
  { line: "04039:B:1", name: "Goblin Gate is found in the discard pile and stays in the staging area when a location is active", layout: { stage: "04039", side: "B", active: "place", discard: ["04043"], deck: ["f0"] }, act: resolve("04039", "whenRevealed"), expect: [zone("04043", "staging"), zone("place", "activeLocation")] },
  { line: "04039:B:1", name: "a Goblin Gate already in the staging area becomes the active location when there is none", layout: { stage: "04039", side: "B", staging: ["04043"], deck: ["f0"] }, act: resolve("04039", "whenRevealed"), expect: zone("04043", "activeLocation") },

  // 04044 Pathless Country: each placement of progress removes 1 progress token from it.
  { line: "04044:A:1", name: "1 progress token is removed from it after progress is placed on it", layout: { active: { code: "04044", progress: 2 } }, act: announce("progressPlaced", "04044"), expect: progressOn("04044", 1) },

  // 04049 Goblin Taskmaster and 04050 Orc Raiders: the engaged player deals 2 damage to a character, or discards 2 attachments.
  { line: "04049:A:2", name: "the engaged player deals 2 damage to a character he controls", layout: { engaged: ["04049"] }, act: [announce("engaged", "04049"), answer("dh1")], expect: damageOn("dh1", 2) },
  { line: "04050:A:2", name: "the engaged player discards the attachments he controls", layout: { engaged: ["04050"], attached: [{ code: "attachment", to: "dh1" }] }, act: announce("engaged", "04050"), expect: zone("attachment", "discard") },

  // 04046 Sleeping Sentry's Shadow: the defending player discards each exhausted character he controls, the defender (exhausted to defend) included.
  { line: "04046:A:2", name: "its Shadow discards the exhausted defender", layout: {}, act: [attack("f0", { shadow: "04046" }), defend("dh1")], expect: zone("dh1", "discard") },

  // 901401 the setup card: an enemy with ambush that engages a player in the quest phase contributes its Threat to the staging area while it stays engaged.
  { line: "901401:A:2", name: "an ambush enemy that engages a player during the quest phase adds its Threat to the staging area's total", layout: { nightmare: "901401", threat: [40, 0] }, act: reveal("04049"), expect: stagingThreat(2) },

  // 901405 Raiding Party: each player discards the top card of the encounter deck and an enemy with ambush that way makes a check against that player alone.
  { line: "901405:A:2", name: "an ambush enemy the engaged player discards from the deck engages him from the discard pile", layout: { engaged: ["901405"], deck: ["04049", "f0"], threat: [40, 0] }, act: announce("engaged", "901405"), expect: zone("04049", "engaged") },

  // 901406 Vicious Trackers: the engaged player counts 20 more Threat in an engagement check.
  { line: "901406:A:2", name: "the engaged player's ambush check counts 20 more Threat", layout: { engaged: ["901406"], threat: [10, 0], deck: ["f0"] }, act: reveal("04049"), expect: zone("04049", "engaged") },

  // 901407 Treacherous Bluffs: +2 Threat when an enemy with ambush engages a player.
  { line: "901407:A:1", name: "it gets +2 Threat until the end of the phase when an ambush enemy engages a player", layout: { staging: ["901407"], threat: [40, 0] }, act: reveal("04049"), expect: stat("901407", "threat", 3) },

  // 901409 Tumultuous Assault: each engaged enemy with ambush returns to the staging area, then the players make engagement checks against each enemy there.
  { line: "901409:A:1", name: "an engaged ambush enemy returns to the staging area when no player can engage it", layout: { engaged: ["04049"], deck: ["f0"], threat: [0, 0] }, act: reveal("901409"), expect: zone("04049", "staging") },

  // 901402 Ambush in the Night: Goblin Gate's quest points grow by 1 for each enemy engaged with a player.
  { line: "901402:B:2", name: "Goblin Gate gets 1 more quest point for each enemy engaged with a player", layout: { stage: "901402", side: "B", active: "04043", engaged: ["04049", "04050"] }, act: announce("engaged", "04049"), expect: stat("04043", "questPoints", 6) },
  { line: "901402:B:2", name: "a Goblin Gate whose progress equals its quest points once an engaged enemy leaves is explored at once", layout: { stage: "901402", side: "B", active: { code: "04043", progress: 4 }, engaged: ["04049"], deck: ["f0"], threat: [0, 0] }, act: reveal("901409"), expect: zone("04043", "encounterDiscard") },
];

if (ROWS.length > 0) cardSpecs("road-to-rivendell", ROWS);
else describe("road-to-rivendell card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));

