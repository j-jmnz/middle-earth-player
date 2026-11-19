// Rules: rr.attachment-cards, rr.staging, rr.engaged, rr.optional-engagement, rr.step-6-8-1, rr.step-6-8-3,
// rr.attacks-outside-the-combat-phase, faq.limitations-on-attacks, rr.destroy, rr.encounter-deck (data/rules/entries.json).
// Trap cards (no rules text in data/rules: their card text says how they work): played into the staging area or a play area
// unattached, attached to the next eligible enemy, and what they do to it. Real records with fixture cards.
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";

import type { EngineStep } from "../../core/intents.ts";
import { modifiedStat } from "../../core/keywords.ts";
import { legalTargets } from "../../engine/legal.ts";
import { settle } from "../../engine/machine.ts";
import { reduce } from "../../engine/reduce.ts";
import { stagingThreat } from "../../quest/quest.ts";
import { declarableEnemies } from "../../combat/combat.ts";
import { updateCard, withMode, type ScenarioState } from "../../core/state.ts";
import { attachTo, moveCard } from "../../core/zones.ts";
import { queueEvent } from "../../windows/queue.ts";
import { attachmentCtx, deck, offered, play, put, resolveChoices, seat, send } from "./fixture.ts";

const ctx = attachmentCtx(EFFECTS);

// The staging step, run until a player is asked something.
function stage(state: ScenarioState, steps: EngineStep[] = []): ScenarioState {
  return settle({ ...withMode({ ...state, window: null }, "staging"), boundaryPhase: "Quest" }, ctx, steps);
}

describe("a Trap played into the staging area unattached", () => {
  it("is offered the staging area as its host, sits there under its player's control and attaches to the next enemy that enters it", () => {
    const table = seat();
    const trap = put(table.state, "05017", "hand");
    expect(legalTargets(trap.state, { type: "PlayCard", cardId: trap.id }, ctx)).toEqual(["staging"]);
    const played = send(trap.state, { type: "PlayCard", cardId: trap.id, payments: [{ heroId: table.heroes[0] ?? "", amount: 2 }], hostId: "staging" }, ctx);
    expect(played.cards[trap.id]).toMatchObject({ zone: "staging", controller: 0, host: null });
    expect(played.staging).toContain(trap.id);
    // A location is revealed first: the Trap waits for an enemy.
    const built = deck(played, ["marsh", "orc"]);
    const first = stage(built.state);
    expect(first.cards[trap.id]?.host).toBeNull();
    const orc = built.ids[1] ?? "";
    const second = stage({ ...first, revealCursor: null });
    expect(second.cards[trap.id]).toMatchObject({ zone: "play", host: orc, controller: 0 });
    expect(second.cards[orc]?.attachments).toContain(trap.id);
    expect(second.staging).not.toContain(trap.id);
    // Ranger Spikes' own line (pool): attached enemy gets -2 Threat.
    expect(modifiedStat(second, second.cards[orc]!, "threat", ctx.cards)).toBe(0);
  });

  it("does not take a host when played for an ordinary host or with none (Ranger Spikes needs no character)", () => {
    const table = seat();
    const trap = put(table.state, "05017", "hand");
    expect(reduce(trap.state, { type: "PlayCard", cardId: trap.id, payments: [], hostId: table.heroes[0] ?? "" }, ctx).ok).toBe(false);
    expect(reduce(trap.state, { type: "PlayCard", cardId: trap.id, payments: [] }, ctx).ok).toBe(false);
  });

  it("lets any character choose the enemy Ithilien Pit is attached to as the target of an attack, in the staging area", () => {
    const table = seat();
    const orc = put(table.state, "orc", "staging");
    const pit = put(orc.state, "06064", "play");
    let state = attachTo(pit.state, pit.id, orc.id);
    state = { ...state, phase: "Combat", mode: "playerAttacks", boundaryPhase: "Combat", window: { kind: "playerAttack" } };
    const synced = settle({ ...state, window: null, mode: "stopped" }, ctx, []);
    const ready = { ...synced, mode: "playerAttacks" as const, window: { kind: "playerAttack" as const } };
    expect(declarableEnemies(ready, 0, table.heroes[0] ?? "", ctx.cards)).toEqual([orc.id]);
    const attacked = send(ready, { type: "DeclareAttackers", enemyId: orc.id, attackerIds: [table.heroes[0] ?? "", table.heroes[1] ?? ""] }, ctx);
    // 4 attack against 1 defense: 3 damage destroys the orc (3 hit points), and its Trap goes with it.
    expect(attacked.cards[orc.id]?.zone).toBe("encounterDiscard");
    expect(attacked.cards[pit.id]?.zone).toBe("discard");
  });

  it("deals 2 damage to the enemy Poisoned Stakes is attached to at the end of each round", () => {
    const table = seat();
    const orc = put(table.state, "orc", "staging");
    const stakes = put(orc.state, "06115", "play");
    const loose = put(stakes.state, "06115", "staging");
    let state = attachTo(loose.state, stakes.id, orc.id);
    state = { ...state, phase: "Refresh", mode: "endRound", boundaryPhase: "End of round", window: null };
    state = settle({ ...state, phase: "Beginning of round", mode: "stopped" }, ctx, []);
    expect(state.cards[orc.id]?.damage).toBe(2);
  });
});

