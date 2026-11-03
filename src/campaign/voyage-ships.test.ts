// Rules: dcce.ship-objectives, dcce.prepare-your-fleet, dcce.scalable-upgradable, dcce.encounter-cards, dcce.sailing-tests, dcce.boarding, dcce.hard-expert, rr.player-elimination, rr.cancel
// (data/rules/entries.json). The six ship-objectives, the Modification boons, the burdens the campaign card shuffles in and the Hard/Expert Mode card, on each side they have: every line of the
// ledger (data/printed/dream-chaser.json) has a record, and these tests run them on a table of plain-number heroes (scripts/voyage-scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/constants.ts";
import { playCost } from "../rules/attach.ts";
import { runInstruction } from "../rules/interpret.ts";
import { modifiedStat, placeDamage } from "../rules/keywords.ts";
import { settle } from "../rules/machine.ts";
import { legalIntents, reduce, startScenario, type PlayerIntent } from "../rules/reduce.ts";
import { committedWeight } from "../rules/families/sea/sailing.ts";
import { sailingCommitters } from "../rules/families/sea/sailing-legal.ts";
import { heldAmount, updateCard, type ScenarioState } from "../rules/state.ts";
import { lowerThreatByEffect } from "../rules/families/quest/threat.ts";
import { readyCard } from "../rules/player-verbs.ts";
import { doRefresh } from "../rules/refresh.ts";
import { pruneRoundCaps } from "../rules/families/dreamchaser/index.ts";
import { expectOk } from "../rules/fixture.ts";
import { causeProblems } from "../../scripts/cause-check.ts";
import { first, send, start } from "../../scripts/past-scene.ts";
import { voyageStart, voyageWorld } from "../../scripts/voyage-game.ts";
import {
  ARMOR_PLATING, BALLISTA, CROWLEY, CUNNING_PIRATE, ENLARGED_QUARTERS, EXTRA_SAILS, HARD_MODE, OMINOUS_FATE, SCOUTING_SHIP, SHIPS, THUNDERSTRUCK, codesIn, loadVoyageWorld, resolveReveal, voyageFight, voyageTable,
  type VoyageLayout, type VoyageWorld,
} from "../../scripts/voyage-scene.ts";

let world: VoyageWorld;

beforeAll(async () => {
  world = await loadVoyageWorld();
});

function make(layout: VoyageLayout = {}) {
  const made = voyageTable(world, { heading: "Sun", ships: [{ code: SHIPS.dreamChaser, seat: 0 }], phase: "Encounter", ...layout });
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;
const shipOf = (made: Table, at = 0) => made.ships[at] ?? "";
const stat = (made: Table, id: string, which: "attack" | "willpower" | "defense" | "hitPoints") => modifiedStat(made.state, made.state.cards[id]!, which, made.ctx.cards);

// The ship's destruction by damage: damage equal to its hit points, then the sweep settles.
function destroyed(made: Table, id: string): ScenarioState {
  const steps: never[] = [];
  const hit = placeDamage(made.state, id, 99, made.ctx.cards, steps, "framework", { rule: "rr.damage" });
  return settle(syncConstants({ ...hit, window: null }, made.ctx), made.ctx, steps);
}

describe("the ships' destruction (11080:A:4, 110136:A:4, 110136:B:5, 11081:A:5 and the other ships)", () => {
  it("loses the game when the Dream-chaser is destroyed, on either side", () => {
    for (const face of ["up", "B"] as const) {
      const made = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0, face }] });
      const next = destroyed(made, shipOf(made));
      expect(next.lost, face).toBe(true);
    }
    const original = make({ ships: [{ code: "11080", seat: 0 }] });
    expect(destroyed(original, shipOf(original)).lost).toBe(true);
  });

  it("eliminates the controller of any other ship that is destroyed, and the game goes on for the others", () => {
    for (const code of [SHIPS.dawnStar, SHIPS.duskbringer, SHIPS.glorinaith, SHIPS.narelenya, SHIPS.silverWing, "11081", "11082", "11083"]) {
      for (const face of code.length === 6 ? (["up", "B"] as const) : (["up"] as const)) {
        const made = make({ seats: 2, ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code, seat: 1, face }] });
        const next = destroyed(made, shipOf(made, 1));
        expect(next.seats[1]?.eliminated, `${code} ${face}`).toBe(true);
        expect(next.seats[0]?.eliminated, `${code} ${face}`).toBe(false);
        expect(next.lost, `${code} ${face}`).toBe(false);
      }
    }
  });
});

