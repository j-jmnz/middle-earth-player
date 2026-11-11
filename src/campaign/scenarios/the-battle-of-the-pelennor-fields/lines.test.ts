// Rules: mec113.minas-tirith, mec113.assault, mec113.setting-up-the-game, rr.cancel, rr.forced, rr.travel, rr.quest-advancement, rr.ownership-and-control, rr.in-play-and-out-of-play, rr.engaged, rr.damage, rr.lasting-effects, faq.lasting-effects, rr.exhaust (data/rules/entries.json);
// ledger lines 145014:A:5, 145046:A:1, 145048:A:1, 145051:A:2, 145058:A:1, 145059:A:1, 145060:A:2, 145073:B:1, 145074:B:3, 145075:A:1, 145075:B:3, 145076:A:1, 145077:B:3, 145078:B:1, 145080:A:1. What a card-spec row cannot hold on The Battle of the Pelennor Fields' own cards: a joint
// attack, damage that overflows City Wall, a cancel that is itself canceled, a bar seen only in what is refused (travel, advance, an attacker), allies with an owner in the staging area, a lasting effect read later in the phase, and the order two Forced effects of one reveal resolve in. Each test
// title starts with the line it covers (scripts/checks/spec-coverage.test.ts).
import { describe, expect, it } from "vitest";