describe("Damrod and the Traps", () => {
  it("reduces the first Trap each round by 1 and draws a card when a Trap he controls is attached to an enemy", () => {
    const table = seat(1, ["144003", "hobbit"]);
    const first = put(table.state, "05017", "hand");
    const second = put(first.state, "05017", "hand");
    const drawn = put(second.state, "silvan", "deck");
    // Ranger Spikes costs 2: 1 with Damrod, for the first Trap only.
    const paidOne = send(drawn.state, { type: "PlayCard", cardId: first.id, payments: [{ heroId: table.heroes[0] ?? "", amount: 1 }], hostId: "staging" }, ctx);
    expect(reduce(paidOne, { type: "PlayCard", cardId: second.id, payments: [{ heroId: table.heroes[0] ?? "", amount: 1 }], hostId: "staging" }, ctx).ok).toBe(false);
    const built = deck(paidOne, ["orc"]);
    const asked = stage(built.state);
    expect(offered(asked, ctx)).toContainEqual({ type: "Trigger", cardId: table.heroes[0], effectId: "144003:response:1" });
    const done = resolveChoices(asked, ctx, ["144003:response:1"]);
    expect(done.cards[drawn.id]?.zone).toBe("hand");
  });
});

describe("a Trap played into its player's play area unattached", () => {
  it("attaches Followed to the next enemy that engages its player and lowers the staging area's Threat by its printed Threat", () => {
    const table = seat();
    const followed = put(table.state, "17139", "hand");
    expect(legalTargets(followed.state, { type: "PlayCard", cardId: followed.id }, ctx)).toEqual(["seat:0"]);
    const played = play(followed.state, followed.id, ctx, "seat:0");
    expect(played.cards[followed.id]).toMatchObject({ zone: "play", host: null, controller: 0 });
    const warg = put(played, "warg", "staging");
    const marsh = put(warg.state, "marsh", "staging");
    expect(stagingThreat(marsh.state, ctx.cards)).toBe(5);
    const engaged = settle({ ...marsh.state, window: { kind: "optionalEngage" }, mode: "optionalEngage", phase: "Encounter", boundaryPhase: "Encounter" }, ctx, []);
    const after = send(engaged, { type: "Engage", enemyId: warg.id }, ctx);
    expect(after.cards[followed.id]?.host).toBe(warg.id);
    // The warg (printed Threat 3) is engaged with Followed's player: the marsh's 2 Threat is reduced to 0.
    expect(stagingThreat(after, ctx.cards)).toBe(0);
  });

  it("readies the defending character after the enemy Outmatched is attached to resolves its attack", () => {
    const table = seat();
    const orc = put(table.state, "orc", "engaged");
    const outmatched = put(orc.state, "19062", "play");
    let state = attachTo(outmatched.state, outmatched.id, orc.id);
    state = { ...state, phase: "Combat", mode: "enemyAttacks", boundaryPhase: "Combat", window: null };
    state = settle(state, ctx, []);
    expect(state.window?.kind).toBe("defense");
    const defender = table.heroes[0] ?? "";
    let next = send(state, { type: "DeclareDefender", defenderId: defender }, ctx);
    for (let guard = 0; guard < 10 && next.window?.kind !== "response"; guard += 1) next = send(next, { type: "Pass" }, ctx);
    expect(next.cards[defender]?.exhausted).toBe(true);
    expect(offered(next, ctx)).toContainEqual({ type: "Trigger", cardId: outmatched.id, effectId: "19062:response:1" });
    const readied = send(next, { type: "Trigger", cardId: outmatched.id, effectId: "19062:response:1" }, ctx);
    expect(readied.cards[defender]?.exhausted).toBe(false);
  });
});