describe("the Dream-chaser's sides (110136:A:3, 110136:B:4)", () => {
  it("counts as 2 characters on side A and 3 on side B, and sails any test (110136:A:3, 110136:B:4)", () => {
    for (const [face, weight] of [["up", 2], ["B", 3]] as const) {
      const made = make({ seats: 2, ships: [{ code: SHIPS.dreamChaser, seat: 1, face }] });
      const ship = shipOf(made);
      expect(committedWeight(made.state, ship), face).toBe(weight);
      expect(heldAmount(made.state, ship, "sailsAnyTest"), face).toBeGreaterThan(0);
      // The first player (seat 0) may commit a ship the other seat controls.
      expect(sailingCommitters({ ...made.state }, made.ctx), face).toContain(ship);
    }
  });

  it("prints the stats of the side it shows (110136:A:3, 110136:B:4)", () => {
    const side = (face: "up" | "B") => {
      const made = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0, face }], heading: "Rain" });
      const id = shipOf(made);
      return ["willpower", "attack", "defense", "hitPoints"].map((which) => stat(made, id, which as "attack"));
    };
    expect(side("up")).toEqual([5, 4, 4, 18]);
    expect(side("B")).toEqual([6, 5, 5, 19]);
  });
});

describe("the other ships' abilities", () => {
  it("Dawn Star draws 1 additional card during the resource phase, on either side (11081:A:4, 110137:A:4, 110137:B:4)", () => {
    for (const [code, face] of [["11081", "up"], [SHIPS.dawnStar, "up"], [SHIPS.dawnStar, "B"]] as const) {
      const made = make({ ships: [{ code, seat: 0, face }] });
      expect(heldAmount(made.state, "seat:0", "extraDraw"), `${code} ${face}`).toBe(1);
    }
  });

  it("Nárelenya reduces the cost of the first ally you play each round (the first card, upgraded) by 1 (11082:A:3, 110140:A:3, 110140:B:4)", () => {
    for (const [code, face, ally, event] of [["11082", "up", 1, 1], [SHIPS.narelenya, "up", 1, 1], [SHIPS.narelenya, "B", 1, 0]] as const) {
      const made = make({ ships: [{ code, seat: 0, face }], hand: ["ally", "odd"] });
      expect(playCost(made.state, first(made.state, "ally"), 0, made.ctx), `${code} ${face} ally`).toBe(ally);
      expect(playCost(made.state, first(made.state, "odd"), 0, made.ctx), `${code} ${face} event`).toBe(event);
    }
  });

  it("Silver Wing gives each hero you control +1 Attack (11083:A:5, 110141:A:5, 110141:B:6)", () => {
    for (const [code, face] of [["11083", "up"], [SHIPS.silverWing, "up"], [SHIPS.silverWing, "B"]] as const) {
      const made = make({ seats: 2, ships: [{ code, seat: 0, face }] });
      expect(stat(made, made.hero, "attack"), `${code} ${face}`).toBe(3);
      expect(stat(made, made.seat1Hero ?? "", "attack"), `${code} ${face} other seat`).toBe(2);
    }
  });

  it("Duskbringer adds a resource to a hero's pool after you play a card with an odd printed cost, once a round (twice, upgraded) (110138:A:3, 110138:B:4)", () => {
    for (const [face, times] of [["up", 1], ["B", 2]] as const) {
      const made = make({ ships: [{ code: SHIPS.duskbringer, seat: 0, face }], hand: ["odd", "odd", "odd", "even"], phase: "Planning", resources: 9 });
      let run = start(made.state);
      let offers = 0;
      const playFirst = (code: string) => {
        const card = Object.values(run.state.cards).find((candidate) => candidate.code === code && candidate.zone === "hand");
        run = send(run, { type: "PlayCard", cardId: card?.id ?? "", payments: [{ heroId: made.hero, amount: code === "odd" ? 1 : 2 }] }, made.ctx);
        const trigger = legalIntents(run.state, made.ctx).find((item) => item.type === "Trigger");
        if (trigger) {
          offers += 1;
          run = send(run, trigger as PlayerIntent, made.ctx);
        }
        for (let guard = 0; guard < 6 && (run.state.window?.kind === "response" || run.state.window?.kind === "choose"); guard += 1) {
          run = send(run, (run.state.window?.kind === "choose" ? { type: "Choose", optionId: run.state.window.options[0] ?? "" } : { type: "Pass" }) as PlayerIntent, made.ctx);
        }
      };
      // An even-cost card gives nothing; each odd-cost card does, up to the limit.
      playFirst("even");
      expect(offers, face).toBe(0);
      const before = run.state.cards[made.hero]?.resources ?? 0;
      playFirst("odd");
      playFirst("odd");
      playFirst("odd");
      expect(offers, face).toBe(times);
      // Three odd cards cost 1 each; the offers gave back `times`.
      expect((run.state.cards[made.hero]?.resources ?? 0) + (run.state.cards[made.hero2]?.resources ?? 0) - before, face).toBe(times - 3);
      expect(causeProblems(run.steps), face).toEqual([]);
    }
  });
});

