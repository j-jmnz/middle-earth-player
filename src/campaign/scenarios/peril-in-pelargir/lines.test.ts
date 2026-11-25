// Rules: rr.attachment-cards, rr.objective-cards, rr.ownership-and-control, rr.forced, rr.damage, rr.shadow-effects, rr.optional-engagement, rr.engagement-check, rr.travel, rr.reveal, rr.cancel, rr.quest-advancement, rr.step-3-4, hon.battle, mec109.setup (data/rules/entries.json).
// The lines of Peril in Pelargir that a card-spec row cannot show (spec.test.ts holds the rest): the ones that need Alcaron's Scroll on a hero or on an enemy, a played Setup, a refused travel, an engagement the player chose, a held-back stage and the
// first enemy of a round: 05019:A:1, 05019:A:2, 05020:A:1, 05020:A:2, 05021:A:1, 05024:A:2, 05037:A:2, 05038:A:2, 05039:A:2, 05040:A:1, 05041:A:1, 05042:A:1, 05043:A:1, 05044:A:2, 05065:A:1, 05065:B:1, 05066:B:1, 05066:B:2, 05066:B:3, 05067:B:1, 05067:B:2, 05067:B:3.
// Each test builds its moment with the scene kit (the Setup test starts the game and plays nothing else). The stand-in heroes have 2 Willpower, 2 Attack, 2 Defense and 6 hit points. The Scroll is put on a hero with `scrollTable` (test/scenarios/peril-in-pelargir/scroll.ts).
import { describe, expect, it } from "vitest";

import { EFFECTS } from "../../../effects/index.ts";
import type { EngineStep } from "../../../rules/core/intents.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { destroyCard, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type GameEvent, type ScenarioState } from "../../../rules/core/state.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { legalIntents, legalTargets, reduce, startScenario, type PlayerIntent } from "../../../rules/engine/reduce.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { questStatOf } from "../../../rules/quest/quest.ts";
import { topFrame } from "../../../rules/windows/windows.ts";
import { pushCardEffects } from "../../../rules/interpret/effect-frames.ts";
import { fightEnemy, finish, first, idOf, idsOf, resolveRecords, revealFromTop, send, start, tableFromLayout, type Layout, type LayoutTable } from "../../../../test/harness/scene-kit.ts";
import { pelargirStart, pelargirWorld } from "../../../../test/scenarios/peril-in-pelargir/game.ts";
import { announced, SCENARIO, SCROLL, scrollTable } from "../../../../test/scenarios/peril-in-pelargir/scroll.ts";

const THUG = "05020";
const FISH = "05021";
const ZEALOUS = "05042";
const BANDIT = "05043";
const ASSASSIN = "05044";
const PICKPOCKET = "05037";

describe("05065:A:1 Setup", () => {
  it("05065:A:1 leaves exactly one Alcaron's Scroll in the game, attached to a hero, with The Leaping Fish the active location", async () => {
    const { ctx } = await pelargirWorld();
    for (const seats of [1, 2] as const) {
      let state = startScenario(pelargirStart(seats, 3, "Normal"), ctx);
      // Each seat keeps its hand, then the first player chooses the hero for the Scroll.
      for (let guard = 0; guard < 12 && (state.window?.kind === "mulligan" || state.window?.kind === "choose"); guard += 1) {
        const intent: PlayerIntent = state.window.kind === "mulligan" ? { type: "Keep" } : { type: "Choose", optionId: state.window.options[0] ?? "" };
        state = expectOk(reduce(state, intent, ctx)).state;
      }
      const scrolls = idsOf(state, SCROLL);
      expect(scrolls).toHaveLength(1);
      const scroll = state.cards[scrolls[0] ?? ""];
      expect(scroll?.zone).toBe("attached");
      expect(state.seats.flatMap((seat) => seat.heroes)).toContain(scroll?.host);
      expect(scroll?.claimed).toBe(true);
      expect(state.cards[idOf(state, FISH)]?.zone).toBe("activeLocation");
      expect(state.encounterDeck.map((id) => state.cards[id]?.code)).not.toContain(SCROLL);
    }
  });
});

