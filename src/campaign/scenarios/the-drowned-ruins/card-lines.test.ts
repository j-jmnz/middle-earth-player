// Rules: rr.shadow-effects, rr.victory, rr.winning-the-game, rr.attachment-cards, rr.enters-play, dcce.scalable-upgradable, dcce.gaining-xp, dcce.campaign-mode (data/rules/entries.json).
// The Drowned Ruins (dream-chaser part 7), read from the printed lines (data/printed/dream-chaser.json): the Shadows 12096:A:2, 12107:A:2, 12108:A:2, the Shrine's win 12094:A:3, 12095:A:3, Círdan's Blessing's
// hosts and resources 11205:A:1, 11206:A:1, 11207:A:1, 11208:A:1, 11206:A:2, 11207:A:2, 11208:A:2, and the campaign card's Resolution 11200:B:1, 11200:B:2, 11200:B:3, 11200:B:4, 11200:B:5, 11200:B:6, 11200:B:9, 11200:B:10. The Command events are
// card-lines-command.test.ts. Rows are `cardSpecs`; the other tests are `lineSpec` on `tableFromLayout`, each run again without the records of its line, where it must fail.
import { describe, expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { applyResolution, openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { attack, cardSpecs, damageOn, defend, endPhase, won, zone, type Row } from "../../../../test/harness/card-spec.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { idOf, legalTargets, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { payFor } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";

const SCENARIO = "the-drowned-ruins";
const DROWNED_CAVE = "12104"; // an Underwater location
const SEA_SCORPION = "12096";
const OMINOUS_FATE = "11176"; // the earlier parts' burden, shuffled in from the Campaign Pool

const ROWS: readonly Row[] = [
  // "Shadow: Attacking enemy gets +1 Attack (+2 Attack instead if the active location is Underwater)." The stand-in enemy attacks for 1, undefended.
  { line: "12096:A:2", name: "its Shadow gives the attacking enemy +1 Attack", act: attack("f0", { shadow: "12096", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "12096:A:2", name: "its Shadow gives +2 Attack instead while the active location is Underwater", layout: { active: DROWNED_CAVE }, act: attack("f0", { shadow: "12096", undefended: true }), expect: damageOn("dh1", 3) },
  { line: "12108:A:2", name: "its Shadow gives the attacking enemy +1 Attack", act: attack("f0", { shadow: "12108", undefended: true }), expect: damageOn("dh1", 2) },
  { line: "12108:A:2", name: "its Shadow gives +2 Attack instead while the active location is Underwater", layout: { active: DROWNED_CAVE }, act: attack("f0", { shadow: "12108", undefended: true }), expect: damageOn("dh1", 3) },
  // 12107 Tangling and Grasping: "Shadow: Discard an attachment you control."
  { line: "12107:A:2", name: "its Shadow discards an attachment the defending player controls", layout: { attached: [{ code: "attachment", to: "dh1" }] }, act: [attack("f0", { shadow: "12107" }), defend("dh1")], expect: zone("attachment", "discard") },
  // Shrine to Morgoth, both sides: "When Shrine to Morgoth is placed in the victory display, the players have escaped from the flooded grotto and win the game."
  { line: "12094:A:3", name: "the players win once it is in the victory display", layout: { victory: ["12094"], deck: ["f0", "f0"] }, act: endPhase, expect: won },
  { line: "12095:A:3", name: "the players win once its Underwater side is in the victory display", layout: { victory: ["12095"], deck: ["f0", "f0"] }, act: endPhase, expect: won },
];

cardSpecs(SCENARIO, ROWS);

// Círdan's Blessing in the first seat's hand, played in the planning phase; `level` is its boxes in the Campaign Log.
function blessingTable(code: string, effects: readonly Effect[], layout: Layout = {}, level = 0) {
  const made = tableFromLayout(SCENARIO, { phase: "Planning", hand: [code], heroResources: 2, ...layout }, { effects });
  const state: ScenarioState = { ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [code]: level } } };
  return { ...made, state, card: idOf(state, code) };
}
const hostsOf = (made: ReturnType<typeof blessingTable>): readonly string[] => legalTargets(made.state, { type: "PlayCard", cardId: made.card }, made.ctx);

describe("Círdan's Blessing's hosts (11205:A:1 to 11208:A:1)", () => {
  for (const code of ["11205", "11206", "11207"]) {
    lineSpec(`${code}:A:1`, "attaches to a character, a hero or an ally, and not to an enemy", (effects) => {
      const made = blessingTable(code, effects, { seats: 2, play: ["ally"], staging: [SEA_SCORPION] });
      const hosts = hostsOf(made);
      expect(hosts).toContain(made.hero);
      expect(hosts).toContain(made.seat1Hero);
      expect(hosts).toContain(idOf(made.state, "ally"));
      expect(hosts).not.toContain(idOf(made.state, SEA_SCORPION));
    });
  }
  lineSpec("11208:A:1", "attaches to a hero and not to an ally", (effects) => {
    const made = blessingTable("11208", effects, { play: ["ally"] });
    const hosts = hostsOf(made);
    expect(hosts).toContain(made.hero);
    expect(hosts).not.toContain(idOf(made.state, "ally"));
  });
});

describe("Círdan's Blessing enters play with X resources (11206:A:2 to 11208:A:2)", () => {
  // "Círdan's Blessing enters play with X resources on it. X is 1 more than the level of Círdan's Blessing."
  for (const code of ["11206", "11207", "11208"]) {
    for (const level of [0, 2]) {
      lineSpec(`${code}:A:2`, `played at level ${level} it enters play with ${level + 1} resources`, (effects) => {
        const made = blessingTable(code, effects, {}, level);
        const run = send(start(made.state), { type: "PlayCard", cardId: made.card, hostId: made.hero, payments: payFor(made.state, made.ctx, made.card) }, made.ctx);
        expect(run.state.cards[made.card]?.host).toBe(made.hero);
        expect(run.state.cards[made.card]?.resources).toBe(level + 1);
      });
    }
  }
});

// The campaign card's Resolution on a won table (test/scenarios/the-thing-in-the-depths resolution test's way): the baseline makes every XP line false but B:3 (one surviving player, threat 45, nothing on the
// campaign card, no Na'asiyah, Ominous Fate not in the victory display, no enemy in play: B:6 holds unless an enemy is placed, so the baseline places one).
const BASE: Layout = { campaign: true, threat: [45, 45], engaged: ["f0"] };
function resolved(effects: readonly Effect[], layout: Layout = {}, tweak: (state: ScenarioState) => ScenarioState = (state) => state) {
  const made = tableFromLayout(SCENARIO, { ...BASE, ...layout }, { effects, extra: [OMINOUS_FATE] });
  let state = openResolution(tweak({ ...made.state, window: null, stageCleared: true, resolution: made.definition.resolution }), made.ctx);
  for (let guard = 0; guard < 4 && state.window?.kind === "resolution"; guard += 1) state = openResolution(applyResolution(state, "skip"), made.ctx);
  return resolutionResult(state);
}
const xpOf = (effects: readonly Effect[], layout: Layout = {}, tweak?: (state: ScenarioState) => ScenarioState): number => resolved(effects, layout, tweak)?.xp ?? 0;
const tokens = (code: string, resources: number) => (state: ScenarioState): ScenarioState => ({ ...state, cards: Object.fromEntries(Object.entries(state.cards).map(([id, card]) => [id, card.code === code ? { ...card, resources } : card])) });
const eliminated = (state: ScenarioState): ScenarioState => ({ ...state, seats: [state.seats[0]!, { ...state.seats[1]!, eliminated: true }] });

describe("the campaign card's Resolution (11200:B:1 to 11200:B:10)", () => {
  lineSpec("11200:B:2", "gains the XP of the lines below it, added up: 1 for the one surviving player and 2 for 2 resources on this card", (effects) => {
    expect(xpOf(effects, {}, tokens("11200", 2))).toBe(3);
  });
  lineSpec("11200:B:1", "adds each copy of Command and Círdan's Blessing chosen during setup to the Campaign Pool, for the seat that chose it", (effects) => {
    const chosen = (state: ScenarioState): ScenarioState => ({ ...state, chosenAtSetup: [{ code: "11201", seat: 0 }, { code: "11206", seat: 0 }] });
    expect(resolved(effects, {}, chosen)?.earned).toEqual(expect.arrayContaining([expect.objectContaining({ code: "11201", to: "pool", seat: 0 }), expect.objectContaining({ code: "11206", to: "pool", seat: 0 })]));
  });
  lineSpec("11200:B:3", "gains 1 XP for each surviving player, none for an eliminated one", (effects) => {
    expect(xpOf(effects)).toBe(1);
    expect(xpOf(effects, { seats: 2 })).toBe(2);
    expect(xpOf(effects, { seats: 2 }, eliminated)).toBe(1);
  });
  lineSpec("11200:B:4", "gains 1 XP for each resource on this card, to a maximum of 3 XP", (effects) => {
    expect(xpOf(effects, {}, tokens("11200", 2))).toBe(1 + 2);
    expect(xpOf(effects, {}, tokens("11200", 5))).toBe(1 + 3);
  });
  lineSpec("11200:B:5", "gains 1 XP if Na'asiyah has 5 or more resources, none with 4", (effects) => {
    expect(xpOf(effects, { play: ["11079"] }, tokens("11079", 4))).toBe(1);
    expect(xpOf(effects, { play: ["11079"] }, tokens("11079", 5))).toBe(2);
  });
  lineSpec("11200:B:6", "gains 1 XP if no enemies are in play: none for an enemy engaged or in the staging area, one for an enemy set aside", (effects) => {
    expect(xpOf(effects, { engaged: [], setAside: [SEA_SCORPION] })).toBe(2);
    expect(xpOf(effects)).toBe(1);
    expect(xpOf(effects, { engaged: [], staging: [SEA_SCORPION] })).toBe(1);
  });
  lineSpec("11200:B:9", "gains 1 XP if each surviving player's threat is 40 or less, none when one of two is over", (effects) => {
    expect(xpOf(effects, { threat: [40, 45] })).toBe(2);
    expect(xpOf(effects, { seats: 2, threat: [40, 41] })).toBe(2);
    expect(xpOf(effects, { seats: 2, threat: [40, 50] }, eliminated)).toBe(1 + 1);
  });
  lineSpec("11200:B:10", "loses 1 XP if Ominous Fate is in the victory display", (effects) => {
    expect(xpOf(effects, { threat: [40, 45], victory: [OMINOUS_FATE] })).toBe(1 + 1 - 1);
  });
});
