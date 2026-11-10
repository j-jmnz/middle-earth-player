// Rules: mec112.wizardry, rr.explored, rr.active-location, rr.lasting-effects, rr.blank, rr.resources, rr.ranged, rr.the-word-choose, faq.additional-attacks (data/rules/entries.json); ledger lines 143020:A:2, 143058:A:2, 143061:A:2, 143052:A:1, 143078:B:2, 143079:B:2,
// 143080:B:2, 143048:A:2. What a card-spec row cannot see on The Road to Isengard's own cards: the new vocabulary (RevealFewer for one player, RevealEncounter for several cards, an additional attack after this one, a blank for the damaged characters until the end of
// the combat phase, archery that goes to allies, the progress an explored Orthanc cancels, the win gate on Saruman's damage). Each test title starts with the line it covers (scripts/checks/spec-coverage.test.ts). The wizardry and deck families' own tests are
// src/rules/families/wizardry/index.test.ts and src/rules/families/deck/pressure.test.ts.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { archeryRecipients } from "../../../rules/combat/combat.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { expireModifiers, flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { placeProgress } from "../../../rules/interpret/effect-verbs.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { restricted } from "../../../rules/interpret/restrictions.ts";
import { textBlank } from "../../../rules/families/attachments/hold.ts";
import { revealSkipped, revealsAllowed } from "../../../rules/families/encounter/reveal.ts";
import { stagingStep } from "../../../rules/windows/frames.ts";
import { legalIntents } from "../../../rules/engine/reduce.ts";
import { fightEnemy, finish, idOf, resolveRecords, send, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const ID = "the-road-to-isengard";
const at = (layout: Layout = {}) => tableFromLayout(ID, { stage: "143079", phase: "Quest", deck: ["f0", "f0", "f0", "f0"], ...layout });
const rest = (state: ScenarioState, ctx: ReturnType<typeof at>["ctx"], steps: EngineStep[] = []): ScenarioState => settle({ ...state, window: null, mode: "stopped" }, ctx, steps);
// A made-up Action's instructions, resolved in a frame of their own for the first hero.
function resolved(made: ReturnType<typeof at>, instructions: Effect["instructions"], pick?: (state: ScenarioState) => string): ScenarioState {
  const effect: Effect = { id: "t:action:1", cardCode: "t", lines: ["t:A:1"], timing: "action", instructions };
  const pushed = pushCardEffects(made.state, "forced", made.hero, 0, false, [effect], made.ctx, []);
  return finish({ state: rest(pushed, made.ctx), steps: [] }, made.ctx, pick).state;
}

describe("143020:A:2 the Palantír makes a chosen player reveal 1 fewer encounter card", () => {
  const fewer = (): ScenarioState =>
    resolved(at({ seats: 2 }), [{ verb: "Pick", pick: { type: "player", control: "any" } }, { verb: "RevealFewer", amount: 1, min: 0, who: "picked" }], (state) => (state.window?.kind === "choose" ? (state.window.options[1] ?? "") : ""));

  it("143020:A:2 skips that player's reveal and no other: the staging step reveals for the other seat only", () => {
    const state = fewer();
    expect(revealSkipped(state, 1)).not.toBeNull();
    expect(revealSkipped(state, 0)).toBeNull();
    // The total is not shortened: the other player's reveal still happens.
    expect(revealsAllowed(state, 2)).toBe(2);
    const steps: EngineStep[] = [];
    const skipped = stagingStep({ ...state, window: null, mode: "questCommit", revealCursor: { seats: [0, 1], index: 1 } }, { effects: [], cards: new Map() } as never, steps);
    expect(skipped.stack.length).toBe(state.stack.length);
    expect(revealSkipped(skipped, 1)).toBeNull();
  });
});

describe("143046:A:1 the Ent of Fangorn's Quest Action", () => {
  const ent = (resources: number, seats: 1 | 2 = 1) => {
    const made = at({ stage: "143078", staging: [{ code: "143046", resources }], deck: ["f0", "f0"], seats });
    return { made, id: idOf(made.state, "143046") };
  };
  const trigger = (made: ReturnType<typeof at>, id: string, seat: number) => finish(send({ state: { ...made.state, activeSeat: seat }, steps: [] }, { type: "Trigger", cardId: id, effectId: "143046:action:1", payments: [] }, made.ctx), made.ctx);

  it("143046:A:1 is offered to any player while the Ent is in the staging area, and places a resource when the hero's Willpower beats the Threat", () => {
    const { made, id } = ent(0, 2);
    const offered = legalIntents(made.state, made.ctx).filter((intent) => intent.type === "Trigger" && intent.cardId === id);
    expect(offered.length).toBeGreaterThan(0);
    const done = trigger(made, id, 1);
    expect(done.state.cards[id]?.resources).toBe(1);
    expect(done.state.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
  });

  it("143046:A:1 gives control of the Ent to the triggering player at 3 resources, and the tokens go", () => {
    const { made, id } = ent(2, 2);
    const done = trigger(made, id, 1);
    expect(done.state.cards[id]?.zone).toBe("play");
    expect(done.state.cards[id]?.controller).toBe(1);
    expect(done.state.cards[id]?.resources).toBe(0);
  });
});

describe("143079:B:2 each non-unique location explored puts a damage on stage 2B", () => {
  it("143079:B:2 places 1 damage and advances to stage 3A at 5, for a location explored in the staging area, and counts no unique location", () => {
    const made = at({ staging: ["143059"], deck: ["f0", "f0"], threat: [20, 20] });
    const stage = idOf(made.state, "143079");
    const four = updateCard(made.state, stage, { damage: 4 });
    const explored = rest(placeProgress(four, idOf(four, "143059"), 99, made.ctx, []), made.ctx);
    expect(explored.cards[idOf(explored, "143080")]?.zone).toBe("questStage");
    const one = rest(placeProgress(made.state, idOf(made.state, "143059"), 99, made.ctx, []), made.ctx);
    expect(one.cards[stage]?.damage).toBe(1);
    expect(one.cards[stage]?.zone).toBe("questStage");
    const unique = at({ active: "143054", deck: ["f0", "f0"] });
    const gates = rest(placeProgress(unique.state, idOf(unique.state, "143054"), 99, unique.ctx, []), unique.ctx);
    expect(gates.cards[idOf(gates, "143079")]?.damage).toBe(0);
  });
});

describe("143078:B:2 reveals 1 encounter card for each resource", () => {
  it("143078:B:2 RevealEncounter with `times` reveals that many cards, one after the other", () => {
    const made = at({ deck: ["f0", "f0", "f0", "f0", "f0"] });
    const done = resolved(made, [{ verb: "RevealEncounter", times: 3 }]);
    expect(made.state.encounterDeck.length - done.encounterDeck.length).toBe(3);
  });

  it("143078:B:2 advances to stage 2, shuffles the discard pile in and reveals a card for each resource, the Ents leaving the game", () => {
    const made = at({ stage: "143078", discard: ["f3"], staging: ["143046", "143046"], deck: ["f0", "f0", "f0", "f0"] });
    const stage = idOf(made.state, "143078");
    const loaded = updateCard(made.state, stage, { resources: 2 });
    const done = resolveRecords({ ...loaded, phase: "End of round" }, made.ctx, "143078", "forced", stage, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("advance") ? "advance" : (state.window.options[0] ?? "")) : ""));
    expect(done.state.cards[idOf(done.state, "143079")]?.zone).toBe("questStage");
    expect(Object.values(done.state.cards).filter((card) => card.code === "143046").every((card) => card.zone === "removed")).toBe(true);
    // 3 resources after this round's token: 3 cards revealed from the deck the discard pile was shuffled into.
    expect(done.state.encounterDiscard).not.toContain(idOf(made.state, "f3"));
  });
});