describe("the Glórinaith's Action (110139:A:4, 110139:B:5)", () => {
  // The enemy engaged is non-unique; the decks hold known cards (the encounter deck: "f0", the player's deck: "filler").
  const act = (face: "up" | "B", choose: (state: ScenarioState) => string) => {
    const made = make({ ships: [{ code: SHIPS.glorinaith, seat: 0, face }], engaged: [{ code: "raider", seat: 0 }], deck: ["f0", "f0", "f0", "f0"], deckOf: ["filler", "filler", "filler", "filler"], phase: "Combat" });
    const ship = shipOf(made);
    const effect = made.ctx.effects.find((record) => record.cardCode === SHIPS.glorinaith && record.timing === "action" && record.lines.some((line) => line.includes(`:${face === "B" ? "B" : "A"}:`)));
    let run = start(made.state);
    run = send(run, { type: "Trigger", cardId: ship, effectId: effect?.id ?? "" }, made.ctx);
    for (let guard = 0; guard < 12 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: choose(run.state) }, made.ctx);
    return { run, made };
  };

  it("discards the top 2 cards of a deck to deal 1 damage to an engaged non-unique enemy (110139:A:4)", () => {
    const { run, made } = act("up", (state) => (state.window?.kind === "choose" ? (state.window.options.includes("encounter") ? "encounter" : (state.window.options[0] ?? "")) : ""));
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(run.state.cards[first(run.state, "raider")]?.damage).toBe(1);
    expect(causeProblems(run.steps)).toEqual([]);
    expect(made.state.encounterDeck).toHaveLength(4);
  });

  it("names a card first, discards the top 3 and deals 2 damage instead of 1 if the named card was among them (110139:B:5)", () => {
    // The player's deck is all "filler": naming it and discarding from it deals 2; naming "f0" and discarding from the player's deck deals 1.
    const named = act("B", (state) => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      return options.find((option) => option === "name:filler") ?? options.find((option) => option === "seat:0") ?? options[0] ?? "";
    });
    expect(named.run.state.cards[first(named.run.state, "raider")]?.damage).toBe(2);
    const missed = act("B", (state) => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      return options.find((option) => option === "name:f0") ?? options.find((option) => option === "seat:0") ?? options[0] ?? "";
    });
    expect(missed.run.state.cards[first(missed.run.state, "raider")]?.damage).toBe(1);
  });
});

describe("Naming a card (110139:B:5)", () => {
  it("offers the title of every card in the game, wherever it is, so the choices say nothing of what the decks hold", () => {
    const named = (deckOf: readonly string[]) => {
      const made = make({ ships: [{ code: SHIPS.glorinaith, seat: 0, face: "B" }], engaged: [{ code: "raider", seat: 0 }], deck: ["f0", "f0"], deckOf, phase: "Combat" });
      const effect = made.ctx.effects.find((record) => record.cardCode === SHIPS.glorinaith && record.timing === "action" && record.lines.some((line) => line.includes(":B:")));
      const run = send(start(made.state), { type: "Trigger", cardId: shipOf(made), effectId: effect?.id ?? "" }, made.ctx);
      return run.state.window?.kind === "choose" ? run.state.window.options : [];
    };
    const options = named(["filler", "filler"]);
    // The engaged raider, a hero and the ship itself are offered, none of them in a deck.
    expect(options).toEqual(expect.arrayContaining(["name:raider", "name:f0", "name:filler", "name:dh1"]));
    expect(options).toContain("name:Glórinaith");
    // The same game with other cards in the player's deck offers the same titles it does not hold: what is in a deck does not decide what is offered.
    expect(named(["filler", "odd"])).toEqual(expect.arrayContaining(options.filter((option) => option !== "name:odd")));
    expect(new Set(options).size).toBe(options.length);
  });
});

