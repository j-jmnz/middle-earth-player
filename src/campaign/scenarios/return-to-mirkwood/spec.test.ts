// Rules: sotm.guarding-gollum, sotm.setup-return-to-mirkwood, rr.forced, rr.staging, rr.travel, rr.shadow-effects, rr.damage, rr.engagement, rr.active-location (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, damageOn, exhausted, reveal, resolve, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

const GOLLUM = "02130";
const guarded = { play: [{ code: GOLLUM, seat: 0 }] };

// Card specs for Return to Mirkwood (shadows-of-mirkwood part 6): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). The lines of the guard's own rules (loss, redirected damage, locks, the stage bars) are
// tests of lines.test.ts, guardian.test.ts and nightmare.test.ts, which build their moment with the scene kit.
const ROWS: readonly Row[] = [
  { line: "02126:A:1", name: "Setup: Gollum is found and put in front of the player who guards him", layout: { stage: "02126", setAside: [GOLLUM], deck: ["f0", "f0"] }, act: resolve("02126", "setup"), expect: [zone(GOLLUM, "play")] },
  { line: "02130:A:2", name: "Forced: at the end of each round the guard raises his threat by 3", layout: guarded, act: announce("endOfRound"), expect: [threat(31)] },
  { line: "02133:A:1", name: "Travel: the guard exhausts a hero he controls", layout: { ...guarded, staging: ["02133"] }, act: resolve("02133", "travel", "02133"), expect: [exhausted("dh1", true)] },
  { line: "02135:A:1", name: "When Revealed: the guard raises his threat by 8", layout: { ...guarded, deck: ["f0"] }, act: reveal("02135"), expect: [threat(36)] },
  { line: "02135:A:2", name: "Shadow: the guard raises his threat by 4", layout: guarded, act: attack("f3", { shadow: "02135", undefended: true, lands: { f3: GOLLUM } }), expect: [threat(32)] },
  { line: "02136:A:1", name: "When Revealed: 4 damage to a hero the guard controls", layout: { ...guarded, deck: ["f0"] }, act: reveal("02136"), expect: [damageOn("dh1", 4)] },
  { line: "02136:A:2", name: "Shadow: 2 damage to a hero the guard controls", layout: guarded, act: attack("f3", { shadow: "02136", undefended: true, lands: { f3: GOLLUM } }), expect: [damageOn("dh1", 2)] },
  { line: "02131:A:2", name: "Shadow: if undefended, The Spiders' Ring becomes the active location and the old one returns to the staging area", layout: { ...guarded, active: "place" }, act: attack("f3", { shadow: "02131", undefended: true, lands: { f3: GOLLUM } }), expect: [zone("02131", "activeLocation"), zone("place", "staging")] },
  { line: "02132:A:1", name: "While active: a treachery's When Revealed that targets the guard targets each other player too", layout: { ...guarded, seats: 2, active: "02132", deck: ["f0", "f0"], threat: [28, 30] }, act: reveal("02135"), expect: [threat(36, 0), threat(38, 1)] },
  { line: "02132:A:1", name: "While active: a treachery card's Shadow effect that targets the guard targets each other player too", layout: { ...guarded, seats: 2, active: "02132", threat: [28, 30] }, act: attack("f3", { shadow: "02135", undefended: true, lands: { f3: GOLLUM } }), expect: [threat(32, 0), threat(34, 1)] },
  { line: "900902:A:1", name: "A shadow card dealt to Ambushing Orcs that targets the guard targets each other player too", layout: { ...guarded, seats: 2, threat: [28, 30] }, act: attack("900902", { shadow: "02135", undefended: true, lands: { "900902": GOLLUM } }), expect: [threat(32, 0), threat(34, 1)] },
  { line: "02133:A:2", name: "Response: after it is explored each player not guarding Gollum reduces his threat by 2", layout: { ...guarded, seats: 2, active: "02133", threat: [30, 30] }, act: resolve("02133", "response", "02133"), expect: [threat(30, 0), threat(28, 1)] },
  { line: "02138:A:2", name: "Forced: after Mirkwood Bats engages a player, 1 damage to each character the guard controls, Gollum too", layout: { ...guarded, staging: ["02138"] }, act: announce("engaged", "02138"), expect: [damageOn("dh1", 1), damageOn(GOLLUM, 1)] },
];

if (ROWS.length > 0) cardSpecs("return-to-mirkwood", ROWS);
else describe("return-to-mirkwood card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
