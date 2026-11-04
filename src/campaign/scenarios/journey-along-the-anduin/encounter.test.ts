// Rules: rr.step-3-3, rr.travel, rr.step-6-4-3, rr.damage, rr.hit-points, rr.optional-engagement, rr.explored, rr.step-7-3, rr.search
// (data/rules/entries.json). The Journey Along the Anduin encounter cards: each line of the ledger (data/printed/mirkwood-paths.json) has a
// record, and these tests run them on a table of plain-number heroes (test/scenarios/journey-along-the-anduin/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { legalIntents, legalTargets } from "../../../rules/engine/legal.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import type { PlayerIntent, ReduceContext } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { spawn } from "../../../rules/core/zones.ts";
import { causeProblems } from "../../../../test/harness/cause-check.ts";
import { anduinTable, fight, loadAnduinWorld, type AnduinLayout, type AnduinWorld } from "../../../../test/scenarios/journey-along-the-anduin/scene.ts";
import { first, type Run, send, start } from "../../../../test/harness/scene-kit.ts";

let world: AnduinWorld;

beforeAll(async () => {
  world = await loadAnduinWorld();
});

function make(layout: AnduinLayout = {}) {
  const made = anduinTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

// Answers the open choices with `pick` (the first option by default) until none is open.
function settleChoices(run: Run, ctx: ReduceContext, pick: (state: ScenarioState) => string = (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")): Run {
  let current = run;
  for (let guard = 0; guard < 20 && current.state.window?.kind === "choose"; guard += 1) current = send(current, { type: "Choose", optionId: pick(current.state) }, ctx);
  return current;
}

// The card's When Revealed records resolve now, in the quest phase (the way a reveal resolves them), and the choices they open are answered.
function revealed(code: string, layout: AnduinLayout = {}) {
  const made = make(layout);
  const spawned = spawn(made.state, code, { zone: "encounterDiscard" });
  const effects = made.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
  const steps: EngineStep[] = [];
  const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, spawned.state.firstPlayer, false, effects, made.ctx, steps);
  const run = settleChoices({ state: settle({ ...pushed, window: null }, made.ctx, steps), steps }, made.ctx);
  expect(causeProblems(run.steps)).toEqual([]);
  return { ...made, run };
}

describe("enemies", () => {
  it("Hill Troll assigns the combat damage beyond the remaining hit points of the character it damages to its controller's threat (01082:A:1)", () => {
    // An undefended attack (Attack 6) on a hero with 4 damage and 6 hit points: 2 hit points left, so 4 points of excess.
    const undefended = fight(world, "f0", "01082", { damage: [["ah1", 4]] }, { undefended: true });
    expect(undefended.run.state.cards[undefended.hero]?.zone).toBe("discard");
    expect(undefended.run.state.seats[0].threat).toBe(32);
    // A defended attack (Attack 6 against Defense 2): 4 damage on a hero with 2 hit points left, so 2 points of excess.
    const defended = fight(world, "f0", "01082", { damage: [["ah1", 4]] });
    expect(defended.run.state.cards[defended.hero]?.zone).toBe("discard");
    expect(defended.run.state.seats[0].threat).toBe(30);
    expect(causeProblems(defended.run.steps)).toEqual([]);
    // Damage that does not exceed the hit points raises nothing, and an enemy without the line sends nothing to threat.
    expect(fight(world, "f0", "01082", {}, { undefended: true }).run.state.seats[0].threat).toBe(28);
    expect(fight(world, "f0", "brute", { damage: [["ah1", 4]] }, { undefended: true }).run.state.seats[0].threat).toBe(28);
  });

  it("Misty Mountain Goblins remove 1 progress from the quest after they attack, defended or not (01111:A:1)", () => {
    const quest = (made: ReturnType<typeof fight>) => made.run.state.cards[made.run.state.questStage ?? ""]?.progress;
    expect(quest(fight(world, "f0", "01111", { progress: 5 }))).toBe(4);
    expect(quest(fight(world, "f0", "01111", { progress: 5 }, { undefended: true }))).toBe(4);
    // Another enemy's attack takes none off, and the quest stops at 0.
    expect(quest(fight(world, "f0", "grunt", { progress: 5 }))).toBe(5);
    expect(quest(fight(world, "f0", "01111", { progress: 0 }))).toBe(0);
  });

  it("Goblin Sniper cannot be optionally engaged in the encounter phase while another enemy is in the staging area (01083:A:1)", () => {
    const alone = make({ staging: ["01083"], phase: "Encounter" });
    expect(legalTargets(alone.state, { type: "Engage" }, alone.ctx)).toEqual([first(alone.state, "01083")]);
    const crowded = make({ staging: ["01083", "f3"], phase: "Encounter" });
    expect(legalTargets(crowded.state, { type: "Engage" }, crowded.ctx)).toEqual([first(crowded.state, "f3")]);
  });

  it("Goblin Sniper has each player deal 1 damage to 1 character they control if it is in the staging area at the end of the combat phase (01083:A:2)", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, staging: ["01083"], phase: "Encounter" });
      let run: Run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
      const damage = (state: ScenarioState) => Object.values(state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + card.damage, 0);
      for (let guard = 0; guard < 80 && run.state.phase !== "End of round" && !run.state.lost; guard += 1) {
        const window = run.state.window;
        if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
        else {
          const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack" || item.type === "DeclineEngage");
          if (!intent) break;
          run = send(run, intent as PlayerIntent, made.ctx);
        }
      }
      expect(damage(run.state), `${seats} seats`).toBe(seats);
      expect(causeProblems(run.steps)).toEqual([]);
    }
  });

  it("Goblin Sniper deals nothing when it is engaged at the end of the combat phase (01083:A:2)", () => {
    const made = make({ engaged: [{ code: "01083", seat: 0 }], phase: "Combat" });
    let run: Run = start(made.state);
    for (let guard = 0; guard < 40 && run.state.phase !== "Refresh" && !run.state.lost; guard += 1) {
      const window = run.state.window;
      if (window?.kind === "defense") run = send(run, { type: "DeclareDefender", defenderId: made.hero }, made.ctx);
      else {
        const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
        if (!intent) break;
        run = send(run, intent as PlayerIntent, made.ctx);
      }
    }
    expect(Object.values(run.state.cards).filter((card) => card.zone === "heroes").reduce((sum, card) => sum + card.damage, 0)).toBe(0);
  });

  it("Marsh Adder raises the attacked player's threat by 1 each time it attacks (01084:A:1)", () => {
    expect(fight(world, "f0", "01084").run.state.seats[0].threat).toBe(29);
    expect(fight(world, "f0", "grunt").run.state.seats[0].threat).toBe(28);
  });

  it("Wargs return to the staging area after attacking when dealt a shadow card with no effect, and stay engaged otherwise (01085:A:1)", () => {
    const blank = fight(world, "f0", "01085");
    expect(blank.run.state.cards[first(blank.run.state, "01085")]?.zone).toBe("staging");
    const effect = fight(world, "01115", "01085");
    expect(effect.run.state.cards[first(effect.run.state, "01085")]?.zone).toBe("engaged");
  });
});

