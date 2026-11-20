// Rules: rr.response, rr.the-word-choose, rr.step-7-3, rr.damage (data/rules/entries.json).
// The healing group of the misc family, run through its real records (src/effects/authored/families/misc.ts): choosing a player
// and healing the cards that player controls, Responses to healing and readying, and the Response that follows the resource draw.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { RECORDS } from "../../../effects/authored/families/misc.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { doRefresh } from "../../engine/refresh.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { attach, damage, miscCtx } from "./fixture.ts";
import { offered, passResponses, play, put, run, seat, send, trigger, triggers } from "../play/fixture.ts";

const ctx = miscCtx(RECORDS);
// Cram's records are the player pool's (src/effects/authored/pool/OHaUH.ts).
const cramCtx = miscCtx([...RECORDS, ...EFFECTS.filter((effect) => effect.cardCode === "131011")]);

describe("choose a player, then heal what that player controls", () => {
  it("Beorn's Hospitality heals all damage on each hero of the chosen player only (01068:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const event = put(table.state, "01068", "hand");
    let state = event.state;
    for (const hero of table.heroes) state = damage(state, hero, 2);
    state = play(state, event.id, ctx);
    expect(state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    state = send(state, { type: "Choose", optionId: "seat:1" }, ctx);
    // Seat 1's heroes are the last two.
    expect(table.heroes.map((id) => state.cards[id]?.damage)).toEqual([2, 2, 0, 0]);
  });

  it("Galadhrim Healer heals 1 damage from each hero of the chosen player when it enters play (10147:A:1)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const healer = put(table.state, "10147", "hand");
    let state = healer.state;
    for (const hero of table.heroes) state = damage(state, hero, 2);
    state = run(play(state, healer.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    state = trigger(state, healer.id, "10147:response:1", ctx);
    state = send(state, { type: "Choose", optionId: "seat:0" }, ctx);
    expect(table.heroes.map((id) => state.cards[id]?.damage)).toEqual([1, 1, 2, 2]);
  });

  it("Dale Messenger heals only the characters with a player card attachment (22111:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const messenger = put(table.state, "22111", "hand");
    const blade = put(messenger.state, "blade", "play");
    let state = attach(blade.state, blade.id, table.heroes[0] ?? "");
    for (const hero of table.heroes) state = damage(state, hero, 2);
    state = run(play(state, messenger.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    state = trigger(state, messenger.id, "22111:response:1", ctx);
    expect(state.cards[table.heroes[0] ?? ""]?.damage).toBe(1);
    expect(state.cards[table.heroes[1] ?? ""]?.damage).toBe(2);
  });
});

describe("healing responses", () => {
  it("Elrond heals 1 more damage from a character healed by another card effect, and not from his own (04128:A:2)", () => {
    const table = seat(1, ["04128", "rohan"]);
    const rohan = table.heroes[1] ?? "";
    const healer = put(damage(table.state, rohan, 3), "10147", "hand");
    let state = run(play(healer.state, healer.id, ctx, [{ heroId: rohan, amount: 2 }]), ctx);
    state = trigger(state, healer.id, "10147:response:1", ctx);
    // The Healer's heal is a card effect: Elrond's Response is offered.
    expect(triggers(state, ctx, "04128:response:1")).toHaveLength(1);
    state = trigger(state, table.heroes[0] ?? "", "04128:response:1", ctx);
    expect(state.cards[rohan]?.damage).toBe(1);
    // His own heal is announced to other cards, but it is not another card effect: he is not offered it again.
    expect(triggers(run(state, ctx), ctx, "04128:response:1")).toEqual([]);
  });

  it("Silvan Tracker heals 1 damage from a Silvan character that readies in the refresh phase (02102:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const tracker = put(table.state, "02102", "play");
    const ally = put(tracker.state, "17035", "play");
    let state = updateCard(updateCard(ally.state, ally.id, { exhausted: true, damage: 2 }), tracker.id, { exhausted: true });
    state = { ...state, phase: "Refresh", mode: "refresh", window: null };
    state = run(doRefresh(state, ctx, []), ctx);
    expect(state.window?.kind).toBe("response");
    const offers = triggers(state, ctx, "02102:response:1");
    expect(offers).toHaveLength(1);
    state = trigger(state, tracker.id, "02102:response:1", ctx);
    state = passResponses(state, ctx);
    expect(state.cards[ally.id]?.damage).toBeLessThan(2);
  });
});

describe("choose one", () => {
  it("Elrond (ally) offers heal, discard a Condition, or each player draws, and only what can be done (142005:A:2)", () => {
    const table = seat(2, ["dwarf", "rohan"]);
    const elrond = put(table.state, "142005", "hand");
    const deck0 = put(elrond.state, "filler", "deck", 0);
    const deck1 = put(deck0.state, "filler", "deck", 1);
    let state = run(play(deck1.state, elrond.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    state = trigger(state, elrond.id, "142005:response:1", ctx);
    // No damaged hero and no Condition: only the draw is possible, so it is taken without asking.
    expect(state.seats[0]?.hand).toContain(deck0.id);
    expect(state.seats[1]?.hand).toContain(deck1.id);
  });

  it("Athelas heals all damage on a character, and may discard a Condition attachment from it (09011:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const athelas = put(table.state, "09011", "play");
    const wound = spawn(athelas.state, "wound", { zone: "attached" });
    let state = attach(attach(wound.state, athelas.id, table.heroes[0] ?? ""), wound.id, table.heroes[1] ?? "");
    state = damage(state, table.heroes[1] ?? "", 3);
    state = trigger(state, athelas.id, "09011:action:1", ctx);
    expect(state.window).toMatchObject({ kind: "choose" });
    state = send(state, { type: "Choose", optionId: table.heroes[1] ?? "" }, ctx);
    expect(state.cards[table.heroes[1] ?? ""]?.damage).toBe(0);
    expect(state.cards[table.heroes[0] ?? ""]?.exhausted).toBe(true);
    expect(state.cards[athelas.id]?.zone).toBe("discard");
    expect(state.window).toMatchObject({ kind: "choose", options: expect.arrayContaining(["discard", "keep"]) });
    state = send(state, { type: "Choose", optionId: "discard" }, ctx);
    expect(state.cards[wound.id]?.zone).not.toBe("attached");
  });

  it("Cram readies the hero it was attached to after its cost discards it (131011:A:2)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const cram = put(table.state, "131011", "play");
    const hero = table.heroes[0] ?? "";
    let state = updateCard(attach(cram.state, cram.id, hero), hero, { exhausted: true });
    state = trigger(state, cram.id, "131011:action:1", cramCtx);
    expect(state.cards[cram.id]?.zone).toBe("discard");
    expect(state.cards[hero]?.exhausted).toBe(false);
  });

  // A record that discards itself as its cost and then reads its host: every host read goes through refCard or hostOf (src/rules/interpret/amounts.ts), not only Ready.
  describe("host reads after a cost that discards the source (EffectData.host)", () => {
    const record = (id: string, instructions: unknown[]): Effect =>
      ({ id, cardCode: "131011", lines: ["131011:A:2"], timing: "action", cost: { kind: "discardSelf" }, instructions }) as unknown as Effect;
    const hostCtx = miscCtx([
      ...RECORDS,
      ...EFFECTS.filter((effect) => effect.cardCode === "131011"),
      record("fixture:heal", [{ verb: "Heal", amount: 2, target: "host" }, { verb: "AddResources", amount: 2, to: "host" }]),
      record("fixture:pick", [{ verb: "Pick", pick: { type: "hero", control: "any", isHost: true } }, { verb: "AddResources", amount: 1, to: "picked" }]),
      record("fixture:when", [{ verb: "AddResources", amount: 3, to: "host", when: { kind: "matches", card: "host", pick: { type: "hero", control: "any", state: "exhausted" } } }]),
    ]);
    const setUp = () => {
      const table = seat(1, ["dwarf", "rohan"]);
      const cram = put(table.state, "131011", "play");
      const hero = table.heroes[0] ?? "";
      return { cram, hero, state: updateCard(damage(attach(cram.state, cram.id, hero), hero, 3), hero, { exhausted: true }) };
    };

    it("heals the host and adds resources to it", () => {
      const { cram, hero, state } = setUp();
      const after = trigger(state, cram.id, "fixture:heal", hostCtx);
      expect(after.cards[cram.id]?.zone).toBe("discard");
      expect(after.cards[hero]).toMatchObject({ damage: 1, resources: (state.cards[hero]?.resources ?? 0) + 2 });
    });

    it("picks the host with isHost", () => {
      const { cram, hero, state } = setUp();
      const after = trigger(state, cram.id, "fixture:pick", hostCtx);
      expect(after.cards[hero]?.resources).toBe((state.cards[hero]?.resources ?? 0) + 1);
    });

    it("reads a host condition of an instruction", () => {
      const { cram, hero, state } = setUp();
      const after = trigger(state, cram.id, "fixture:when", hostCtx);
      expect(after.cards[hero]?.resources).toBe((state.cards[hero]?.resources ?? 0) + 3);
    });
  });

  it("Miner of the Iron Hills discards a Condition attachment from play (01061:A:1)", () => {
    const table = seat(1, ["dwarf", "rohan"]);
    const miner = put(table.state, "01061", "hand");
    const wound = spawn(miner.state, "wound", { zone: "attached" });
    const hooked = attach(wound.state, wound.id, table.heroes[0] ?? "");
    let state = run(play(hooked, miner.id, ctx, [{ heroId: table.heroes[0] ?? "", amount: 2 }]), ctx);
    state = trigger(state, miner.id, "01061:response:1", ctx);
    expect(state.cards[wound.id]?.zone).not.toBe("attached");
    void offered;
  });
});
