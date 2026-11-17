// Rules: rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.damage, rr.attachment-cards, rr.first-player, rr.guarded, rr.search, rr.ranged, sotm.ally-objective-wilyador (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, damageOn, deckCount, defend, endPhase, endRound, exhausted, flag, lost, quest, resolve, respond, reveal, stat, won, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for A Journey to Rhosgobel (shadows-of-mirkwood part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). A constant resolved by itself (`resolve`) is applied twice (once by the action, once by the table), so a
// stat row reads a number off an unrelated announcement instead.
const ROWS: readonly Row[] = [
  { line: "02060:A:1", name: "Setup places 2 damage tokens on Wilyador", layout: { staging: ["02064"] }, act: resolve("02060", "setup"), expect: [damageOn("02064", 2)] },
  { line: "02061:B:1", name: "after the quest phase begins the first player places a damage token per player on Wilyador to reveal 1 of the top 3", layout: { stage: "02061", seats: 2, play: ["02064"], deck: ["f0", "f0", "f0", "f0"], phase: "Planning" }, act: [endPhase, respond("02061")], expect: [damageOn("02064", 2), deckCount(1)] },
  { line: "02062:B:1", name: "stage 3 heals 5 from Wilyador for each Athelas the players control, and wins when he is whole", layout: { stage: "02062", play: [{ code: "02064", damage: 10 }], attached: [{ code: "02063", to: "dh1" }, { code: "02063", to: "dh2" }] }, act: resolve("02062", "whenRevealed"), expect: [damageOn("02064", 0), won] },
  { line: "02062:B:2", name: "stage 3 loses the game when Wilyador is not completely healed", layout: { stage: "02062", play: [{ code: "02064", damage: 8 }], attached: [{ code: "02063", to: "dh1" }] }, act: resolve("02062", "whenRevealed"), expect: [damageOn("02064", 3), lost] },
  { line: "02062:B:2", name: "stage 3 wins the game when Wilyador has no damage and no Athelas is controlled", layout: { stage: "02062", play: ["02064"] }, act: resolve("02062", "whenRevealed"), expect: [won] },
  { line: "02062:B:1", name: "stage 3 heals nothing while Rhosgobel is in the staging area, and the players lose", layout: { stage: "02062", staging: ["02065"], play: [{ code: "02064", damage: 8 }], attached: [{ code: "02063", to: "dh1" }] }, act: resolve("02062", "whenRevealed"), expect: [damageOn("02064", 8), lost] },
  { line: "02063:A:2", name: "Action: a hero exhausts to claim Athelas, which is attached to it", layout: { staging: ["02063"], phase: "Planning" }, act: respond("02063"), expect: [zone("02063", "attached"), exhausted("dh1")] },
  { line: "02064:A:1", name: "the first player gains control of Wilyador, who leaves the staging area", layout: { staging: ["02064"] }, act: resolve("02064", "constant"), expect: [zone("02064", "play")] },
  { line: "02064:A:2", name: "Forced: Wilyador suffers 2 damage at the end of the round", layout: { play: ["02064"] }, act: endRound, expect: [damageOn("02064", 2)] },
  { line: "02065:A:1", name: "Rhosgobel's Threat is the number of players", layout: { seats: 2, staging: ["02065"] }, act: announce("enteredPlay", "02065"), expect: [stat("02065", "threat", 2)] },
  { line: "02065:A:2", name: "while Rhosgobel is in the staging area Wilyador cannot be healed", layout: { staging: ["02065"], play: ["02064"] }, act: resolve("02065", "constant"), expect: [flag("02064", "cannotBeHealed")] },
  { line: "02066:A:1", name: "Response: after Forest Grove is explored an Athelas is added to the staging area", layout: { active: "02066", deck: ["f0", "02063"] }, act: [quest("success"), respond("02066")], expect: [zone("02063", "staging")] },
  { line: "02067:A:1", name: "When Revealed: 2 damage to each exhausted character", layout: { staging: ["02063"], deck: ["f0"], phase: "Planning" }, act: [respond("02063"), reveal("02067")], expect: [damageOn("dh1", 2), damageOn("dh2", 0)] },
  { line: "02067:A:2", name: "Shadow: 1 damage to each exhausted character, the defender included", layout: {}, act: [attack("f3", { shadow: "02067" }), defend("dh1")], expect: [damageOn("dh1", 1)] },
  { line: "02068:A:1", name: "When Revealed: 1 damage to each character without attachments, Wilyador too", layout: { play: ["02064"], deck: ["f0"] }, act: reveal("02068"), expect: [damageOn("02064", 1), damageOn("dh1", 1)] },
  { line: "02068:A:2", name: "Shadow: the character with the most damage takes 3 more", layout: { play: [{ code: "02064", damage: 5 }] }, act: attack("f3", { shadow: "02068", undefended: true }), expect: [damageOn("02064", 8)] },
  { line: "02069:A:1", name: "When Revealed: 2 damage to each wounded character", layout: { play: [{ code: "02064", damage: 3 }], deck: ["f0"] }, act: reveal("02069"), expect: [damageOn("02064", 5), damageOn("dh1", 0)] },
  { line: "02069:A:2", name: "Shadow: 2 damage to each wounded character when the attack is undefended", layout: { play: [{ code: "02064", damage: 3 }] }, act: attack("f3", { shadow: "02069", undefended: true }), expect: [damageOn("02064", 5)] },
  { line: "02069:A:2", name: "Shadow: 1 damage to each wounded character when the attack is defended", layout: { play: [{ code: "02064", damage: 3 }] }, act: [attack("f3", { shadow: "02069" }), defend("dh1")], expect: [damageOn("02064", 4)] },
  { line: "02070:A:2", name: "Shadow: the damage of an undefended attack goes on Wilyador", layout: { play: ["02064"] }, act: attack("02071", { shadow: "02070", undefended: true }), expect: [damageOn("02064", 1), damageOn("dh1", 0)] },
  { line: "02071:A:2", name: "Shadow: the damage of an undefended attack goes on Wilyador", layout: { play: ["02064"] }, act: attack("02070", { shadow: "02071", undefended: true }), expect: [damageOn("02064", 2), damageOn("dh1", 0)] },
  { line: "900601:A:2", name: "Setup: the Goblin Eagle-hunter is searched out and added to the staging area", layout: { deck: ["f0", "900602"] }, act: resolve("900601", "setup"), expect: [zone("900602", "staging")] },
  { line: "900602:A:1", name: "the Goblin Eagle-hunter gets +1 hit point per player", layout: { engaged: ["900602"] }, act: announce("enteredPlay", "900602"), expect: [stat("900602", "hitPoints", 5)] },
  { line: "900602:A:2", name: "Forced: at the end of the combat phase 1 damage to Wilyador (and 2 more at the end of the round)", layout: { staging: ["900602"], play: ["02064"], phase: "Combat" }, act: endPhase, expect: [damageOn("02064", 3)] },
  { line: "900602:A:3", name: "Shadow: with 10 damage on Wilyador, 2 damage to him", layout: { play: [{ code: "02064", damage: 10 }] }, act: attack("f3", { shadow: "900602", undefended: true }), expect: [damageOn("02064", 12)] },
  { line: "900603:A:1", name: "while Treetop Bird-eater is engaged with a player his characters cannot be healed", layout: { engaged: ["900603"], play: ["02064"] }, act: resolve("900603", "constant"), expect: [flag("dh1", "cannotBeHealed")] },
  { line: "900603:A:2", name: "Forced: at the beginning of the encounter phase Treetop Bird-eater engages the player who controls Wilyador", layout: { seats: 2, staging: ["900603"], play: [{ code: "02064", seat: 1 }], phase: "Travel" }, act: endPhase, expect: [zone("900603", "engaged")] },
  { line: "900604:A:1", name: "Dark-wood Grove gets +1 Threat and +1 quest point for each Athelas card in play", layout: { staging: ["900604", "02063"], attached: [{ code: "02063", to: "dh1" }] }, act: announce("enteredPlay", "900604"), expect: [stat("900604", "threat", 5), stat("900604", "questPoints", 6)] },
  { line: "900606:A:1", name: "while Pitch-dark Thicket is the active location every character loses ranged", layout: { active: "900606" }, act: resolve("900606", "constant"), expect: [flag("dh1", "loseRanged")] },
  { line: "900607:A:2", name: "When Revealed: it attaches to an Eagle character, who loses the Eagle trait", layout: { play: ["02064"], deck: ["f0", "f0", "f0"] }, act: reveal("900607"), expect: [zone("900607", "attached"), flag("02064", "losesEagle")] },
  { line: "900607:A:3", name: "Shadow: the When Revealed effect attaches it to an Eagle character", layout: { play: ["02064"] }, act: attack("f3", { shadow: "900607", undefended: true }), expect: [zone("900607", "attached")] },
  { line: "900608:A:2", name: "When Revealed: it attaches to Wilyador, whose heals it reduces", layout: { play: ["02064"], deck: ["f0", "f0", "f0"] }, act: reveal("900608"), expect: [zone("900608", "attached"), flag("02064", "healReducedToOne")] },
];

if (ROWS.length > 0) cardSpecs("a-journey-to-rhosgobel", ROWS);
else describe("a-journey-to-rhosgobel card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
