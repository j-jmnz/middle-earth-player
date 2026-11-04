// Rules: mec109.hide-tests, mec109.hide-x, rr.attachment-cards, rr.search, rr.discard-pile-and-victory-display, rr.forced,
// rr.quest-advancement, rr.in-play-and-out-of-play (data/rules/entries.json). What the nightmare family adds, run with the real records of
// A Shadow of the Past Nightmare (src/effects/authored/nightmare/a-shadow-of-the-past.ts) on fixture cards under their codes. Each test
// names the ledger line (data/printed/nightmare.json) it is for.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { AUTHORED_EFFECTS } from "../../../effects/authored/nightmare/a-shadow-of-the-past.ts";
import { AUTHORED_EFFECTS as FORD_EFFECTS } from "../../../effects/authored/nightmare/flight-to-the-ford.ts";
import { AUTHORED_EFFECTS as KNIFE_EFFECTS } from "../../../effects/authored/nightmare/a-knife-in-the-dark.ts";

import { syncConstants } from "../../interpret/constants.ts";
import { pushCardEffects, pushEffectFrame } from "../../interpret/effect-frames.ts";
import { byCode, cardMap, expectOk, hero, idleScenario } from "../../core/test-fixture.ts";
import { hideWillpower } from "../../quest/hide.ts";
import type { EngineStep } from "../../core/intents.ts";
import type { ReduceContext } from "../../interpret/interpret.ts";
import { modifiedStat, playerCardEffectCanChoose } from "../../core/keywords.ts";
import { settle } from "../../engine/machine.ts";
import { definePrinted } from "../../core/printed.ts";
import { readyCard } from "../../interpret/player-verbs.ts";
import { reduce } from "../../engine/reduce.ts";
import { doRefresh } from "../../engine/refresh.ts";
import { flagged, updateCard, type ScenarioState } from "../../core/state.ts";
import { spawn } from "../../core/zones.ts";
import { finishSetup } from "../../setup/setup.ts";
import { announceCanceled, cancelNotAllowed, run as runNightmare } from "./index.ts";
import { hideCommitLimit, twinCode } from "./guards.ts";
import { announceStageRevealed } from "./setup.ts";

const SETUP = "906101";
const KHAMUL = "906102";
const HORSEMAN = "906103";
const EASTFARTHING = "906104";
const STOCK_WOODS = "906106";
const MORDOR = "906107";
const FOLLOWED = "906108";

const cards = cardMap([
  definePrinted({ code: SETUP, name: "A Shadow of the Past Nightmare", type: "nightmare" }),
  definePrinted({ code: KHAMUL, name: "Khamûl the Easterling", type: "enemy", traits: ["Nazgûl"], isUnique: true, engagementCost: 40, threat: 3, attack: 4, defense: 3, health: 6, victory: 5 }),
  definePrinted({ code: HORSEMAN, name: "Dark Horseman", type: "enemy", traits: ["Nazgûl"], engagementCost: 30, threat: 2, attack: 3, defense: 2, health: 4 }),
  definePrinted({ code: EASTFARTHING, name: "Eastfarthing", type: "location", threat: 1, questPoints: 3 }),
  definePrinted({ code: STOCK_WOODS, name: "Stock Woods", type: "location", threat: 2, questPoints: 3 }),
  definePrinted({ code: MORDOR, name: "In the Name of Mordor!", type: "treachery" }),
  definePrinted({ code: FOLLOWED, name: "Followed by Shadows", type: "treachery" }),
  definePrinted({ code: "rider", name: "Rider", type: "enemy", threat: 2, engagementCost: 50, attack: 1, defense: 1, health: 3 }),
  definePrinted({ code: "mist", name: "Mist", type: "treachery" }),
  definePrinted({ code: "stage", name: "A Shortcut to Mushrooms", type: "quest", questPoints: 6 }),
  definePrinted({ code: "141024", name: "Escape to Buckland", type: "quest", questPoints: null }),
  definePrinted({ code: "other", name: "Some Other Stage", type: "quest", questPoints: 9 }),
  definePrinted({ code: "card", name: "Card", type: "event", cost: 0 }),
  definePrinted({ code: "141046", name: "Weathertop", type: "location", threat: 3, questPoints: 6, isUnique: true }),
  definePrinted({ code: "906204", name: "Weathertop", type: "location", threat: 3, questPoints: 6, isUnique: true }),
  hero("frodo", "spirit", 8, 2),
  hero("sam", "spirit", 8, 2),
  hero("merry", "tactics", 8, 2),
]);

