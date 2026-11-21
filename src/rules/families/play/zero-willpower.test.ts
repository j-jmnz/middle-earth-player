import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { addModifier, modifiedStat, versusDefender } from "../../core/keywords.ts";
import { victoryPointsOf } from "../../core/printed-stat.ts";
import { definePrinted } from "../../core/printed.ts";
import { settle } from "../../engine/machine.ts";
import { resolveAmount } from "../../interpret/amounts.ts";
import { pickCandidates } from "../../interpret/pick.ts";
import { syncConstants } from "../../interpret/constants.ts";
import { updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { ally, enemy, hero, table } from "../defense/table.ts";

// Rules: rr.constant-ability, rr.modifiers, rr.lasting-effects, rr.victory, rr.destroy (data/rules/entries.json); ledger lines 04013:B:2, 04022:A:2, 901306:A:1, 901301:A:2, 901302:A:2, 901303:A:1, 901304:A:2, 03054:A:1.
// discardAtZeroWillpower: the settle sweep discards a character in play whose Willpower is 0; noWillpowerGain: a raise of Willpower from a player card does not count; playerVictoryIgnored: a player card in the victory display scores 0;
// the amount remainingQuestPoints; the pick filters highestWillpower and `on.committed`; the stat condition versusDefender `maxWillpower`.

const STAGE_RULE: Effect = {
  id: "peaks:constant:1",
  cardCode: "peaks",
  lines: ["peaks:B:2"],
  timing: "constant",
  instructions: [{ verb: "ModifyStat", stat: "discardAtZeroWillpower", amount: 1, until: "whileSourceInPlay", holders: { type: "character", control: "any" } }],
};
const PEAKS = definePrinted({ code: "peaks", name: "Peaks", type: "quest", questPoints: 20 });

function onStage() {
  const built = table({ cards: [hero("a", { willpower: 2 }), hero("b", { willpower: 1 }), hero("c", { willpower: 0 }), ally("friend", { willpower: 1 }), PEAKS], effects: [STAGE_RULE], heroes: [{ code: "a" }, { code: "b" }], allies: [{ code: "friend" }] });
  const stage = spawn(built.state, "peaks", { zone: "questStage" });
  return { ...built, state: { ...stage.state, questStage: stage.id } satisfies ScenarioState, stage: stage.id };
}

const zoneOf = (state: ScenarioState, id: string) => state.cards[id]?.zone;

describe("discardAtZeroWillpower (04013:B:2, 04022:A:2)", () => {
  it("04013:B:2 discards a character whose Willpower is 0 and keeps the others, whichever the phase", () => {
    const { state, ids, ctx } = onStage();
    // Printed Willpower 1 with the -1 of a modifier: 0; the hero with 2 keeps playing.
    const hit = addModifier(state, ids.b!, ids.b!, "willpower", -1, "endOfPhase");
    const done = settle(syncConstants(hit, ctx), ctx, []);
    expect(zoneOf(done, ids.a!)).toBe("heroes");
    expect(zoneOf(done, ids.b!)).toBe("discard");
    expect(zoneOf(done, ids.friend!)).toBe("play");
  });

  it("04013:B:2 discards an ally at 0 as well, and a hero whose -2 from an attachment brings it to 0", () => {
    const { state, ids, ctx } = onStage();
    const cold = addModifier(addModifier(state, ids.friend!, ids.friend!, "willpower", -1, "endOfPhase"), ids.a!, ids.a!, "willpower", -2, "whileSourceInPlay");
    const done = settle(syncConstants(cold, ctx), ctx, []);
    expect(zoneOf(done, ids.friend!)).toBe("discard");
    expect(zoneOf(done, ids.a!)).toBe("discard");
  });

  it("04013:B:2 discards nobody while the stage's constant is not in play", () => {
    const { state, ids, ctx } = onStage();
    const gone = { ...state, cards: { ...state.cards, [state.questStage!]: { ...state.cards[state.questStage!]!, zone: "removed" as const } } };
    const hit = addModifier(gone, ids.b!, ids.b!, "willpower", -1, "endOfPhase");
    expect(zoneOf(settle(syncConstants(hit, ctx), ctx, []), ids.b!)).toBe("heroes");
  });

  it("04022:A:2 discards the defender the Shadow's flag holds when its Willpower is 0, and not the other characters", () => {
    const SHADE: Effect = { id: "shade:shadow:1", cardCode: "shade", lines: ["shade:A:2"], timing: "shadow", instructions: [{ verb: "ModifyStat", stat: "discardAtZeroWillpower", amount: 1, until: "endOfPhase", target: "defender" }] };
    const built = table({ cards: [hero("a", { willpower: 1 }), hero("b", { willpower: 1 }), definePrinted({ code: "shade", name: "Shade", type: "treachery" })], effects: [SHADE], heroes: [{ code: "a" }, { code: "b" }] });
    const dealt = spawn(built.state, "shade", { zone: "encounterDiscard" }).state;
    let state: ScenarioState = dealt;
    for (const [stat, amount] of [["willpower", -1], ["discardAtZeroWillpower", 1]] as const) state = addModifier(state, built.ids.a!, built.ids.a!, stat, amount, "endOfPhase");
    const done = settle(state, built.ctx, []);
    expect(zoneOf(done, built.ids.a!)).toBe("discard");
    expect(zoneOf(done, built.ids.b!)).toBe("heroes");
  });
});

describe("noWillpowerGain (901306:A:1)", () => {
  const BOOST = definePrinted({ code: "boost", name: "Boost", type: "attachment", sphere: "spirit", cost: 0 });
  const MIST = definePrinted({ code: "mist", name: "Mist", type: "treachery" });

  it("901306:A:1 does not count a raise of Willpower from a player card, and still counts a reduction and an encounter card's raise", () => {
    const built = table({ cards: [hero("a", { willpower: 2 }), BOOST, MIST], effects: [], heroes: [{ code: "a" }], staging: [{ code: "mist" }], attachments: [{ code: "boost", host: "a" }] });
    const hostCard = (state: ScenarioState) => state.cards[built.ids.a!]!;
    let state = addModifier(built.state, built.ids.a!, built.ids.boost!, "willpower", 2, "whileSourceInPlay");
    expect(modifiedStat(state, hostCard(state), "willpower", built.ctx.cards)).toBe(4);
    state = addModifier(state, "table", built.ids.mist!, "noWillpowerGain", 1, "whileSourceInPlay") as ScenarioState;
    state = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: built.ids.mist!, stat: "noWillpowerGain", amount: 1, until: "whileSourceInPlay" }] };
    expect(modifiedStat(state, hostCard(state), "willpower", built.ctx.cards)).toBe(2);
    const reduced = addModifier(state, built.ids.a!, built.ids.boost!, "willpower", -1, "whileSourceInPlay");
    expect(modifiedStat(reduced, hostCard(reduced), "willpower", built.ctx.cards)).toBe(1);
    const encounter = addModifier(state, built.ids.a!, built.ids.mist!, "willpower", 1, "whileSourceInPlay");
    expect(modifiedStat(encounter, hostCard(encounter), "willpower", built.ctx.cards)).toBe(3);
  });
});

