// Rules: rr.action, rr.resource-match, rr.exhausted, rr.step-6-4-1, rr.first-player (data/rules/entries.json); ledger lines 02037:A:1, 02037:A:3, 02046:A:1.
// What a spec row cannot express on Conflict at the Carrock: a negative (a row must fail without its records), a cost, a legal intent, a game over several steps. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { PlayerIntent } from "../../../rules/engine/reduce.ts";

import { attack, defend, exhausted, rowProblems, type Row } from "../../../../test/harness/card-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { allyCard, finish, first, idsOf, legalIntents, legalTargets, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const GRIMBEORN = "02037";
const OAK_WOOD = "02046";

const table = (layout: Layout) => tableFromLayout("conflict-at-the-carrock", layout);
const holds = (row: Row): void => expect(rowProblems("conflict-at-the-carrock", row, EFFECTS)).toEqual([]);
const offeredAction = (made: ReturnType<typeof table>): PlayerIntent | undefined => legalIntents(start(made.state).state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(made.state, GRIMBEORN)) as PlayerIntent | undefined;

describe("negatives of the spec rows", () => {
  it("02037:A:1 exhausts to defend against an enemy that is not a Troll", () => {
    holds({ line: "02037:A:1", layout: { engaged: ["f3"], play: [GRIMBEORN] }, act: [attack("f3"), defend(GRIMBEORN)], expect: exhausted(GRIMBEORN) });
  });
});

