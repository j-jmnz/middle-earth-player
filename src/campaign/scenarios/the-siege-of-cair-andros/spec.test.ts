// Rules: ats.cair-andros-location-damage, ats.cair-andros-remove-stage, rr.in-play-and-out-of-play, rr.shadow-effects, rr.lasting-effects, rr.cannot, rr.first-player, rr.step-3-3, rr.step-3-4, rr.removed-from-game, rr.cost, faq.additional-attacks, hon.archery (data/rules/entries.json). Lines that a row cannot show (the Setup, the keyword reminders, the stage 1 redirect and advance, the Responses, the quest totals, the sphere choices, the locks) are tests titled with their line id in lines.test.ts: 05033:A:1, 05033:A:2, 05034:A:1, 05034:A:2, 05035:A:1, 05035:A:2, 05056:A:2, 05057:A:2, 05058:A:1, 05061:A:2, 05072:A:1, 05072:B:1, 05072:B:2, 05074:B:1, 05075:B:1, 05076:B:1, 05076:B:3, 05076:B:4.
import { describe } from "vitest";

import {
  announce, attack, cardSpecs, damageOn, deckCount, answer, count, endPhase, revealedBy, quest, respond, resolve, threat, stagingThreat, stat, zone, type Row,
} from "../../../../test/harness/card-spec.ts";

// Card specs for The Siege of Cair Andros (against-the-shadow part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and are
// Tactics; the stand-in enemy f3 has 3 Threat and 1 Attack; every seat starts at threat 28. A row that is not about Stage 1 sits on stage 2 (05073), so no undefended damage is sent to a location. The three Battleground locations are
// The Citadel 05033 (Threat 3, removed at 11 damage), The Approach 05034 (2, at 7) and The Banks 05035 (1, at 3).
const CITADEL = "05033";
const APPROACH = "05034";
const BANKS = "05035";
const SCRAMBLERS = "05030";
const RAM = "05031";
const RAFT = "05032";
const ASSAULT = "05036";
const VANGUARD = "05058";
const WAR_CAMP = "05059";
const RABBLE = "05062";
const ARSONIST = "05063";
const SCOURGE = "05064";
const STAGE = "05073";
const DEFENSE = "05072";
const AT_APPROACH = "05074";
const AT_CITADEL = "05075";
const LIEUTENANT = "05056";
const LAST_BATTLE = "05076";
const MALICE = "05060";
const THREE = [CITADEL, APPROACH, BANKS];