describe("playerVictoryIgnored (901301:A:2)", () => {
  const ARROW = definePrinted({ code: "arrow", name: "Arrow", type: "attachment", sphere: "neutral", cost: 0, victory: 2 });
  const GIANT = definePrinted({ code: "giant", name: "Giant", type: "enemy", attack: 1, defense: 1, health: 3, engagementCost: 30, threat: 1, victory: 1 });

  it("901301:A:2 scores no victory points for a player card in the display, and the points of an encounter card as usual", () => {
    const built = table({ cards: [hero("a"), ARROW, GIANT], effects: [], heroes: [{ code: "a" }] });
    let state: ScenarioState = built.state;
    const arrow = spawn(state, "arrow", { zone: "victory" });
    const giant = spawn(arrow.state, "giant", { zone: "victory" });
    state = giant.state;
    expect(victoryPointsOf(state, arrow.id, built.ctx.cards)).toBe(2);
    const flagged: ScenarioState = { ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: giant.id, stat: "playerVictoryIgnored", amount: 1, until: "endOfGame" }] };
    expect(victoryPointsOf(flagged, arrow.id, built.ctx.cards)).toBe(0);
    expect(victoryPointsOf(flagged, giant.id, built.ctx.cards)).toBe(1);
    expect(resolveAmount(flagged, { victoryPoints: true }, { actor: 0, sourceId: null }, built.ctx)).toBe(1);
  });
});

