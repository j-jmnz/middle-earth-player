// Rules: hon.siege, hon.battle, hon.archery, faq.errata.06123, rr.staging-area, rr.lasting-effects, rr.travel, rr.forced, rr.victory, rr.step-3-4, ats.hidden-cards, rr.end-of-round (data/rules/entries.json); ledger lines 06118:B:1, 06118:B:4, 06119:A:1, 06119:A:2, 06123:A:1, 06123:A:2, 06125:A:1, 06127:A:1, 06128:A:1, 06128:A:2, 06128:A:3, 06131:A:1.
// The locations, the stage and the enemies of The Blood of Gondor that change a total: the quest card's Siege and Battle, the Threat of The Cross-roads and Black Númenorean, the +5 quest points of the roads, Archery X, the Dark Woods once explored, the Orcs of Conflict at the Crossroads, and the win. Every moment is a real
// quest, round or travel; the quest total is read from the quest step the game wrote, with Boromir (Willpower 1, Attack 3, Defense 2) so the stat counted shows.
import { expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { archeryTotal } from "../../../rules/combat/combat.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { revealedTop, send, statOf } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { BOROMIR, CODES, drive, engagedCodes, hiddenCodes, opened, run, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambush, captured, crossroads, western, eastern, darkWoods, numenorean, uruk, arsonist, rabble, conflict, ambusher } = CODES;
const fillers = (count: number): string[] => Array<string>(count).fill("f0");

/** The willpower the quest step counted for Boromir committed alone (his Willpower 1, Attack 3 under Battle, Defense 2 under Siege). */
function questWillpower(effects: readonly Effect[], layout: Partial<Parameters<typeof table>[0]>): number {
  const made = table({ phase: "Quest", seats: 1, heroes: [{ code: BOROMIR }], committed: [BOROMIR], deck: fillers(4), ...layout }, effects, [BOROMIR]);
  const done = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase !== "Quest");
  return (done.steps.find((step) => step.kind === "quest") as { willpower: number }).willpower;
}

lineSpec("06123:A:1", "the current quest card gains Siege and loses Battle while The Cross-roads is in play: in the staging area or active, committed characters count Defense on stage 2, and Battle's Attack again when it is gone", (effects) => {
  expect(questWillpower(effects, { stage: captured })).toBe(3);
  expect(questWillpower(effects, { stage: captured, staging: [crossroads] })).toBe(2);
  expect(questWillpower(effects, { stage: captured, active: crossroads })).toBe(2);
});

lineSpec("06123:A:1", "stage 1, which prints neither Siege nor Battle, gains Siege from The Cross-roads: Defense counts instead of Willpower", (effects) => {
  expect(questWillpower(effects, { stage: ambush })).toBe(1);
  expect(questWillpower(effects, { stage: ambush, staging: [crossroads] })).toBe(2);
});

lineSpec("06123:A:2", "X is the number of players in the game: its Threat in the staging area is 1 with one player and 2 with two", (effects) => {
  const threat = (seats: 1 | 2) => {
    const made = table({ seats, staging: [crossroads] }, effects);
    return stagingThreat(made.state, made.ctx.cards);
  };
  expect(threat(1)).toBe(1);
  expect(threat(2)).toBe(2);
});

for (const [line, code, quest] of [["06125:A:1", western, 4], ["06127:A:1", eastern, 2]] as const) {
  lineSpec(line, `+5 quest points only while it is in the staging area: ${quest + 5} there, ${quest} once it is the active location`, (effects) => {
    const staged = table({ staging: [code] }, effects);
    expect(statOf(staged.state, staged.ctx.cards, code, "questPoints")).toBe(quest + 5);
    const active = table({ active: code }, effects);
    expect(statOf(active.state, active.ctx.cards, code, "questPoints")).toBe(quest);
  });
}

lineSpec("06128:A:1", "Archery X: it has Archery while it is in the staging area, and none out of play", (effects) => {
  const made = table({ staging: [darkWoods] }, effects);
  expect(archeryTotal(made.state, made.ctx.cards)).toBeGreaterThan(0);
  const away = table({}, effects);
  expect(archeryTotal(away.state, away.ctx.cards)).toBe(0);
});

lineSpec("06128:A:2", "X is the number of players: Archery 1 with one player and 2 with two", (effects) => {
  const total = (seats: 1 | 2) => {
    const made = table({ seats, staging: [darkWoods] }, effects);
    return archeryTotal(made.state, made.ctx.cards);
  };
  expect(total(1)).toBe(1);
  expect(total(2)).toBe(2);
});

lineSpec("06128:A:3", "Forced: after it is explored the first player (seat 1) discards 1 hidden card of his own, unresolved: nothing engages him and the other player keeps his cards; with none nothing happens", (effects) => {
  const explore = (hidden: boolean): ScenarioState => {
    const made = table({ seats: 2, firstPlayer: 1, phase: "Quest", active: darkWoods, committed: ["dh1", "dh2"], deck: [ambusher, rabble, uruk, ...fillers(8)] }, effects);
    const held = hidden ? takes(made, takes(made, made.state, 1, 2), 0, 1) : made.state;
    return drive(made, send(opened(made, held), { type: "Pass" }, made.ctx), (state) => state.phase !== "Quest").state;
  };
  const done = explore(true);
  expect(where(done, darkWoods)).not.toBe("activeLocation");
  expect([hiddenCodes(done, 1).length, hiddenCodes(done, 0).length]).toEqual([1, 1]);
  expect(engagedCodes(done, 1)).toEqual([]);
  expect(done.encounterDiscard.filter((id) => [ambusher, rabble].includes(done.cards[id]?.code ?? ""))).toHaveLength(1);
  expect(hiddenCodes(explore(false))).toEqual([]);
});

