// Rules: rr.victory, rr.winning-the-game, rr.player-elimination, rr.first-player, rr.search, rr.encounter-deck, rr.running-out-of-cards, dwd.doors-of-durin, rr.attachment-cards, rr.damage (data/rules/entries.json); ledger lines 04063:A:1, 04063:B:1, 04064:B:2, 04065:A:2, 04073:A:1,
// 04074:A:1, 040076:A:1, 901501:A:4, 901503:A:1, 901505:A:1, 901506:A:1.
// The multi-step mechanics of The Watcher in the Water, each on a table of the scene kit and each title starting with the line it covers: the win at once when the last of 5 progress and 3 victory points comes, the Nightmare win that needs both cards, Wrapped!'s end of the
// round, Grasping with several attackers and Thrashing for a first player who is not the attacker, Writhing's undefended attack, Banks of Sirannon's stacking, Hideous Depths after a look and a search, and the corner cases of the Setup and Doors of Durin's Action.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { destroyCard, modifiedStat } from "../../../rules/core/keywords.ts";
import { crossBoundary } from "../../../rules/windows/triggers.ts";
import { settle } from "../../../rules/engine/machine.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { finish, idOf, legalIntents, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type Run } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "the-watcher-in-the-water";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
type Made = ReturnType<typeof table>;
const codes = (state: ScenarioState, ids: readonly string[]) => ids.map((id) => state.cards[id]?.code);

/** Doors of Durin's Action: the first player discards the hand's cards named, the top card of the deck is discarded, and the game settles. */
function doorsAction(layout: Layout, discarded: readonly string[]) {
  const made = table({ active: "04065", hand: ["filler", "event"], deck: ["f0", "f0"], ...layout });
  const doors = idOf(made.state, "04065");
  let next = 0;
  const pick = (state: ScenarioState) => {
    const options = state.window?.kind === "choose" ? state.window.options : [];
    const option = options.find((id) => state.cards[id]?.code === discarded[next]);
    if (option) {
      next += 1;
      return option;
    }
    return "done";
  };
  const run = resolveRecords(made.state, made.ctx, "04065", "action", doors, pick);
  const steps: EngineStep[] = [];
  return { made, doors, state: settle(run.state, made.ctx, steps) };
}

describe("04063:A:1 and 04063:B:1 the Setup shuffle and the reveals", () => {
  it("04063:A:1 shuffles the encounter deck at Setup (the order changes)", () => {
    const deck = ["04073", "04074", "04075", "f0", "f3", "04068", "04069", "04070"];
    const made = table({ stage: "04063", deck, seed: 5 });
    const before = made.state.encounterDeck.map((id) => made.state.cards[id]?.code);
    const done = resolveRecords(made.state, made.ctx, "04063", "setup", idOf(made.state, "04063"));
    const after = done.state.encounterDeck.map((id) => done.state.cards[id]?.code);
    expect([...after].sort()).toEqual([...before].sort());
    expect(after).not.toEqual(before);
  });

  it("04063:B:1 reveals nothing when the staging area already holds that Threat, twice the players (4 two-handed)", () => {
    const made = table({ seats: 2, stage: "04063", side: "B", staging: ["f3", "f3"], deck: ["f0", "f0"] });
    const done = resolveRecords(made.state, made.ctx, "04063", "whenRevealed", idOf(made.state, "04063"));
    expect(done.state.encounterDeck).toHaveLength(2);
  });

  it("04063:B:1 reveals two-handed until the staging area holds 4 Threat", () => {
    const made = table({ seats: 2, stage: "04063", side: "B", deck: ["f3", "f0", "f3", "f0"] });
    const done = resolveRecords(made.state, made.ctx, "04063", "whenRevealed", idOf(made.state, "04063"));
    expect(codes(done.state, done.state.encounterDeck)).toEqual(["f0"]);
  });

  it("04063:B:1 stops when the deck and the discard pile are empty", () => {
    const made = table({ stage: "04063", side: "B", deck: ["f0"] });
    const done = resolveRecords(made.state, made.ctx, "04063", "whenRevealed", idOf(made.state, "04063"));
    expect(done.state.cards[idOf(done.state, "f0")]?.zone).toBe("staging");
    expect(done.state.lost).toBe(false);
  });
});

