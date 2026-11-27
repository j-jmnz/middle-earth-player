// Rules: hrd.heat-tracker, hrd.setup-desert-crossing, hrd.side-quests, hrd.side-quests-in-play, hrd.guarded-x, rr.forced, rr.response, rr.cannot, rr.modifiers, rr.blank, rr.exhausted, faq.triggering-forced-effects, faq.side-quest-current-quest-text (data/rules/entries.json).
// An audit of Desert Crossing (card-audit): each test is built from the printed words, the rule spans and the readings of docs/scenarios/haradrim/desert-crossing.md, on the smallest table of the scene kit, and runs again without its line's records and must fail there.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { temperatureOf } from "../../../rules/families/haradrim/heat.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { playedLayout } from "../../../../test/harness/card-spec-play.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { stagingThreat as stagingThreatOf } from "../../../rules/quest/quest.ts";
import { drive, engagedCodes, finish, idOf, idsOf, legalIntents, opened, send, statOf, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { answer, attack, cardSpecs, count, counter, damageOn, deckCount, endRound, exhausted, handCount, lost, quest, resolve, reveal, zone, type Row } from "../../../../test/harness/card-spec.ts";

const SID = "desert-crossing";
const DESERT = "16068";
const SUN = "16069";
const BEASTS = "16070";
const BURNT = "16025";
const WORM = "16028";

const rows: Row[] = [
  // The Burnt Sands of the Setup line are dealt by the scenario's piles (no record), so the line's record is tested on the temperature.
  { line: "16068:A:1", name: "the Setup sets the temperature to 10", layout: { seats: 2, stage: DESERT, side: "A" }, act: resolve(DESERT, "setup"), expect: counter("temperature", 10) },
  // The end of the round: the temperature rises by 4, read at its end.
  { line: "16068:B:2", name: "the temperature rises by 4 at the end of the round", layout: { stage: DESERT, temperature: 10, deck: ["f0", "f0", "f0"] }, act: endRound, expect: counter("temperature", 14) },
  { line: "16068:B:2", name: "two players: it rises by 4 once, not for each player", layout: { seats: 2, stage: DESERT, temperature: 10, deck: ["f0", "f0", "f0"] }, act: endRound, expect: counter("temperature", 14) },
  { line: "16069:B:1", name: "the temperature rises by 4 at the end of the round", layout: { stage: SUN, temperature: 10, deck: ["f0", "f0", "f0"] }, act: endRound, expect: counter("temperature", 14) },
  { line: "16069:B:1", name: "then each player assigns X damage, X the tens digit after the rise (36 to 40: 4 damage, not 3)", layout: { seats: 2, stage: SUN, temperature: 36, deck: ["f0", "f0", "f0"] }, act: endRound, expect: [counter("temperature", 40), damageOn("dh3", 4)] },
  { line: "16069:B:1", name: "the damage of one player is X in all among his characters", layout: { stage: SUN, temperature: 26, deck: ["f0", "f0", "f0"] }, act: endRound, expect: [counter("temperature", 30), damageOn("dh1", 3), damageOn("dh2", 0)] },
  { line: "16069:B:1", name: "a rise that reaches 60 loses before any damage is assigned", layout: { stage: SUN, temperature: 56, deck: ["f0", "f0", "f0"] }, act: endRound, expect: [lost, damageOn("dh1", 0), damageOn("dh2", 0)] },
  { line: "16070:B:2", name: "the temperature rises by 4 at the end of the round", layout: { stage: BEASTS, temperature: 10, deck: ["f0", "f0", "f0"] }, act: endRound, expect: counter("temperature", 14) },
  // The loss at 60 or higher, as soon as the value is reached.
  { line: "16068:B:3", name: "the players lose when the temperature reaches 60", layout: { stage: DESERT, temperature: 56, deck: ["f0", "f0", "f0"] }, act: endRound, expect: [counter("temperature", 60), lost] },
  { line: "16069:B:2", name: "the players lose when the temperature reaches 60", layout: { stage: SUN, temperature: 56, deck: ["f0", "f0", "f0"] }, act: endRound, expect: [counter("temperature", 60), lost] },
  { line: "16070:B:3", name: "the players lose when the temperature reaches 60", layout: { stage: BEASTS, temperature: 56, deck: ["f0", "f0", "f0"] }, act: endRound, expect: [counter("temperature", 60), lost] },
  // The stages' own When Revealed.
  { line: "16069:A:1", name: "the temperature rises by 2; the discard pile is shuffled into the deck (even with cards in it) and one card is revealed", layout: { stage: SUN, side: "A", temperature: 10, deck: ["f3"], discard: ["f0", "f0"] }, act: resolve(SUN, "whenRevealed"), expect: [counter("temperature", 12), deckCount(2), count("f0", "encounterDiscard", 0)] },
  { line: "16069:A:1", name: "one encounter card is revealed for each of two players, one at a time", layout: { seats: 2, stage: SUN, side: "A", temperature: 10, deck: [], discard: ["f0", "f0", "f0"] }, act: resolve(SUN, "whenRevealed"), expect: [counter("temperature", 12), count("f0", "staging", 2), deckCount(1)] },
  { line: "16069:A:1", name: "a rise to 60 in the stage's own When Revealed loses the game at once", layout: { stage: SUN, side: "A", temperature: 58, deck: ["f0", "f0"] }, act: resolve(SUN, "whenRevealed"), expect: [counter("temperature", 60), lost] },
  { line: "16070:A:1", name: "the temperature rises by 2 and each of two players adds a Were-worm from the deck, the discard pile or the victory display (not revealed)", layout: { seats: 2, stage: BEASTS, side: "A", temperature: 10, deck: [WORM, "f0"], discard: [WORM], victory: [WORM] }, act: resolve(BEASTS, "whenRevealed"), expect: [counter("temperature", 12), count(WORM, "staging", 2)] },
  { line: "16070:A:1", name: "one player adds one Were-worm only, and a Were-worm already in the staging area is not the one he finds", layout: { stage: BEASTS, side: "A", temperature: 10, staging: [WORM], deck: [WORM, WORM] }, act: resolve(BEASTS, "whenRevealed"), expect: [counter("temperature", 12), count(WORM, "staging", 2), count(WORM, "encounterDeck", 1)] },
  { line: "16070:A:1", name: "a player who finds no Were-worm adds none", layout: { seats: 2, stage: BEASTS, side: "A", temperature: 10, deck: ["f0"], discard: [WORM] }, act: resolve(BEASTS, "whenRevealed"), expect: [counter("temperature", 12), count(WORM, "staging", 1)] },
  { line: "16070:A:1", name: "a rise to 60 loses the game", layout: { stage: BEASTS, side: "A", temperature: 58, deck: [WORM] }, act: resolve(BEASTS, "whenRevealed"), expect: [lost] },
  // The encounter deck's treacheries and the shadows.
  { line: "16022:A:1", name: "the active location is discarded, the discard pile is shuffled in, and the first location discarded becomes active with its Forced firing", layout: { active: BURNT, temperature: 10, discard: ["f0", "f0"] }, act: reveal("16022"), expect: [zone(BURNT, "activeLocation"), counter("temperature", 12)] },
  { line: "16022:A:1", name: "with no active location the first step does nothing and the first location of the deck becomes active", layout: { temperature: 10, deck: ["f0", BURNT] }, act: reveal("16022"), expect: [zone(BURNT, "activeLocation"), counter("temperature", 12)] },
  { line: "16029:A:1", name: "each of two players assigns X damage among his characters, X the tens digit", layout: { seats: 2, temperature: 30 }, act: reveal("16029"), expect: [damageOn("dh1", 3), damageOn("dh3", 3)] },
  { line: "16029:A:2", name: "shadow: the attacking enemy gets +X Attack (f0: 1 + 3 damage on the undefended hero)", layout: { temperature: 30 }, act: attack("f0", { shadow: "16029", undefended: true }), expect: damageOn("dh1", 4) },
  { line: "16030:A:2", name: "When Revealed: the temperature rises by 4", layout: { temperature: 10, deck: ["f0"] }, act: reveal("16030"), expect: counter("temperature", 14) },
  { line: "16030:A:2", name: "When Revealed: a rise to 60 loses the game", layout: { temperature: 56, deck: ["f0"] }, act: reveal("16030"), expect: lost },
  { line: "16030:A:3", name: "shadow, first option: the temperature rises by 2 and the enemy stays engaged", layout: { temperature: 10 }, act: [attack("f0", { shadow: "16030", undefended: true }), answer("temperature")], expect: [counter("temperature", 12), zone("f0", "engaged")] },
  { line: "16030:A:3", name: "shadow, second option: the enemy returns to the staging area after the attack and the temperature stays", layout: { temperature: 10 }, act: [attack("f0", { shadow: "16030", undefended: true }), answer("return")], expect: [counter("temperature", 10), zone("f0", "staging"), damageOn("dh1", 1)] },
  { line: "16051:A:1", name: "each of two players discards his hand or assigns X damage, X the cards in his hand", layout: { seats: 2, hand: [{ code: "filler", seat: 0 }, { code: "filler", seat: 0 }, { code: "filler", seat: 1 }, { code: "filler", seat: 1 }, { code: "filler", seat: 1 }] }, act: [reveal("16051"), answer("discard"), answer("damage")], expect: [handCount(0, 0), handCount(3, 1), damageOn("dh3", 3), damageOn("dh1", 0)] },
  { line: "16052:A:1", name: "each of two players exhausts a ready character he controls and deals 1 damage to that character", layout: { seats: 2 }, act: reveal("16052"), expect: [exhausted("dh1"), damageOn("dh1", 1), exhausted("dh3"), damageOn("dh3", 1), exhausted("dh2", false), damageOn("dh2", 0)] },
  { line: "16052:A:1", name: "an exhausted character cannot be the one chosen: the damage goes to the ready one", layout: { exhaustedCards: ["dh1"] }, act: reveal("16052"), expect: [exhausted("dh2"), damageOn("dh2", 1), damageOn("dh1", 0)] },
  { line: "16052:A:2", name: "shadow: the defending player exhausts a ready character he controls ", layout: {}, act: attack("f0", { shadow: "16052", undefended: true }), expect: [exhausted("dh1"), exhausted("dh2", false)] },
  { line: "16051:A:1", name: "a player with no cards in hand takes either option at no cost; the other player's hand decides his damage", layout: { seats: 2, hand: [{ code: "filler", seat: 1 }, { code: "filler", seat: 1 }] }, act: [reveal("16051"), answer("damage"), answer("damage")], expect: [damageOn("dh1", 0), damageOn("dh2", 0), damageOn("dh3", 2), handCount(2, 1)] },
  // ROWS-END
];

cardSpecs(SID, rows);

/**
 * A side quest in the staging area is defeated on its real moment: the round ends, the first player chooses it as the current quest at the start of the next quest phase, and the quest
 * (two heroes of willpower 2 each) puts its progress on it. `layout` adds to the table (the temperature it starts the round with, a second player).
 */
function defeatedSideQuest(effects: readonly Effect[], side: string, layout: Layout): { state: ScenarioState } {
  const ended = playedLayout(SID, { stage: DESERT, staging: [{ code: side, progress: 2 }], deck: ["f0", "f0", "f0", "f0", "f0", "f0"], ...layout }, endRound, effects);
  const asked = drive(ended.table, ended.run, (state) => state.window?.kind === "choose" && state.phase === "Quest");
  if (asked.state.window?.kind !== "choose") throw new Error(`the first player is not asked for the current quest: ${asked.state.phase} ${asked.state.window?.kind}`);
  const chosen = send(asked, { type: "Choose", optionId: idOf(asked.state, side) }, ended.table.ctx);
  // Each player commits his heroes in turn (the seat the window waits for) and passes.
  let committed = chosen;
  for (let seat = 0; seat < (layout.seats ?? 1); seat += 1) {
    committed = send(committed, { type: "Commit", cardIds: [...(committed.state.seats[committed.state.activeSeat]?.heroes ?? [])] }, ended.table.ctx);
    committed = send(committed, { type: "Pass" }, ended.table.ctx);
  }
  // The Response of the side quest is offered once it is defeated; the first player uses it.
  const offered = (state: ScenarioState): boolean => legalIntents(state, ended.table.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, side));
  const defeated = drive(ended.table, committed, (state) => offered(state) || state.phase !== "Quest");
  expect(offered(defeated.state), `${side} offers its Response`).toBe(true);
  const trigger = legalIntents(defeated.state, ended.table.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(defeated.state, side));
  const used = send(defeated, trigger as never, ended.table.ctx);
  return { state: drive(ended.table, used, (state) => state.phase !== "Quest").state };
}

