// Rules: mec108.side-quests, mec108.side-quests-in-play, mec108.time-x, mec108.setup-deadmens-dike, mec108.campaign-setup-deadmens-dike, rr.forced, rr.response, rr.reveal, rr.shadow-effects, rr.travel, rr.player-elimination, rr.effects, rr.then, rr.first-player, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, it } from "vitest";

import { announce, answer, attack, attackersOf, cardSpecs, damageOn, deckCount, endPhase, exhausted, resolve, resourcesOn, reveal, stat, zone, type Row } from "../../../../test/harness/card-spec.ts";

// Card specs for Deadmen's Dike (angmar-awakened part 3): one row for each record whose behaviour needs a game moment (a line id, the table by zone, one action, what must hold afterwards).
// `cardSpecs` runs each row again with the records of its line removed and fails a row that still passes (docs/agents/agent-brief.md, Scenario procedure, Tests). What a row cannot express (a card in a discard pile, a deck count, a cost, a pool entry, a tie)
// is a test titled with its line id in lines.test.ts. The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; every seat starts at threat 28; a layout's current stage is on its B side.
const THAURDIR = "09033";
const SHADE = "09035";
const BATTLEMENTS = "09036";
const KEEP = "09039";
const GATE = "09040";
const DEAD_LORD = "09060";
const CURSED_DEAD = "09061";
const RESTLESS = "09062";
const SEAL = "09063";
const TERROR = "09064";
const DARK_SORCERY = "09065";
const STAGE1 = "09073";
const STAGE2 = "09074";
const DEAD_DECK = ["filler", "filler", "filler", "filler", "filler", "filler"];
// A deck of six, so a discard of five or three leaves a card (no elimination at an empty deck mixes into a row).
const DECK = { deckOf: DEAD_DECK };

// Every row has a deck: a seat with no cards in its deck is eliminated by stages 1B and 2B (09073:B:3, 09074:B:2), and the default stage here is 1B.
const withDeck = (rows: readonly Row[]): readonly Row[] => rows.map((row) => ({ ...row, layout: { deckOf: DEAD_DECK, ...row.layout } }));

