// Rules: emce.dragon-signs, emce.caves-deck, emce.deep, emce.guarded-x, emce.boon-allies, rr.guarded, rr.travel, rr.search, rr.winning-the-game (data/rules/entries.json); ledger lines 12175:A:2, 12175:B:5, 19018:A:1, 19019:A:3, 19020:A:2, 19022:B:1, 19024:B:1, 19025:B:3.
// The user's rulings of 2026-11-05 for The Withered Heath (docs/scenarios/ered-mithrin/the-withered-heath.md, The Withered Heath), one test each. The ruling of the Caves removal (12175:A:2) is pinned in campaign.test.ts and golden.test.ts, which chain the earlier parts' Resolutions.
import { beforeAll, describe, expect, it } from "vitest";

import { settle } from "../../../rules/engine/machine.ts";
import type { ScenarioState } from "../../../rules/engine/reduce.ts";
import { CODES, codesIn, finish, heathTable, idOf, legalIntents, loadHeathWorld, resolveRecords, send, start, type HeathWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-withered-heath/scene.ts";

let world: HeathWorld;
beforeAll(async () => {
  world = await loadHeathWorld();
}, 120_000);

type Layout = Parameters<typeof heathTable>[1];
const SIGNS = (n: number): string[] => Array.from({ length: n }, () => CODES.dragonSign);
type Asked = { seat: number; options: string[] };
// Records every choice the game opens (the seat asked and its options) and answers it with `pick` (the first option by default).
function recorder(pick: (options: readonly string[], asked: readonly Asked[]) => string = (options) => options[0] ?? ""): { asked: Asked[]; pick: (state: ScenarioState) => string } {
  const asked: Asked[] = [];
  return {
    asked,
    pick: (state) => {
      if (state.window?.kind !== "choose") return "";
      asked.push({ seat: state.window.seat, options: [...state.window.options] });
      return pick(state.window.options, asked);
    },
  };
}
const withFirstPlayer = (state: ScenarioState, seat: number): ScenarioState => ({ ...state, firstPlayer: seat });

describe("user ruling 2026-11-05: 19019:A:3 High Falls", () => {
  it("the first player (the Travel's actor) assigns all X damage among any players' characters, one point at a time", () => {
    for (const first of [0, 1]) {
      const t = heathTable(world, { seats: 2, phase: "Travel", staging: [CODES.highFalls, CODES.lostArmory, CODES.ancientTreasury], caves: [] });
      const state = withFirstPlayer(t.state, first);
      const heroes = [t.hero, t.hero2, t.seat1Hero ?? ""];
      const answers = recorder((options, asked) => (asked.length === 1 ? (options.find((id) => id === t.seat1Hero) ?? options[0] ?? "") : (options.find((id) => id === t.hero2) ?? options[0] ?? "")));
      const run = finish(send(start(state), { type: "Travel", locationId: idOf(state, CODES.highFalls) }, t.ctx), t.ctx, answers.pick);
      // X = 3: the two other locations and High Falls itself, which is still in the staging area while its Travel effect resolves.
      expect(answers.asked, `first player ${first}`).toHaveLength(3);
      for (const asked of answers.asked) {
        expect(asked.seat, `first player ${first}`).toBe(first);
        expect(asked.options, `first player ${first}`).toEqual(expect.arrayContaining(heroes));
      }
      const damage = (id: string) => run.state.cards[id]?.damage ?? 0;
      expect(damage(t.seat1Hero ?? ""), `first player ${first}`).toBe(1);
      expect(damage(t.hero2), `first player ${first}`).toBe(2);
      expect(damage(t.hero), `first player ${first}`).toBe(0);
    }
  });
});

describe("user ruling 2026-11-05: 19020:A:2 Heavy Snow", () => {
  it("the first player chooses one ready character in play, any player's", () => {
    for (const first of [0, 1]) {
      const t = heathTable(world, { seats: 2, staging: [CODES.heavySnow] });
      const state = withFirstPlayer(t.state, first);
      const snow = idOf(state, CODES.heavySnow);
      const answers = recorder((options) => options.at(-1) ?? "");
      const run = resolveRecords(state, t.ctx, CODES.heavySnow, "whenRevealed", snow, answers.pick);
      expect(answers.asked, `first player ${first}`).toHaveLength(1);
      expect(answers.asked[0]?.seat, `first player ${first}`).toBe(first);
      expect(answers.asked[0]?.options, `first player ${first}`).toEqual(expect.arrayContaining([t.hero, t.hero2, t.seat1Hero ?? ""]));
      // The character picked, a seat 2 hero here, is the one exhausted.
      expect([t.hero, t.hero2, t.seat1Hero ?? ""].filter((id) => run.state.cards[id]?.exhausted), `first player ${first}`).toEqual([answers.asked[0]?.options.at(-1)]);
    }
  });
});

describe("user ruling 2026-11-05: 12175:B:5 Dragon-slayer", () => {
  // Cold-Drake at 17 damage engaged with the first seat, the Accolade boons set aside, the attacker strong enough to kill it.
  const slain = (seats: 1 | 2) => {
    const all = [CODES.masterOfTheHunt, CODES.unbroken, CODES.theSteadfast, CODES.dragonSlayer];
    const t = heathTable(world, { seats, campaign: true, stage: "19025", phase: "PlayerAttacks", setAside: all, victory: SIGNS(4), engaged: [{ code: CODES.coldDrake, seat: 0, damage: 17 }] });
    const drake = idOf(t.state, CODES.coldDrake);
    const strong: ScenarioState = { ...t.state, modifiers: [...t.state.modifiers, { instanceId: t.hero, sourceId: t.hero, stat: "attack", amount: 9, until: "endOfPhase" }] };
    return { t, run: send(start(strong), { type: "DeclareAttackers", enemyId: drake, attackerIds: [t.hero] }, t.ctx) };
  };
  const boonsOn = (run: Run, id: string): string[] => Object.values(run.state.cards).filter((card) => card.host === id).map((card) => card.code);

  it("when Cold-Drake dies each player with no Accolade boon is offered Dragon-slayer, the first player first, and the game is won at the end of that phase", () => {
    const { t, run: killed } = slain(2);
    expect(killed.state.window).toMatchObject({ kind: "choose", seat: 0, options: ["attach", "decline"] });
    // The first player declines: the second player, who has no Accolade boon either, is offered it.
    let run = send(killed, { type: "Choose", optionId: "decline" }, t.ctx);
    expect(run.state.window).toMatchObject({ kind: "choose", seat: 1, options: ["attach", "decline"] });
    run = send(run, { type: "Choose", optionId: "attach" }, t.ctx);
    run = finish(run, t.ctx);
    expect(boonsOn(run, t.seat1Hero ?? "")).toContain(CODES.dragonSlayer);
    expect([t.hero, t.hero2].flatMap((id) => boonsOn(run, id))).not.toContain(CODES.dragonSlayer);
    expect(run.state.stageCleared).toBe(false);
    for (let guard = 0; guard < 30 && !run.state.stageCleared; guard += 1) {
      const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass" || intent.type === "DeclineAttack");
      if (!pass) break;
      run = finish(send(run, pass as PlayerIntent, t.ctx), t.ctx);
    }
    expect(run.state.stageCleared).toBe(true);
    expect(run.state.lost).toBe(false);
  });

  it("a player who already controls an Accolade boon is not offered it, and the one copy goes to one player", () => {
    const { t, run: killed } = slain(2);
    // The first player takes it: the only copy is attached, so the second player has nothing to choose.
    const run = finish(send(killed, { type: "Choose", optionId: "attach" }, t.ctx), t.ctx);
    expect([t.hero, t.hero2].some((id) => boonsOn(run, id).includes(CODES.dragonSlayer))).toBe(true);
    expect(run.state.window?.kind === "choose" && run.state.window.options.includes("attach")).toBe(false);
  });
});

describe("user ruling 2026-11-05: 19022:B:1 and 19024:B:1, the looked-at cards", () => {
  for (const [stage, label, id] of [["19022", "19022:B:1", "19022:forced:1"], ["19024", "19024:B:1", "19024:forced:1"]] as const) {
    it(`${label} the other looked cards are discarded first, then the chosen card is revealed`, () => {
      const t = heathTable(world, { stage, deck: ["f0", "f3", "treachery", "place"] });
      const takes = (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((option) => state.cards[option]?.code === "f3") ?? "") : "");
      // The record without its last instruction (RevealEncounter): the other two are in the discard pile and the card chosen waits on top of the deck, not yet revealed.
      const record = t.ctx.effects.find((effect) => effect.id === id)!;
      expect(record.instructions.map((instruction) => instruction.verb), label).toEqual(["LookAtTop", "PickEncounter", "DiscardOtherLooked", "RevealEncounter"]);
      const before = { ...t.ctx, effects: t.ctx.effects.map((effect) => (effect.id === id ? { ...effect, instructions: effect.instructions.slice(0, -1) } : effect)) };
      const half = resolveRecords(t.state, before, t.state.questStage ? t.state.cards[t.state.questStage]?.code ?? "" : "", "forced", t.state.questStage ?? undefined, takes);
      expect(codesIn(half.state, "encounterDiscard"), label).toEqual(["f0", "treachery"]);
      expect(half.state.encounterDeck.map((card) => half.state.cards[card]?.code), label).toEqual(["f3", "place"]);
      expect(codesIn(half.state, "staging"), label).toEqual([]);
      // The whole record then reveals the card chosen.
      const whole = resolveRecords(t.state, t.ctx, t.state.cards[t.state.questStage ?? ""]?.code ?? "", "forced", t.state.questStage ?? undefined, takes);
      expect(codesIn(whole.state, "encounterDiscard"), label).toEqual(["f0", "treachery"]);
      expect(codesIn(whole.state, "staging"), label).toEqual(["f3"]);
    });
  }
});