describe("16023 Seek Shade", () => {
  lineSpec("16023:A:3", "defeated, it reduces the temperature by 10 (30 to 20, the +4 of the round before it)", (effects) => {
    const { state } = defeatedSideQuest(effects, "16023", { temperature: 30 });
    expect(zoneOf(state, "16023")).toBe("victory");
    expect(temperatureOf(state)).toBe(24);
  });
  lineSpec("16023:A:3", "the temperature does not go below 0 (3 plus the 4 of the round is 7, minus 10 is 0)", (effects) => {
    const { state } = defeatedSideQuest(effects, "16023", { temperature: 3 });
    expect(zoneOf(state, "16023")).toBe("victory");
    expect(temperatureOf(state)).toBe(0);
  });
});

type Made = ReturnType<typeof tableFromLayout>;
const make = (effects: readonly Effect[], layout: Layout, extra: readonly string[] = []): Made => tableFromLayout(SID, layout, { effects, extra });
const played = (effects: readonly Effect[], layout: Layout, act: Parameters<typeof playedLayout>[2]): ScenarioState => playedLayout(SID, layout, act, effects).run.state;
const damageOf = (state: ScenarioState, code: string): number => idsOf(state, code).reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);
const threatOf = (made: Made): number => stagingThreatOf(made.state, made.cards);

