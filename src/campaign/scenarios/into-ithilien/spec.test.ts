// Rules: ats.ally-objectives, rr.forced, rr.reveal, rr.shadow-effects, rr.search, rr.engaged, rr.attachment-cards, hon.archery, rr.step-3-4, faq.enemy-attacks-outside-combat (data/rules/entries.json). Lines that a row cannot show (the Setup, the stage skip, the quest total, the leaving of play of a Guardian under control, the Siege of stage 4) are tests titled with their line id in lines.test.ts.
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, committed, damageOn, deckCount, exhausted, flag, progressOn, reveal, resolve, stat, threat, window, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Into Ithilien (against-the-shadow part 2): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points;
// every seat starts at threat 28. The stages: 05068 (Battle), 05069 (Siege, Archery X), 05070 (no keyword), 05071 (no keyword, Siege at threat 37).
const CELADOR = "05025";
const GUARDIAN = "05026";
const COMPANY = "05027";
const ROAD = "05028";
const WARGS = "05029";
const TRAIL = "05046";
const GLADE = "05047";
const COMPANION = "05048";
const BAT = "05050";
const WATCHER = "05051";
const MERCENARIES = "05052";
const ELITE = "05053";
const SPIDER = "05049";
const SUPPORT = "05055";
const BATTLE = "05068";
const SIEGE = "05069";
const HIDDEN_WAY = "05070";
const APPROACHING = "05071";