describe("05019 Alcaron's Scroll", () => {
  it("05019:A:1 an unattached Scroll lies in the staging area and gains the Action: a ready hero exhausts to attach it", () => {
    const table = tableFromLayout(SCENARIO, { staging: [SCROLL], phase: "Planning" });
    const scroll = idOf(table.state, SCROLL);
    const run = start(table.state);
    const action = legalIntents(run.state, table.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === scroll);
    expect(action).toBeDefined();
    const done = finish(send(run, action as PlayerIntent, table.ctx), table.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === "dh2") ?? "") : ""));
    expect(done.state.cards[scroll]?.host).toBe(idOf(done.state, "dh2"));
    expect(done.state.cards[scroll]?.zone).toBe("attached");
    expect(done.state.cards[idOf(done.state, "dh2")]?.exhausted).toBe(true);
    expect(done.state.staging).not.toContain(scroll);
  });

  it("05019:A:1 when its hero leaves play the Scroll returns to the staging area, not the discard pile", () => {
    const table = scrollTable({});
    const scroll = idOf(table.state, SCROLL);
    const gone = destroyCard(table.state, table.hero, table.ctx.cards, []);
    expect(gone.cards[scroll]?.zone).toBe("staging");
    expect(gone.cards[scroll]?.host ?? null).toBeNull();
  });

  it("05019:A:2 Forced: the hero with the Scroll damaged by an enemy attack passes it to that enemy", () => {
    const table = scrollTable({ engaged: [THUG] });
    const scroll = idOf(table.state, SCROLL);
    const thug = idOf(table.state, THUG);
    const state = announced(table, { trigger: "damagedByAttack", seat: 0, cardId: table.hero, subject: table.hero, other: thug, amount: 1 } as GameEvent);
    expect(state.cards[scroll]?.host).toBe(thug);
    expect(state.cards[scroll]?.zone).toBe("attached");
    expect(state.cards[scroll]?.claimed).toBe(true);
    expect(state.cards[scroll]?.controller).toBeNull();
    expect(state.cards[thug]?.attachments).toContain(scroll);
    expect(state.cards[table.hero]?.attachments).not.toContain(scroll);
  });

  it("05019:A:2 another hero's damage leaves the Scroll where it is", () => {
    const table = scrollTable({ engaged: [THUG] });
    const state = announced(table, { trigger: "damagedByAttack", seat: 0, cardId: table.hero2, subject: table.hero2, other: idOf(table.state, THUG), amount: 1 } as GameEvent);
    expect(state.cards[idOf(state, SCROLL)]?.host).toBe(table.hero);
  });

  it("05019:A:2 as the engine runs it, lethal damage destroys the hero before the Forced: the Scroll goes to the staging area and not to the enemy (the printed order, the Scroll first, needs core/destroy.ts; reading in the scenario file, Engine notes)", () => {
    const hurt = (made: Layout): LayoutTable => scrollTable(made);
    const result = fightEnemy(hurt, "f0", THUG, {}, { tweak: (state, made) => updateCard(state, made.hero, { damage: 5 }) });
    const state = result.run.state;
    expect(state.cards[result.made.hero]?.zone).not.toBe("heroes");
    expect(state.cards[idOf(state, SCROLL)]?.zone).toBe("staging");
  });
});

