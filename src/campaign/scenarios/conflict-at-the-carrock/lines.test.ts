// Rules: rr.action, rr.resource-match, rr.exhausted, rr.step-6-4-1, rr.first-player (data/rules/entries.json); ledger lines 02037:A:1, 02037:A:3, 02046:A:1.
// What a spec row cannot express on Conflict at the Carrock: a negative (a row must fail without its records), a cost, a legal intent, a game over several steps. Each test starts its title with the line id it covers.
import { describe, expect, it } from "vitest";

import type { PlayerIntent } from "../../../rules/engine/reduce.ts";

import { attack, defend, exhausted, rowProblems, type Row } from "../../../../test/harness/card-spec.ts";
import { EFFECTS } from "../../../effects/index.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { allyCard, finish, first, idsOf, legalIntents, revealFromTop, send, start, tableFromLayout, type Layout } from "../../../../test/harness/scene-kit.ts";

const GRIMBEORN = "02037";
const OAK_WOOD = "02046";

const table = (layout: Layout) => tableFromLayout("conflict-at-the-carrock", layout);
const holds = (row: Row): void => expect(rowProblems("conflict-at-the-carrock", row, EFFECTS)).toEqual([]);
const offeredAction = (made: ReturnType<typeof table>): PlayerIntent | undefined => legalIntents(start(made.state).state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(made.state, GRIMBEORN)) as PlayerIntent | undefined;

describe("negatives of the spec rows", () => {
  it("02037:A:1 exhausts to defend against an enemy that is not a Troll", () => {
    holds({ line: "02037:A:1", layout: { engaged: ["f3"], play: [GRIMBEORN] }, act: [attack("f3"), defend(GRIMBEORN)], expect: exhausted(GRIMBEORN) });
  });
});

describe("02037:A:3 Grimbeorn's Action", () => {
  it("02037:A:3 needs a Leadership resource: the stand-in heroes are Tactics heroes, so it is not offered", () => {
    expect(offeredAction(table({ staging: [GRIMBEORN], heroResources: 2, phase: "Planning" }))).toBeUndefined();
  });

  it("02037:A:3 is offered to any player while Oak-wood Grove lets every hero pay Leadership, and puts the resource on Grimbeorn in the staging area", () => {
    const made = table({ staging: [GRIMBEORN], active: OAK_WOOD, heroResources: 2, phase: "Planning" });
    const offered = offeredAction(made);
    expect(offered).toBeDefined();
    const used = send(start(made.state), { ...(offered as Extract<PlayerIntent, { type: "Trigger" }>), payments: [{ heroId: made.hero, amount: 1 }] }, made.ctx);
    const grimbeorn = first(used.state, GRIMBEORN);
    expect(used.state.cards[grimbeorn]).toMatchObject({ zone: "staging", resources: 1 });
    expect(used.state.cards[made.hero]?.resources).toBe(1);
  });

  it("02037:A:3 is offered again with resources already on him: there is no limit", () => {
    const made = table({ staging: [{ code: GRIMBEORN, resources: 3 }], active: OAK_WOOD, heroResources: 2, phase: "Planning" });
    expect(offeredAction(made)).toBeDefined();
  });
});