describe("143052:A:1 the Wolf's additional attack comes after this one", () => {
  it("143052:A:1 ImmediateAttack with `afterThis` waits in the attack's own list while the attack is in progress, and does nothing with none", () => {
    const made = at({ engaged: ["143052"] });
    const wolf = idOf(made.state, "143052");
    const effect: Effect = { id: "t:forced:1", cardCode: "143052", lines: ["143052:A:1"], timing: "forced", instructions: [{ verb: "ImmediateAttack", afterThis: true }] };
    const run = (state: ScenarioState): ScenarioState => rest(pushCardEffects(state, "forced", wolf, 0, false, [effect], made.ctx, []), made.ctx);
    expect(run({ ...made.state, pendingAttack: { enemyId: wolf, seat: 0 } }).pendingAttack?.after).toEqual([{ verb: "ImmediateAttack" }]);
    expect(run(made.state).pendingAttack ?? null).toBeNull();
  });

  it("143052:A:1 makes a second attack against the same player, dealt a shadow card of its own", () => {
    const fought = fightEnemy((layout: Layout) => tableFromLayout(ID, layout), "143059", "143052", { stage: "143079", hand: ["filler", "filler"] }, { pick: () => "attack" });
    const attacks = fought.run.steps.filter((step) => step.kind === "attack" && step.side === "enemy" && step.enemyId === idOf(fought.start, "143052"));
    expect(attacks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("143061:A:2 Poisoned Vapour blanks the damaged characters until the end of the combat phase", () => {
  const vapour = () => {
    const made = at({ phase: "Quest" });
    const hurt = updateCard(made.state, made.hero, { damage: 1 });
    const done = resolveRecords(hurt, made.ctx, "143061", "whenRevealed");
    return { made, done };
  };

  it("143061:A:2 exhausts each damaged character and blanks its text box, Traits kept; a character damaged later is blank too, a healed one is not", () => {
    const { made, done } = vapour();
    expect(done.state.cards[made.hero]?.exhausted).toBe(true);
    expect(done.state.cards[made.hero2]?.exhausted).toBe(false);
    expect(textBlank(done.state, made.hero, made.cards)).toBe(true);
    expect(textBlank(done.state, made.hero2, made.cards)).toBe(false);
    expect(textBlank(updateCard(done.state, made.hero2, { damage: 1 }), made.hero2, made.cards)).toBe(true);
    expect(textBlank(updateCard(done.state, made.hero, { damage: 0 }), made.hero, made.cards)).toBe(false);
  });

  it("143061:A:2 ends with the combat phase: not at the end of the quest phase", () => {
    const { made, done } = vapour();
    expect(textBlank(expireModifiers({ ...done.state, phase: "Quest" }, ["endOfPhase"]), made.hero, made.cards)).toBe(true);
    expect(textBlank(expireModifiers(done.state, ["endOfCombat"]), made.hero, made.cards)).toBe(false);
  });
});

describe("143058:A:2 Plain of Isengard sends archery to allies", () => {
  it("143058:A:2 lets archery damage go to allies only, if there are any, while it is in the staging area", () => {
    const withAlly = at({ staging: ["143058"], play: ["ally"] });
    expect(flagged(withAlly.state, "table", "archeryToAllies")).toBe(true);
    const recipients = archeryRecipients(withAlly.state, withAlly.cards);
    expect(recipients).toEqual([idOf(withAlly.state, "ally")]);
    const heroesOnly = at({ staging: ["143058"] });
    expect(archeryRecipients(heroesOnly.state, heroesOnly.cards)).toEqual([heroesOnly.hero, heroesOnly.hero2]);
    const away = at({ play: ["ally"] });
    expect(archeryRecipients(away.state, away.cards)).toHaveLength(3);
  });
});

describe("143080:B:2 Orthanc explored", () => {
  it("143080:B:2 cancels the progress placed on the quest this phase, the overflow included, and returns to the staging area with no tokens", () => {
    // The Staff is attached, Saruman unhurt: the stage cannot be defeated, so the progress stays on it until Orthanc is explored.
    const made = at({ stage: "143080", active: "143053", staging: ["143047"], attached: [{ code: "143048", to: "143047" }], deck: ["f0", "f0"] });
    const orthanc = idOf(made.state, "143053");
    const stage = idOf(made.state, "143080");
    const steps: EngineStep[] = [];
    const placed = runInstruction(made.state, { verb: "ProgressQuest", amount: 40 }, { seat: 0, sourceId: null }, made.ctx, steps);
    expect(placed.cards[stage]?.progress).toBeGreaterThan(0);
    const done = finish({ state: rest(placed, made.ctx, steps), steps }, made.ctx);
    expect(done.state.cards[stage]?.progress).toBe(0);
    expect(done.state.cards[orthanc]?.zone).toBe("staging");
    expect(done.state.cards[orthanc]?.progress).toBe(0);
    expect(done.state.encounterDiscard).not.toContain(orthanc);
  });
});

describe("143048:A:2 the players cannot win while Saruman has hit points left", () => {
  const gate = (damage: number) => {
    const made = at({ stage: "143080", staging: [{ code: "143047", damage }], attached: [{ code: "143048", to: "143047" }] });
    return restricted(made.state, made.ctx, "advance");
  };

  it("143048:A:2 holds the last stage until Saruman has taken 6 damage, his hit points", () => {
    expect(gate(0).length).toBeGreaterThan(0);
    expect(gate(5).length).toBeGreaterThan(0);
    expect(gate(6)).toEqual([]);
  });

  it("143080:B:3 does not win with the stage full and Saruman unhurt, and wins as soon as he has taken 6 damage; with 6 damage already it wins at once", () => {
    const layout: Layout = { stage: "143080", phase: "Quest", progress: 15, staging: ["143047"], attached: [{ code: "143048", to: "143047" }], deckOf: ["filler", "filler"], hand: ["filler"] };
    const held = at(layout);
    const settled = rest(held.state, held.ctx);
    expect(settled.stageCleared).toBeFalsy();
    const saruman = idOf(settled, "143047");
    expect(rest(updateCard(settled, saruman, { damage: 5 }), held.ctx).stageCleared).toBeFalsy();
    expect(rest(updateCard(settled, saruman, { damage: 6 }), held.ctx).stageCleared).toBe(true);
    const open = at({ ...layout, staging: [{ code: "143047", damage: 6 }] });
    expect(rest(open.state, open.ctx).stageCleared).toBe(true);
  });
});