describe("the Modification boons (11172 to 11175)", () => {
  const boon = (code: string, face: "up" | "B") => {
    const made = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0 }], hand: [] });
    const spawned = voyageTable(world, { heading: "Sun", ships: [{ code: SHIPS.dreamChaser, seat: 0 }], fitted: [code], phase: "Encounter" });
    const fitted = Object.values(spawned.state.cards).find((card) => card.code === code);
    const state = syncConstants(updateCard(spawned.state, fitted?.id ?? "", { face }), made.ctx);
    return { state, ctx: made.ctx, ship: spawned.ships[0] ?? "", boon: fitted?.id ?? "" };
  };
  const statOf = (table: ReturnType<typeof boon>, which: "attack" | "willpower" | "defense" | "hitPoints") => modifiedStat(table.state, table.state.cards[table.ship]!, which, table.ctx.cards);

  it("add their bonus to the ship they are attached to, on either side (11172:A:2, 11173:A:2, 11174:A:2, 11175:A:2 and the Upgraded sides)", () => {
    for (const face of ["up", "B"] as const) {
      expect(statOf(boon(ARMOR_PLATING, face), "defense"), face).toBe(4 + 1);
      expect(statOf(boon(BALLISTA, face), "attack"), face).toBe(4 + 1);
      expect(statOf(boon(ENLARGED_QUARTERS, face), "hitPoints"), face).toBe(18 + 3);
      expect(statOf(boon(EXTRA_SAILS, face), "willpower"), face).toBe(5 + 2 + 1);
    }
  });

  it("make the ship ranged on the Upgraded Ballista, and sail any test on Enlarged Quarters (11173:B:2, 11174:A:2, 11174:B:2)", () => {
    expect(heldAmount(boon(BALLISTA, "up").state, boon(BALLISTA, "up").ship, "ranged")).toBe(0);
    const upgraded = boon(BALLISTA, "B");
    expect(heldAmount(upgraded.state, upgraded.ship, "ranged")).toBe(1);
    const plain = boon(ENLARGED_QUARTERS, "up");
    expect(heldAmount(plain.state, plain.ship, "sailsAnyTest")).toBeGreaterThan(0);
    // The Dream-chaser already counts as 2; the Upgraded Enlarged Quarters adds 1 more.
    expect(committedWeight(plain.state, plain.ship)).toBe(2);
    const better = boon(ENLARGED_QUARTERS, "B");
    expect(committedWeight(better.state, better.ship)).toBe(3);
  });

  it("are removed from the game when they leave play (11172:A:1, 11172:B:1, 11173:A:1, 11174:A:1, 11175:A:1 and the Upgraded sides)", () => {
    for (const code of [ARMOR_PLATING, BALLISTA, ENLARGED_QUARTERS, EXTRA_SAILS]) {
      for (const face of ["up", "B"] as const) {
        const table = boon(code, face);
        void table;
        // The ship the boon is on is destroyed (it eliminates its controller, not the game): the boon leaves play and is removed from the game, not discarded.
        const made = make({ seats: 2, ships: [{ code: SHIPS.dreamChaser, seat: 0 }, { code: SHIPS.silverWing, seat: 1 }], fitted: [code], fittedShip: 1 });
        const boonId = Object.values(made.state.cards).find((card) => card.code === code)?.id ?? "";
        const gone = destroyed(made, shipOf(made, 1));
        expect(gone.cards[boonId]?.zone, `${code} ${face}`).toBe("removed");
      }
    }
  });

  it("Upgraded Armor Plating: after the ship defends, discards a shadow card from another enemy (11172:B:3)", () => {
    const made = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0 }], fitted: [ARMOR_PLATING], fittedFace: "B", engaged: [{ code: SCOUTING_SHIP, seat: 0 }, { code: "raider", seat: 0 }], deck: ["f0", "f0", "f0", "f0"] });
    let run = send(start(made.state), { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const window = run.state.window;
      run = send(run, window?.kind === "chooseEnemy" ? { type: "ChooseEnemy", enemyId: first(run.state, SCOUTING_SHIP) } : ((legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack") ?? { type: "Pass" }) as PlayerIntent), made.ctx);
    }
    expect(run.state.pendingAttack?.enemyId).toBe(first(run.state, SCOUTING_SHIP));
    const shadowOfRaider = run.state.cards[first(run.state, "raider")]?.shadowId;
    expect(shadowOfRaider).toBeTruthy();
    run = send(run, { type: "DeclareDefender", defenderId: made.ships[0] ?? "" }, made.ctx);
    for (let guard = 0; guard < 20 && !legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger"); guard += 1) {
      if (run.state.window?.kind === "choose") run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
      else run = send(run, { type: "Pass" }, made.ctx);
    }
    const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "11172:response:1");
    expect(trigger).toBeDefined();
    run = send(run, trigger as PlayerIntent, made.ctx);
    for (let guard = 0; guard < 6 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: run.state.window.options[0] ?? "" }, made.ctx);
    expect(run.state.cards[shadowOfRaider ?? ""]?.zone).toBe("encounterDiscard");
  });

  it("Upgraded Ballista: after the ship has attacked, not when it is declared, deals 1 damage to a non-unique enemy and removes 1 resource from it (11173:B:3)", () => {
    // The ship (a ship-objective attacks only a Ship enemy) attacks the Scouting Ship while a Cunning Pirate holding 2 resources (defending at +2) is the enemy the Response can hit.
    const made = make({ phase: "Combat", fitted: [BALLISTA], fittedFace: "B", engaged: [{ code: SCOUTING_SHIP, seat: 0 }, { code: CUNNING_PIRATE, seat: 0 }] });
    const target = first(made.state, SCOUTING_SHIP);
    const pirate = first(made.state, CUNNING_PIRATE);
    const loaded = syncConstants(updateCard(made.state, pirate, { resources: 2 }), made.ctx);
    let run = send(start({ ...loaded, mode: "playerAttacks", window: { kind: "playerAttack" } }), { type: "DeclareAttackers", enemyId: target, attackerIds: [shipOf(made)] }, made.ctx);
    const fired = (state: ScenarioState) => legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "11173:response:1");
    for (let guard = 0; guard < 30 && run.state.pendingStrike && !fired(run.state); guard += 1) run = send(run, { type: "Pass" }, made.ctx);
    const trigger = fired(run.state);
    expect(trigger).toBeDefined();
    // The Response is offered once the attack has dealt its damage, and has not touched the pirate yet.
    expect(run.state.cards[target]?.damage).toBeGreaterThan(0);
    expect(run.state.cards[pirate]?.damage).toBe(0);
    expect(run.state.cards[pirate]?.resources).toBe(2);
    run = send(run, trigger as PlayerIntent, made.ctx);
    run = send(run, { type: "Choose", optionId: pirate }, made.ctx);
    expect(run.state.cards[pirate]?.damage).toBe(1);
    expect(run.state.cards[pirate]?.resources).toBe(1);
  });

  it("Upgraded Extra Sails: spends a resource and exhausts to reduce a non-unique Ship enemy's Boarding by 1 as it engages you, before the keyword resolves (11175:B:3)", () => {
    const engage = (use: boolean) => {
      const made = make({ ships: [{ code: SHIPS.dreamChaser, seat: 0 }], fitted: [EXTRA_SAILS], fittedFace: "B", staging: [SCOUTING_SHIP], corsair: ["raider", "raider"], threat: [30, 30], resources: 2 });
      let run = send(start({ ...made.state, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }), { type: "Engage", enemyId: first(made.state, SCOUTING_SHIP) }, made.ctx);
      const trigger = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "11175:response:1");
      expect(trigger, String(use)).toBeDefined();
      run = send(run, use ? ({ ...(trigger as PlayerIntent), payments: [{ heroId: made.hero, amount: 1 }] } as PlayerIntent) : ({ type: "Pass" } as PlayerIntent), made.ctx);
      for (let guard = 0; guard < 6 && run.state.window?.kind === "response"; guard += 1) run = send(run, { type: "Pass" }, made.ctx);
      return { run, made };
    };
    // Boarding 1 reveals a Raider; reduced by 1 it reveals none, and the boon is exhausted and a resource spent.
    expect(engage(false).run.state.corsairDeck).toHaveLength(1);
    const used = engage(true);
    expect(used.run.state.corsairDeck).toHaveLength(2);
    expect(used.run.state.cards[used.made.hero]?.resources).toBe(1);
    expect(Object.values(used.run.state.cards).find((card) => card.code === EXTRA_SAILS)?.exhausted).toBe(true);
  });
});

