// Rules: rm.current-trial, rm.time-x, rr.forced, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.travel, rr.cost, rr.objective-cards, rr.search, rr.surge, rr.enemy-attacks (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, attack, cardSpecs, damageOn, deckCount, flag, offers, reveal, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for The Three Trials (the-ring-maker part 5): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests).
// What a row cannot show is in stages.test.ts (the Setup, the progress of 08038 turned into discards, the last stage, the Guardians' Time effects and attacks) and in trials.test.ts and trial-cards.test.ts (the trial loop). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; the filler enemy has 1 Attack.
const GUARDIAN = "08040";
const KEYS = [{ code: "08043", to: "dh1" }, { code: "08044", to: "dh1" }, { code: "08045", to: "dh1" }] as const;
const NOTHING = announce("endOfRound");

const ROWS: readonly Row[] = [
  // 08043 to 08045 The Keys. A Key lying unattached is claimed by the first player at once (the first hero is the one taken without a choice).
  { line: "08044:A:1", name: "If unattached, the first player must claim it and attach it to a hero he controls", layout: { staging: ["08044"] }, act: NOTHING, expect: zone("08044", "attached") },
  { line: "08045:A:1", name: "If unattached, the first player must claim it and attach it to a hero he controls", layout: { staging: ["08045"] }, act: NOTHING, expect: zone("08045", "attached") },
  { line: "08043:A:2", name: "If it is discarded, add it to the staging area (and the first player claims it again)", layout: { discard: ["08043"] }, act: announce("encounterDiscarded", "08043"), expect: zone("08043", "attached") },
  { line: "08044:A:2", name: "If it is discarded, add it to the staging area (and the first player claims it again)", layout: { discard: ["08044"] }, act: announce("encounterDiscarded", "08044"), expect: zone("08044", "attached") },
  { line: "08045:A:2", name: "If it is discarded, add it to the staging area (and the first player claims it again)", layout: { discard: ["08045"] }, act: announce("encounterDiscarded", "08045"), expect: zone("08045", "attached") },
  { line: "08043:A:3", name: "Shadow: it is shuffled back into the encounter deck", layout: { engaged: ["f0"], deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: "08043", undefended: true }), expect: zone("08043", "encounterDeck") },
  { line: "08044:A:3", name: "Shadow: it is shuffled back into the encounter deck", layout: { engaged: ["f0"], deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: "08044", undefended: true }), expect: zone("08044", "encounterDeck") },
  { line: "08045:A:3", name: "Shadow: it is shuffled back into the encounter deck", layout: { engaged: ["f0"], deck: ["f0", "f0", "f0"] }, act: attack("f0", { shadow: "08045", undefended: true }), expect: zone("08045", "encounterDeck") },

  // 08036 The Trial of Strength (the Key and the next trial are in trials.test.ts).
  { line: "08036:B:1", name: "Each Guardian enemy engages the first player", layout: { stage: "08036", staging: [GUARDIAN] }, act: NOTHING, expect: zone(GUARDIAN, "engaged") },
  { line: "08036:B:1", name: "Barrow locations are immune to player card effects", layout: { stage: "08036", staging: ["08046"] }, act: NOTHING, expect: flag("08046", "immuneToPlayerCards") },
  { line: "08036:B:1", name: "Barrow locations cannot be the active location: the players cannot travel to one", layout: { stage: "08036", phase: "Travel", staging: ["08046"] }, act: [], expect: offers("Travel", undefined, false) },

  // 08046 Hill Barrow and 08048 Stone Barrow.
  { line: "08046:A:1", name: "Forced: when a Guardian attacks it is dealt 1 additional shadow card", layout: { staging: ["08046"], engaged: [GUARDIAN], deck: ["f0", "f0", "f0", "f0"] }, act: attack(GUARDIAN, { undefended: true }), expect: deckCount(2) },
  { line: "08048:A:1", name: "Forced: after a Guardian attacks each player raises his threat by that enemy's Threat", layout: { staging: ["08048"], engaged: [GUARDIAN], threat: [20, 20] }, act: attack(GUARDIAN, { undefended: true }), expect: threat(21) },

  // 08049 Hallowed Circle.
  { line: "08049:A:1", name: "X is the number of players: its Threat is 2 with two players", layout: { seats: 2, staging: ["08049"] }, act: NOTHING, expect: stat("08049", "threat", 2) },
  { line: "08049:A:2", name: "Travel: with 3 Keys but one of them exhausted the players cannot travel there (the Keys must be ready to be exhausted)", layout: { phase: "Travel", staging: ["08049"], attached: [...KEYS], exhaustedCards: ["08045"] }, act: [], expect: offers("Travel", undefined, false) },
  { line: "08049:A:2", name: "Travel: with 2 Keys the players cannot travel there", layout: { phase: "Travel", staging: ["08049"], attached: [KEYS[0], KEYS[1]] }, act: [], expect: offers("Travel", undefined, false) },

  // 08050 Spirit of the Wild.
  { line: "08050:A:2", name: "+1 Threat and +1 Attack for each Key objective the players control", layout: { engaged: ["08050"], attached: [KEYS[0], KEYS[1]] }, act: NOTHING, expect: [stat("08050", "threat", 3), stat("08050", "attack", 3)] },
  { line: "08050:A:3", name: "Shadow: the attacker gets +1 Attack for each Key objective the players control", layout: { engaged: ["f0"], attached: [KEYS[0], KEYS[1]] }, act: attack("f0", { shadow: "08050", undefended: true }), expect: damageOn("dh1", 3) },

  // 08051 Cursed Forest.
  { line: "08051:A:1", name: "Travel: a Spirit enemy found in the encounter deck is added to the staging area, not revealed", layout: { phase: "Travel", staging: ["08051"], deck: ["f0", "08050", "f0"] }, act: travel("08051"), expect: zone("08050", "staging") },

  // 08052 Grim Foothills.
  { line: "08052:A:2", name: "X is the number of players: its Threat is 2 with two players", layout: { seats: 2, staging: ["08052"] }, act: NOTHING, expect: stat("08052", "threat", 2) },
  { line: "08052:A:3", name: "While it is in the staging area progress must be placed on it before the active location", layout: { staging: ["08052"] }, act: NOTHING, expect: flag("08052", "progressFirstRequired") },

  // 08053 Curse of the Wild Men.
  { line: "08053:A:1", name: "When Revealed: 1 damage to each non-unique character in play", layout: { deck: ["08053", "f0"], play: ["ally"] }, act: reveal("08053"), expect: damageOn("ally", 1) },
  { line: "08053:A:2", name: "Shadow: the attacker gets +1 Attack for each Key objective the players control", layout: { engaged: ["f0"], attached: [KEYS[0], KEYS[1], KEYS[2]] }, act: attack("f0", { shadow: "08053", undefended: true }), expect: damageOn("dh1", 4) },

  // 08055 Wild Tenacity.
  { line: "08055:A:2", name: "Shadow: a Guardian attacker is dealt 2 additional shadow cards", layout: { engaged: [GUARDIAN], deck: ["f0", "f0", "f0", "f0", "f0"] }, act: attack(GUARDIAN, { shadow: "08055", undefended: true }), expect: deckCount(3) },
];

if (ROWS.length > 0) cardSpecs("the-three-trials", ROWS);
else describe("the-three-trials card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