describe("16068:B:1 an ally enters play", () => {
  /** The first player plays an ally from the hand in the planning phase and answers the choice the stage opens with the option `option`. */
  function allyPlayed(effects: readonly Effect[], option: string, layout: Layout = {}): ScenarioState {
    const made = make(effects, { phase: "Planning", stage: DESERT, hand: ["ally"], heroResources: 1, ...layout });
    const intent = legalIntents(made.state, made.ctx).find((offered) => offered.type === "PlayCard" && offered.cardId === idOf(made.state, "ally"));
    expect(intent, "the ally can be played").toBeDefined();
    const sent = send(opened(made), { type: "PlayCard", cardId: idOf(made.state, "ally"), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
    return finish(sent, made.ctx, () => option).state;
  }
  lineSpec("16068:B:1", "the ally's controller exhausts it", (effects) => {
    const state = allyPlayed(effects, "exhaust");
    expect(state.cards[idOf(state, "ally")]?.exhausted).toBe(true);
    expect(damageOf(state, "ally")).toBe(0);
  });
  lineSpec("16068:B:1", "or deals 1 damage to it, and it stays ready", (effects) => {
    const state = allyPlayed(effects, "damage");
    expect(damageOf(state, "ally")).toBe(1);
    expect(state.cards[idOf(state, "ally")]?.exhausted).toBe(false);
  });
  lineSpec("16068:B:1", "two players: the first player's ally still opens the choice; a card that is no ally opens none", (effects) => {
    const state = allyPlayed(effects, "exhaust", { seats: 2 });
    expect(state.cards[idOf(state, "ally")]?.exhausted).toBe(true);
    const made = make(effects, { phase: "Planning", stage: DESERT, hand: ["attachment"], heroResources: 0 });
    const sent = send(opened(made), { type: "PlayCard", cardId: idOf(made.state, "attachment"), payments: [], hostId: made.hero }, made.ctx);
    expect(sent.state.window?.kind).not.toBe("choose");
    expect(damageOf(sent.state, "dh1")).toBe(0);
  });
});

describe("16070:B:1 and 16070:B:3 Beasts of Legend", () => {
  lineSpec("16070:B:1", "in the quest phase X, the tens digit read live, is added once to the total Threat in the staging area", (effects) => {
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 30, staging: ["f3"] }))).toBe(6);
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 39, staging: ["f3"] }))).toBe(6);
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 40, staging: ["f3"] }))).toBe(7);
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 30, staging: ["f3", "f3"] }))).toBe(9);
    expect(threatOf(make(effects, { seats: 2, stage: BEASTS, temperature: 30, staging: ["f3"] }))).toBe(6);
  });
  lineSpec("16070:B:1", "outside the quest phase nothing is added", (effects) => {
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 30, staging: ["f3"], phase: "Quest" }))).toBe(6);
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 30, staging: ["f3"], phase: "Encounter" }))).toBe(3);
    expect(threatOf(make(effects, { stage: BEASTS, temperature: 30, staging: ["f3"], phase: "Combat" }))).toBe(3);
  });
});

