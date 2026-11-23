// Rules: hob.venom-poison, hob.unconscious-characters, hob.staging-area-creating, hob.staging-area-combining (data/rules/entries.json). The encounter cards and stages of Flies and Spiders, each test from the printed line on a table of data/ built by the layout kit.
import { describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import { offerResponses } from "../../../rules/windows/responses.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { flagged, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { givePoison, makeUnconscious, poisonOf } from "../../../rules/families/poison/poison.ts";
import { stageOf } from "../../../rules/families/breaking/areas.ts";
import { finish, fightEnemy, idOf, legalIntents, resolveRecords, revealedTop, send } from "../../../../test/harness/scene-kit.ts";
import { codeOf, GLADE, spiderTable, STAGE_1, STAGE_2, STAGE_3, STAGE_4 } from "../../../../test/scenarios/flies-and-spiders/scene.ts";

type Table = ReturnType<typeof spiderTable>;
const synced = (t: Table, state: ScenarioState) => syncConstants(state, t.ctx);
const stat = (t: Table, state: ScenarioState, id: string, which: Parameters<typeof modifiedStat>[2]) => modifiedStat(state, state.cards[id]!, which, t.ctx.cards);
const poisoned = (t: Table, n: number, id = t.hero) => synced(t, givePoison(t.state, id, n, t.ctx, []));
const resolveCard = (t: Table, state: ScenarioState, code: string, timing: Parameters<typeof resolveRecords>[3], source?: string) => resolveRecords(state, t.ctx, code, timing, source).state;
// The location leaves play explored and its Response is used: the Trigger the engine offers for it, then every choice answered with its first option.
const respondTo = (t: Table, state: ScenarioState, code: string): ScenarioState => {
  const id = idOf(state, code);
  const steps: EngineStep[] = [];
  const offered = settle(offerResponses({ ...state, window: null, mode: "stopped" }, { trigger: "leftPlay", seat: 0, cardId: id, explored: true } as GameEvent, t.ctx, steps), t.ctx, steps);
  const intent = legalIntents(offered, t.ctx).find((one) => one.type === "Trigger" && one.cardId === id);
  if (!intent) throw new Error(`no Response of ${code} is offered`);
  return finish(send({ state: offered, steps }, intent as PlayerIntent, t.ctx), t.ctx).state;
};
const total = (state: ScenarioState) => state.seats.reduce((sum, seat) => sum + seat.heroes.reduce((inner, id) => inner + poisonOf(state, id), 0), 0);

describe("the locations", () => {
  it("132026:A:1 Giant Web gives each character -1 Willpower, Attack and Defense for each poison it has, to 0 at the least", () => {
    const t = spiderTable({ seats: 1, active: "132026" });
    const base = { w: stat(t, t.state, t.hero, "willpower"), a: stat(t, t.state, t.hero, "attack"), d: stat(t, t.state, t.hero, "defense") };
    const one = poisoned(t, 1);
    expect([stat(t, one, t.hero, "willpower"), stat(t, one, t.hero, "attack"), stat(t, one, t.hero, "defense")]).toEqual([base.w - 1, base.a - 1, base.d - 1]);
    expect(stat(t, poisoned(t, 5), t.hero, "willpower")).toBe(0);
    expect(stat(t, one, t.hero2, "willpower")).toBe(base.w);
  });

  it("132026:A:2 Giant Web readies an unconscious character after it is explored", () => {
    const t = spiderTable({ seats: 1, active: "132026" });
    const down = makeUnconscious(t.state, t.hero, t.ctx);
    const out = respondTo(t, down, "132026");
    expect(down.cards[t.hero]?.unconscious).toBe(true);
    expect(out.cards[t.hero]?.unconscious).toBeUndefined();
    expect(out.cards[t.hero]?.exhausted).toBe(false);
  });

  it("132027:A:1 Forest Stream: while it is the active location a poisoned character cannot quest, another can", () => {
    const t = spiderTable({ seats: 1, active: "132027" });
    const state = poisoned(t, 1);
    expect(flagged(state, t.hero, "cannotQuest")).toBe(true);
    expect(flagged(state, t.hero2, "cannotQuest")).toBe(false);
    expect(flagged(synced(t, t.state), t.hero, "cannotQuest")).toBe(false);
  });

  it("132027:A:2 Forest Stream discards 4 poison after it is explored, all of it when fewer is there", () => {
    const t = spiderTable({ seats: 1, active: "132027" });
    const six = givePoison(givePoison(t.state, t.hero, 3, t.ctx, []), t.hero2, 3, t.ctx, []);
    expect(total(respondTo(t, six, "132027"))).toBe(2);
    const two = givePoison(t.state, t.hero2, 2, t.ctx, []);
    expect(total(respondTo(t, two, "132027"))).toBe(0);
  });
});

describe("the enemies", () => {
  it("132028:A:1 Old Tomnoddy has Venom: the damage it deals gives the character 1 poison", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132028", seat: 0 }] });
    expect(flagged(synced(t, t.state), idOf(t.state, "132028"), "venom")).toBe(true);
    expect(flagged(synced(t, t.state), idOf(t.state, "132028"), "cannotBePoisoned")).toBe(false);
  });

  it("132028:A:2 Old Tomnoddy gives each player 1 poison at the end of the round, never to an unconscious hero", () => {
    const t = spiderTable({ seats: 2, engaged: [{ code: "132028", seat: 0 }] });
    const one = makeUnconscious(t.state, t.hero, t.ctx);
    const out = resolveCard(t, one, "132028", "forced", idOf(one, "132028"));
    expect(poisonOf(out, t.hero)).toBe(0);
    expect(total(out)).toBe(2);
  });

  it("132029:A:1 Crazy Cob has Venom", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132029", seat: 0 }] });
    expect(flagged(synced(t, t.state), idOf(t.state, "132029"), "venom")).toBe(true);
  });

  it("132029:A:2 Crazy Cob attacks the player who controls the character with the most poison", () => {
    const t = spiderTable({ seats: 2 });
    const other = t.seat1Hero ?? "";
    const state = givePoison(givePoison(t.state, t.hero, 1, t.ctx, []), other, 3, t.ctx, []);
    const run = resolveRecords(state, t.ctx, "132029", "whenRevealed");
    expect(run.state.pendingAttack?.seat ?? run.state.activeSeat).toBe(1);
    expect(run.state.cards[run.id]?.zone).not.toBe("discard");
  });

  it("132029:A:3 Crazy Cob's shadow gives the defending character 1 poison", () => {
    const fight = fightEnemy(spiderTable, "132029", "f0", { seats: 1 });
    expect(poisonOf(fight.run.state, fight.made.hero)).toBe(1);
  });

  it("132030:A:1 Lazy Lob has Venom", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132030", seat: 0 }] });
    expect(flagged(synced(t, t.state), idOf(t.state, "132030"), "venom")).toBe(true);
  });

  it("132030:A:3 Lazy Lob's shadow makes a poisoned defender unconscious, and leaves a clean one", () => {
    const clean = fightEnemy(spiderTable, "132030", "f0", { seats: 1 });
    expect(clean.run.state.cards[clean.made.hero]?.unconscious).toBeUndefined();
    const t = spiderTable({ seats: 1, engaged: [{ code: "132030", seat: 0 }] });
    const sick = poisoned(t, 1);
    const defending = (state: ScenarioState) => ({ ...state, pendingAttack: { enemyId: idOf(state, "132030"), seat: 0, defenderId: t.hero, undefended: false } }) as unknown as ScenarioState;
    expect(resolveRecords(defending(sick), t.ctx, "132030", "shadow").state.cards[t.hero]?.unconscious).toBe(true);
    expect(resolveRecords(defending(t.state), t.ctx, "132030", "shadow").state.cards[t.hero]?.unconscious).toBeUndefined();
  });

  it("132031:A:1 Fat Spider has Venom", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132031", seat: 0 }] });
    expect(flagged(synced(t, t.state), idOf(t.state, "132031"), "venom")).toBe(true);
  });

  it("132031:A:2 Fat Spider gets +3 Attack while engaged with a player who controls a poisoned character", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132031", seat: 0 }] });
    const id = idOf(t.state, "132031");
    const base = stat(t, synced(t, t.state), id, "attack");
    expect(stat(t, poisoned(t, 1), id, "attack")).toBe(base + 3);
  });

  it("132031:A:3 Fat Spider's shadow gives the defending character 1 poison, and an undefended attack 2 poison to a character the defending player chooses", () => {
    const defended = fightEnemy(spiderTable, "132031", "f0", { seats: 1 });
    expect(poisonOf(defended.run.state, defended.made.hero)).toBe(1);
    const bare = fightEnemy(spiderTable, "132031", "f0", { seats: 1 }, { undefended: true });
    expect(total(bare.run.state)).toBe(2);
  });

  it("132032:A:1 Wicked Spider has Venom", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132032", seat: 0 }] });
    expect(flagged(synced(t, t.state), idOf(t.state, "132032"), "venom")).toBe(true);
  });

  it("132032:A:2 Wicked Spider: when it attacks the defending player attaches 1 poison to a character he controls", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132032", seat: 0 }] });
    const out = resolveCard(t, t.state, "132032", "forced", idOf(t.state, "132032"));
    expect(total(out)).toBe(1);
  });

  it("132032:A:3 Wicked Spider's shadow gives the defending character 2 poison", () => {
    const fight = fightEnemy(spiderTable, "132032", "f0", { seats: 1 });
    expect(poisonOf(fight.run.state, fight.made.hero)).toBe(2);
  });
});

