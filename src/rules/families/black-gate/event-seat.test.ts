import { describe, expect, it } from "vitest";

import { pushEffectFrame } from "../../interpret/effect-frames.ts";
import { settle } from "../../engine/machine.ts";
import { announceCanceled } from "../nightmare/index.ts";
import { enemy, hero, table } from "../defense/table.ts";
import type { Effect } from "../../../catalog/boundary.ts";

// Rules: rr.cancel, rr.defending-player, faq.enemy-attacks-outside-combat (data/rules/entries.json); ledger line 146031:A:2: "After a player cancels a 'when revealed' effect, The Mouth of Sauron makes an immediate attack against that player."

const mouthForced: Effect = { id: "mouth:forced:1", cardCode: "mouth", lines: ["mouth:A:2"], timing: "forced", trigger: "whenRevealedCanceled", condition: { kind: "sourceIn", zone: "staging" }, instructions: [{ verb: "AttackFromStaging", target: "self", who: "eventSeat" }] };

function twoSeats() {
  return table({ seatCount: 2, cards: [hero("a"), hero("b"), enemy("mouth", { attack: 6, engagementCost: 99 })], effects: [mouthForced], heroes: [{ code: "a", seat: 0 }, { code: "b", seat: 1 }], staging: [{ code: "mouth" }] });
}

describe("whenRevealedCanceled carries the seat that canceled (146031:A:2)", () => {
  it("queues the event with that seat", () => {
    const { state, ctx } = twoSeats();
    const changed = { ...state, round: state.round };
    const announced = announceCanceled(changed, state, ctx, 1);
    expect(announced.pendingEvents?.at(-1)).toMatchObject({ trigger: "whenRevealedCanceled", seat: 1 });
    // Asked for no seat (the older callers), it carries none.
    expect(announceCanceled(changed, state, ctx, null).pendingEvents?.at(-1)).toMatchObject({ trigger: "whenRevealedCanceled", seat: null });
  });
});

describe("AttackFromStaging who eventSeat (146031:A:2)", () => {
  it("attacks the player the event happened to, not the actor", () => {
    const { state, ctx, ids } = twoSeats();
    const pushed = pushEffectFrame(state, { frame: "forced", sourceId: ids.mouth ?? "", actor: 0, peril: false, effectId: mouthForced.id, instructions: mouthForced.instructions, cancel: null, blockCancel: null, eventSeat: 1 }, []);
    const next = settle({ ...pushed, window: null }, ctx, []);
    expect(next.pendingAttack).toMatchObject({ enemyId: ids.mouth, seat: 1 });
  });

  it("makes no attack with no event seat", () => {
    const { state, ctx, ids } = twoSeats();
    const pushed = pushEffectFrame(state, { frame: "forced", sourceId: ids.mouth ?? "", actor: 0, peril: false, effectId: mouthForced.id, instructions: mouthForced.instructions, cancel: null, blockCancel: null }, []);
    const next = settle({ ...pushed, window: null }, ctx, []);
    expect(next.pendingAttack).toBeNull();
  });
});