describe("Ambush's Combat Action", () => {
  it("lets the engaged player discard Ambush to declare an attack against the attached enemy, beside the framework's attack", () => {
    const table = seat();
    const orc = put(table.state, "orc", "engaged");
    const ambush = put(orc.state, "144009", "play");
    let state = attachTo(ambush.state, ambush.id, orc.id);
    state = { ...state, phase: "Combat", mode: "combatActions", boundaryPhase: "Combat", window: { kind: "pass" } };
    expect(offered(state, ctx)).toContainEqual({ type: "Trigger", cardId: ambush.id, effectId: "144009:action:1" });
    const asked = send(state, { type: "Trigger", cardId: ambush.id, effectId: "144009:action:1" }, ctx);
    expect(asked.cards[ambush.id]?.zone).toBe("discard");
    expect(asked.window).toEqual({ kind: "choose", seat: 0, options: [table.heroes[0], table.heroes[1]] });
    const one = send(asked, { type: "Choose", optionId: table.heroes[0] ?? "" }, ctx);
    const done = send(one, { type: "Choose", optionId: table.heroes[1] ?? "" }, ctx);
    // 4 attack against 1 defense destroys the orc; both attackers exhausted; the framework's attack was not used.
    expect(done.cards[orc.id]?.zone).toBe("encounterDiscard");
    expect(done.cards[table.heroes[0] ?? ""]?.exhausted).toBe(true);
    expect(done.declaredAttacks).toEqual([]);
  });

  it("is not offered outside combat or to a player the attached enemy is not engaged with", () => {
    const table = seat(2);
    const orc = put(table.state, "orc", "engaged", 1);
    const ambush = put(orc.state, "144009", "play");
    const combat = { ...attachTo(ambush.state, ambush.id, orc.id), phase: "Combat" as const, mode: "combatActions" as const, window: { kind: "pass" as const } };
    expect(offered(combat, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "144009:action:1")).toBe(false);
    expect(offered({ ...combat, activeSeat: 1 }, ctx)).toContainEqual({ type: "Trigger", cardId: ambush.id, effectId: "144009:action:1" });
    expect(offered({ ...combat, activeSeat: 1, phase: "Planning" }, ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "144009:action:1")).toBe(false);
  });
});

