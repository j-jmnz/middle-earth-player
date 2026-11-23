// Rules: mec113.the-one-ring, mec113.multiplayer-the-one-ring, mec113.setting-up-the-game, rr.attachment-cards, rr.cannot, rr.in-play-and-out-of-play, rr.ownership-and-control, rr.first-player (data/rules/entries.json).
// Lines: 146021:A:1, 146065:A:1, 146065:A:2, 146065:A:3. Gorbag's bar on attachments and The One Ring's Setup, constant, control and loss, read from the printed lines on a table built from data/
// (test/harness/layout.ts, tableFromLayout), each run again with the records of its line removed (test/harness/card-spec.ts, withoutLine), where it must not hold. Deep Shadows' Shadow (146062:A:3) is a row in spec.test.ts.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { attachBlocked, heroLimitExempt } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { endRound, withoutLine } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { finish, idOf, resolveRecords, tableFromLayout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-tower-of-cirith-ungol";
const GORBAG = "146021";
const RING = "146065";
const FRODO = "141001"; // a Ring-bearer hero
const STAGE2 = { stage: "146067" };
const without = (...lines: string[]) => lines.reduce(withoutLine, EFFECTS);

// "Cannot have attachments." A player attachment is barred from Gorbag and not from another enemy.
describe("Gorbag", () => {
  const blocked = (effects: readonly Effect[]) => {
    const t = tableFromLayout(ID, { engaged: [{ code: GORBAG, seat: 0 }, { code: "f3", seat: 0 }] }, { effects });
    return [attachBlocked(t.state, t.ctx, idOf(t.state, GORBAG), "attachment"), attachBlocked(t.state, t.ctx, idOf(t.state, "f3"), "attachment")];
  };
  it("146021:A:1 cannot have an attachment, and another enemy can", () => {
    expect(blocked(EFFECTS)).toEqual([true, false]);
    expect(blocked(without("146021:A:1"))).toEqual([false, false]);
  });
});

describe("The One Ring", () => {
  // "Setup: The first player claims The One Ring and attaches it to the Ring-bearer." The first player controls a Ring-bearer beside the two stand-in heroes (mec113.setting-up-the-game).
  const setUp = (effects: readonly Effect[]) => {
    const t = tableFromLayout(ID, { setAside: [RING] }, { effects, extra: [FRODO] });
    const frodo = spawn(t.state, FRODO, { zone: "heroes", seat: 0 });
    const run = resolveRecords(frodo.state, t.ctx, RING, "setup", idOf(frodo.state, RING));
    return { state: run.state, frodo: frodo.id };
  };
  it("146065:A:1 Setup: the first player attaches it to the Ring-bearer and controls it", () => {
    const { state, frodo } = setUp(EFFECTS);
    const ring = state.cards[idOf(state, RING)];
    expect([ring?.host, ring?.controller]).toEqual([frodo, 0]);
    const bare = setUp(without("146065:A:1"));
    expect(bare.state.cards[idOf(bare.state, RING)]?.host ?? null).toBeNull();
  });

  // "Attached hero does not count against the hero limit."
  it("146065:A:2 the attached hero does not count against the hero limit, and another hero does", () => {
    const exempt = (effects: readonly Effect[]) => {
      const t = tableFromLayout(ID, { attached: [{ code: RING, to: "dh1" }] }, { effects });
      return [heroLimitExempt(t.state, t.ctx, t.hero), heroLimitExempt(t.state, t.ctx, t.hero2)];
    };
    expect(exempt(EFFECTS)).toEqual([true, false]);
    expect(exempt(without("146065:A:2"))).toEqual([false, false]);
  });

  // "The first player gains control of attached hero." Two-handed, the first player token passes from seat 0 to seat 1 at the end of the round: seat 1 takes the hero, its resources and its attachments
  // (mec113.multiplayer-the-one-ring).
  it("146065:A:2 when the first player token passes, the new first player gains control of the attached hero, its resources and its attachments", () => {
    const passed = (effects: readonly Effect[]) => play(ID, { line: "146065:A:2", layout: { ...STAGE2, seats: 2, phase: "Combat", heroResources: 2, attached: [{ code: RING, to: "dh1" }, { code: "attachment", to: "dh1" }] }, act: endRound, expect: [] }, effects, false).run.state;
    const state = passed(EFFECTS);
    const hero = idOf(state, "dh1");
    expect(state.firstPlayer).toBe(1);
    expect([state.cards[hero]?.controller, state.seats[1]?.heroes.includes(hero), state.seats[0]?.heroes.includes(hero)]).toEqual([1, true, false]);
    expect([state.cards[idOf(state, RING)]?.controller, state.cards[idOf(state, "attachment")]?.controller]).toEqual([1, 1]);
    // 2 resources kept, and 1 more from the resource phase of the new round.
    expect(state.cards[hero]?.resources).toBe(3);
    const bare = passed(without("146065:A:2"));
    expect(bare.cards[idOf(bare, "dh1")]?.controller).toBe(0);
  });

  // "If The One Ring leaves play, the players lose the game." The attached hero takes its 6 damage and is destroyed, so the Ring is discarded with it.
  it("146065:A:3 when the attached hero is destroyed and the Ring leaves play with it, the players lose the game", () => {
    const destroyed = (effects: readonly Effect[]) => {
      const t = tableFromLayout(ID, { attached: [{ code: RING, to: "dh1" }] }, { effects });
      const steps: EngineStep[] = [];
      const hit = syncConstants({ ...updateCard(t.state, t.hero, { damage: 6 }), window: null }, t.ctx);
      return finish({ state: settle(hit, t.ctx, steps), steps }, t.ctx).state;
    };
    const state = destroyed(EFFECTS);
    expect(state.cards[idOf(state, RING)]?.zone).not.toBe("play");
    expect(state.lost).toBeTruthy();
    expect(destroyed(without("146065:A:3")).lost).toBeFalsy();
  });
});
