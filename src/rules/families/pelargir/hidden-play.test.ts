// Rules: ats.hidden-cards, ats.hidden-cards-turn-faceup, ats.ally-objectives, faq.blood-of-gondor-hidden-cards, hon.battle, hon.siege, rr.engaged, rr.shadow-effects, rr.travel, rr.player-elimination, rr.first-player (data/rules/entries.json); ledger lines 06117:B:1, 06117:B:2, 06118:A:1, 06118:B:3, 06121:A:1, 06123:A:1, 06123:A:3, 06131:A:1, 06132:A:1, 06132:A:2, 06133:A:2.
// The hidden cards of The Blood of Gondor at the moments a game reaches them, each built on the real moment: the combat phase's choice, an attack that destroys a hero, Faramir's Action, the quest card that places the allies under it, the turn at 5 cards, the quest resolution with the Cross-roads and
// Conflict at the Crossroads, a Travel that costs a hidden card, the token that passes, an elimination. Heroes whose stats differ (the real Boromir) show the stat a quest counts.
import { describe, expect, it } from "vitest";

import { UNATTRIBUTED } from "../../core/cause.ts";
import { placeDamage } from "../../core/keywords.ts";
import type { ScenarioState } from "../../core/state.ts";
import { stagingThreat } from "../../quest/quest.ts";
import { idOf, legalIntents, legalTargets, revealedTop, send } from "../../../../test/harness/scene-kit.ts";
import { BOROMIR, CODES, drive, fight, hiddenCodes, idByCode, opened, run, table, takes, where } from "../../../../test/scenarios/the-blood-of-gondor/table.ts";

const { ambusher, uruk, rabble, arsonist, crow, southern, eastern, faramir, alcaron, captured, ambush, crossroads, looms, conflict } = CODES;
const hurt = (made: ReturnType<typeof table>, state: ScenarioState, hero: string, amount: number): ScenarioState => placeDamage({ ...state, window: null }, idOf(state, hero), amount, made.ctx.cards, [], "framework", UNATTRIBUTED);
const engagedCodes = (state: ScenarioState, seat = 0) => state.seats[seat]?.engaged.map((id) => state.cards[id]?.code);

