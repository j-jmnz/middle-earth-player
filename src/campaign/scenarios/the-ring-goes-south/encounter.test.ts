// Rules: rr.active-location, rr.explored, rr.engaged, rr.step-6-2, rr.step-6-4-2, rr.step-6-4-3, rr.shadow-effects, rr.surge, mec109.peril,
// rr.first-player, rr.lasting-effects, rr.damage, mec109.stage-4 (data/rules/entries.json). The encounter cards of The Ring Goes South.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect, Instruction } from "../../../catalog/boundary.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { legalIntents } from "../../../rules/engine/legal.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { attachmentTargets } from "../../../rules/player/planning.ts";
import { queueEvent } from "../../../rules/windows/queue.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { flagged, type ScenarioState } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { DOORS, GREAT_WARG_CHIEF, LUST, loadSouthWorld, REDHORN_PASS, southTable, STING, type SouthLayout, type SouthWorld } from "../../../../test/scenarios/the-ring-goes-south/scene.ts";
import { codesOf } from "../../../../test/scenarios/a-shadow-of-the-past/scene.ts";
import { first, idOf } from "../../../../test/harness/scene-kit.ts";

let world: SouthWorld;

beforeAll(async () => {
  world = await loadSouthWorld();
});

function make(layout: SouthLayout = {}) {
  const made = southTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}

type Table = ReturnType<typeof make>;

function record(id: string): Effect {
  const found = EFFECTS.find((effect) => effect.id === id);
  if (!found) throw new Error(`No record ${id}`);
  return found;
}

function settled(table: Table, state: ScenarioState, steps: EngineStep[] = []): ScenarioState {
  return settle(syncConstants(state, table.ctx), table.ctx, steps);
}

function run(table: Table, state: ScenarioState, instruction: Instruction, sourceId: string | null, steps: EngineStep[] = []): ScenarioState {
  return settled(table, runInstruction({ ...state, window: null }, instruction, { seat: 0, sourceId }, table.ctx, steps), steps);
}

// Resolves the record as the card's effect; a choice it opens is answered with `answers` (the first option once they run out).
function fire(table: Table, state: ScenarioState, cardId: string, effectId: string, answers: readonly string[] = [], frame: "whenRevealed" | "forced" | "shadow" = "whenRevealed"): ScenarioState {
  const steps: EngineStep[] = [];
  let current = settled(table, pushCardEffects({ ...state, window: null }, frame, cardId, 0, false, [record(effectId)], table.ctx, steps), steps);
  for (let at = 0; current.window?.kind === "choose" && at < 30; at += 1) {
    const option = answers[at] ?? current.window.options[0] ?? "";
    current = settled(table, expectOk(reduce(current, { type: "Choose", optionId: option }, table.ctx)).state);
  }
  return current;
}

function explore(table: Table, state: ScenarioState, code: string, damage: number): ScenarioState {
  const id = first(state, code);
  const hurt = { ...state, cards: { ...state.cards, [id]: { ...state.cards[id]!, damage } } };
  // The quest card places the progress: the location is immune to player card effects, so a hero's effect would place none (rr.immune).
  return run(table, hurt, { verb: "PlaceProgressOn", amount: 6, target: "activeLocation" }, hurt.questStage ?? table.frodo);
}

