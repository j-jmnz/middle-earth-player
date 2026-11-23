// Rules: hob.multiple-stages-in-play, hob.current-quest-stage, hob.baggins-sphere-otd, hob.bilbo-multiplayer-otd, rr.immune, rr.cancel, rr.forced, rr.reveal, rr.engaged (data/rules/entries.json); ledger lines 132052:A:1, 132053:A:2, 132053:A:3, 132054:A:1, 132054:A:2, 132055:A:1, 132060:A:1, 132060:A:2, 132061:A:2, 132061:A:3, 132062:A:3, 132063:A:3, 132065:A:1, 132076:B:2, 132078:B:3, 132079:B:2, 132079:B:3, 132066:A:2, 132001:A:1.
// What a spec row cannot express: a Baggins payment, several stages in play together, a stage that is not the current one, a cancel that is not offered and the stage 5 fight. Each test starts its title with the line id.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { askCurrentStage } from "../../../rules/families/armies/stages.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { gainSeatResources, runInstruction } from "../../../rules/interpret/interpret.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { fireForced } from "../../../rules/windows/triggers.ts";
import { loadPrinted } from "../../../../test/harness/catalog.ts";
import { finish, fightEnemy, first, revealedTop, idOf, legalIntents, legalTargets, opening, resolveRecords, revealFromTop, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-battle-of-five-armies";
const [S1, S2, S3, S4, S5] = ["132075", "132076", "132077", "132078", "132079"] as const;
const table = (layout: Layout = {}) => tableFromLayout(ID, { stage: S1, ...layout });
// Stage 1's When Revealed has put stages 2, 3 and 4 into play.
function inPlay(layout: Layout = {}) {
  const made = table(layout);
  const run = resolveRecords(made.state, made.ctx, S1, "whenRevealed", first(made.state, S1));
  // The phase the layout asked for opens again where it began, as a table of that phase does.
  return { ...made, state: layout.phase ? { ...run.state, ...opening(layout.phase) } : run.state };
}
type Made = ReturnType<typeof table>;
// Bilbo (132001) as the first seat's hero holding `resources` Baggins resources.
function withBilbo(made: Made, resources: number): Made & { bilbo: string } {
  const bilbo = first(made.state, "132001");
  const seat = made.state.seats[0]!;
  const cards = { ...made.state.cards, [bilbo]: { ...made.state.cards[bilbo]!, zone: "heroes" as const, controller: 0, resources } };
  return { ...made, bilbo, state: { ...made.state, cards, seats: [{ ...seat, heroes: [...seat.heroes, bilbo] }, made.state.seats[1]!] as const } };
}
const progressOn = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.progress ?? 0;
const withProgress = (state: ScenarioState, code: string, progress: number): ScenarioState => ({ ...state, cards: { ...state.cards, [idOf(state, code)]: { ...state.cards[idOf(state, code)]!, progress } } });
const stat = (state: ScenarioState, ctx: Made["ctx"], code: string, which: Parameters<typeof modifiedStat>[2]): number => {
  const synced = syncConstants(state, ctx);
  return modifiedStat(synced, synced.cards[idOf(synced, code)]!, which, ctx.cards);
};

describe("Misty Mountain Eagle (132052:A:1)", () => {
  const eagleTable = (resources: number, layout: Layout = {}) => withBilbo(table({ staging: ["132052"], ...layout, play: ["132001"] }), resources);
  const trigger = (made: Made) => legalIntents(made.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(made.state, "132052"));
  const use = (made: Made & { bilbo: string }, option: string) => {
    const intent = trigger(made);
    if (!intent || intent.type !== "Trigger") throw new Error("the Action is not offered");
    const sent = finish(send({ state: made.state, steps: [] }, { ...intent, payments: [{ heroId: made.bilbo, amount: 2 }] }, made.ctx), made.ctx, () => option);
    return sent.state;
  };

  it("132052:A:1 the Action is offered from the staging area only when the first player can spend 2 Baggins resources", () => {
    expect(trigger(eagleTable(2))).toBeDefined();
    expect(trigger(eagleTable(1))).toBeUndefined();
    expect(trigger(eagleTable(0))).toBeUndefined();
  });

  it("132052:A:1 spending the 2 Baggins resources, the first player may take control of the Eagle", () => {
    const made = eagleTable(2);
    const after = use(made, "control");
    expect(after.cards[first(after, "132052")]?.zone).toBe("play");
    expect(after.cards[first(after, "132052")]?.controller).toBe(0);
    expect(after.cards[made.bilbo]?.resources).toBe(0);
  });

  it("132052:A:1 the Eagle discards itself and a non-unique enemy of the staging area, never one engaged with a player", () => {
    const made = eagleTable(2, { staging: ["132052", "f3"], engaged: [{ code: "f0", seat: 0 }] });
    const intent = trigger(made);
    if (!intent || intent.type !== "Trigger") throw new Error("the Action is not offered");
    let run = send({ state: made.state, steps: [] }, { ...intent, payments: [{ heroId: made.bilbo, amount: 2 }] }, made.ctx);
    expect(run.state.window?.kind).toBe("choose");
    run = send(run, { type: "Choose", optionId: "discard" }, made.ctx);
    // The only enemy the pick can name is the one in the staging area: it is taken without asking.
    const after = settle(run.state, made.ctx, []);
    expect(after.cards[first(after, "f3")]?.zone).toBe("encounterDiscard");
    expect(after.cards[first(after, "f0")]?.zone).toBe("engaged");
    expect(after.cards[first(after, "132052")]?.zone).not.toBe("staging");
  });

  it("132052:A:1 the discard option is not offered when only an engaged enemy is in play", () => {
    const made = eagleTable(2, { engaged: [{ code: "f0", seat: 0 }] });
    const intent = trigger(made);
    if (!intent || intent.type !== "Trigger") throw new Error("the Action is not offered");
    const run = send({ state: made.state, steps: [] }, { ...intent, payments: [{ heroId: made.bilbo, amount: 2 }] }, made.ctx);
    expect(run.state.window?.kind === "choose" ? run.state.window.options : []).not.toContain("discard");
  });
});

describe("Bolg (132053:A:2, 132053:A:3)", () => {
  it("132053:A:2 his Threat is the number of players", () => {
    expect(stat(table({ staging: ["132053"] }).state, table().ctx, "132053", "threat")).toBe(1);
    const two = table({ seats: 2, staging: ["132053"] });
    expect(stat(two.state, two.ctx, "132053", "threat")).toBe(2);
  });

  it("132053:A:3 he cannot leave the staging area: no engagement names him", () => {
    const made = table({ phase: "Encounter", staging: ["132053", "f3"] });
    made.state = syncConstants(made.state, made.ctx);
    const named = legalTargets(made.state, { type: "Engage" }, made.ctx);
    expect(named).toContain(first(made.state, "f3"));
    expect(named).not.toContain(first(made.state, "132053"));
  });
});

describe("Bodyguard of Bolg (132054:A:1, 132054:A:2)", () => {
  // The damage 2 points of damage put on Bolg leave on him.
  const damageOnBolg = (made: Made): number => {
    const bolg = idOf(made.state, "132053");
    const out = settle({ ...runInstruction(syncConstants(made.state, made.ctx), { verb: "DamageCard", amount: 2, target: "self" }, { seat: 0, sourceId: bolg }, made.ctx, []), window: null }, made.ctx, []);
    return out.cards[bolg]?.damage ?? 0;
  };

  it("132054:A:1 Bolg takes damage in the staging area with no Bodyguard of Bolg in play", () => {
    expect(damageOnBolg(table({ staging: ["132053"] }))).toBe(2);
  });

  it("132054:A:1 Bolg takes no damage in the staging area while a Bodyguard of Bolg is in play, before stage 5", () => {
    expect(damageOnBolg(table({ staging: ["132053", "132054"] }))).toBe(0);
    expect(damageOnBolg(table({ staging: ["132053"], engaged: [{ code: "132054", seat: 0 }] }))).toBe(0);
  });

  it("132054:A:1 Bolg takes no damage at stage 5 while a Bodyguard of Bolg is in play, and takes it again once the Bodyguard is gone", () => {
    expect(damageOnBolg(table({ stage: S5, staging: ["132053", "132054"] }))).toBe(0);
    expect(damageOnBolg(table({ stage: S5, staging: ["132053"] }))).toBe(2);
  });

  it("132054:A:2 the Bodyguard is dealt an additional shadow card for each stage in play with no progress", () => {
    const shadows = (progress: boolean) => {
      const tableOf = (layout: Layout) => {
        const made = inPlay(layout);
        return progress ? { ...made, state: withProgress(made.state, S3, 1) } : made;
      };
      const fought = fightEnemy(tableOf, "f0", "132054", {});
      return fought.start.encounterDeck.length - fought.during.encounterDeck.length;
    };
    expect(shadows(false) - shadows(true)).toBe(1);
    expect(shadows(false)).toBe(4);
  });
});

// The state after a Forced event: the effects of the records that listen to it resolve, and their choices take the first option.
function announced(made: Made, state: ScenarioState, event: Parameters<typeof fireForced>[1]): ScenarioState {
  const steps: EngineStep[] = [];
  return finish({ state: settle(fireForced({ ...state, window: null }, event, made.ctx, steps), made.ctx, steps), steps }, made.ctx).state;
}
// A table with the stages in play, `current` the current stage.
function atStage(current: string, layout: Layout = {}) {
  const made = inPlay(layout);
  return { ...made, state: { ...made.state, questStage: idOf(made.state, current) } };
}
const currentCode = (state: ScenarioState): string | undefined => state.cards[state.questStage ?? ""]?.code;

describe("Gundabad Wolf Rider (132055:A:1, 132055:A:2)", () => {
  it("132055:A:1 when it attacks, 1 progress leaves the current stage", () => {
    const tableOf = (layout: Layout) => {
      const made = atStage(S3, layout);
      return { ...made, state: withProgress(made.state, S3, 3) };
    };
    const fought = fightEnemy(tableOf, "f0", "132055", {});
    expect(progressOn(fought.run.state, S3)).toBe(2);
  });

  it("132055:A:2 Shadow: the attacking enemy gets +1 Attack for each stage in play with no progress", () => {
    const attackOf = (shadow: string, progress: boolean) => {
      const tableOf = (layout: Layout) => {
        const made = inPlay(layout);
        return progress ? { ...made, state: withProgress(made.state, S3, 1) } : made;
      };
      const fought = fightEnemy(tableOf, shadow, "f3", {});
      return modifiedStat(fought.during, fought.during.cards[idOf(fought.during, "f3")]!, "attack", fought.ctx.cards);
    };
    expect(attackOf("132055", false) - attackOf("f0", false)).toBe(3);
    expect(attackOf("132055", true) - attackOf("f0", true)).toBe(2);
  });
});

describe("Vanguard of Bolg, Gundabad Archer, Ravenous Warg (132057:A:2, 132058:A:1, 132058:A:2, 132059:A:2)", () => {
  const nearDeath = (state: ScenarioState, made: { hero: string; ctx: Made["ctx"] }): ScenarioState => ({
    ...state,
    cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: modifiedStat(state, state.cards[made.hero]!, "hitPoints", made.ctx.cards) - 1 } },
  });

  it("132057:A:2 Shadow: an attack that destroys a character removes all progress from the current stage", () => {
    const tableOf = (layout: Layout) => {
      const made = atStage(S3, layout);
      return { ...made, state: withProgress(made.state, S3, 5) };
    };
    const progressAfter = (shadow: string) => {
      const fought = fightEnemy(tableOf, shadow, "132055", {}, { tweak: nearDeath, undefended: true });
      return progressOn(fought.run.state, S3);
    };
    // The Wolf Rider's own Forced effect removes 1 progress in both games.
    expect(progressAfter("f0")).toBe(4);
    expect(progressAfter("132057")).toBe(0);
  });

  it("132058:A:1 each player deals 2 damage to a character he controls", () => {
    const made = table({ staging: ["132058"] });
    const hero = made.hero;
    const run = resolveRecords(made.state, made.ctx, "132058", "whenRevealed", first(made.state, "132058"), (state) => (state.window?.kind === "choose" ? (state.window.options.includes(hero) ? hero : (state.window.options[0] ?? "")) : ""));
    expect(run.state.cards[hero]?.damage).toBe(2);
  });

  it("132058:A:2 Shadow: the defending character takes 1 damage for each stage in play with no progress", () => {
    const damage = (shadow: string) => {
      const fought = fightEnemy(inPlay, shadow, "f3", {});
      return fought.run.state.cards[fought.made.hero]?.damage ?? 0;
    };
    expect(damage("132058") - damage("f0")).toBe(3);
  });

  it("132059:A:2 Shadow: the defending character gets -1 Defense for each stage in play with no progress", () => {
    const fought = fightEnemy(inPlay, "132059", "f3", {});
    const lowered = fought.during.modifiers.filter((modifier) => modifier.stat === "defense" && modifier.instanceId === fought.made.hero);
    expect(lowered.map((modifier) => modifier.amount)).toEqual([-3]);
    expect(modifiedStat(fought.during, fought.during.cards[fought.made.hero]!, "defense", fought.ctx.cards)).toBe(0);
  });
});

