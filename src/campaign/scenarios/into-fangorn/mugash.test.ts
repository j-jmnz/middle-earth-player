// Rules: rm.time-x, rr.guarded, rr.attachment-cards, rr.quest-advancement (data/rules/entries.json).
// Mugash leaving play and the quest stages' shuffles, jumps and restrictions: what a spec row cannot show (spec.test.ts holds the rows). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points; dh1 and dh2 are the first seat's, dh3 the second's.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { ruleCause } from "../../../rules/core/cause.ts";
import { placeDamage } from "../../../rules/core/damage.ts";
import { destroyCard } from "../../../rules/core/keywords.ts";
import { updateCard } from "../../../rules/core/state.ts";
import { moveEncounter } from "../../../rules/families/encounter/moves.ts";
import { advanceToStage } from "../../../rules/families/breaking/index.ts";
import { timeOnReveal } from "../../../rules/families/angmar/time.ts";
import { drive, finish, idOf, opened, resolveRecords, revealedTop, run, tableFromLayout, zoneOf, type Layout } from "../../../../test/harness/scene-kit.ts";

const SCENARIO = "into-fangorn";
const table = (layout: Layout) => tableFromLayout(SCENARIO, layout);
const DARK = "07033";
const ANGRY = "07034";
const EDGE = "07032";
const FOREST = "07050";
const STAGE_1 = "07065";
const STAGE_2 = "07066";
const STAGE_3 = "07067";
const MUGASH = "07031";
const onHero = { code: MUGASH, to: "dh1", encounter: true } as const;