describe("user ruling 2026-11-05: 19018:A:1 Creature Den", () => {
  it("the Dragon Sign it guards is guarded by Creature Den only: the sign's own Guarded (enemy) is not resolved", () => {
    const t = heathTable(world, { phase: "Travel", staging: [CODES.creatureDen], caves: [CODES.lostArmory, CODES.dragonSign], deck: ["f3"] });
    let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.creatureDen) }, t.ctx);
    for (let guard = 0; guard < 6 && run.state.window?.kind === "response"; guard += 1) {
      const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "19018:response:1");
      run = finish(send(run, (offered ?? { type: "Pass" }) as PlayerIntent, t.ctx), t.ctx);
    }
    run = finish(run, t.ctx);
    const sign = idOf(run.state, CODES.dragonSign);
    const den = idOf(run.state, CODES.creatureDen);
    expect(run.state.cards[den]).toMatchObject({ host: sign, guard: true });
    // Nothing else guards the sign: the enemy Creature Den's own Travel effect added to the staging area (the only enemy of the deck) is not attached to it: had the sign's own Guarded (enemy) been resolved, that enemy would be its guard and the Travel effect would find none.
    expect(Object.values(run.state.cards).filter((card) => card.host === sign).map((card) => card.code)).toEqual([CODES.creatureDen]);
    expect(codesIn(run.state, "staging")).toEqual(["f3", CODES.dragonSign].sort());
    expect(run.state.cards[idOf(run.state, "f3")]?.host ?? null).toBeNull();
    expect(codesIn(run.state, "encounterDeck")).toEqual([]);
    expect(codesIn(run.state, "encounterDiscard")).toEqual([]);
  });
});