describe("02037:A:3 Grimbeorn's Action", () => {
  it("02037:A:3 needs a Leadership resource: the stand-in heroes are Tactics heroes, so it is not offered", () => {
    expect(offeredAction(table({ staging: [GRIMBEORN], heroResources: 2, phase: "Planning" }))).toBeUndefined();
  });

  it("02037:A:3 is offered to any player while Oak-wood Grove lets every hero pay Leadership, and puts the resource on Grimbeorn in the staging area", () => {
    const made = table({ staging: [GRIMBEORN], active: OAK_WOOD, heroResources: 2, phase: "Planning" });
    const offered = offeredAction(made);
    expect(offered).toBeDefined();
    const used = send(start(made.state), { ...(offered as Extract<PlayerIntent, { type: "Trigger" }>), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
    const grimbeorn = first(used.state, GRIMBEORN);
    expect(used.state.cards[grimbeorn]).toMatchObject({ zone: "staging", resources: 1 });
    expect(used.state.cards[made.hero]?.resources).toBe(1);
  });

  it("02037:A:3 is offered again with resources already on him: there is no limit", () => {
    const made = table({ staging: [{ code: GRIMBEORN, resources: 3 }], active: OAK_WOOD, heroResources: 2, phase: "Planning" });
    expect(offeredAction(made)).toBeDefined();
  });
});

describe("900501:A:4 Conflict at the Carrock Nightmare", () => {
  const nightmare = (layout: Layout) => {
    const made = table(layout);
    const spawned = spawn(made.state, "900501", { zone: "nightmare" });
    const flagged = { ...spawned.state, modifiers: [...spawned.state.modifiers, { instanceId: "table", sourceId: spawned.id, stat: "noteQuestProgress" as const, amount: 1, until: "endOfGame" as const }] };
    return { ...made, state: flagged, setup: spawned.id };
  };
  // The quest phase played to its end with both heroes committed, or one (the quest fails against a Threat of 3): the progress the commitment placed is noted, then the Forced effect at the end of the phase reads it.
  function questPhase(made: ReturnType<typeof nightmare>, committed: boolean) {
    let run = start(made.state);
    for (let guard = 0; guard < 8 && run.state.mode === "questCommit"; guard += 1) {
      run = send(run, { type: "Commit", cardIds: committed ? [made.hero, made.hero2] : [made.hero] }, made.ctx);
      run = send(run, { type: "Pass" }, made.ctx);
    }
    return run;
  }

  it("900501:A:4 places 1 progress on the current quest at the end of a quest phase that placed none", () => {
    const made = nightmare({ stage: "02035", progress: 0, staging: ["f3"], phase: "Quest" });
    const run = questPhase(made, false);
    expect(run.state.cards[made.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("900501:A:4 places nothing when the quest placed progress on the quest card this phase", () => {
    const made = nightmare({ stage: "02035", progress: 0, phase: "Quest" });
    const run = questPhase(made, true);
    expect(run.state.cards[made.state.questStage ?? ""]?.progress).toBe(4);
  });
});

describe("02047:A:1 A Frightened Beast", () => {
  const withCreature = (layout: Layout) => {
    const made = table({ deck: ["f0"], ...layout });
    made.cards.set("beast", allyCard("beast", 1, { traits: ["Creature"] }));
    const ally = spawn(made.state, "beast", { zone: "play", seat: 0 });
    return { ...made, state: ally.state, ally: ally.id };
  };
  const revealed = (made: ReturnType<typeof withCreature>, choose: string) => {
    const steps: EngineStep[] = [];
    return finish({ state: revealFromTop(made.state, made.ctx, "02047", steps).state, steps }, made.ctx, (state) => (state.window?.kind === "choose" && state.window.options.includes(choose) ? choose : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""))).state;
  };

  it("02047:A:1 is canceled for everyone when a player discards a Creature ally he controls", () => {
    const made = withCreature({ seats: 2, staging: ["f3", "place"] });
    const after = revealed(made, "discard");
    expect(after.cards[made.ally]?.zone).toBe("discard");
    expect(after.seats[0]?.threat).toBe(28);
    expect(after.seats[1]?.threat).toBe(28);
  });

  it("02047:A:1 raises every player's threat by the staging area's Threat when no ally is discarded", () => {
    const made = withCreature({ seats: 2, staging: ["f3", "place"] });
    const after = revealed(made, "keep");
    expect(after.cards[made.ally]?.zone).toBe("play");
    expect(after.seats[0]?.threat).toBe(33);
    expect(after.seats[1]?.threat).toBe(33);
  });
});

describe("900510:A:1 Time for Supper", () => {
  it("900510:A:1 removes a hero in a discard pile from the game and heals every Troll; it has no Surge when a Troll was damaged", () => {
    const made = table({ engaged: [{ code: "900502", damage: 3 }], staging: [{ code: "900502", damage: 2 }], deck: ["f0"] });
    const gone = spawn(made.state, "dh3", { zone: "discard", seat: 0 });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(gone.state, made.ctx, "900510", steps).state, steps }, made.ctx);
    expect(run.state.cards[gone.id]?.zone).toBe("removed");
    expect(idsOf(run.state, "900502").map((id) => run.state.cards[id]?.damage)).toEqual([0, 0]);
    expect(run.state.cards[first(run.state, "f0")]?.zone).toBe("encounterDeck");
  });

  it("900510:A:1 heals nothing and gains Surge when no hero lies in a discard pile (the part before \"then\" did not resolve, rr.then)", () => {
    const made = table({ engaged: [{ code: "900502", damage: 3 }], deck: ["f0"] });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(made.state, made.ctx, "900510", steps).state, steps }, made.ctx);
    expect(idsOf(run.state, "900502").map((id) => run.state.cards[id]?.damage)).toEqual([3]);
    expect(run.state.cards[first(run.state, "f0")]?.zone).not.toBe("encounterDeck");
  });

  it("900510:A:1 gains Surge when no Troll was damaged: one instance, so one additional card (rr.surge)", () => {
    const made = table({ engaged: ["900502"], deck: ["f0", "f0"] });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(made.state, made.ctx, "900510", steps).state, steps }, made.ctx);
    expect(idsOf(run.state, "f0").filter((id) => run.state.cards[id]?.zone === "encounterDeck")).toHaveLength(1);
  });
});