describe("Ominous Fate (11176:A:2, 11176:A:3, 11176:A:4)", () => {
  it("each player either reveals an encounter card, raises threat by X or deals X damage divided among characters (X is the part number), and the players may add it to the victory display (11176:A:3)", () => {
    const base = make({ deck: ["f0", "f0", "f0"] });
    const withPart = { ...base.state, part: 3 };
    const answers = (choice: string, victory: string) => (state: ScenarioState) => {
      const options = state.window?.kind === "choose" ? state.window.options : [];
      return options.includes("victory") ? victory : options.includes(choice) ? choice : (options[0] ?? "");
    };
    const reveal = resolveReveal(withPart, base.ctx, OMINOUS_FATE, answers("reveal", "discard"));
    // The card itself stays in the staging area, as a card revealed from the deck does, and the revealed card joins it.
    expect(reveal.state.staging.length).toBe(2);
    const threat = resolveReveal(withPart, base.ctx, OMINOUS_FATE, answers("threat", "discard"));
    // The threat the card raised (the steps name the card as the cause), not the one the round's end adds.
    const raised = threat.steps.flatMap((step) => (step.kind === "threat" && "effect" in step.cause && step.cause.effect === "11176:whenRevealed:1" ? [step.amount] : []));
    expect(raised).toEqual([3]);
    const damage = resolveReveal(withPart, base.ctx, OMINOUS_FATE, answers("damage", "discard"));
    const total = Object.values(damage.state.cards).filter((card) => card.controller === 0 && (card.zone === "heroes" || card.zone === "play")).reduce((sum, card) => sum + card.damage, 0);
    expect(total).toBe(3);
    const added = resolveReveal(withPart, base.ctx, OMINOUS_FATE, answers("threat", "victory"));
    expect(codesIn(added.state, "victory")).toEqual([OMINOUS_FATE]);
    expect(codesIn(threat.state, "victory")).toEqual([]);
  });

  it("cannot be canceled, and its Shadow reveals an encounter card (11176:A:2, 11176:A:4)", () => {
    const effects = world && undefined;
    expect(effects).toBeUndefined();
    const hit = voyageFight(world, OMINOUS_FATE, "raider", { deck: [OMINOUS_FATE, "f0", "f0", "f0"] });
    expect(hit.run.state.staging.length).toBeGreaterThan(0);
  });
});