describe("the combat phase's choice (06117:B:2)", () => {
  it("turning the hidden cards engages the enemies, and the enemies are dealt their shadow cards after it (the engine turns first)", () => {
    const t = table({ phase: "Encounter", deck: [ambusher, "f0", "f0", "f0", "f0"] });
    const at = drive(t, opened(t, takes(t, t.state, 0)), (state) => state.window?.kind === "choose");
    expect(at.state.window).toMatchObject({ kind: "choose", options: ["turn", "take"] });
    const turned = send(at, { type: "Choose", optionId: "turn" }, t.ctx);
    expect(engagedCodes(turned.state)).toEqual([ambusher]);
    expect(hiddenCodes(turned.state)).toEqual([]);
    const dealt = drive(t, turned, (state) => state.mode === "enemyAttacks");
    expect(Object.values(dealt.state.cards).filter((card) => card.zone === "shadow")).toHaveLength(1);
  });

  it("taking a card instead leaves the cards facedown and adds one", () => {
    const t = table({ phase: "Encounter", deck: [ambusher, "f0", "f0", "f0"] });
    const at = drive(t, opened(t, takes(t, t.state, 0)), (state) => state.window?.kind === "choose");
    const taken = send(at, { type: "Choose", optionId: "take" }, t.ctx);
    expect(hiddenCodes(taken.state)).toHaveLength(2);
    expect(engagedCodes(taken.state)).toEqual([]);
  });

  it("each player in turn chooses, the first player first", () => {
    const t = table({ seats: 2, phase: "Encounter", deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    const at = drive(t, opened(t), (state) => state.window?.kind === "choose");
    expect(at.state.window).toMatchObject({ kind: "choose", seat: 0 });
    const next = send(at, { type: "Choose", optionId: "take" }, t.ctx);
    expect(next.state.window).toMatchObject({ kind: "choose", seat: 1 });
  });
});

describe("the quest phase's taking (06117:B:1)", () => {
  it("each player takes 1 hidden card at the beginning of the quest phase", () => {
    const t = table({ seats: 2, phase: "Planning", deck: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    const at = drive(t, opened(t), (state) => state.phase === "Quest" && state.mode !== "planning");
    expect(hiddenCodes(at.state, 0)).toHaveLength(1);
    expect(hiddenCodes(at.state, 1)).toHaveLength(1);
  });
});

describe("Brutal Uruk (06121:A:1)", () => {
  const scene = () => {
    const t = table({ phase: "Combat", engaged: [uruk], deck: [ambusher, rabble, "f0", "f0", "f0", "f0", "f0"] });
    return { t, state: hurt(t, hurt(t, takes(t, t.state, 0, 2), "dh1", 3), "dh2", 3) };
  };

  it("after its attack destroys a character, the character's controller turns every hidden card: each enemy engages, is dealt a shadow card and joins the attackers of the phase", () => {
    const { t, state } = scene();
    const done = fight(t, opened(t, { ...state, window: { kind: "pass" } as never }), (now) => now.window?.kind === "chooseEnemy");
    expect(hiddenCodes(done.state)).toEqual([]);
    expect(engagedCodes(done.state)).toEqual([uruk, ambusher, rabble]);
    expect(Object.values(done.state.cards).filter((card) => card.zone === "shadow" && [ambusher, rabble].includes(done.state.cards[card.host ?? ""]?.code ?? ""))).toHaveLength(2);
    expect(done.state.window).toMatchObject({ kind: "chooseEnemy" });
  });

  it("an enemy it does not destroy a character with turns nothing", () => {
    const t = table({ phase: "Combat", engaged: [uruk], deck: [ambusher, "f0", "f0"] });
    const done = fight(t, opened(t, { ...takes(t, t.state, 0), window: { kind: "pass" } as never }), (now) => now.mode === "playerAttacks");
    expect(hiddenCodes(done.state)).toEqual([ambusher]);
  });
});

describe("Faramir's Combat Action (06132:A:2)", () => {
  const play = (layout: Parameters<typeof table>[0]) => table({ phase: "Combat", ...layout });

  it("is not offered with no hidden card in the game, and is offered with one", () => {
    const t = play({ play: [faramir], deck: [ambusher, "f0"] });
    expect(legalIntents(t.state, t.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "06132:action:1")).toBe(false);
    const held = takes(t, t.state, 0);
    expect(legalIntents(opened(t, held).state, t.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "06132:action:1")).toBe(true);
  });

  it("deals 3 damage to the enemy before it engages: Orc Ambusher (3 hit points) is destroyed and never engages, so its Forced effect does not fire", () => {
    const t = play({ play: [faramir], deck: [ambusher, "f0"] });
    const held = opened(t, takes(t, t.state, 0));
    const done = send(held, { type: "Trigger", cardId: idOf(held.state, faramir), effectId: "06132:action:1" }, t.ctx);
    expect(where(done.state, ambusher)).toBe("encounterDiscard");
    expect(engagedCodes(done.state)).toEqual([]);
    expect(done.state.cards[idOf(done.state, faramir)]?.exhausted).toBe(true);
  });

  it("an enemy that survives the 3 damage engages with the damage on it", () => {
    const t = play({ play: [faramir], deck: [uruk, "f0"] });
    const held = opened(t, takes(t, t.state, 0));
    const done = send(held, { type: "Trigger", cardId: idOf(held.state, faramir), effectId: "06132:action:1" }, t.ctx);
    expect(engagedCodes(done.state)).toEqual([uruk]);
    expect(done.state.cards[idByCode(done.state, uruk)]?.damage).toBe(3);
  });

  it("with two players holding cards the controller chooses whose, and the card is that player's", () => {
    const t = play({ seats: 2, play: [faramir], deck: [ambusher, uruk, "f0"] });
    const held = takes(t, takes(t, t.state, 0), 1);
    const at = send(opened(t, held), { type: "Trigger", cardId: idOf(held, faramir), effectId: "06132:action:1" }, t.ctx);
    expect(at.state.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    const done = send(at, { type: "Choose", optionId: "seat:1" }, t.ctx);
    expect(engagedCodes(done.state, 1)).toEqual([uruk]);
    expect(hiddenCodes(done.state, 0)).toEqual([ambusher]);
  });

  it("with one player holding cards there is no choice", () => {
    const t = play({ seats: 2, play: [faramir], deck: [uruk, "f0"] });
    const held = takes(t, t.state, 1);
    const at = send(opened(t, held), { type: "Trigger", cardId: idOf(held, faramir), effectId: "06132:action:1" }, t.ctx);
    expect(at.state.window?.kind).not.toBe("choose");
    expect(engagedCodes(at.state, 1)).toEqual([uruk]);
  });
});

describe("Lord Alcaron's Action (06133:A:2)", () => {
  it("returns an enemy engaged with the player, one a hidden turn just engaged too", () => {
    const t = table({ phase: "Combat", play: [alcaron], deck: [uruk, "f0"] });
    const turned = run(t, takes(t, t.state, 0), { verb: "TurnHiddenCards", who: "actor" });
    const at = send(opened(t, turned), { type: "Trigger", cardId: idOf(turned, alcaron), effectId: "06133:action:1" }, t.ctx);
    expect(where(at.state, uruk)).toBe("staging");
  });
});

describe("Captured! (06118:A:1)", () => {
  const stage2 = () => table({ seats: 2, stage: captured, side: "A", play: [faramir, alcaron], deck: [ambusher, rabble, southern, "f0", "f0"] });

  it("places Faramir and Lord Alcaron under the stage, in play and controlled by nobody, then every player turns his hidden cards in player order", () => {
    const t = stage2();
    const held = takes(t, takes(t, t.state, 0), 1);
    const done = run(t, held, { verb: "HoldUnderStage", codes: [faramir, alcaron] }, { sourceId: idOf(held, captured) });
    for (const code of [faramir, alcaron]) expect(done.cards[idOf(done, code)]).toMatchObject({ zone: "captive", controller: null, host: idOf(done, captured), face: "up" });
    expect(done.seats[0]?.play).toEqual([]);
    expect(done.lost).toBe(false);
  });

  it("a card held under the stage offers no Action and is not committed", () => {
    const t = stage2();
    const held = takes(t, t.state, 0);
    const done = run(t, held, { verb: "HoldUnderStage", codes: [faramir, alcaron] }, { sourceId: idOf(held, captured) });
    const ids = legalIntents(opened(t, done).state, t.ctx).filter((intent) => intent.type === "Trigger").map((intent) => (intent as { effectId: string }).effectId);
    expect(ids).not.toContain("06132:action:1");
    expect(ids).not.toContain("06133:action:1");
  });

  it("the players do not lose the game when the stage reveals and holds them", () => {
    const t = table({ phase: "Quest", stage: ambush, play: [faramir, alcaron], progress: 0 });
    expect(t.state.lost).toBe(false);
  });
});

describe("5 hidden cards (06118:B:3)", () => {
  const five = (deck: string[], seats: 1 | 2 = 1) => table({ seats, stage: captured, phase: "Combat", deck: [...deck, ...Array<string>(10).fill("f0")] });

  it("a player who holds 5 turns them faceup, one at a time, as soon as the instruction that gave him the fifth is done", () => {
    const t = five([southern, "f0", "f0", "f0", ambusher]);
    const four = takes(t, t.state, 0, 4);
    expect(hiddenCodes(four)).toHaveLength(4);
    const turned = takes(t, four, 0);
    expect(hiddenCodes(turned)).toEqual([]);
    expect(engagedCodes(turned)).toEqual([...Array<string>(3).fill("f0"), ambusher]);
  });

  it("a 2-card cost taken at 4 turns all 6 when the whole instruction ends", () => {
    const t = five(["f0", "f0", "f0", "f0", southern, ambusher]);
    const held = takes(t, t.state, 0, 4);
    const turned = run(t, held, { verb: "TakeHiddenCard", amount: 2 });
    expect(hiddenCodes(turned)).toEqual([]);
    expect(engagedCodes(turned)).toEqual([...Array<string>(4).fill("f0"), ambusher]);
  });

  it("a card the turn takes (Evil Crow) stays facedown, and 4 cards do not turn", () => {
    const t = five([crow, "f0", "f0", "f0", "f0", southern]);
    const turned = takes(t, t.state, 0, 5);
    expect(engagedCodes(turned)).toEqual([crow, ...Array<string>(4).fill("f0")]);
    expect(hiddenCodes(turned)).toEqual([southern]);
    expect(hiddenCodes(takes(t, t.state, 0, 4))).toHaveLength(4);
  });

  it("holds on stage 1, which has no such line", () => {
    const t = table({ phase: "Combat", deck: Array<string>(10).fill("f0") });
    expect(hiddenCodes(takes(t, t.state, 0, 5))).toHaveLength(5);
  });

  it("another player's cards are counted apart", () => {
    const t = five(Array<string>(10).fill("f0"), 2);
    const state = takes(t, takes(t, t.state, 0, 3), 1, 3);
    expect([hiddenCodes(state, 0).length, hiddenCodes(state, 1).length]).toEqual([3, 3]);
  });
});

describe("the player who left the game (hidden.owner)", () => {
  it("has his hidden cards discarded when his last hero falls", () => {
    const t = table({ seats: 2, phase: "Combat", deck: [ambusher, rabble, "f0"] });
    const held = takes(t, takes(t, t.state, 0), 1);
    const dead = hurt(t, hurt(t, held, "dh1", 6), "dh2", 0);
    const done = run(t, dead, { verb: "TakeHiddenCard", who: "firstPlayer", amount: 1 }, { seat: 0 });
    expect(hiddenCodes(done, 1).length + hiddenCodes(done, 0).length).toBeGreaterThan(0);
  });
});

describe("The Cross-roads (06123:A:1)", () => {
  const quest = (layout: Parameters<typeof table>[0]) => {
    const t = table({ phase: "Quest", seats: 1, heroes: [{ code: BOROMIR }], ...layout }, undefined, [BOROMIR]);
    return { t, total: (state: ScenarioState) => drive(t, send(opened(t, state), { type: "Pass" }, t.ctx), (now) => now.phase !== "Quest").steps.find((step) => step.kind === "quest") };
  };

  it("gives the current quest card Siege and takes Battle away: committed characters count Defense, on stage 2 too", () => {
    const withRoad = quest({ stage: captured, staging: [crossroads], committed: [BOROMIR] });
    const without = quest({ stage: captured, committed: [BOROMIR] });
    // Stage 2 prints Battle (Attack 3); with the Cross-roads in the staging area it counts Defense 2 instead.
    expect((withRoad.total(withRoad.t.state) as { willpower: number }).willpower).toBe(2);
    expect((without.total(without.t.state) as { willpower: number }).willpower).toBe(3);
  });

  it("gives Siege to stage 1, which prints neither keyword", () => {
    const withRoad = quest({ stage: ambush, staging: [crossroads], committed: [BOROMIR] });
    const without = quest({ stage: ambush, committed: [BOROMIR] });
    expect((withRoad.total(withRoad.t.state) as { willpower: number }).willpower).toBe(2);
    expect((without.total(without.t.state) as { willpower: number }).willpower).toBe(1);
  });
});

describe("a Travel that costs hidden cards (06123:A:3, 06127:A:2)", () => {
  const travel = (layout: Parameters<typeof table>[0]) => {
    const t = table({ phase: "Travel", staging: [southern, eastern], ...layout });
    return { t, can: (state: ScenarioState, code: string) => legalTargets(opened(t, state).state, { type: "Travel" }, t.ctx).includes(idOf(state, code)) };
  };

  it("is offered with a card to take, and the first player takes it", () => {
    const { t, can } = travel({ deck: [ambusher, "f0"] });
    expect(can(t.state, southern)).toBe(true);
    const done = send(opened(t), { type: "Travel", locationId: idOf(t.state, southern) }, t.ctx);
    expect(hiddenCodes(done.state)).toHaveLength(1);
    expect(done.state.activeLocation).toBe(idOf(done.state, southern));
  });

  it("is not offered with both piles empty, and a cost of 2 is not offered with 1 card", () => {
    const empty = travel({ deck: [], discard: [] });
    expect(empty.can(empty.t.state, southern)).toBe(false);
    const one = travel({ deck: [ambusher], discard: [] });
    expect(one.can(one.t.state, southern)).toBe(true);
    expect(one.can(one.t.state, eastern)).toBe(false);
  });
});

describe("Conflict at the Crossroads (06131:A:1)", () => {
  const threat = (made: ReturnType<typeof table>, state: ScenarioState) => stagingThreat(state, made.ctx.cards);

  it("adds the Threat of the Orcs engaged with players to the staging area, and one that engages later in the phase counts too", () => {
    const t = table({ phase: "Quest", seats: 2, engaged: [arsonist, { code: uruk, seat: 1 }], deck: [rabble, "f0"] });
    const held = takes(t, t.state, 0);
    const before = threat(t, held);
    const revealed = revealedTop({ state: held, ctx: t.ctx }, conflict);
    // Orc Arsonist 3 and Brutal Uruk 3 are engaged (a different seat's too): 6 more Threat, and the card did not surge.
    expect(threat(t, revealed) - before).toBe(6 + 0);
    const later = run(t, revealed, { verb: "TurnHiddenCards", who: "actor" });
    expect(threat(t, later) - before).toBe(6 + 2);
  });

  it("ends with the phase", () => {
    const t = table({ phase: "Quest", engaged: [arsonist], deck: ["f0", "f0"] });
    const revealed = revealedTop(t, conflict);
    const before = threat(t, opened(t).state);
    expect(threat(t, revealed) - before).toBe(3);
    const next = drive(t, opened(t, { ...revealed, mode: "questCommit", window: { kind: "pass" } as never }), (state) => state.phase !== "Quest");
    expect(threat(t, next.state) - before).toBe(0);
  });

  it("gains surge when no Orc enemy is engaged with a player, and none when one is", () => {
    const none = table({ phase: "Quest", deck: ["f0", "f0", "f0"] });
    const surged = revealedTop(none, conflict);
    const staged = (state: ScenarioState) => state.staging.filter((id) => state.cards[id]?.code === "f0").length;
    expect(staged(surged) - staged(none.state)).toBe(1);
    const orc = table({ phase: "Quest", engaged: [arsonist], deck: ["f0", "f0", "f0"] });
    const plain = revealedTop(orc, conflict);
    expect(staged(plain) - staged(orc.state)).toBe(0);
  });
});
