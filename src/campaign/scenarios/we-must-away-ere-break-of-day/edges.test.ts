// Rules: rr.then, rr.forced, rr.response, rr.shadow-effects, rr.in-play-and-out-of-play, rr.triggered-ability, rr.reveal, rr.doomed-x, rr.explored, hob.sack-x, hob.bilbo-baggins-ohauh (data/rules/entries.json); ledger lines 131023:A:1, 131024:B:1, 131024:B:2, 131032:A:3, 131033:A:3, 131034:A:3, 131036:A:1, 131036:A:2, 131038:A:1, 131038:A:2, 131041:A:1, 131042:A:1, 131051:A:1, 131051:A:2, 131052:A:2, 131053:A:1, 131054:A:1, 131054:A:2.
import { expect, it } from "vitest";

import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

import { EFFECTS } from "../../../effects/index.ts";
import { answer, attack, announce, cardSpecs, count, damageOn, deckCount, flag, handCount, offers, progressOn, quest, resolve, respond, reveal, stat, threat, zone, rowProblems, type Row } from "../../../../test/harness/card-spec.ts";

// The second pass over the scenario's lines (docs/agents/card-audit.md, Tests from the printed line): the two-player cases, the false case of each condition and the "in play" and "then" readings of docs/agents/effect-authoring.md (Readings the review catches).
// `ROWS` hold a result that fails without the line's records, as every card-spec row does; `FALSE` hold what the line leaves alone, which a table without the records leaves alone too, so they run on every record only.
const ID = "we-must-away-ere-break-of-day";
const B = { stage: "131024", side: "B" } as const;

