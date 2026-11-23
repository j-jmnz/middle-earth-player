// Rules: hob.unconscious-characters, hob.staging-area-creating, hob.bilbo-multiplayer-otd, rr.action, rr.cost, rr.first-player (data/rules/entries.json). The Actions of stages 3B and 4B, each test from the printed line (data/printed/the-hobbit.json) on a table split by stage 2B (the first player, seat 0, at stage 3; seat 1 at stage 4), and
// run again without the records of its line (`lineSpec`): 132069:B:3 and 132070:B:3, "Action: Spend 2 Baggins resources to ready an unconscious character you control."
import { expect } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { stageOf } from "../../../rules/families/breaking/areas.ts";
import { makeUnconscious } from "../../../rules/families/poison/poison.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { finish, legalIntents, resolveRecords, send, start } from "../../../../test/harness/scene-kit.ts";
import { IntentRefused } from "../../../../test/harness/scene.ts";
import { lineSpec } from "../../../../test/harness/line-spec.ts";
import { GLADE, spiderTable, STAGE_2, STAGE_4, withBilbo } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

// Stage 2B revealed with two players: seat 0 holds stage 3 (3A made his stand-in heroes unconscious) and seat 1 holds stage 4. Bilbo Baggins joins the first player's heroes (the first player controls him, hob.bilbo-baggins-otd) with the resources given in his pool.
const split = (effects: readonly Effect[], resources = 2) => {
  const t = spiderTable({ stage: STAGE_2, setAside: [GLADE], seats: 2 }, { effects });
  const bilbo = withBilbo(t.state, 0);
  let state = resolveRecords(bilbo.state, t.ctx, STAGE_2, "whenRevealed", bilbo.state.questStage ?? "").state;
  state = makeUnconscious(state, t.seat1Hero, t.ctx, []);
  state = syncConstants(updateCard(state, bilbo.id, { resources }), t.ctx);
  const down = (state.seats[0]?.heroes ?? []).filter((id) => state.cards[id]?.unconscious === true);
  return { t, state, bilbo: bilbo.id, stage3: stageOf(state, 0) ?? "", stage4: stageOf(state, 1) ?? "", down };
};
// One area, one player at stage 4 (what stage 3B leaves once the first player has joined): Bilbo with the resources given, the first stand-in hero unconscious.
const alone = (effects: readonly Effect[], resources = 2) => {
  const t = spiderTable({ stage: STAGE_4, seats: 1 }, { effects });
  const bilbo = withBilbo(t.state, 0);
  const state = syncConstants(updateCard(makeUnconscious(bilbo.state, t.hero, t.ctx, []), bilbo.id, { resources }), t.ctx);
  return { t, state, bilbo: bilbo.id, stage: state.questStage ?? "", hero: t.hero };
};
const offered = (t: { ctx: Parameters<typeof legalIntents>[1] }, state: ScenarioState, seat: number, stage: string) =>
  legalIntents({ ...state, window: { kind: "pass" }, activeSeat: seat }, t.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === stage);
// The player uses the Action, paying 2 from Bilbo's pool, and the choice of the character to ready is answered with its first option.
const trigger = (t: { ctx: Parameters<typeof legalIntents>[1] }, state: ScenarioState, seat: number, stage: string, payer: string): ScenarioState => {
  const at = { ...state, window: { kind: "pass" as const }, activeSeat: seat };
  const intent = legalIntents(at, t.ctx).find((one) => one.type === "Trigger" && one.cardId === stage);
  if (!intent) throw new IntentRefused({ type: "Trigger", cardId: stage, effectId: "" }, "the Action is not offered");
  return finish(send(start(at), { ...intent, payments: [{ heroId: payer, amount: 2 }] } as PlayerIntent, t.ctx), t.ctx).state;
};

lineSpec("132069:B:3", "the first player spends 2 Baggins resources from Bilbo to ready an unconscious character he controls (the unconscious bars do not stop it)", (effects) => {
  const made = split(effects);
  expect(made.down.length, "3A left two stand-in heroes unconscious").toBe(2);
  expect(offered(made.t, made.state, 0, made.stage3)).toBe(true);
  const out = trigger(made.t, made.state, 0, made.stage3, made.bilbo);
  expect(out.cards[made.bilbo]?.resources, "2 resources are spent").toBe(0);
  const readied = made.down.filter((id) => out.cards[id]?.unconscious !== true);
  expect(readied.length, "exactly one character is readied").toBe(1);
  expect(out.cards[readied[0] ?? ""]?.exhausted, "and it is ready, not unconscious").toBe(false);
  expect(made.down.filter((id) => out.cards[id]?.unconscious === true).length, "the other stays unconscious").toBe(1);
});
lineSpec("132069:B:3", "is not offered with 1 Baggins resource, with no unconscious character to ready, or to the player at the other stage", (effects) => {
  const made = split(effects);
  expect(offered(made.t, made.state, 0, made.stage3), "offered with 2 resources and an unconscious character").toBe(true);
  expect(offered(made.t, updateCard(made.state, made.bilbo, { resources: 1 }), 0, made.stage3), "1 resource does not pay").toBe(false);
  const awake = made.down.reduce((state, id) => updateCard(state, id, { unconscious: undefined, exhausted: false }), made.state);
  expect(offered(made.t, syncConstants(awake, made.t.ctx), 0, made.stage3), "nothing to ready").toBe(false);
  expect(offered(made.t, made.state, 1, made.stage3), "the player of the other area cannot use this stage's Action").toBe(false);
});

lineSpec("132070:B:3", "a player who has joined at stage 4 spends 2 Baggins resources from Bilbo to ready an unconscious character he controls", (effects) => {
  const made = alone(effects);
  expect(offered(made.t, made.state, 0, made.stage)).toBe(true);
  const out = trigger(made.t, made.state, 0, made.stage, made.bilbo);
  expect(out.cards[made.bilbo]?.resources, "2 resources are spent").toBe(0);
  expect(out.cards[made.hero]).toMatchObject({ exhausted: false });
  expect(out.cards[made.hero]?.unconscious).toBeUndefined();
});
lineSpec("132070:B:3", "is not offered with 1 Baggins resource or with no unconscious character", (effects) => {
  const made = alone(effects);
  expect(offered(made.t, made.state, 0, made.stage), "offered with 2 resources and an unconscious character").toBe(true);
  expect(offered(made.t, updateCard(made.state, made.bilbo, { resources: 1 }), 0, made.stage), "1 resource does not pay").toBe(false);
  expect(offered(made.t, syncConstants(updateCard(made.state, made.hero, { unconscious: undefined, exhausted: false }), made.t.ctx), 0, made.stage), "nothing to ready").toBe(false);
});
lineSpec("132070:B:3", "the player at stage 4 in the area with no Bilbo cannot pay with the Baggins resources of Bilbo, who is in the first player's area", (effects) => {
  const control = alone(effects);
  expect(offered(control.t, control.state, 0, control.stage), "Bilbo and the player in one area").toBe(true);
  const made = split(effects);
  expect(made.state.cards[made.bilbo]?.resources).toBe(2);
  expect(offered(made.t, made.state, 1, made.stage4), "Bilbo is in the other area").toBe(false);
  expect(() => trigger(made.t, made.state, 1, made.stage4, made.bilbo)).toThrow();
});