describe("Interrogation", () => {
  it("looks at as many encounter cards as the trapped enemy's printed Threat, and may discard 1 of them", () => {
    const table = seat();
    const built = deck(table.state, ["mist", "marsh", "ford", "orc"]);
    const warg = put(built.state, "warg", "staging");
    const nets = put(warg.state, "12064", "play");
    const event = put(attachTo(nets.state, nets.id, warg.id), "12090", "hand");
    const looked = play(event.state, event.id, ctx);
    expect(looked.window).toEqual({ kind: "look", seat: 0, cardIds: built.ids.slice(0, 3) });
    const asked = send(looked, { type: "Pass" }, ctx);
    const chosen = resolveChoices(asked, ctx, ["discard", built.ids[1] ?? ""]);
    expect(chosen.encounterDiscard).toEqual([built.ids[1]]);
    expect(chosen.encounterDeck).toEqual([built.ids[0], built.ids[2], built.ids[3]]);
  });

  it("cannot be played without an enemy with an attached Trap", () => {
    const table = seat();
    const warg = put(table.state, "warg", "staging");
    const event = put(warg.state, "12090", "hand");
    expect(reduce(event.state, { type: "PlayCard", cardId: event.id, payments: [] }, ctx).ok).toBe(false);
  });
});

describe("Secret Vigil", () => {
  it("lowers each player's threat by the printed Threat of the attached enemy when it is destroyed", () => {
    const table = seat(2);
    const warg = put(table.state, "warg", "engaged");
    const vigil = put(warg.state, "09012", "hand");
    expect(legalTargets(vigil.state, { type: "PlayCard", cardId: vigil.id }, ctx)).toContain(warg.id);
    const attached = play(vigil.state, vigil.id, ctx, warg.id);
    expect(modifiedStat(attached, attached.cards[warg.id]!, "threat", ctx.cards)).toBe(2);
    const hurt = updateCard({ ...attached, phase: "Combat", mode: "playerAttacks", boundaryPhase: "Combat", window: { kind: "playerAttack" } }, warg.id, { damage: 3 });
    const attacked = send(hurt, { type: "DeclareAttackers", enemyId: warg.id, attackerIds: [table.heroes[0] ?? ""] }, ctx);
    expect(attacked.cards[vigil.id]?.zone).toBe("discard");
    expect(offered(attacked, ctx)).toContainEqual({ type: "Trigger", cardId: vigil.id, effectId: "09012:response:1" });
    const lowered = send(attacked, { type: "Trigger", cardId: vigil.id, effectId: "09012:response:1" }, ctx);
    expect([lowered.seats[0].threat, lowered.seats[1].threat]).toEqual([17, 17]);
  });
});


describe("a Trap when the stages are separate (mec109.multiple-staging-areas)", () => {
  // Two seats, each with its own staging area; the Trap is played by seat 0, and an orc then enters one area.
  function entering(area: number): { state: ScenarioState; trap: string; orc: string } {
    const table = seat(2);
    const separate = { ...table.state, separate: true } satisfies ScenarioState;
    const trap = put(separate, "05017", "hand");
    const played = send(trap.state, { type: "PlayCard", cardId: trap.id, payments: [{ heroId: table.heroes[0] ?? "", amount: 2 }], hostId: "staging" }, ctx);
    const orc = put(played, "orc", "hand");
    const moved = moveCard(orc.state, orc.id, { zone: "staging", area });
    const queued = queueEvent(moved, { trigger: "addedToStaging", seat: area, cardId: orc.id });
    return { state: settle({ ...queued, window: null }, ctx, []), trap: trap.id, orc: orc.id };
  }

  it("goes into the staging area of the seat that played it", () => {
    const table = seat(2);
    const trap = put({ ...table.state, separate: true }, "05017", "hand");
    const played = send(trap.state, { type: "PlayCard", cardId: trap.id, payments: [{ heroId: table.heroes[0] ?? "", amount: 2 }], hostId: "staging" }, ctx);
    expect(played.seats[0].staging).toContain(trap.id);
    expect(played.seats[1].staging).not.toContain(trap.id);
  });

  it("attaches to the next enemy that enters its own staging area", () => {
    const { state, trap, orc } = entering(0);
    expect(state.cards[trap]).toMatchObject({ zone: "play", host: orc });
  });

  it("does not attach to an enemy that enters another seat's staging area", () => {
    const { state, trap } = entering(1);
    expect(state.cards[trap]).toMatchObject({ zone: "staging", host: null });
  });
});