const ROWS: readonly Row[] = [
  // The WR of 05030 hits the Battleground locations in the staging area and the active one (rr.in-play-and-out-of-play): all three start in the staging area.
  { line: "05030:A:2", name: "When Revealed: 1 damage to each Battleground location in play, the staging area and the active location", layout: { stage: STAGE, active: APPROACH, staging: [CITADEL, BANKS, WAR_CAMP] }, act: resolve(SCRAMBLERS, "whenRevealed"), expect: [damageOn(CITADEL, 1), damageOn(APPROACH, 1), damageOn(BANKS, 1), damageOn(WAR_CAMP, 0)] },
  { line: "05030:A:3", name: "Shadow: The Citadel in the staging area takes 2 damage, and the attacker gets no +2 Attack (the attack alone deals 1)", layout: { stage: STAGE, staging: [CITADEL] }, act: attack("f3", { shadow: SCRAMBLERS, undefended: true }), expect: [damageOn(CITADEL, 2), damageOn("dh1", 1)] },
  { line: "05030:A:3", name: "Shadow: The Citadel as the active location takes the 2 damage too", layout: { stage: STAGE, active: CITADEL }, act: attack("f3", { shadow: SCRAMBLERS, undefended: true }), expect: [damageOn(CITADEL, 2), damageOn("dh1", 1)] },
  { line: "05030:A:3", name: "Shadow: otherwise (no Citadel in play) the attacker gets +2 Attack (1 + 2)", layout: { stage: STAGE, staging: [APPROACH, BANKS] }, act: attack("f3", { shadow: SCRAMBLERS, undefended: true }), expect: [damageOn(APPROACH, 0), damageOn(BANKS, 0), damageOn("dh1", 3)] },
  { line: "05030:A:3", name: "Shadow: the Citadel at 10 damage is removed by the 2 damage, and the attacker still gets no +2 Attack (one check, when the shadow resolves)", layout: { stage: STAGE, staging: [{ code: CITADEL, damage: 10 }] }, act: attack("f3", { shadow: SCRAMBLERS, undefended: true }), expect: [zone(CITADEL, "removed"), damageOn("dh1", 1)] },

  { line: "05031:A:2", name: "When Revealed: the active location, a Battleground, takes 3 damage", layout: { stage: STAGE, active: CITADEL, staging: [APPROACH] }, act: resolve(RAM, "whenRevealed"), expect: [damageOn(CITADEL, 3), damageOn(APPROACH, 0)] },
  { line: "05031:A:3", name: "Shadow: The Approach in the staging area takes 2 damage, and the attacker gets no +2 Attack", layout: { stage: STAGE, staging: [APPROACH] }, act: attack("f3", { shadow: RAM, undefended: true }), expect: [damageOn(APPROACH, 2), damageOn("dh1", 1)] },
  { line: "05031:A:3", name: "Shadow: The Approach as the active location takes the 2 damage too", layout: { stage: STAGE, active: APPROACH }, act: attack("f3", { shadow: RAM, undefended: true }), expect: [damageOn(APPROACH, 2), damageOn("dh1", 1)] },
  { line: "05031:A:3", name: "Shadow: otherwise (no Approach in play) the attacker gets +2 Attack", layout: { stage: STAGE, staging: [CITADEL] }, act: attack("f3", { shadow: RAM, undefended: true }), expect: [damageOn(CITADEL, 0), damageOn("dh1", 3)] },
  { line: "05031:A:3", name: "Shadow: The Approach at 6 damage is removed by the 2 damage, and the attacker gets no +2 Attack", layout: { stage: STAGE, staging: [{ code: APPROACH, damage: 6 }] }, act: attack("f3", { shadow: RAM, undefended: true }), expect: [zone(APPROACH, "removed"), damageOn("dh1", 1)] },

  { line: "05032:A:1", name: "When Revealed: 2 damage to the lowest Threat Battleground location in play (The Banks 1, in the staging area)", layout: { stage: STAGE, staging: THREE }, act: resolve(RAFT, "whenRevealed"), expect: [damageOn(BANKS, 2), damageOn(APPROACH, 0), damageOn(CITADEL, 0)] },
  { line: "05032:A:1", name: "When Revealed: the lowest Threat one in play, when The Banks is gone and The Approach is the active location", layout: { stage: STAGE, active: APPROACH, staging: [CITADEL] }, act: resolve(RAFT, "whenRevealed"), expect: [damageOn(APPROACH, 2), damageOn(CITADEL, 0)] },
  { line: "05032:A:2", name: "Shadow: The Banks in the staging area takes 2 damage, and the attacker gets no +2 Attack", layout: { stage: STAGE, staging: [BANKS] }, act: attack("f3", { shadow: RAFT, undefended: true }), expect: [damageOn(BANKS, 2), damageOn("dh1", 1)] },
  { line: "05032:A:2", name: "Shadow: The Banks as the active location takes the 2 damage too", layout: { stage: STAGE, active: BANKS }, act: attack("f3", { shadow: RAFT, undefended: true }), expect: [damageOn(BANKS, 2), damageOn("dh1", 1)] },
  { line: "05032:A:2", name: "Shadow: otherwise (no Banks in play) the attacker gets +2 Attack", layout: { stage: STAGE, staging: [CITADEL, APPROACH] }, act: attack("f3", { shadow: RAFT, undefended: true }), expect: [damageOn(CITADEL, 0), damageOn("dh1", 3)] },
  { line: "05032:A:2", name: "Shadow: The Banks at 1 damage is removed by the 2 damage (3 in all), and the attacker gets no +2 Attack", layout: { stage: STAGE, staging: [{ code: BANKS, damage: 1 }] }, act: attack("f3", { shadow: RAFT, undefended: true }), expect: [zone(BANKS, "removed"), damageOn("dh1", 1)] },

  { line: "05036:A:1", name: "When Revealed: each hero gets -2 Attack and -2 Defense until the end of the round (still in force after the phase ends)", layout: { stage: STAGE }, act: [resolve(ASSAULT, "whenRevealed"), endPhase], expect: [stat("dh1", "attack", 0), stat("dh1", "defense", 0), stat("dh2", "attack", 0), stat("dh2", "defense", 0)] },
  { line: "05036:A:2", name: "Shadow: 2 damage to each Battleground location in play, staging or active, and no +2 Attack", layout: { stage: STAGE, active: { code: BANKS, damage: 1 }, staging: [CITADEL, APPROACH, WAR_CAMP] }, act: attack("f3", { shadow: ASSAULT, undefended: true }), expect: [zone(BANKS, "removed"), damageOn(CITADEL, 2), damageOn(APPROACH, 2), damageOn(WAR_CAMP, 0), damageOn("dh1", 1)] },


  // 05056 Lieutenant of Mordor: the topmost treachery of the encounter discard pile is the last one placed there.
  { line: "05056:A:2", name: "When Revealed: the When Revealed effect of the topmost treachery in the encounter discard pile resolves (Orc Assault, under an enemy), and the card stays there", layout: { stage: STAGE, discard: [ASSAULT, "f0"] }, act: resolve(LIEUTENANT, "whenRevealed"), expect: [stat("dh1", "attack", 0), zone(ASSAULT, "encounterDiscard")] },
  { line: "05056:A:2", name: "When Revealed: only the topmost treachery resolves, not the one below it (Scourge of Mordor below it does not discard a card or raise the Threat: 3 + 2 of the Lieutenant)", layout: { stage: STAGE, staging: ["f3"], deckOf: ["event"], discard: [SCOURGE, ASSAULT] }, act: resolve(LIEUTENANT, "whenRevealed"), expect: [stat("dh1", "attack", 0), stagingThreat(5)] },

  { line: "05058:A:2", name: "Shadow: the attacking enemy is dealt two additional shadow cards (the 3 other cards of the deck are down to 1)", layout: { stage: STAGE }, act: attack("f3", { shadow: VANGUARD, undefended: true }), expect: deckCount(1) },

  { line: "05059:A:2", name: "Shadow: +1 Attack for each shadow card dealt to the attacker, this one and 2 more (Vanguard's, then this card, then another)", layout: { stage: STAGE, deck: [WAR_CAMP, "f0"] }, act: attack("f3", { shadow: VANGUARD, undefended: true }), expect: damageOn("dh1", 4) },
  { line: "05059:A:2", name: "Shadow: a single shadow card gives +1 Attack (1 + 1)", layout: { stage: STAGE }, act: attack("f3", { shadow: WAR_CAMP, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "05062:A:1", name: "Forced: dealt a shadow card, Orc Rabble gets +2 Attack until the end of the phase (printed 1)", layout: { stage: STAGE, engaged: [RABBLE] }, act: announce("shadowDealtTo", RABBLE), expect: stat(RABBLE, "attack", 3) },
  { line: "05062:A:1", name: "Forced: dealt a shadow card again, it gets +2 Attack again (1 + 2 + 2)", layout: { stage: STAGE, engaged: [RABBLE] }, act: [announce("shadowDealtTo", RABBLE), announce("shadowDealtTo", RABBLE)], expect: stat(RABBLE, "attack", 5) },
  { line: "05062:A:2", name: "Shadow: one additional shadow card for each player (one player: the deck is down to 2)", layout: { stage: STAGE }, act: attack("f3", { shadow: RABBLE, undefended: true }), expect: deckCount(2) },
  { line: "05062:A:2", name: "Shadow: two players, two additional shadow cards (the deck is down to 1)", layout: { stage: STAGE, seats: 2 }, act: attack("f3", { shadow: RABBLE, undefended: true }), expect: deckCount(1) },

  { line: "05063:A:1", name: "Forced: when it engages a player, each enemy engaged with that player, itself included, is dealt 1 shadow card", layout: { stage: STAGE, engaged: ["f0", ARSONIST], deck: ["f0", "f0", "f0"] }, act: announce("engaged", ARSONIST), expect: deckCount(1) },
  { line: "05063:A:2", name: "Shadow: +1 Attack and another shadow card (1 + 1 damage, the deck is down to 2)", layout: { stage: STAGE }, act: attack("f3", { shadow: ARSONIST, undefended: true }), expect: [damageOn("dh1", 2), deckCount(2)] },

  { line: "05064:A:1", name: "When Revealed: each player discards the top card of his deck, and the staging Threat is raised by its printed cost (event 1) until the end of the phase", layout: { stage: STAGE, deckOf: ["event"], staging: ["f3"] }, act: resolve(SCOURGE, "whenRevealed"), expect: stagingThreat(4) },
  { line: "05064:A:1", name: "When Revealed: with two players the cost of both cards is added until the end of the phase (3 + 1 + 1)", layout: { stage: STAGE, seats: 2, deckOf: ["event", { code: "event", seat: 1 }], staging: ["f3"] }, act: resolve(SCOURGE, "whenRevealed"), expect: stagingThreat(5) },
  { line: "05064:A:2", name: "Shadow: +1 Attack and another shadow card (1 + 1 damage, the deck is down to 2)", layout: { stage: STAGE }, act: attack("f3", { shadow: SCOURGE, undefended: true }), expect: [damageOn("dh1", 2), deckCount(2)] },

  // The three Battleground locations (ats.cair-andros-remove-stage): exploring one sets its stage aside. Four progress from the quest ends its exploring (each location has its progress one short of its points).
  { line: "05033:A:2", name: "Response: after The Citadel is explored, stage 4 is removed from the quest deck", layout: { stage: AT_APPROACH, active: { code: CITADEL, progress: 10 }, staging: [APPROACH, BANKS] }, act: [quest("success"), respond(CITADEL)], expect: [zone(AT_CITADEL, "setAside"), zone(AT_APPROACH, "questStage")] },
  { line: "05034:A:2", name: "Response: after The Approach is explored, stage 3 is removed from the quest deck (here the current stage: the quest goes on to the next stage in the deck)", layout: { stage: AT_APPROACH, active: { code: APPROACH, progress: 6 }, staging: [BANKS] }, act: [quest("success"), respond(APPROACH)], expect: [zone(AT_APPROACH, "setAside"), zone(AT_CITADEL, "questStage")] },
  { line: "05035:A:2", name: "Response: after The Banks is explored, stage 2 is removed from the quest deck", layout: { stage: DEFENSE, active: { code: BANKS, progress: 2 }, staging: [CITADEL] }, act: [quest("success"), respond(BANKS)], expect: [zone(STAGE, "setAside"), zone(DEFENSE, "questStage")] },

  // 05060 The Master's Malice: the stand-in heroes are Tactics.
  { line: "05060:A:1", name: "When Revealed: the player chooses Lore, and each character who is not a Lore card takes 3 damage (both Tactics heroes)", layout: { stage: STAGE }, act: [resolve(MALICE, "whenRevealed"), answer("lore")], expect: [damageOn("dh1", 3), damageOn("dh2", 3)] },
  { line: "05060:A:1", name: "When Revealed: each player chooses in turn, and only the characters of that player take the damage (the second player chooses Tactics)", layout: { stage: STAGE, seats: 2 }, act: [resolve(MALICE, "whenRevealed"), answer("lore"), answer("tactics")], expect: [damageOn("dh1", 3), damageOn("dh3", 0)] },

  // 05072 The Defense (stage 1): the damage of an undefended attack goes to the lowest Threat Battleground location (ats.cair-andros-defense-carry-over).
  { line: "05072:B:2", name: "an undefended attack deals its damage to the lowest Threat Battleground location in play, and no hero takes any", layout: { stage: DEFENSE, staging: THREE }, act: attack("f3", { undefended: true, lands: { f3: BANKS } }), expect: [damageOn(BANKS, 1), damageOn(APPROACH, 0), damageOn("dh1", 0), damageOn("dh2", 0)] },
  { line: "05072:B:2", name: "the damage beyond the total of the location is lost: 8 damage removes The Banks, and no hero and no other location takes the rest", layout: { stage: DEFENSE, staging: THREE }, act: attack(VANGUARD, { undefended: true, lands: { [VANGUARD]: BANKS } }), expect: [zone(BANKS, "removed"), damageOn(APPROACH, 0), damageOn(CITADEL, 0), damageOn("dh1", 0)] },
  { line: "05072:B:2", name: "when the last Battleground location is removed the quest advances at once to stage 2", layout: { stage: DEFENSE, staging: [{ code: BANKS, damage: 1 }] }, act: attack("f3", { shadow: RAFT, undefended: true, lands: { f3: BANKS } }), expect: [zone(STAGE, "questStage"), zone(BANKS, "removed"), damageOn("dh1", 1)] },
  { line: "05072:B:2", name: "the shadow removes the location the attack was aimed at: the damage, set after the shadow, goes to the lowest Threat Battleground location then in play (The Approach), and no hero takes it", layout: { stage: DEFENSE, staging: [{ code: BANKS, damage: 1 }, APPROACH] }, act: attack("f3", { shadow: RAFT, undefended: true, lands: { f3: BANKS } }), expect: [zone(BANKS, "removed"), damageOn(APPROACH, 1), damageOn("dh1", 0)] },

  { line: "05074:B:2", name: "Forced: the players quest unsuccessfully and each player discards a hero, and raises no threat (28)", layout: { stage: AT_APPROACH, staging: [WAR_CAMP, "f3"] }, act: [quest("fail"), answer("dh2")], expect: [zone("dh2", "discard"), threat(28)] },
  { line: "05074:B:2", name: "Forced: with two players each discards a character and raises no threat, and the Forced effect works once (the first hero of the first player stays)", layout: { stage: AT_APPROACH, seats: 2, staging: [WAR_CAMP, "f3"] }, act: [quest("fail"), answer("dh2")], expect: [zone("dh2", "discard"), zone("dh3", "discard"), zone("dh1", "heroes"), threat(28), threat(28, 1)] },

  { line: "05073:B:1", name: "Reveal 1 additional card in the staging step: the player reveals 2 cards while stage 2 is current", layout: { stage: STAGE, phase: "Quest", staging: [WAR_CAMP], deck: ["f3", "f3", "f3"] }, act: quest("fail"), expect: count("f3", "staging", 2) },
  { line: "05075:B:2", name: "Breakthrough at the Citadel adds 5 Threat to the staging area (3 of the enemy and 5)", layout: { stage: AT_CITADEL, staging: ["f3"] }, act: [], expect: stagingThreat(8) },
  { line: "05076:B:2", name: "When Revealed: the first player reveals 1 card for each of 2 players, all staged", layout: { stage: LAST_BATTLE, seats: 2, firstPlayer: 1, deck: ["f3", "f3", "f3"] }, act: resolve(LAST_BATTLE, "whenRevealed"), expect: [count("f3", "staging", 2), revealedBy("f3", 1)] },
];

if (ROWS.length > 0) cardSpecs("the-siege-of-cair-andros", ROWS);
else describe("the-siege-of-cair-andros card specs", () => {});