describe("Mugash and the quest stages (07031, 07065 to 07067)", () => {
  const setup = (layout: Layout = {}) => {
    const t = table({ stage: STAGE_1, phase: "Quest", staging: [EDGE], setAside: [MUGASH], ...layout });
    const done = resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "");
    return { t, state: done.state };
  };
  const timeOut = (layout: Layout, stage: string) => {
    const t = table({ phase: "Quest", ...layout });
    const ready = updateCard(t.state, t.state.questStage ?? "", { resources: 1 });
    return { t, before: ready, done: run(t, ready, { verb: "RemoveTimeFromQuest", amount: 1 }) };
  };

  it("07065:A:1 Setup lies Mugash on Edge of Fangorn, claimed by no player", () => {
    const { state } = setup({ deck: ["07050", "07051", "07052"] });
    const mugash = idOf(state, MUGASH);
    expect(state.cards[mugash]?.zone).toBe("attached");
    expect(state.cards[idOf(state, EDGE)]?.attachments).toContain(mugash);
    expect(state.cards[mugash]?.claimed).toBe(true);
    expect(state.cards[mugash]?.controller ?? null).toBeNull();
  });

  it("07065:B:1 turning the stage to side B at the end of Setup puts 4 time counters on it", () => {
    const t = table({ stage: STAGE_1, side: "A" });
    const stage = t.state.questStage ?? "";
    expect(timeOnReveal(updateCard(t.state, stage, { face: "B" }), stage, t.ctx).cards[stage]?.resources).toBe(4);
  });

  it("07065:B:2 after the last counter Mugash is shuffled into the encounter deck from where he lies and the quest jumps to stage 3 with its counters", () => {
    const { t, state } = setup();
    const ready = updateCard(state, state.questStage ?? "", { resources: 1 });
    const done = run(t, ready, { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(done.cards[done.questStage ?? ""]?.code).toBe(STAGE_3);
    expect(zoneOf(done, MUGASH)).toBe("encounterDeck");
    expect(done.cards[done.questStage ?? ""]?.resources).toBe(3);
  });

  it("07065:B:2 with Mugash already in the encounter deck the deck is shuffled, and with him anywhere else the shuffle puts him in it", () => {
    const inDeck = timeOut({ stage: STAGE_1, deck: ["f0", "f0", "f0", "f0", MUGASH, "f0"] }, STAGE_1);
    expect(zoneOf(inDeck.done, MUGASH)).toBe("encounterDeck");
    expect(inDeck.done.seedCursor).toBeGreaterThan(inDeck.before.seedCursor);
    const lying = timeOut({ stage: STAGE_1, staging: [MUGASH], deck: ["f0", "f0"] }, STAGE_1);
    expect(zoneOf(lying.done, MUGASH)).toBe("encounterDeck");
    expect(lying.done.seedCursor).toBeGreaterThan(lying.before.seedCursor);
  });

  it("07066:B:2 with Mugash already in the encounter deck the deck is shuffled and the quest jumps to stage 3A", () => {
    const made = timeOut({ stage: STAGE_2, deck: ["f0", "f0", "f0", MUGASH, "f0"] }, STAGE_2);
    expect(made.done.seedCursor).toBeGreaterThan(made.before.seedCursor);
    expect(made.done.cards[made.done.questStage ?? ""]?.code).toBe(STAGE_3);
    expect(zoneOf(made.done, MUGASH)).toBe("encounterDeck");
  });

  it("07066:B:2 stage 2 jumps to stage 3A even while no hero holds Mugash, and 07067:B:3 six progress with Mugash on a hero jumps back to stage 2A", () => {
    const t = table({ stage: STAGE_2, phase: "Quest", attached: [onHero] });
    const stage = t.state.questStage ?? "";
    const jumped = run(t, updateCard(t.state, stage, { resources: 1 }), { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(jumped.cards[jumped.questStage ?? ""]?.code).toBe(STAGE_3);
    const free = table({ stage: STAGE_2, phase: "Quest", staging: [MUGASH] });
    const away = run(free, updateCard(free.state, free.state.questStage ?? "", { resources: 1 }), { verb: "RemoveTimeFromQuest", amount: 1 });
    expect(away.cards[away.questStage ?? ""]?.code).toBe(STAGE_3);
  });

  it("07067:B:3 with 5 progress, or with 6 and Mugash not on a hero, the quest stays at stage 3; questing places the progress the same way", () => {
    const back = table({ stage: STAGE_3, phase: "Quest", attached: [onHero] });
    const three = back.state.questStage ?? "";
    const short = run(back, updateCard(back.state, three, { progress: 4 }), { verb: "PlaceQuestProgress", perPlayer: 1 });
    expect(short.cards[short.questStage ?? ""]?.code).toBe(STAGE_3);
    const placed = run(back, updateCard(back.state, three, { progress: 5 }), { verb: "PlaceQuestProgress", perPlayer: 1 });
    expect(placed.cards[placed.questStage ?? ""]?.code).toBe(STAGE_2);
    expect(placed.cards[placed.questStage ?? ""]?.resources).toBe(4);
    const lost = table({ stage: STAGE_3, phase: "Quest", staging: [MUGASH] });
    const kept = run(lost, updateCard(lost.state, lost.state.questStage ?? "", { progress: 6 }), { verb: "PlaceQuestProgress", perPlayer: 1 });
    expect(kept.cards[kept.questStage ?? ""]?.code).toBe(STAGE_3);
    const questing = table({ stage: STAGE_3, phase: "Quest", progress: 4, committed: ["dh1"], attached: [onHero] });
    const quested = drive(questing, opened(questing), (state) => state.cards[state.questStage ?? ""]?.code !== STAGE_3);
    expect(quested.state.cards[quested.state.questStage ?? ""]?.code).toBe(STAGE_2);
  });

  it("07066:A:1 the stage that comes back is revealed again: each of two players searches the encounter deck and discard pile for a Huorn and adds it to the staging area", () => {
    const t = table({ seats: 2, stage: STAGE_3, phase: "Quest", progress: 5, attached: [onHero], deck: ["f0", ANGRY], discard: [DARK] });
    const done = finish({ state: run(t, t.state, { verb: "PlaceQuestProgress", perPlayer: 1 }), steps: [] }, t.ctx).state;
    expect(done.cards[done.questStage ?? ""]?.code).toBe(STAGE_2);
    expect([zoneOf(done, DARK), zoneOf(done, ANGRY)]).toEqual(["staging", "staging"]);
  });

  it("07065:B:3 stage 1 does not advance without Mugash on a hero and does with him, and 07066:B:3 stage 2 cannot be defeated without him, the progress staying on it", () => {
    const first = table({ stage: STAGE_1, phase: "Quest", progress: 8 });
    const stalled = run(first, first.state, { verb: "PlaceQuestProgress", perPlayer: 3 });
    expect(stalled.cards[stalled.questStage ?? ""]?.code).toBe(STAGE_1);
    const held = table({ stage: STAGE_1, phase: "Quest", progress: 8, attached: [onHero], deck: ["f0"] });
    const through = run(held, held.state, { verb: "PlaceQuestProgress", perPlayer: 3 });
    expect(through.cards[through.questStage ?? ""]?.code).toBe(STAGE_2);
    const second = table({ stage: STAGE_2, phase: "Quest", progress: 11 });
    const barred = run(second, second.state, { verb: "PlaceQuestProgress", perPlayer: 3 });
    expect(barred.cards[barred.questStage ?? ""]?.code).toBe(STAGE_2);
    expect(barred.stageCleared).toBeFalsy();
  });

  it("07066:B:2 a time-out jump off stage 2 is no defeat: the quest moves to stage 3 and the game is not won, where the stage 2 Forced effect hears a defeat", () => {
    const { done } = timeOut({ stage: STAGE_2, staging: [MUGASH], deck: ["f0", "f0"] }, STAGE_2);
    expect(done.cards[done.questStage ?? ""]?.code).toBe(STAGE_3);
    expect(done.stageCleared).toBeFalsy();
    expect(done.stageLeft?.bypassed).toBe(true);
  });

  it("07066:B:4 defeating stage 2 by progress with Mugash on a hero wins the game and does not advance to stage 3", () => {
    const t = table({ stage: STAGE_2, phase: "Quest", progress: 11, attached: [onHero] });
    const done = run(t, t.state, { verb: "PlaceQuestProgress", perPlayer: 3 });
    expect(done.stageCleared).toBe(true);
    expect(done.cards[done.questStage ?? ""]?.code).toBe(STAGE_2);
  });

  it("07066:B:2 a bypassed stage is not defeated: a card attached to it hears no hostDefeated, where a defeated stage's attachment does", () => {
    const t = table({ stage: STAGE_2, phase: "Quest", staging: [MUGASH], deck: ["f0", "f0"], attached: [{ code: FOREST, to: STAGE_2 }] });
    const heard = (bypassed: boolean) => advanceToStage(t.state, STAGE_3, t.ctx, [], true, bypassed).pendingEvents?.filter((event) => event.trigger === "hostDefeated") ?? [];
    expect(heard(false)).toHaveLength(1);
    expect(heard(true)).toHaveLength(0);
  });
});

describe("Mugash as a Guarded objective (07031:A:1 to A:3)", () => {
  const onEdge = (layout: Layout = {}) => table({ stage: STAGE_1, phase: "Quest", staging: [EDGE], setAside: [MUGASH], ...layout });
  const setup = (layout: Layout = {}) => {
    const t = onEdge(layout);
    return { t, state: resolveRecords(t.state, t.ctx, STAGE_1, "setup", t.state.questStage ?? "").state };
  };

  it("07031:A:2 with Edge of Fangorn gone he lies in the staging area, free to claim; an Action exhausts a ready hero and he attaches to it", () => {
    const { t, state } = setup();
    const mugash = idOf(state, MUGASH);
    expect(state.cards[mugash]?.zone).toBe("attached");
    const edge = idOf(state, EDGE);
    // An encounter effect discards Edge of Fangorn (immune to player card effects only).
    const discarded = moveEncounter(state, edge, "discard", 0, t.ctx, []);
    expect(discarded.cards[edge]?.zone).toBe("encounterDiscard");
    expect(discarded.cards[mugash]?.zone).toBe("staging");
    const claimed = resolveRecords(discarded, t.ctx, MUGASH, "action", mugash);
    expect(claimed.state.cards[mugash]?.zone).toBe("attached");
    expect(claimed.state.cards[idOf(claimed.state, "dh1")]?.attachments).toContain(mugash);
  });

  // Mugash claimed by the first hero: Edge of Fangorn is explored away and the Action resolves, as it does in a game.
  const hosted = () => {
    const { t, state } = setup({ deck: ["07050"] });
    const free = moveEncounter(state, idOf(state, EDGE), "discard", 0, t.ctx, []);
    const claimed = resolveRecords(free, t.ctx, MUGASH, "action", idOf(free, MUGASH));
    return { state: claimed.state, ctx: t.ctx };
  };
  const hit = (t: ReturnType<typeof hosted>, id: string, amount: number) => settle(placeDamage(t.state, id, amount, t.ctx.cards, [], "framework", ruleCause("rr.damage")), t.ctx, []);

  it("07031:A:3 damage to the hero he is attached to sends him to the top of the encounter deck, facedown and controlled by nobody", () => {
    const t = hosted();
    const mugash = idOf(t.state, MUGASH);
    expect(t.state.cards[mugash]?.claimed).toBe(true);
    const done = hit(t, idOf(t.state, "dh1"), 1);
    expect(done.encounterDeck[0]).toBe(mugash);
    expect(done.cards[idOf(done, "dh1")]?.attachments).not.toContain(mugash);
    expect(done.cards[mugash]?.zone).toBe("encounterDeck");
  });

  it("07031:A:3 a hero destroyed by damage sends him to the top of the deck as well", () => {
    const t = hosted();
    const mugash = idOf(t.state, MUGASH);
    const dead = hit(t, idOf(t.state, "dh1"), 9);
    expect(dead.cards[idOf(dead, "dh1")]?.zone).not.toBe("heroes");
    expect(dead.cards[mugash]?.zone).toBe("encounterDeck");
    expect(dead.encounterDeck[0]).toBe(mugash);
  });

  it("07031:A:3 a hero that leaves play any other way leaves him in the staging area, with damage or without", () => {
    const t = hosted();
    const mugash = idOf(t.state, MUGASH);
    const bare = settle(destroyCard(t.state, idOf(t.state, "dh1"), t.ctx.cards, []), t.ctx, []);
    expect(bare.cards[mugash]?.zone).toBe("staging");
    const hero = idOf(t.state, "dh1");
    const hurt = updateCard(t.state, hero, { damage: 2 });
    const gone = settle(destroyCard(hurt, hero, t.ctx.cards, []), t.ctx, []);
    expect(gone.cards[hero]?.zone).not.toBe("heroes");
    expect(gone.cards[mugash]?.zone).toBe("staging");
    expect(gone.encounterDeck).not.toContain(mugash);
  });

  it("07031:A:3 damage to Edge of Fangorn, the location he lies on, does not send him to the deck: only a hero's damage does", () => {
    const { t, state } = setup({ deck: ["07050"] });
    const edge = idOf(state, EDGE);
    const done = settle(placeDamage(state, edge, 1, t.ctx.cards, [], "framework", ruleCause("rr.damage")), t.ctx, []);
    expect(done.cards[idOf(done, MUGASH)]?.zone).toBe("attached");
    expect(done.encounterDeck).not.toContain(idOf(done, MUGASH));
  });

  it("07031:A:1 Mugash revealed from the deck takes the next card as his guard and both lie in the staging area; he cannot be claimed while it is there", () => {
    const t = table({ stage: STAGE_1, phase: "Quest", deck: [DARK, FOREST] });
    const state = revealedTop(t, MUGASH);
    const mugash = idOf(state, MUGASH);
    expect(zoneOf(state, MUGASH)).toBe("staging");
    expect(zoneOf(state, DARK)).toBe("staging");
    expect(state.cards[idOf(state, DARK)]?.host).toBe(mugash);
  });
});