const ROWS: readonly Row[] = [
  // 131023:A:1 each player reveals 1 card: two players, two cards.
  { line: "131023:A:1", name: "with two players each player reveals a card (two cards join the staging area)", layout: { stage: "131023", side: "A", seats: 2, setAside: ["131044"], deck: ["f0", "f0", "f0"] }, act: resolve("131023", "setup"), expect: [count("f0", "staging", 2), deckCount(1)] },
  // 131024:B:2 progress with no active location: the whole of it is discarded from the deck, none placed on the quest.
  { line: "131024:B:2", name: "with no active location all the progress is discarded from the encounter deck instead", layout: { ...B, deck: ["f0", "f0", "f0", "f0", "f0", "f0", "f0"], engaged: ["131032"], phase: "Quest" }, act: quest("success"), expect: [progressOn("131024", 0), deckCount(2), count("f0", "encounterDiscard", 4)] },
  // 131032:A:3, 131033:A:3, 131034:A:3: the engaged player pays, whoever the first player is.
  ...["131032", "131033", "131034"].flatMap((code): Row[] => [
    { line: `${code}:A:3`, name: "the player the Troll is engaged with (the second one) raises his own threat by 1 to cancel it", layout: { seats: 2, engaged: [{ code, seat: 1 }], phase: "Combat", threat: [30, 30] }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("raise")], expect: [zone(code, "engaged"), threat(30, 0), threat(31, 1)] },
    { line: `${code}:A:3`, name: "the second player's Troll that is not canceled returns to the staging area and no threat is raised by the effect (only the round's own +1)", layout: { seats: 2, engaged: [{ code, seat: 1 }], phase: "Combat", threat: [30, 30] }, act: [announce("endOfPhase", undefined, { phase: "Combat" }), answer("return")], expect: [zone(code, "staging"), threat(31, 0), threat(31, 1)] },
  ]),
  // 131036:A:1 one Threat for each player in the game: one player, one; the bonus is for Trolls only.
  { line: "131036:A:1", name: "with one player the Troll enemies get +1 Threat and another enemy gets none", layout: { staging: ["131036", "131032", "f3"] }, act: [], expect: [stat("131032", "threat", 4), stat("f3", "threat", 3)] },
  // 131038:A:1: the first player draws, not the player who quested (second seat first player).
  { line: "131038:A:1", name: "with two players the first player (the second seat) draws the card and the other does not", layout: { seats: 2, firstPlayer: 1, active: "131038", deckOf: ["f0", "f0"], phase: "Quest" }, act: [quest("success"), respond("131038")], expect: [handCount(1, 1), handCount(0, 0)] },
  // 131051:A:1: two players, Doomed 2 raises each player's threat; a Troll that is engaged is not in the staging area.
  { line: "131051:A:1", name: "with two players and no Troll in the staging area Doomed 2 raises both players' threat by 2", layout: { seats: 2, staging: ["f3"], piles: { sackDeck: ["131045"] }, threat: [30, 30] }, act: reveal("131051"), expect: [threat(32, 0), threat(32, 1), count("131045", "sackDeck", 1)] },
  { line: "131051:A:1", name: "a Troll enemy engaged with a player is not in the staging area, so the card gains Doomed 2", layout: { engaged: ["131032"], staging: ["f3"], piles: { sackDeck: ["131045"] } }, act: reveal("131051"), expect: [threat(30), count("131045", "sackDeck", 1)] },
  // 131052:A:2: X is twice the number of players.
  { line: "131052:A:2", name: "with two players four cards go from the discard pile to the bottom of the deck", layout: { seats: 2, discard: ["f0", "f3", "f3", "f3", "f3"], deck: ["f0"] }, act: resolve("131052", "whenRevealed"), expect: [deckCount(5), count("f3", "encounterDiscard", 0), count("f0", "encounterDiscard", 1)] },
  // 131053:A:1: "in play" reads the staging area only for the Troll; every ally of every player is dealt the damage.
  { line: "131053:A:1", name: "a Troll enemy engaged with a player is not in the staging area, so each ally takes 1 damage", layout: { play: ["ally"], engaged: ["131032"] }, act: resolve("131053", "whenRevealed"), expect: [damageOn("ally", 1)] },
  { line: "131053:A:1", name: "with two players the ally of the second player takes the damage too (2 with a Troll in the staging area)", layout: { seats: 2, play: [{ code: "ally", seat: 1 }], staging: ["131032"] }, act: resolve("131053", "whenRevealed"), expect: [damageOn("ally", 2)] },
  // 131054:A:1: a Troll that is only engaged leaves the staging area empty of Trolls, so the card gains Surge.
  { line: "131054:A:1", name: "a Troll enemy engaged with a player is not in the staging area, so the card gains Surge", layout: { engaged: ["131032"], staging: ["f3"], deck: ["f0", "f0"] }, act: reveal("131054"), expect: [zone("f0", "staging"), deckCount(1), zone("131032", "engaged")] },
  // 131045:A:1 "without a Sack attached": the tied hero already holding a Sack is passed over, so the other takes it with no choice.
  { line: "131045:A:1", name: "a hero already holding a Sack is passed over, so the other tied hero takes it", layout: { engaged: ["131033"], piles: { sackDeck: ["131045"] }, attached: [{ code: "131046", to: "dh1", encounter: true }] }, act: announce("engaged", "131033", { seat: 0 }), expect: [zone("131045", "attached"), flag("dh2", "cannotAttack")] },
  // 131042:A:1 a Purse in the staging area attaches to a Troll enemy.
  { line: "131042:A:1", name: "an unattached Purse in the staging area attaches to a Troll enemy in play", layout: { staging: ["131042", "131032"] }, act: announce("addedToStaging", "131042"), expect: [zone("131042", "attached")] },
];

cardSpecs(ID, ROWS);