describe("Northern Slopes (132060:A:1, 132060:A:2)", () => {
  it("132060:A:1 in the staging area each Goblin enemy, staged or engaged, gets +1 Attack and +1 Defense", () => {
    const withSlopes = table({ staging: ["132060", "132053"], engaged: [{ code: "132055", seat: 0 }] });
    const without = table({ staging: ["132053"], engaged: [{ code: "132055", seat: 0 }] });
    for (const code of ["132053", "132055"]) {
      for (const which of ["attack", "defense"] as const) expect(stat(withSlopes.state, withSlopes.ctx, code, which) - stat(without.state, without.ctx, code, which)).toBe(1);
    }
  });

  it("132060:A:1 the bonus reaches Bolg at stage 5, and a Goblin of the staging area when it is the active location is not held by it", () => {
    const five = table({ stage: S5, staging: ["132060", "132053"] });
    const none = table({ stage: S5, staging: ["132053"] });
    expect(stat(five.state, five.ctx, "132053", "attack") - stat(none.state, none.ctx, "132053", "attack")).toBe(1);
    const active = table({ active: "132060", staging: ["132053"] });
    expect(stat(active.state, active.ctx, "132053", "attack")).toBe(stat(none.state, none.ctx, "132053", "attack"));
  });

  it("132060:A:2 as the active location, a character leaving play removes 1 progress from the current stage", () => {
    const made = atStage(S2, { active: "132060" });
    const ready = withProgress(made.state, S2, 3);
    const hero = made.hero;
    const after = announced(made, ready, { trigger: "leftPlay", seat: 0, cardId: hero, subject: hero });
    expect(progressOn(after, S2)).toBe(2);
  });
});