describe("05020 Harbor Thug and 05024 Collateral Damage as a shadow card", () => {
  const raised = (seat: 0 | 1): GameEvent => ({ trigger: "threatRaised", seat, amount: 1 }) as GameEvent;

  it("05020:A:1 Forced: when the player whose hero has the Scroll raises his threat, the Thug in the staging area engages him", () => {
    const table = scrollTable({ staging: [THUG], threat: [20, 20] });
    expect(announced(table, raised(0)).cards[idOf(table.state, THUG)]?.zone).toBe("engaged");
  });

  it("05020:A:1 the Thug engaged with another player moves to the player whose hero has the Scroll", () => {
    const table = scrollTable({ seats: 2, engaged: [{ code: THUG, seat: 1 }], threat: [20, 20] });
    const state = announced(table, raised(0));
    expect(state.cards[idOf(state, THUG)]?.controller).toBe(0);
  });

  it("05020:A:1 another player's threat raise does nothing", () => {
    const table = scrollTable({ seats: 2, staging: [THUG], threat: [20, 20] });
    expect(announced(table, raised(1)).cards[idOf(table.state, THUG)]?.zone).toBe("staging");
  });

  it("05020:A:1 with the Scroll on no hero the Thug stays in the staging area", () => {
    const table = tableFromLayout(SCENARIO, { staging: [THUG, SCROLL], threat: [20, 20] });
    expect(announced(table, raised(0)).cards[idOf(table.state, THUG)]?.zone).toBe("staging");
  });

  const fight = (shadow: string, layout: Layout = {}, undefended = false) => fightEnemy((made: Layout) => scrollTable(made, "dh2"), shadow, THUG, layout, { undefended });
  it.each([["05020:A:2", THUG], ["05024:A:2", "05024"]])("%s Shadow: any damage dealt by this attack is dealt to the hero with the Scroll", (_line, shadow) => {
    const result = fight(shadow);
    expect(result.run.state.cards[result.made.hero]?.damage).toBe(0);
    expect(result.run.state.cards[result.made.hero2]?.damage).toBeGreaterThan(0);
  });
  it("05024:A:2 an undefended attack's damage goes to the hero with the Scroll too", () => {
    const result = fight("05024", {}, true);
    expect(result.run.state.cards[result.made.hero]?.damage).toBe(0);
    expect(result.run.state.cards[result.made.hero2]?.damage).toBeGreaterThan(0);
  });
  // A stand-in ally of the other player with Sentinel defends the first player's attack: the damage is still the attack's, so it goes to the Scroll hero, and the Spearman takes none.
  const sentinel = { seats: 2 as const, play: [{ code: "ally", seat: 1 }] };
  const sentineled = (shadow: string, options: { undefended?: boolean } = {}) =>
    fightEnemy((made: Layout) => scrollTable(made, "dh2"), shadow, THUG, sentinel, {
      ...options,
      defender: (made) => idOf(made.state, "ally"),
      tweak: (state, made) => ({ ...state, modifiers: [...state.modifiers, { instanceId: idOf(state, "ally"), sourceId: made.hero, stat: "sentinel" as const, amount: 1, until: "endOfGame" as const }] }),
    });
  it.each([["05020:A:2", THUG], ["05024:A:2", "05024"]])("%s Shadow: a Sentinel defender of another player takes none of the attack's damage; the Scroll hero takes it", (_line, shadow) => {
    const result = sentineled(shadow);
    const state = result.run.state;
    expect(state.cards[idOf(state, "ally")]?.damage).toBe(0);
    expect(state.cards[result.made.hero2]?.damage).toBeGreaterThan(0);
  });
  it("05024:A:2 non-combat damage dealt to the attacked player's characters during the attack is not sent to the Scroll hero", () => {
    const table = scrollTable({ engaged: [THUG], deck: ["05024", "f0"] }, "dh2");
    const thug = idOf(table.state, THUG);
    const shadowed = { ...table.state, pendingAttack: { enemyId: thug, seat: 0, defenderId: table.hero }, modifiers: [...table.state.modifiers, { instanceId: thug, sourceId: thug, stat: "damageToScroll" as const, amount: 1, until: "endOfAttack" as const }] };
    const hit = placeDamage(shadowed, table.hero, 1, table.ctx.cards, [], "framework", UNATTRIBUTED);
    expect(hit.cards[table.hero]?.damage).toBe(1);
    expect(hit.cards[table.hero2]?.damage).toBe(0);
  });
  it("05020:A:2 with the Scroll on no hero the damage stays with the defender", () => {
    const result = fightEnemy((made: Layout) => tableFromLayout(SCENARIO, made), THUG, THUG, {});
    expect(result.run.state.cards[result.made.hero]?.damage).toBeGreaterThan(0);
  });
});

