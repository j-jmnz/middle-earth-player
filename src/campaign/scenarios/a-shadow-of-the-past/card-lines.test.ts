// Rules: rr.shadow-effects, rr.reveal, rr.attachment-cards, rr.engaged, rr.first-player, faq.next-player, faq.additional-attacks, mec109.saga-staging-rules (data/rules/entries.json).
import { describe, it } from "vitest";

import { answer, attack, attackersOf, cardSpecs, count, damageOn, deckCount, defend, endRound, resolve, reveal, stat, threat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for A Shadow of the Past's encounter cards: the lines one row can show (a reveal with no Hide test, a Shadow, a constant). The Hide tests, the second player and the Setups are in card-lines-hide.test.ts,
// card-lines-shadow.test.ts and card-lines-setup.test.ts. `cardSpecs` runs each row again without the records of its line and fails a row that still passes. The stand-in heroes dh1 and dh2 have 2 Willpower,
// 2 Attack, 2 Defense, 6 hit points; the stand-in enemy f0 has 1 Attack and 0 Threat.

const ROWS: readonly Row[] = [
  // 141022 Three is Company: "Setup: Set Bucklebury Ferry aside, out of play. Add 1 Black Rider to the staging area and make Bag End the active location. Shuffle the encounter deck."
  { line: "141022:A:1", name: "Bucklebury Ferry is set aside, 1 Black Rider is staged and Bag End is the active location", layout: { stage: "141022", side: "A", deck: ["f0", "f3", "141039"] }, act: resolve("141022", "setup"), expect: [zone("141035", "setAside"), count("141039", "staging", 1), zone("141031", "activeLocation")] },
  // 141033 Stock-Brook: "When Revealed: Immediately travel to Stock-brook. If another location is currently active, return it to the staging area."
  { line: "141033:A:1", name: "it becomes the active location and the active one returns to the staging area", layout: { active: "place", deck: ["f0"] }, act: reveal("141033"), expect: [zone("141033", "activeLocation"), zone("place", "staging")] },
  { line: "141033:A:1", name: "with no active location it becomes the active location", layout: { deck: ["f0"] }, act: reveal("141033"), expect: zone("141033", "activeLocation") },

  // 141072 Pathless Country: "Pathless Country gets +4 quest points while in the staging area." (printed 3)
  { line: "141072:A:1", name: "it has 7 quest points in the staging area", layout: { staging: ["141072"] }, act: [], expect: stat("141072", "questPoints", 7) },

  // 141074 Black Steed: "Attach to a Nazgûl enemy in play, if able. (... Attached enemy gets -10 engagement cost ...)"; Surge is its keyword.
  { line: "141074:A:2", name: "it attaches to the engaged Nazgûl enemy", layout: { engaged: ["141039"], deck: ["f0", "f0"] }, act: reveal("141074"), expect: zone("141074", "attached") },
  { line: "141074:A:2", name: "the attached Black Rider has engagement cost 25", layout: { staging: ["141039"], attached: [{ code: "141074", to: "141039" }] }, act: [], expect: stat("141039", "engagementCost", 25) },
  // "Forced: At the end of the refresh phase, return attached enemy to the staging area."
  { line: "141074:A:2", name: "the attached enemy returns to the staging area at the end of the refresh phase", layout: { phase: "Combat", engaged: ["141039"], attached: [{ code: "141074", to: "141039" }], deck: ["f0", "f0"] }, act: endRound, expect: zone("141039", "staging") },

  // 141075 Rode Like a Gale: "Return each engaged Nazgûl enemy to the staging area. If no enemies were returned ..., Rode Like a Gale gains surge."
  { line: "141075:A:1", name: "the engaged Nazgûl returns to the staging area and no card surges", layout: { engaged: ["141039"], deck: ["f0"] }, act: reveal("141075"), expect: [zone("141039", "staging"), deckCount(1)] },
  { line: "141075:A:1", name: "an engaged enemy that is not a Nazgûl stays engaged, and with nothing returned it gains surge", layout: { engaged: ["f3"], deck: ["f0"] }, act: reveal("141075"), expect: [zone("f3", "engaged"), zone("f0", "staging")] },

  // 141073 Piercing Cry: "Search the encounter deck and discard pile for a Nazgûl enemy. Either add it to the staging area or put it into play engaged with the first player."
  { line: "141073:A:2", name: "a Black Rider from the discard pile is added to the staging area", layout: { discard: ["141039"], deck: ["f0"] }, act: [reveal("141073"), answer("staging")], expect: zone("141039", "staging") },
  { line: "141073:A:2", name: "a Black Rider from the encounter deck is put into play engaged with the first player", layout: { deck: ["f0", "141039"] }, act: [reveal("141073"), answer("engage")], expect: zone("141039", "engaged") },

  // 141077 Gildor Inglorion: "The first player gains control of Gildor Inglorion."
  { line: "141077:A:1", name: "the first player gains control of it", layout: { deck: ["f0"] }, act: reveal("141077"), expect: zone("141077", "play") },

  // 141043 Have You Seen Baggins?: "When Revealed: Attach to a hero." Surge is its keyword.
  { line: "141043:A:2", name: "it attaches to the hero the first player chooses", layout: { deck: ["f0", "f0"] }, act: [reveal("141043"), answer("dh2")], expect: zone("141043", "attached") },

  // Shadows that add Attack (f0 attacks for 1; the attack is undefended, so all of it lands on dh1).
  // 141036 Green Hill Country, 141038 The Marish: "Attacking enemy gets +1 Attack (+2 Attack instead if ... failed a Hide test this round)."
  { line: "141036:A:2", name: "the attacking enemy gets +1 Attack", layout: {}, act: attack("f0", { shadow: "141036", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "141038:A:2", name: "the attacking enemy gets +1 Attack", layout: {}, act: attack("f0", { shadow: "141038", undefended: true }), expect: damageOn("dh1", 2) },
  // 906106 Stock Woods: "Attacking enemy gets +2 Attack (+3 Attack instead if you have failed a Hide test this round)."
  { line: "906106:A:3", name: "the attacking enemy gets +2 Attack", layout: {}, act: attack("f0", { shadow: "906106", undefended: true }), expect: damageOn("dh1", 3) },
  // 906109 Sniffing and Hissing: "Attacking enemy gets +2 Attack. If this attack destroys a character, raise your threat by 3."
  { line: "906109:A:3", name: "the attacking enemy gets +2 Attack", layout: {}, act: attack("f0", { shadow: "906109", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "906109:A:3", name: "the attack destroys the defending ally, so the defending player raises his threat by 3", layout: { play: ["ally"] }, act: [attack("f0", { shadow: "906109" }), defend("ally")], expect: [zone("ally", "discard"), threat(31)] },

  // 141041 Crawling Towards Him, 141075 Rode Like a Gale: "Shadow: Return attacking enemy to the staging area after this attack."
  { line: "141041:A:3", name: "the attacking enemy returns to the staging area after the attack", layout: {}, act: [attack("f0", { shadow: "141041" }), defend("dh1")], expect: zone("f0", "staging") },
  { line: "141075:A:2", name: "the attacking enemy returns to the staging area after the attack", layout: {}, act: [attack("f0", { shadow: "141075" }), defend("dh1")], expect: zone("f0", "staging") },

  // 141073 Piercing Cry: "Shadow: Attacking enemy makes an additional attack after this one." Both attacks are undefended and land on dh1.
  { line: "141073:A:3", name: "the attacking enemy attacks a second time", layout: {}, act: attack("f0", { shadow: "141073", undefended: true }), expect: [attackersOf("dh1", ["f0", "f0"]), damageOn("dh1", 2)] },

  // 141072 Pathless Country, 906105 Green-Hill Country: "After this attack, the attacking enemy engages the next player then makes an immediate attack." The second seat's hero dh3 takes the undefended attack.
  { line: "141072:A:2", name: "the attacking enemy engages the second player and attacks him", layout: { seats: 2 }, act: [attack("f0", { shadow: "141072" }), defend("dh1")], expect: [attackersOf("dh3", ["f0"]), damageOn("dh3", 1)] },
  { line: "906105:A:3", name: "the attacking enemy engages the second player and attacks him", layout: { seats: 2 }, act: [attack("f0", { shadow: "906105" }), defend("dh1")], expect: [attackersOf("dh3", ["f0"]), damageOn("dh3", 1)] },
];

if (ROWS.length > 0) cardSpecs("a-shadow-of-the-past", ROWS);
else describe("a-shadow-of-the-past card specs", () => it.todo("a row for each line one moment shows"));