describe("The stage locations (132061 to 132063: A:2, A:3)", () => {
  // At the end of the round 2 progress leave the location's stage.
  const endOfRound = (location: string, stage: string): number => {
    const made = atStage(stage, { staging: [location] });
    return progressOn(announced(made, withProgress(made.state, stage, 5), { trigger: "endOfRound", seat: null }), stage);
  };
  // Whether the players may travel to the location with `resources` Baggins resources while `current` is the current stage.
  const travels = (location: string, current: string, resources: number): boolean => {
    const made = withBilbo(atStage(current, { phase: "Travel", staging: [location], play: ["132001"] }), resources);
    return legalIntents(made.state, made.ctx).some((intent) => intent.type === "Travel");
  };
  // The cost is 1 while the location's own stage is current and 3 otherwise.
  const costs = (location: string, stage: string): unknown => {
    const other = stage === S2 ? S3 : S2;
    return [[travels(location, stage, 0), travels(location, stage, 1)], [travels(location, other, 2), travels(location, other, 3)]];
  };
  const COSTS = [[false, true], [false, true]];

  it("132061:A:2 Ruins of Dale: at the end of the round 2 progress leave stage 3", () => expect(endOfRound("132061", S3)).toBe(3));
  it("132062:A:2 Ravenhill: at the end of the round 2 progress leave stage 4", () => expect(endOfRound("132062", S4)).toBe(3));
  it("132063:A:2 The Front Gate: at the end of the round 2 progress leave stage 2", () => expect(endOfRound("132063", S2)).toBe(3));
  it("132061:A:3 Ruins of Dale: travelling costs 1 Baggins resource while stage 3 is the current quest, and 3 otherwise", () => expect(costs("132061", S3)).toEqual(COSTS));
  it("132062:A:3 Ravenhill: travelling costs 1 Baggins resource while stage 4 is the current quest, and 3 otherwise", () => expect(costs("132062", S4)).toEqual(COSTS));
  it("132063:A:3 The Front Gate: travelling costs 1 Baggins resource while stage 2 is the current quest, and 3 otherwise", () => expect(costs("132063", S2)).toEqual(COSTS));
});