describe("02038:A:2 After defeating a Troll, a Sacked! may be discarded", () => {
  const defeat = (code: string, seats: 1 | 2 = 1) => {
    const made = table({ seats, phase: "PlayerAttacks", engaged: [{ code, damage: 100 }] });
    const sacked = spawn(made.state, "02048", { zone: "play", seat: 0 });
    const hosted = attachTo(moveCard(sacked.state, sacked.id, { zone: "attached" }), sacked.id, made.hero);
    return { made, state: hosted, sacked: sacked.id };
  };

  it("02038:A:2 offers the discard to a player after he defeats Louis, and puts the Sacked! in the encounter discard pile", () => {
    const { made, state, sacked } = defeat("02038");
    const run = finish(send(start(state), { type: "DeclareAttackers", enemyId: first(state, "02038"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    const offered = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, "02038"));
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, made.ctx), made.ctx);
    expect(used.state.cards[sacked]?.zone).toBe("encounterDiscard");
  });

  it("02038:A:2 is not offered with no Sacked! in play", () => {
    const made = table({ phase: "PlayerAttacks", engaged: [{ code: "02038", damage: 100 }] });
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: first(made.state, "02038"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, "02038"))).toBe(false);
  });
});

// A Troll engaged with one player gives its bonus to the Trolls engaged with any player (printed "engaged with a player").
describe("02039:A:1 and 02040:A:1 the engaged Trolls' bonuses reach every Troll", () => {
  const statOf = (made: ReturnType<typeof table>, code: string, stat: "attack" | "defense") => modifiedStat(made.state, made.state.cards[first(made.state, code)]!, stat, made.cards);

  it("02039:A:1 gives +1 Attack to a Troll engaged with another player, and to Morris himself", () => {
    const made = table({ seats: 2, engaged: ["02039", { code: "02038", seat: 1 }] });
    expect(statOf(made, "02038", "attack")).toBe(5);
    expect(statOf(made, "02039", "attack")).toBe(5);
  });

  it("02039:A:1 gives nothing while Morris is in the staging area", () => {
    const made = table({ seats: 2, staging: ["02039"], engaged: [{ code: "02038", seat: 1 }] });
    expect(statOf(made, "02038", "attack")).toBe(4);
  });

  it("02040:A:1 gives +1 Defense to a Troll engaged with another player, and to Stuart himself", () => {
    const made = table({ seats: 2, engaged: ["02040", { code: "02038", seat: 1 }] });
    expect(statOf(made, "02038", "defense")).toBe(3);
    expect(statOf(made, "02040", "defense")).toBe(3);
  });

  it("02040:A:1 gives nothing while Stuart is in the staging area", () => {
    const made = table({ seats: 2, staging: ["02040"], engaged: [{ code: "02038", seat: 1 }] });
    expect(statOf(made, "02038", "defense")).toBe(2);
  });
});

describe("02039:A:2, 02040:A:2 and 02041:A:2 After defeating a Troll, a Sacked! may be discarded", () => {
  const defeat = (code: string, layout: Layout = {}, engagedSeat = 0) => {
    const made = table({ seats: 2, phase: "PlayerAttacks", engaged: [{ code, damage: 100, seat: engagedSeat }], ...layout });
    const sacked = spawn(made.state, "02048", { zone: "play", seat: 0 });
    const hosted = attachTo(moveCard(sacked.state, sacked.id, { zone: "attached" }), sacked.id, made.hero);
    const attacker = engagedSeat === 0 ? made.hero : (made.seat1Hero as string);
    const run = finish(send(start({ ...hosted, activeSeat: engagedSeat }), { type: "DeclareAttackers", enemyId: first(hosted, code), attackerIds: [attacker] }, made.ctx), made.ctx);
    return { made, run, sacked: sacked.id, offered: legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, code)) as PlayerIntent | undefined };
  };

  const discards = (code: string) => {
    const { made, run, sacked, offered } = defeat(code);
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, made.ctx), made.ctx);
    expect(used.state.cards[sacked]?.zone).toBe("encounterDiscard");
  };

  it("02039:A:2 offers the discard to the player who defeated Morris, and puts the Sacked! in the encounter discard pile", () => discards("02039"));
  it("02040:A:2 offers the discard to the player who defeated Stuart, and puts the Sacked! in the encounter discard pile", () => discards("02040"));
  it("02041:A:2 offers the discard to the player who defeated Rupert, and puts the Sacked! in the encounter discard pile", () => discards("02041"));

  it("02039:A:2 is offered to the player the enemy was engaged with, not to the first player, when that is the second seat", () => {
    const { run, offered } = defeat("02039", { firstPlayer: 0 }, 1);
    expect(offered).toBeDefined();
    expect(run.state.window).toMatchObject({ kind: "response", seat: 1 });
  });
});