const ROWS: readonly Row[] = withDeck([
  { line: "09033:A:3", name: "Forced after a Sorcery treachery is revealed from the encounter deck: Thaurdir heals 3 damage and attacks the first player at once", layout: { stage: STAGE2, staging: [{ code: THAURDIR, damage: 5 }], deck: ["f0"], ...DECK }, act: [reveal(DARK_SORCERY), endPhase], expect: [damageOn(THAURDIR, 2), attackersOf("dh1", [THAURDIR])] },


  { line: "09035:A:1", name: "Forced when it attacks: the defending player discards the top card of his deck and an ally gives it +2 Attack for this attack", layout: { deckOf: ["ally", "filler", "filler", "filler"] }, act: attack(SHADE, { undefended: true }), expect: damageOn("dh1", 4) },
  { line: "09035:A:2", name: "Shadow: exhaust a character you control", layout: { play: ["ally"] }, act: [attack("f3", { shadow: SHADE, undefended: true }), answer("dh2")], expect: exhausted("dh2") },

  { line: "09036:A:1", name: "Time 3: three time counters on it when it is revealed", layout: {}, act: reveal(BATTLEMENTS), expect: resourcesOn(BATTLEMENTS, 3) },
  { line: "09036:A:2", name: "Forced after the last time counter is removed: each player discards the top 5 cards and places 1 time counter here", layout: { seats: 2, staging: [{ code: BATTLEMENTS, resources: 0 }], ...DECK }, act: announce("lastTimeCounterRemoved", BATTLEMENTS), expect: resourcesOn(BATTLEMENTS, 2) },


  { line: "09039:A:2", name: "Shadow: the defending player discards the top card of his deck and the attacker gets +X Attack, X its printed cost (1 for the stand-in ally)", layout: { deckOf: ["ally", "filler", "filler", "filler"] }, act: attack("f3", { shadow: KEEP, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "09040:A:2", name: "Shadow: discard an attachment you control", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: attack("f3", { shadow: GATE, undefended: true }), expect: zone("attachment", "discard") },



  { line: "09060:A:1", name: "Forced after it engages you: the topmost Undead enemy of the encounter discard pile is put into play engaged with you", layout: { phase: "Encounter", engaged: [{ code: DEAD_LORD, seat: 0 }], piles: { encounterDiscard: [CURSED_DEAD] } }, act: announce("engaged", DEAD_LORD), expect: zone(CURSED_DEAD, "engaged") },
  { line: "09060:A:2", name: "Shadow: +1 Attack (the filler enemy's 1 becomes 2)", layout: {}, act: attack("f3", { shadow: DEAD_LORD, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "09061:A:2", name: "Shadow: +1 Attack", layout: {}, act: attack("f3", { shadow: CURSED_DEAD, undefended: true }), expect: damageOn("dh1", 2) },

  { line: "09062:A:1", name: "When Revealed: each Undead enemy in play gets +1 Threat, +1 Attack and +1 Defense until the end of the round", layout: { staging: [DEAD_LORD], deck: ["f0"] }, act: reveal(RESTLESS), expect: [stat(DEAD_LORD, "attack", 5), stat(DEAD_LORD, "defense", 3), stat(DEAD_LORD, "threat", 4)] },
  { line: "09062:A:1", name: "with no Undead enemy in play it gains surge: the next card is revealed too", layout: { deck: ["f0", "f0"] }, act: reveal(RESTLESS), expect: deckCount(1) },
  { line: "09062:A:2", name: "Shadow: each Undead enemy engaged with the defending player gets +1 Attack and +1 Defense until the end of the round", layout: { engaged: [{ code: DEAD_LORD, seat: 0 }] }, act: attack("f3", { shadow: RESTLESS, undefended: true }), expect: [stat(DEAD_LORD, "attack", 5), stat(DEAD_LORD, "defense", 3)] },

  { line: "09063:A:2", name: "Forced at the end of the refresh phase while staged: the top 3 cards of the encounter deck are discarded, then the topmost Undead enemy of the discard pile returns to the staging area", layout: { phase: "Refresh", staging: [SEAL], deck: ["f0", "f0", CURSED_DEAD, "f0"] }, act: announce("endOfPhase"), expect: zone(CURSED_DEAD, "staging") },

  { line: "09064:A:2", name: "Shadow: the defending player discards the top 3 cards of his deck and the attacker gets +1 Attack for each different card type (event and ally: +2)", layout: { deckOf: ["filler", "ally", "event", "filler"] }, act: attack("f3", { shadow: TERROR, undefended: true }), expect: damageOn("dh1", 3) },


  { line: "09073:A:1", name: "Setup: Iârion is put into play under the first player", layout: { setAside: ["09016"] }, act: resolve(STAGE1, "setup"), expect: zone("09016", "play") },
  { line: "09073:B:1", name: "When Revealed: each player searches the encounter deck for a Baleful Shade and puts it into play engaged with him", layout: { deck: ["f0", SHADE] }, act: resolve(STAGE1, "whenRevealed"), expect: zone(SHADE, "engaged") },

  { line: "09074:A:1", name: "When Revealed: Thaurdir is added to the staging area, then 1 encounter card is revealed per player", layout: { stage: STAGE2, setAside: [THAURDIR], deck: ["f0", "f0"] }, act: resolve(STAGE2, "whenRevealed"), expect: [zone(THAURDIR, "staging"), deckCount(1)] },


  { line: "10166:A:2", name: "Setup: Iârion's Pendant is attached to Iârion and Protect the Innocent is added to the staging area", layout: { campaign: true, setAside: ["09016"] }, act: resolve("10166", "campaignSetup"), expect: zone("10158", "staging") },
]);

if (ROWS.length > 0) cardSpecs("deadmens-dike", ROWS);
else describe("deadmens-dike card specs", () => it.todo("a row for each record whose behaviour needs a game moment"));