lineSpec("06119:A:1", "X is the number of hidden cards in all play areas, counted again whenever they change: the Threat of Black Númenorean in the staging area follows them", (effects) => {
  const made = table({ seats: 2, staging: [numenorean], deck: fillers(8) }, effects);
  const none = stagingThreat(made.state, made.ctx.cards);
  const some = takes(made, takes(made, made.state, 0, 2), 1);
  expect(stagingThreat(some, made.ctx.cards) - none).toBe(3);
  expect(stagingThreat(takes(made, some, 1), made.ctx.cards) - none).toBe(4);
});

lineSpec("06119:A:2", "Forced: at the end of the round each player raises his threat by 1 for each hidden card in his own play area, while Black Númenorean is in the staging area", (effects) => {
  const round = (staged: boolean): ScenarioState => {
    const made = table({ seats: 2, phase: "PlayerAttacks", ...(staged ? { staging: [numenorean] } : {}), deck: fillers(8) }, effects);
    const held = takes(made, takes(made, made.state, 0, 2), 1);
    return drive(made, opened(made, held), (state) => state.phase === "Planning").state;
  };
  const apart = round(true);
  const plain = round(false);
  expect([(apart.seats[0]?.threat ?? 0) - (plain.seats[0]?.threat ?? 0), (apart.seats[1]?.threat ?? 0) - (plain.seats[1]?.threat ?? 0)]).toEqual([2, 1]);
});

lineSpec("06131:A:1", "When Revealed: until the end of the phase each Orc enemy engaged with any player adds its Threat to the staging area, an Orc that engages later in the phase too; a non-Orc adds nothing", (effects) => {
  const made = table({ phase: "Quest", seats: 2, engaged: [arsonist, { code: uruk, seat: 1 }, "f3"], deck: [rabble, "f0", "f0", "f0"] }, effects);
  const held = takes(made, made.state, 0);
  const before = stagingThreat(held, made.ctx.cards);
  const revealed = revealedTop({ state: held, ctx: made.ctx }, conflict);
  // Orc Arsonist 3 and Brutal Uruk 3 (the second seat's too) add 6, and the stand-in enemy that is no Orc nothing; the card did not surge.
  expect(stagingThreat(revealed, made.ctx.cards) - before).toBe(6);
  const later = run(made, revealed, { verb: "TurnHiddenCards", who: "actor" });
  expect(engagedCodes(later)).toContain(rabble);
  expect(stagingThreat(later, made.ctx.cards) - before).toBe(6 + 2);
});

lineSpec("06131:A:1", "the Threat added ends with the phase: at the end of the phase the engaged Orcs add nothing", (effects) => {
  const made = table({ phase: "Quest", engaged: [arsonist], deck: fillers(4) }, effects);
  const before = stagingThreat(opened(made).state, made.ctx.cards);
  const revealed = revealedTop(made, conflict);
  expect(stagingThreat(revealed, made.ctx.cards) - before).toBe(3);
  const next = drive(made, opened(made, { ...revealed, mode: "questCommit", window: { kind: "pass" } as never }), (state) => state.phase !== "Quest");
  expect(stagingThreat(next.state, made.ctx.cards) - before).toBe(0);
});

lineSpec("06131:A:1", "a second Conflict at the Crossroads in the same phase adds the engaged Orcs' Threat again: each copy is a lasting effect of its own, so two copies add the Threat twice", (effects) => {
  const made = table({ phase: "Quest", engaged: [arsonist, uruk], deck: fillers(6) }, effects);
  const before = stagingThreat(made.state, made.ctx.cards);
  const once = revealedTop(made, conflict);
  expect(stagingThreat(once, made.ctx.cards) - before).toBe(6);
  const twice = revealedTop({ state: once, ctx: made.ctx }, conflict);
  expect(stagingThreat(twice, made.ctx.cards) - before).toBe(12);
});

lineSpec("06131:A:1", "When Revealed: it gains surge when no Orc enemy is engaged with a player, and none when one is: it prints no Surge keyword", (effects) => {
  const staged = (state: ScenarioState) => state.staging.filter((id) => state.cards[id]?.code === "f0").length;
  const none = table({ phase: "Quest", deck: fillers(3) }, effects);
  expect(staged(revealedTop(none, conflict)) - staged(none.state)).toBe(1);
  const orc = table({ phase: "Quest", engaged: [arsonist], deck: fillers(3) }, effects);
  expect(staged(revealedTop(orc, conflict)) - staged(orc.state)).toBe(0);
  // A Conflict at the Crossroads is no surge card in the encounter deck: the card names no keyword.
  expect(none.ctx.cards.get(conflict)?.keywords.surge ?? false).toBeFalsy();
});

it("06118:B:1 Battle: the characters count Attack instead of Willpower when questing, and an enemy in the staging area keeps its Threat", () => {
  const effects = table({}).ctx.effects;
  expect(questWillpower(effects, { stage: captured })).toBe(3);
  expect(questWillpower(effects, { stage: ambush })).toBe(1);
  const made = table({ stage: captured, staging: [uruk] });
  expect(stagingThreat(made.state, made.ctx.cards)).toBe(3);
});

it("06118:B:4 the players who defeat the last stage win the game: no stage follows it", () => {
  const made = table({ phase: "Quest", seats: 1, stage: captured, progress: 13, heroes: [{ code: BOROMIR }], committed: [BOROMIR], deck: fillers(4) }, undefined, [BOROMIR]);
  const done = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase !== "Quest");
  expect(done.state.stageCleared).toBe(true);
  expect(done.state.lost).toBe(false);
});