describe("user ruling 2026-11-05: 19025 A Cornered Dragon", () => {
  // The stage prints 0 quest points: it cannot be defeated until Cold-Drake lies in the victory display, however much (no) progress it holds.
  const stays = (layout: Layout, label: string) => {
    const t = heathTable(world, { stage: "19025", phase: "Refresh", ...layout });
    const steps: Run["steps"] = [];
    const after = settle(t.state, t.ctx, steps);
    expect(after.cards[after.questStage ?? ""]?.code, label).toBe(CODES.stage4);
    expect(after.stageCleared, label).toBe(false);
  };

  it("stage 4 is not defeated while Cold-Drake is set aside, in the staging area or engaged", () => {
    stays({ setAside: [CODES.coldDrake] }, "set aside");
    stays({ staging: [CODES.coldDrake] }, "staging");
    stays({ engaged: [{ code: CODES.coldDrake, seat: 0 }] }, "engaged");
  });
});

describe("19024:A:1 Hunting the Beast with a Cold-Drake at 18 damage", () => {
  it("advancing from stage 2 sets Cold-Drake aside with its damage; it is not destroyed in between (its indestructible lapses with stage 2)", () => {
    const t = heathTable(world, { stage: "19023", progress: 3, phase: "Refresh", staging: [{ code: CODES.coldDrake, damage: 18 }], caves: [CODES.lostArmory], deck: ["place"] });
    const drake = idOf(t.state, CODES.coldDrake);
    const advanced = finish({ state: settle({ ...t.state, mode: "stopped" }, t.ctx, []), steps: [] }, t.ctx);
    expect(advanced.state.cards[advanced.state.questStage ?? ""]?.code).toBe(CODES.stage3);
    expect(advanced.state.cards[drake]).toMatchObject({ zone: "setAside", damage: 18 });
    expect(codesIn(advanced.state, "victory")).not.toContain(CODES.coldDrake);
  });
});
