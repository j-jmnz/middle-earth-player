// Rules: rr.response, rr.engage, rr.search, rr.removed-from-game, rr.shadow-effects, mec108.thaurdir (data/rules/entries.json)
// ledger lines 10189:A:1, 10190:A:1, 10191:A:3, 10192:A:1.
// The four boons the campaign card offers, each in a state of its own: Elrond's Champion, Lore of Ancient Arnor, Raiment of the Second Age and Rivendell Skirmishers.
import { describe, expect, it } from "vitest";

import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { moveCard, shadowCards } from "../../../rules/core/zones.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { finish, idOf, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-battle-of-carn-dum";
const CHAMPION_BOON = "10189";
const LORE = "10190";
const RAIMENT = "10191";
const SKIRMISHERS = "10192";
const CAPTAIN_CODE = "10127";
const built = (layout: Layout = {}) => tableFromLayout(SCENARIO, { deck: ["f0", "f0", "f0", "f0", "f0", "f0"], ...layout });
const trigger = (state: ScenarioState, t: ReturnType<typeof built>, code: string): PlayerIntent | undefined => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === idOf(state, code)) as PlayerIntent | undefined;

describe("Elrond's Champion", () => {
  it("10189:A:1 readies after an enemy engages its player, and offers nothing while it is ready", () => {
    const t = built({ phase: "Encounter", staging: ["f3"], play: [CHAMPION_BOON], threat: [60, 28] });
    const champion = idOf(t.state, CHAMPION_BOON);
    const tired = updateCard(t.state, champion, { exhausted: true });
    const engaged = send(start(tired), { type: "Engage", enemyId: idOf(tired, "f3") }, t.ctx);
    expect(engaged.state.cards[idOf(engaged.state, "f3")]?.zone).toBe("engaged");
    const offer = trigger(engaged.state, t, CHAMPION_BOON);
    expect(offer).toBeDefined();
    expect(finish(send(engaged, offer!, t.ctx), t.ctx).state.cards[champion]?.exhausted).toBe(false);
    // Ready already: the Response is not offered.
    const ready = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, "f3") }, t.ctx);
    expect(trigger(ready.state, t, CHAMPION_BOON)).toBeUndefined();
  });
});

describe("Lore of Ancient Arnor", () => {
  // Each seat's discard pile holds its own cards; the Action's picks name them.
  const withDiscards = (seats: 1 | 2) => {
    const t = built({ seats, deckOf: [{ code: "c1", seat: 0 }, { code: "c2", seat: 0 }, { code: "c3", seat: 0 }, { code: "ally", seat: 1 }, { code: "event", seat: 1 }, { code: "filler", seat: 1 }], hand: [] });
    let state = t.state;
    for (const seat of seats === 2 ? [0, 1] : [0]) for (const id of [...state.seats[seat]!.deck]) state = moveCard(state, id, { zone: "discard", seat });
    return { t, state };
  };
  const run = (state: ScenarioState, t: ReturnType<typeof built>) => {
    const offered: { seat: number | undefined; codes: string[] }[] = [];
    const out = resolveRecords(state, t.ctx, LORE, "action", undefined, (current) => {
      if (current.window?.kind !== "choose") return "";
      offered.push({ seat: current.window.seat, codes: current.window.options.map((option) => current.cards[option]?.code ?? option) });
      return current.window.options[0] ?? "";
    });
    return { out, offered };
  };

  it("10190:A:1 has each player return a card from their own discard pile to their hand and shuffle the rest of that pile into their own deck, then removes it from the game", () => {
    const { t, state } = withDiscards(2);
    const { out, offered } = run(state, t);
    expect(offered).toHaveLength(2);
    expect(offered[0]?.codes.sort()).toEqual(["c1", "c2", "c3"]);
    expect(offered[1]?.codes.sort()).toEqual(["ally", "event", "filler"]);
    const [first, second] = [out.state.seats[0]!, out.state.seats[1]!];
    expect(first.hand.map((id) => out.state.cards[id]?.code)).toEqual(["c1"]);
    expect(first.deck.map((id) => out.state.cards[id]?.code).sort()).toEqual(["c2", "c3"]);
    expect(first.discard).toHaveLength(0);
    expect(second.hand.map((id) => out.state.cards[id]?.code)).toEqual(["ally"]);
    expect(second.deck.map((id) => out.state.cards[id]?.code).sort()).toEqual(["event", "filler"]);
    expect(out.state.cards[out.id]?.zone).toBe("removed");
  });

  it("10190:A:1 returns 2 cards when the player is the only player in the game, and nothing for a player with an empty discard pile", () => {
    const { t, state } = withDiscards(1);
    const { out, offered } = run(state, t);
    expect(offered).toHaveLength(2);
    expect(out.state.seats[0]!.hand).toHaveLength(2);
    expect(out.state.seats[0]!.deck).toHaveLength(1);
    const empty = built({ seats: 2 });
    const { out: none, offered: asked } = run(empty.state, empty);
    expect(asked).toHaveLength(0);
    expect(none.state.seats[0]!.hand).toHaveLength(0);
  });
});

describe("Raiment of the Second Age", () => {
  it("10191:A:3 draws 1 card for the attached character's player after it attacks and destroys an enemy", () => {
    const attackWith = (enemy: string) => {
      const t = built({ phase: "PlayerAttacks", engaged: [enemy], attached: [{ code: RAIMENT, to: "dh1" }], deckOf: ["c1", "c2", "c3"] });
      const sent = send(start(t.state), { type: "DeclareAttackers", enemyId: idOf(t.state, enemy), attackerIds: [t.hero] }, t.ctx);
      const done = finish(sent, t.ctx);
      const offer = trigger(done.state, t, RAIMENT);
      const used = offer ? finish(send(done, offer, t.ctx), t.ctx) : done;
      return { handBefore: t.state.seats[0]!.hand.length, hand: used.state.seats[0]!.hand.length, offered: offer != null };
    };
    // 2 Attack + 2 from the Raiment = 4 against Defense 1 destroys the 3 hit points of f3.
    const kill = attackWith("f3");
    expect(kill.offered).toBe(true);
    expect(kill.hand).toBe(kill.handBefore + 1);
  });
});

describe("Rivendell Skirmishers", () => {
  // The encounter phase to the defense window of the attack of `enemy`, which is dealt its shadow card for the attack; the Skirmishers defend.
  const defended = (enemy: string) => {
    const t = built({ phase: "Encounter", engaged: [enemy], play: [SKIRMISHERS], deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    let run = send(start(t.state), { type: "DeclineEngage" }, t.ctx);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass as PlayerIntent, t.ctx);
    }
    const before = shadowCards(run.state.cards[idOf(run.state, enemy)]).length;
    const declared = send(run, { type: "DeclareDefender", defenderId: idOf(run.state, SKIRMISHERS) }, t.ctx);
    return { t, enemy, before, declared };
  };

  it("10192:A:1 discards each shadow card dealt to a non-unique enemy when the Skirmishers exhaust to defend its attack, and offers nothing against a unique enemy", () => {
    const plain = defended("f3");
    expect(plain.before).toBe(1);
    const offer = trigger(plain.declared.state, plain.t, SKIRMISHERS);
    expect(offer).toBeDefined();
    const used = send(plain.declared, offer!, plain.t.ctx);
    expect(shadowCards(used.state.cards[idOf(used.state, "f3")])).toHaveLength(0);
    // Thaurdir is unique: nothing is offered.
    const unique = defended(CAPTAIN_CODE);
    expect(trigger(unique.declared.state, unique.t, SKIRMISHERS)).toBeUndefined();
  });
});
