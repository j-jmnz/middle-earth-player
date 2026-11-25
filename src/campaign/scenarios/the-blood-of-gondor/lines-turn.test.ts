// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, faq.blood-of-gondor-hidden-cards, faq.errata.06117, rr.engaged, rr.first-player, rr.reveal, rr.surge, ats.ally-objectives, mec109.stage-4 (data/rules/entries.json); ledger lines 06117:A:1, 06117:B:2, 06118:A:1, 06118:B:3.
// The quest stages that turn hidden cards faceup: the Setup, the choice at the beginning of the combat phase, Captured! revealed by the quest that defeats stage 1, and the turn at 5 hidden cards. Each moment is real: the phase begins, the quest is played, the cards are taken by the stage's own lines and by a Travel
// cost. Seat 1 is the first player where the order of the players matters, so player order is not seat order.
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { idOf, legalTargets, resolveRecords, send, type Run } from "../../../../test/harness/scene-kit.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { CODES, drive, engagedCodes, hiddenCodes, offeredActions, opened, run, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambusher, rabble, southern, eastern, crow, faramir, alcaron, captured, ambush, looms } = CODES;
const engaged = (done: Run) => (done.steps as { kind: string; seat?: number; enemyId?: string }[]).filter((step) => step.kind === "engage");

lineSpec("06117:A:1", "Setup: the allies come into the first player's play area, the encounter deck is shuffled and each player reveals 1 card: an enemy goes to the staging area, a treachery resolves and is discarded", (effects) => {
  const setup = (deck: string[]): ScenarioState => {
    const made = table({ seats: 2, firstPlayer: 1, phase: "Quest", setAside: [faramir, alcaron], deck }, effects);
    return resolveRecords(made.state, made.ctx, ambush, "setup", idOf(made.state, ambush)).state;
  };
  const enemies = setup([rabble, rabble, rabble, rabble]);
  for (const code of [faramir, alcaron]) expect(enemies.cards[idOf(enemies, code)]).toMatchObject({ zone: "play", controller: 1 });
  expect(enemies.staging.filter((id) => enemies.cards[id]?.code === rabble)).toHaveLength(2);
  expect(enemies.encounterDeck).toHaveLength(2);
  const treacheries = setup(["treachery", "treachery", "treachery", "treachery"]);
  expect(treacheries.staging).toHaveLength(0);
  expect(treacheries.encounterDiscard).toHaveLength(2);
});

lineSpec("06117:B:2", "at the beginning of the combat phase each player in player order chooses, the first player (seat 1) first: turning his hidden cards engages the enemies, and the enemies are then dealt their shadow cards; taking adds a card", (effects) => {
  const made = table({ seats: 2, firstPlayer: 1, phase: "Encounter", play: [faramir], deck: [rabble, ambusher, "f0", "f0", "f0", "f0", "f0"] }, effects);
  const held = takes(made, takes(made, made.state, 1), 0, 2);
  const at = drive(made, opened(made, held), (state) => state.window?.kind === "choose");
  expect(at.state.window).toMatchObject({ kind: "choose", seat: 1, options: ["turn", "take"] });
  // No action can be used while the choice is open: Faramir's Combat Action waits for it.
  expect(offeredActions(made, at.state)).toEqual([]);
  const first = send(at, { type: "Choose", optionId: "turn" }, made.ctx);
  expect(engagedCodes(first.state, 1)).toEqual([rabble]);
  expect(hiddenCodes(first.state, 1)).toEqual([]);
  expect(first.state.window).toMatchObject({ kind: "choose", seat: 0 });
  const second = send(first, { type: "Choose", optionId: "take" }, made.ctx);
  expect(hiddenCodes(second.state, 0)).toHaveLength(3);
  expect(engagedCodes(second.state, 0)).toEqual([]);
  // The turn comes first and the shadow step after it, so the enemy the turn engaged holds a shadow card.
  const dealt = drive(made, second, (state) => state.mode === "enemyAttacks" || state.window?.kind === "defense");
  expect(Object.values(dealt.state.cards).filter((card) => card.zone === "shadow" && dealt.state.cards[card.host ?? ""]?.code === rabble)).toHaveLength(1);
  // Faramir's Action is offered once both players have chosen.
  expect(dealt.state.window?.kind === "choose").toBe(false);
});

lineSpec("06117:B:2", "a player with no hidden card may choose either: turning leaves him with none and taking gives him 1", (effects) => {
  const choose = (option: string): ScenarioState => {
    const made = table({ phase: "Encounter", deck: ["f0", "f0", "f0", "f0"] }, effects);
    const at = drive(made, opened(made), (state) => state.window?.kind === "choose");
    expect(at.state.window).toMatchObject({ kind: "choose", options: ["turn", "take"] });
    return send(at, { type: "Choose", optionId: option }, made.ctx).state;
  };
  expect(hiddenCodes(choose("turn"))).toEqual([]);
  expect(hiddenCodes(choose("take"))).toHaveLength(1);
});