describe("the treacheries", () => {
  it("132033:A:1 Caught in Webs removes a committed hero from the quest and makes it unconscious, and gains surge with none committed", () => {
    const t = spiderTable({ seats: 1, committed: ["dh1"], deck: ["f0", "f0"] });
    const out = revealedTop(t, "132033");
    expect(out.cards[t.hero]).toMatchObject({ unconscious: true, committed: false });
    const none = spiderTable({ seats: 1, deck: ["f0", "f0"] });
    const surged = revealedTop(none, "132033");
    expect(surged.cards[none.hero]?.unconscious).toBeUndefined();
    // Surge: the next card of the deck is revealed as well.
    expect(surged.encounterDeck.length).toBe(none.state.encounterDeck.length - 1);
  });

  it("132034:A:1 Poisoned by Spiders deals each character damage equal to its poison, and gains surge when none is poisoned", () => {
    const t = spiderTable({ seats: 1, deck: ["f0", "f0"] });
    const state = poisoned(t, 2);
    const out = revealedTop({ state, ctx: t.ctx }, "132034");
    expect(out.cards[t.hero]?.damage).toBe(2);
    expect(out.cards[t.hero2]?.damage).toBe(0);
    expect(out.encounterDeck.length).toBe(state.encounterDeck.length);
    const clean = revealedTop(t, "132034");
    expect(clean.encounterDeck.length).toBe(t.state.encounterDeck.length - 1);
  });

  it("132034:A:2 Poisoned by Spiders' shadow discards an unconscious character the defending player controls", () => {
    const t = spiderTable({ seats: 1, engaged: [{ code: "132028", seat: 0 }] });
    const down = makeUnconscious(t.state, t.hero2, t.ctx);
    const out = resolveRecords(down, t.ctx, "132034", "shadow").state;
    expect(out.cards[t.hero2]?.zone).not.toBe("heroes");
    expect(out.cards[t.hero]?.zone).toBe("heroes");
  });
});