describe("Misty Mountain Eagle's Shadow (132052:A:2)", () => {
  it("132052:A:2 Shadow: the attacking enemy takes 3 damage", () => {
    const damage = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "132057", {});
      return fought.run.state.cards[idOf(fought.run.state, "132057")]?.damage ?? 0;
    };
    expect(damage("132052") - damage("f0")).toBe(3);
  });
});

describe("Bilbo Baggins (132001:A:1)", () => {
  it("132001:A:1 Bilbo collects 1 Baggins resource in the resource phase", () => {
    const made = withBilbo(table({ play: ["132001"] }), 0);
    const after = gainSeatResources(made.state, 0, [], { kind: "rule", rule: "rr.step-1-2" } as never);
    expect(after.cards[made.bilbo]?.resources).toBe(1);
  });
});

describe("The attacks (132064:A:1, 132064:A:2, 132059:A:1)", () => {
  it("132064:A:1 each enemy engaged with a player attacks at once, and no shadow card is dealt for it", () => {
    const made = table({ staging: ["132064"], engaged: [{ code: "f3", seat: 0 }], deck: ["f0", "f0", "f0"], phase: "Encounter" });
    const run = resolveRecords(made.state, made.ctx, "132064", "whenRevealed", first(made.state, "132064"));
    expect(run.state.pendingAttack?.enemyId).toBe(first(made.state, "f3"));
    expect(run.state.encounterDeck).toHaveLength(3);
    expect(run.state.cards[first(run.state, "132064")]?.zone).not.toBe("surge");
  });

  it("132064:A:1 with no enemy engaged with a player the card gains surge: the next encounter card is revealed", () => {
    const made = table({ staging: [], deck: ["132064", "f0", "f3"] });
    const state = revealedTop(made, "132064");
    expect(state.staging.some((id) => state.cards[id]?.code === "f0")).toBe(true);
  });

  it("132064:A:2 Shadow: the attacking enemy makes an additional attack at once", () => {
    const damage = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "132055", {});
      return fought.run.state.cards[fought.made.hero]?.damage ?? 0;
    };
    // The hero that defended the first attack is exhausted, so the additional attack is undefended: Attack 3 on top of the 1 damage of the first.
    expect(damage("132064") - damage("f0")).toBe(3);
  });
});