describe("the boons (142011 to 142014)", () => {
  it("Sting, Mithril Shirt and Andúril change the attached hero's stats", () => {
    const base = make();
    const frodo = base.frodo;
    const stat = (state: ScenarioState, name: "willpower" | "attack" | "defense" | "hitPoints") => modifiedStat(state, state.cards[frodo]!, name, base.ctx.cards);
    const before = { willpower: stat(base.state, "willpower"), attack: stat(base.state, "attack"), defense: stat(base.state, "defense"), hitPoints: stat(base.state, "hitPoints") };
    const withBoon = (code: string) => {
      const table = make();
      const placed = spawnAttached(table.state, code, table.frodo);
      return syncConstants(placed, table.ctx);
    };
    const sting = withBoon(STING);
    expect([stat(sting, "willpower"), stat(sting, "attack"), stat(sting, "defense")]).toEqual([before.willpower + 1, before.attack + 1, before.defense + 1]);
    const mithril = withBoon("142012");
    expect([stat(mithril, "defense"), stat(mithril, "hitPoints")]).toEqual([before.defense + 1, before.hitPoints + 1]);
    expect(stat(mithril, "attack")).toBe(before.attack);
    const anduril = withBoon("142014");
    expect([stat(anduril, "willpower"), stat(anduril, "attack"), stat(anduril, "defense")]).toEqual([before.willpower + 1, before.attack + 1, before.defense + 1]);
  });

  it("Glamdring goes on a Warrior hero or Gandalf, Andúril on a Noble hero or Aragorn", () => {
    const table = make({ hand: ["142013", "142014"] });
    // Frodo and Sam are Hobbits: neither is a Warrior or a Noble.
    expect(attachmentTargets({ ...table.state, activeSeat: 0 }, idOf(table.state, "142013"), table.ctx)).toEqual([]);
    expect(attachmentTargets({ ...table.state, activeSeat: 0 }, idOf(table.state, "142014"), table.ctx)).toEqual([]);
  });

  it("Glamdring draws a card after the attached character destroys an Orc enemy, and not for another enemy", () => {
    const table = make({ deckTop: ["filler", "filler"] });
    const glamdring = spawnAttached(table.state, "142013", table.sam);
    const glamdringId = first(glamdring, "142013");
    const withEnemies = ["orc", "grunt"].reduce((state, code) => spawnStaged(state, code), glamdring);
    for (const code of ["orc", "grunt"]) {
      const enemy = first(withEnemies, code);
      const queued = queueEvent({ ...withEnemies, window: null }, { trigger: "attackDestroyed", seat: 0, cardId: table.sam, subject: enemy, other: enemy });
      const offered = settled(table, queued);
      const trigger = legalIntents(offered, table.ctx).find((intent) => intent.type === "Trigger" && "effectId" in intent && intent.effectId === "142013:response:1");
      if (code === "grunt") {
        expect(trigger).toBeUndefined();
        continue;
      }
      expect(trigger).toBeDefined();
      const done = expectOk(reduce(offered, { type: "Trigger", cardId: glamdringId, effectId: "142013:response:1" }, table.ctx)).state;
      expect(done.seats[0].hand).toHaveLength(offered.seats[0].hand.length + 1);
    }
  });
});

function spawnAttached(state: ScenarioState, code: string, hostId: string): ScenarioState {
  const placed = spawn(state, code, { zone: "play", seat: 0 });
  return attachTo(placed.state, placed.id, hostId);
}
function spawnStaged(state: ScenarioState, code: string): ScenarioState {
  return spawn(state, code, { zone: "staging" }).state;
}

describe("Crebain from Dunland (142028)", () => {
  it("When Revealed: either exhausts a hero the revealing player controls, or engages", () => {
    const table = make({ staging: ["142028"], deck: ["f3"] });
    const crebain = first(table.state, "142028");
    const exhausted = fire(table, table.state, crebain, "142028:whenRevealed:1", ["exhaust"]);
    expect(exhausted.seats[0].heroes.filter((id) => exhausted.cards[id]?.exhausted)).toHaveLength(1);
    expect(exhausted.cards[crebain]?.zone).toBe("staging");
    const engaged = fire(table, table.state, crebain, "142028:whenRevealed:1", ["engage"]);
    expect(engaged.cards[crebain]?.zone).toBe("engaged");
    expect(engaged.cards[crebain]?.controller).toBe(0);
    // After it engages a player, the top card of the encounter deck is revealed.
    expect(codesOf(engaged, engaged.staging)).toEqual(["f3"]);
  });
});

describe("Great Warg Chief (142025)", () => {
  it("cannot have attachments", () => {
    const table = make({ staging: [GREAT_WARG_CHIEF] });
    expect(flagged(table.state, first(table.state, GREAT_WARG_CHIEF), "cannotHaveAttachments")).toBe(true);
  });

  it("after it engages you, discards encounter cards until a Warg enemy is discarded and puts that enemy into play engaged with you", () => {
    const table = make({ staging: [GREAT_WARG_CHIEF], deck: ["place", "grunt", "warg", "warg2"] });
    const chief = first(table.state, GREAT_WARG_CHIEF);
    const state = run(table, table.state, { verb: "Engage", target: "self" }, chief);
    expect(state.cards[chief]?.zone).toBe("engaged");
    expect(codesOf(state, state.seats[0].engaged).sort()).toEqual([GREAT_WARG_CHIEF, "warg"]);
    expect(codesOf(state, state.encounterDiscard).sort()).toEqual(["grunt", "place"]);
    expect(codesOf(state, state.encounterDeck)).toEqual(["warg2"]);
  });
});