describe("02047:A:1 A Frightened Beast counts the staging area, not the active location", () => {
  it("02047:A:1 leaves the active location's Threat out of the total (rr.active-location)", () => {
    const made = table({ staging: ["f3"], active: "02043", deck: ["f0"] });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(made.state, made.ctx, "02047", steps).state, steps }, made.ctx);
    expect(run.state.seats[0]?.threat).toBe(31);
  });
});

describe("02045:A:1 Bee Pastures", () => {
  it("02045:A:1 is offered only after traveling to Bee Pastures itself", () => {
    const made = table({ staging: ["02045", "place"], deck: ["f0", "02037"], phase: "Travel" });
    const traveled = send(start(made.state), { type: "Travel", locationId: first(made.state, "place") }, made.ctx);
    const run = finish(traveled, made.ctx);
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, "02045"))).toBe(false);
    expect(run.state.cards[first(run.state, "02037")]?.zone).toBe("encounterDeck");
  });

  it("02045:A:1 shuffles the encounter deck even when Grimbeorn is not found (a search always shuffles; rr.search)", () => {
    const made = table({ staging: ["02045"], deck: ["f0", "f3", "place", "treachery", "f0", "f3", "place", "treachery"] });
    const before = made.state.encounterDeck.map((id) => made.state.cards[id]?.code).join();
    const run = resolveRecords(made.state, made.ctx, "02045", "response", first(made.state, "02045"));
    const after = run.state.encounterDeck.map((id) => run.state.cards[id]?.code).join();
    expect(run.state.encounterDeck).toHaveLength(8);
    expect(after).not.toBe(before);
  });
});

describe("02049:A:1 Roasted Slowly", () => {
  it("02049:A:1 destroys every hero with a Sacked! attached, any player's, and shuffles itself back with none", () => {
    const made = table({ seats: 2, attached: [{ code: "02048", to: "dh1" }, { code: "02048", to: "dh3" }], deck: ["f0"] });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(made.state, made.ctx, "02049", steps).state, steps }, made.ctx);
    expect(run.state.cards[made.hero]?.zone).toBe("discard");
    expect(run.state.cards[made.seat1Hero as string]?.zone).toBe("discard");
    expect(run.state.cards[made.hero2]?.zone).toBe("heroes");
    const bare = table({ deck: ["f0"] });
    const none = finish({ state: revealFromTop(bare.state, bare.ctx, "02049", steps).state, steps }, bare.ctx);
    expect(none.state.cards[first(none.state, "02049")]?.zone).toBe("encounterDeck");
    expect(none.state.cards[bare.hero]?.zone).toBe("heroes");
  });
});

// The Nightmare Trolls in the victory display lend their strength to every Troll in play, wherever it lies.
describe("900502:A:1, 900505:A:2 and 900507:A:2 a Troll in the victory display", () => {
  const statOf = (made: ReturnType<typeof table>, code: string, stat: "attack" | "defense" | "hitPoints") => modifiedStat(made.state, made.state.cards[first(made.state, code)]!, stat, made.cards);

  it("900502:A:1 gives every Troll +1 hit point while Savage Hill-troll is in the victory display, and nothing from the staging area", () => {
    expect(statOf(table({ engaged: ["02038"], victory: ["900502"] }), "02038", "hitPoints")).toBe(11);
    expect(statOf(table({ engaged: ["02038"], staging: ["900502"] }), "02038", "hitPoints")).toBe(10);
  });

  it("900505:A:2 gives every Troll +1 Attack while Nightmare Morris is in the victory display", () => {
    expect(statOf(table({ engaged: ["02038"], victory: ["900505"] }), "02038", "attack")).toBe(5);
  });

  it("900507:A:2 gives every Troll +1 Defense while Nightmare Stuart is in the victory display", () => {
    expect(statOf(table({ engaged: ["02038"], victory: ["900507"] }), "02038", "defense")).toBe(3);
  });
});

