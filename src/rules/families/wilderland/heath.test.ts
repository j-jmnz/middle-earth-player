// Rules: emce.caves-deck, emce.dragon-signs, rr.guarded, rr.victory, rr.cancel, rr.in-play-and-out-of-play, rr.damage (data/rules/entries.json); ledger lines 12175:B:7, 19012:A:3, 19015:A:1, 19018:A:1, 19022:A:1, 19022:B:1, 19024:A:1, 19024:B:2, 19021:A:1, 19023:B:3.
// The verbs The Withered Heath adds to the wilderland family, one by one, on the family's fixture table.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { definePrinted } from "../../core/printed.ts";
import { UNATTRIBUTED } from "../../core/cause.ts";
import { pileOf } from "../../core/piles.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { placeDamage } from "../../core/keywords.ts";
import { moveCard, spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { effectData } from "../encounter/moves.ts";
import { drawTreasures } from "./treasure.ts";
import { codesOf, ctxOf, deal, marker, record, table, CARDS } from "./fixture.ts";
import { arrangeLookedDeck, attachGuardedFromPile, discardOtherLooked, immediateAttackBy, removeSetAsideDamage, setAsideKeepingDamage, shuffleSetAsideIntoPile, victoryWhenFree, whenRevealedUncancelable } from "./heath.ts";
import { guardWith } from "../objectives/guard.ts";
import { pushEffectFrame } from "../../interpret/effect-frames.ts";

const focus = (sourceId: string | null) => ({ seat: 0, sourceId });
const drake = definePrinted({ code: "drake", name: "Cold-Drake", type: "enemy", isUnique: true, threat: 1, engagementCost: 10, attack: 6, defense: 1, health: 18, victory: 6 });
const cards = new Map([...CARDS, ["drake", drake], ["weather", definePrinted({ code: "weather", name: "Heavy Snow", type: "treachery", traits: ["Weather"] })]]);
const ctx = { effects: [marker("sign", { verb: "VictoryWhenFree" })], cards };

describe("ShuffleSetAsideIntoPile (19022:A:1, 19024:A:1)", () => {
  const withCaves = (setAside: number) => {
    const dealt = deal(table(), ["cave1", "cave2"], { zone: "cavesDeck" });
    return deal(dealt.state, Array.from({ length: setAside }, () => "sign"), { zone: "setAside" }).state;
  };

  it("shuffles up to `count` set-aside copies into the pile, with the game's seed", () => {
    const done = shuffleSetAsideIntoPile(withCaves(4), { verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "sign", count: 2 });
    const caves = codesOf(done, pileOf(done, "cavesDeck"));
    expect(caves).toHaveLength(4);
    expect(caves.filter((code) => code === "sign")).toHaveLength(2);
    expect(done.setAside.filter((id) => done.cards[id]?.code === "sign")).toHaveLength(2);
    expect(done.seedCursor).toBeGreaterThan(withCaves(4).seedCursor);
    // The copies that joined the deck are facedown and controlled by no one.
    for (const id of pileOf(done, "cavesDeck").filter((entry) => done.cards[entry]?.code === "sign")) expect(done.cards[id]).toMatchObject({ face: "down", controller: null });
  });

  it("takes what is set aside when fewer copies are left, and changes nothing with none or with no such pile", () => {
    expect(codesOf(shuffleSetAsideIntoPile(withCaves(1), { verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "sign", count: 2 }), pileOf(shuffleSetAsideIntoPile(withCaves(1), { verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "sign", count: 2 }), "cavesDeck")).filter((code) => code === "sign")).toHaveLength(1);
    const none = withCaves(0);
    expect(shuffleSetAsideIntoPile(none, { verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "sign", count: 2 })).toBe(none);
    const noPile = deal(table(), ["sign", "sign"], { zone: "setAside" }).state;
    expect(shuffleSetAsideIntoPile(noPile, { verb: "ShuffleSetAsideIntoPile", pile: "caves", code: "sign", count: 2 })).toBe(noPile);
  });
});

describe("SetAsideKeepingDamage and RemoveSetAsideDamage (19024:A:1, 19024:B:2)", () => {
  const inPlay = () => {
    const made = spawn(table(), "drake", { zone: "staging" });
    return { state: updateCard(made.state, made.id, { damage: 11, resources: 2 }), id: made.id };
  };

  it("sets the card aside facedown with its damage, and loses its other tokens", () => {
    const { state, id } = inPlay();
    const done = setAsideKeepingDamage(state, { verb: "SetAsideKeepingDamage", code: "drake" }, ctxOf([]), []);
    expect(done.cards[id]).toMatchObject({ zone: "setAside", face: "down", damage: 11, resources: 0, controller: null });
  });

  it("nothing happens when no such card is in play", () => {
    const state = table();
    expect(setAsideKeepingDamage(state, { verb: "SetAsideKeepingDamage", code: "drake" }, ctxOf([]), [])).toBe(state);
  });

  it("the damage stays on the card as it enters play again, and only then (a card set aside any other way enters clean)", () => {
    const { state, id } = inPlay();
    const away = setAsideKeepingDamage(state, { verb: "SetAsideKeepingDamage", code: "drake" }, ctxOf([]), []);
    const back = moveCard(away, id, { zone: "staging" });
    expect(back.cards[id]).toMatchObject({ zone: "staging", damage: 11 });
    expect(back.cards[id]?.keepsDamage).toBeUndefined();
    const again = moveCard(moveCard(back, id, { zone: "setAside" }), id, { zone: "staging" });
    expect(again.cards[id]?.damage).toBe(0);
  });

  it("removes up to `amount` damage tokens from the set-aside card, to 0", () => {
    const { state, id } = inPlay();
    let away = setAsideKeepingDamage(state, { verb: "SetAsideKeepingDamage", code: "drake" }, ctxOf([]), []);
    const damage: number[] = [];
    for (let round = 0; round < 5; round += 1) {
      away = removeSetAsideDamage(away, { verb: "RemoveSetAsideDamage", code: "drake", amount: 3 });
      damage.push(away.cards[id]?.damage ?? -1);
    }
    expect(damage).toEqual([8, 5, 2, 0, 0]);
  });

  it("does not touch a card in play with the code", () => {
    const { state, id } = inPlay();
    expect(removeSetAsideDamage(state, { verb: "RemoveSetAsideDamage", code: "drake", amount: 3 }).cards[id]?.damage).toBe(11);
  });
});

describe("AttachGuardedFromPile (19018:A:1)", () => {
  const atDen = (caves: readonly string[]) => {
    const den = spawn(table(), "plain", { zone: "activeLocation" });
    const dealt = deal(den.state, caves, { zone: "cavesDeck" });
    return { state: dealt.state, den: den.id };
  };

  it("the first card of the pile with the code enters the staging area and the source guards it", () => {
    const { state, den } = atDen(["cave1", "sign", "cave2", "sign"]);
    const done = attachGuardedFromPile(state, { verb: "AttachGuardedFromPile", pile: "caves", code: "sign" }, focus(den), ctxOf([]), []);
    const sign = Object.values(done.cards).find((card) => card.code === "sign" && card.zone === "staging");
    expect(sign).toBeDefined();
    expect(done.cards[den]).toMatchObject({ host: sign?.id, guard: true });
    expect(codesOf(done, pileOf(done, "cavesDeck"))).toEqual(["cave1", "cave2", "sign"]);
    expect(done.staging).toContain(sign?.id);
  });

  it("nothing happens without such a card in the pile, or without a source in play", () => {
    const { state, den } = atDen(["cave1"]);
    expect(attachGuardedFromPile(state, { verb: "AttachGuardedFromPile", pile: "caves", code: "sign" }, focus(den), ctxOf([]), [])).toBe(state);
    const withSign = atDen(["sign"]);
    expect(attachGuardedFromPile(withSign.state, { verb: "AttachGuardedFromPile", pile: "caves", code: "sign" }, focus(null), ctxOf([]), [])).toBe(withSign.state);
  });
});

describe("VictoryWhenFree (19012:A:3)", () => {
  const sweep = (state: ScenarioState): ScenarioState => victoryWhenFree(state, ctx, []);

  it("a Dragon Sign in the staging area with nothing guarding it goes to the victory display", () => {
    const made = spawn(table(), "sign", { zone: "staging" });
    expect(sweep(made.state).cards[made.id]?.zone).toBe("victory");
  });

  it("not while an encounter card guards it, but once the guard leaves play", () => {
    const sign = spawn(table(), "sign", { zone: "staging" });
    const orc = spawn(sign.state, "orc", { zone: "staging" });
    const guarded = guardWith(orc.state, orc.id, sign.id);
    expect(sweep(guarded).cards[sign.id]?.zone).toBe("staging");
    const freed = moveCard(guarded, orc.id, { zone: "encounterDiscard" });
    expect(sweep(freed).cards[sign.id]?.zone).toBe("victory");
  });

  it("waits while an effect is resolving, and does nothing in a game with no such card", () => {
    const made = spawn(table(), "sign", { zone: "staging" });
    const busy = pushEffectFrame(made.state, { frame: "ResolveEffect", sourceId: made.id, actor: 0, peril: false, effectId: "x", instructions: [], cancel: null, blockCancel: null }, []);
    expect(sweep(busy).cards[made.id]?.zone).toBe("staging");
    expect(victoryWhenFree(made.state, ctxOf([]), []).cards[made.id]?.zone).toBe("staging");
  });

  it("is a settle sweep: settle moves the freed sign", () => {
    const sign = spawn(table(), "sign", { zone: "staging" });
    const orc = spawn(sign.state, "orc", { zone: "staging" });
    const freed = moveCard(guardWith(orc.state, orc.id, sign.id), orc.id, { zone: "encounterDiscard" });
    const settled = settle({ ...freed, window: null }, { effects: [...ctx.effects], cards }, []);
    expect(settled.cards[sign.id]?.zone).toBe("victory");
  });
});

describe("UncancelableWhenRevealed (19015:A:1)", () => {
  const cancels: Effect = record("hero:response:9", "frodo", "response", [{ verb: "CancelEffect" }], { trigger: "whenRevealedPending" });
  const bar = marker("plain", { verb: "UncancelableWhenRevealed", trait: "Weather" });
  const check = (revealed: string, effects: readonly Effect[], zone: "staging" | "encounterDiscard" = "staging") => {
    const location = spawn(table(), "plain", { zone });
    const card = spawn(location.state, revealed, { zone: "staging" });
    return whenRevealedUncancelable(card.state, { trigger: "whenRevealedPending", seat: 0, subject: card.id }, cancels, { effects: [...effects, cancels], cards });
  };

  it("bars a cancel of the When Revealed effects of a card with the trait while the source is in play", () => {
    expect(check("weather", [bar])).toBe(true);
  });

  it("not another card, not a game without the marker, and not an effect that does not cancel", () => {
    expect(check("mist", [bar])).toBe(false);
    expect(check("weather", [])).toBe(false);
    const location = spawn(table(), "plain", { zone: "staging" });
    const card = spawn(location.state, "weather", { zone: "staging" });
    const reacts = record("hero:response:8", "frodo", "response", [{ verb: "RaiseThreat", amount: 1 }], { trigger: "whenRevealedPending" });
    expect(whenRevealedUncancelable(card.state, { trigger: "whenRevealedPending", seat: 0, subject: card.id }, reacts, { effects: [bar], cards })).toBe(false);
    expect(whenRevealedUncancelable(card.state, { trigger: "questSucceeded", seat: 0, subject: card.id }, cancels, { effects: [bar], cards })).toBe(false);
  });

  it("the source's own condition decides: a marker whose record needs the staging area bars nothing from the discard pile", () => {
    const conditional: Effect = { ...bar, condition: { kind: "sourceIn", zone: "staging" } };
    expect(check("weather", [conditional], "staging")).toBe(true);
    expect(check("weather", [conditional], "encounterDiscard")).toBe(false);
  });
});

describe("DiscardOtherLooked (19022:B:1)", () => {
  it("discards the looked cards but the picked one, which is then the top card", () => {
    const made = deal(table(), ["ec1", "orc", "mist", "plain"], { zone: "encounterDeck" });
    const looked = made.ids.slice(0, 3);
    const pushed = pushEffectFrame(made.state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x", instructions: [], picked: [made.ids[1] ?? ""], cancel: null, blockCancel: null }, []);
    const data = effectData(pushed);
    const state = data ? { ...pushed, stack: pushed.stack.map((frame, at) => (at === pushed.stack.length - 1 && frame.data.kind === "effect" ? { ...frame, data: { ...frame.data, looked } } : frame)) } : pushed;
    const done = discardOtherLooked(state);
    expect(codesOf(done, done.encounterDeck)).toEqual(["orc", "plain"]);
    expect(codesOf(done, done.encounterDiscard).sort()).toEqual(["ec1", "mist"].sort());
    for (const id of done.encounterDiscard) expect(done.cards[id]?.face).toBe("up");
  });
});

describe("ArrangeLookedDeck (12176:A:4)", () => {
  // Five cards in the seat's deck, the top 3 looked at by the running effect.
  const looking = () => {
    const made = deal(table(), ["ec1", "orc", "mist", "plain", "ec2"], { zone: "deck", seat: 0 });
    const looked = made.ids.slice(0, 3);
    const pushed = pushEffectFrame(made.state, { frame: "ResolveEffect", sourceId: null, actor: 0, peril: false, effectId: "x", instructions: [], cancel: null, blockCancel: null }, []);
    const state: ScenarioState = { ...pushed, stack: pushed.stack.map((frame, at) => (at === pushed.stack.length - 1 && frame.data.kind === "effect" ? { ...frame, data: { ...frame.data, looked } } : frame)) };
    return { state, looked, ids: made.ids };
  };
  const deckOf = (state: ScenarioState): (string | undefined)[] => (state.seats[0]?.deck ?? []).map((id) => state.cards[id]?.code);

  it("asks which looked card stays on top, then the card for each next place at the bottom, and puts them back", () => {
    const { state, looked, ids } = looking();
    const first = arrangeLookedDeck(state, { verb: "ArrangeLookedDeck" }, focus(null), []);
    expect(first.window).toMatchObject({ kind: "choose", seat: 0, options: looked });
    // "mist" stays on top; two are left for the bottom: the next question names them.
    const second = arrangeLookedDeck(state, { verb: "ArrangeLookedDeck" }, { seat: 0, sourceId: null, chosen: looked[2] ?? "" }, []);
    expect(second.window).toMatchObject({ kind: "choose", seat: 0, options: [looked[0], looked[1]] });
    // The bottom order: "orc" first, then "ec1"; the deck's other cards stay between.
    const kept = { verb: "ArrangeLookedDeck" as const, kept: looked[2] ?? "", bottom: [] as string[] };
    const done = arrangeLookedDeck(state, kept, { seat: 0, sourceId: null, chosen: ids[1] ?? "" }, []);
    expect(deckOf(done)).toEqual(["mist", "plain", "ec2", "orc", "ec1"]);
  });

  it("two cards looked at: the one chosen stays on top and the other goes to the bottom without another question", () => {
    const { state, looked } = looking();
    const two = { ...state, stack: state.stack.map((frame) => (frame.data.kind === "effect" ? { ...frame, data: { ...frame.data, looked: looked.slice(0, 2) } } : frame)) };
    const done = arrangeLookedDeck(two, { verb: "ArrangeLookedDeck" }, { seat: 0, sourceId: null, chosen: looked[1] ?? "" }, []);
    expect(deckOf(done)).toEqual(["orc", "mist", "plain", "ec2", "ec1"]);
  });

  it("run where nobody can be asked, the first looked card stays on top and the rest go to the bottom in order; one card looked at changes nothing", () => {
    const made = deal(table(), ["ec1", "orc", "mist"], { zone: "deck", seat: 0 });
    expect(arrangeLookedDeck(made.state, { verb: "ArrangeLookedDeck" }, focus(null), [])).toBe(made.state);
    const { state, looked } = looking();
    const one = { ...state, stack: state.stack.map((frame) => (frame.data.kind === "effect" ? { ...frame, data: { ...frame.data, looked: looked.slice(0, 1) } } : frame)) };
    expect(arrangeLookedDeck(one, { verb: "ArrangeLookedDeck" }, focus(null), [])).toBe(one);
  });
});

describe("damageCeiling and the damage a card is set aside with (19023:B:3)", () => {
  const ceiling = (damage: number, cap?: number): { state: ScenarioState; id: string } => {
    const made = spawn(table(), "drake", { zone: "staging" });
    const modifiers = [{ instanceId: made.id, sourceId: made.id, stat: "damageCeiling" as const, amount: 18, until: "whileSourceInPlay" as const }, ...(cap ? [{ instanceId: made.id, sourceId: made.id, stat: "damageCap" as const, amount: cap, until: "whileSourceInPlay" as const }] : []), { instanceId: made.id, sourceId: made.id, stat: "indestructible" as const, amount: 1, until: "whileSourceInPlay" as const }];
    return { state: { ...updateCard(made.state, made.id, { damage }), modifiers }, id: made.id };
  };
  const hit = (state: ScenarioState, id: string, amount: number): ScenarioState => placeDamage(state, id, amount, cards, [], "combat", UNATTRIBUTED);

  it("a card takes the damage up to the ceiling and no more, and is not destroyed at it when indestructible", () => {
    const { state, id } = ceiling(14);
    const full = hit(state, id, 9);
    expect(full.cards[id]?.damage).toBe(18);
    expect(full.cards[id]?.zone).toBe("staging");
    expect(hit(full, id, 3).cards[id]?.damage).toBe(18);
  });

  it("works with the per-round cap: the smaller room wins", () => {
    const { state, id } = ceiling(15, 6);
    expect(hit(state, id, 6).cards[id]?.damage).toBe(18);
    const early = ceiling(0, 6);
    expect(hit(early.state, early.id, 9).cards[early.id]?.damage).toBe(6);
  });

  it("a card with no ceiling takes all the damage", () => {
    const made = spawn(table(), "orc", { zone: "staging" });
    expect(hit(made.state, made.id, 3).cards[made.id]?.zone).not.toBe("staging");
    expect(flagged(made.state, made.id, "damageCeiling")).toBe(false);
  });
});

describe("ImmediateAttackBy (12179:A:4)", () => {
  it("does nothing for an enemy that is not engaged with the actor", () => {
    const made = spawn(table(), "orc", { zone: "staging" });
    expect(immediateAttackBy(made.state, { verb: "ImmediateAttackBy", target: "self" }, focus(made.id), ctxOf([]), [])).toBe(made.state);
  });
});

describe("drawTreasures (12175:B:7)", () => {
  it("draws the same undiscovered treasures for the same seed, never a discovered one, and moves the seed once", () => {
    const treasure = (code: string) => definePrinted({ code, name: code, type: "attachment", campaignKind: "treasure" });
    const withTreasures = { effects: [], cards: new Map([...cards, ...["t1", "t2", "t3", "t4", "t5"].map((code): [string, ReturnType<typeof treasure>] => [code, treasure(code)])]) };
    const state = table();
    const first = drawTreasures(state, 3, withTreasures);
    expect(first.candidates).toHaveLength(3);
    expect(drawTreasures(state, 3, withTreasures)).toEqual(first);
    expect(first.cursor).toBeGreaterThan(state.seedCursor);
    const logged = { ...state, resolutionLog: { ...state.resolutionLog, treasures: ["t1", "t2", "t3"] } };
    expect(drawTreasures(logged, 3, withTreasures).candidates.sort()).toEqual(["t4", "t5"]);
    expect(drawTreasures({ ...state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, treasures: ["t4"] } }, 3, withTreasures).candidates).not.toContain("t4");
  });
});