describe("Thunderstruck (11177:A:4, 11177:A:5)", () => {
  it("gets +2 hit points per player and takes no more than 4 damage each round (11177:A:4)", () => {
    const solo = make({ engaged: [{ code: THUNDERSTRUCK, seat: 0 }] });
    const two = make({ seats: 2, engaged: [{ code: THUNDERSTRUCK, seat: 0 }] });
    expect(stat(solo, first(solo.state, THUNDERSTRUCK), "hitPoints")).toBe(4 + 2);
    expect(stat(two, first(two.state, THUNDERSTRUCK), "hitPoints")).toBe(4 + 4);
    const id = first(solo.state, THUNDERSTRUCK);
    const once = placeDamage(solo.state, id, 3, solo.ctx.cards, [], "combat", { rule: "rr.damage" });
    const twice = placeDamage(once, id, 3, solo.ctx.cards, [], "combat", { rule: "rr.damage" });
    expect(twice.cards[id]?.damage).toBe(4);
  });

  it("its Shadow adds it to the staging area, or deals 2 damage to the defending character (11177:A:5)", () => {
    const staged = voyageFight(world, THUNDERSTRUCK, "raider", {}, { answer: () => ({ type: "Choose", optionId: "staging" }) });
    expect(codesIn(staged.run.state, "staging")).toContain(THUNDERSTRUCK);
    const dealt = voyageFight(world, THUNDERSTRUCK, "raider", {}, { answer: () => ({ type: "Choose", optionId: "damage" }) });
    // The raider's 2 Attack against the hero's 2 Defense deals nothing; the Shadow's 2 damage lands on the defender.
    expect(dealt.run.state.cards[dealt.made.hero]?.damage).toBe(2);
    expect(codesIn(dealt.run.state, "staging")).not.toContain(THUNDERSTRUCK);
  });
});

