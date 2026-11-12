// Rules: mec113.immune-to-player-card-effects, mec113.saga-staging-rules, mec113.peril, mec113.archery, rr.effects, rr.forced, rr.shadow-effects, rr.lasting-effects, rr.travel, rr.engaged, rr.then, faq.additional-attacks, faq.lasting-effects (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, deckCount, defend, endPhase, exhausted, flag, reveal, resolve, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Tower of Cirith Ungol (the-return-of-the-king part 16): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/handover/agent-brief.md, Scenario procedure, Finish). What a row cannot hold (the quest stages' Setup and
// advance, the Ring-bearer under Topmost Chamber, a lasting effect read later in the phase, the campaign card's Setup and Forced) is in lines.test.ts, stages.test.ts and set-aside.test.ts, each test titled with its line.
// The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points and every seat starts at threat 28; f3 is an enemy with Threat 3, Attack 1, Defense 1 and 3 hit points, f0 the same with Threat 0.
const RING = "146065";
const LAST = "146014";
const WATCHERS = "146071";
// Stage 1 skips the quest and combat phases, so the rows that attack or quest are played at stage 2 (the second quest card).
const STAGE2 = { stage: "146067" };
const ROWS: readonly Row[] = [
  { line: "146014:A:2", name: "Action: exhaust The One Ring and raise your threat by 1, and an enemy gets -X Threat, X the attached hero's Willpower", layout: { attached: [{ code: LAST, to: "dh1" }, { code: RING, to: "dh1" }], staging: ["f3"] }, act: resolve(LAST, "action"), expect: [exhausted(RING), threat(29), stat("f3", "threat", 1)] },


  { line: "146016:A:1", name: "+1 Threat for each enemy in the staging area", layout: { ...STAGE2, staging: ["146016", "f3", "f0"] }, act: [], expect: stat("146016", "threat", 3) },
  { line: "146016:A:2", name: "while it is the active location each enemy gets +2 Defense", layout: { active: "146016", staging: ["f3"], engaged: [{ code: "f0", seat: 0 }] }, act: [], expect: [stat("f3", "defense", 3), stat("f0", "defense", 3)] },

  { line: "146017:A:1", name: "while it is the active location an enemy added to the staging area takes 1 damage", layout: { active: "146017", staging: ["f3"] }, act: announce("addedToStaging", "f3"), expect: damageOn("f3", 1) },
  { line: "146017:A:1", name: "an enemy returned from being engaged to the staging area takes 1 damage as well", layout: { active: "146017", staging: ["f3"] }, act: announce("returnedToStaging", "f3"), expect: damageOn("f3", 1) },
  { line: "146017:A:1", name: "an enemy a shadow card returns to the staging area takes 1 damage", layout: { ...STAGE2, active: "146017", play: [{ code: "ally", damage: 1 }] }, act: [attack("f3", { shadow: "146060" }), defend("ally")], expect: [zone("f3", "staging"), damageOn("f3", 1)] },
  { line: "146017:A:2", name: "Travel: each player raises their threat by 2", layout: { ...STAGE2, phase: "Travel", staging: ["146017"], seats: 2 }, act: travel("146017"), expect: [threat(30), threat(30, 1)] },

  { line: "146018:A:1", name: "while it is the active location each enemy in the staging area gets +10 engagement cost", layout: { active: "146018", staging: ["f3"], engaged: [{ code: "f0", seat: 0 }] }, act: [], expect: [stat("f3", "engagementCost", 60), stat("f0", "engagementCost", 50)] },
  { line: "146018:A:2", name: "Travel: each player exhausts a character they control", layout: { ...STAGE2, phase: "Travel", staging: ["146018"], seats: 2 }, act: [resolve("146018", "travel"), answer("dh1")], expect: [exhausted("dh1"), exhausted("dh3")] },

  { line: "146019:A:1", name: "After the players travel here an enemy is discarded from the encounter deck and added to the staging area", layout: { ...STAGE2, phase: "Travel", staging: ["146019"], deck: ["treachery", "f3", "f0"] }, act: travel("146019"), expect: [zone("f3", "staging"), zone("treachery", "encounterDiscard")] },

  { line: "146020:A:1", name: "cannot take non-combat damage", layout: { staging: ["146020"] }, act: [], expect: flag("146020", "cannotTakeNonCombatDamage") },
  { line: "146020:A:2", name: "allies cannot attack him", layout: { staging: ["146020"] }, act: [], expect: flag("146020", "alliesCannotAttack") },

  { line: "146021:A:2", name: "Forced: after it engages you it makes an immediate attack", layout: { ...STAGE2, deck: ["f0", "f0", "f0"], engaged: [{ code: "146021", seat: 0 }] }, act: [resolve("146021", "forced"), endPhase], expect: attackersOf("dh1", ["146021"]) },
  { line: "146021:A:3", name: "Shadow: the attacking enemy makes an additional attack against you after this one", layout: { ...STAGE2, deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: "146021", undefended: true }), expect: attackersOf("dh1", ["f3", "f3"]) },

  { line: "146021:A:3", name: "the additional attack is dealt a new shadow card", layout: { ...STAGE2, deck: ["146059", "f0", "f0"] }, act: attack("f3", { shadow: "146021", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "146022:A:1", name: "it enters play with 2 damage on it", layout: { ...STAGE2 }, act: reveal("146022"), expect: damageOn("146022", 2) },
  { line: "146022:A:2", name: "Forced: after it engages you it gets +2 Attack until the end of the round", layout: { engaged: [{ code: "146022", seat: 0 }] }, act: resolve("146022", "forced"), expect: stat("146022", "attack", 5) },
  { line: "146022:A:3", name: "Shadow: +1 Attack for each damage on the attacking enemy", layout: { ...STAGE2, engaged: [{ code: "f3", seat: 0, damage: 2 }] }, act: attack("f3", { shadow: "146022", undefended: true }), expect: damageOn("dh1", 3) },

  { line: "146023:A:1", name: "When Revealed: each enemy in the staging area takes 1 damage and gets +1 Threat for each damage on it", layout: { staging: ["f3"] }, act: reveal("146023"), expect: [damageOn("f3", 1), stat("f3", "threat", 4)] },
  { line: "146023:A:1", name: "with no enemy in the staging area it gains surge", layout: { phase: "Encounter", deck: ["f3", "f0"] }, act: reveal("146023"), expect: deckCount(0) },
  { line: "146023:A:1", name: "an enemy the damage destroys leaves no enemy in the staging area, so it gains surge", layout: { phase: "Encounter", staging: [{ code: "f3", damage: 2 }], deck: ["f0", "f0"] }, act: reveal("146023"), expect: [zone("f3", "encounterDeck"), zone("f0", "staging")] },
  { line: "146023:A:2", name: "Shadow: the shadowed enemy's attack is resolved against the other engaged enemy, so the hero takes only the other attack's damage", layout: { ...STAGE2, engaged: [{ code: "146058", seat: 0 }, { code: "f3", seat: 0 }] }, act: attack("146058", { shadow: "146023", undefended: true }), expect: damageOn("dh1", 3) },

  { line: "146058:A:2", name: "Forced: after it engages you you exhaust a character you control", layout: { engaged: [{ code: "146058", seat: 0 }] }, act: resolve("146058", "forced"), expect: exhausted("dh1") },
  { line: "146058:A:3", name: "Shadow: you exhaust a character you control", layout: STAGE2, act: attack("f3", { shadow: "146058", undefended: true }), expect: exhausted("dh1") },

  { line: "146059:A:2", name: "Forced: after it engages you it deals 2 damage to one character you control", layout: { engaged: [{ code: "146059", seat: 0 }] }, act: resolve("146059", "forced"), expect: damageOn("dh1", 2) },
  { line: "146059:A:3", name: "Shadow: +1 Attack", layout: STAGE2, act: attack("f3", { shadow: "146059", undefended: true }), expect: damageOn("dh1", 2) },

  { line: "146060:A:1", name: "Forced: after it engages you you raise your threat by 2", layout: { engaged: [{ code: "146060", seat: 0 }] }, act: announce("engaged", "146060", { seat: 0 }), expect: threat(30) },
  { line: "146060:A:2", name: "Shadow: a character it destroys sends the attacking enemy back to the staging area", layout: { ...STAGE2, play: [{ code: "ally", damage: 1 }] }, act: [attack("f3", { shadow: "146060" }), defend("ally")], expect: [zone("ally", "discard"), zone("f3", "staging")] },

  { line: "146061:A:1", name: "When Revealed: the first player exhausts The One Ring to reveal an encounter card", layout: { attached: [{ code: RING, to: "dh1" }], deck: ["f3", "f0"] }, act: [reveal("146061"), answer("ring")], expect: [exhausted(RING), zone("f3", "staging")] },
  { line: "146061:A:1", name: "or discards cards until an enemy is discarded and puts it into play engaged with them", layout: { attached: [{ code: RING, to: "dh1" }], deck: ["treachery", "f3", "f0"] }, act: [reveal("146061"), answer("enemy")], expect: [zone("f3", "engaged"), exhausted(RING, false)] },
  { line: "146061:A:2", name: "Shadow: discard an attachment you control", layout: { ...STAGE2, attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: "146061", undefended: true }), expect: zone("attachment", "discard") },

  { line: "146062:A:2", name: "When Revealed: each player discards their hand or reveals an encounter card", layout: { phase: "Encounter", hand: ["filler", "filler", "filler"], deck: ["f3", "f0"] }, act: [reveal("146062"), answer("reveal")], expect: deckCount(0) },
  { line: "146062:A:2", name: "or discards a hand of at least 3 cards", layout: { hand: ["filler", "filler", "filler"], deck: ["f3", "f0"] }, act: [reveal("146062"), answer("discard")], expect: { expect: "handCount", value: 0, seat: 0 } },

  { line: "146063:A:1", name: "When Revealed: you raise your threat by 1 for each questing character you control", layout: { committed: ["dh1", "dh2"], deck: ["f0"] }, act: [reveal("146063"), answer("threat")], expect: threat(30) },
  { line: "146063:A:1", name: "or discard a questing character you control", layout: { committed: ["ally"], play: ["ally"], deck: ["f0"] }, act: [reveal("146063"), answer("discard")], expect: zone("ally", "discard") },
  { line: "146063:A:2", name: "Shadow: +1 Attack", layout: STAGE2, act: attack("f3", { shadow: "146063", undefended: true }), expect: damageOn("dh1", 2) },

  { line: "146066:B:1", name: "each non-unique location in the staging area gets -1 Threat", layout: { staging: ["place"] }, act: [], expect: stat("place", "threat", 1) },
  { line: "146066:B:2", name: "The Two Watchers' enemy side is considered engaged with each player and adds no threat to the staging area", layout: { staging: [WATCHERS] }, act: [], expect: [flag(WATCHERS, "engagedWithAll"), flag(WATCHERS, "attackableByAny")] },

  { line: "146067:A:1", name: "When Revealed: the discard pile is shuffled into the deck and one enemy for each player is discarded and added to the staging area", layout: { ...STAGE2, seats: 2, discard: ["f3"], deck: ["treachery", "f0", "f3"] }, act: resolve("146067", "whenRevealed"), expect: [zone("f3", "staging"), zone("f0", "staging")] },
  { line: "146067:B:1", name: "at the beginning of the quest phase an enemy is discarded from the encounter deck and added to the staging area", layout: { ...STAGE2, deck: ["treachery", "f3"] }, act: resolve("146067", "forced"), expect: zone("f3", "staging") },

  { line: "146068:B:2", name: "while in the staging area the Watchers' enemy side gets +3 Threat and +3 Defense", layout: { stage: "146068", staging: [WATCHERS] }, act: [], expect: [stat(WATCHERS, "threat", 5), stat(WATCHERS, "defense", 5)] },

  { line: "146070:A:2", name: "its Threat X is twice the stage number of the main quest", layout: { stage: "146067", staging: ["146070"] }, act: [], expect: stat("146070", "threat", 4) },
  { line: "146070:A:3", name: "After the players travel here it flips to the enemy side in the staging area", layout: { ...STAGE2, phase: "Travel", staging: ["146070"] }, act: travel("146070"), expect: zone(WATCHERS, "staging") },

  { line: "146071:A:1", name: "cannot be optionally engaged", layout: { staging: [WATCHERS] }, act: [], expect: flag(WATCHERS, "cannotBeOptionallyEngaged") },
  { line: "146071:A:2", name: "an unblocked attack raises the threat by its damage", layout: STAGE2, act: attack(WATCHERS, { shadow: "treachery", undefended: true }), expect: [damageOn("dh1", 0), threat(33)] },
];

if (ROWS.length > 0) cardSpecs("the-tower-of-cirith-ungol", ROWS);
else describe("the-tower-of-cirith-ungol card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
