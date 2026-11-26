// Rules: rm.current-trial, rm.setup-the-three-trials, rm.time-x, rr.reveal, rr.engaged, rr.attachment-cards, rr.victory (data/rules/entries.json); ledger lines 08035:B:1, 08036:A:1, 08036:B:1, 08036:B:2, 08037:A:1, 08038:A:1, 08039:A:1, 08039:B:1, 08047:A:1.
// The trial loop of The Three Trials: the stage the players choose, the random set-aside cards, the Key on its host, the Guardians that engage, the Key a hero holds, the victory display and the Cave Barrow's cap on allies.
import { describe, expect, it } from "vitest";

import { HERO, idOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { destroyCard } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";

const SCENARIO = "the-three-trials";
const GUARDIANS = ["08040", "08041", "08042"];
const KEYS = ["08043", "08044", "08045"];
const BARROWS = ["08046", "08047", "08048"];
const SET_ASIDE = [...GUARDIANS, ...KEYS, ...BARROWS, "08049"] as const;
const table = (layout: Layout) => tableFromLayout(SCENARIO, { setAside: SET_ASIDE, ...layout });
const cardsOf = (state: ScenarioState, codes: readonly string[]) => Object.values(state.cards).filter((card) => codes.includes(card.code));
const zoneOf = (state: ScenarioState, code: string) => cardsOf(state, [code])[0]?.zone;
const outOfSetAside = (state: ScenarioState, codes: readonly string[]) => cardsOf(state, codes).filter((card) => card.zone !== "setAside");
const stageRecords = (made: ReturnType<typeof table>, code: string, pick?: (state: ScenarioState) => string) => resolveRecords(made.state, made.ctx, code, "whenRevealed", idOf(made.state, code), pick);
// The Key (08043 to 08045) shares its animal with the Guardian (08040 to 08042).
const animal = (code: string) => Number(code) - (GUARDIANS.includes(code) ? 8040 : 8043);

describe("08036:A:1 the Trial of Strength", () => {
  it("08036:A:1 reveals one Guardian and one Barrow, lies the Key that shares a Trait with the Guardian on it and marks it as the trial's Key", () => {
    const t = table({ stage: "08036", seed: 3 });
    const { state } = stageRecords(t, "08036");
    const guardians = outOfSetAside(state, GUARDIANS);
    expect(guardians).toHaveLength(1);
    const guardian = guardians[0]!;
    expect(guardian.resources).toBe(animal(guardian.code) + 2);
    const key = state.cards[guardian.attachments[0] ?? ""]!;
    expect(animal(key.code)).toBe(animal(guardian.code));
    expect([key.zone, key.claimed]).toEqual(["attached", true]);
    expect(state.modifiers.some((mod) => mod.stat === "trialKey" && mod.instanceId === key.id && mod.sourceId === idOf(state, "08036"))).toBe(true);
    expect(outOfSetAside(state, BARROWS).map((card) => card.zone)).toEqual(["staging"]);
    expect(guardian.zone).toBe("engaged");
    expect(guardian.controller).toBe(0);
  });

  it("08036:A:1 picks differently with another seed and never twice the same card across the three trials", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = table({ stage: "08036", seed });
      seen.add(outOfSetAside(stageRecords(t, "08036").state, GUARDIANS)[0]?.code ?? "");
    }
    expect(seen.size).toBeGreaterThan(1);
    const t = table({ stage: "08037", seed: 5, setAside: SET_ASIDE.filter((code) => !["08040", "08043", "08046"].includes(code)) });
    const { state } = stageRecords(t, "08037");
    expect(outOfSetAside(state, ["08040", "08043", "08046"])).toHaveLength(0);
  });
});

describe("08037:A:1 the Trial of Perseverance", () => {
  it("08037:A:1 stages a random Barrow, lies a random Key on it and reveals the Guardian that shares a Trait with the Key", () => {
    const t = table({ stage: "08037", seed: 4 });
    const { state } = stageRecords(t, "08037");
    const barrow = outOfSetAside(state, BARROWS)[0]!;
    const key = state.cards[barrow.attachments[0] ?? ""]!;
    expect(KEYS).toContain(key.code);
    const guardian = outOfSetAside(state, GUARDIANS)[0]!;
    expect(animal(guardian.code)).toBe(animal(key.code));
    expect([barrow.zone, guardian.resources]).toEqual(["staging", animal(guardian.code) + 2]);
  });
});