const ROWS: readonly Row[] = [
  { line: "05025:A:2", name: "Forced: after the players quest unsuccessfully, 1 damage to Celador", layout: { staging: [CELADOR], stage: BATTLE }, act: announce("questFailed"), expect: damageOn(CELADOR, 1) },
  { line: "05025:A:2", name: "Forced: after a character leaves play, 1 damage to Celador", layout: { staging: [CELADOR], stage: BATTLE, play: ["ally"] }, act: announce("leftPlay", "ally"), expect: damageOn(CELADOR, 1) },

  { line: "05026:A:2", name: "When Revealed: it lies in the staging area and gains surge, so another card is revealed", layout: { stage: BATTLE, deck: ["f0", "f0"] }, act: reveal(GUARDIAN), expect: [zone(GUARDIAN, "staging"), deckCount(1)] },
  { line: "05026:A:3", name: "Shadow: 2 damage to the attacking enemy", layout: { stage: BATTLE }, act: attack("f3", { shadow: GUARDIAN, undefended: true }), expect: damageOn("f3", 2) },

  { line: "05027:A:1", name: "Battle: +2 Threat and +2 Attack (printed 1 and 3)", layout: { staging: [COMPANY], stage: BATTLE }, act: [], expect: [stat(COMPANY, "threat", 3), stat(COMPANY, "attack", 5)] },
  { line: "05027:A:1", name: "Siege: +2 Threat and +2 Attack", layout: { staging: [COMPANY], stage: SIEGE }, act: [], expect: [stat(COMPANY, "threat", 3), stat(COMPANY, "attack", 5)] },
  { line: "05027:A:2", name: "Shadow: +1 Attack with a quest card that has no keyword (an undefended attack by a 1 Attack enemy deals 2)", layout: { stage: HIDDEN_WAY }, act: attack("f3", { shadow: COMPANY, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "05027:A:2", name: "Shadow: +2 Attack instead with a quest card that has a keyword (Battle)", layout: { stage: BATTLE }, act: attack("f3", { shadow: COMPANY, undefended: true }), expect: damageOn("dh1", 3) },

  { line: "05028:A:1", name: "While it is the active location an enemy in the staging area has engagement cost 0 (printed 34)", layout: { active: ROAD, staging: [COMPANY], stage: HIDDEN_WAY }, act: [], expect: stat(COMPANY, "engagementCost", 0) },
  { line: "05028:A:2", name: "Shadow: the attacking enemy returns to the staging area after it attacks", layout: { stage: BATTLE }, act: attack("f3", { shadow: ROAD, undefended: true }), expect: zone("f3", "staging") },

  { line: "05029:A:3", name: "Shadow: 1 damage to the defending character (the attack alone deals none to a Defense 2 hero)", layout: { stage: BATTLE }, act: attack("f3", { shadow: WARGS }), expect: damageOn("dh1", 1) },

  { line: "05029:A:2", name: "When Revealed: 1 damage to each character committed to the quest, an ally objective in the staging area included, and none to an uncommitted one", layout: { stage: BATTLE, staging: [CELADOR], committed: ["dh1"], play: ["ally"], deck: ["f0", "f0"] }, act: reveal(WARGS), expect: [damageOn("dh1", 1), damageOn(CELADOR, 1), damageOn("ally", 0), damageOn("dh2", 0)] },

  { line: "05046:A:1", name: "Action: a ready Ranger character the player controls is exhausted for 3 progress on Overgrown Trail", layout: { staging: [TRAIL], play: [GUARDIAN], stage: HIDDEN_WAY }, act: resolve(TRAIL, "action"), expect: [exhausted(GUARDIAN), progressOn(TRAIL, 3)] },
  { line: "05046:A:2", name: "Shadow: X progress off the current quest, X the attacking enemy's Threat (3)", layout: { stage: BATTLE, progress: 5 }, act: attack("f3", { shadow: TRAIL, undefended: true }), expect: progressOn(BATTLE, 2) },
  { line: "05047:A:2", name: "Shadow: X progress off the current quest, X the attacking enemy's Threat (3)", layout: { stage: BATTLE, progress: 5 }, act: attack("f3", { shadow: GLADE, undefended: true }), expect: progressOn(BATTLE, 2) },

  { line: "05048:A:1", name: "Each player removes 1 character he controls from the quest: the other stays committed while every player still has one", layout: { stage: BATTLE, committed: ["dh1", "dh2"] }, act: [reveal(COMPANION), answer("dh1")], expect: [committed("dh1", false), committed("dh2")] },
  { line: "05048:A:1", name: "Then, if any player has no character committed, every character leaves the quest", layout: { seats: 2, stage: BATTLE, committed: ["dh1", "dh2"] }, act: [reveal(COMPANION), answer("dh1")], expect: [committed("dh1", false), committed("dh2", false)] },

  { line: "05049:A:1", name: "When Revealed: +1 Attack for each character not committed to a quest (dh2 and the ally: Celador and dh1 are committed)", layout: { stage: HIDDEN_WAY, staging: [CELADOR], committed: ["dh1"], play: ["ally"], deck: ["f0", "f0"] }, act: reveal(SPIDER), expect: stat(SPIDER, "attack", 6) },

  { line: "05050:A:1", name: "The first player chooses a questing hero: 2 damage, and the hero leaves the quest", layout: { stage: BATTLE, committed: ["dh1", "dh2"] }, act: [reveal(BAT), answer("dh2")], expect: [damageOn("dh2", 2), committed("dh2", false), committed("dh1")] },
  { line: "05050:A:2", name: "Shadow: the defending player raises his threat by the attacker's Threat (3)", layout: { stage: BATTLE }, act: attack("f3", { shadow: BAT, undefended: true }), expect: threat(31) },

  { line: "05051:A:2", name: "Shadow: each player raises his threat by the enemies engaged with him (f0 and the attacker)", layout: { stage: BATTLE, engaged: ["f0"] }, act: attack("f3", { shadow: WATCHER, undefended: true }), expect: threat(30) },

  { line: "05051:A:1", name: "When Revealed: each player raises his threat by the characters committed (a hero and Celador), and the card gains surge under Battle", layout: { stage: BATTLE, staging: [CELADOR], committed: ["dh1"], deck: ["f0", "f0"] }, act: reveal(WATCHER), expect: [threat(30), deckCount(1)] },
  { line: "05051:A:1", name: "Under a quest card without a keyword it gains no surge", layout: { stage: HIDDEN_WAY, staging: [CELADOR], committed: ["dh1"], deck: ["f0", "f0"] }, act: reveal(WATCHER), expect: [threat(30), deckCount(2)] },

  { line: "05052:A:3", name: "Shadow: +1 Attack (an undefended attack by a 1 Attack enemy deals 2)", layout: { stage: HIDDEN_WAY }, act: attack("f3", { shadow: MERCENARIES, undefended: true }), expect: damageOn("dh1", 2) },
  { line: "05052:A:3", name: "Shadow: +3 Attack instead for a Harad attacker (3 + 3 destroys a 6 hit point hero)", layout: { stage: HIDDEN_WAY }, act: attack(COMPANY, { shadow: MERCENARIES, undefended: true }), expect: zone("dh1", "discard") },

  { line: "05053:A:1", name: "Forced: when it is added to the staging area it attacks the first player at once", layout: { staging: [ELITE], stage: BATTLE, deck: ["f0", "f0"] }, act: announce("addedToStaging", ELITE), expect: window("defense") },
  { line: "05053:A:2", name: "Shadow: the enemy attacks again, with a new shadow card (the shadow and a second one leave the deck)", layout: { stage: BATTLE }, act: attack("f3", { shadow: ELITE, undefended: true }), expect: deckCount(2) },

  { line: "05055:A:2", name: "When Revealed: each player searches the encounter deck for a Harad enemy and adds it to the staging area", layout: { stage: BATTLE, deck: [COMPANY, "f0", "f0"] }, act: reveal(SUPPORT), expect: zone(COMPANY, "staging") },
  { line: "05055:A:2", name: "A Haradrim Elite it adds to the staging area attacks the first player at once", layout: { stage: BATTLE, deck: [ELITE, "f0", "f0"] }, act: reveal(SUPPORT), expect: window("defense") },
  { line: "05055:A:2", name: "The discard pile is searched too", layout: { stage: BATTLE, deck: ["f0", "f0"], discard: [COMPANY] }, act: reveal(SUPPORT), expect: zone(COMPANY, "staging") },


  { line: "05070:B:2", name: "Enemies do not make engagement checks and cannot be optionally engaged", layout: { stage: HIDDEN_WAY }, act: [], expect: [flag("table", "noEngagementChecks"), flag("table", "cannotBeOptionallyEngaged")] },

  { line: "05071:B:2", name: "Forced: at the end of each round each player raises his threat by 2 ", layout: { stage: APPROACHING }, act: resolve(APPROACHING, "forced"), expect: threat(30) },
];

if (ROWS.length > 0) cardSpecs("into-ithilien", ROWS);
else describe("into-ithilien card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