const ctx: ReduceContext = { effects: AUTHORED_EFFECTS, cards };

function record(id: string): Effect {
  const found = AUTHORED_EFFECTS.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

// One seat with three ready heroes, the quest stage in play and `next` in the quest deck.
function table(next = "141024"): { state: ScenarioState; stageId: string; heroes: string[] } {
  let state: ScenarioState = { ...idleScenario(1), stages: [{ code: "stage" }, { code: next }], firstPlayer: 0 };
  const placed = spawn(state, "stage", { zone: "questStage" });
  state = updateCard(placed.state, placed.id, { face: "B" });
  state = spawn(state, next, { zone: "questDeck" }).state;
  const heroes: string[] = [];
  for (const code of ["frodo", "sam", "merry"]) {
    const made = spawn(state, code, { zone: "heroes", seat: 0 });
    state = made.state;
    heroes.push(made.id);
  }
  return { state, stageId: placed.id, heroes };
}

function put(state: ScenarioState, code: string, dest: Parameters<typeof spawn>[2]): { state: ScenarioState; id: string } {
  return spawn(state, code, dest);
}

function run(state: ScenarioState, frame: "whenRevealed" | "forced", sourceId: string, effects: readonly Effect[], steps: EngineStep[] = []): ScenarioState {
  return settle(pushCardEffects(state, frame, sourceId, 0, false, effects, ctx, steps), ctx, steps);
}

// Answers a Hide test's commit window with these characters, then passes the action window after the discards.
function hide(state: ScenarioState, cardIds: readonly string[], steps: EngineStep[] = []): ScenarioState {
  expect(state.window).toEqual({ kind: "hideCommit", seat: 0 });
  const committed = expectOk(reduce(state, { type: "CommitHide", cardIds }, ctx));
  steps.push(...committed.steps);
  const passed = expectOk(reduce(committed.state, { type: "Pass" }, ctx));
  steps.push(...passed.steps);
  return passed.state;
}

function deck(state: ScenarioState, codes: readonly string[]): ScenarioState {
  let next = state;
  for (const code of codes) next = put(next, code, { zone: "encounterDeck" }).state;
  return next;
}

describe("the setup card next to the quest deck (zone nightmare) hears the stage reveal (906101:A:2, rr.in-play-and-out-of-play)", () => {
  it("adds Khamûl from the victory display to the staging area when stage 3A (Escape to Buckland) is revealed", () => {
    const { state: base, stageId } = table();
    let state = put(base, SETUP, { zone: "nightmare" }).state;
    state = put(state, KHAMUL, { zone: "victory" }).state;
    state = deck(state, ["mist", "mist"]);
    const steps: EngineStep[] = [];
    // A full stage advances as soon as nothing holds it (advanceFreed, rules/quest/stage-reveal.ts).
    const advanced = settle(updateCard(state, stageId, { progress: 6 }), ctx, steps);
    expect(advanced.cards[advanced.questStage ?? ""]?.code).toBe("141024");
    const khamul = byCode(advanced, KHAMUL)[0] ?? "";
    expect(advanced.cards[khamul]?.zone).toBe("staging");
    expect(advanced.victory).toEqual([]);
    expect(steps.some((step) => step.kind === "push" && step.frame === "forced")).toBe(true);
  });

  it("searches the encounter deck first, and does nothing while Khamûl is in play or on another stage", () => {
    const { state: base, stageId } = table();
    let state = put(base, SETUP, { zone: "nightmare" }).state;
    state = deck(state, ["mist", KHAMUL, "mist"]);
    const found = settle(updateCard(state, stageId, { progress: 6 }), ctx, []);
    expect(found.cards[byCode(found, KHAMUL)[0] ?? ""]?.zone).toBe("staging");
    expect(found.encounterDeck).toHaveLength(2);

    const engaged = put(put(base, SETUP, { zone: "nightmare" }).state, KHAMUL, { zone: "engaged", seat: 0 }).state;
    const stayed = settle(updateCard(deck(engaged, [KHAMUL]), stageId, { progress: 6 }), ctx, []);
    expect(stayed.staging).toEqual([]);

    const other = table("other");
    const elsewhere = put(put(other.state, SETUP, { zone: "nightmare" }).state, KHAMUL, { zone: "victory" }).state;
    const passed = settle(updateCard(elsewhere, other.stageId, { progress: 6 }), ctx, []);
    expect(passed.cards[passed.questStage ?? ""]?.code).toBe("other");
    expect(passed.victory).toHaveLength(1);
  });

  it("is not heard without the setup card: Normal places none", () => {
    const { state: base, stageId } = table();
    const state = put(base, KHAMUL, { zone: "victory" }).state;
    const steps: EngineStep[] = [];
    const advanced = settle(updateCard(state, stageId, { progress: 6 }), ctx, steps);
    expect(advanced.victory).toHaveLength(1);
    // With no listener in play the stage reveal is not announced at all: no Forced frame goes down for it.
    expect(steps.some((step) => step.kind === "push" && step.frame === "forced")).toBe(false);
    expect(announceStageRevealed(state, stageId, ctx, [])).toBe(state);
  });
});

describe("the result of an effect's own Hide test (lastHideFailed; 906108:A:1, 906102:A:3, mec109.hide-tests)", () => {
  it("raises the threat of a player who fails Followed by Shadows' Hide 2 test by 5, and of one who passes not at all", () => {
    const { state: base } = table();
    const failing = put(deck(base, ["rider", "rider"]), FOLLOWED, { zone: "staging" });
    const failed = hide(run(failing.state, "whenRevealed", failing.id, [record("906108:whenRevealed:1")]), []);
    expect(failed.seats[0]?.threat).toBe((base.seats[0]?.threat ?? 0) + 5);

    const passing = put(deck(base, ["mist", "mist"]), FOLLOWED, { zone: "staging" });
    const passed = hide(run(passing.state, "whenRevealed", passing.id, [record("906108:whenRevealed:1")]), []);
    expect(passed.seats[0]?.threat).toBe(base.seats[0]?.threat);
  });

  it("reads this test, not an earlier failure in the same phase", () => {
    const { state: base } = table();
    const earlier = { ...base, hideFailures: [{ seat: 0, round: base.round, phase: base.phase }] };
    const passing = put(deck(earlier, ["mist", "mist"]), FOLLOWED, { zone: "staging" });
    const passed = hide(run(passing.state, "whenRevealed", passing.id, [record("906108:whenRevealed:1")]), []);
    expect(passed.seats[0]?.threat).toBe(base.seats[0]?.threat);
  });

  it("has Khamûl attack the engaged player who fails his Hide 2 test at the beginning of the refresh phase", () => {
    const { state: base } = table();
    const khamul = put(deck({ ...base, phase: "Refresh" }, ["rider", "rider"]), KHAMUL, { zone: "engaged", seat: 0 });
    const tested = run(khamul.state, "forced", khamul.id, [record("906102:forced:1")]);
    const failed = hide(tested, []);
    expect(failed.pendingAttack?.enemyId).toBe(khamul.id);

    const calm = put(deck({ ...base, phase: "Refresh" }, ["mist", "mist"]), KHAMUL, { zone: "engaged", seat: 0 });
    const passed = hide(run(calm.state, "forced", calm.id, [record("906102:forced:1")]), []);
    expect(passed.pendingAttack).toBeNull();
  });
});

describe("constants of the Nightmare deck on Hide tests (906103:A:3, 906105:A:1, 906106:A:1, mec109.hide-x)", () => {
  it("caps the characters committed to a Hide test while Stock Woods is in the staging area", () => {
    const { state: base, heroes } = table();
    const woods = syncConstants(put(deck(base, ["mist", "mist"]), STOCK_WOODS, { zone: "staging" }).state, ctx);
    expect(hideCommitLimit(woods)).toBe(2);
    const followed = put(woods, FOLLOWED, { zone: "staging" });
    const asked = run(followed.state, "whenRevealed", followed.id, [record("906108:whenRevealed:1")]);
    const refused = reduce(asked, { type: "CommitHide", cardIds: heroes }, ctx);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toMatch(/No more than 2/);
    expect(reduce(asked, { type: "CommitHide", cardIds: heroes.slice(0, 2) }, ctx).ok).toBe(true);
    expect(hideCommitLimit(base)).toBeNull();
  });

  it("takes 1 Willpower from each character the engaged player commits while Dark Horseman is engaged with them", () => {
    const { state: base, heroes } = table();
    const plain = hideWillpower(base, 0, heroes, ctx);
    const engaged = syncConstants(put(base, HORSEMAN, { zone: "engaged", seat: 0 }).state, ctx);
    expect(hideWillpower(engaged, 0, heroes, ctx)).toBe(plain - heroes.length);
    const staged = syncConstants(put(base, HORSEMAN, { zone: "staging" }).state, ctx);
    expect(hideWillpower(staged, 0, heroes, ctx)).toBe(plain);
  });

  it("adds 1 to each Hide X while Green-Hill Country is in the staging area", () => {
    const greenHill = definePrinted({ code: "906105", name: "Green-Hill Country", type: "location", threat: 1, questPoints: 3 });
    const local: ReduceContext = { effects: AUTHORED_EFFECTS, cards: new Map([...cards, ["906105", greenHill]]) };
    const { state: base } = table();
    const staged = syncConstants(spawn(deck(base, ["mist", "mist", "mist", "mist"]), "906105", { zone: "staging" }).state, local);
    const followed = spawn(staged, FOLLOWED, { zone: "staging" });
    const asked = settle(pushCardEffects(followed.state, "whenRevealed", followed.id, 0, false, [record("906108:whenRevealed:1")], local, []), local, []);
    const committed = expectOk(reduce(asked, { type: "CommitHide", cardIds: [] }, local)).state;
    // Hide 2 + 1: three cards discarded.
    expect(committed.encounterDiscard).toHaveLength(3);
  });
});

describe("cards that answer a failed Hide test (906104:A:1, 906104:A:2, 906107:A:2, rr.attachment-cards)", () => {
  it("puts a token on Eastfarthing for each failed test, and each token gives it +2 Threat", () => {
    const { state: base } = table();
    const farthing = put(deck(base, ["rider", "rider"]), EASTFARTHING, { zone: "staging" });
    const followed = put(farthing.state, FOLLOWED, { zone: "staging" });
    const failed = syncConstants(hide(run(followed.state, "whenRevealed", followed.id, [record("906108:whenRevealed:1")]), []), ctx);
    const card = failed.cards[farthing.id];
    expect(card?.resources).toBe(1);
    expect(card ? modifiedStat(failed, card, "threat", cards) : 0).toBe(3);
  });

  it("attaches In the Name of Mordor! to the current quest, where a failed test discards a random card from that player's hand", () => {
    const { state: base, stageId } = table();
    let state = deck(base, ["rider", "rider"]);
    for (let count = 0; count < 3; count += 1) state = put(state, "card", { zone: "hand", seat: 0 }).state;
    const mordor = put(state, MORDOR, { zone: "staging" });
    const attached = run(mordor.state, "whenRevealed", mordor.id, [record("906107:whenRevealed:1")]);
    expect(attached.cards[mordor.id]?.host).toBe(stageId);
    expect(attached.cards[stageId]?.attachments).toContain(mordor.id);
    const followed = put(attached, FOLLOWED, { zone: "staging" });
    const failed = hide(run(followed.state, "whenRevealed", followed.id, [record("906108:whenRevealed:1")]), []);
    expect(failed.seats[0]?.hand).toHaveLength(2);
  });
});

describe("a card the recipe replaced, named by code (docs/plans/nightmare-mode.md; rr.setup)", () => {
  const add: Effect = { id: "stage:whenRevealed:9", cardCode: "stage", lines: ["fixture:A:1"], timing: "whenRevealed", instructions: [{ verb: "AddSetAsideToStaging", code: "141046" }] };

  it("is the Nightmare card of its title on Nightmare: Add Weathertop to the staging area finds Nightmare Weathertop", () => {
    const { state: base, stageId } = table();
    const nightmare = put(put(base, SETUP, { zone: "nightmare" }).state, "906204", { zone: "setAside" }, ).state;
    expect(twinCode(nightmare, "141046", cards)).toBe("906204");
    const added = run(nightmare, "whenRevealed", stageId, [add]);
    expect(added.staging.map((id) => added.cards[id]?.code)).toEqual(["906204"]);
    // Read in a condition too ("while Weathertop is in play").
    expect(added.cards[added.staging[0] ?? ""]?.zone).toBe("staging");
  });

  it("is itself off Nightmare and when the named card was dealt", () => {
    const { state: base } = table();
    const normal = put(base, "906204", { zone: "setAside" }).state;
    expect(twinCode(normal, "141046", cards)).toBe("141046");
    const both = put(put(put(base, SETUP, { zone: "nightmare" }).state, "906204", { zone: "setAside" }).state, "141046", { zone: "setAside" }).state;
    expect(twinCode(both, "141046", cards)).toBe("141046");
  });
});

describe("the setup card's own Setup lines (906401:A:2; mec109.setup)", () => {
  it("run during Setup, before the quest's Setup, from the card next to the quest deck", () => {
    const setAside: Effect = { id: `${SETUP}:setup:9`, cardCode: SETUP, lines: ["fixture:A:1"], timing: "setup", instructions: [{ verb: "SetAside", code: "rider" }] };
    const local: ReduceContext = { effects: [...AUTHORED_EFFECTS, setAside], cards };
    const { state: base } = table();
    const placed = put(base, SETUP, { zone: "nightmare" });
    const done = finishSetup({ ...placed.state, phase: "Setup", setup: [] }, local, []);
    expect(done.setAside.map((id) => done.cards[id]?.code)).toEqual(["rider"]);
    expect(done.cards[placed.id]?.zone).toBe("nightmare");
    expect(finishSetup({ ...base, phase: "Setup", setup: [] }, local, []).setAside).toEqual([]);
  });
});

describe("A Knife in the Dark Nightmare's vocabulary (906201:A:2, 906203:A:1, 906208:A:1, 906209:A:2)", () => {
  const knife = new Map(KNIFE_EFFECTS.map((effect) => [effect.id, effect]));
  const knifeRecord = (id: string): Effect => {
    const found = knife.get(id);
    if (!found) throw new Error(`No record ${id}`);
    return found;
  };
  const knifeCards = cardMap([
    ...cards.values(),
    definePrinted({ code: "906201", name: "A Knife in the Dark Nightmare", type: "nightmare" }),
    definePrinted({ code: "141051", name: "Bill Ferny", type: "enemy", traits: ["Spy"], engagementCost: 50, threat: 2, attack: 2, defense: 2, health: 3 }),
    definePrinted({ code: "906203", name: "Southern Spy", type: "enemy", traits: ["Spy"], engagementCost: 30, threat: 3, attack: 4, defense: 2, health: 4 }),
    definePrinted({ code: "906208", name: "The Ring's Will", type: "treachery" }),
    definePrinted({ code: "906209", name: "Blade Tip", type: "treachery" }),
    definePrinted({ code: "ringbearer", name: "Frodo", type: "hero", traits: ["Hobbit", "Ring-bearer"], threat: 7, willpower: 2, attack: 1, defense: 2, health: 2 }),
    definePrinted({ code: "141085", name: "The One Ring", type: "attachment", cost: 0 }),
  ]);
  const knifeCtx: ReduceContext = { effects: KNIFE_EFFECTS, cards: knifeCards };

  it("makes Bill Ferny immune to player card effects while he is in the staging area", () => {
    const { state: base } = table();
    const setup = spawn(base, "906201", { zone: "nightmare" }).state;
    const staged = spawn(setup, "141051", { zone: "staging" });
    const synced = syncConstants(staged.state, knifeCtx);
    expect(flagged(synced, staged.id, "immuneToPlayerCards")).toBe(true);
    expect(playerCardEffectCanChoose(knifeCards.get("141051")!, synced, staged.id)).toBe(false);
    const engaged = syncConstants(spawn(setup, "141051", { zone: "engaged", seat: 0 }).state, knifeCtx);
    const bill = byCode(engaged, "141051")[0] ?? "";
    expect(playerCardEffectCanChoose(knifeCards.get("141051")!, engaged, bill)).toBe(true);
  });

  it("exhausts The One Ring when Weathertop becomes the active location, and no effect readies it while Weathertop is in play (906204:A:3, cannotReady)", () => {
    const { state: base } = table();
    const ring = spawn(base, "141085", { zone: "play", seat: 0 });
    const top = spawn(ring.state, "906204", { zone: "activeLocation" });
    const barred = settle(pushCardEffects(top.state, "forced", top.id, 0, false, [knifeRecord("906204:forced:1")], knifeCtx, []), knifeCtx, []);
    expect(barred.cards[ring.id]?.exhausted).toBe(true);
    // A card effect cannot ready it ("cannot ready"), nor can the refresh phase.
    expect(readyCard(barred, ring.id).cards[ring.id]?.exhausted).toBe(true);
    expect(doRefresh(barred, knifeCtx, []).cards[ring.id]?.exhausted).toBe(true);
  });

  it("has Southern Spy attack the revealing player from the staging area when no Ringwraith is out of play", () => {
    const { state: base } = table();
    const spy = spawn(deck(base, ["mist"]), "906203", { zone: "staging" });
    const attacked = settle(pushCardEffects(spy.state, "whenRevealed", spy.id, 0, false, [knifeRecord("906203:whenRevealed:1")], knifeCtx, []), knifeCtx, []);
    expect(attacked.pendingAttack).toMatchObject({ enemyId: spy.id, seat: 0, immediate: true });
  });

  it("does not offer the Ring-bearer's cancel against The Ring's Will, and does offer another hero's", () => {
    const { state: base, heroes } = table();
    const frodo = spawn(base, "ringbearer", { zone: "heroes", seat: 0 });
    const will = spawn(frodo.state, "906208", { zone: "staging" });
    const cancel: Effect = { id: "x:response:1", cardCode: "x", lines: ["fixture:A:1"], timing: "response", trigger: "encounterRevealed", instructions: [{ verb: "CancelEffect" }] };
    const event = { trigger: "encounterRevealed" as const, seat: 0, subject: will.id };
    expect(cancelNotAllowed(will.state, { cardId: frodo.id, effectId: cancel.id, seat: 0, event }, cancel, knifeCtx)).toBe(true);
    expect(cancelNotAllowed(will.state, { cardId: heroes[0] ?? "", effectId: cancel.id, seat: 0, event }, cancel, knifeCtx)).toBe(false);
  });

  it("attaches Blade Tip to the defending character once the attack has damaged it, and not otherwise", () => {
    const { state: base, heroes } = table();
    const defender = heroes[0] ?? "";
    const enemy = spawn(base, "rider", { zone: "engaged", seat: 0 });
    const tip = spawn(enemy.state, "906209", { zone: "shadow", enemyId: enemy.id });
    const attacking = { ...tip.state, pendingAttack: { enemyId: enemy.id, seat: 0, defenderId: defender } };
    const left = runNightmare(attacking, { verb: "AttachToDamagedDefender" }, { seat: 0, sourceId: tip.id }, knifeCtx, []);
    const after = left?.pendingAttack?.after ?? [];
    expect(after).toEqual([{ verb: "AttachToDamagedDefender", card: tip.id, to: defender, dealt: true }]);
    const ended = { ...left!, pendingAttack: null };
    const atEnd = (dealt: number) => settle(pushEffectFrame(ended, { frame: "shadow", sourceId: enemy.id, actor: 0, peril: false, effectId: "end", instructions: after, cancel: null, blockCancel: null, dealt }, []), knifeCtx, []);
    const hit = atEnd(2);
    expect(hit.cards[tip.id]?.host).toBe(defender);
    expect(hit.cards[enemy.id]?.shadowId).toBeNull();
    expect(atEnd(0).cards[tip.id]?.zone).toBe("shadow");
  });
});

describe("Flight to the Ford Nightmare's vocabulary (906301:A:2, 906304:A:1; rr.cancel, rr.winning-the-game)", () => {
  const fordCards = cardMap([
    ...cards.values(),
    definePrinted({ code: "906301", name: "Flight to the Ford Nightmare", type: "nightmare" }),
    definePrinted({ code: "906303", name: "Ford of Bruinen", type: "location", threat: 3, questPoints: 3, isUnique: true }),
    definePrinted({ code: "906304", name: "Trollshaw Forest", type: "location", threat: 3, questPoints: 4 }),
    definePrinted({ code: "141029", name: "Race to Rivendell", type: "quest", questPoints: 6 }),
  ]);
  const fordCtx: ReduceContext = { effects: FORD_EFFECTS, cards: fordCards };

  it("announces a canceled when revealed effect, and Trollshaw Forest in the staging area reduces the Ring-bearer's life", () => {
    const { state: base } = table();
    const forest = spawn({ ...base, life: 10 }, "906304", { zone: "staging" }).state;
    const canceled = { ...forest, round: forest.round };
    const announced = announceCanceled({ ...canceled }, forest, fordCtx);
    expect(announced.pendingEvents?.at(-1)).toMatchObject({ trigger: "whenRevealedCanceled" });
    expect(announceCanceled(forest, forest, fordCtx)).toBe(forest);
    const resolved = settle(announced, fordCtx, []);
    expect(resolved.life).toBe(9);
  });

  it("announces nothing while no card that listens for a canceled when revealed effect is in play", () => {
    const { state: base } = table();
    const discarded = spawn({ ...base, life: 10 }, "906304", { zone: "encounterDiscard" }).state;
    const changed = { ...discarded, round: discarded.round };
    expect(announceCanceled(changed, discarded, fordCtx)).toBe(changed);
  });

  it("holds the last stage back while Ford of Bruinen is in play: the players cannot win (the setup card's constant, zone nightmare)", () => {
    let state: ScenarioState = { ...idleScenario(1), stages: [{ code: "141029" }] };
    const placed = spawn(state, "141029", { zone: "questStage" });
    state = updateCard(spawn(placed.state, "906301", { zone: "nightmare" }).state, placed.id, { face: "B", progress: 6 });
    const held = settle(spawn(state, "906303", { zone: "staging" }).state, fordCtx, []);
    expect(held.stageCleared).toBe(false);
    expect(settle(state, fordCtx, []).stageCleared).toBe(true);
  });
});

describe("The Ring Goes South Nightmare's vocabulary (906401:A:2, 906407:A:2; rr.engaged, rr.first-player)", () => {
  it("picks the enemy in the staging area with the lowest engagement cost, which the actor then engages", () => {
    const { state: base } = table();
    const far = spawn(base, "rider", { zone: "staging" });
    const near = spawn(far.state, HORSEMAN, { zone: "staging" });
    const engaged = settle(pushEffectFrame(near.state, { frame: "whenRevealed", sourceId: null, actor: 0, peril: false, effectId: "hunted", instructions: [{ verb: "PickLowestEngagement" }, { verb: "Engage", target: "picked" }], cancel: null, blockCancel: null }, []), ctx, []);
    expect(engaged.cards[near.id]?.zone).toBe("engaged");
    expect(engaged.cards[far.id]?.zone).toBe("staging");
  });

  it("sets every copy in the encounter deck and its discard pile aside, facedown", () => {
    const { state: base } = table();
    let state = deck(base, ["rider", "mist", "rider"]);
    state = spawn(state, "rider", { zone: "encounterDiscard" }).state;
    const set = runNightmare(state, { verb: "SetAsideFromDeck", code: "rider" }, { seat: 0, sourceId: null }, ctx, []);
    expect(set?.setAside.map((id) => set.cards[id]?.code)).toEqual(["rider", "rider", "rider"]);
    expect(set?.encounterDeck.map((id) => set.cards[id]?.code)).toEqual(["mist"]);
  });
});
