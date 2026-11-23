// Rules: dwd.ambush, rr.engagement-check, rr.engaged, rr.reveal, rr.search, rr.guarded, rr.explored (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, defend, endPhase, exhausted, flag, lost, progressOn, resolve, resourcesOn, respond, reveal, stagingThreat, stat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

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
  // 04038 Along the Misty Mountains: Setup puts Arwen into play under the first player's control and each player reveals a card.
  { line: "04038:A:1", name: "Setup puts Arwen into play and each player reveals a card", layout: { stage: "04038", side: "A", setAside: ["04041"], deck: ["f0", "f0"] }, act: resolve("04038", "setup"), expect: [zone("04041", "play"), zone("f0", "staging")] },

  // 04040 Approaching Rivendell: B:1 reveals a card for each player (Up the Pass); B:2 no healing.
  { line: "04040:B:1", name: "each player reveals 1 card into the staging area", layout: { stage: "04040", seats: 2, deck: ["f0", "f3", "f0"] }, act: resolve("04040", "whenRevealed"), expect: [zone("f0", "staging"), zone("f3", "staging"), deckCount(1)] },
  { line: "04040:B:2", name: "no character can be healed while it is the current stage", layout: { stage: "04040", side: "B" }, act: [], expect: [flag("dh1", "cannotBeHealed"), flag("dh2", "cannotBeHealed")] },

  // 04041 Arwen Undómiel: the Redhorn Gate Arwen's lines.
  { line: "04041:A:2", name: "after she exhausts a hero gets 1 resource", layout: { play: ["04041"], deck: ["f0"] }, act: [resolve("04041", "response"), answer("dh1")], expect: resourcesOn("dh1", 1) },
  { line: "04041:A:3", name: "the players lose when she leaves play", layout: { play: ["04041"] }, act: announce("leftPlay", "04041"), expect: lost },

  // 04042 Ruined Road, 04045 Barren Hills, 04047 Followed by Night, 04051 Crebain: the attacker returns to the staging area after it attacks, an enemy with ambush that was in play making no check for it (it was never out of play).
  { line: "04042:A:1", name: "after the players travel here, the first player chooses 2 progress on it", layout: { phase: "Travel", staging: ["04042"] }, act: [travel("04042"), respond("04042"), answer("progress")], expect: progressOn("04042", 2) },
  { line: "04042:A:2", name: "the attacker returns to the staging area after it attacks, an ambush enemy making no check for the return", layout: { engaged: ["04049"], threat: [40, 0] }, act: [attack("04049", { shadow: "04042" }), defend("dh1")], expect: zone("04049", "staging") },
  { line: "04045:A:2", name: "the attacker returns to the staging area after it attacks", layout: {}, act: [attack("f0", { shadow: "04045" }), defend("dh1")], expect: zone("f0", "staging") },
  { line: "04047:A:2", name: "the attacker returns to the staging area after it attacks", layout: {}, act: [attack("f0", { shadow: "04047" }), defend("dh1")], expect: zone("f0", "staging") },
  { line: "04051:A:3", name: "the attacker returns to the staging area after it attacks", layout: {}, act: [attack("f0", { shadow: "04051" }), defend("dh1")], expect: zone("f0", "staging") },
  { line: "04047:A:1", name: "the first player may choose 1 damage to each ally in play and surge", layout: { play: ["ally"], deck: ["f0", "f0"] }, act: [reveal("04047"), answer("damage")], expect: [damageOn("ally", 1), zone("f0", "staging")] },

  // 04044 Pathless Country's Shadow: 1 damage to each ally in play.
  { line: "04044:A:2", name: "its Shadow deals 1 damage to each ally in play", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "04044" }), defend("dh1")], expect: damageOn("ally", 1) },

  // 04051 Crebain: no encounter card effect can be canceled while it is in the staging area.
  // 04052 Wild Bear: it makes an immediate attack after it engages a player.
  { line: "04052:A:2", name: "Forced when it engages a player: it makes an immediate attack", layout: { engaged: [{ code: "04052", seat: 0 }] }, act: [announce("engaged", "04052"), endPhase], expect: damageOn("dh1", 2) },

  // 04048 Orc Ambush: the Orcs returned from the discard pile make their ambush checks.
  { line: "04048:A:2", name: "an Orc returned from the discard pile makes its ambush check and engages the first player when it can", layout: { discard: ["04049"], deck: ["f0"], threat: [40, 0] }, act: reveal("04048"), expect: zone("04049", "engaged") },

  // 901403 Uruk Elf-stalker: Arwen takes 1 damage when it destroys a character.
  { line: "901403:A:2", name: "Arwen takes 1 damage when it attacks and destroys a character", layout: { play: ["04041", "ally"], engaged: ["901403"] }, act: [attack("901403"), defend("ally")], expect: [zone("ally", "discard"), damageOn("04041", 1)] },

  // 901404 Goblin Trapper: the engaged player exhausts a ready character; its Shadow adds it to the staging area.
  { line: "901404:A:2", name: "the engaged player exhausts a ready character he controls", layout: { engaged: ["901404"] }, act: [announce("engaged", "901404"), answer("dh1")], expect: exhausted("dh1") },
  { line: "901404:A:3", name: "its Shadow adds it to the staging area", layout: {}, act: [attack("f0", { shadow: "901404" }), defend("dh1")], expect: zone("901404", "staging") },

  // 901408 Concealed Woods: the round's first ambush enemy revealed gains surge; its Shadow gives +2 Attack against the first player.
  { line: "901408:A:1", name: "the first enemy with ambush revealed gains surge", layout: { active: "901408", deck: ["f0", "f0"], threat: [0, 0] }, act: reveal("04049"), expect: zone("f0", "staging") },
  { line: "901408:A:2", name: "its Shadow gives +2 Attack when the attacker is engaged with the first player", layout: {}, act: attack("f0", { shadow: "901408", undefended: true }), expect: damageOn("dh1", 3) },

  // 901409 Tumultuous Assault returns only the enemies with ambush.
  { line: "901409:A:1", name: "an engaged enemy without ambush stays engaged", layout: { engaged: ["04049", "04051"], deck: ["f0"], threat: [0, 0] }, act: reveal("901409"), expect: [zone("04049", "staging"), zone("04051", "engaged")] },
  // 901407 Treacherous Bluffs' Shadow: the excess damage of the attack goes to Arwen.
  { line: "901407:A:2", name: "its Shadow sends the excess damage of the attack to Arwen", layout: { play: ["04041", { code: "ally", damage: 1 }], engaged: ["04050"] }, act: [attack("04050", { shadow: "901407" }), defend("ally")], expect: damageOn("04041", 1) },

  // 901402 Ambush in the Night: A:1 finds Goblin Gate and reveals the enemies it discards for each player.
  { line: "901402:A:1", name: "Goblin Gate is added to the staging area and an enemy discarded from the shuffled deck is revealed", layout: { stage: "901402", side: "A", deck: ["04043", "04049"], threat: [0, 0] }, act: resolve("901402", "whenRevealed"), expect: [zone("04043", "staging"), zone("04049", "staging")] },

  // 901403:A:3 "Shadow: Attacking enemy gets +2 Attack." f0 (1 Attack) undefended deals 3.
  { line: "901403:A:3", name: "Shadow: the attacking enemy gets +2 Attack", layout: {}, act: attack("f0", { shadow: "901403", undefended: true }), expect: damageOn("dh1", 3) },
];

if (ROWS.length > 0) cardSpecs("road-to-rivendell", ROWS);
else describe("road-to-rivendell card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));