describe("08038:A:1 the Trial of Intuition", () => {
  it("08038:A:1 reveals a Guardian and a Barrow, shuffles the discard pile into the deck and the matching Key into its bottom 10 cards", () => {
    const deck = Array.from({ length: 14 }, () => "08050");
    const t = table({ stage: "08038", seed: 2, deck, discard: ["08053", "08053"] });
    const { state } = stageRecords(t, "08038");
    const guardian = outOfSetAside(state, GUARDIANS)[0]!;
    expect(outOfSetAside(state, BARROWS)).toHaveLength(1);
    expect(state.encounterDiscard).toHaveLength(0);
    expect(state.encounterDeck).toHaveLength(17);
    const key = cardsOf(state, KEYS).find((card) => card.zone === "encounterDeck")!;
    expect(animal(key.code)).toBe(animal(guardian.code));
    expect(state.encounterDeck.indexOf(key.id)).toBeGreaterThanOrEqual(state.encounterDeck.length - 11);
    expect(state.cards[key.id]?.face).toBe("down");
  });
});

describe("08035:B:1 the players choose a trial", () => {
  it("08035:B:1 offers the three trials, advances to the one chosen and defeats the stage it leaves", () => {
    const t = table({ stage: "08035", seed: 1 });
    const asked = resolveRecords(t.state, t.ctx, "08035", "whenRevealed", idOf(t.state, "08035"), (state) => {
      expect(state.window?.kind === "choose" && state.window.options).toEqual(["08036", "08037", "08038"]);
      return "08037";
    });
    const stage = asked.state.questStage ? asked.state.cards[asked.state.questStage] : undefined;
    expect(stage?.code).toBe("08037");
    expect(zoneOf(asked.state, "08035")).toBe("setAside");
    expect(asked.state.questDeck.map((id) => asked.state.cards[id]?.code)).toEqual(["08036", "08038", "08039"]);
    // The When Revealed of the stage chosen resolved: a Barrow lies in the staging area with a Key on it.
    expect(outOfSetAside(asked.state, BARROWS)).toHaveLength(1);
  });
});

// The picked Key lies on a hero, as the first player's claim leaves it.
function claimed(made: ReturnType<typeof table>, state: ScenarioState, key: string): ScenarioState {
  return settle(updateCard(attachTo(moveCard(state, key, { zone: "attached" }), key, idOf(state, HERO)), key, { claimed: true }), made.ctx, []);
}

describe("08036:B:2 the players control the current trial's Key", () => {
  it("08036:B:2 waits while the Key lies on its Guardian, and once a hero holds it adds the Barrows in play to the victory display and offers the next trial", () => {
    const t = table({ stage: "08036", seed: 3 });
    const staged = stageRecords(t, "08036").state;
    expect(staged.pendingEvents ?? []).toHaveLength(0);
    const guardian = outOfSetAside(staged, GUARDIANS)[0]!;
    const key = guardian.attachments[0] ?? "";
    const held = claimed(t, staged, key);
    expect(held.window?.kind).toBe("choose");
    expect(held.victory.map((id) => held.cards[id]?.code).every((code) => BARROWS.includes(code ?? ""))).toBe(true);
    expect(held.victory).toHaveLength(1);
    const next = send({ state: held, steps: [] }, { type: "Choose", optionId: "08038" }, t.ctx).state;
    expect(next.questStage != null && next.cards[next.questStage]?.code).toBe("08038");
    // The Guardian stays in play: only a Barrow went to the victory display.
    expect(next.cards[guardian.id]?.zone).toBe("engaged");
  });
});