describe("900501:A:4 Conflict at the Carrock Nightmare", () => {
  const nightmare = (layout: Layout) => {
    const made = table(layout);
    const spawned = spawn(made.state, "900501", { zone: "nightmare" });
    const flagged = { ...spawned.state, modifiers: [...spawned.state.modifiers, { instanceId: "table", sourceId: spawned.id, stat: "noteQuestProgress" as const, amount: 1, until: "endOfGame" as const }] };
    return { ...made, state: flagged, setup: spawned.id };
  };
  // The quest phase played to its end with both heroes committed, or one (the quest fails against a Threat of 3): the progress the commitment placed is noted, then the Forced effect at the end of the phase reads it.
  function questPhase(made: ReturnType<typeof nightmare>, committed: boolean) {
    let run = start(made.state);
    for (let guard = 0; guard < 8 && run.state.mode === "questCommit"; guard += 1) {
      run = send(run, { type: "Commit", cardIds: committed ? [made.hero, made.hero2] : [made.hero] }, made.ctx);
      run = send(run, { type: "Pass" }, made.ctx);
    }
    return run;
  }

  it("900501:A:4 places 1 progress on the current quest at the end of a quest phase that placed none", () => {
    const made = nightmare({ stage: "02035", progress: 0, staging: ["f3"], phase: "Quest" });
    const run = questPhase(made, false);
    expect(run.state.cards[made.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("900501:A:4 places nothing when the quest placed progress on the quest card this phase", () => {
    const made = nightmare({ stage: "02035", progress: 0, phase: "Quest" });
    const run = questPhase(made, true);
    expect(run.state.cards[made.state.questStage ?? ""]?.progress).toBe(4);
  });
});

describe("02047:A:1 A Frightened Beast", () => {
  const withCreature = (layout: Layout) => {
    const made = table({ deck: ["f0"], ...layout });
    made.cards.set("beast", allyCard("beast", 1, { traits: ["Creature"] }));
    const ally = spawn(made.state, "beast", { zone: "play", seat: 0 });
    return { ...made, state: ally.state, ally: ally.id };
  };
  const revealed = (made: ReturnType<typeof withCreature>, choose: string) => {
    const steps: EngineStep[] = [];
    return finish({ state: revealFromTop(made.state, made.ctx, "02047", steps).state, steps }, made.ctx, (state) => (state.window?.kind === "choose" && state.window.options.includes(choose) ? choose : (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : ""))).state;
  };

  it("02047:A:1 is canceled for everyone when a player discards a Creature ally he controls", () => {
    const made = withCreature({ seats: 2, staging: ["f3", "place"] });
    const after = revealed(made, "discard");
    expect(after.cards[made.ally]?.zone).toBe("discard");
    expect(after.seats[0]?.threat).toBe(28);
    expect(after.seats[1]?.threat).toBe(28);
  });

  it("02047:A:1 raises every player's threat by the staging area's Threat when no ally is discarded", () => {
    const made = withCreature({ seats: 2, staging: ["f3", "place"] });
    const after = revealed(made, "keep");
    expect(after.cards[made.ally]?.zone).toBe("play");
    expect(after.seats[0]?.threat).toBe(33);
    expect(after.seats[1]?.threat).toBe(33);
  });
});

describe("900510:A:1 Time for Supper", () => {
  it("900510:A:1 removes a hero in a discard pile from the game and heals every Troll; it has no Surge when a Troll was damaged", () => {
    const made = table({ engaged: [{ code: "900502", damage: 3 }], staging: [{ code: "900502", damage: 2 }], deck: ["f0"] });
    const gone = spawn(made.state, "dh3", { zone: "discard", seat: 0 });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(gone.state, made.ctx, "900510", steps).state, steps }, made.ctx);
    expect(run.state.cards[gone.id]?.zone).toBe("removed");
    expect(idsOf(run.state, "900502").map((id) => run.state.cards[id]?.damage)).toEqual([0, 0]);
    expect(run.state.cards[first(run.state, "f0")]?.zone).toBe("encounterDeck");
  });

  it("900510:A:1 gains Surge when no Troll was damaged", () => {
    const made = table({ engaged: ["900502"], deck: ["f0"] });
    const steps: EngineStep[] = [];
    const run = finish({ state: revealFromTop(made.state, made.ctx, "900510", steps).state, steps }, made.ctx);
    expect(run.state.cards[first(run.state, "f0")]?.zone).not.toBe("encounterDeck");
  });
});

describe("02038:A:2 After defeating a Troll, a Sacked! may be discarded", () => {
  const defeat = (code: string, seats: 1 | 2 = 1) => {
    const made = table({ seats, phase: "PlayerAttacks", engaged: [{ code, damage: 100 }] });
    const sacked = spawn(made.state, "02048", { zone: "play", seat: 0 });
    const hosted = attachTo(moveCard(sacked.state, sacked.id, { zone: "attached" }), sacked.id, made.hero);
    return { made, state: hosted, sacked: sacked.id };
  };

  it("02038:A:2 offers the discard to a player after he defeats Louis, and puts the Sacked! in the encounter discard pile", () => {
    const { made, state, sacked } = defeat("02038");
    const run = finish(send(start(state), { type: "DeclareAttackers", enemyId: first(state, "02038"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    const offered = legalIntents(run.state, made.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, "02038"));
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, made.ctx), made.ctx);
    expect(used.state.cards[sacked]?.zone).toBe("encounterDiscard");
  });

  it("02038:A:2 is not offered with no Sacked! in play", () => {
    const made = table({ phase: "PlayerAttacks", engaged: [{ code: "02038", damage: 100 }] });
    const run = finish(send(start(made.state), { type: "DeclareAttackers", enemyId: first(made.state, "02038"), attackerIds: [made.hero] }, made.ctx), made.ctx);
    expect(legalIntents(run.state, made.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === first(run.state, "02038"))).toBe(false);
  });
});
