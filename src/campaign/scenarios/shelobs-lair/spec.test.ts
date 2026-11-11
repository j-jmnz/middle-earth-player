// Rules: mec112.setup-shelobs-lair, mec112.saga-staging-rules, rr.shadow-effects, rr.step-6-4-2, rr.damage, rr.attachment-cards, rr.victory (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, endPhase, exhausted, flag, handCount, resolve, resourcesOn, reveal, stagingThreat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Shelob's Lair (the-two-towers part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish).
const ROWS: readonly Row[] = [
  // The behaviours the engine half's new vocabulary rests on; the Finish task writes the rest of the rows.
  { line: "144047:A:2", name: "Shadow: the attacking enemy is dealt 2 additional shadow cards, which resolve in this attack", layout: { deck: ["144055", "144055"] }, act: attack("f0", { shadow: "144047", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "144045:A:2", name: "while it is in the victory display Shelob loses Indestructible and is engaged with the first player", layout: { victory: ["144045"], staging: ["144040"] }, act: [], expect: [flag("144040", "losesKeywords"), flag("144040", "engagedWithFirst")] },
  { line: "144072:B:2", name: "while Shelob has a resource she holds the damage shield", layout: { stage: "144072", staging: [{ code: "144040", resources: 1 }] }, act: [], expect: flag("144040", "resourceCancel") },
  { line: "144040:A:3", name: "Forced at the beginning of the quest phase: the first player may place 1 resource on Shelob", layout: { staging: ["144040"] }, act: [announce("beginningOfPhase", "144040"), answer("place")], expect: resourcesOn("144040", 1) },
  { line: "144043:A:2", name: "explored: a Morgul Wraith is searched from the discard pile into the staging area, then the first player exhausts The One Ring", layout: { staging: ["144043"], discard: ["144053"], play: ["144063"] }, act: announce("leftPlay", "144043", { explored: true }), expect: [zone("144053", "staging"), exhausted("144063")] },
  { line: "144043:A:2", name: "or each player discards 1 random card, the choice following when no Wraith is found", layout: { seats: 2, staging: ["144043"], play: ["144063"], hand: ["filler", "filler"] }, act: [announce("leftPlay", "144043", { explored: true }), answer("discard")], expect: [handCount(1, 0), handCount(1, 1)] },
  { line: "144044:A:3", name: "explored: each player exhausts a character they control or discards 1 random card", layout: { seats: 2, staging: ["144044"], hand: ["filler", "filler"] }, act: [announce("leftPlay", "144044", { explored: true }), answer("exhaust"), answer("dh1"), answer("discard")], expect: [handCount(1, 1)] },
  { line: "144046:A:1", name: "explored: 1 resource is removed from Shelob", layout: { staging: ["144046", { code: "144040", resources: 2 }] }, act: announce("leftPlay", "144046", { explored: true }), expect: resourcesOn("144040", 1) },
  { line: "144049:A:1", name: "while in the staging area, after a When Revealed effect is canceled 1 resource is placed on Shelob", layout: { staging: ["144049", "144040"] }, act: announce("whenRevealedCanceled"), expect: resourcesOn("144040", 1) },
  { line: "144050:A:1", name: "When Revealed: each player discards 1 random card and 1 non-objective attachment they control", layout: { seats: 2, hand: ["filler", "filler"], attached: [{ code: "attachment", to: "dh1" }] }, act: reveal("144050"), expect: [handCount(1, 0), handCount(1, 1), zone("attachment", "discard")] },
  { line: "144051:A:1", name: "When Revealed: each location in the staging area gets +1 Threat until the end of the round", layout: { staging: ["144043", "144047"] }, act: reveal("144051"), expect: stagingThreat(8) },
  { line: "144052:A:3", name: "Forced at the end of the planning phase: the first player may raise each player's threat by 1", layout: { seats: 2, phase: "Planning", attached: [{ code: "144052", to: "dh1" }] }, act: [announce("endOfPhase"), answer("threat")], expect: [threat(29, 0), threat(29, 1)] },
  { line: "144059:A:1", name: "When Revealed: it becomes the active location, the old one returning to the staging area", layout: { active: "144043" }, act: reveal("144059"), expect: [zone("144059", "activeLocation"), zone("144043", "staging")] },
  { line: "144070:B:3", name: "Forced at the end of the quest phase: with the Secret Way in the victory display the quest advances", layout: { victory: ["144044"] }, act: endPhase, expect: zone("144071", "questStage") },
  { line: "144072:A:1", name: "When Revealed: Cleft joins the staging area, Sméagol flips to Gollum, Shelob is healed and each player places 1 resource on her", layout: { stage: "144072", seats: 2, setAside: ["144045"], play: ["144076"], staging: [{ code: "144040", damage: 3 }] }, act: resolve("144072", "whenRevealed"), expect: [zone("144045", "staging"), zone("144075", "engaged"), damageOn("144040", 0), resourcesOn("144040", 2)] },
];

if (ROWS.length > 0) cardSpecs("shelobs-lair", ROWS);
else describe("shelobs-lair card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
