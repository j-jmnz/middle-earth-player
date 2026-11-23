// Rules: rr.forced, rr.reveal, rr.shadow-effects, rr.travel, rr.search, rr.engaged, rr.optional-engagement, rr.attachment-cards, rr.running-out-of-cards (data/rules/entries.json). Lines that need Alcaron's Scroll on a hero or a played-out game are tests titled with their line id in lines.test.ts.
import { describe, it } from "vitest";

import { announce, answer, attack, cardSpecs, count, damageOn, deckCount, handCount, resolve, resourcesOn, reveal, stat, threat, travel, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Peril in Pelargir (against-the-shadow part 1): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points;
// every seat starts at threat 28; a layout's phase is the one the row names. The layout's attachments are plain attachments in play, so the rows that need the Scroll on a hero are in lines.test.ts.
const THUG = "05020";
const PICKPOCKET = "05037";
const ZEALOUS = "05042";
const BANDIT = "05043";
const ASSASSIN = "05044";

const ROWS: readonly Row[] = [
  { line: "05022:A:1", name: "While Pelargir Docks is the active location, enemies in the staging area and engaged get +1 Attack and +1 Defense", layout: { active: "05022", engaged: [THUG], staging: [ZEALOUS] }, act: [], expect: [stat(THUG, "attack", 4), stat(THUG, "defense", 2), stat(ZEALOUS, "attack", 4), stat(ZEALOUS, "defense", 3)] },

  { line: "05023:A:1", name: "Each time a location is discarded from the top of the encounter deck, each player raises his threat by 1 (and Collateral Damage's own 2 for that location)", layout: { staging: ["05023"], deck: ["05021", "f0", "f0"] }, act: reveal("05024"), expect: threat(31) },
  { line: "05023:A:2", name: "Shadow: one additional shadow card for each Thug in play (two in the staging area; the threat 20 keeps them there): 1 shadow card and 2 more leave the deck", layout: { staging: [THUG, THUG], threat: [20, 20] }, act: attack("f3", { shadow: "05023", undefended: true }), expect: deckCount(1) },

  { line: "05024:A:1", name: "Discard 2, 2 more for each copy in the discard pile, then each player raises his threat by 2 for each location discarded", layout: { deck: ["05021", "f0", "05022", "f0", "f0", "f0"], discard: ["05024"] }, act: reveal("05024"), expect: [threat(32), deckCount(2)] },
  { line: "05024:A:1", name: "No copy in the discard pile: only 2 are discarded", layout: { deck: ["05021", "05022", "05023", "f0"] }, act: reveal("05024"), expect: [threat(32), deckCount(2)] },

  { line: "05037:A:1", name: "Forced when it attacks: the defender discards 1 resource from a hero of his choice and 1 card at random", layout: { heroResources: 2, hand: ["filler", "filler"] }, act: [attack(PICKPOCKET, { undefended: true }), answer("dh1")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 2), handCount(1)] },
  { line: "05037:A:1", name: "No resource anywhere: only the card goes", layout: { hand: ["filler", "filler"] }, act: attack(PICKPOCKET, { undefended: true }), expect: handCount(1) },
  { line: "05037:A:2", name: "Shadow: discard 1 of his attachments", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: [attack("f3", { shadow: PICKPOCKET }), answer("attachment")], expect: count("attachment", "discard", 1) },
  { line: "05037:A:2", name: "Shadow, undefended: all of his attachments", layout: { attached: [{ code: "attachment", to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: PICKPOCKET, undefended: true }), expect: count("attachment", "discard", 2) },

  { line: "05039:A:2", name: "Travel: each player spends 1 resource from one of his heroes' pools (dh1 paid, so the resource phase that follows leaves it at 1 and dh2 at 2)", layout: { staging: ["05039"], phase: "Travel", heroResources: 1 }, act: [travel("05039"), answer("dh1")], expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 2), zone("05039", "activeLocation")] },
  { line: "05039:A:3", name: "Shadow: the defending player discards all resources in his heroes' pools", layout: { heroResources: 3 }, act: attack("f3", { shadow: "05039", undefended: true }), expect: [resourcesOn("dh1", 0), resourcesOn("dh2", 0)] },

  { line: "05040:A:1", name: "When Revealed: each player searches the encounter deck for a City location and adds it to the staging area", layout: { deck: ["05038", "f0", "f0"] }, act: reveal("05040"), expect: zone("05038", "staging") },
  { line: "05040:A:1", name: "The discard pile is searched too", layout: { deck: ["f0", "f0"], discard: ["05038"] }, act: reveal("05040"), expect: zone("05038", "staging") },
  { line: "05040:A:2", name: "Shadow: the defending player discards his hand", layout: { hand: ["filler", "filler"] }, act: attack("f3", { shadow: "05040", undefended: true }), expect: handCount(0) },

  { line: "05041:A:1", name: "When Revealed: attach to a hero (the first player chooses among those tied for the highest threat cost)", layout: { deck: ["f0"] }, act: [reveal("05041"), answer("dh1")], expect: zone("05041", "attached") },
  { line: "05041:A:1", name: "The hero exhausts: his controller raises his threat by 1", layout: { attached: [{ code: "05041", to: "dh1" }] }, act: announce("exhausted", "dh1"), expect: threat(29) },
  { line: "05041:A:1", name: "The hero readies: his controller raises his threat by 1", layout: { attached: [{ code: "05041", to: "dh1" }] }, act: announce("readied", "dh1"), expect: threat(29) },
  { line: "05041:A:1", name: "The hero triggers an ability: his controller raises his threat by 1", layout: { attached: [{ code: "05041", to: "dh1" }] }, act: announce("abilityTriggered", "dh1"), expect: threat(29) },

  { line: "05042:A:1", name: "Forced when it engages a player not optionally: 2 damage to each ally he controls", layout: { phase: "Encounter", engaged: [ZEALOUS], play: [{ code: "ally", damage: 0 }] }, act: announce("engaged", ZEALOUS), expect: damageOn("ally", 2) },
  { line: "05043:A:1", name: "Forced when it engages a player not optionally: 2 resources from each hero", layout: { phase: "Encounter", engaged: [BANDIT], heroResources: 3 }, act: announce("engaged", BANDIT), expect: [resourcesOn("dh1", 1), resourcesOn("dh2", 1)] },
  { line: "05044:A:2", name: "Forced when it engages a player not optionally: a hero he chooses is discarded", layout: { phase: "Encounter", engaged: [ASSASSIN] }, act: [announce("engaged", ASSASSIN), answer("dh1")], expect: zone("dh1", "discard") },

  { line: "05045:A:1", name: "When Revealed: engaged Brigands return to the staging area", layout: { engaged: [PICKPOCKET, ZEALOUS, THUG], deck: ["f0", "f0"] }, act: reveal("05045"), expect: [zone(PICKPOCKET, "staging"), zone(ZEALOUS, "staging"), zone(THUG, "engaged"), deckCount(2)] },
  { line: "05045:A:1", name: "No Brigand returned: it gains surge", layout: { engaged: [THUG], deck: ["f0", "f0"] }, act: reveal("05045"), expect: deckCount(1) },
  { line: "05045:A:2", name: "Shadow: return the attacking enemy to the staging area after it attacks", layout: {}, act: attack(PICKPOCKET, { shadow: "05045", undefended: true }), expect: zone(PICKPOCKET, "staging") },

  { line: "05065:B:2", name: "When Revealed: each player searches the encounter deck for a Harbor Thug and adds it to the staging area", layout: { seats: 2, deck: [THUG, "f0", THUG, "f0"] }, act: resolve("05065", "whenRevealed"), expect: count(THUG, "staging", 2) },

  { line: "05067:A:1", name: "When Revealed: each player searches the encounter deck and discard pile for an enemy and adds it to the staging area", layout: { deck: [PICKPOCKET, "f0"], discard: [ZEALOUS] }, act: [resolve("05067", "whenRevealed"), answer(ZEALOUS)], expect: [zone(ZEALOUS, "staging"), zone(PICKPOCKET, "encounterDeck")] },
];

if (ROWS.length > 0) cardSpecs("peril-in-pelargir", ROWS);
else describe("peril-in-pelargir card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