describe("05021 The Leaping Fish", () => {
  const questBegins = { trigger: "beginningOfPhase", seat: null, phase: "Quest" } as unknown as GameEvent;

  it("05021:A:1 with the Scroll on a hero, at the beginning of the quest phase it discards X cards (X the players) and adds each enemy among them to the staging area", () => {
    const table = scrollTable({ phase: "Quest", staging: [FISH], deck: [THUG, "f0", "f0", "f0"] });
    const state = announced(table, questBegins);
    expect(state.cards[idOf(state, THUG)]?.zone).toBe("staging");
    expect(state.encounterDeck).toHaveLength(3);
  });

  it("05021:A:1 two players: two cards", () => {
    const table = scrollTable({ seats: 2, phase: "Quest", staging: [FISH], deck: [THUG, ZEALOUS, "f0", "f0"] });
    const state = announced(table, questBegins);
    expect(state.encounterDeck).toHaveLength(2);
    expect(state.cards[idOf(state, ZEALOUS)]?.zone).toBe("staging");
  });

  it("05021:A:1 with the Scroll on no hero nothing is discarded", () => {
    const table = tableFromLayout(SCENARIO, { phase: "Quest", staging: [FISH, SCROLL], deck: [THUG, "f0", "f0"] });
    expect(announced(table, questBegins).encounterDeck).toHaveLength(3);
  });
});

describe("05041 Local Trouble", () => {
  // The hero's own Action is a triggered ability: Glorfindel's pays 1 resource to heal 1 damage, exhausts nothing and readies nothing, so the one raise is the line's third event.
  const glorfindel = (trouble: boolean) => {
    const table = tableFromLayout(SCENARIO, { heroes: [{ code: "01011", resources: 1 }], ...(trouble ? { attached: [{ code: "05041", to: "01011" }] } : {}) }, { extra: ["01011"] });
    const damaged = { ...table.state, cards: { ...table.state.cards, [table.hero]: { ...table.state.cards[table.hero]!, damage: 1 } } };
    const hero = idOf(damaged, "01011");
    const trigger = legalIntents(damaged, table.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === hero);
    expect(trigger).toBeDefined();
    const done = finish(send({ state: damaged, steps: [] }, { ...trigger, payments: [{ heroId: hero, amount: 1 }] } as PlayerIntent, table.ctx), table.ctx);
    return { before: damaged.seats[0]?.threat ?? 0, after: done.state.seats[0]?.threat, exhausted: done.state.cards[hero]?.exhausted };
  };

  it("05041:A:1 when the attached hero triggers an ability, his controller raises his threat by 1: Glorfindel's Action, with no exhaust or ready in it", () => {
    const run = glorfindel(true);
    expect(run.exhausted).toBe(false);
    expect(run.after).toBe(run.before + 1);
  });

  it("05041:A:1 a hero without Local Trouble that triggers the same ability raises no threat", () => {
    const run = glorfindel(false);
    expect(run.after).toBe(run.before);
  });
});