describe("Goblins are Upon You! (132065:A:1, 132065:A:2)", () => {
  // A Response on a card in play that cancels the When Revealed effects of the card just revealed; true when it is offered for the revealed card.
  const cancels: Effect = { id: "blade:response:9", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const offered = (revealed: string): boolean => {
    const made = table({ deck: ["f0", "f0"] });
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, cancels], cards: new Map([...made.ctx.cards, ["blade", definePrinted({ code: "blade", name: "Blade", type: "attachment" })]]) };
    const blade = spawn(made.state, "blade", { zone: "play", seat: 0 });
    const held = attachTo(blade.state, blade.id, made.hero);
    const revealing = revealFromTop(held, ctx, revealed, []);
    return legalIntents(revealing.state, ctx).some((intent) => intent.type === "Trigger" && intent.cardId === blade.id);
  };

  it("132065:A:1 its When Revealed effect cannot be canceled, as one of another card can", () => {
    expect(offered("132058")).toBe(true);
    expect(offered("132065")).toBe(false);
  });

  it("132065:A:1 each player searches the encounter deck and discard pile for a Goblin enemy and engages it", () => {
    const made = table({ deck: ["f0", "132055", "f0"], discard: ["132056"], staging: ["132065"] });
    const run = resolveRecords(made.state, made.ctx, "132065", "whenRevealed", first(made.state, "132065"));
    const engaged = Object.values(run.state.cards).filter((card) => card.zone === "engaged").map((card) => card.code);
    expect(engaged).toHaveLength(1);
    expect(["132055", "132056"]).toContain(engaged[0]);
  });

  it("132065:A:2 Shadow: the attacking enemy gets +1 Attack for each Goblin enemy engaged with the defending player", () => {
    const attackOf = (shadow: string) => {
      const fought = fightEnemy(table, shadow, "f3", { engaged: [{ code: "f3", seat: 0 }, { code: "132055", seat: 0 }, { code: "132056", seat: 0 }] });
      return modifiedStat(fought.during, fought.during.cards[first(fought.during, "f3")]!, "attack", fought.ctx.cards);
    };
    expect(attackOf("132065") - attackOf("f0")).toBe(2);
  });
});

