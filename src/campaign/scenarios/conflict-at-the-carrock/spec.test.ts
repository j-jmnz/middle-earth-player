// Rules: rr.active-location, rr.attachment-cards, rr.first-player, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.search (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, damageOn, deckCount, defend, endPhase, exhausted, flag, quest, resolve, respond, reveal, stat, threat, travel, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Conflict at the Carrock (shadows-of-mirkwood part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish).
const ROWS: readonly Row[] = [
  { line: "900502:A:2", name: "Shadow: against a Troll the defending character does not ready this round", layout: { engaged: ["02038"] }, act: [attack("02038", { shadow: "900502" }), defend("dh1")], expect: [flag("dh1", "cannotReady")] },
  { line: "900504:A:1", name: "after Nightmare Louis attacks the defending player raises threat by 3", layout: { engaged: ["900504"] }, act: attack("900504", { undefended: true }), expect: [threat(31)] },
  { line: "900505:A:1", name: "Nightmare Morris is immune to player events", layout: { engaged: ["900505"] }, act: resolve("900505", "constant"), expect: [flag("900505", "immuneToPlayerEvents")] },
  { line: "900505:A:2", name: "while Nightmare Morris is in the victory display each Troll is immune to player events", layout: { engaged: ["02038"], victory: ["900505"] }, act: resolve("900505", "constant"), expect: [flag("02038", "immuneToPlayerEvents")] },
  { line: "900506:A:1", name: "Nightmare Rupert's Defense cannot be reduced", layout: { engaged: ["900506"] }, act: resolve("900506", "constant"), expect: [flag("900506", "cannotReduceDefense")] },
  { line: "900507:A:2", name: "while Nightmare Stuart is in the victory display each Troll cannot have player attachments", layout: { engaged: ["02038"], victory: ["900507"] }, act: resolve("900507", "constant"), expect: [flag("02038", "noPlayerAttachments")] },
  { line: "900508:A:2", name: "Shadow: against a Troll 4 damage tokens come off the attacker", layout: { engaged: [{ code: "02038", damage: 6 }] }, act: attack("02038", { shadow: "900508" }), expect: [damageOn("02038", 2)] },
  { line: "02035:A:1", name: "Setup shuffles one of the set-aside Sacked! for each player into the encounter deck", layout: { seats: 2, setAside: ["02048", "02048", "02048", "02048"], deck: ["f0"] }, act: resolve("02035", "setup"), expect: [deckCount(3)] },
  { line: "02036:B:1", name: "stage 2B puts the four unique Trolls set aside into the staging area", layout: { stage: "02036", setAside: ["02038", "02039", "02040", "02041"] }, act: resolve("02036", "whenRevealed"), expect: [zone("02038", "staging"), zone("02039", "staging"), zone("02040", "staging"), zone("02041", "staging")] },
  { line: "02038:A:1", name: "a Troll engaged with another player attacks: its defending player raises threat by 3 too", layout: { seats: 2, engaged: ["02038", { code: "02039", seat: 1 }] }, act: attack("02039", { undefended: true }), expect: [threat(31, 1)] },
  { line: "02042:A:2", name: "Shadow: the defending character gets -1 Defense for the attack", layout: { engaged: ["02038"] }, act: [attack("02038", { shadow: "02042" }), defend("dh1")], expect: [damageOn("dh1", 3)] },
  { line: "02048:A:1", name: "When Revealed: attaches to a hero the first player chooses and bars it from attacking", layout: { deck: ["f0"] }, act: [reveal("02048"), answer("dh1")], expect: [zone("02048", "attached"), flag("dh1", "cannotAttack"), flag("dh1", "cannotQuest")] },
  { line: "02035:B:1", name: "the 7th progress makes The Carrock the active location", layout: { stage: "02035", progress: 6, staging: ["02043"] }, act: quest("success"), expect: [zone("02043", "activeLocation")] },
  { line: "02038:A:1", name: "while Louis is engaged, a Troll's attack raises the threat by 3", layout: { engaged: ["02038"] }, act: attack("02038", { undefended: true }), expect: [threat(31)] },
  { line: "02042:A:1", name: "a hero Muck Adder damages is discarded from play", layout: { engaged: ["02042"] }, act: attack("02042", { undefended: true }), expect: [zone("dh1", "discard")] },
  { line: "02049:A:1", name: "Roasted Slowly destroys a hero with a Sacked! attached and shuffles itself back", layout: { attached: [{ code: "02048", to: "dh1" }], deck: ["f0"] }, act: reveal("02049"), expect: [zone("dh1", "discard"), zone("02049", "encounterDeck")] },
  { line: "02048:A:2", name: "as a shadow card against a Troll its When Revealed effect attaches it", layout: { engaged: ["02038"] }, act: [attack("02038", { shadow: "02048" }), answer("dh1")], expect: [zone("02048", "attached")] },
  { line: "02047:A:1", name: "each player raises his threat by the Threat in the staging area", layout: { staging: ["f3", "place"], deck: ["f0"] }, act: reveal("02047"), expect: [threat(33)] },
  { line: "02037:A:2", name: "with 8 resource tokens Grimbeorn joins the first player", layout: { staging: [{ code: "02037", resources: 8 }] }, act: resolve("02037", "constant"), expect: [zone("02037", "play")] },
  { line: "02044:A:1", name: "River Langflood gets +1 Threat for each Troll in play", layout: { staging: ["02044", "02039"], engaged: ["02038"] }, act: resolve("02044", "constant"), expect: [stat("02044", "threat", 6)] },
  { line: "02043:A:3", name: "while The Carrock is active, Trolls get +1 Attack", layout: { active: "02043", engaged: ["02038"] }, act: resolve("02043", "constant"), expect: [stat("02038", "attack", 5)] },
  { line: "02041:A:1", name: "after Rupert attacks every Sacked! in the discard pile returns to the deck", layout: { engaged: ["02041"], discard: ["02048", "02048"], deck: ["f0"] }, act: attack("02041", { undefended: true }), expect: [zone("02048", "encounterDeck")] },
  { line: "02045:A:1", name: "Bee Pastures fetches Grimbeorn into the staging area", layout: { staging: ["02045"], deck: ["f0", "02037"], phase: "Travel" }, act: [travel("02045"), respond("02045")], expect: [zone("02037", "staging")] },
  { line: "900503:A:1", name: "Rob and Bob engages the next player and attacks again", layout: { seats: 2, engaged: ["900503"], deck: ["f0", "f0", "f0", "f0"] }, act: [attack("900503", { undefended: true }), endPhase], expect: [damageOn("dh1", 5), damageOn("dh3", 5)] },
  { line: "02037:A:1", name: "Grimbeorn defending against a Troll does not exhaust", layout: { engaged: ["02038"], play: ["02037"] }, act: [attack("02038"), defend("02037")], expect: [exhausted("02037", false)] },
  { line: "02046:A:1", name: "while Oak-wood Grove is active every hero's pool counts as Leadership", layout: { active: "02046" }, act: resolve("02046", "constant"), expect: [flag("dh1", "paysAsLeadership")] },
  { line: "900504:A:2", name: "while Louis is in the victory display each Troll raises the defending player's threat by 1 after it attacks", layout: { engaged: ["900502"], victory: ["900504"] }, act: attack("900502", { undefended: true }), expect: [threat(29)] },
  { line: "900506:A:2", name: "while Rupert is in the victory display the Defense of each Troll cannot be reduced", layout: { engaged: ["900502"], victory: ["900506"] }, act: resolve("900506", "constant"), expect: [flag("900502", "cannotReduceDefense")] },
  { line: "900509:A:1", name: "progress placed on Hives and Hives deals 1 damage to each character in play", layout: { active: "900509", staging: ["f3"] }, act: quest("success"), expect: [damageOn("dh1", 1), damageOn("dh2", 1)] },
  { line: "900511:B:1", name: "defeating Rob and Bob wins the game", layout: { stage: "900511", engaged: ["900503"] }, act: announce("enemyDestroyed", "900503"), expect: [won] },
  { line: "02049:A:2", name: "Shadow: against a Troll 2 damage tokens come off the attacker", layout: { engaged: [{ code: "02038", damage: 4 }] }, act: attack("02038", { shadow: "02049" }), expect: [damageOn("02038", 2)] },

  // 900509:A:2 "Shadow: Attacking enemy gets +2 Attack." f0 (1 Attack) undefended deals 3.
  { line: "900509:A:2", name: "Shadow: the attacking enemy gets +2 Attack", layout: {}, act: attack("f0", { shadow: "900509", undefended: true }), expect: damageOn("dh1", 3) },
];

if (ROWS.length > 0) cardSpecs("conflict-at-the-carrock", ROWS);
else describe("conflict-at-the-carrock card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