describe("04064:B:2 and 901501:A:4 the win", () => {
  it("04064:B:2 the game is won at once, in any phase, when Doors of Durin reaches the victory display with the 5 progress already on the stage", () => {
    for (const phase of ["Quest", "Combat"] as const) {
      const { doors, state } = doorsAction({ stage: "04064", progress: 5, phase }, ["filler"]);
      expect(state.cards[doors]?.zone, phase).toBe("victory");
      expect(state.stageCleared, phase).toBe(true);
    }
  });

  it("04064:B:2 the stage waits while fewer than 3 victory points are in the display", () => {
    const { state } = doorsAction({ stage: "04064", progress: 5 }, []);
    expect(state.stageCleared).toBe(false);
  });

  it("901501:A:4 on Nightmare Doors of Durin alone does not win; The Watcher destroyed in the staging area after it does", () => {
    const { made, state } = doorsAction({ nightmare: "901501", stage: "04064", progress: 5, staging: ["901502"] }, ["filler"]);
    expect(state.stageCleared).toBe(false);
    expect(codes(state, state.victory)).toEqual(["04065"]);
    const steps: EngineStep[] = [];
    const killed = settle(destroyCard(state, idOf(state, "901502"), made.cards, steps), made.ctx, steps);
    expect(codes(killed, killed.victory).sort()).toEqual(["04065", "901502"]);
    expect(killed.stageCleared).toBe(true);
  });

  it("901501:A:4 on Nightmare The Watcher alone does not win either", () => {
    const made = table({ nightmare: "901501", stage: "04064", progress: 5, staging: ["901502"] });
    const steps: EngineStep[] = [];
    const killed = settle(destroyCard(made.state, idOf(made.state, "901502"), made.cards, steps), made.ctx, steps);
    expect(codes(killed, killed.victory)).toEqual(["901502"]);
    expect(killed.stageCleared).toBe(false);
  });
});

describe("04065:A:2 Doors of Durin's Action in the corner cases", () => {
  it("04065:A:2 with the encounter deck and its discard pile empty nothing is discarded and Doors stays", () => {
    const { doors, state } = doorsAction({ deck: [] }, ["filler"]);
    expect(state.cards[doors]?.zone).toBe("activeLocation");
    expect(state.lost).toBe(false);
  });
});

describe("040076:A:1 Wrapped! at the end of the round and with no hero to take it", () => {
  it("040076:A:1 with a Wrapped! on every hero the new one is discarded and attaches to none", () => {
    const made = table({ phase: "Quest", attached: [{ code: "040076", to: "dh1" }, { code: "040076", to: "dh2" }], deck: ["f0", "f0"] });
    const steps: EngineStep[] = [];
    const revealed = revealFromTop(made.state, made.ctx, "040076", steps);
    const done = finish({ state: revealed.state, steps }, made.ctx);
    expect(done.state.cards[revealed.id]?.zone).toBe("encounterDiscard");
    expect(done.state.cards[revealed.id]?.host ?? null).toBeNull();
  });

  it("040076:A:1 at the end of the round the last hero is discarded and the player is eliminated: the game is lost", () => {
    const made = table({ attached: [{ code: "040076", to: "dh1" }, { code: "040076", to: "dh2" }] });
    const laid = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.code === "040076").reduce((next, card) => ({ ...next, cards: { ...next.cards, [card.id]: { ...card, zone: "attached" as const } } }), state);
    const steps: EngineStep[] = [];
    const crossed = crossBoundary({ ...syncConstants(laid(made.state), made.ctx), phase: "Planning", boundaryPhase: "End of round", window: null }, made.ctx, steps);
    const done = settle(crossed, made.ctx, steps);
    expect(done.seats[0]?.heroes ?? []).toHaveLength(0);
    expect(done.lost).toBe(true);
  });
});

/** The first hero (and the second, with `both`) attacks the enemy engaged with the first seat. */
function attackWith(layout: Layout, enemy: string, both: boolean) {
  const made = table({ phase: "PlayerAttacks", engaged: [{ code: enemy }], ...layout });
  const state = syncConstants(made.state, made.ctx);
  const target = idOf(state, enemy);
  const run = send(start(state), { type: "DeclareAttackers", enemyId: target, attackerIds: both ? [made.hero, made.hero2] : [made.hero] }, made.ctx);
  return { made, enemy: target, run };
}