describe("Heedless of Order (132066:A:2)", () => {
  const answerStage = (state: ScenarioState, code: string) => (current: ScenarioState): string => (current.window?.kind === "choose" ? (current.window.options.find((option) => current.cards[option]?.code === code) ?? current.window.options[0] ?? "") : state.firstPlayer.toString());

  it("132066:A:2 the first player chooses another stage to be the current stage, and the choice is the first player's again next round", () => {
    const made = atStage(S2, { staging: ["132066"] });
    const run = resolveRecords(made.state, made.ctx, "132066", "whenRevealed", first(made.state, "132066"), answerStage(made.state, S4));
    expect(currentCode(run.state)).toBe(S4);
    // No threat is raised: the current stage changed.
    expect(run.state.seats[0]?.threat).toBe(made.state.seats[0]?.threat);
    // The next round asks again, before the resources are collected (hob.current-quest-stage).
    const next = askCurrentStage({ ...run.state, round: run.state.round + 1 }, []);
    expect(next?.stack.length).toBeGreaterThan(0);
  });

  it("132066:A:2 with no other stage to choose, as in the Setup, it gains Doomed 3 and raises each player's threat by 3", () => {
    const made = table({ staging: ["132066"] });
    const run = resolveRecords(made.state, made.ctx, "132066", "whenRevealed", first(made.state, "132066"));
    expect((run.state.seats[0]?.threat ?? 0) - (made.state.seats[0]?.threat ?? 0)).toBe(3);
  });
});