describe("treacheries when revealed", () => {
  it("Despair removes 4 progress from the current quest card, or all of it when there is less (01086:A:1)", () => {
    const some = revealed("01086", { progress: 6 });
    expect(some.run.state.cards[some.run.state.questStage ?? ""]?.progress).toBe(2);
    const few = revealed("01086", { progress: 3 });
    expect(few.run.state.cards[few.run.state.questStage ?? ""]?.progress).toBe(0);
  });

  it("Massing at Night reveals one additional card for each player (01112:A:1)", () => {
    for (const seats of [1, 2] as const) {
      const { run } = revealed("01112", { seats, deck: ["f0", "f0", "f0", "f0"] });
      expect(run.state.staging.filter((id) => run.state.cards[id]?.code === "f0")).toHaveLength(seats);
    }
  });

  it("Evil Storm deals 1 damage to each character of each player whose threat is 35 or higher (01116:A:1)", () => {
    const { run } = revealed("01116", { seats: 2, allies: ["ally"], threat: [36, 30] });
    const damaged = (code: string) => Object.values(run.state.cards).find((card) => card.code === code)?.damage;
    expect(damaged("ah1")).toBe(1);
    expect(damaged("ah2")).toBe(1);
    expect(damaged("ally")).toBe(1);
    expect(damaged("ah3")).toBe(0);
  });

  it("Pursued by Shadow raises each player's threat by 1 for each character they control that is not committed (01117:A:1)", () => {
    const { run } = revealed("01117", { seats: 2, allies: ["ally"] });
    expect(run.state.seats[0].threat).toBe(28 + 3);
    expect(run.state.seats[1].threat).toBe(26 + 1);
    const committed = make({ allies: ["ally"] });
    const hero = first(committed.state, "ah1");
    const withCommit = { ...committed.state, cards: { ...committed.state.cards, [hero]: { ...committed.state.cards[hero]!, committed: true } } };
    const spawned = spawn(withCommit, "01117", { zone: "encounterDiscard" });
    const steps: EngineStep[] = [];
    const effects = committed.ctx.effects.filter((effect) => effect.cardCode === "01117" && effect.timing === "whenRevealed");
    const pushed = pushCardEffects(spawned.state, "whenRevealed", spawned.id, 0, false, effects, committed.ctx, steps);
    expect(settle({ ...pushed, window: null }, committed.ctx, steps).seats[0].threat).toBe(28 + 2);
  });

  it("Treacherous Fog gives each location in the staging area +1 Threat this phase and makes each player with threat 35 or higher discard a card (01118:A:1)", () => {
    const { run, ctx } = revealed("01118", { seats: 2, staging: ["01087"], hand: ["filler", "ally"], threat: [36, 30] });
    const brownLands = first(run.state, "01087");
    expect(modifiedStat(run.state, run.state.cards[brownLands]!, "threat", ctx.cards)).toBe((ctx.cards.get("01087")?.threat ?? 0) + 1);
    expect(run.state.seats[0].hand).toHaveLength(1);
    expect(run.state.seats[0].discard).toHaveLength(1);
    expect(run.state.seats[1].hand).toHaveLength(0);
  });
});