describe("900508:A:1 Troll Lair", () => {
  it("900508:A:1 bars threat reduction while it is in the staging area, and not from anywhere else", () => {
    expect(table({ staging: ["900508"] }).state.modifiers.some((modifier) => modifier.stat === "noThreatReduction")).toBe(true);
    expect(table({ active: "900508" }).state.modifiers.some((modifier) => modifier.stat === "noThreatReduction")).toBe(false);
  });
});

describe("900501:A:5 After defeating a unique Troll, a Sacked! may be discarded", () => {
  const defeat = (code: string, seats: 1 | 2 = 1, engagedSeat = 0) => {
    const made = table({ seats, phase: "PlayerAttacks", engaged: [{ code, damage: 100, seat: engagedSeat }] });
    const setup = spawn(made.state, "900501", { zone: "nightmare" });
    const sacked = spawn(setup.state, "02048", { zone: "play", seat: 0 });
    const hosted = attachTo(moveCard(sacked.state, sacked.id, { zone: "attached" }), sacked.id, made.hero);
    const attacker = engagedSeat === 0 ? made.hero : (made.seat1Hero as string);
    const run = finish(send(start({ ...hosted, activeSeat: engagedSeat }), { type: "DeclareAttackers", enemyId: first(hosted, code), attackerIds: [attacker] }, made.ctx), made.ctx);
    return { made, run, sacked: sacked.id, offered: legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === setup.id) as PlayerIntent | undefined };
  };

  it("900501:A:5 offers the discard to the player who defeated a unique Troll, from the Nightmare card, and puts the Sacked! in the encounter discard pile", () => {
    const { made, run, sacked, offered } = defeat("900504");
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, made.ctx), made.ctx);
    expect(used.state.cards[sacked]?.zone).toBe("encounterDiscard");
  });

  it("900501:A:5 is offered to the player the enemy was engaged with when that is the second seat", () => {
    const { run, offered } = defeat("900504", 2, 1);
    expect(offered).toBeDefined();
    expect(run.state.window).toMatchObject({ kind: "response", seat: 1 });
  });

  it("900501:A:5 is not offered after a Troll that is not unique is defeated", () => {
    expect(defeat("900502").offered).toBeUndefined();
  });
});

describe("900503:A:1 Rob and Bob", () => {
  it("900503:A:1 engages the next player counted from the player it is engaged with: after the second seat comes the first", () => {
    const made = table({ seats: 2, engaged: [{ code: "900503", seat: 1 }], deck: ["f0", "f0", "f0", "f0"] });
    const run = resolveRecords(made.state, made.ctx, "900503", "forced", first(made.state, "900503"));
    expect(run.state.cards[first(run.state, "900503")]?.controller).toBe(0);
  });

  it("900503:A:1 does nothing in a game of one player: there is no next player to engage", () => {
    const made = table({ engaged: ["900503"], deck: ["f0", "f0", "f0", "f0"] });
    const run = resolveRecords(made.state, made.ctx, "900503", "forced", first(made.state, "900503"));
    expect(run.state.cards[first(run.state, "900503")]?.controller).toBe(0);
    expect(run.state.pendingAttack).toBeFalsy();
  });
});

describe("02043:A:2 The Carrock", () => {
  it("02043:A:2 cannot be traveled to by the players, while another location in the staging area can", () => {
    const made = table({ staging: ["02043", "place"], phase: "Travel" });
    const targets = legalTargets(start(made.state).state, { type: "Travel" }, made.ctx);
    expect(targets).toContain(first(made.state, "place"));
    expect(targets).not.toContain(first(made.state, "02043"));
  });
});