describe("Hound of Sauron (142026)", () => {
  it("gets -5 engagement cost for each enemy in the staging area (itself included), and +1 Attack (+2 if it was engaged this round) as a shadow", () => {
    const table = make({ staging: ["142026", "grunt", "warg"] });
    const hound = table.state.cards[first(table.state, "142026")]!;
    // The printed engagement cost is 50; three enemies in the staging area.
    expect(modifiedStat(table.state, hound, "engagementCost", table.ctx.cards)).toBe(50 - 15);
    const one = make({ staging: ["142026"] });
    expect(modifiedStat(one.state, one.state.cards[first(one.state, "142026")]!, "engagementCost", one.ctx.cards)).toBe(45);
  });
});

describe("Howling Warg (142027:A:1)", () => {
  it("places 1 damage on an active location when it attacks", () => {
    const table = make({ stage: "142022", active: "place", engaged: [{ code: "142027", seat: 0 }] });
    const warg = first(table.state, "142027");
    const state = fire(table, table.state, warg, "142027:forced:1", [], "forced");
    expect(state.cards[first(table.state, "place")]?.damage).toBe(1);
  });
});

describe("the explored locations", () => {
  it("Redhorn Pass: each player assigns X damage among their characters", () => {
    const table = make({ stage: "142021", active: REDHORN_PASS });
    const state = explore(table, table.state, REDHORN_PASS, 2);
    // Sam is the one hero Frodo's wound does not shield; the player chooses between Frodo (life) and Sam for each.
    let current = state;
    for (let at = 0; current.window?.kind === "choose" && at < 6; at += 1) {
      current = settled(table, expectOk(reduce(current, { type: "Choose", optionId: table.sam }, table.ctx)).state);
    }
    expect(current.cards[table.sam]?.damage).toBe(2);
  });

  it("Tree-crowned Hill: enemies get -1 Threat while it is active; exploring it has the first player exhaust X characters", () => {
    const table = make({ stage: "142022", active: "142031", staging: ["f3"], allies: ["ally"] });
    const f3 = table.state.cards[first(table.state, "f3")]!;
    expect(modifiedStat(table.state, f3, "threat", table.ctx.cards)).toBe(2);
    const staged = make({ stage: "142022", staging: ["142031", "f3"] });
    expect(modifiedStat(staged.state, staged.state.cards[first(staged.state, "f3")]!, "threat", staged.ctx.cards)).toBe(3);
    let current = explore(table, table.state, "142031", 2);
    for (let at = 0; current.window?.kind === "choose" && at < 6; at += 1) current = settled(table, expectOk(reduce(current, { type: "Choose", optionId: current.window.options[0] ?? "" }, table.ctx)).state);
    const exhausted = Object.values(current.cards).filter((card) => card.exhausted && (card.zone === "heroes" || card.zone === "play"));
    expect(exhausted).toHaveLength(2);
  });

  it("Hills of Hollin: enemies in the staging area get +5 engagement cost while it is active; exploring it raises each threat by X", () => {
    const table = make({ stage: "142022", seats: 2, active: "142032", staging: ["grunt"], engaged: [{ code: "orc", seat: 0 }] });
    expect(modifiedStat(table.state, table.state.cards[first(table.state, "grunt")]!, "engagementCost", table.ctx.cards)).toBe(15);
    expect(modifiedStat(table.state, table.state.cards[first(table.state, "orc")]!, "engagementCost", table.ctx.cards)).toBe(20);
    const explored = explore(table, table.state, "142032", 3);
    expect(explored.seats[0].threat).toBe(table.state.seats[0].threat + 3);
    expect(explored.seats[1].threat).toBe(table.state.seats[1].threat + 3);
  });

  it("Redhorn Foothills: an enemy added to the staging area gets -5 engagement cost for the round while it is active; exploring it discards X cards at random", () => {
    const table = make({ stage: "142022", seats: 2, active: "142033", deck: ["grunt"], hand: ["filler", "filler", "filler"] });
    const revealed = run(table, table.state, { verb: "RevealEncounter" }, table.state.questStage);
    expect(modifiedStat(revealed, revealed.cards[first(revealed, "grunt")]!, "engagementCost", table.ctx.cards)).toBe(5);
    const explored = explore(table, table.state, "142033", 2);
    expect(explored.seats[0].hand).toHaveLength(1);
    expect(explored.seats[0].discard).toHaveLength(2);
  });

  it("Eregion: exploring it has the players discard X allies from play", () => {
    const table = make({ stage: "142022", seats: 1, active: "142034", allies: ["ally", "ally", "ally"] });
    let current = explore(table, table.state, "142034", 2);
    for (let at = 0; current.window?.kind === "choose" && at < 6; at += 1) current = settled(table, expectOk(reduce(current, { type: "Choose", optionId: current.window.options[0] ?? "" }, table.ctx)).state);
    expect(current.seats[0].play.filter((id) => current.cards[id]?.code === "ally")).toHaveLength(1);
  });
});