describe("05037 Pickpocket, 05038 City Street and 05039 Market Square", () => {
  it("05037:A:2 Shadow: the Scroll on his hero is one of his attachments, and a Local Trouble is not (it is not his)", () => {
    const withTrouble = fightEnemy((made: Layout) => scrollTable(made), PICKPOCKET, "f3", { attached: [{ code: "05041", to: "dh1" }] }, {});
    const state = withTrouble.run.state;
    expect(state.cards[idOf(state, "05041")]?.zone).not.toBe("encounterDiscard");
    expect(state.cards[idOf(state, SCROLL)]?.zone).toBe("staging");
  });

  it("05038:A:2 the players can travel to City Street and to another copy of it, and to no location with another title", () => {
    const table = tableFromLayout(SCENARIO, { staging: ["05038", "05021", "05038"], phase: "Travel" });
    const run = start(table.state);
    const targets = legalTargets(run.state, { type: "Travel" } as never, table.ctx);
    expect(targets).toEqual(idsOf(table.state, "05038").filter((id) => targets.includes(id)));
    expect(targets.length).toBe(2);
    expect(targets).not.toContain(idOf(table.state, "05021"));
  });

  it("05038:A:2 with no City Street in the staging area the players travel anywhere", () => {
    const table = tableFromLayout(SCENARIO, { staging: ["05021", "05022"], phase: "Travel" });
    expect(legalTargets(start(table.state).state, { type: "Travel" } as never, table.ctx)).toHaveLength(2);
  });

  // The travel intent and the payments it asks for. The players' answers are the first option of each Choose window; the game goes on into the resource phase, where every hero gains 1, so a hero that paid holds what it had, one that did not holds 1 more.
  function traveled(layout: Layout, pick: (state: ScenarioState) => string): ScenarioState {
    const table = tableFromLayout(SCENARIO, { staging: ["05039"], phase: "Travel", ...layout });
    let run = send(start(table.state), { type: "Travel", locationId: idOf(table.state, "05039") } as PlayerIntent, table.ctx);
    for (let guard = 0; guard < 6 && run.state.window?.kind === "choose"; guard += 1) run = send(run, { type: "Choose", optionId: pick(run.state) }, table.ctx);
    return run.state;
  }
  const first1 = (state: ScenarioState): string => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "");
  const resourcesOf = (state: ScenarioState, code: string): number => state.cards[idOf(state, code)]?.resources ?? 0;

  it("05039:A:2 each player spends 1 resource from one of his heroes (a player with one hero pays with no choice)", () => {
    const state = traveled({ seats: 2, heroResources: 1 }, first1);
    expect([resourcesOf(state, "dh1"), resourcesOf(state, "dh2"), resourcesOf(state, "dh3")]).toEqual([1, 2, 1]);
    expect(state.cards[idOf(state, "05039")]?.zone).toBe("activeLocation");
  });

  it("05039:A:2 the players cannot travel to it when a player cannot pay", () => {
    const table = tableFromLayout(SCENARIO, { seats: 2, staging: ["05039"], phase: "Travel", heroResources: 1 });
    const poor = updateCard(table.state, idOf(table.state, "dh3"), { resources: 0 });
    const refused = reduce(start(poor).state, { type: "Travel", locationId: idOf(poor, "05039") } as PlayerIntent, table.ctx);
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.reason).toMatch(/cannot pay/);
  });

  it("05039:A:2 the cost is paid from the pool of any hero the player chooses, whatever its sphere: no hero is barred", () => {
    const state = traveled({ heroResources: 1 }, (open) => (open.window?.kind === "choose" ? (open.window.options.find((id) => open.cards[id]?.code === "dh2") ?? "") : ""));
    expect([resourcesOf(state, "dh1"), resourcesOf(state, "dh2")]).toEqual([2, 1]);
  });
});

