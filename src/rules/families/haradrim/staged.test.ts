// Rules: hrd.heroes-in-the-staging-area, hrd.guarded-heroes, hrd.objective-heroes, rr.blank, rr.immune, rr.player-elimination, rr.ownership-and-control (data/rules/entries.json); ledger lines 16071:A:1, 16071:B:1, 16071:B:3, 16072:B:3, 16073:A:1, 16073:B:2. The haradrim
// family's heroes in the staging area on their own: each verb, the sweep that blanks them, the undefended-damage hook and the proofs that the captive code the other scenarios use does not touch them.
import { describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import type { EngineStep } from "../../core/intents.ts";
import { gameReads } from "../../core/game-reads.ts";
import { flagged, heldHero, type ScenarioState } from "../../core/state.ts";
import { opened, run as runInstruction, tableFromLayout, idOf, idsOf, type Layout } from "../../../../test/harness/scene-kit.ts";
import { send } from "../../../../test/harness/scene.ts";
import { settle } from "../../engine/machine.ts";
import { pushCardEffects } from "../../interpret/effect-frames.ts";
import { matchesPick, pickCandidates } from "../../interpret/pick.ts";
import { holdCaptive, rescueCaptives } from "../captives/index.ts";
import { captivesOf } from "../captives/values.ts";
import { heroGuardedBy } from "../wilderland/carried.ts";
import { markStagedHeroes, stagedHeroes, undefendedStaged } from "./staged.ts";

const table = (layout: Layout = {}) => tableFromLayout("the-long-arm-of-mordor", { seats: 1, stage: "16071", ...layout });
const OBJECTIVE = ["16031", "16032", "16033", "16034"];
const ENEMY = "16062";

/** The instructions resolve in an effect frame of the quest stage, as its Setup does, so a verb that asks can ask; the choices are left to the caller. */
function inFrame(made: { ctx: Parameters<typeof settle>[1] }, state: ScenarioState, instructions: Effect["instructions"], seat = 0): ScenarioState {
  const steps: EngineStep[] = [];
  const effect: Effect = { id: "16071:setup:probe", cardCode: "16071", lines: ["16071:A:1"], timing: "setup", instructions };
  const pushed = pushCardEffects(state, "setup", idOf(state, "16071"), seat, false, [effect], made.ctx, steps);
  return settle({ ...pushed, window: null, mode: "stopped" }, made.ctx, steps);
}

/** Both heroes of the first seat move to the staging area, as the Setup does. */
function staged(layout: Layout = {}) {
  const made = table(layout);
  const state = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
  return { made, state, heroes: made.state.seats[0]?.heroes ?? [] };
}

describe("16071:A:1 MoveHeroesToStaging: each hero moves to the staging area", () => {
  it("each hero becomes a Captive held by no card and remembers its owner and its place, keeping its tokens and attachments", () => {
    const made = table({ seats: 2, heroes: [{ code: "dh2", seat: 0, damage: 1, resources: 2 }], attached: [{ code: "attachment", to: "dh1" }] });
    const before = made.state;
    const state = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const [first, second] = before.seats[0]?.heroes ?? [];
    expect(state.seats[0]?.heroes).toEqual([]);
    expect(state.seats[1]?.heroes).toEqual([]);
    for (const [id, slot] of [[first, 0], [second, 1]] as const) {
      const hero = state.cards[id ?? ""];
      expect(hero).toMatchObject({ zone: "captive", host: null, captive: true, controller: null, owner: 0, heroSlot: slot, face: "up" });
    }
    expect(stagedHeroes(state)).toHaveLength(Object.values(before.cards).filter((card) => card.zone === "heroes").length);
    // The attachment stays on its hero, in play.
    const attachment = idOf(state, "attachment");
    expect(state.cards[attachment]).toMatchObject({ host: first, zone: "play" });
    expect(state.cards[first ?? ""]?.attachments).toContain(attachment);
  });

  it("a seat whose every hero is in the staging area is not out of heroes, and the setup leaves it in the game", () => {
    const { state } = staged();
    expect(state.seats[0]?.eliminated).toBeFalsy();
    expect(settle(state, table().ctx, [] as EngineStep[]).seats[0]?.eliminated).toBeFalsy();
  });
});

describe("16071:A:1 TakeObjectiveHero: each player takes an objective-hero and adds 2 resources to it", () => {
  const take: Effect["instructions"][number] = { verb: "ForEachPlayer", order: "firstFirst", instructions: [{ verb: "TakeObjectiveHero", codes: OBJECTIVE, resources: 2 }] };

  it("the player is asked which one when several are left, and the hero joins their heroes faceup with 2 resources", () => {
    const made = table({ setAside: OBJECTIVE });
    const state = opened(made).state;
    const asked = inFrame(made, state, [take]);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const options = asked.window?.kind === "choose" ? asked.window.options : [];
    expect(options).toHaveLength(4);
    const chosen = options[2] ?? "";
    const answered = send({ state: asked, steps: [] }, { type: "Choose", optionId: chosen }, made.ctx).state;
    const hero = answered.cards[chosen];
    expect(hero).toMatchObject({ zone: "heroes", controller: 0, resources: 2, face: "up" });
    expect(answered.seats[0]?.heroes).toContain(chosen);
    // Taking the others is not offered again: three are still set aside.
    expect(answered.setAside.filter((id) => OBJECTIVE.includes(answered.cards[id]?.code ?? ""))).toHaveLength(3);
  });

  it("the last one left is taken without asking, and nothing happens with none left", () => {
    const made = table({ setAside: ["16033"] });
    const taken = inFrame(made, opened(made).state, [take]);
    expect(taken.window?.kind).not.toBe("choose");
    expect(taken.cards[idOf(taken, "16033")]).toMatchObject({ zone: "heroes", resources: 2 });
    const none = table();
    expect(inFrame(none, opened(none).state, [take]).seats[0]?.heroes).toEqual(none.state.seats[0]?.heroes);
  });

  it("two players take in turn order from the first player, and a card of RemoveSetAside then leaves the game", () => {
    const made = table({ seats: 2, firstPlayer: 1, setAside: OBJECTIVE });
    let current = inFrame(made, opened(made).state, [take]);
    expect(current.window).toMatchObject({ kind: "choose", seat: 1 });
    const first = current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "";
    current = send({ state: current, steps: [] }, { type: "Choose", optionId: first }, made.ctx).state;
    expect(current.window).toMatchObject({ kind: "choose", seat: 0 });
    const second = current.window?.kind === "choose" ? (current.window.options[0] ?? "") : "";
    current = send({ state: current, steps: [] }, { type: "Choose", optionId: second }, made.ctx).state;
    expect(current.cards[first]?.controller).toBe(1);
    expect(current.cards[second]?.controller).toBe(0);
    for (const code of OBJECTIVE) current = runInstruction(made, current, { verb: "RemoveSetAside", code });
    expect(current.setAside.filter((id) => OBJECTIVE.includes(current.cards[id]?.code ?? ""))).toEqual([]);
    expect(current.removed).toHaveLength(2);
  });
});

describe("16071:A:1 the heroes in the staging area are blank and immune to player card effects, for the rest of the game", () => {
  it("the sweep marks each Captive, and takes the marks off a hero that is no Captive any more", () => {
    const { made, state } = staged();
    const marked = markStagedHeroes(state, made.ctx);
    for (const hero of stagedHeroes(marked)) {
      expect(flagged(marked, hero.id, "blankText")).toBe(true);
      expect(flagged(marked, hero.id, "immuneToPlayerCards")).toBe(true);
    }
    expect(markStagedHeroes(marked, made.ctx)).toBe(marked);
    const free = stagedHeroes(marked)[0]!;
    const released = inFrame(made, marked, [{ verb: "ReleaseStagedHero" }], 0);
    expect(released.window?.kind).toBe("choose");
    const answered = send({ state: released, steps: [] }, { type: "Choose", optionId: free.id }, made.ctx).state;
    expect(flagged(answered, free.id, "blankText")).toBe(false);
    expect(flagged(answered, free.id, "immuneToPlayerCards")).toBe(false);
  });

  it("a game with no such Setup is left as it is", () => {
    const made = tableFromLayout("escape-from-umbar", { seats: 1 });
    const hero = made.state.seats[0]?.heroes[0] ?? "";
    const held = holdCaptive(made.state, hero, null);
    expect(markStagedHeroes(held, made.ctx)).toBe(held);
  });

  it("a staged hero collects no resource, adds no threat or Willpower and is not among the heroes a default pick finds, while captive: include reaches it", () => {
    const { made, state, heroes } = staged({ heroResources: 1, staging: ["16035"] });
    const settled = settle(state, made.ctx, [] as EngineStep[]);
    const enemy = idOf(settled, "16035");
    const spec = { type: "hero", control: "any" } as const;
    expect(pickCandidates(settled, spec, 0, [], enemy, made.ctx)).toEqual([]);
    // An encounter card's effect reaches them when it says so (the Enforcers' damage), a player card's does not: they are immune to player card effects.
    expect(pickCandidates(settled, { ...spec, captive: "include" }, 0, [], enemy, made.ctx).sort()).toEqual([...heroes].sort());
    expect(pickCandidates(settled, { ...spec, captive: "include" }, 0, [], null, made.ctx)).toEqual([]);
    expect(pickCandidates(settled, { type: "hero", control: "you" }, 0, [], enemy, made.ctx)).toEqual([]);
    // No pool of its own is read: the seat's heroes are what collects, and none is left.
    expect(settled.seats[0]?.heroes).toEqual([]);
    expect(settled.cards[heroes[0] ?? ""]?.captive).toBe(true);
  });
});

describe("16071:B:3 ReleaseStagedHero: each player takes control of a hero they own in the staging area, exhausted", () => {
  it("a player who owns several chooses, the hero returns to its old place, exhausted and faceup with its tokens, and the others stay", () => {
    const { made, state, heroes } = staged({ heroes: [{ code: "dh3", seat: 0, damage: 2 }] });
    const all = [...heroes, ...stagedHeroes(state).map((card) => card.id).filter((id) => !heroes.includes(id))];
    const asked = inFrame(made, state, [{ verb: "ReleaseStagedHero" }], 0);
    expect(asked.window).toMatchObject({ kind: "choose", seat: 0 });
    const second = all[1] ?? "";
    const answered = send({ state: asked, steps: [] }, { type: "Choose", optionId: second }, made.ctx).state;
    expect(answered.seats[0]?.heroes).toEqual([second]);
    expect(answered.cards[second]).toMatchObject({ zone: "heroes", controller: 0, exhausted: true, face: "up" });
    expect(answered.cards[second]?.captive).toBeUndefined();
    expect(stagedHeroes(answered)).toHaveLength(all.length - 1);
  });

  it("a player who owns none picks none, one who owns one takes it without asking, and another player's hero is not theirs to take", () => {
    const made = table({ seats: 2 });
    const state = runInstruction(made, opened(made).state, { verb: "MoveHeroesToStaging" });
    const owned = stagedHeroes(state).filter((card) => card.owner === 1);
    expect(owned).toHaveLength(1);
    const taken = inFrame(made, state, [{ verb: "ReleaseStagedHero" }], 1);
    expect(taken.window?.kind).not.toBe("choose");
    expect(taken.seats[1]?.heroes).toEqual([owned[0]?.id]);
    expect(taken.cards[owned[0]?.id ?? ""]?.exhausted).toBe(true);
    const bare = inFrame(made, taken, [{ verb: "ReleaseStagedHero" }], 1);
    expect(bare.seats[1]?.heroes).toEqual(taken.seats[1]?.heroes);
    expect(stagedHeroes(bare).every((card) => card.owner === 0)).toBe(true);
  });
});

describe("16073:A:1 GuardStagedHeroes: each hero in the staging area is attached to a different Orc enemy in the staging area", () => {
  it("the first player pairs each hero with an Orc: the hero becomes a guarded Captive under it, and a hero with no Orc left stays in the staging area", () => {
    const { made, state, heroes } = staged({ staging: [ENEMY, "16063"] });
    const orcs = [idOf(state, ENEMY), idOf(state, "16063")];
    let current = inFrame(made, state, [{ verb: "GuardStagedHeroes" }]);
    expect(current.window).toMatchObject({ kind: "choose", seat: 0 });
    const options = current.window?.kind === "choose" ? current.window.options : [];
    expect([...options].sort()).toEqual([...orcs].sort());
    current = send({ state: current, steps: [] }, { type: "Choose", optionId: orcs[1] ?? "" }, made.ctx).state;
    // The first hero is guarded by the Orc chosen; the second takes the one Orc left without asking.
    expect(current.window?.kind).not.toBe("choose");
    expect(heroGuardedBy(current, orcs[1] ?? "")).toBe(heroes[0]);
    expect(heroGuardedBy(current, orcs[0] ?? "")).toBe(heroes[1]);
    expect(current.cards[heroes[0] ?? ""]).toMatchObject({ zone: "captive", host: orcs[1], guardedHero: true, captive: true, owner: 0, heroSlot: 0 });
    expect(stagedHeroes(current)).toEqual([]);
    expect(heldHero(current.cards[heroes[0] ?? ""]!)).toBe(true);
  });

  it("with fewer Orcs than heroes the extra hero stays in the staging area, and an Orc that guards one is not offered again", () => {
    const { made, state, heroes } = staged({ staging: [ENEMY] });
    const current = inFrame(made, state, [{ verb: "GuardStagedHeroes" }]);
    const guard = idOf(state, ENEMY);
    expect(current.window?.kind).not.toBe("choose");
    expect(heroGuardedBy(current, guard)).toBe(heroes[0]);
    expect(stagedHeroes(current).map((card) => card.id)).toEqual([heroes[1]]);
  });

  it("only an Orc enemy in the staging area can guard: a location, an engaged Orc and a non-Orc enemy cannot", () => {
    const { made, state } = staged({ staging: ["16036", "16064"], engaged: [ENEMY] });
    const current = inFrame(made, state, [{ verb: "GuardStagedHeroes" }]);
    expect(captivesOf(current).every((card) => card.host == null)).toBe(true);
  });

  it("16073:B:2 a guard that leaves play in any way returns its hero to its owner exhausted, and a guarded hero keeps its tokens and attachments", () => {
    const { made, state, heroes } = staged({ staging: [ENEMY], attached: [{ code: "attachment", to: "dh1" }] });
    const guarded = inFrame(made, state, [{ verb: "GuardStagedHeroes" }]);
    const guard = idOf(guarded, ENEMY);
    expect(guarded.cards[heroes[0] ?? ""]?.attachments).toHaveLength(1);
    const gone = settle({ ...guarded, cards: { ...guarded.cards } }, made.ctx, [] as EngineStep[]);
    expect(heroGuardedBy(gone, guard)).toBe(heroes[0]);
  });
});

describe("the heroes in the staging area and the other captive code", () => {
  it("rescueCaptives answers only the stage that clears the quest: advancing a stage returns no staged or guarded hero", () => {
    const { made, state } = staged({ staging: [ENEMY] });
    const guarded = inFrame(made, state, [{ verb: "GuardStagedHeroes" }]);
    const advanced = runInstruction(made, guarded, { verb: "AdvanceToStage", code: "16072" });
    const settled = settle(advanced, made.ctx, [] as EngineStep[]);
    expect(settled.stageCleared).toBe(false);
    expect(captivesOf(settled)).toHaveLength(2);
    expect(settled.seats[0]?.heroes).toEqual([]);
    // The hook itself, called for the last stage, would return them: only `stageCleared` gates it.
    expect(rescueCaptives(settled).seats[0]?.heroes).toHaveLength(2);
  });

  it("the Ring-maker's captor sweep does nothing in this game: no record names EngageCaptiveHolder, and settling changes no hero", () => {
    const { made, state } = staged({ staging: [ENEMY] });
    const guarded = inFrame(made, state, [{ verb: "GuardStagedHeroes" }]);
    expect(gameReads(guarded, made.ctx, '"EngageCaptiveHolder"')).toBe(false);
    const settled = settle(guarded, made.ctx, [] as EngineStep[]);
    expect(Object.fromEntries(captivesOf(settled).map((card) => [card.id, card.host]))).toEqual(Object.fromEntries(captivesOf(guarded).map((card) => [card.id, card.host])));
    expect(settled.seats[0]?.engaged).toEqual([]);
  });
});

describe("16071:B:1 undefendedToStaged: damage from undefended attacks goes to a hero in the staging area", () => {
  const withFlag = (state: ScenarioState): ScenarioState => ({ ...state, modifiers: [...state.modifiers, { instanceId: "table", sourceId: "table", stat: "undefendedToStaged", amount: 1, until: "endOfGame" }] });

  it("the hook names the heroes in the staging area while a stage holds the flag, and none without it or with no hero there", () => {
    const { state } = staged();
    expect(flagged(state, "table", "undefendedToStaged")).toBe(true);
    expect(undefendedStaged(state)).toHaveLength(2);
    const later = staged({ stage: "16073" });
    expect(flagged(later.state, "table", "undefendedToStaged")).toBe(false);
    expect(undefendedStaged(later.state)).toEqual([]);
    expect(undefendedStaged(withFlag(later.state))).toHaveLength(2);
    const made = table();
    expect(undefendedStaged(withFlag(made.state))).toEqual([]);
  });
});

describe("record ownership", () => {
  it("the objective-heroes are dealt aside and no record names the Enforcers or the Chieftain of the Setup", () => {
    const made = table();
    expect(idsOf(made.state, "16031")).toEqual([]);
    expect(matchesPick(made.state, made.hero, { type: "hero", control: "any" }, { seat: 0, sourceId: null }, made.ctx)).toBe(true);
  });
});