describe("04073:A:1 and 04074:A:1 Grasping and Thrashing Tentacle with several attackers", () => {
  it("04073:A:1 the first player chooses which attacker carries it, and both attackers stay exhausted", () => {
    const { made, enemy, run } = attackWith({ deck: ["04066", "f0", "f0"] }, "04073", true);
    expect(run.state.window?.kind).toBe("choose");
    const options = run.state.window?.kind === "choose" ? run.state.window.options : [];
    expect(options).toEqual([made.hero, made.hero2]);
    const done = finish(send(run, { type: "Choose", optionId: made.hero2 }, made.ctx), made.ctx);
    expect(done.state.cards[enemy]?.zone).toBe("attached");
    expect(done.state.cards[enemy]?.host).toBe(made.hero2);
    expect(done.state.cards[made.hero]?.exhausted).toBe(true);
    expect(done.state.cards[made.hero2]?.exhausted).toBe(true);
    expect(modifiedStat(done.state, done.state.cards[made.hero2]!, "attack", made.cards)).toBe(0);
    expect(modifiedStat(done.state, done.state.cards[made.hero]!, "attack", made.cards)).toBeGreaterThan(0);
  });

  it("04074:A:1 two-handed the choice is the first player's even when he is not the attacker, and the damage lands on an attacker", () => {
    const { made, enemy, run } = attackWith({ seats: 2, firstPlayer: 1, deck: ["04066", "f0", "f0"] }, "04074", true);
    expect(run.state.window?.kind).toBe("choose");
    expect(run.state.activeSeat).toBe(1);
    const done = finish(send(run, { type: "Choose", optionId: made.hero }, made.ctx), made.ctx);
    expect(done.state.cards[made.hero]?.damage).toBe(4);
    expect(done.state.cards[made.hero2]?.damage ?? 0).toBe(0);
    expect(done.state.cards[enemy]?.damage ?? 0).toBe(0);
  });
});

describe("901503:A:1 Writhing Tentacle with an undefended attack", () => {
  it("901503:A:1 an undefended attack leaves it engaged as an enemy: there is no defender to attach to", () => {
    const made = table({ phase: "Encounter", staging: ["901503"], deck: ["04066", "f0", "f0", "f0"], threat: [60, 20] });
    const state = syncConstants(made.state, made.ctx);
    const enemy = idOf(state, "901503");
    let run: Run = send(start(state), { type: "Engage", enemyId: enemy }, made.ctx);
    for (let guard = 0; guard < 40 && (run.state.pendingAttack != null || run.state.window?.kind === "choose" || run.state.window?.kind === "look" || run.state.window?.kind === "defense"); guard += 1) {
      const window = run.state.window;
      if (window?.kind === "defense") run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
      else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      else if (window?.kind === "look") run = send(run, { type: "Pass" }, made.ctx);
      else {
        const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass");
        if (!pass) break;
        run = send(run, pass as PlayerIntent, made.ctx);
      }
    }
    expect(run.state.cards[enemy]?.zone).toBe("engaged");
  });
});

describe("901505:A:1 Banks of Sirannon", () => {
  it("901505:A:1 each copy in the staging area gives every Tentacle enemy +2 Defense: two copies give +4, one in play for each", () => {
    const one = table({ staging: ["901505", "04072", "04073"], nightmare: "901501" });
    const two = table({ staging: ["901505", "901505", "04072", "04073"], nightmare: "901501" });
    const defense = (made: Made, code: string) => modifiedStat(made.state, made.state.cards[idOf(made.state, code)]!, "defense", made.cards);
    expect(defense(one, "04072") - 7).toBe(2);
    expect(defense(two, "04072") - 7).toBe(4);
    expect(defense(two, "04073") - 0).toBe(4);
  });
});

describe("901506:A:1 Hideous Depths after a look and a search", () => {
  const lookAction = (instructions: Effect["instructions"]): Effect => ({ id: "04066:whenRevealed:9", cardCode: "04066", lines: ["04066:A:1"], timing: "whenRevealed", instructions });
  const deck = ["04073", "04074", "04075", "f0", "f3", "04068", "04069", "04070"];
  const orderAfter = (record: Effect, depths: boolean, seed: number) => {
    const made = table({ staging: depths ? ["04066", "901506"] : ["04066"], deck, seed });
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, record] };
    const done = resolveRecords(made.state, ctx, "04066", "whenRevealed", idOf(made.state, "04066"));
    return codes(done.state, done.state.encounterDeck);
  };

  it("901506:A:1 a look at the top cards (a player card's Action, Henamarth Riversong's) is followed by a shuffle of the deck", () => {
    const record = lookAction([{ verb: "LookAtTop", count: 1 }]);
    let moved = 0;
    for (const seed of [1, 2, 3, 4]) {
      expect(orderAfter(record, false, seed), `seed ${seed} without`).toEqual(deck);
      if (orderAfter(record, true, seed).join() !== deck.join()) moved += 1;
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("901506:A:1 a search of the deck is followed by a shuffle of what is left", () => {
    const record = lookAction([{ verb: "SearchMove", type: "enemy", trait: "Tentacle", to: "staging" }]);
    const rest = deck.filter((code) => code !== "04073");
    let moved = 0;
    for (const seed of [1, 2, 3, 4]) {
      expect(orderAfter(record, false, seed), `seed ${seed} without`).toEqual(rest);
      const shuffled = orderAfter(record, true, seed);
      expect([...shuffled].sort()).toEqual([...rest].sort());
      if (shuffled.join() !== rest.join()) moved += 1;
    }
    expect(moved).toBeGreaterThan(0);
  });
});