describe("The stages (132075:A:1, 132076:B:2, 132077:B:2, 132078:B:2, 132078:B:3, 132077:B:3)", () => {
  it("132075:A:1 the Setup shuffles the encounter deck and reveals 1 card for the player", () => {
    const made = table({ deck: ["f0", "f3", "f0"], staging: ["132053"] });
    const run = resolveRecords(made.state, made.ctx, S1, "setup", first(made.state, S1));
    expect(run.state.encounterDeck).toHaveLength(2);
  });

  it("132053:A:4 the first Goblin the Setup reveals gains surge, so the Setup round shows a second card revealed", () => {
    // Goblins only, so the shuffle changes nothing: 1 player reveals 1 card, and the surge of the first Goblin reveals 1 more.
    const made = table({ deck: ["132055", "132056", "132058"], staging: ["132053"] });
    const run = resolveRecords(made.state, made.ctx, S1, "setup", first(made.state, S1));
    expect(run.state.staging).toHaveLength(3);
    expect(run.state.encounterDeck).toHaveLength(1);
  });

  it("132076:B:2 with no progress on stage 2 at the end of the round each player discards 1 random card from his hand", () => {
    const made = inPlay({ hand: ["filler", "filler", "filler"] });
    const discarded = (state: ScenarioState) => 3 - state.seats[0]!.hand.length;
    expect(discarded(announced(made, made.state, { trigger: "endOfRound", seat: null }))).toBe(1);
    expect(discarded(announced(made, withProgress(made.state, S2, 1), { trigger: "endOfRound", seat: null }))).toBe(0);
  });

  it("132077:B:2 Battle: stage 3 has Battle while it is the current stage", () => {
    const current = atStage(S3);
    const other = atStage(S2);
    expect(stat(current.state, current.ctx, S3, "battle")).toBe(1);
    expect(stat(other.state, other.ctx, S3, "battle")).toBe(0);
  });

  it("132078:B:2 Siege: stage 4 has Siege while it is the current stage", () => {
    const current = atStage(S4);
    const other = atStage(S2);
    expect(stat(current.state, current.ctx, S4, "siege")).toBe(1);
    expect(stat(other.state, other.ctx, S4, "siege")).toBe(0);
  });

  it("132078:B:3 with no progress on stage 4 at the end of the round every hero's resources are discarded, Bilbo's too", () => {
    const made = withBilbo(inPlay({ play: ["132001"], heroResources: 2 }), 3);
    const pools = (state: ScenarioState) => state.seats[0]!.heroes.map((id) => state.cards[id]?.resources ?? 0);
    expect(pools(announced(made, made.state, { trigger: "endOfRound", seat: null })).every((count) => count === 0)).toBe(true);
    expect(pools(announced(made, withProgress(made.state, S4, 1), { trigger: "endOfRound", seat: null })).some((count) => count > 0)).toBe(true);
  });

  it("132077:B:3 with no progress on stage 3 at the end of the round the first player adds the topmost enemy of the discard pile to the staging area", () => {
    const made = inPlay({ discard: ["132056", "132055"] });
    const after = announced(made, made.state, { trigger: "endOfRound", seat: null });
    expect(after.staging.map((id) => after.cards[id]?.code)).toContain("132055");
    const kept = announced(made, withProgress(made.state, S3, 1), { trigger: "endOfRound", seat: null });
    expect(kept.staging.map((id) => kept.cards[id]?.code)).not.toContain("132055");
  });
});