import { definePrinted } from "../../../rules/core/printed.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { canAttack } from "../../../rules/combat/combat.ts";
import { legalIntents, legalTargets, reduce, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { announce, answer, endPhase } from "../../../../test/harness/card-spec.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { finish, idOf, revealFromTop, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-battle-of-the-pelennor-fields";
const CITY = "145043";
const WALL = "145046";
const SORCERER = "145080";
const CAPTAIN = "145079";
const at = (layout: Layout = {}) => tableFromLayout(ID, layout);
const played = (layout: Layout, act: Parameters<typeof play>[1]["act"]) => play(ID, { line: "lines", layout, act, expect: [] }, EFFECTS, false);

describe("the Esquires", () => {
  it("145014:A:5 Esquire of Rohan gives +1 Attack only while attacking with another Rohan character", () => {
    const made = at({ stage: "145074", attached: [{ code: "145014", to: "dh1" }, { code: "145014", to: "dh2" }], engaged: [{ code: "f3", seat: 0 }] });
    const enemy = idOf(made.state, "f3");
    const striking = (attackerIds: readonly string[]): ScenarioState => syncConstants({ ...made.state, pendingStrike: { seat: 0, enemyId: enemy, attackerIds } }, made.ctx);
    const attack = (state: ScenarioState) => modifiedStat(state, state.cards[made.hero]!, "attack", made.ctx.cards);
    expect(attack(striking([made.hero, made.hero2]))).toBe(3);
    expect(attack(striking([made.hero]))).toBe(2);
    expect(attack(made.state)).toBe(2);
  });
});

describe("City Wall", () => {
  it("145046:A:1 the damage beyond its quest points goes on Minas Tirith, and the Wall is discarded when it is full (145046:A:2)", () => {
    const made = at({ active: WALL, staging: [CITY, "f3", "f3"], seats: 2 });
    const wall = idOf(made.state, WALL);
    const filled = syncConstants(updateCard(made.state, wall, { damage: 3 }), made.ctx);
    const done = resolveRecords(filled, made.ctx, CITY, "forced", idOf(filled, CITY), () => "").state;
    expect(done.cards[idOf(done, CITY)]?.damage).toBe(1);
    expect(done.cards[wall]?.zone).toBe("encounterDiscard");
    expect(done.seats.map((seat) => seat.threat)).toEqual([31, 31]);
  });
});

describe("Fire-filled Trench", () => {
  // A stand-in treachery that raises each threat by 5 and a stand-in event that cancels it and raises the player's own threat by 1: the Trench cancels the event's effects instead.
  function reveal(withTrench: boolean) {
    const made = at({ staging: withTrench ? ["145048"] : [], heroResources: 3 });
    made.cards.set("bad", definePrinted({ code: "bad", name: "Bad Omen", type: "treachery" }));
    made.cards.set("hasty", definePrinted({ code: "hasty", name: "Hasty Stroke", type: "event", sphere: "tactics", cost: 1 }));
    const effects = [
      ...made.ctx.effects,
      { id: "bad:whenRevealed:1", cardCode: "bad", lines: ["bad:A:1"], timing: "whenRevealed" as const, instructions: [{ verb: "RaiseThreat" as const, amount: 5 }] },
      { id: "hasty:response:1", cardCode: "hasty", lines: ["hasty:A:1"], timing: "response" as const, trigger: "whenRevealedPending" as const, cost: { kind: "playEvent" as const }, instructions: [{ verb: "CancelEffect" as const }, { verb: "RaiseThreat" as const, amount: 1 }] },
    ];
    const ctx = { ...made.ctx, effects };
    const hand = spawn(made.state, "hasty", { zone: "hand", seat: 0 });
    const revealed = revealFromTop(syncConstants(hand.state, ctx), ctx, "bad", []);
    const intent = legalIntents(revealed.state, ctx).find((offered) => offered.type === "Trigger" && offered.effectId === "hasty:response:1");
    if (!intent) throw new Error("the cancel is not offered");
    let current = settle(expectOk(reduce(revealed.state, { ...(intent as PlayerIntent), payments: [{ heroId: made.hero, amount: 1 }] } as PlayerIntent, ctx)).state, ctx, []);
    for (let step = 0; step < 12 && current.stack.length > 0; step += 1) {
      const pass = legalIntents(current, ctx).find((offered) => offered.type === "Pass");
      if (!pass) break;
      current = settle(expectOk(reduce(current, pass, ctx)).state, ctx, []);
    }
    return { state: current, hasty: hand.id, trench: withTrench ? idOf(made.state, "145048") : "" };
  }

  it("145048:A:1 a cancel of a revealed treachery is canceled instead: the treachery resolves, the event is spent and the Trench is discarded", () => {
    const { state, hasty, trench } = reveal(true);
    expect(state.seats[0].threat).toBe(33);
    expect(state.cards[hasty]?.zone).toBe("discard");
    expect(state.cards[trench]?.zone).not.toBe("staging");
  });

  it("145048:A:1 with no Trench in play the same event cancels the treachery", () => {
    const { state } = reveal(false);
    expect(state.seats[0].threat).toBe(29);
  });
});

describe("War Mûmak", () => {
  it("145051:A:2 takes no more than 3 damage each round, whatever deals it", () => {
    const made = at({ staging: ["145051"] });
    const mumak = idOf(made.state, "145051");
    const once = placeDamage(made.state, mumak, 5, made.ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(once.cards[mumak]?.damage).toBe(3);
    const twice = placeDamage(once, mumak, 2, made.ctx.cards, [], "framework", ruleCause("rr.damage"));
    expect(twice.cards[mumak]?.damage).toBe(3);
  });
});

describe("the treacheries", () => {
  it("145058:A:1 removes the hero from the quest as Black Dart attaches to it", () => {
    const done = played({ stage: "145074", committed: ["dh1"] }, [{ act: "reveal", code: "145058" }, answer("dh1")]).run.state;
    expect(done.cards[idOf(done, "dh1")]?.committed).toBe(false);
    expect(done.cards[idOf(done, "145058")]?.zone).toBe("attached");
  });

  it("145059:A:1 the option of 1 damage to each exhausted character is offered only with an exhausted character, and does not touch the others", () => {
    const made = at({ staging: [CITY], play: ["ally"] });
    const tired = syncConstants(updateCard(made.state, made.hero, { exhausted: true }), made.ctx);
    const opened = revealFromTop(tired, made.ctx, "145059", []).state;
    expect(opened.window?.kind).toBe("choose");
    const done = finish({ state: opened, steps: [] }, made.ctx, () => "exhausted").state;
    expect(done.cards[made.hero]?.damage).toBe(1);
    expect(done.cards[made.hero2]?.damage).toBe(0);
    expect(done.cards[idOf(done, "ally")]?.damage).toBe(0);
    expect(done.cards[idOf(done, CITY)]?.damage).toBe(0);
  });

  it("145060:A:2 an ally that reaches the discard pile later in the phase counts too (a lasting effect is read live)", () => {
    const made = at({ play: ["ally"] });
    const done = played({ play: ["ally"] }, { act: "reveal", code: "145060" }).run.state;
    expect(stagingThreat(done, made.ctx.cards)).toBe(1);
    const later = spawn(done, "ally", { zone: "discard", seat: 0 }).state;
    expect(stagingThreat(later, made.ctx.cards)).toBe(2);
  });
});

describe("the stages", () => {
  it("145073:B:1 skips the quest phase and the combat phase: planning is followed by travel, and no combat phase follows the encounter phase", () => {
    expect(played({ phase: "Planning" }, endPhase).run.state.phase).toBe("Travel");
    // With an enemy engaged the combat phase has an attack window: stage 2 plays it, stage 1 goes from the encounter phase to the next round.
    const phases = (stage: string): { seen: Set<string>; rounds: number } => {
      const made = at({ phase: "Encounter", stage, engaged: [{ code: "f3", seat: 0 }] });
      let run = start(made.state);
      const seen = new Set<string>();
      for (let guard = 0; guard < 40 && run.state.round === made.state.round; guard += 1) {
        const pass = legalIntents(run.state, made.ctx).find((offered) => offered.type === "Pass" || offered.type === "DeclineEngage" || offered.type === "DeclineAttack");
        if (!pass) break;
        run = send(run, pass as PlayerIntent, made.ctx);
        seen.add(run.state.phase);
      }
      return { seen, rounds: run.state.round - made.state.round };
    };
    expect(phases("145074").seen.has("Combat")).toBe(true);
    expect(phases("145073").seen.has("Combat")).toBe(false);
    expect(phases("145073").rounds).toBe(1);
  });

  it("145074:B:3 an ally that the damage destroys goes to its owner's discard pile", () => {
    const made = at({ stage: "145074", staging: ["f3", "f3", "ally"] });
    const staged = idOf(made.state, "ally");
    const owned = updateCard(made.state, staged, { owner: 0, controller: null });
    const done = resolveRecords(syncConstants(owned, made.ctx), made.ctx, "145074", "forced", idOf(owned, "145074"), (state) => state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "").state;
    expect(done.cards[staged]?.zone).toBe("discard");
    expect(done.seats[0].discard).toContain(staged);
  });

  it("145075:A:1 each player takes control of the allies they own in the staging area, exhausted", () => {
    const made = at({ stage: "145075", staging: ["ally"], setAside: [CITY, "145044", CAPTAIN] });
    const staged = idOf(made.state, "ally");
    const owned = updateCard(made.state, staged, { owner: 0, controller: null });
    const done = resolveRecords(syncConstants(owned, made.ctx), made.ctx, "145075", "whenRevealed", idOf(owned, "145075"), () => "").state;
    const card = done.cards[staged]!;
    expect([card.zone, card.controller, card.exhausted]).toEqual(["play", 0, true]);
  });

  it("145075:B:3 the players cannot travel to a location with the Pelennor trait, and can to another", () => {
    const made = at({ phase: "Travel", stage: "145075", staging: ["145047", "145049"] });
    const targets = legalTargets({ ...made.state, window: { kind: "travel" } }, { type: "Travel" }, made.ctx);
    expect(targets).not.toContain(idOf(made.state, "145047"));
    expect(targets).toContain(idOf(made.state, "145049"));
  });

  it("145076:A:1 each player puts an ally of a sphere of a hero they control from the top 10 cards into play; a neutral ally is not taken", () => {
    const made = at({ stage: "145076", deckOf: ["filler", "ally"] });
    made.cards.set("tally", definePrinted({ code: "tally", name: "Tactics ally", type: "ally", sphere: "tactics", cost: 1, willpower: 1, attack: 1, defense: 1, health: 2 }));
    const deck = spawn(made.state, "tally", { zone: "deck", seat: 0 }, "down");
    const done = resolveRecords(syncConstants(deck.state, made.ctx), made.ctx, "145076", "whenRevealed", idOf(deck.state, "145076"), (state) => state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "").state;
    expect(done.cards[deck.id]?.zone).toBe("play");
    expect(done.cards[idOf(done, "ally")]?.zone).toBe("deck");
  });

  it("145077:B:3 the stage cannot advance unless Aragorn is in play and The Witch-king is in the victory display", () => {
    const barred = (layout: Layout) => {
      const made = at({ stage: "145077", ...layout });
      return restricted(syncConstants(made.state, made.ctx), made.ctx, "advance").length > 0;
    };
    expect(barred({ staging: [SORCERER] })).toBe(true);
    expect(barred({ play: ["145001"], staging: [SORCERER] })).toBe(true);
    expect(barred({ victory: [SORCERER] })).toBe(true);
    expect(barred({ play: ["145001"], victory: [SORCERER] })).toBe(false);
  });

  it("145078:B:1 the Harad enemies join the staging area once stage 5A has resolved, after The Witch-king", () => {
    const made = at({ campaign: true, stage: "145076", setAside: ["144028"], seats: 2, deck: ["f3", "145057"] });
    const done = played({ campaign: true, stage: "145076", setAside: ["144028"], seats: 2, deck: ["f3", "145057"] }, announce("endOfPhase", "145076")).run.state;
    const order = done.staging.map((id) => done.cards[id]?.code);
    expect(order.indexOf(SORCERER)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("144028")).toBeGreaterThan(order.indexOf(SORCERER));
    expect(done.cards[idOf(done, "145077")]?.zone).toBe("questStage");
    expect(made.state.staging).toEqual([]);
  });
});

describe("The Witch-king", () => {
  it("145080:A:1 only the engaged player's characters can declare attackers against him, ranged or not", () => {
    const made = at({ seats: 2, stage: "145077", engaged: [{ code: SORCERER, seat: 0 }] });
    const state = syncConstants(made.state, made.ctx);
    const king = idOf(state, SORCERER);
    expect(canAttack(state, 0, made.hero, king, made.ctx.cards)).toBe(true);
    expect(canAttack(state, 1, made.seat1Hero ?? "", king, made.ctx.cards)).toBe(false);
  });
});
