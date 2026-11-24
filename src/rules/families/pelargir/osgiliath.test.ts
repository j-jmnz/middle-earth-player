// Rules: ats.controlling-locations, ats.losing-control-of-locations, rr.explored, rr.step-3-4, rr.action, rr.cannot (data/rules/entries.json); ledger lines 06091:B:1, 06091:B:2, 06098:A:2, 06096:A:2, 06102:A:3, 06103:A:2.
// The engine facts of the control of locations of Assault on Osgiliath, each built on the real moment (a quest resolution, an action, an attack, a travel): the location that is explored goes to the first player's play area, a loss of control
// is seen wherever it comes from, an undefended attack is announced whatever its damage, a player card's progress in the staging area is barred, and Ruined Tower is a second active location. The printed lines are the spec rows of src/campaign/scenarios/assault-on-osgiliath/spec.test.ts.
import { describe, expect, it } from "vitest";

import { finish, idOf, legalIntents, resolveRecords, revealFromTop, send, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";
import { payFor } from "../../../../test/scenarios/a-shadow-of-the-past/starter-scene.ts";
import { BOROMIR, CODES, EVIL_CROW, cardOf, drive, opened, playOf, table, where } from "../../../../test/scenarios/assault-on-osgiliath/table.ts";
import type { PlayerIntent } from "../../../../src/rules/engine/reduce.ts";
import type { ScenarioState } from "../../../../src/rules/core/state.ts";

const controlled = (state: ScenarioState): string[] => state.modifiers.filter((modifier) => modifier.stat === "controlledBy").map((modifier) => state.cards[modifier.instanceId]?.code ?? "");

/** The quest phase of a table that opens on it, played out: the committed heroes quest and the game goes on to the travel phase. */
function quested(made: LayoutTable, from: Run = opened(made)): Run {
  return drive(made, send(from, { type: "Pass" }, made.ctx), (state) => state.phase !== "Quest");
}

describe("TakeControlOfLocation (06091:B:2): a location explored goes to the first player", () => {
  it("takes the active location a quest explores into his play area, ready and with no progress, and notes who controls it", () => {
    const made = table({ phase: "Quest", active: { code: CODES.westQuarter, progress: 1 }, committed: ["dh1", "dh2"] });
    const done = quested(made).state;
    const id = idOf(done, CODES.westQuarter);
    expect(playOf(done, 0)).toContain(id);
    expect(done.activeLocation).toBeNull();
    expect(cardOf(done, CODES.westQuarter)).toMatchObject({ zone: "play", controller: 0, progress: 0, exhausted: false, face: "up" });
    expect(controlled(done)).toEqual([CODES.westQuarter]);
  });

  it("takes a location explored in the staging area too, by the Action of Ancient Harbor", () => {
    const made = table({ phase: "Combat", staging: [{ code: CODES.harbor, progress: 4 }] });
    let run = opened(made);
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "06098:action:1");
    expect(trigger).toBeDefined();
    run = send(run, trigger as PlayerIntent, made.ctx);
    run = drive(made, run, (state) => state.window?.kind !== "choose" && where(state, CODES.harbor) === "play");
    expect(cardOf(run.state, CODES.harbor)).toMatchObject({ zone: "play", controller: 0, progress: 0 });
    expect(controlled(run.state)).toEqual([CODES.harbor]);
  });
});