describe("Stage 5 (132079:B:1, 132079:B:2, 132079:B:3)", () => {
  it("132079:B:1 each player searches the encounter deck and discard pile for a Bodyguard of Bolg and adds it to the staging area", () => {
    const made = table({ stage: S5, staging: [], deck: ["f0", "132054", "f0"], discard: ["f3"] });
    const run = resolveRecords(made.state, made.ctx, S5, "whenRevealed", first(made.state, S5));
    expect(run.state.staging.map((id) => run.state.cards[id]?.code)).toEqual(["132054"]);
  });

  it("132079:B:2 no progress can be placed on stage 5, and Bolg in the staging area is considered engaged with the first player", () => {
    const five = table({ stage: S5, staging: ["132053"] });
    const placed = settle({ ...runInstruction(five.state, { verb: "ProgressQuest", amount: 3 }, { seat: 0, sourceId: null }, five.ctx, []), window: null }, five.ctx, []);
    expect(progressOn(placed, S5)).toBe(0);
    const synced = syncConstants(five.state, five.ctx);
    expect(flagged(synced, idOf(synced, "132053"), "engagedWithFirst")).toBe(true);
    const before = table({ stage: S1, staging: ["132053"] });
    const unsynced = syncConstants(before.state, before.ctx);
    expect(flagged(unsynced, idOf(unsynced, "132053"), "engagedWithFirst")).toBe(false);
  });

  it("132079:B:3 damage that destroys Bolg in the staging area discards him and wins the game", () => {
    const made = table({ stage: S5, staging: ["132053"] });
    const bolg = idOf(made.state, "132053");
    const hit = settle({ ...runInstruction({ ...syncConstants(made.state, made.ctx), mode: "stopped" }, { verb: "DamageCard", amount: 8, target: "self" }, { seat: 0, sourceId: bolg }, made.ctx, []), window: null }, made.ctx, []);
    expect(hit.cards[bolg]?.zone).toBe("encounterDiscard");
    expect(hit.stageCleared).toBe(true);
  });

  it("132079:B:3 destroying Bolg wins the game, and any other enemy does not", () => {
    const made = table({ stage: S5, staging: ["132053", "f3"] });
    const event = (code: string) => ({ trigger: "enemyDestroyed" as const, seat: 0, cardId: idOf(made.state, code), subject: idOf(made.state, code) });
    expect(announced(made, syncConstants(made.state, made.ctx), event("132053")).stageCleared).toBe(true);
    expect(announced(made, syncConstants(made.state, made.ctx), event("f3")).stageCleared).toBeFalsy();
  });
});

describe("Ravenous Warg forcing an exhausted Bilbo to defend (132059:A:1)", () => {
  // The treasures are not dealt by the table's layout: the Ring's printed card joins the table's own copy of the cards.
  let printedRing: Awaited<ReturnType<typeof loadPrinted>>;
  beforeAll(async () => {
    printedRing = await loadPrinted(["132019"]);
  });
  // Bilbo (132001) holds Bilbo's Magic Ring (132019), is damaged and exhausted, and Ravenous Warg attacks: the Warg's Forced effect makes Bilbo the defender. Returns what the first player may trigger once he is declared.
  function offeredRing(exhausted: boolean): boolean {
    const base = table({ phase: "Encounter", engaged: [{ code: "132059", seat: 0 }], play: ["132001"], deck: ["f0", "f0"] });
    for (const [code, card] of printedRing) (base.ctx.cards as Map<string, typeof card>).set(code, card);
    const spawned = spawn(base.state, "132019", { zone: "play", seat: 0 });
    const made = withBilbo({ ...base, state: attachTo(spawned.state, spawned.id, first(base.state, "132001")) }, 5);
    const cards = { ...made.state.cards, [made.bilbo]: { ...made.state.cards[made.bilbo]!, damage: 1, exhausted } };
    const state = syncConstants({ ...made.state, cards: { ...cards, [made.hero]: { ...cards[made.hero]!, exhausted: true } } }, made.ctx);
    let run = send({ state, steps: [] }, { type: "DeclineEngage" }, made.ctx);
    for (let guard = 0; guard < 40 && run.state.window?.kind !== "defense"; guard += 1) {
      const pass = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack" || intent.type === "DeclineEngage");
      if (!pass) break;
      run = send(run, pass, made.ctx);
    }
    run = send(run, { type: "DeclareDefender", defenderId: made.bilbo }, made.ctx);
    const ring = first(run.state, "132019");
    // Only the Response (132019:A:3): the Action (132019:A:2) is offered in any window and says nothing of defending.
    return legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === ring && intent.effectId === "132019:response:1");
  }

  it("132059:A:1 Bilbo already exhausted, forced to defend, does not trigger the Ring's After Bilbo exhausts to defend (132019:A:3)", () => {
    expect(offeredRing(true)).toBe(false);
  });

  it("132059:A:1 Bilbo ready, forced to defend by the Warg, exhausts to defend and the Ring is offered", () => {
    expect(offeredRing(false)).toBe(true);
  });
});
