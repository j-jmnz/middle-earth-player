// Rules: rr.attachment-cards, rr.restricted, rr.ally-cards, rr.planning-phase (data/rules/entries.json).
// Wild Stallion (19033:A:2), run through the misc family's real records: an ally that attaches itself to another ally.
import { describe, expect, it } from "vitest";

import { RECORDS } from "../../../effects/authored/families/misc.ts";
import { characters } from "../../combat/combat.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { hasTrait } from "../../interpret/conditions.ts";
import { enforceRestricted } from "../../player/attach.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { restrictedLoad } from "../../interpret/restrictions.ts";
import { attachTo } from "../../core/zones.ts";
import { miscCtx } from "./fixture.ts";
import { put, run, seat, send, trigger, triggers } from "../play/fixture.ts";

const ctx = miscCtx(RECORDS);

describe("Wild Stallion", () => {
  it("attaches to another ally as a Restricted Mount attachment that gives +1 to each stat and hit point", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const stallion = put(table.state, "19033", "play");
    const rider = put(stallion.state, "rider", "play");
    const planning = syncConstants(run(rider.state, ctx), ctx);
    expect(triggers(planning, ctx, "19033:action:1")).toHaveLength(1);
    let state = trigger(planning, stallion.id, "19033:action:1", ctx);
    state = syncConstants(run(state, ctx), ctx);
    expect(state.cards[stallion.id]?.host).toBe(rider.id);
    expect(state.cards[rider.id]?.attachments).toContain(stallion.id);
    // The rider got +1 Willpower, Attack, Defense and hit point.
    const base = ctx.cards.get("rider")!;
    expect(modifiedStat(state, state.cards[rider.id]!, "willpower", ctx.cards)).toBe((base.willpower ?? 0) + 1);
    expect(modifiedStat(state, state.cards[rider.id]!, "hitPoints", ctx.cards)).toBe((base.health ?? 0) + 1);
    // The Stallion is no longer a character; it counts as a Restricted Mount attachment.
    expect(characters(state, 0, ctx.cards)).not.toContain(stallion.id);
    expect(hasTrait(state, stallion.id, "Mount", ctx)).toBe(true);
    expect(restrictedLoad(state, rider.id, ctx)).toBe(1);
  });

  it("goes on an ally once, and counts toward the two Restricted attachments a character may have", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const first = put(table.state, "19033", "play");
    const second = put(first.state, "19033", "play");
    const rider = put(second.state, "rider", "play");
    let state = syncConstants(run(rider.state, ctx), ctx);
    state = trigger(state, first.id, "19033:action:1", ctx);
    // The other Stallion is an ally it could go on too: the player chooses.
    state = send(state, { type: "Choose", optionId: rider.id }, ctx);
    state = syncConstants(run(state, ctx), ctx);
    expect(state.cards[second.id]?.host).toBeNull();
    // The second Stallion has no other ally to go on than the one that has a copy (Limit 1 per ally): its Action is not offered, so nothing is paid for nothing (19033:A:2).
    expect(triggers(state, ctx, "19033:action:1").filter((intent) => intent.type === "Trigger" && intent.cardId === second.id)).toEqual([]);
    const again = state;
    expect(again.cards[second.id]?.host).toBeNull();
    expect(again.cards[rider.id]?.attachments).toEqual([first.id]);
    // Two other Restricted attachments and the Stallion are one too many.
    const one = put(again, "restricted1", "play");
    const two = put(one.state, "restricted2", "play");
    const loaded = syncConstants(attachTo(attachTo(two.state, one.id, rider.id), two.id, rider.id), ctx);
    expect(restrictedLoad(loaded, rider.id, ctx)).toBe(3);
    expect(enforceRestricted(loaded, rider.id, ctx, []).stack.length).toBeGreaterThan(loaded.stack.length);
  });
});