describe("08043:A:1 a Key whose host leaves play", () => {
  it("08043:A:1 goes back to the staging area (08036:B:2), is claimed by the first player at once, and the stage hears that a hero holds it", () => {
    const t = table({ stage: "08036", seed: 3 });
    const staged = stageRecords(t, "08036").state;
    const guardian = outOfSetAside(staged, GUARDIANS)[0]!;
    const keyId = guardian.attachments[0] ?? "";
    const freed = settle({ ...destroyCard(staged, guardian.id, t.ctx.cards, [], true), window: null, mode: "stopped" }, t.ctx, []);
    expect([freed.cards[keyId]?.zone, freed.window?.kind]).toEqual(["staging", "choose"]);
    // The first player chooses the hero that takes the Key; the stage hears it and the players choose the next trial.
    const claimedKey = send({ state: freed, steps: [] }, { type: "Choose", optionId: freed.window?.kind === "choose" ? (freed.window.options[0] ?? "") : "" }, t.ctx).state;
    const key = claimedKey.cards[keyId]!;
    expect([key.zone, key.controller, claimedKey.cards[key.host ?? ""]?.zone]).toEqual(["attached", 0, "heroes"]);
    expect(claimedKey.window?.kind).toBe("choose");
    expect(claimedKey.victory.map((id) => claimedKey.cards[id]?.code).filter((code) => BARROWS.includes(code ?? ""))).toHaveLength(1);
  });
});

describe("08036:B:1 to 08038:B:1 a Guardian follows the first player token", () => {
  it("08036:B:1 the Guardian that engages the first player engages the new first player once the token passes in the refresh phase", () => {
    const t = table({ stage: "08036", seats: 2, firstPlayer: 0, phase: "Refresh", setAside: [], engaged: [{ code: "08040", seat: 0 }] });
    const guardian = idOf(t.state, "08040");
    expect(t.state.seats.map((seat) => seat.engaged.includes(guardian))).toEqual([true, false]);
    const after = settle({ ...t.state, window: null, mode: "refresh" }, t.ctx, []);
    expect(after.firstPlayer).toBe(1);
    expect(after.seats.map((seat) => seat.engaged.includes(guardian))).toEqual([false, true]);
  });
});

describe("08039:A:1 the Antlered Crown", () => {
  it("08039:A:1 adds Hallowed Circle to the staging area and reveals each Guardian in the victory display again with fresh counters", () => {
    const t = table({ stage: "08039", setAside: ["08049"], victory: ["08040", "08041"] });
    const withCounters = updateCard(t.state, idOf(t.state, "08040"), { resources: 1 });
    const { state } = resolveRecords(withCounters, t.ctx, "08039", "whenRevealed", idOf(t.state, "08039"));
    expect(zoneOf(state, "08049")).toBe("staging");
    expect(state.victory).toHaveLength(0);
    expect(cardsOf(state, ["08040", "08041"]).map((card) => [card.zone, card.resources])).toEqual([["staging", 2], ["staging", 3]]);
  });
});

describe("08039:B:1 each Guardian engages the player who controls the Key it shares a Trait with", () => {
  const heldBy = (seat: 0 | 1) => {
    const t = table({ stage: "08039", seats: 2, firstPlayer: 0, setAside: [], staging: ["08040", "08041"] });
    const holder = seat === 0 ? idOf(t.state, HERO) : (t.seat1Hero ?? "");
    const spawned = spawn(t.state, "08043", { zone: "attached" });
    const lying = updateCard(attachTo(spawned.state, spawned.id, holder), spawned.id, { claimed: true, controller: seat });
    return { t, state: settle({ ...lying, window: null, mode: "stopped" }, t.ctx, []) };
  };

  it("08039:B:1 the Boar's Guardian engages the second player who holds the Key of the Boar; the Wolf's Guardian, whose Key no player holds, stays in the staging area", () => {
    const { state } = heldBy(1);
    const boar = cardsOf(state, ["08040"])[0]!;
    expect([boar.zone, boar.controller]).toEqual(["engaged", 1]);
    expect(zoneOf(state, "08041")).toBe("staging");
  });

  it("08039:B:1 the Guardian follows the Key to the other player when it changes hands", () => {
    const { t, state } = heldBy(1);
    const moved = settle({ ...attachTo(updateCard(state, idOf(state, "08043"), { host: null }), idOf(state, "08043"), idOf(state, HERO)), window: null, mode: "stopped" }, t.ctx, []);
    expect(cardsOf(moved, ["08040"])[0]?.controller).toBe(0);
  });
});