describe("05040 Lost in the City", () => {
  // The bar of the When Revealed frame, read as the engine reads it while the effect resolves: the card is revealed, so it lies in no staging area, and in the discard pile once it has resolved.
  const barHolds = (code: string, zone: "encounterDeck" | "discard"): boolean | undefined => {
    const table = tableFromLayout(SCENARIO, { staging: [code] });
    const source = idOf(table.state, code);
    const records = EFFECTS.filter((effect) => effect.cardCode === code && effect.timing === "whenRevealed");
    const pushed = pushCardEffects({ ...table.state, window: null }, "whenRevealed", source, 0, false, records, table.ctx, []);
    const bar = topFrame(pushed)?.data;
    if (bar?.kind !== "effect" || bar.blockCancel == null) return undefined;
    const away = { ...pushed, cards: { ...pushed.cards, [source]: { ...pushed.cards[source]!, zone: zone === "discard" ? ("encounterDiscard" as const) : ("encounterDeck" as const) } } };
    return holds(away, bar.blockCancel, { actor: 0, sourceId: source, returned: 0 }, table.ctx);
  };

  it("05040:A:1 #uncancelable: this effect cannot be canceled, whatever zone the card lies in (a revealed treachery is never in the staging area); another treachery's When Revealed has no bar", () => {
    expect(barHolds("05040", "encounterDeck")).toBe(true);
    expect(barHolds("05040", "discard")).toBe(true);
    expect(barHolds("05041", "discard")).toBeUndefined();
  });
});

describe("05042, 05043 and 05044: optional engagement and the engagement check", () => {
  // The player chooses the engagement in the optional engagement step, or declines it and the engagement check engages the enemy (the engagement costs are at most 40 and the stand-in threat is 28 or more for the first two).
  function engagedBy(code: string, optional: boolean, layout: Layout): ScenarioState {
    const table = tableFromLayout(SCENARIO, { phase: "Encounter", staging: [code], threat: [45, 45], ...layout });
    const enemy = idOf(table.state, code);
    const run = send(start(table.state), optional ? { type: "Engage", enemyId: enemy } : { type: "DeclineEngage" }, table.ctx);
    return finish(run, table.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === "dh1") ?? state.window.options[0] ?? "") : "")).state;
  }
  const ally = (state: ScenarioState): { damage: number; zone: string } => ({ damage: state.cards[idOf(state, "ally")]?.damage ?? 0, zone: state.cards[idOf(state, "ally")]?.zone ?? "" });

  it("05042:A:1 optionally engaged: 1 damage to each ally he controls; engaged by the engagement check: 2 damage", () => {
    expect(ally(engagedBy(ZEALOUS, true, { play: ["ally"] }))).toEqual({ damage: 1, zone: "play" });
    expect(ally(engagedBy(ZEALOUS, false, { play: ["ally"] })).zone).toBe("discard");
  });

  it("05043:A:1 optionally engaged: 1 resource from each hero; engaged by the engagement check: 2 resources", () => {
    const resources = (state: ScenarioState): number[] => ["dh1", "dh2"].map((code) => state.cards[idOf(state, code)]?.resources ?? 0);
    expect(resources(engagedBy(BANDIT, true, { heroResources: 3 }))).toEqual([2, 2]);
    expect(resources(engagedBy(BANDIT, false, { heroResources: 3 }))).toEqual([1, 1]);
  });

  it("05044:A:2 optionally engaged: 3 damage to a hero he chooses; engaged by the engagement check: that hero is discarded", () => {
    const optional = engagedBy(ASSASSIN, true, {});
    expect(optional.cards[idOf(optional, "dh1")]).toMatchObject({ damage: 3, zone: "heroes" });
    const forced = engagedBy(ASSASSIN, false, {});
    expect(forced.cards[idOf(forced, "dh1")]?.zone).not.toBe("heroes");
  });

  it("05067:B:1 enemies cannot be optionally engaged: no enemy is offered for it, the player may only decline", () => {
    const table = tableFromLayout(SCENARIO, { stage: "05067", phase: "Encounter", staging: [ZEALOUS], threat: [45, 45] });
    const run = start(table.state);
    expect(legalIntents(run.state, table.ctx).map((intent) => intent.type)).toEqual(["DeclineEngage"]);
    const plain = tableFromLayout(SCENARIO, { phase: "Encounter", staging: [ZEALOUS], threat: [45, 45] });
    expect(legalIntents(start(plain.state).state, plain.ctx).map((intent) => intent.type)).toContain("Engage");
  });
});