const FALSE: readonly Row[] = [
  { line: "131037:A:2", name: "the players cannot travel to Troll Cave with the Troll Purse attached and no Troll Key", layout: { phase: "Travel", staging: ["131037"], sagaHero: { resources: 5 }, attached: [{ code: "131042", to: "131001" }] }, act: [], expect: [offers("Travel", undefined, false)] },
  { line: "131042:A:1", name: "an unattached Purse in the staging area stays there while no Troll enemy is in play", layout: { staging: ["131042", "f3"] }, act: announce("addedToStaging", "131042"), expect: [zone("131042", "staging")] },
  { line: "131036:A:2", name: "Action: not offered when no character holds a Sack card", layout: { staging: ["131036"], sagaHero: { resources: 3 } }, act: [], expect: [offers("Trigger", "131036", false)] },
  { line: "131036:A:2", name: "Action: not offered when Troll Camp is not in play (in the discard pile)", layout: { discard: ["131036"], sagaHero: { resources: 3 }, attached: [{ code: "131045", to: "dh1", encounter: true }] }, act: [], expect: [offers("Trigger", "131036", false)] },
  { line: "131024:B:1", name: "no advance while a Troll enemy stays in play in the staging area (one player)", layout: { ...B, victory: ["131032"], staging: ["131033"], deck: ["f0"] }, act: announce("enemyDestroyed", "131032"), expect: [zone("131024", "questStage")] },
  { line: "131024:B:1", name: "no advance while a Troll enemy stays in play engaged (two players)", layout: { ...B, seats: 2, victory: ["131032"], engaged: [{ code: "131033", seat: 1 }], deck: ["f0"] }, act: announce("enemyDestroyed", "131032"), expect: [zone("131024", "questStage")] },
  { line: "131036:A:1", name: "an active Troll Camp (not in the staging area) gives no bonus", layout: { active: "131036", staging: ["131032"] }, act: [], expect: [stat("131032", "threat", 3)] },
  { line: "131038:A:2", name: "Shadow: with the discard pile empty nothing moves", layout: { deck: ["f0", "f0", "f0"] }, act: attack("f3", { shadow: "131038", undefended: true }), expect: [deckCount(3)] },
  { line: "131051:A:2", name: "Shadow: an attacker that is not a Troll gives no Sack", layout: { sagaHero: { resources: 2 }, piles: { sackDeck: ["131045"] }, engaged: ["f3"] }, act: attack("f3", { shadow: "131051", undefended: true }), expect: [count("131045", "sackDeck", 1)] },
  { line: "131052:A:2", name: "with an empty discard pile no card moves", layout: { discard: [], deck: ["f0"] }, act: resolve("131052", "whenRevealed"), expect: [deckCount(1)] },
  { line: "131054:A:2", name: "Shadow: with no Sack card attached nobody takes damage", layout: { sagaHero: { resources: 0 }, engaged: ["131032"] }, act: attack("131032", { shadow: "131054", undefended: true }), expect: [damageOn("dh2", 0)] },
];
for (const row of FALSE) it(`${row.line} ${row.name}`, () => expect(rowProblems(ID, row, EFFECTS), row.name).toEqual([]));

// 131049:A:1 "(excluding Gandalf)": Gandalf holding the most attachments does not take the Sack, the other hero does. 131054:A:1: the first player (the second seat) engages the Troll.
it("131049:A:1 a hero titled Gandalf with the most attachments is passed over", () => {
  const table = tableFromLayout(ID, { engaged: ["131033"], piles: { sackDeck: ["131049"] }, attached: [{ code: "attachment", to: "dh2" }] }, { effects: EFFECTS, extra: ["142002"] });
  const gandalf = spawn(table.state, "142002", { zone: "heroes", seat: 0 });
  let state = gandalf.state;
  for (let n = 0; n < 2; n += 1) {
    const extra = spawn(state, "attachment", { zone: "play", seat: 0 });
    state = attachTo(extra.state, extra.id, gandalf.id);
  }
  state = updateCard(state, gandalf.id, {});
  const done = resolveRecords(state, table.ctx, "131033", "forced", idOf(state, "131033"));
  expect(done.state.cards[idOf(done.state, "dh2")]?.attachments).toContain(idOf(done.state, "131049"));
  expect(done.state.cards[gandalf.id]?.attachments.includes(idOf(done.state, "131049"))).toBe(false);
});

it("131054:A:1 with two players the first player (the second seat) engages the Troll he chooses", () => {
  const table = tableFromLayout(ID, { seats: 2, firstPlayer: 1, staging: ["131032"], deck: ["f0", "f0"] }, { effects: EFFECTS });
  const done = resolveRecords(table.state, table.ctx, "131054", "whenRevealed");
  const troll = done.state.cards[idOf(done.state, "131032")];
  expect(troll?.zone).toBe("engaged");
  expect(troll?.controller).toBe(1);
});
