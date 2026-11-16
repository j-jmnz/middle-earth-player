// Rules: rr.guarded, rr.objective-cards, rr.attachment-cards, rr.forced, rr.response, sotm.reset-the-quest-deck (data/rules/entries.json); ledger lines 02013:B:1, 02014:A:2, 900401:A:2, 900401:A:3, 900405:A:1, 900408:A:2.
// The Signs of Gollum on a table of The Hunt for Gollum: claimed in a Response to the quest just resolved (the first player names a committed hero), returned to the top of the encounter deck when their hero is damaged or leaves play, counted as Clue cards,
// and, in the Nightmare deck, attached to Mordor enemies as the enemy's guarded objectives.
import { describe, expect, it } from "vitest";

import type { EngineStep } from "../../core/intents.ts";
import { destroyCard, placeDamage } from "../../core/keywords.ts";
import { settle } from "../../engine/machine.ts";
import type { ScenarioState } from "../../core/state.ts";
import { updateCard } from "../../core/state.ts";
import { attachTo, moveCard, spawn } from "../../core/zones.ts";
import { holds } from "../../interpret/conditions.ts";
import { constantWin } from "../../interpret/constants.ts";

import { first, legalIntents, resolveRecords, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const SIGNS = "02014";
const HUNTERS = "02021";

const table = (layout: Layout) => tableFromLayout("the-hunt-for-gollum", layout);

// What claiming does (ClaimObjective), for a table that starts with the Clue on a hero.
function claimed(state: ScenarioState, signsId: string, heroId: string): ScenarioState {
  const hero = state.cards[heroId];
  const attached = attachTo(moveCard(state, signsId, { zone: "attached" }), signsId, heroId);
  return updateCard(attached, signsId, { face: "up", controller: hero?.controller ?? 0, claimed: true });
}

describe("02014:A:2 Signs of Gollum", () => {
  // Stage 2 (A New Terror Abroad) needs 2 more progress; the two heroes quest for 4.
  const quested = (staging: readonly string[] = [SIGNS]) => {
    const made = table({ stage: "02012", progress: 8, staging, phase: "Quest" });
    let run = start(made.state);
    run = send(run, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    return { made, run };
  };

  it("02014:A:2 is offered to the first player as a Response once the quest succeeded, with the next stage already revealed, and a claim attaches it to a committed hero", () => {
    const { made, run } = quested();
    const signs = first(run.state, SIGNS);
    expect(run.state.window?.kind).toBe("response");
    expect(legalIntents(run.state, made.ctx)).toContainEqual({ type: "Trigger", cardId: signs, effectId: "02014:response:1" });
    const used = send(run, { type: "Trigger", cardId: signs, effectId: "02014:response:1" }, made.ctx);
    // The hero is any hero committed to the quest, chosen by the first player, though the quest's resolution cleared the commitment.
    expect(used.state.window).toMatchObject({ kind: "choose", options: [made.hero, made.hero2] });
    const chosen = send(used, { type: "Choose", optionId: made.hero }, made.ctx);
    expect(chosen.state.cards[signs]).toMatchObject({ zone: "attached", host: made.hero, claimed: true, controller: 0 });
    expect(chosen.state.cards[made.hero]?.attachments).toEqual([signs]);
    // The claim kept stage 3's condition met: the quest deck did not reset.
    expect(first(chosen.state, "02013")).toBe(chosen.state.questStage);
  });

  it("02014:A:2 is not offered while an encounter card guards it", () => {
    const made = table({ stage: "02012", progress: 8, staging: [SIGNS, "f0"], phase: "Quest" });
    const signs = first(made.state, SIGNS);
    const guarded = updateCard(attachTo(made.state, first(made.state, "f0"), signs), first(made.state, "f0"), { guard: true });
    let run = start(guarded);
    run = send(run, { type: "Commit", cardIds: [made.hero, made.hero2] }, made.ctx);
    run = send(run, { type: "Pass" }, made.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });

  it("02013:B:1 resets the quest deck to stage 2B, with no progress on the quest, once the Response is declined and no hero holds a Clue", () => {
    const { run, made } = quested();
    expect(first(run.state, "02013")).toBe(run.state.questStage);
    const declined = send(run, { type: "Pass" }, made.ctx);
    expect(declined.state.cards[declined.state.questStage ?? ""]?.code).toBe("02012");
    expect(declined.state.cards[declined.state.questStage ?? ""]?.progress).toBe(0);
    expect(declined.state.cards[first(declined.state, "02013")]?.zone).toBe("questDeck");
  });

  it("02014:A:2 returns to the top of the encounter deck, facedown, when its hero leaves play", () => {
    const made = table({ stage: "02012", staging: [], deck: ["f0", "f3"], phase: "Quest" });
    const spawned = spawn(made.state, SIGNS, { zone: "staging" });
    const attached = claimed(spawned.state, spawned.id, made.hero);
    const synced = settle({ ...attached, window: null }, made.ctx, []);
    const steps: EngineStep[] = [];
    const gone = destroyCard(synced, made.hero, made.ctx.cards, steps);
    expect(gone.encounterDeck[0]).toBe(spawned.id);
    expect(gone.cards[spawned.id]).toMatchObject({ zone: "encounterDeck", face: "down" });
    expect(gone.cards[spawned.id]?.claimed).toBeUndefined();
    expect(gone.encounterDeck).toHaveLength(3);
  });

  it("02014:A:2 returns to the top of the encounter deck when its hero is damaged (Forced)", () => {
    const made = table({ stage: "02012", deck: ["f0", "f3"], phase: "Quest" });
    const spawned = spawn(made.state, SIGNS, { zone: "staging" });
    const attached = claimed(spawned.state, spawned.id, made.hero);
    const steps: EngineStep[] = [];
    const hurt = placeDamage(attached, made.hero, 1, made.ctx.cards, steps, "framework", { kind: "rule", rule: "test" } as never);
    const run = { state: settle({ ...hurt, window: null }, made.ctx, steps), steps };
    expect(run.state.encounterDeck[0]).toBe(spawned.id);
    expect(run.state.cards[spawned.id]?.zone).toBe("encounterDeck");
    expect(run.state.cards[made.hero]?.damage).toBe(1);
  });
});

describe("Clue cards", () => {
  it("02021:A:1 Hunters from Mordor counts a Clue wherever it is in play: staging, guarded, claimed", () => {
    const made = table({ staging: [SIGNS, SIGNS, HUNTERS], phase: "Quest" });
    const ids = Object.values(made.state.cards).filter((card) => card.code === SIGNS).map((card) => card.id);
    const withClaim = claimed(made.state, ids[0] ?? "", made.hero);
    const hunters = first(withClaim, HUNTERS);
    // Two Clue cards in play: +2 Attack and +2 Threat for each.
    const synced = settle({ ...withClaim, window: null }, made.ctx, []);
    expect(made.ctx.cards.get(HUNTERS)?.attack).toBeDefined();
    const modified = synced.modifiers.filter((modifier) => modifier.sourceId === hunters && (modifier.stat === "attack" || modifier.stat === "threat"));
    expect(modified.map((modifier) => modifier.amount).sort()).toEqual([4, 4]);
  });
});

describe("900401:A:2 Nightmare: a Clue attached to a Mordor enemy", () => {
  const nightmare = (layout: Layout) => {
    const made = table(layout);
    const spawned = spawn(made.state, "900401", { zone: "nightmare" });
    return { ...made, state: spawned.state, setup: spawned.id };
  };

  it("900401:A:2 makes a free Mordor enemy guard an unclaimed Clue, detaching its old guard, and an engaged enemy stays engaged", () => {
    const made = nightmare({ staging: [SIGNS, "f0"], engaged: [HUNTERS], phase: "Refresh" });
    const signs = first(made.state, SIGNS);
    const oldGuard = first(made.state, "f0");
    const hunters = first(made.state, HUNTERS);
    const guarded = updateCard(attachTo(made.state, oldGuard, signs), oldGuard, { guard: true });
    const run = resolveRecords(guarded, made.ctx, "900401", "forced", made.setup);
    expect(run.state.cards[hunters]).toMatchObject({ host: signs, guard: true, zone: "engaged" });
    expect(run.state.cards[oldGuard]).toMatchObject({ host: null, zone: "staging" });
    expect(run.state.cards[signs]?.attachments).toEqual([hunters]);
  });

  it("900401:A:2 does nothing with no Mordor enemy in play", () => {
    const made = nightmare({ staging: [SIGNS, "f0"], phase: "Refresh" });
    const signs = first(made.state, SIGNS);
    const run = resolveRecords(made.state, made.ctx, "900401", "forced", made.setup);
    expect(run.state.cards[signs]?.attachments).toEqual([]);
  });

  it("900401:A:3 loses the game with four Clue cards guarded by Mordor enemies", () => {
    const made = nightmare({ staging: [SIGNS, SIGNS, SIGNS, SIGNS, HUNTERS, HUNTERS, HUNTERS, HUNTERS], phase: "Quest" });
    const signs = Object.values(made.state.cards).filter((card) => card.code === SIGNS).map((card) => card.id);
    const hunters = Object.values(made.state.cards).filter((card) => card.code === HUNTERS).map((card) => card.id);
    let state = made.state;
    for (const [at, id] of signs.entries()) {
      state = updateCard(attachTo(state, hunters[at] ?? "", id), hunters[at] ?? "", { guard: true });
      const settled = constantWin(state, made.ctx);
      // Three are no loss; the fourth is.
      expect(settled.lost === true, `with ${at + 1} guarded: ${settled.lossReason}`).toBe(at === 3);
    }
  });

  it("900405:A:1 gives a Mordor enemy that guards a Clue +2 Defense", () => {
    const made = nightmare({ staging: [SIGNS, HUNTERS, "900405"], phase: "Quest" });
    const hunters = first(made.state, HUNTERS);
    const signs = first(made.state, SIGNS);
    const before = settle({ ...made.state, window: null }, made.ctx, []);
    const guarded = updateCard(attachTo(before, hunters, signs), hunters, { guard: true });
    const after = settle({ ...guarded, window: null }, made.ctx, []);
    const defense = (state: ScenarioState) => state.modifiers.filter((modifier) => modifier.instanceId === hunters && modifier.stat === "defense").reduce((sum, modifier) => sum + modifier.amount, 0);
    expect(defense(before)).toBe(0);
    expect(defense(after)).toBe(2);
  });

  it("900408:A:2 takes a Clue off a hero and attaches it to a Mordor enemy in play, the hero losing it", () => {
    const made = nightmare({ staging: [HUNTERS], phase: "Quest" });
    const spawned = spawn(made.state, SIGNS, { zone: "staging" });
    const attached = claimed(spawned.state, spawned.id, made.hero);
    const run = resolveRecords(attached, made.ctx, "900408", "whenRevealed");
    const hunters = first(run.state, HUNTERS);
    expect(run.state.cards[spawned.id]).toMatchObject({ zone: "staging", host: null });
    expect(run.state.cards[spawned.id]?.claimed).toBeUndefined();
    expect(run.state.cards[hunters]).toMatchObject({ host: spawned.id, guard: true });
    expect(run.state.cards[made.hero]?.attachments).toEqual([]);
  });

  it("conditions read the Clue a hero holds", () => {
    const made = table({ phase: "Quest" });
    const spawned = spawn(made.state, SIGNS, { zone: "staging" });
    const attached = claimed(spawned.state, spawned.id, made.hero);
    const scope = { actor: 0, sourceId: null, returned: 0 };
    const condition = { kind: "canPick", pick: { type: "hero", control: "you", hasAttachment: { trait: "Clue" } } } as const;
    expect(holds(made.state, condition, scope, made.ctx)).toBe(false);
    expect(holds(attached, condition, scope, made.ctx)).toBe(true);
  });
});