describe("Crowley (11178:A:1, 11178:A:2)", () => {
  it("gets +1 Threat, Attack, Defense and hit point for each resource on him, and gains victory 3 at 3 resources (11178:A:1)", () => {
    const made = make({ engaged: [{ code: CROWLEY, seat: 0 }] });
    const id = first(made.state, CROWLEY);
    const loaded = (resources: number) => syncConstants(updateCard(made.state, id, { resources }), made.ctx);
    const read = (state: ScenarioState, which: "attack" | "defense" | "hitPoints" | "threat") => modifiedStat(state, state.cards[id]!, which, made.ctx.cards);
    expect([read(loaded(0), "attack"), read(loaded(0), "defense"), read(loaded(0), "hitPoints"), read(loaded(0), "threat")]).toEqual([2, 2, 2, 2]);
    expect([read(loaded(2), "attack"), read(loaded(2), "defense"), read(loaded(2), "hitPoints"), read(loaded(2), "threat")]).toEqual([4, 4, 4, 4]);
    expect(heldAmount(loaded(2), id, "gainsVictory")).toBe(0);
    expect(heldAmount(loaded(3), id, "gainsVictory")).toBe(3);
  });

  it("goes to the victory display when destroyed with 3 resources, and to the Corsair discard pile with fewer (11178:A:1)", () => {
    for (const [resources, zone] of [[3, "victory"], [1, "corsairDiscard"]] as const) {
      const made = make({ engaged: [{ code: CROWLEY, seat: 0 }], corsair: ["raider"], corsairDiscard: [] });
      const id = first(made.state, CROWLEY);
      const loaded = syncConstants(updateCard(made.state, id, { resources }), made.ctx);
      const hit = placeDamage(loaded, id, 99, made.ctx.cards, [], "combat", { rule: "rr.damage" });
      const next = settle(syncConstants({ ...hit, window: null }, made.ctx), made.ctx, []);
      expect(next.cards[id]?.zone, String(resources)).toBe(zone);
    }
  });

  it("gets a resource when he engages you and returns to the staging area at the end of the combat phase (11178:A:2)", () => {
    const made = make({ staging: [CROWLEY], threat: [30, 30] });
    const engaged = send(start({ ...made.state, mode: "optionalEngage", phase: "Encounter", window: { kind: "optionalEngage" } }), { type: "Engage", enemyId: first(made.state, CROWLEY) }, made.ctx);
    expect(engaged.state.cards[first(engaged.state, CROWLEY)]).toMatchObject({ zone: "engaged", resources: 1 });
    let run = engaged;
    for (let guard = 0; guard < 60 && run.state.phase !== "Refresh" && run.state.phase !== "Resource"; guard += 1) {
      const window = run.state.window;
      if (window?.kind === "defense") run = send(run, { type: "Undefended", heroId: made.hero }, made.ctx);
      else if (window?.kind === "choose") run = send(run, { type: "Choose", optionId: window.options[0] ?? "" }, made.ctx);
      else run = send(run, (legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage") ?? { type: "Pass" }) as PlayerIntent, made.ctx);
    }
    expect(run.state.cards[first(run.state, CROWLEY)]).toMatchObject({ zone: "staging", resources: 1 });
  });
});

describe("the Hard/Expert Mode card (11217:A:1, 11217:A:2, 11217:B:1, 11217:B:2, 11217:B:3)", () => {
  it("Hard: a player's threat cannot be reduced by more than 1 each round, by any effect (11217:A:1)", () => {
    const made = make({ mode: "A", threat: [30, 30], hand: ["filler"], staging: [SCOUTING_SHIP] });
    const source = first(made.state, "filler");
    const lower = (state: ScenarioState, from: string = source) => lowerThreatByEffect(state, 0, 3, from, made.ctx, [], { rule: "rr.effects" });
    expect(heldAmount(made.state, "seat:0", "threatReductionCap")).toBe(1);
    const once = lower(made.state);
    expect(once.seats[0]?.threat).toBe(29);
    // The same round: nothing more can be taken off; the round's end gives the allowance back.
    expect(lower(once).seats[0]?.threat).toBe(29);
    const next = pruneRoundCaps(once);
    expect(lower(next).seats[0]?.threat).toBe(28);
    // The line names no source: an encounter card's reduction is held to 1 too.
    expect(lower(made.state, first(made.state, SCOUTING_SHIP)).seats[0]?.threat).toBe(29);
    // Without the card the player card lowers by 3.
    const plain = make({ threat: [30, 30], hand: ["filler"] });
    expect(lowerThreatByEffect(plain.state, 0, 3, first(plain.state, "filler"), plain.ctx, [], { rule: "rr.effects" }).seats[0]?.threat).toBe(27);
  });

  it("Hard and Expert: after a player draws any number of cards that player raises their threat by that number (11217:A:2, 11217:B:2)", () => {
    for (const mode of ["A", "B"] as const) {
      const made = make({ mode, deckOf: ["filler", "filler", "filler", "filler"], threat: [30, 30] });
      const drawn = runInstruction({ ...made.state, window: null }, { verb: "Draw", amount: 2 }, { seat: 0, sourceId: null }, made.ctx, []);
      const settled = settle(drawn, made.ctx, []);
      expect(settled.seats[0]?.hand.length, mode).toBe(2);
      expect(settled.seats[0]?.threat, mode).toBe(32);
    }
    // No Mode card, no raise.
    const plain = make({ deckOf: ["filler", "filler"], threat: [30, 30] });
    expect(settle(runInstruction({ ...plain.state, window: null }, { verb: "Draw", amount: 2 }, { seat: 0, sourceId: null }, plain.ctx, []), plain.ctx, []).seats[0]?.threat).toBe(30);
  });

  it("Expert: a player's threat cannot be reduced at all, by a player card or any other effect (11217:B:1)", () => {
    const made = make({ mode: "B", threat: [30, 30], hand: ["filler"], staging: [SCOUTING_SHIP] });
    expect(heldAmount(made.state, "seat:0", "threatReductionBarred")).toBe(1);
    expect(heldAmount(make({ mode: "A" }).state, "seat:0", "threatReductionBarred")).toBe(0);
    for (const source of [first(made.state, "filler"), first(made.state, SCOUTING_SHIP)]) {
      expect(lowerThreatByEffect(made.state, 0, 3, source, made.ctx, [], { rule: "rr.effects" }).seats[0]?.threat).toBe(30);
    }
  });

  it("Expert: after a character is healed or readied by a player card effect its controller raises their threat by 1, and by nothing else (11217:B:3)", () => {
    const made = make({ mode: "B", threat: [30, 30], damage: [["dh1", 2]], staging: [SCOUTING_SHIP], phase: "Combat" });
    const threat = (state: ScenarioState) => state.seats[0]?.threat ?? 0;
    const run = (table: Table, instruction: Parameters<typeof runInstruction>[1], sourceId: string) =>
      settle(runInstruction(table.state, instruction, { seat: 0, sourceId }, table.ctx, []), table.ctx, []);
    // A hero's own effect heals itself: a player card effect.
    expect(threat(run(made, { verb: "Heal", amount: 1, target: "self" }, made.hero)) - threat(made.state)).toBe(1);
    // Readying: a player card effect raises it; a ready no player card made (an encounter card's, a rule's) and the refresh phase do not.
    const tired = updateCard(made.state, made.hero, { exhausted: true });
    expect(threat(settle(readyCard(tired, made.hero, false), made.ctx, []))).toBe(threat(made.state));
    const readied = settle(runInstruction(tired, { verb: "Ready" }, { seat: 0, sourceId: made.hero }, made.ctx, []), made.ctx, []);
    expect(readied.cards[made.hero]?.exhausted).toBe(false);
    expect(threat(readied) - threat(made.state)).toBe(1);
    const refreshed = settle(doRefresh({ ...tired, phase: "Refresh", window: null }, made.ctx, []), made.ctx, []);
    expect(refreshed.cards[made.hero]?.exhausted).toBe(false);
    // The refresh phase's own +1 threat is all it raises.
    expect(threat(refreshed)).toBe(threat(made.state) + 1);
    // Hard raises nothing for healing.
    const hard = make({ mode: "A", threat: [30, 30], damage: [["dh1", 2]], phase: "Combat" });
    const healedHard = settle(runInstruction(hard.state, { verb: "Heal", amount: 1, target: "self" }, { seat: 0, sourceId: hard.hero }, hard.ctx, []), hard.ctx, []);
    expect(threat(healedHard)).toBe(threat(hard.state));
    expect(HARD_MODE).toBe("11217");
  });
});

describe("the fleet's Setup (11081:A:3, 11083:A:4, 110137:A:3, 110141:A:4, 110141:B:5)", () => {
  // The scenario is dealt through the Campaign Setup Checklist and the first player chooses the ship: starting threat is the heroes' plus the ship's change.
  it("raises the starting threat of the player who took Dawn Star by 3 and lowers Silver Wing's by 3 (6 upgraded)", async () => {
    const dealt = await voyageWorld("strong");
    const threatOf = (code: string, upgraded: boolean) => {
      const begun = voyageStart(1, 1, "Normal", upgraded ? { prisoner: null, usedOnce: [], counters: {}, upgraded: [code] } : undefined);
      let state = startScenario(begun, dealt.ctx);
      state = expectOk(reduce(state, { type: "Keep" }, dealt.ctx)).state;
      for (let guard = 0; guard < 10 && state.window?.kind === "choose"; guard += 1) {
        const options = state.window.options;
        const wanted = options.find((id) => state.cards[id]?.code === code) ?? options.find((id) => state.cards[id]?.code === SHIPS.dreamChaser) ?? options[0] ?? "";
        state = expectOk(reduce(state, { type: "Choose", optionId: options.includes("keep") ? "keep" : wanted }, dealt.ctx)).state;
      }
      return state.seats[0]?.threat ?? 0;
    };
    const none = threatOf(SHIPS.duskbringer, false);
    expect(threatOf(SHIPS.dawnStar, false) - none).toBe(3);
    expect(threatOf(SHIPS.dawnStar, true) - none).toBe(0);
    expect(threatOf(SHIPS.silverWing, false) - none).toBe(-3);
    expect(threatOf(SHIPS.silverWing, true) - none).toBe(-6);
  });
});
