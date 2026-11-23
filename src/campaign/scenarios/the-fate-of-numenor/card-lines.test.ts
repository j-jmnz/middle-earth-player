// Rules: dcce.uncharted, dcce.encounter-cards, rr.attachment-cards, rr.active-location, rr.first-player, rr.objective-cards, rr.removed-from-game (data/rules/entries.json). Lines: the Lost
// Island side of each double-sided location (11027:B:2 to B:4, 11030:B:2, 11031:B:2 to B:4, 11072:B:2 to B:4, 11073:B:2 to B:4, 11074:B:2 to B:4), Calphon's Upgraded side (110013:B:2,
// 110013:B:4) and Revenant (11181:A:2, 11181:A:4), read from the ledger (data/printed/dream-chaser.json). Each test runs its table a second time with the records of its line left out
// (`without`, test/scenarios/the-fate-of-numenor/scene.ts) and shows the result differs.
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../../../rules/interpret/constants.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { attachBlocked } from "../../../rules/interpret/restrictions.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import type { ScenarioState } from "../../../rules/core/state.ts";
import { CODES, fateTable, finish, idOf, loadFateWorld, send, start, type FateLayout, type FateWorld, type Run } from "../../../../test/scenarios/the-fate-of-numenor/scene.ts";

let world: FateWorld;

beforeAll(async () => {
  world = await loadFateWorld();
});

function make(layout: FateLayout = {}) {
  const made = fateTable(world, layout);
  return { ...made, state: syncConstants(made.state, made.ctx) };
}
type Table = ReturnType<typeof make>;

// A card of the staging area on its Lost Island side (side B), with progress on it.
const L = (code: string, progress = 0) => ({ code, face: "B" as const, progress });
// An enemy engaged with the first seat stops the round at its attack, so the table right after the travel is the one a test reads (as locations.test.ts does).
const STOP = { engaged: [{ code: "mild", seat: 0 }] } as const;
const codeOf = (line: string) => line.split(":")[0] ?? "";

// The players travel to the card with this code in the Travel phase; every question the flip opens takes its first option.
function travel(made: Table, code: string): Run {
  return finish(send(start(made.state), { type: "Travel", locationId: idOf(made.state, code) }, made.ctx), made.ctx);
}

// The Lost Island's Action, if the first player is offered it.
const lookAction = (made: Table, code: string) =>
  legalIntents(made.state, made.ctx).find((intent): intent is Extract<PlayerIntent, { type: "Trigger" }> => intent.type === "Trigger" && intent.cardId === idOf(made.state, code) && intent.effectId === `${code}:action:1`);

describe("Lost Island: \"Cannot have player card attachments.\" (B:2)", () => {
  it.each(["11027:B:2", "11030:B:2", "11031:B:2", "11072:B:2", "11073:B:2", "11074:B:2"])("%s bars a player attachment from the Lost Island in the staging area", (line) => {
    const code = codeOf(line);
    const made = make({ staging: [L(code)] });
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, code), "blade")).toBe(true);
    const bare = make({ staging: [L(code)], without: [line] });
    expect(attachBlocked(bare.state, bare.ctx, idOf(bare.state, code), "blade")).toBe(false);
  });

  it.each(["11027:B:2", "11031:B:2", "11072:B:2", "11073:B:2", "11074:B:2"])("%s does not bar one from the real side, which does not print it", (line) => {
    const code = codeOf(line);
    const made = make({ active: code });
    expect(made.state.cards[idOf(made.state, code)]?.face).not.toBe("B");
    expect(attachBlocked(made.state, made.ctx, idOf(made.state, code), "blade")).toBe(false);
  });
});

describe("Lost Island: \"Forced: After Lost Island becomes the active location, flip it over.\" (B:3)", () => {
  it.each(["11027:B:3", "11031:B:3", "11072:B:3", "11073:B:3", "11074:B:3"])("%s flips the Lost Island to its real side once the players travel to it, and all its progress comes off", (line) => {
    const code = codeOf(line);
    const made = make({ ...STOP, phase: "Travel", staging: [L(code, 2)] });
    const state = travel(made, code).state;
    const id = idOf(state, code);
    expect(state.activeLocation).toBe(id);
    // Flipping an Uncharted location removes all progress from it (dcce.uncharted).
    expect(state.cards[id]?.face).toBe("A");
    expect(state.cards[id]?.progress).toBe(0);
    const bare = make({ ...STOP, phase: "Travel", staging: [L(code, 2)], without: [line] });
    const kept = travel(bare, code).state;
    expect(kept.activeLocation).toBe(idOf(kept, code));
    expect(kept.cards[idOf(kept, code)]?.face).toBe("B");
  });
});

describe("Lost Island: \"Action: Remove 4 progress from Lost Island to look at its facedown side.\" (B:4)", () => {
  it.each(["11027:B:4", "11031:B:4", "11072:B:4", "11073:B:4", "11074:B:4"])("%s removes 4 progress to show the facedown side, and the card stays a Lost Island", (line) => {
    const code = codeOf(line);
    const made = make({ phase: "Planning", staging: [L(code, 5)] });
    const intent = lookAction(made, code);
    expect(intent).toBeDefined();
    const looking = send(start(made.state), intent as PlayerIntent, made.ctx).state;
    const id = idOf(looking, code);
    expect(looking.window).toMatchObject({ kind: "look", seat: 0, cardIds: [id] });
    expect(looking.cards[id]?.progress).toBe(1);
    // A look changes nothing: the card is still on its Lost Island side in the staging area, and none of its real side's Forced effects happened.
    const after = finish({ state: looking, steps: [] }, made.ctx).state;
    expect(after.cards[id]?.face).toBe("B");
    expect(after.cards[id]?.zone).toBe("staging");
    expect(after.activeLocation).toBeNull();
    // Without 4 progress the Action cannot be paid.
    expect(lookAction(make({ phase: "Planning", staging: [L(code, 3)] }), code)).toBeUndefined();
    expect(lookAction(make({ phase: "Planning", staging: [L(code, 5)], without: [line] }), code)).toBeUndefined();
  });
});

