// Rules: mec108.thaurdir, mec108.indestructible, mec108.battle, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.engagement-check, rr.destroy, faq.additional-attacks, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, damageOn, deckCount, endPhase, flag, handCount, reveal, resolve, stat, threat, won, zone, attackersOf, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Battle of Carn Dûm (angmar-awakened part 8): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish). What a row cannot express (a count over several steps, a state built from shadow cards, a choice by several seats, a pool entry)
// is a test titled with its line id in lines.test.ts, rulings.test.ts and boons.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side; the filler enemy f3 has 1 Attack and an engagement cost of 50.
const STAGE1 = "10125";
const STAGE2 = "10126";
const CAPTAIN = "10127";
const CHAMPION = "10128";
const GARRISON = "10129";
const GRUNTS = "10130";
const BATTLEFIELD = "10132";
const MOUNTAINS = "10133";
const BLIGHT = "10134";
const WALLS = "10135";
const SKY = "10136";
const AFFLICTION = "10137";
const DAECHANAR = "10138";
const SORCERY = "09065";
const DECK = ["f0", "f0", "f0", "f0", "f0", "f0"];

const ROWS: readonly Row[] = [
  { line: "10125:B:1", name: "Thaurdir cannot leave the staging area or take damage while stage 1B is in play", layout: { stage: STAGE1, staging: [CAPTAIN] }, act: [], expect: [flag(CAPTAIN, "cannotLeaveStaging"), flag(CAPTAIN, "cannotTakeDamage")] },
  { line: "10125:B:1", name: "at the end of the round Champion side faceup Thaurdir flips to Captain", layout: { stage: STAGE1, staging: [CHAMPION], deck: DECK }, act: announce("endOfRound", undefined, { phase: "End of round" }), expect: zone(CAPTAIN, "staging") },

  { line: "10126:A:1", name: "When Revealed: Captain side faceup Thaurdir flips to Champion", layout: { stage: STAGE2, staging: [CAPTAIN] }, act: resolve(STAGE2, "whenRevealed"), expect: zone(CHAMPION, "staging") },
  { line: "10126:B:1", name: "at the end of the round Captain side faceup Thaurdir flips to Champion", layout: { stage: STAGE2, staging: [CAPTAIN] }, act: announce("endOfRound", undefined, { phase: "End of round" }), expect: zone(CHAMPION, "staging") },
  { line: "10126:B:3", name: "if Thaurdir is defeated the players win the game", layout: { stage: STAGE2, staging: [CHAMPION] }, act: announce("enemyDestroyed", CHAMPION), expect: won },

  { line: "10127:A:3", name: "each other enemy gets +10 engagement cost", layout: { stage: STAGE1, staging: [CAPTAIN, GARRISON, GRUNTS] }, act: [], expect: [stat(GARRISON, "engagementCost", 50), stat(GRUNTS, "engagementCost", 18), stat(CAPTAIN, "engagementCost", 50)] },
  { line: "10128:A:3", name: "each other enemy gets -10 engagement cost, to 0 at the least", layout: { stage: STAGE2, staging: [CHAMPION, GARRISON, GRUNTS] }, act: [], expect: [stat(GARRISON, "engagementCost", 30), stat(GRUNTS, "engagementCost", 0), stat(CHAMPION, "engagementCost", 50)] },
  { line: "10127:A:4", name: "Forced after a Sorcery treachery is revealed from the encounter deck: 1 shadow card is dealt to each enemy in play", layout: { stage: STAGE1, staging: [CAPTAIN], deck: DECK }, act: reveal(SORCERY), expect: deckCount(DECK.length - 1) },
  { line: "10128:A:4", name: "Forced after a Sorcery treachery is revealed from the encounter deck: Thaurdir heals 3 damage and attacks the first player at once", layout: { stage: STAGE2, staging: [{ code: CHAMPION, damage: 5 }], deck: DECK }, act: [reveal(SORCERY), endPhase], expect: [damageOn(CHAMPION, 2), attackersOf("dh1", [CHAMPION])] },

  { line: "10129:A:2", name: "Shadow: the attacking enemy gets +1 Attack for each shadow card dealt to it, this card included", layout: {}, act: attack("f3", { shadow: GARRISON, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "10130:A:3", name: "Shadow: Orc Grunts is added to the staging area", layout: {}, act: attack("f3", { shadow: GRUNTS, undefended: true }), expect: zone(GRUNTS, "staging") },

  { line: "10132:A:2", name: "Shadow: +1 Attack, +3 instead when the defending player's threat is higher than the attacking enemy's engagement cost", layout: { threat: [51, 28] }, act: attack("f3", { shadow: BATTLEFIELD, undefended: true }), expect: damageOn("dh1", 4) },
  { line: "10132:A:2", name: "Shadow: only +1 Attack when the defending player's threat is not higher than the engagement cost", layout: {}, act: attack("f3", { shadow: BATTLEFIELD, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "10133:A:2", name: "Shadow: raise the defending player's threat by 2", layout: {}, act: attack("f3", { shadow: MOUNTAINS, undefended: true }), expect: threat(30) },
  { line: "10134:A:3", name: "Shadow: if the attacking enemy is Thaurdir, heal 3 damage from him", layout: { engaged: [{ code: CHAMPION, damage: 5 }] }, act: attack(CHAMPION, { shadow: BLIGHT, undefended: true }), expect: damageOn(CHAMPION, 2) },
  { line: "10135:A:2", name: "Shadow: with a threat of 40 or higher the attacking enemy makes an additional attack", layout: { threat: [40, 28] }, act: attack("f3", { shadow: WALLS, undefended: true }), expect: attackersOf("dh1", ["f3", "f3"]) },
  { line: "10136:A:2", name: "Shadow: discard a random card from the defending player's hand", layout: { hand: ["filler", "filler"] }, act: attack("f3", { shadow: SKY, undefended: true }), expect: handCount(1) },
  { line: "10137:A:2", name: "Shadow: +1 Attack", layout: {}, act: attack("f3", { shadow: AFFLICTION, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "10138:A:1", name: "When Revealed: flip Thaurdir; Champion side faceup he becomes Captain and this card gains surge", layout: { stage: STAGE1, staging: [CHAMPION, DAECHANAR], deck: DECK }, act: reveal(DAECHANAR), expect: [zone(CAPTAIN, "staging"), zone("f0", "staging")] },
  { line: "10138:A:1", name: "When Revealed: Captain side faceup Thaurdir becomes Champion and this card gains no surge", layout: { stage: STAGE2, staging: [CAPTAIN], deck: DECK }, act: reveal(DAECHANAR), expect: [zone(CHAMPION, "staging"), deckCount(DECK.length - 2)] },
  { line: "10138:A:2", name: "Shadow: Thaurdir flips after this attack", layout: { stage: STAGE2, staging: [CAPTAIN] }, act: attack("f3", { shadow: DAECHANAR, undefended: true }), expect: zone(CHAMPION, "staging") },

];

if (ROWS.length > 0) cardSpecs("the-battle-of-carn-dum", ROWS);
else describe("the-battle-of-carn-dum card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