describe("16070:B:3 the last stage", () => {
  const full: Layout = { stage: BEASTS, progress: 14, temperature: 0, deck: ["f0", "f0"] };
  lineSpec("16070:B:3", "while a Were-worm is in play the stage is not defeated by the quest, and with none it is defeated and the players win", (effects) => {
    const withWorm = played(effects, { ...full, staging: [WORM] }, quest("success"));
    expect(withWorm.stageCleared).toBe(false);
    expect(withWorm.lost).toBe(false);
    const without = played(effects, { ...full, staging: ["f0"] }, quest("success"));
    expect(without.stageCleared).toBe(true);
  });
  lineSpec("16070:B:3", "a Were-worm engaged with a player also holds the stage; two players", (effects) => {
    const engaged = played(effects, { ...full, seats: 2, engaged: [{ code: WORM, seat: 1 }] }, quest("success"));
    expect(engaged.stageCleared).toBe(false);
  });
  /** The first player's characters attack the Were-worm engaged with them (five attack in all: two heroes of attack 2 and an ally of attack 1) until the attack is over. */
  function killWorm(effects: readonly Effect[], engaged: Layout["engaged"]): ScenarioState {
    const made = make(effects, { stage: BEASTS, progress: 16, temperature: 0, phase: "PlayerAttacks", play: ["ally"], engaged });
    const wormId = idOf(made.state, WORM);
    const attackers = [made.hero, made.hero2, idOf(made.state, "ally")];
    const sent = send(opened(made), { type: "DeclareAttackers", enemyId: wormId, attackerIds: attackers }, made.ctx);
    return drive(made, sent, (state) => state.stageCleared || state.phase !== "Combat").state;
  }
  lineSpec("16070:B:3", "once the last Were-worm leaves play the stage is defeated at once; with another one in play it is not", (effects) => {
    expect(killWorm(effects, [WORM]).stageCleared).toBe(true);
    const state = killWorm(effects, [WORM, WORM]);
    expect(engagedCodes(state)).toEqual([WORM]);
    expect(state.stageCleared).toBe(false);
  });
});