describe("Regiments of Crows, Snowdrifts, Bitter Cold, Storm of Howls and Lust for the Ring", () => {
  it("Regiments of Crows places 3 damage on each active location", () => {
    const table = make({ stage: "142023", active: DOORS, second: "place", staging: ["142035"] });
    const state = fire(table, table.state, first(table.state, "142035"), "142035:whenRevealed:1");
    expect(state.cards[first(table.state, DOORS)]?.damage).toBe(3);
    expect(state.cards[first(table.state, "place")]?.damage).toBe(3);
  });

  it("Snowdrifts attaches to the active location; no more than 3 progress is placed on it each round", () => {
    const table = make({ stage: "142022", active: "place", staging: ["142036"] });
    const drifts = first(table.state, "142036");
    const attached = fire(table, table.state, drifts, "142036:whenRevealed:1");
    expect(attached.cards[drifts]?.host).toBe(first(table.state, "place"));
    const progress = (state: ScenarioState, amount: number) => run(table, state, { verb: "ProgressQuest", amount }, table.frodo);
    const two = progress(attached, 2);
    expect(two.cards[first(table.state, "place")]?.progress).toBe(2);
    const more = progress(two, 5);
    // 1 more fits under the cap of 3; the rest goes on the quest.
    expect(more.cards[first(table.state, "place")]?.progress).toBe(3);
    expect(more.cards[more.questStage ?? ""]?.progress).toBe(4);
  });

  it("Snowdrifts gains surge when it is not attached: no active location, or one that already has a copy", () => {
    const reveal = (table: Table, state: ScenarioState) => run(table, state, { verb: "RevealEncounter" }, table.state.questStage);
    const none = make({ stage: "142022", deck: ["142036", "f3", "f3", "f3"] });
    const noneAfter = reveal(none, none.state);
    // A treachery is discarded once it has resolved; surge reveals the next card.
    expect(codesOf(noneAfter, noneAfter.staging)).toEqual(["f3"]);
    expect(codesOf(noneAfter, noneAfter.encounterDiscard)).toEqual(["142036"]);
    const twice = make({ stage: "142022", active: "place", deck: ["142036", "142036", "f3", "f3"] });
    const once = reveal(twice, twice.state);
    expect(codesOf(once, once.staging)).toEqual([]);
    const second = reveal(twice, once);
    // The second copy finds a copy on the location: it is not attached, so it is discarded and gains surge.
    expect(codesOf(second, second.staging)).toEqual(["f3"]);
    expect(codesOf(second, second.encounterDiscard)).toEqual(["142036"]);
  });

  it("Bitter Cold: each player chooses to discard each ally they control or raise their threat by 1 for each", () => {
    const table = make({ stage: "142022", seats: 2, allies: ["ally", "ally"], staging: ["142037"] });
    const bitter = first(table.state, "142037");
    const discarded = fire(table, table.state, bitter, "142037:whenRevealed:1", ["discard", "discard"]);
    expect(discarded.seats[0].play.filter((id) => discarded.cards[id]?.code === "ally")).toHaveLength(0);
    const raised = fire(table, table.state, bitter, "142037:whenRevealed:1", ["threat", "threat"]);
    expect(raised.seats[0].threat).toBe(table.state.seats[0].threat + 2);
    expect(raised.seats[1].threat).toBe(table.state.seats[1].threat);
  });

  it("Storm of Howls: the Warg in the staging area with the highest engagement cost attacks you, or each Warg gets -20 engagement cost", () => {
    const table = make({ stage: "142022", staging: ["142038", "warg", "warg2"] });
    const storm = first(table.state, "142038");
    const lowered = fire(table, table.state, storm, "142038:whenRevealed:1", ["engagement"]);
    expect(modifiedStat(lowered, lowered.cards[first(lowered, "warg")]!, "engagementCost", table.ctx.cards)).toBe(13);
    expect(modifiedStat(lowered, lowered.cards[first(lowered, "warg2")]!, "engagementCost", table.ctx.cards)).toBe(0);
    const attacked = fire(table, table.state, storm, "142038:whenRevealed:1", ["attack"]);
    expect(attacked.pendingAttack?.enemyId).toBe(first(table.state, "warg"));
    expect(attacked.pendingAttack?.fromStaging).toBe(true);
    expect(attacked.cards[first(table.state, "warg")]?.zone).toBe("staging");
    // The attack goes through its windows to the defense step, and resolves against the player.
    let current = attacked;
    for (let at = 0; current.window?.kind === "frameAction" && at < 6; at += 1) current = expectOk(reduce(current, { type: "Pass" }, table.ctx)).state;
    expect(current.window?.kind).toBe("defense");
    const done = expectOk(reduce(current, { type: "Undefended", heroId: table.sam }, table.ctx)).state;
    let after = done;
    for (let at = 0; after.window?.kind === "frameAction" && at < 6; at += 1) after = expectOk(reduce(after, { type: "Pass" }, table.ctx)).state;
    expect(after.cards[table.sam]?.damage).toBe(3);
    expect(after.pendingAttack).toBeNull();
    expect(after.cards[first(table.state, "warg")]?.zone).toBe("staging");
  });

  it("Storm of Howls gains surge when no Warg enemy is in the staging area", () => {
    const table = make({ stage: "142022", staging: ["grunt"], deck: ["142038", "f3", "f3"] });
    const state = run(table, table.state, { verb: "RevealEncounter" }, table.state.questStage);
    expect(codesOf(state, state.staging).sort()).toEqual(["f3", "grunt"]);
    const warg = make({ stage: "142022", staging: ["warg"], deck: ["142038", "f3", "f3"] });
    const withWarg = run(warg, warg.state, { verb: "RevealEncounter" }, warg.state.questStage);
    expect(codesOf(withWarg, withWarg.staging)).not.toContain("f3");
  });

  it("Lust for the Ring attaches to a non-Fellowship hero; The One Ring exhausting raises each threat by 1 and sets its Willpower to 0 for the round", () => {
    const table = make({ stage: "142022", seats: 2, heroes: ["strong"], deck: [LUST, "f3"] });
    const asked = run(table, table.state, { verb: "RevealEncounter" }, table.state.questStage);
    const strong = first(asked, "strong");
    // Frodo is a Fellowship hero and cannot take it; the first player chooses among the others.
    expect(asked.window && "options" in asked.window ? [...asked.window.options].sort() : []).toEqual([table.sam, strong, table.merry ?? ""].sort());
    const revealed = settled(table, expectOk(reduce(asked, { type: "Choose", optionId: strong }, table.ctx)).state);
    const lust = first(revealed, LUST);
    expect(revealed.cards[lust]?.host).toBe(strong);
    expect(revealed.cards[lust]?.zone).toBe("attached");
    expect(modifiedStat(revealed, revealed.cards[strong]!, "willpower", table.ctx.cards)).toBe(6);
    const ring = first(revealed, "141085");
    const exhausted = run(table, revealed, { verb: "Exhaust", target: { kind: "byCode", code: "141085" } }, ring);
    expect(exhausted.cards[ring]?.exhausted).toBe(true);
    expect(exhausted.seats[0].threat).toBe(revealed.seats[0].threat + 1);
    expect(exhausted.seats[1].threat).toBe(revealed.seats[1].threat + 1);
    expect(modifiedStat(exhausted, exhausted.cards[strong]!, "willpower", table.ctx.cards)).toBe(0);
    // It lasts until the end of the round.
    expect(modifiedStat(exhausted, exhausted.cards[table.sam]!, "willpower", table.ctx.cards)).toBe(modifiedStat(revealed, revealed.cards[table.sam]!, "willpower", table.ctx.cards));
  });
});
