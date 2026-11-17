// Rules: docs/brief.md (The Battle of Lake-town), rr.attachment-cards, rr.objective-cards, rr.travel, rr.action, rr.winning-the-game, rr.cancel, faq.enemy-attacks-outside-combat (data/rules/entries.json).
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import type { PlayerIntent } from "../../../rules/engine/reduce.ts";
import { destroyCard } from "../../../rules/core/keywords.ts";
import { moveCard } from "../../../rules/core/zones.ts";
import { updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { whenRevealedUncancelable } from "../../../rules/families/wilderland/heath.ts";
import { countsAsAttachment } from "../../../rules/interpret/conditions.ts";
import { travelBlocked } from "../../../rules/interpret/restrictions.ts";
import { play } from "../../../../test/harness/card-spec-play.ts";
import { announce, quest, resolve, type Row } from "../../../../test/harness/card-spec.ts";
import { finish, first, legalIntents, legalTargets, send, tableFromLayout, type Layout, type LayoutTable, type Run } from "../../../../test/harness/scene-kit.ts";

// What a card-spec row cannot express for The Battle of Lake-town: a card that leaves play, an intent that must be refused or is offered to a seat, a game's end, a window answered with several intents. The Smaug deck, Burn, the Smaug swap and the attacks on Lake-town
// are tested with their family (src/rules/families/smaug/); the rows are in spec.test.ts.
const ID = "the-battle-of-lake-town";
const LAKE = "50207";
const QUEST_START = { seat: null, phase: "Quest" } as const;
const played = (row: Omit<Row, "line">) => play(ID, { line: "test", ...row } as Row, EFFECTS, false);
const table = (layout: Layout = {}) => tableFromLayout(ID, layout);
const idsInZone = (state: ScenarioState, zone: string) => Object.values(state.cards).filter((card) => card.zone === zone).map((card) => card.id);
const damage = (state: ScenarioState, code: string) => state.cards[first(state, code)]?.damage ?? 0;

// Every defense window is answered undefended (the hero the window offers), until none is open.
function undefend(run: Run, made: LayoutTable): Run {
  let current = run;
  for (let guard = 0; guard < 10 && current.state.window?.kind === "defense"; guard += 1) {
    const hero = legalTargets(current.state, { type: "Undefended" }, made.ctx)[0];
    if (hero == null) break;
    current = send(current, { type: "Undefended", heroId: hero }, made.ctx);
  }
  return current;
}

describe("50208:A:2 The Old Thrush counts as an attachment and is discarded when it is detached", () => {
  const claimed = () => played({ layout: { staging: ["50208"] }, act: [resolve("50208", "action")], expect: [] });

  it("50208:A:2 claimed, it lies attached to the hero and counts as an attachment", () => {
    const done = claimed();
    const thrush = first(done.run.state, "50208");
    expect(done.run.state.cards[thrush]?.zone).toBe("attached");
    expect(done.run.state.cards[thrush]?.host).toBe(done.table.hero);
    expect(countsAsAttachment(done.run.state, thrush, done.table.ctx)).toBe(true);
  });

  it("50208:A:2 when its hero leaves play it is discarded to the encounter discard pile, not returned to the staging area", () => {
    const done = claimed();
    const next = destroyCard(done.run.state, done.table.hero, done.table.ctx.cards, []);
    expect(next.cards[first(next, "50208")]?.zone).toBe("encounterDiscard");
  });
});

describe("50203:B:1 the stage reveals 1 additional card in the staging step", () => {
  it("50203:B:1 the beginning of the quest phase adds 1 to the reveal: 2 cards in all for one player", () => {
    const done = played({ layout: { stage: "50203", deck: ["f0", "f3", "place"], staging: [LAKE] }, act: [announce("beginningOfPhase", undefined, QUEST_START), quest("success")], expect: [] });
    expect(done.run.state.encounterDeck).toHaveLength(1);
  });
});

describe("50203:B:2 the Refresh Action returns the quest to stage 2", () => {
  const refreshing = (layout: Layout, seat: number) => {
    const done = played({ layout: { stage: "50203", seats: 2, ...layout }, act: [], expect: [] });
    // The action window of the phase.
    const state = { ...done.run.state, activeSeat: seat, window: { kind: "pass" as const } };
    const offered = legalIntents(state, done.table.ctx).flatMap((intent): PlayerIntent[] => (intent.type === "Trigger" && intent.effectId === "50203:action:1" ? [{ type: "Trigger", cardId: intent.cardId, effectId: intent.effectId }] : []));
    return { done, state, offered };
  };

  it("50203:B:2 either player may use it in the refresh phase, it belongs to no player", () => {
    expect(refreshing({ phase: "Refresh" }, 0).offered).toHaveLength(1);
    expect(refreshing({ phase: "Refresh" }, 1).offered).toHaveLength(1);
  });

  it("50203:B:2 it is not offered in another phase", () => {
    expect(refreshing({ phase: "Quest" }, 0).offered).toHaveLength(0);
    expect(refreshing({ phase: "Planning" }, 1).offered).toHaveLength(0);
  });

  it("50203:B:2 using it puts stage 2 back as the current quest with no progress, and Smaug keeps his damage", () => {
    const { done, state, offered } = refreshing({ phase: "Refresh", progress: 3, staging: [LAKE, { code: "50204", damage: 6 }] }, 1);
    const next = send({ state, steps: [] }, offered[0]!, done.table.ctx);
    expect(next.state.cards[next.state.questStage ?? ""]?.code).toBe("50202");
    expect(next.state.cards[next.state.questStage ?? ""]?.progress).toBe(0);
    expect(damage(next.state, "50204")).toBe(6);
  });
});

describe("50203:B:3 the stage is defeated only by defeating Smaug", () => {
  it("50203:B:3 no amount of progress defeats it: it has no quest points", () => {
    const done = played({ layout: { stage: "50203", progress: 40, staging: [LAKE] }, act: [quest("success")], expect: [] });
    expect(done.run.state.stageCleared).toBeFalsy();
    expect(done.run.state.lost).toBeFalsy();
  });

  it("50203:B:3 defeating Smaug with no points in the victory display loses when Lake-town has no damage either (0 against 0 is a tie)", () => {
    const done = played({ layout: { stage: "50203", staging: [LAKE, "50204"] }, act: [announce("enemyDestroyed", "50204")], expect: [] });
    expect(done.run.state.lost).toBeTruthy();
    expect(done.run.state.stageCleared).toBeFalsy();
  });
});

describe("50204:A:2 Smaug the Mighty's immediate attack against each player", () => {
  it("50204:A:2 each of 2 players is attacked in turn from the first player, a shadow card dealt to each attack, the damage dealt to each", () => {
    const done = played({ layout: { seats: 2, deck: ["f0", "f0", "f0", "f0"], staging: [LAKE] }, act: resolve("50204", "whenRevealed"), expect: [] });
    expect(done.run.state.window?.kind).toBe("defense");
    expect(done.run.state.encounterDeck).toHaveLength(3);
    const after = undefend(done.run, done.table);
    expect(after.state.encounterDeck).toHaveLength(2);
    expect(after.state.cards[done.table.hero]?.damage).toBe(5);
    expect(after.state.cards[done.table.seat1Hero ?? ""]?.damage).toBe(5);
  });
});

describe("50219:A:2 Merchant's District's Travel Action", () => {
  const traveling = (layout: Layout) => {
    const made = table({ phase: "Travel", ...layout });
    // The window after the travel option (4.2): the Travel Action is taken there.
    return { made, state: { ...made.state, window: { kind: "pass" as const } } };
  };
  const trigger = (state: ScenarioState, made: LayoutTable): PlayerIntent | undefined => {
    const found = legalIntents(state, made.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "50219:action:1");
    return found?.type === "Trigger" ? { type: "Trigger", cardId: found.cardId, effectId: found.effectId } : undefined;
  };

  it("50219:A:2 is offered in the Travel phase from the staging area, 2 damage per player is dealt to Lake-town and the location goes to the victory display", () => {
    const { made, state } = traveling({ seats: 2, staging: [LAKE, "50219", "50215"] });
    const intent = trigger(state, made);
    expect(intent).toBeDefined();
    const next = send({ state, steps: [] }, intent!, made.ctx).state;
    expect(damage(next, LAKE)).toBe(4);
    expect(next.cards[first(next, "50219")]?.zone).toBe("victory");
  });

  it("50219:A:2 is offered too while it is the active location, and the location still goes to the victory display", () => {
    const { made, state } = traveling({ staging: [LAKE], active: "50219" });
    const intent = trigger(state, made);
    expect(intent).toBeDefined();
    const next = send({ state, steps: [] }, intent!, made.ctx).state;
    expect(damage(next, LAKE)).toBe(2);
    expect(next.cards[first(next, "50219")]?.zone).toBe("victory");
  });

  it("50219:A:2 may be used again in the same Travel phase, for another copy", () => {
    const { made, state } = traveling({ staging: [LAKE, "50219", "50219", "50215"] });
    const once = send({ state, steps: [] }, trigger(state, made)!, made.ctx);
    expect(once.state.window?.kind).toBe("pass");
    const again = trigger(once.state, made);
    expect(again).toBeDefined();
    const twice = send(once, again!, made.ctx);
    expect(damage(twice.state, LAKE)).toBe(4);
    expect(idsInZone(twice.state, "victory")).toHaveLength(2);
  });

  it("50219:A:2 is not traveling: the players travel to another location and then use it from the active location, or decline to travel and use it", () => {
    const made = table({ phase: "Travel", staging: [LAKE, "50219", "50215"] });
    const traveled = finish(send({ state: made.state, steps: [] }, { type: "Travel", locationId: first(made.state, "50215") }, made.ctx), made.ctx);
    expect(traveled.state.activeLocation).toBe(first(traveled.state, "50215"));
    expect(trigger(traveled.state, made)).toBeDefined();
    const declined = finish(send({ state: made.state, steps: [] }, { type: "DeclineTravel" }, made.ctx), made.ctx);
    expect(trigger(declined.state, made)).toBeDefined();
  });

  it("50219:A:2 is not offered outside the Travel phase", () => {
    const made = table({ phase: "Quest", staging: [LAKE, "50219"] });
    expect(trigger(made.state, made)).toBeUndefined();
  });
});

describe("50223:A:2 Fisherman's Dock", () => {
  const traveling = (layout: Layout) => {
    const made = table({ phase: "Travel", staging: [LAKE, "50223", "50215"], ...layout });
    return { made, state: made.state };
  };

  it("50223:A:2 with exactly 1 active location the players may travel to it by exhausting a hero, and it becomes the second active location", () => {
    const { made, state } = traveling({ active: "50219" });
    expect(legalTargets(state, { type: "Travel" }, made.ctx)).toContain(first(state, "50223"));
    const there = finish(send({ state, steps: [] }, { type: "Travel", locationId: first(state, "50223") }, made.ctx), made.ctx).state;
    expect(there.secondActiveLocation).toBe(first(there, "50223"));
    expect(there.activeLocation).toBe(first(there, "50219"));
    expect([made.hero, made.hero2].filter((id) => there.cards[id]?.exhausted)).toHaveLength(1);
  });

  it("50223:A:2 with no active location no hero is exhausted", () => {
    const { made, state } = traveling({});
    const there = send({ state, steps: [] }, { type: "Travel", locationId: first(state, "50223") }, made.ctx).state;
    expect(there.activeLocation).toBe(first(there, "50223"));
    expect([made.hero, made.hero2].filter((id) => there.cards[id]?.exhausted)).toHaveLength(0);
  });

  it("50223:A:2 with 2 active locations the players cannot travel to it", () => {
    const { made, state } = traveling({ active: "50219" });
    const both = { ...moveCard(state, first(state, "50215"), { zone: "secondActiveLocation" }), window: { kind: "travel" as const } };
    expect(legalTargets(both, { type: "Travel" }, made.ctx)).toEqual([]);
  });

  it("50223:A:2 with 1 active location and no ready hero to exhaust the players cannot travel to it", () => {
    const { made, state } = traveling({ active: "50219" });
    const tired = [made.hero, made.hero2].reduce((next, id) => updateCard(next, id, { exhausted: true }), state);
    expect(legalTargets(tired, { type: "Travel" }, made.ctx)).not.toContain(first(state, "50223"));
  });
});

describe("50217:A:2 South Pier bars travel to every other location", () => {
  const barred = (layout: Layout, code: string): boolean => {
    const made = table({ phase: "Travel", ...layout });
    return travelBlocked(made.state, made.ctx, first(made.state, code));
  };

  it("50217:A:2 in the staging area it leaves only itself to travel to", () => {
    expect(barred({ staging: ["50217", "50215", "50223"] }, "50215")).toBe(true);
    expect(barred({ staging: ["50217", "50215", "50223"] }, "50223")).toBe(true);
    expect(barred({ staging: ["50217", "50215"] }, "50217")).toBe(false);
  });

  it("50217:A:2 as the active location it still bars Fisherman's Dock, the second active location", () => {
    expect(barred({ staging: ["50223"], active: "50217" }, "50223")).toBe(true);
  });

  it("50217:A:2 without it nothing is barred", () => {
    expect(barred({ staging: ["50215"] }, "50215")).toBe(false);
  });
});

describe("50220:A:2 East Pier: no When Revealed effect can be canceled", () => {
  const cancels: Effect = { id: "hero:response:9", cardCode: "frodo", lines: ["frodo:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const barred = (layout: Layout): boolean => {
    const made = table({ ...layout, staging: [...(layout.staging ?? []), "50209"] });
    return whenRevealedUncancelable(made.state, { trigger: "whenRevealedPending", seat: 0, subject: first(made.state, "50209") }, cancels, { ...made.ctx, effects: [...made.ctx.effects, cancels] });
  };

  it("50220:A:2 in the staging area it bars the cancel, of a card with any trait and of one with none", () => {
    expect(barred({ staging: ["50220"] })).toBe(true);
  });

  it("50220:A:2 as the active location it bars it too", () => {
    expect(barred({ active: "50220" })).toBe(true);
  });

  it("50220:A:2 not in the victory display or without it", () => {
    expect(barred({ victory: ["50220"] })).toBe(false);
    expect(barred({})).toBe(false);
  });
});

describe("50216:A:2 The Master's Manor with no Smaug in play", () => {
  it("50216:A:2 moves nothing and does not fail", () => {
    const done = played({ layout: { staging: [LAKE] }, act: resolve("50216", "whenRevealed"), expect: [] });
    expect(damage(done.run.state, LAKE)).toBe(0);
  });
});