describe("16023 Seek Shade forced", () => {
  const progressOnStage = (state: ScenarioState): number => state.cards[state.questStage ?? ""]?.progress ?? -1;
  lineSpec("16023:A:2", "at the end of the round X progress is removed from the main quest only (X the tens digit), once for two players", (effects) => {
    const layout: Layout = { stage: DESERT, progress: 6, temperature: 30, staging: ["16023"], active: { code: "16027", progress: 1 }, deck: ["f0", "f0", "f0"] };
    const one = played(effects, layout, endRound);
    expect(progressOnStage(one)).toBe(3);
    expect(damageOf(one, "16027")).toBe(0);
    expect(one.cards[idOf(one, "16027")]?.progress).toBe(1);
    expect(one.cards[idOf(one, "16023")]?.progress).toBe(0);
    expect(progressOnStage(played(effects, { ...layout, seats: 2 }, endRound))).toBe(3);
  });
  lineSpec("16023:A:2", "below 10 nothing is removed, and the progress never goes below 0", (effects) => {
    expect(progressOnStage(played(effects, { stage: DESERT, progress: 6, temperature: 5, staging: ["16023"], deck: ["f0", "f0", "f0"] }, endRound))).toBe(6);
    expect(progressOnStage(played(effects, { stage: DESERT, progress: 2, temperature: 50, staging: ["16023"], deck: ["f0", "f0", "f0"] }, endRound))).toBe(0);
  });
  lineSpec("16023:A:2", "a Seek Shade that is not in the staging area removes nothing", (effects) => {
    expect(progressOnStage(played(effects, { stage: DESERT, progress: 6, temperature: 30, staging: ["16023"], deck: ["f0", "f0", "f0"] }, endRound))).toBe(3);
    expect(progressOnStage(played(effects, { stage: DESERT, progress: 6, temperature: 30, discard: ["16023"], deck: ["f0", "f0", "f0"] }, endRound))).toBe(6);
  });
  lineSpec("16023:A:3", "two players: the temperature is reduced once by 10", (effects) => {
    const { state } = defeatedSideQuest(effects, "16023", { seats: 2, temperature: 30 });
    expect(temperatureOf(state)).toBe(24);
  });
});

