// Rules: emce.boon-allies, emce.campaign-pool-encounter, rr.cancel, rr.damage, rr.exhausted (data/rules/entries.json); ledger lines 12166:A:2, 12167:A:2.
// Turayn and A Growing Threat, the boon ally and the burden the campaign card of Journey Up the Anduin places, on the scenario's scene.
import { beforeAll, describe, expect, it } from "vitest";

import { placeDamage } from "../../../rules/core/keywords.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { expireModifiers } from "../../../rules/core/state.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { openResolution, resolutionResult } from "../../../rules/setup/resolution.ts";
import { CODES, idOf, legalIntents, loadUpanduinWorld, resolveRecords, send, start, upanduinTable, type UpanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/scene.ts";

let world: UpanduinWorld;
beforeAll(async () => {
  world = await loadUpanduinWorld();
}, 120_000);

describe("12166 Turayn", () => {
  it("after he exhausts, cancels 1 of the next damage another character is dealt this round, once", () => {
    const t = upanduinTable(world, { play: [CODES.turayn] });
    const turayn = idOf(t.state, CODES.turayn);
    const run = resolveRecords(t.state, t.ctx, CODES.turayn, "response", turayn, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const target = Object.values(run.state.cards).find((card) => card.id !== turayn && card.zone === "heroes" && run.state.modifiers.some((modifier) => modifier.stat === "damageShield" && modifier.instanceId === card.id));
    expect(target).toBeDefined();
    const steps: never[] = [];
    const first = placeDamage(run.state, target!.id, 3, t.ctx.cards, steps, "combat", ruleCause("rr.damage"));
    expect(first.cards[target!.id]?.damage).toBe(2);
    expect(first.modifiers.some((modifier) => modifier.stat === "damageShield")).toBe(false);
    const second = placeDamage(first, target!.id, 3, t.ctx.cards, steps, "combat", ruleCause("rr.damage"));
    expect(second.cards[target!.id]?.damage).toBe(5);
  });

  it("is offered when he exhausts to commit to the quest, and not when he is already exhausted", () => {
    const t = upanduinTable(world, { play: [CODES.turayn] });
    const turayn = idOf(t.state, CODES.turayn);
    const offered = (state: typeof t.state): string[] => legalIntents(state, t.ctx).flatMap((intent) => (intent.type === "Trigger" ? [intent.effectId] : []));
    const run = send(start(t.state), { type: "Commit", cardIds: [turayn] }, t.ctx);
    expect(run.state.cards[turayn]).toMatchObject({ exhausted: true, committed: true });
    expect(offered(run.state)).toEqual(["12166:response:1"]);
    const used = send(run, { type: "Trigger", cardId: turayn, effectId: "12166:response:1" }, t.ctx);
    const chosen = used.state.window?.kind === "choose" ? send(used, { type: "Choose", optionId: t.hero }, t.ctx) : used;
    expect(chosen.state.modifiers.some((modifier) => modifier.stat === "damageShield" && modifier.instanceId === t.hero)).toBe(true);
    // A card that is already exhausted does not exhaust again.
    const tired = { ...t.state, cards: { ...t.state.cards, [turayn]: { ...t.state.cards[turayn]!, exhausted: true } } };
    expect(offered(send(start(tired), { type: "Commit", cardIds: [t.hero] }, t.ctx).state)).toEqual([]);
  });

  it("does not cancel damage dealt to the card that was not chosen, and the shield ends with the round", () => {
    const t = upanduinTable(world, { play: [CODES.turayn] });
    const turayn = idOf(t.state, CODES.turayn);
    const run = resolveRecords(t.state, t.ctx, CODES.turayn, "response", turayn, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""));
    const other = [t.hero, t.hero2].find((id) => !run.state.modifiers.some((modifier) => modifier.stat === "damageShield" && modifier.instanceId === id)) ?? "";
    expect(placeDamage(run.state, other, 2, t.ctx.cards, [], "combat", ruleCause("rr.damage")).cards[other]?.damage).toBe(2);
    const later = expireModifiers(run.state, ["endOfRound"]);
    const shielded = [t.hero, t.hero2].find((id) => id !== other) ?? "";
    expect(placeDamage(later, shielded, 2, t.ctx.cards, [], "combat", ruleCause("rr.damage")).cards[shielded]?.damage).toBe(2);
  });
});

describe("12167 A Growing Threat", () => {
  it("sets aside the topmost non-unique, non-objective, non-burden card of the encounter discard pile and leaves the game", () => {
    const t = upanduinTable(world, { discard: [CODES.hillsOfWilderland, CODES.goblinTroop, CODES.haldan, CODES.aGrowingThreat] });
    const run = resolveRecords(t.state, t.ctx, CODES.aGrowingThreat, "whenRevealed");
    // The last card of the pile is the topmost: A Growing Threat is a burden and Haldan an objective, so Goblin Troop is the first card that qualifies.
    expect(run.state.cards[idOf(run.state, CODES.goblinTroop)]).toMatchObject({ zone: "setAside", face: "down" });
    expect(run.state.cards[run.id]?.zone).toBe("removed");
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toEqual([CODES.hillsOfWilderland, CODES.haldan, CODES.aGrowingThreat]);
  });

  it("leaves a unique card in the pile, and sets nothing aside when no card qualifies", () => {
    const unique = upanduinTable(world, { discard: [CODES.wolfRider, CODES.turayn] });
    const run = resolveRecords(unique.state, unique.ctx, CODES.aGrowingThreat, "whenRevealed");
    expect(run.state.cards[idOf(run.state, CODES.turayn)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idOf(run.state, CODES.wolfRider)]?.zone).toBe("setAside");
    const none = upanduinTable(world, { discard: [CODES.haldan] });
    const bare = resolveRecords(none.state, none.ctx, CODES.aGrowingThreat, "whenRevealed");
    expect(Object.values(bare.state.cards).filter((card) => card.zone === "setAside")).toHaveLength(0);
    expect(bare.state.resolution).toEqual(none.state.resolution);
  });

  it("has the Resolution add a copy of the card it set aside to the Campaign Pool when the scenario is won", () => {
    const t = upanduinTable(world, { discard: [CODES.goblinTroop] });
    const run = resolveRecords(t.state, t.ctx, CODES.aGrowingThreat, "whenRevealed");
    expect(run.state.resolution.at(-1)).toEqual({ verb: "AddEncounterToPool", codes: [CODES.goblinTroop] });
    // The campaign card's own lines come first (Turayn's offer, answered with the oath line), then the copy of the card A Growing Threat set aside.
    const asking = openResolution({ ...run.state, stageCleared: true, window: null, stack: [], resolutionAt: 0 }, t.ctx);
    const won = openResolution(expectOk(reduce(asking, { type: "ChooseResolution", optionId: "line" }, t.ctx)).state, t.ctx);
    expect(resolutionResult(won)?.encounterPool).toEqual({ [CODES.aGrowingThreat]: 1, [CODES.goblinTroop]: 1 });
  });
});
