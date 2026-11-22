// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.the-investigation, mec108.objective-allies, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.travel, rr.first-player, rr.running-out-of-cards, faq.additional-attacks, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { attack, attackersOf, cardSpecs, damageOn, defend, endPhase, lost, notWon, progressOn, quest, resolve, reveal, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Treachery of Rhudaur (angmar-awakened part 7): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Finish). What a row cannot express (a card in a discard pile, a count over several steps, a cost, a pool entry, a tie) is a test
// titled with its line id in lines.test.ts, stages.test.ts, clues.test.ts and campaign.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side.
const STAGE2 = "10095";
const AMARTHIUL = "10096";
const THAURDIR = "10098";
const WIGHT = "10100";
const EERIE_HALLS = "10102";
const CENTURIES = "10105";
const CURSE = "10106";
const BRAND = "10110";
const COVENANT = "10107";

const ROWS: readonly Row[] = [
  { line: "10095:A:1", name: "When Revealed: Thaurdir is added to the staging area and each player searches the encounter deck for an Undead enemy and adds it there", layout: { stage: STAGE2, setAside: [THAURDIR], deck: ["f0", WIGHT] }, act: resolve(STAGE2, "whenRevealed"), expect: [zone(THAURDIR, "staging"), zone(WIGHT, "staging")] },

  { line: "10095:B:1", name: "-5 quest points for each Clue objective attached to a character (30 becomes 25 with one claimed)", layout: { stage: STAGE2, attached: [{ code: BRAND, to: "dh1" }], staging: ["10112"] }, act: [], expect: stat(STAGE2, "questPoints", 25) },
  { line: "10095:B:2", name: "the stage is not defeated while Thaurdir has hit points left, though it holds its quest points in progress", layout: { stage: STAGE2, progress: 29, staging: [THAURDIR], play: ["ally"], committed: ["ally"] }, act: quest("success"), expect: [progressOn(STAGE2, 30), notWon] },

  { line: "10098:A:3", name: "Forced after a Sorcery treachery is revealed from the encounter deck: Thaurdir heals 3 damage and attacks the first player at once", layout: { stage: STAGE2, staging: [{ code: THAURDIR, damage: 5 }], deck: ["f0"] }, act: [reveal(COVENANT), endPhase], expect: [damageOn(THAURDIR, 2), attackersOf("dh1", [THAURDIR])] },

  { line: "10100:A:2", name: "Shadow: for each point of damage dealt by this attack remove 1 progress from each quest in play", layout: { stage: STAGE2, progress: 5, staging: [{ code: "10109", progress: 4 }] }, act: attack("f3", { shadow: WIGHT, undefended: true }), expect: progressOn("10109", 3) },
  { line: "10104:A:2", name: "Shadow: the same removal of progress, for each point of damage dealt", layout: { stage: STAGE2, progress: 5, staging: [{ code: "10109", progress: 4 }] }, act: attack("f3", { shadow: "10104", undefended: true }), expect: [progressOn("10109", 3), stat("10095", "questPoints", 30)] },

  { line: "10102:A:2", name: "Shadow: the defending player controls no Clue, so the attacking enemy makes an additional attack", layout: {}, act: attack("f3", { shadow: EERIE_HALLS, undefended: true }), expect: attackersOf("dh1", ["f3", "f3"]) },

  { line: "10105:A:3", name: "Shadow: the attack is undefended unless the defending player controls a Clue", layout: {}, act: attack("f3", { shadow: CENTURIES }), expect: damageOn("dh1", 1) },

  { line: "10106:A:2", name: "Shadow: +1 Attack, +3 instead when the defending player controls no Clue", layout: {}, act: attack("f3", { shadow: CURSE, undefended: true }), expect: damageOn("dh1", 4) },

  // "If Amarthiúl leaves play, the players lose the game." He defends Traitorous Wight (4 Attack against his 3 Defense) with 2 damage on his 3 hit points, and the attack destroys him.
  { line: "10096:A:2", name: "the attack that destroys Amarthiúl loses the game", layout: { play: [{ code: AMARTHIUL, damage: 2 }] }, act: [attack(WIGHT), defend(AMARTHIUL)], expect: [zone(AMARTHIUL, "encounterDiscard"), lost] },
  // "Attached hero gets +1 Willpower."
  { line: "10186:A:2", name: "the hero Heirloom of Iârchon is attached to gets +1 Willpower, the other hero does not", layout: { attached: [{ code: "10186", to: "dh1" }] }, act: [], expect: [stat("dh1", "willpower", 3), stat("dh2", "willpower", 2)] },
];

if (ROWS.length > 0) cardSpecs("the-treachery-of-rhudaur", ROWS);
else describe("the-treachery-of-rhudaur card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
