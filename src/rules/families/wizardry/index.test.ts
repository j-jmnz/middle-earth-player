// Rules: mec112.wizardry, rr.explored, rr.forced, rr.defending-player (data/rules/entries.json); ledger lines 143059:A:2, 143055:A:2, 143062:A:1, 143047:A:2, 143052:A:1, 143058:A:1, 143057:A:2, 143080:B:2. The wizardry family on The Road to
// Isengard's own table: a Wizardry location explored in the staging area or as the active location, Machines of Isengard, Saruman's and the Wolf's Forced effects, and a Wizardry location dealt as an ordinary shadow card.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { settle } from "../../engine/machine.ts";
import { holds } from "../../interpret/conditions.ts";
import { placeProgress } from "../../interpret/effect-verbs.ts";
import { runInstruction } from "../../interpret/interpret.ts";
import { queueEvent } from "../../windows/queue.ts";
import { announceShadowWizardry } from "./shadow.ts";
import { asOnlyPlayer, wizardryOf } from "./trigger.ts";
import { fightEnemy, idOf, revealFromTop, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-road-to-isengard";
const STAGE_2: Layout = { stage: "143079", phase: "Quest" };
const table = (layout: Layout = {}) => tableFromLayout(ID, { ...STAGE_2, ...layout });
const threats = (state: ScenarioState): number[] => state.seats.map((seat) => seat.threat);
// The table at rest: the round stops where it is, so only what the records do is read.
const rest = (state: ScenarioState, ctx: ReturnType<typeof table>["ctx"], steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, steps);
// A Wizardry location dealt as a shadow card, face up, to the enemy: its attack is in progress against `seat`.
function dealtWizardry(state: ScenarioState, enemy: string, seat: number, code = "143059"): { state: ScenarioState; shadow: string } {
  const shadow = spawn(state, code, { zone: "shadow", enemyId: enemy }, "up");
  const dealt = updateCard(shadow.state, enemy, { shadowId: shadow.id });
  return { state: { ...dealt, pendingAttack: { enemyId: enemy, seat, shadowsDone: true } }, shadow: shadow.id };
}

describe("143059:A:2 a Wizardry location explored", () => {
  it("triggers its Wizardry in the staging area: each player raises their threat by 2", () => {
    const made = table({ staging: ["143059"], seats: 2, threat: [20, 30] });
    const id = idOf(made.state, "143059");
    const explored = placeProgress(made.state, id, 99, made.ctx, []);
    const done = rest(explored, made.ctx);
    expect(threats(done)).toEqual([22, 32]);
    expect(done.cards[id]?.zone).toBe("encounterDiscard");
  });

  it("triggers its Wizardry as the active location", () => {
    const made = table({ active: "143059", seats: 2, threat: [20, 30] });
    const explored = placeProgress(made.state, idOf(made.state, "143059"), 99, made.ctx, []);
    expect(threats(rest(explored, made.ctx))).toEqual([22, 32]);
  });

  it("is a record of its own on the card: the trigger `wizardry`, a Forced effect that answers its own exploring", () => {
    const [record] = wizardryOf(table().ctx, "143059");
    expect(record?.timing).toBe("forced");
    expect(record?.subject).toBe("self");
    expect(wizardryOf(table().ctx, "143054")).toEqual([]);
  });

  it("143055:A:2 each player discards a random card from their hand, one each", () => {
    const made = table({ staging: ["143055"], seats: 2, hand: ["filler", "filler"] });
    const explored = placeProgress(made.state, idOf(made.state, "143055"), 99, made.ctx, []);
    const done = rest(explored, made.ctx);
    expect(done.seats.map((seat) => seat.hand.length)).toEqual([1, 1]);
  });
});

describe("143062:A:1 Machines of Isengard", () => {
  const revealWith = (layout: Layout) => {
    const made = table({ deck: ["f0", "f0", "f0"], ...layout });
    const revealed = revealFromTop(made.state, made.ctx, "143062", []);
    return { made, revealed, drawn: made.state.encounterDeck.length - revealed.state.encounterDeck.length };
  };

  it("triggers the Wizardry of the active location without exploring it, and does not surge", () => {
    const { made, revealed, drawn } = revealWith({ active: "143059", threat: [20, 30] });
    expect(revealed.state.seats[0]?.threat).toBe(22);
    expect(revealed.state.cards[idOf(made.state, "143059")]?.zone).toBe("activeLocation");
    expect(drawn).toBe(0);
  });

  it("surges when the active location prints no Wizardry effect (Gates of Isengard)", () => {
    expect(revealWith({ active: "143054" }).drawn).toBe(1);
  });

  it("surges when there is no active location", () => {
    expect(revealWith({}).drawn).toBe(1);
  });
});

describe("143047:A:2 Saruman is dealt a shadow card with a Wizardry effect", () => {
  it("is told once for each shadow card that prints one and is face up, and for no other", () => {
    const made = table({ staging: ["143047"], seats: 2 });
    const saruman = idOf(made.state, "143047");
    const plain = dealtWizardry(made.state, saruman, 1, "143060");
    expect(announceShadowWizardry(plain.state, made.ctx)).toBe(plain.state);
    const wizard = dealtWizardry(made.state, saruman, 1);
    const told = announceShadowWizardry(wizard.state, made.ctx);
    expect((told.pendingEvents ?? []).filter((event) => event.trigger === "shadowWizardry" && event.cardId === saruman && event.other === wizard.shadow && event.seat === 1)).toHaveLength(1);
    const facedown = updateCard(wizard.state, wizard.shadow, { face: "down" });
    expect(announceShadowWizardry(facedown, made.ctx)).toBe(facedown);
  });

  it("makes the defending player resolve that Wizardry as the only player in the game: only their threat rises", () => {
    const made = table({ staging: ["143047"], seats: 2, threat: [20, 30] });
    const saruman = idOf(made.state, "143047");
    const dealt = dealtWizardry(made.state, saruman, 1);
    const queued = queueEvent({ ...dealt.state, pendingAttack: null }, { trigger: "shadowWizardry", seat: 1, cardId: saruman, subject: saruman, other: dealt.shadow });
    expect(threats(rest(queued, made.ctx))).toEqual([20, 32]);
  });

  it("reads the number of players as 1 and the characters in play as the defending player's own", () => {
    const [vent] = wizardryOf(table().ctx, "143057");
    const alone = asOnlyPlayer(vent?.instructions ?? []);
    expect(alone).toEqual([{ verb: "AssignDamage", amount: 2, pick: { type: "character", control: "you" } }]);
    const made = table({ staging: ["143047"], seats: 2 });
    const saruman = idOf(made.state, "143047");
    const dealt = dealtWizardry(made.state, saruman, 1, "143057");
    const queued = queueEvent({ ...dealt.state, pendingAttack: null }, { trigger: "shadowWizardry", seat: 1, cardId: saruman, subject: saruman, other: dealt.shadow });
    const done = rest(queued, made.ctx);
    const damage = (id: string | null): number => (id ? (done.cards[id]?.damage ?? 0) : 0);
    expect(damage(made.hero) + damage(made.hero2)).toBe(0);
    expect(damage(made.seat1Hero)).toBe(2);
  });
});

describe("143052:A:1 Wolf of Isengard is dealt a shadow card with a Wizardry effect", () => {
  const woken = (layout: Layout) => {
    const made = table({ engaged: ["143052"], ...layout });
    const wolf = idOf(made.state, "143052");
    const dealt = dealtWizardry(made.state, wolf, 0);
    const queued = queueEvent({ ...dealt.state, pendingAttack: null }, { trigger: "shadowWizardry", seat: 0, cardId: wolf, subject: wolf, other: dealt.shadow });
    return { made, wolf, run: settle({ ...queued, window: null, mode: "stopped" }, made.ctx, []) };
  };

  it("offers the discard and the additional attack, and only the attack with an empty hand", () => {
    const full = woken({ hand: ["filler", "filler"] });
    expect(full.run.window?.kind === "choose" ? [...full.run.window.options] : []).toEqual(["discard", "attack"]);
    const empty = woken({});
    expect(empty.run.window?.kind === "choose" ? [...empty.run.window.options] : []).not.toContain("discard");
  });
});

describe("a Wizardry location dealt as an ordinary shadow card", () => {
  it("does nothing: a shadow card has only its Shadow text active", () => {
    const fought = fightEnemy((layout: Layout) => tableFromLayout(ID, layout), "143059", "f3", { stage: "143079", threat: [20, 30] });
    expect(fought.run.state.seats[0]?.threat).toBe(20);
  });
});

describe("143058:A:1 Plain of Isengard's Threat is the number of players", () => {
  it("is 1 for one player and 2 for two", () => {
    for (const seats of [1, 2] as const) {
      const made = table({ staging: ["143058"], seats });
      const card = made.state.cards[idOf(made.state, "143058")]!;
      expect(modifiedStat(made.state, card, "threat", made.cards)).toBe(seats);
    }
  });
});

describe("143080:B:2 the progress placed this phase", () => {
  it("is noted while the table holds trackQuestProgress and taken off by CancelPhaseProgress, the overflow of an explored location included", () => {
    const made = table({ stage: "143080", active: "143059", staging: ["143053"] });
    const stage = idOf(made.state, "143080");
    const steps: EngineStep[] = [];
    const placed = runInstruction(made.state, { verb: "ProgressQuest", amount: 9 }, { seat: 0, sourceId: null }, made.ctx, steps);
    expect(placed.cards[stage]?.progress).toBeGreaterThan(0);
    const cancelled = runInstruction(placed, { verb: "CancelPhaseProgress" }, { seat: 0, sourceId: stage }, made.ctx, steps);
    expect(cancelled.cards[stage]?.progress).toBe(0);
    expect(holds(cancelled, { kind: "hasWizardry" }, { actor: 0, sourceId: null, returned: 0 }, made.ctx)).toBe(false);
  });
});