describe("Calphon's Upgraded side (110013:B:2, 110013:B:4)", () => {
  // The lines of both sides: Calphon's records on either side.
  const CONTROL = ["110013:A:1", "110013:B:2"];
  const LEAVES = ["110013:A:3", "110013:B:4"];

  it("110013:B:2 The first player gains control of Calphon, and he follows the first player token", () => {
    const made = make({ seats: 2, calphon: "B" });
    const calphon = made.calphon ?? "";
    expect(made.state.cards[calphon]?.face).toBe("B");
    expect(made.state.cards[calphon]?.controller).toBe(0);
    const passed = settle(syncConstants({ ...made.state, firstPlayer: 1 }, made.ctx), made.ctx, []);
    expect(passed.cards[calphon]?.controller).toBe(1);
    const bare = make({ seats: 2, calphon: "B", without: CONTROL });
    expect(settle(syncConstants({ ...bare.state, firstPlayer: 1 }, bare.ctx), bare.ctx, []).cards[bare.calphon ?? ""]?.controller).toBe(0);
  });

  it("110013:B:4 If Calphon leaves play, the players lose the game: destroyed by damage", () => {
    const gone = (made: Table) => {
      const hit = runInstruction({ ...made.state, window: null }, { verb: "DamageEach", amount: 3, pick: { type: "character", control: "any", names: ["Calphon"] } }, { seat: 0, sourceId: null }, made.ctx, []);
      return settle(syncConstants(hit, made.ctx), made.ctx, []);
    };
    const made = make({ calphon: "B" });
    const lost = gone(made);
    expect(lost.cards[made.calphon ?? ""]?.zone).not.toBe("play");
    expect(lost.lost).toBe(true);
    const bare = make({ calphon: "B", without: LEAVES });
    expect(gone(bare).lost).toBe(false);
  });

  it("110013:B:4 If Calphon leaves play, the players lose the game: discarded by a player card effect", () => {
    const gone = (made: Table) => {
      const next = runInstruction({ ...made.state, window: null }, { verb: "Discard", target: { kind: "self" } }, { seat: 0, sourceId: made.calphon }, made.ctx, []);
      return settle(syncConstants(next, made.ctx), made.ctx, []);
    };
    const made = make({ calphon: "B" });
    const lost = gone(made);
    expect(lost.cards[made.calphon ?? ""]?.zone).not.toBe("play");
    expect(lost.lost).toBe(true);
    expect(gone(make({ calphon: "B", without: LEAVES })).lost).toBe(false);
  });
});

describe("Revenant (11181:A:2, 11181:A:4)", () => {
  const statOf = (made: Table, which: "attack" | "defense") => modifiedStat(made.state, made.state.cards[idOf(made.state, CODES.revenant)]!, which, made.ctx.cards);

  it("11181:A:2 Revenant gets +2 Attack and +2 Defense for each resource on the campaign card", () => {
    for (const [resources, value] of [[0, 3], [1, 5], [2, 7]] as const) {
      const made = make({ staging: [CODES.revenant], campaign: true, campaignResources: resources });
      expect([statOf(made, "attack"), statOf(made, "defense")], `${resources}`).toEqual([value, value]);
    }
    // Engaged, it gets them as well.
    expect(statOf(make({ engaged: [{ code: CODES.revenant, seat: 0 }], campaign: true, campaignResources: 2 }), "attack")).toBe(7);
    const bare = make({ staging: [CODES.revenant], campaign: true, campaignResources: 2, without: ["11181:A:2"] });
    expect([statOf(bare, "attack"), statOf(bare, "defense")]).toEqual([3, 3]);
  });

  it("11181:A:4 After Revenant is destroyed it is shuffled into the encounter deck, and 1 resource is placed on the campaign card", () => {
    // Revenant has 3 hit points and takes 2 damage at a time (11181:A:3): two hits destroy it.
    const destroy = (layout: FateLayout): ScenarioState => {
      const made = make({ phase: "Combat", engaged: [{ code: CODES.revenant, seat: 0 }], deck: ["f0", "f3"], campaign: true, campaignResources: 1, ...layout });
      const hit = (state: ScenarioState) =>
        settle(syncConstants(runInstruction({ ...state, window: null }, { verb: "DamageEach", amount: 2, pick: { type: "enemy", control: "any", engaged: "you" } }, { seat: 0, sourceId: state.questStage }, made.ctx, []), made.ctx), made.ctx, []);
      return finish(start(hit(hit(made.state))), made.ctx).state;
    };
    const state = destroy({});
    const id = idOf(state, CODES.revenant);
    expect(state.cards[id]?.zone).toBe("encounterDeck");
    expect(state.encounterDeck).toHaveLength(3);
    expect(state.cards[idOf(state, CODES.campaignCard)]?.resources).toBe(2);
    const bare = destroy({ without: ["11181:A:4"] });
    expect(bare.cards[idOf(bare, CODES.revenant)]?.zone).not.toBe("encounterDeck");
    expect(bare.cards[idOf(bare, CODES.campaignCard)]?.resources).toBe(1);
  });
});