describe("05065, 05066 and 05067: the quest stages", () => {
  const questsWith = (stage: string): string => {
    const table = tableFromLayout(SCENARIO, { stage });
    return questStatOf(table.state, table.hero, table.ctx.cards);
  };
  it("05065:B:1 Battle: the characters use their Attack instead of Willpower when questing", () => {
    expect(questsWith("05065")).toBe("attack");
    expect(questsWith("05067")).toBe("willpower");
  });
  it("05066:B:1 Battle: the characters use their Attack instead of Willpower when questing", () => {
    expect(questsWith("05066")).toBe("attack");
  });

  // A stage whose quest points are reached while the Scroll is on no hero keeps its progress and does not advance; it advances once the Scroll is attached to a hero.
  const settled = (table: LayoutTable): ScenarioState => settle({ ...table.state, window: null }, table.ctx, []);

  it("05066:B:2 the players cannot advance to the next stage unless the Scroll is attached to a hero: the stage holds its progress and advances when it is", () => {
    const layout: Layout = { stage: "05066", progress: 13 };
    const held = settled(tableFromLayout(SCENARIO, { ...layout, staging: [SCROLL] }));
    expect(held.cards[idOf(held, "05066")]?.zone).toBe("questStage");
    expect(held.cards[idOf(held, "05066")]?.progress).toBe(13);
    const free = settled(scrollTable(layout));
    expect(free.cards[idOf(free, "05067")]?.zone).toBe("questStage");
  });

  it("05067:B:3 the players cannot defeat this stage unless the Scroll is attached to a hero; defeating the last stage wins the game", () => {
    const layout: Layout = { stage: "05067", progress: 15 };
    const held = settled(tableFromLayout(SCENARIO, { ...layout, staging: [SCROLL] }));
    expect(held.stageCleared ?? false).toBe(false);
    expect(held.cards[idOf(held, "05067")]?.progress).toBe(15);
    const free = settled(scrollTable(layout));
    expect(free.stageCleared).toBe(true);
  });

  it("05066:B:3 When Revealed: the Scroll, from a hero, goes to the highest engagement cost enemy in play, the staging area included", () => {
    const table = scrollTable({ stage: "05066", engaged: [THUG], staging: [ASSASSIN, ZEALOUS] });
    const made = resolveRecords(table.state, table.ctx, "05066", "whenRevealed", first(table.state, "05066"));
    const done = finish(made, table.ctx);
    expect(done.state.cards[idOf(done.state, SCROLL)]?.host).toBe(idOf(done.state, ASSASSIN));
    expect(done.state.cards[idOf(done.state, SCROLL)]?.controller ?? null).toBeNull();
  });

  it("05066:B:3 with no enemy in play the Scroll is added to the staging area", () => {
    const table = scrollTable({ stage: "05066" });
    const done = finish(resolveRecords(table.state, table.ctx, "05066", "whenRevealed", first(table.state, "05066")), table.ctx);
    expect(done.state.cards[idOf(done.state, SCROLL)]?.zone).toBe("staging");
  });

  it("05067:B:2 the first enemy the encounter deck reveals each round attacks the player whose hero has the Scroll from the staging area; no later enemy does", () => {
    const table = scrollTable({ stage: "05067", seats: 2, deck: ["f0", "f0", "f0"] });
    const steps: EngineStep[] = [];
    const one = revealFromTop(table.state, table.ctx, THUG, steps);
    expect(one.state.pendingAttack).toMatchObject({ enemyId: idOf(one.state, THUG), seat: 0, fromStaging: true });
    expect(one.state.cards[idOf(one.state, THUG)]?.zone).toBe("staging");
    const attacked = finish({ state: one.state, steps }, table.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "")).state;
    const two = revealFromTop({ ...attacked, pendingAttack: null }, table.ctx, ZEALOUS, steps);
    expect(two.state.pendingAttack ?? null).toBeNull();
    expect(flagged(two.state, idOf(two.state, ZEALOUS), "firstEnemy")).toBe(false);
  });
});