lineSpec("06118:A:1", "Captured! revealed by the quest that defeats stage 1: Faramir and Lord Alcaron lie under it in play and controlled by nobody, the players do not lose, and the players turn their hidden cards in player order, the first player (seat 1) first", (effects) => {
  const made = table({ seats: 2, firstPlayer: 1, phase: "Quest", stage: ambush, progress: 10, committed: ["dh1", "dh2"], play: [faramir, alcaron], deck: [ambusher, rabble, southern, "f0", "f0", "f0"] }, effects);
  const held = takes(made, takes(made, made.state, 0, 1), 1, 2);
  const done = drive(made, opened(made, held), (state) => state.questStage != null && state.cards[state.questStage]?.code === captured);
  expect(done.state.lost).toBe(false);
  for (const code of [faramir, alcaron]) expect(done.state.cards[idOf(done.state, code)]).toMatchObject({ zone: "captive", controller: null, host: idOf(done.state, captured) });
  expect(hiddenCodes(done.state)).toEqual([]);
  expect(engagedCodes(done.state, 0)).toEqual([ambusher]);
  expect(engagedCodes(done.state, 1)).toEqual([rabble]);
  expect(where(done.state, southern)).toBe("encounterDiscard");
  expect(engaged(done).map((step) => step.seat)).toEqual([1, 0]);
  // Under the stage nothing of theirs can be used.
  expect(offeredActions(made, done.state)).not.toContain("06132:action:1");
});

// Stage 2 (Captured!) on a table where every card taken is an enemy stand-in (engagement cost 50, turned at once whatever it costs).
const five = (effects: readonly Effect[], layout: Partial<Parameters<typeof table>[0]> = {}) => table({ stage: captured, phase: "Combat", deck: Array<string>(14).fill("f0"), ...layout }, effects);

lineSpec("06118:B:3", "a player who holds 5 hidden cards turns them faceup, one at a time, as soon as the instruction that gave him the fifth is done; 4 cards do not turn", (effects) => {
  const made = five(effects, { deck: [southern, "f0", "f0", "f0", ambusher, ...Array<string>(8).fill("f0")] });
  const four = takes(made, made.state, 0, 4);
  expect(hiddenCodes(four)).toHaveLength(4);
  const turned = takes(made, four, 0);
  expect(hiddenCodes(turned)).toEqual([]);
  expect(engagedCodes(turned)).toEqual(["f0", "f0", "f0", ambusher]);
  expect(where(turned, southern)).toBe("encounterDiscard");
});

lineSpec("06118:B:3", "a Travel cost of 2 hidden cards taken at 4 leaves 6 and all 6 turn: the fifth and the sixth are not left facedown", (effects) => {
  const made = five(effects, { phase: "Travel", staging: [eastern], deck: [...Array<string>(4).fill("f0"), southern, ambusher, ...Array<string>(8).fill("f0")] });
  const held = takes(made, made.state, 0, 4);
  expect(legalTargets(opened(made, held).state, { type: "Travel" }, made.ctx)).toContain(idOf(held, eastern));
  const done = send(opened(made, held), { type: "Travel", locationId: idOf(held, eastern) }, made.ctx).state;
  expect(hiddenCodes(done)).toEqual([]);
  expect(engagedCodes(done)).toEqual([...Array<string>(4).fill("f0"), ambusher]);
  expect(done.activeLocation).toBe(idOf(done, eastern));
});

lineSpec("06118:B:3", "the fifth card taken at the beginning of the quest phase turns the 5, and each player's cards are counted apart", (effects) => {
  const made = five(effects, { seats: 2, phase: "Planning" });
  const held = takes(made, made.state, 1, 3);
  const apart = takes(made, held, 0, 3);
  expect([hiddenCodes(apart, 0).length, hiddenCodes(apart, 1).length]).toEqual([3, 3]);
  // Seat 0 holds 4 once more cards are taken, and the beginning of the quest phase gives each seat one more.
  const four = takes(made, apart, 0);
  const quest = drive(made, opened(made, four), (state) => state.phase === "Quest" && state.mode !== "planning").state;
  expect(hiddenCodes(quest, 0)).toEqual([]);
  expect(hiddenCodes(quest, 1)).toHaveLength(4);
  expect(engagedCodes(quest, 0)).toHaveLength(5);
});

lineSpec("06118:B:3", "Evil Crow turned by the 5 takes a card that stays facedown", (effects) => {
  const made = five(effects, { deck: [crow, "f0", "f0", "f0", "f0", southern, ...Array<string>(8).fill("f0")] });
  const turned = takes(made, made.state, 0, 5);
  expect(engagedCodes(turned)).toEqual([crow, "f0", "f0", "f0", "f0"]);
  expect(hiddenCodes(turned)).toEqual([southern]);
});

lineSpec("06118:B:3", "holds on stage 2 only: stage 1 prints no such line, so 5 cards stay hidden", (effects) => {
  const turns = (stage: string) => hiddenCodes(takes(five(effects, { stage }), five(effects, { stage }).state, 0, 5)).length;
  expect(turns(captured)).toBe(0);
  expect(turns(ambush)).toBe(5);
});

lineSpec("06118:B:3", "a treachery turned by the 5 is discarded without its When Revealed (Mordor Looms takes no card) and is not revealed", (effects) => {
  const made = five(effects, { deck: [...Array<string>(4).fill("f0"), looms, ...Array<string>(8).fill("f0")] });
  const held = takes(made, made.state, 0, 4);
  const done = run(made, held, { verb: "TakeHiddenCard" });
  expect(hiddenCodes(done)).toEqual([]);
  expect(where(done, looms)).toBe("encounterDiscard");
});