describe("remainingQuestPoints (901302:A:2)", () => {
  const PLACE = definePrinted({ code: "place", name: "Place", type: "location", threat: 1, questPoints: 5 });

  it("901302:A:2 reads the quest points the active location still needs, 0 with none", () => {
    const built = table({ cards: [hero("a"), PLACE], effects: [], heroes: [{ code: "a" }] });
    const read = (state: ScenarioState) => resolveAmount(state, { remainingQuestPoints: "activeLocation" }, { actor: 0, sourceId: null }, built.ctx);
    expect(read(built.state)).toBe(0);
    const spawned = spawn(built.state, "place", { zone: "activeLocation" });
    const active = { ...spawned.state, activeLocation: spawned.id };
    expect(read(active)).toBe(5);
    expect(read(updateCard(active, spawned.id, { progress: 3 }))).toBe(2);
    expect(read(updateCard(active, spawned.id, { progress: 7 }))).toBe(0);
  });
});

describe("pick filters and stat condition of the Redhorn Gate lines", () => {
  it("901304:A:2 picks the ally with the highest Willpower among those you control, every tied one offered", () => {
    const built = table({ cards: [hero("a"), ally("w1", { willpower: 1 }), ally("w3", { willpower: 3 }), ally("w3b", { willpower: 3 })], effects: [], heroes: [{ code: "a" }], allies: [{ code: "w1" }, { code: "w3" }, { code: "w3b" }] });
    const found = pickCandidates(built.state, { type: "ally", control: "you", highestWillpower: true }, 0, [], null, built.ctx);
    expect(found.sort()).toEqual([built.ids.w3!, built.ids.w3b!].sort());
    const lowered = addModifier(built.state, built.ids.w3!, built.ids.w3!, "willpower", -2, "endOfPhase");
    expect(pickCandidates(lowered, { type: "ally", control: "you", highestWillpower: true }, 0, [], null, built.ctx)).toEqual([built.ids.w3b!]);
  });

  it("03054:A:1 picks an attachment only when its host is committed to the quest", () => {
    const sword = definePrinted({ code: "sword", name: "Sword", type: "attachment", sphere: "tactics", cost: 0 });
    const built = table({ cards: [hero("a"), hero("b"), sword], effects: [], heroes: [{ code: "a" }, { code: "b" }], attachments: [{ code: "sword", host: "a", key: "s1" }, { code: "sword", host: "b", key: "s2" }] });
    const quested = updateCard(built.state, built.ids.a!, { committed: true });
    const pick = { type: "attachment" as const, control: "any" as const, on: { type: "character" as const, control: "any" as const, committed: true } };
    expect(pickCandidates(quested, pick, 0, [], null, built.ctx)).toEqual([built.ids.s1!]);
  });

  it("901303:A:1 holds while the declared defender's current Willpower is at most the number, modifiers counted, and never for an undefended attack", () => {
    const built = table({ cards: [hero("a", { willpower: 2 }), enemy("marauder")], effects: [], heroes: [{ code: "a" }], enemies: [{ code: "marauder" }] });
    const attacking = (state: ScenarioState, undefended = false): ScenarioState => ({ ...state, pendingAttack: { enemyId: built.ids.marauder!, seat: 0, defenderId: undefended ? null : built.ids.a!, undefended } as ScenarioState["pendingAttack"] });
    const holder = built.state.cards[built.ids.marauder!]!;
    expect(versusDefender(attacking(built.state), holder, { maxWillpower: 1 }, built.ctx.cards)).toBe(false);
    const snowed = addModifier(built.state, built.ids.a!, built.ids.a!, "willpower", -1, "endOfPhase");
    expect(versusDefender(attacking(snowed), holder, { maxWillpower: 1 }, built.ctx.cards)).toBe(true);
    expect(versusDefender(attacking(snowed, true), holder, { maxWillpower: 1 }, built.ctx.cards)).toBe(false);
  });
});