describe("attackUndefended (06096:A:2): the player who controls the location lets an attack go undefended", () => {
  // West Gate is explored in the quest phase (the stage's own Forced effect gives it to the first player), then the enemy engaged with him attacks in the combat phase.
  const gate = (enemy: string) => {
    const made = table({ phase: "Quest", active: { code: CODES.westGate, progress: 1 }, committed: ["dh1", "dh2"], engaged: [{ code: enemy, seat: 0 }] }, undefined, enemy === EVIL_CROW ? [EVIL_CROW] : []);
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    return { made, run };
  };

  it("returns the location to the staging area, with no progress, when the attack deals damage", () => {
    const { made, run } = gate("f3");
    expect(cardOf(run.state, CODES.westGate)?.zone).toBe("play");
    const done = drive(made, send(run, { type: "Undefended", heroId: made.hero }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    expect(cardOf(done.state, CODES.westGate)).toMatchObject({ zone: "staging", progress: 0, controller: null });
    expect(controlled(done.state)).toEqual([]);
    expect(done.state.cards[made.hero]?.damage).toBeGreaterThan(0);
  });

  it("returns it as well when the undefended attack deals no damage (an enemy with 0 Attack)", () => {
    const { made, run } = gate(EVIL_CROW);
    const done = drive(made, send(run, { type: "Undefended", heroId: made.hero }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    expect(done.state.cards[made.hero]?.damage).toBe(0);
    expect(cardOf(done.state, CODES.westGate)?.zone).toBe("staging");
    expect(controlled(done.state)).toEqual([]);
  });

  it("keeps the location when the attack is defended", () => {
    const { made, run } = gate("f3");
    const done = drive(made, send(run, { type: "DeclareDefender", defenderId: made.hero2 }, made.ctx), (state) => state.pendingAttack == null && state.phase !== "Combat");
    expect(cardOf(done.state, CODES.westGate)?.zone).toBe("play");
    expect(controlled(done.state)).toEqual([CODES.westGate]);
  });
});


/**
 * Two locations are controlled. The players travel to Ruined Tower with one active location (the Tower is the second one), and the next quest phase explores both: the first player takes both. Every hero is ready again by then.
 * `first` is the active location with the progress it still needs 1 of, the Tower holds 1 of the 2 it needs.
 */
function controlsWithTower(first: { code: string; progress: number }): { made: LayoutTable; run: Run } {
  const made = table({ phase: "Travel", active: first, staging: [{ code: CODES.tower, progress: 1 }] });
  let run = send(opened(made), { type: "Travel", locationId: idOf(made.state, CODES.tower) } as PlayerIntent, made.ctx);
  run = drive(made, run, (state) => state.phase === "Quest" && state.mode === "questCommit");
  run = send(run, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
  run = drive(made, run, (state) => state.phase !== "Quest");
  return { made, run };
}

/** Counter-attack is revealed: the first player returns the location the `pick` names, or takes the option `option`. */
function counterAttack(made: LayoutTable, state: ScenarioState, pick: (state: ScenarioState) => string): Run {
  const revealed = revealFromTop({ ...state, window: null }, made.ctx, CODES.counter, []);
  return finish({ state: revealed.state, steps: [] }, made.ctx, pick);
}

describe("Ruined Tower (06103:A:1): the second active location", () => {
  it("is traveled to with one active location, at the cost of exhausting a character", () => {
    const made = table({ phase: "Travel", active: { code: CODES.westQuarter, progress: 0 }, staging: [CODES.tower] });
    const tower = idOf(made.state, CODES.tower);
    expect(legalIntents(made.state, made.ctx).map((intent) => intent.type)).toContain("Travel");
    let run = send(opened(made), { type: "Travel", locationId: tower } as PlayerIntent, made.ctx);
    // The cost: the player chooses which of his ready characters to exhaust, before the Tower becomes active.
    expect(run.state.window).toMatchObject({ kind: "choose", options: [made.hero, made.hero2] });
    expect(run.state.secondActiveLocation).toBeNull();
    run = send(run, { type: "Choose", optionId: made.hero }, made.ctx);
    expect(run.state.activeLocation).toBe(idOf(made.state, CODES.westQuarter));
    expect(run.state.secondActiveLocation).toBe(tower);
  });

  it("is not a place to travel to while two locations are active, and is traveled to for nothing with none", () => {
    const none = table({ phase: "Travel", staging: [CODES.tower] });
    const run = send(opened(none), { type: "Travel", locationId: idOf(none.state, CODES.tower) } as PlayerIntent, none.ctx);
    expect(run.state.activeLocation).toBe(idOf(none.state, CODES.tower));
    expect(run.state.window?.kind).not.toBe("choose");
  });

  it("shares the progress of a quest with the other active location: the first takes what it needs, the Tower the rest", () => {
    const { run } = controlsWithTower({ code: CODES.westQuarter, progress: 2 });
    expect(controlled(run.state).sort()).toEqual([CODES.westQuarter, CODES.tower].sort());
    expect(run.state.activeLocation).toBeNull();
    expect(run.state.secondActiveLocation).toBeNull();
  });
});

describe("LoseControlOfLocation and controlLost (06103:A:2): the Tower returns after any other location is lost", () => {
  it("returns Ruined Tower with the location Counter-attack makes the first player return", () => {
    const { made, run } = controlsWithTower({ code: CODES.westQuarter, progress: 2 });
    const done = counterAttack(made, run.state, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("return") ? "return" : idOf(state, CODES.westQuarter)) : "")).state;
    expect(where(done, CODES.westQuarter)).toBe("staging");
    expect(where(done, CODES.tower)).toBe("staging");
    expect(cardOf(done, CODES.westQuarter)).toMatchObject({ progress: 0, controller: null });
    expect(controlled(done)).toEqual([]);
  });

  it("returns only the highest Threat location, and Ruined Tower's own loss returns no other", () => {
    const { made, run } = controlsWithTower({ code: CODES.harbor, progress: 4 });
    expect(controlled(run.state).sort()).toEqual([CODES.harbor, CODES.tower].sort());
    // Ruined Tower (Threat 2) is the highest: it is the only one offered, and Ancient Harbor (Threat 1) stays.
    const done = counterAttack(made, run.state, (state) => (state.window?.kind === "choose" ? state.window.options[0] ?? "" : "")).state;
    expect(where(done, CODES.tower)).toBe("staging");
    expect(where(done, CODES.harbor)).toBe("play");
    expect(controlled(done)).toEqual([CODES.harbor]);
  });

  it("returns no location that lies in the staging area: it is not one the player controls", () => {
    const made = table({ phase: "Travel", staging: [CODES.westQuarter] });
    const done = counterAttack(made, made.state, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")).state;
    // The only way out is the raise, by the Threat of the locations he controls: none, so no choice is left and nothing moves.
    expect(done.window?.kind).not.toBe("choose");
    expect(where(done, CODES.westQuarter)).toBe("staging");
    expect(done.seats[0]?.threat).toBe(28);
  });
});

describe("The sweep that sees a control lost (ats.losing-control-of-locations)", () => {
  it("sees it when the players travel to the location: its progress is gone and it is the active location", () => {
    const made = table({ phase: "Quest", active: { code: CODES.library, progress: 1 }, committed: ["dh1", "dh2"], deck: ["f0", "f0", "f0"] });
    let run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
    const library = idOf(run.state, CODES.library);
    expect(controlled(run.state)).toEqual([CODES.library]);
    run = send(run, { type: "Travel", locationId: library } as PlayerIntent, made.ctx);
    expect(run.state.activeLocation).toBe(library);
    expect(cardOf(run.state, CODES.library)).toMatchObject({ zone: "activeLocation", progress: 0, controller: null });
    expect(controlled(run.state)).toEqual([]);
  });

  it("gives no way to travel to Ancient Harbor while the players control it: they cannot travel there", () => {
    const made = table({ phase: "Quest", active: { code: CODES.harbor, progress: 4 }, committed: ["dh1", "dh2"] });
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
    expect(controlled(run.state)).toEqual([CODES.harbor]);
    expect(legalIntents(run.state, made.ctx).map((intent) => intent.type)).not.toContain("Travel");
  });

  it("sees it when the player who controls the locations is eliminated: they come back to the staging area", () => {
    const made = table({ seats: 2, phase: "Quest", active: { code: CODES.westQuarter, progress: 2 }, committed: ["dh1", "dh2"], threat: [49, 28] });
    const run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.phase === "Travel");
    expect(controlled(run.state)).toEqual([CODES.westQuarter]);
    // Counter-attack: the first player cannot afford "raise" (Threat 49 and the location's Threat 2 make 51): he takes it, and is eliminated.
    const done = counterAttack(made, run.state, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("raise") ? "raise" : (state.window.options[0] ?? "")) : "")).state;
    expect(done.seats[0]?.eliminated).toBe(true);
    expect(where(done, CODES.westQuarter)).toBe("staging");
    expect(cardOf(done, CODES.westQuarter)).toMatchObject({ progress: 0, controller: null });
    expect(controlled(done)).toEqual([]);
  });

  it("takes the location again, with no loss, when it is explored while controlled (Ruined Square: 2 progress)", () => {
    const made = table({ phase: "Quest", active: { code: CODES.square, progress: 1 }, committed: ["dh1", "dh2"], heroes: [{ code: BOROMIR, seat: 0 }], engaged: [{ code: EVIL_CROW, seat: 0 }, { code: EVIL_CROW, seat: 0 }] }, undefined, [BOROMIR, EVIL_CROW]);
    let run = drive(made, send(opened(made), { type: "Pass" }, made.ctx), (state) => state.window?.kind === "defense");
    // Neither Crow deals damage (0 Attack): both attacks go undefended.
    for (let attacks = 0; attacks < 2; attacks += 1) {
      run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
      run = drive(made, run, (state) => state.window?.kind === "defense" || state.mode === "playerAttacks");
    }
    const crows = Object.values(run.state.cards).filter((card) => card.code === EVIL_CROW && card.zone === "engaged").map((card) => card.id);
    const square = idOf(run.state, CODES.square);
    const kill = (r: Run, enemyId: string, attackerIds: string[]): Run => {
      const attacked = send(r, { type: "DeclareAttackers", enemyId, attackerIds }, made.ctx);
      // Each destroyed enemy is a Response: Ruined Square places 1 progress on itself, in the first player's play area too.
      return send(attacked, { type: "Trigger", cardId: square, effectId: "06102:response:1" }, made.ctx);
    };
    run = kill(run, crows[0] ?? "", [idOf(run.state, BOROMIR)]);
    expect(cardOf(run.state, CODES.square)).toMatchObject({ zone: "play", progress: 1 });
    run = drive(made, run, (state) => state.window?.kind === "playerAttack");
    run = kill(run, crows[1] ?? "", [made.hero, made.hero2]);
    run = drive(made, run, (state) => state.window?.kind === "playerAttack");
    expect(cardOf(run.state, CODES.square)).toMatchObject({ zone: "play", controller: 0, progress: 0 });
    expect(controlled(run.state)).toEqual([CODES.square]);
  });
});

describe("noProgressInStagingByPlayer (06091:B:1): player card effects place no progress in the staging area", () => {
  // Snowbourn Scout (01016): "After Snowbourn Scout enters play, choose a location. Place 1 progress token on that location."
  const scout = (placeOn: string) => {
    const made = table({ phase: "Planning", active: { code: CODES.westQuarter }, staging: [CODES.harbor], hand: ["01016"], heroes: [{ code: "01001", seat: 0, resources: 3 }] }, undefined, ["01016", "01001"]);
    const card = idOf(made.state, "01016");
    let run = send(opened(made), { type: "PlayCard", cardId: card, payments: payFor(made.state, made.ctx, card) }, made.ctx);
    run = send(run, { type: "Trigger", cardId: card, effectId: "01016:response:1" }, made.ctx);
    run = finish(run, made.ctx, (state) => (state.window?.kind === "choose" ? idOf(state, placeOn) : ""));
    return run.state;
  };

  it("places none on a location in the staging area", () => {
    expect(cardOf(scout(CODES.harbor), CODES.harbor)?.progress).toBe(0);
  });

  it("places it on the active location, which is not in the staging area", () => {
    expect(cardOf(scout(CODES.westQuarter), CODES.westQuarter)?.progress).toBe(1);
  });
});

describe("The stat the quest counts (06100:A:1, 06101:A:1): Siege and Battle from the active location", () => {
  // Boromir has Willpower 1, Attack 3 and Defense 2, and is the only character committed: the quest total says which stat was counted.
  const total = (active: string) => {
    const made = table({ phase: "Quest", active, heroes: [{ code: BOROMIR, seat: 0 }], committed: [BOROMIR] }, undefined, [BOROMIR]);
    const run = send(opened(made), { type: "Pass" }, made.ctx);
    const quest = run.steps.find((step) => step.kind === "quest");
    return quest?.kind === "quest" ? quest.willpower : -1;
  };

  it("counts Defense while West Quarter is the active location, Attack while East Quarter is, and Willpower otherwise", () => {
    expect(total(CODES.westQuarter)).toBe(2);
    expect(total(CODES.eastQuarter)).toBe(3);
    expect(total(CODES.harbor)).toBe(1);
  });
});

describe("Retake the City (06091:A:1): the Setup choices", () => {
  it("lets each player choose an enemy and then a unique location nobody took", () => {
    const made = table({ seats: 2, deck: ["05052", "05058", "06096", "06097", "06100"] }, undefined, ["05052", "05058"]);
    const windows: string[][] = [];
    const run = resolveRecords(made.state, made.ctx, CODES.retake, "setup", idOf(made.state, CODES.retake), (state) => {
      if (state.window?.kind !== "choose") return "";
      windows.push([...state.window.options]);
      return state.window.options[0] ?? "";
    }, false);
    const staged = run.state.staging.map((id) => run.state.cards[id]?.code);
    // The first player chose among the two unique locations in the deck, West Gate (the first offered); the second had King's Library left, the one copy of it, and no choice to make. West Quarter is no unique location.
    expect(windows.filter((options) => options.every((option) => option.startsWith("0609")))).toEqual([["06096", "06097"]]);
    expect(staged.filter((code) => code === "06096")).toHaveLength(1);
    expect(staged.filter((code) => code === "06097")).toHaveLength(1);
    expect(staged).not.toContain("06100");
    expect(staged).toHaveLength(4);
  });
});