describe("the quest stages", () => {
  it("132067:A:1 Into Mirkwood: each player may shuffle a copy of the Ring into his deck, the encounter deck is shuffled and each player reveals a card", () => {
    const t = spiderTable({ seats: 2, stage: STAGE_1, setAside: ["132019", "132019", "132019", "132019"], deck: ["f0", "f0", "f0"] });
    const out = resolveCard(t, t.state, STAGE_1, "setup", t.state.questStage ?? "");
    const rings = Object.values(out.cards).filter((card) => card.code === "132019");
    expect(rings.filter((card) => card.zone === "deck").length).toBe(2);
    expect(rings.filter((card) => card.zone === "setAside").length).toBe(2);
    expect(out.encounterDeck.length).toBe(t.state.encounterDeck.length - 2);
  });

  it("132067:B:1 the stage bars an unconscious character from questing, attacking, defending, collecting resources, triggering abilities, being poisoned and readying", () => {
    const t = spiderTable({ seats: 1 });
    const out = synced(t, makeUnconscious(t.state, t.hero, t.ctx));
    for (const bar of ["cannotQuest", "cannotAttack", "cannotDefend", "noCollection", "cannotTriggerEffects", "cannotTriggerForced", "cannotBePoisoned", "cannotReady"] as const) expect(flagged(out, t.hero, bar), bar).toBe(true);
    expect(poisonOf(givePoison(out, t.hero, 1, t.ctx, []), t.hero)).toBe(0);
  });

  it("132068:B:1 Lost in the Dark gives the first player stage 3 in an area of his own and the other player stage 4", () => {
    const t = spiderTable({ stage: STAGE_2, setAside: [GLADE], seats: 2 });
    const out = resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "").state;
    expect(codeOf(out, stageOf(out, 0))).toBe(STAGE_3);
    expect(codeOf(out, stageOf(out, 1))).toBe(STAGE_4);
  });

  it("132069:A:1 Captured by Spiders empties the resource pools and makes every character but Bilbo Baggins unconscious", () => {
    const t = spiderTable({ stage: STAGE_2, setAside: [GLADE], seats: 1, heroResources: 3 });
    const out = resolveRecords(t.state, t.ctx, STAGE_2, "whenRevealed", t.state.questStage ?? "").state;
    for (const hero of out.seats[0]?.heroes ?? []) expect(out.cards[hero]).toMatchObject({ unconscious: true, resources: 0 });
  });

  it("132069:B:1 stage 3 bars an unconscious character as every stage does", () => {
    const t = spiderTable({ seats: 1, stage: STAGE_3 });
    const out = synced(t, makeUnconscious(t.state, t.hero, t.ctx));
    expect(flagged(out, t.hero, "cannotQuest")).toBe(true);
    expect(flagged(out, t.hero, "cannotReady")).toBe(true);
  });

  it("132069:B:2 while stage 3 is in play the first player token cannot pass, and the stage joins the player to stage 4 at the beginning of the travel phase after it is defeated", () => {
    const t = spiderTable({ seats: 2, stage: STAGE_3 });
    const out = synced(t, t.state);
    expect(flagged(out, "table", "firstPlayerLocked") || out.modifiers.some((modifier) => modifier.stat === "firstPlayerLocked")).toBe(true);
  });

  it("132070:B:1 stage 4 bars an unconscious character as every stage does", () => {
    const t = spiderTable({ seats: 1, stage: STAGE_4 });
    const out = synced(t, makeUnconscious(t.state, t.hero, t.ctx));
    expect(flagged(out, t.hero, "cannotQuest")).toBe(true);
  });

  it("132070:B:2 no progress can be placed on stage 4 while The Spider's Glade is in play, and can when it is not", () => {
    const withGlade = spiderTable({ seats: 1, stage: STAGE_4, staging: [GLADE] });
    expect(flagged(synced(withGlade, withGlade.state), withGlade.state.questStage ?? "", "noProgressPlaced")).toBe(true);
    const without = spiderTable({ seats: 1, stage: STAGE_4, setAside: [GLADE] });
    expect(flagged(synced(without, without.state), without.state.questStage ?? "", "noProgressPlaced")).toBe(false);
  });

  it("132070:B:3 the Action of stage 4 readies an unconscious character you control for 2 Baggins resources", () => {
    const t = spiderTable({ seats: 1, stage: STAGE_4 });
    const down = makeUnconscious(t.state, t.hero, t.ctx);
    const out = resolveCard(t, down, STAGE_4, "action", down.questStage ?? "");
    expect(out.cards[t.hero]?.unconscious).toBeUndefined();
  });

  it("132070:B:4 the game is won when stage 4 is defeated", () => {
    const t = spiderTable({ seats: 1, stage: STAGE_4, progress: 3 });
    expect(t.state.questStage).toBeTruthy();
    expect(t.cards.get(STAGE_4)?.questPoints ?? 3).toBe(3);
  });
});