describe("16048 Find Water", () => {
  lineSpec("16048:A:1", "while in the staging area, the characters of every player cannot be readied by player card effects", (effects) => {
    const withIt = make(effects, { seats: 2, staging: ["16048"], play: ["ally", { code: "ally", seat: 1 }] });
    expect(statOf(withIt.state, withIt.cards, "dh1", "cannotReadyByPlayerCard")).toBe(1);
    expect(statOf(withIt.state, withIt.cards, "dh3", "cannotReadyByPlayerCard")).toBe(1);
    expect(statOf(withIt.state, withIt.cards, "ally", "cannotReadyByPlayerCard")).toBe(1);
    const without = make(effects, { seats: 2, discard: ["16048"] });
    expect(statOf(without.state, without.cards, "dh1", "cannotReadyByPlayerCard")).toBe(0);
  });
  lineSpec("16048:A:1", "it bars no ready of the refresh phase", (effects) => {
    const state = played(effects, { staging: ["16048"], exhaustedCards: ["dh1"], deck: ["f0", "f0", "f0"] }, endRound);
    const held = make(effects, { staging: ["16048"] });
    expect(statOf(held.state, held.cards, "dh1", "cannotReadyByPlayerCard")).toBe(1);
    expect(state.cards[idOf(state, "dh1")]?.exhausted).toBe(false);
  });
  lineSpec("16048:A:2", "defeated, each of two players readies 1 hero he controls", (effects) => {
    const { state } = defeatedSideQuest(effects, "16048", { seats: 2 });
    const exhaustedHeroes = (...ids: string[]): number => ids.filter((id) => state.cards[idOf(state, id)]?.exhausted).length;
    expect(zoneOf(state, "16048")).toBe("victory");
    expect(exhaustedHeroes("dh1", "dh2")).toBe(1);
    expect(exhaustedHeroes("dh3")).toBe(0);
  });
});

describe("16053 Craft Remedy", () => {
  lineSpec("16053:A:1", "each damaged character of any player, hero or ally, has its text box blank; an undamaged one does not", (effects) => {
    const made = make(effects, { seats: 2, staging: ["16053"], play: [{ code: "ally", seat: 1, damage: 1 }, { code: "ally", seat: 0 }], heroes: [{ code: "dh3", seat: 1, damage: 1 }] });
    const blankIds = Object.values(made.state.cards).filter((card) => (card.zone === "play" || card.zone === "heroes") && modifiedStat(made.state, card, "blankText", made.cards) === 1).map((card) => `${card.code}:${card.damage}`);
    expect(blankIds.sort()).toEqual(["ally:1", "dh3:1"]);
  });
  lineSpec("16053:A:1", "a healed character is no longer blank (read live); the card in the discard pile blanks nothing", (effects) => {
    const hurt = make(effects, { staging: ["16053"], play: [{ code: "ally", damage: 1 }] });
    const healed = make(effects, { staging: ["16053"], play: [{ code: "ally" }] });
    const away = make(effects, { discard: ["16053"], play: [{ code: "ally", damage: 1 }] });
    expect(statOf(hurt.state, hurt.cards, "ally", "blankText")).toBe(1);
    expect(statOf(healed.state, healed.cards, "ally", "blankText")).toBe(0);
    expect(statOf(away.state, away.cards, "ally", "blankText")).toBe(0);
  });
  lineSpec("16053:A:2", "defeated, 1 damage is healed from each character in play (two players)", (effects) => {
    const { state } = defeatedSideQuest(effects, "16053", { seats: 2, play: [{ code: "ally", damage: 1 }, { code: "ally", seat: 1, damage: 1 }], heroes: [{ code: "dh2", damage: 3 }] });
    expect(zoneOf(state, "16053")).toBe("victory");
    expect(idsOf(state, "ally").map((id) => state.cards[id]?.damage)).toEqual([0, 0]);
    expect(idsOf(state, "dh2").map((id) => state.cards[id]?.damage).sort()).toEqual([0, 2]);
  });
});