describe("locations", () => {
  it("The Brown Lands takes 1 progress token when the players travel there (01087:A:1)", () => {
    const made = make({ staging: ["01087"], phase: "Travel" });
    const run = settleChoices(send(start(made.state), { type: "Travel", locationId: first(made.state, "01087") }, made.ctx), made.ctx);
    expect(run.state.cards[first(run.state, "01087")]?.progress).toBe(1);
    expect(causeProblems(run.steps)).toEqual([]);
  });

  it("The East Bight must be traveled to when there is no active location, and nothing else may be (01088:A:1)", () => {
    const made = make({ staging: ["01088", "01087"], phase: "Travel" });
    const bight = first(made.state, "01088");
    expect(legalTargets(made.state, { type: "Travel" }, made.ctx)).toEqual([bight]);
    expect(legalIntents(made.state, made.ctx).map((intent) => intent.type)).toEqual(["Travel"]);
    expect(() => send(start(made.state), { type: "DeclineTravel" }, made.ctx)).toThrow();
    expect(() => send(start(made.state), { type: "Travel", locationId: first(made.state, "01087") }, made.ctx)).toThrow();
    expect(send(start(made.state), { type: "Travel", locationId: bight }, made.ctx).state.activeLocation).toBe(bight);
    // With an active location the players may travel or decline as they like (and The East Bight asks nothing).
    const active = make({ staging: ["01088"], active: "01087", phase: "Travel" });
    expect(legalIntents(active.state, active.ctx).map((intent) => intent.type)).toContain("DeclineTravel");
  });

  it("Banks of the Anduin goes to the top of the encounter deck instead of the discard pile when it leaves play (01113:A:1)", () => {
    const made = make({ active: "01113", deck: ["f0", "f0"], phase: "Quest", progress: 0 });
    const banks = first(made.state, "01113");
    // The active location takes progress first: 3 quest points, explored by 3 progress.
    const explored = made.ctx.cards.get("01113")?.questPoints ?? 0;
    expect(explored).toBeGreaterThan(0);
    const placed = { ...made.state, cards: { ...made.state.cards, [banks]: { ...made.state.cards[banks]!, progress: explored - 1 } } };
    const run = start(placed);
    const done = settleChoices(send(send(run, { type: "Commit", cardIds: [first(placed, "ah1"), first(placed, "ah2")] }, made.ctx), { type: "Pass" }, made.ctx), made.ctx);
    expect(["encounterDeck"]).toContain(done.state.cards[banks]?.zone);
    expect(done.state.encounterDeck[0]).toBe(banks);
    expect(done.state.encounterDiscard).not.toContain(banks);
  });

  it("Gladden Fields makes each player raise threat by 1 more in the refresh phase while it is the active location (01114:A:1)", () => {
    const active = make({ seats: 2, active: "01114", phase: "Combat" });
    const staged = make({ seats: 2, staging: ["01114"], phase: "Combat" });
    const round = (state: ScenarioState, ctx: ReduceContext): ScenarioState => {
      let run: Run = start(state);
      for (let guard = 0; guard < 60 && run.state.round === state.round && !run.state.lost; guard += 1) {
        const window = run.state.window;
        const intent = window?.kind === "choose" ? ({ type: "Choose", optionId: window.options[0] ?? "" } as PlayerIntent) : (legalIntents(run.state, ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack") as PlayerIntent | undefined);
        if (!intent) break;
        run = send(run, intent, ctx);
      }
      return run.state;
    };
    const withIt = round(active.state, active.ctx);
    const without = round(staged.state, staged.ctx);
    expect(withIt.seats[0].threat - without.seats[0].threat).toBe(1);
    expect(withIt.seats[1].threat - without.seats[1].threat).toBe(1);
  });

  it("Eastern Crows are shuffled back into the encounter deck when defeated (01115:A:2)", () => {
    const made = make({ engaged: [{ code: "01115", seat: 0 }], deck: ["f0", "f0", "f0"], phase: "Combat" });
    const crows = first(made.state, "01115");
    // One point of damage from its 2 hit points: the hero's attack (Attack 2 against its Defense) defeats it.
    const hurt = { ...made.state, cards: { ...made.state.cards, [crows]: { ...made.state.cards[crows]!, damage: (made.ctx.cards.get("01115")?.health ?? 1) - 1 } } };
    let run: Run = start(hurt);
    for (let guard = 0; guard < 20 && run.state.cards[crows]?.zone === "engaged"; guard += 1) {
      if (run.state.window?.kind === "playerAttack" && legalIntents(run.state, made.ctx).some((intent) => intent.type === "DeclareAttackers")) {
        run = send(run, { type: "DeclareAttackers", enemyId: crows, attackerIds: [first(hurt, "ah1")] }, made.ctx);
        continue;
      }
      if (run.state.window?.kind === "defense") {
        run = send(run, { type: "DeclareDefender", defenderId: first(hurt, "ah2") }, made.ctx);
        continue;
      }
      const intent = legalIntents(run.state, made.ctx).find((item) => item.type === "Pass" || item.type === "DeclineAttack");
      if (!intent) break;
      run = send(run, intent as PlayerIntent, made.ctx);
    }
    run = settleChoices(run, made.ctx);
    expect(["encounterDeck"]).toContain(run.state.cards[crows]?.zone);
    expect(run.state.encounterDiscard).not.toContain(crows);
    expect(run.state.encounterDeck).toHaveLength(4);
  });
});
