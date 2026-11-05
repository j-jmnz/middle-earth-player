// Rules: emce.boon-allies, emce.campaign-pool-encounter, emce.treasure, emce.caves-deck, rr.response, rr.action, rr.cancel, rr.search, rr.mulligan, rr.then (data/rules/entries.json); ledger lines 12176:A:3 to 12183:A:1 and the cards of the pool the earlier parts left (12166 to 12174).
// The Accolade boons (12176 to 12179), the Song boons (12180 to 12183) and the boons and burdens the earlier parts put in the pool, on the scenario's scene and in dealt games: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { reduce, startScenario, type ReduceContext } from "../../../rules/engine/reduce.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { flagged, updateCard, type ScenarioState } from "../../../rules/core/state.ts";
import { readyBarred } from "../../../rules/core/holder-classes.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { expectOk } from "../../../rules/core/test-fixture.ts";
import { emptyLog, poolCard, type CampaignLog } from "../../log.ts";
import { heathStart, heathWorld } from "../../../../test/scenarios/the-withered-heath/game.ts";
import { CODES, codesIn, finish, heathTable, idOf, legalIntents, loadHeathWorld, resolveRecords, send, start, type HeathWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-withered-heath/scene.ts";

let world: HeathWorld;
let dealtCtx: ReduceContext;
beforeAll(async () => {
  world = await loadHeathWorld();
  dealtCtx = (await heathWorld("strong")).ctx;
}, 120_000);

type Layout = Parameters<typeof heathTable>[1];
type Table = ReturnType<typeof heathTable>;
const takes = (code: string) => (state: ScenarioState) => (state.window?.kind === "choose" ? (state.window.options.find((id) => state.cards[id]?.code === code || id === code) ?? state.window.options[0] ?? "") : "");
// The table with the boon attached to the first hero (or the hero of seat 1).
function carrying(layout: Layout, codes: readonly string[], on: "hero" | "seat1" = "hero"): Table {
  const t = heathTable(world, layout);
  let state = t.state;
  for (const code of codes) {
    const made = spawn(state, code, { zone: "play", seat: on === "hero" ? 0 : 1 });
    state = attachTo(made.state, made.id, on === "hero" ? t.hero : (t.seat1Hero ?? ""));
  }
  return { ...t, state: syncConstants(state, t.ctx) };
}
const trigger = (state: ScenarioState, t: Table, effectId: string): PlayerIntent | undefined => legalIntents(state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === effectId) as PlayerIntent | undefined;
// A table where a hero has the resources to pay for a neutral event of cost 1.
const funded = (t: Table): Table => ({ ...t, state: updateCard(t.state, t.hero, { resources: 3 }) });
const play = (t: Table, code: string, pick?: (state: ScenarioState) => string): Run => finish(send(start(t.state), { type: "PlayCard", cardId: idOf(t.state, code), payments: [{ heroId: t.hero, amount: 1 }] } as PlayerIntent, t.ctx), t.ctx, pick);

describe("12176 Master of the Hunt", () => {
  it("12176:A:3 the attached hero gets +1 hit point", () => {
    const t = carrying({}, [CODES.masterOfTheHunt]);
    const bare = heathTable(world, {});
    const printed = world.cards.get(t.state.cards[t.hero]?.code ?? "")?.health ?? 0;
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "hitPoints", world.cards)).toBe(printed + 1);
    expect(modifiedStat(bare.state, bare.state.cards[bare.hero]!, "hitPoints", world.cards)).toBe(printed);
  });

  const committing = (layout: Layout = {}) => {
    const t = carrying({ deckOf: ["f0", "f3", "place", "treachery", "mild"], ...layout }, [CODES.masterOfTheHunt]);
    return { t, run: send(start(t.state), { type: "Commit", cardIds: [t.hero] }, t.ctx) };
  };

  it("12176:A:4 after the hero commits to the quest the chosen player looks at the top 3 cards of their deck, puts 1 on top and the rest on the bottom in any order", () => {
    const { t, run } = committing();
    expect(trigger(run.state, t, "12176:response:1")).toBeDefined();
    const deck = (state: ScenarioState) => state.seats[0]?.deck.map((id) => state.cards[id]?.code) ?? [];
    expect(deck(run.state)).toEqual(["f0", "f3", "place", "treachery", "mild"]);
    // Keep "place" on top (the third looked at); the rest go to the bottom: "f3", then "f0" (the order chosen).
    const asked: string[][] = [];
    const used = finish(send(run, trigger(run.state, t, "12176:response:1") as PlayerIntent, t.ctx), t.ctx, (state) => {
      if (state.window?.kind !== "choose") return "";
      asked.push(state.window.options.map((id) => state.cards[id]?.code ?? id));
      return asked.length === 1 ? takes("place")(state) : takes("f3")(state);
    });
    expect(asked[0]).toEqual(["f0", "f3", "place"]);
    expect(asked[1]).toEqual(["f0", "f3"]);
    expect(deck(used.state)).toEqual(["place", "treachery", "mild", "f3", "f0"]);
  });

  it("12176:A:4 the player chosen may be another: they look at their own deck and put the cards back as they choose", () => {
    const { t, run } = committing({ seats: 2, deckOf: [] });
    const withDeck = ["f0", "f3", "place"].reduce((state, code) => spawn(state, code, { zone: "deck", seat: 1 }, "down").state, run.state);
    const asked: { seat: number; options: string[] }[] = [];
    const used = finish(send({ ...run, state: withDeck }, trigger(withDeck, t, "12176:response:1") as PlayerIntent, t.ctx), t.ctx, (state) => {
      if (state.window?.kind !== "choose") return "";
      asked.push({ seat: state.window.seat, options: [...state.window.options] });
      // The first question is the player chosen (the other seat); then that player puts the cards back: "f0" stays on top, "place" goes next, "f3" last.
      if (asked.length === 1) return state.window.options[state.window.options.length - 1] ?? "";
      return takes(asked.length === 2 ? "f0" : "place")(state);
    });
    expect(asked[0]?.seat).toBe(0);
    expect(asked.slice(1).map((entry) => entry.seat)).toEqual([1, 1]);
    expect(used.state.seats[1]?.deck.map((id) => used.state.cards[id]?.code)).toEqual(["f0", "place", "f3"]);
    expect(used.state.seats[0]?.deck).toEqual([]);
  });

  it("12176:A:4 a deck of fewer than 2 cards changes nothing", () => {
    const { t, run } = committing({ deckOf: ["f0"] });
    const used = finish(send(run, trigger(run.state, t, "12176:response:1") as PlayerIntent, t.ctx), t.ctx);
    expect(used.state.seats[0]?.deck.map((id) => used.state.cards[id]?.code)).toEqual(["f0"]);
  });
});

describe("12177 Unbroken", () => {
  it("12177:A:3 the attached hero gets +1 Defense", () => {
    const t = carrying({}, [CODES.unbroken]);
    const bare = heathTable(world, {});
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "defense", world.cards)).toBe(modifiedStat(bare.state, bare.state.cards[bare.hero]!, "defense", world.cards) + 1);
  });

  const hurtHero = (layout: Layout = {}) => {
    const t = carrying({ hand: ["filler", "filler", "filler"], phase: "Combat", ...layout }, [CODES.unbroken]);
    return { ...t, state: updateCard(t.state, t.hero, { damage: 3 }) };
  };

  it("12177:A:4 Action: discard a card from your hand to heal 1 damage from the attached hero", () => {
    const t = hurtHero();
    const offered = trigger(t.state, t, "12177:action:1");
    expect(offered).toBeDefined();
    const run = finish(send(start(t.state), offered as PlayerIntent, t.ctx), t.ctx);
    expect(run.state.cards[t.hero]?.damage).toBe(2);
    expect(run.state.seats[0]?.hand).toHaveLength(2);
  });

  it("12177:A:4 each player may trigger it once each round: a second use by the same player is refused, another player's is not", () => {
    const t = hurtHero({ seats: 2 });
    const run = finish(send(start(t.state), trigger(t.state, t, "12177:action:1") as PlayerIntent, t.ctx), t.ctx);
    expect(run.state.cards[t.hero]?.damage).toBe(2);
    const offeredTo = (state: ScenarioState, seat: number) => trigger({ ...state, activeSeat: seat }, t, "12177:action:1") !== undefined;
    // Seat 0 used it this round; seat 1 may, from their own hand, on the same hero.
    expect(offeredTo(run.state, 0)).toBe(false);
    expect(offeredTo(run.state, 1)).toBe(true);
    const second = finish(send({ ...run, state: { ...run.state, activeSeat: 1 } }, trigger({ ...run.state, activeSeat: 1 }, t, "12177:action:1") as PlayerIntent, t.ctx), t.ctx);
    expect(second.state.cards[t.hero]?.damage).toBe(1);
    expect(second.state.seats[1]?.hand).toHaveLength(2);
    expect(offeredTo(second.state, 0)).toBe(false);
    expect(offeredTo(second.state, 1)).toBe(false);
  });
});

describe("12178 The Steadfast", () => {
  it("12178:A:3 the attached hero gets +1 Willpower", () => {
    const t = carrying({}, [CODES.theSteadfast]);
    const bare = heathTable(world, {});
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "willpower", world.cards)).toBe(modifiedStat(bare.state, bare.state.cards[bare.hero]!, "willpower", world.cards) + 1);
  });

  const committing = (threat: number, layout: Layout = {}) => {
    const t = carrying({ threat: [threat, 28], progress: 0, ...layout }, [CODES.theSteadfast]);
    return { t, run: send(start(t.state), { type: "Commit", cardIds: [t.hero] }, t.ctx) };
  };

  it("12178:A:4 after the hero commits, with threat 40 or higher, 1 progress is placed on the current quest", () => {
    const { t, run } = committing(40);
    const offered = trigger(run.state, t, "12178:response:1");
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, t.ctx), t.ctx);
    expect(used.state.cards[used.state.questStage ?? ""]?.progress).toBe(1);
  });

  it("12178:A:4 the active location takes the progress first", () => {
    const { t, run } = committing(45, { active: CODES.lostArmory });
    const used = finish(send(run, trigger(run.state, t, "12178:response:1") as PlayerIntent, t.ctx), t.ctx);
    expect(used.state.cards[idOf(used.state, CODES.lostArmory)]?.progress).toBe(1);
    expect(used.state.cards[used.state.questStage ?? ""]?.progress).toBe(0);
  });

  it("12178:A:4 with threat 39 or lower the Response is not offered", () => {
    const { t, run } = committing(39);
    expect(trigger(run.state, t, "12178:response:1")).toBeUndefined();
  });
});

describe("12179 Dragon-slayer", () => {
  it("12179:A:3 the attached hero gets +1 Attack", () => {
    const t = carrying({}, [CODES.dragonSlayer]);
    const bare = heathTable(world, {});
    expect(modifiedStat(t.state, t.state.cards[t.hero]!, "attack", world.cards)).toBe(modifiedStat(bare.state, bare.state.cards[bare.hero]!, "attack", world.cards) + 1);
  });

  // The quest phase's staging step reveals the top card of the encounter deck for the player.
  const revealing = (deck: readonly string[], layout: Layout = {}, on: "hero" | "seat1" = "hero") => {
    const t = carrying({ deck, ...layout }, [CODES.dragonSlayer], on);
    let run = start(t.state);
    for (let guard = 0; guard < 8 && run.state.window?.kind === "pass"; guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    return { t, run };
  };

  it("12179:A:4 after a non-unique enemy is added to the staging area the bearer exhausts Dragon-slayer to engage it, and it makes an immediate attack against them", () => {
    const { t, run } = revealing(["mild", "f0", "f0"]);
    const offered = trigger(run.state, t, "12179:response:1");
    expect(offered).toBeDefined();
    const used = send(run, offered as PlayerIntent, t.ctx);
    const slayer = idOf(used.state, CODES.dragonSlayer);
    expect(used.state.cards[slayer]?.exhausted).toBe(true);
    const mild = idOf(used.state, "mild");
    expect(used.state.cards[mild]).toMatchObject({ zone: "engaged", controller: 0 });
    // The enemy attacks its new player: the defense window waits.
    expect(used.state.pendingAttack?.enemyId).toBe(mild);
    expect(used.state.pendingAttack?.seat).toBe(0);
  });

  it("12179:A:4 a unique enemy is not offered it", () => {
    const { t, run } = revealing([CODES.coldDrake, "f0", "f0"]);
    expect(codesIn(run.state, "staging")).toContain(CODES.coldDrake);
    expect(trigger(run.state, t, "12179:response:1")).toBeUndefined();
  });

  it("12179:A:4 an exhausted Dragon-slayer cannot be used (it is exhausted as the cost)", () => {
    const t = carrying({ deck: ["mild", "f0", "f0"] }, [CODES.dragonSlayer]);
    const slayer = idOf(t.state, CODES.dragonSlayer);
    const tired: Table = { ...t, state: updateCard(t.state, slayer, { exhausted: true }) };
    let run = start(tired.state);
    for (let guard = 0; guard < 8 && run.state.window?.kind === "pass"; guard += 1) run = send(run, { type: "Pass" }, tired.ctx);
    expect(trigger(run.state, tired, "12179:response:1")).toBeUndefined();
  });

  it("12179:A:4 the player with Dragon-slayer on their hero engages the enemy and is attacked, whoever revealed it", () => {
    const { t, run } = revealing(["mild", "f0", "f0"], { seats: 2 }, "seat1");
    const offered = trigger(run.state, t, "12179:response:1");
    expect(offered).toBeDefined();
    const used = send(run, offered as PlayerIntent, t.ctx);
    expect(used.state.cards[idOf(used.state, "mild")]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(used.state.pendingAttack?.seat).toBe(1);
  });
});

describe("12180 The Canny Huntsman", () => {
  const six = [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen, CODES.lightlessGrotto, CODES.crumblingCavern, CODES.undergroundLake];
  const huntsman = (layout: Layout = {}) => funded(carrying({ hand: [CODES.theCannyHuntsman], deck: six, ...layout }, [CODES.masterOfTheHunt]));
  const order = (state: ScenarioState): string[] => state.encounterDeck.map((id) => state.cards[id]?.code ?? id);

  it("12180:A:1 Quest Action: of the top 5 cards of the encounter deck the player puts some on the bottom, in the order chosen, and the rest back on top in any order", () => {
    const t = huntsman();
    // Bottom: Ancient Treasury, then Crumbling Cavern, then done. The three left on top are put back as Lightless Grotto, Frightful Den, Lost Armory.
    const steps: string[][] = [];
    const sequence = [CODES.ancientTreasury, CODES.crumblingCavern, "done", CODES.lightlessGrotto, CODES.frightfulDen];
    const run = play(t, CODES.theCannyHuntsman, (state) => {
      if (state.window?.kind !== "choose") return "";
      steps.push(state.window.options.map((id) => state.cards[id]?.code ?? id));
      const wanted = sequence[steps.length - 1] ?? state.window.options[0] ?? "";
      return state.window.options.find((id) => id === wanted || state.cards[id]?.code === wanted) ?? state.window.options[0] ?? "";
    });
    expect(order(run.state)).toEqual([CODES.lightlessGrotto, CODES.frightfulDen, CODES.lostArmory, CODES.undergroundLake, CODES.ancientTreasury, CODES.crumblingCavern]);
    expect(steps[0]).toContain("done");
    expect(run.state.seats[0]?.discard.map((id) => run.state.cards[id]?.code)).toContain(CODES.theCannyHuntsman);
  });

  it("12180:A:1 choosing none for the bottom leaves all 5 on top, and the cards below the five are not touched", () => {
    const t = huntsman();
    const run = play(t, CODES.theCannyHuntsman, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("done") ? "done" : (state.window.options[0] ?? "")) : ""));
    expect(order(run.state).slice(5)).toEqual([CODES.undergroundLake]);
    expect([...order(run.state).slice(0, 5)].sort()).toEqual([...six.slice(0, 5)].sort());
  });

  it("12180:A:1 the hero with Master of the Hunt attached gets +3 Willpower until the end of the phase, and no other hero does", () => {
    const t = huntsman();
    const printed = world.cards.get(t.state.cards[t.hero]?.code ?? "")?.willpower ?? 0;
    const run = play(t, CODES.theCannyHuntsman, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("done") ? "done" : (state.window.options[0] ?? "")) : ""));
    expect(modifiedStat(run.state, run.state.cards[t.hero]!, "willpower", world.cards)).toBe(printed + 3);
    expect(modifiedStat(run.state, run.state.cards[t.hero2]!, "willpower", world.cards)).toBe(world.cards.get(run.state.cards[t.hero2]?.code ?? "")?.willpower ?? 0);
  });

  it("12180:A:1 it is a Quest Action: not playable in the combat phase", () => {
    const t = huntsman({ phase: "Combat" });
    const plays = legalIntents(t.state, t.ctx).filter((intent) => intent.type === "PlayCard" && intent.cardId === idOf(t.state, CODES.theCannyHuntsman));
    expect(plays).toEqual([]);
  });
});

describe("12181 A Tale of Victories", () => {
  const tale = (layout: Layout = {}) => {
    const t = funded(carrying({ phase: "Combat", hand: [CODES.aTaleOfVictories], deckOf: ["f0", "f0", "f0", "f0"], engaged: [{ code: "mild", seat: 0 }, { code: "f3", seat: 0 }], ...layout }, [CODES.unbroken]));
    return { ...t, state: updateCard(t.state, t.hero, { damage: 4 }) };
  };

  it("12181:A:1 Combat Action: draws a card for each enemy engaged with the player, heals 3 from the hero with Unbroken and cancels 3 of the next damage that hero is dealt this phase", () => {
    const t = tale();
    const run = play(t, CODES.aTaleOfVictories);
    expect(run.state.seats[0]?.hand).toHaveLength(2);
    expect(run.state.cards[t.hero]?.damage).toBe(1);
    expect(flagged(run.state, t.hero, "damageShield")).toBe(true);
    const hit = (state: ScenarioState, amount: number): ScenarioState => placeDamageOn(state, t.hero, amount);
    expect(hit(run.state, 5).cards[t.hero]?.damage).toBe(1 + 2);
    // The next damage only: the shield is spent.
    expect(hit(hit(run.state, 5), 2).cards[t.hero]?.damage).toBe(1 + 2 + 2);
  });

  it("12181:A:1 with no enemy engaged it draws nothing, and still heals", () => {
    const t = tale({ engaged: [] });
    const run = play(t, CODES.aTaleOfVictories);
    expect(run.state.seats[0]?.hand).toHaveLength(0);
    expect(run.state.cards[t.hero]?.damage).toBe(1);
  });

  it("12181:A:1 it is a Combat Action: not playable in the quest phase", () => {
    const t = tale({ phase: "Quest" });
    expect(legalIntents(t.state, t.ctx).filter((intent) => intent.type === "PlayCard" && intent.cardId === idOf(t.state, CODES.aTaleOfVictories))).toEqual([]);
  });
});

describe("12182 Lay of Courage", () => {
  it("12182:A:1 Quest Response: cancels the When Revealed effects of the card just revealed, readies the hero with The Steadfast and is added to the victory display", () => {
    const t = funded(carrying({ hand: [CODES.layOfCourage], deck: [CODES.heavySnow, "f0", "f0", "f0"] }, [CODES.theSteadfast]));
    const tired: Table = { ...t, state: updateCard(t.state, t.hero, { exhausted: true }) };
    let run = start(tired.state);
    for (let guard = 0; guard < 8 && run.state.window?.kind === "pass"; guard += 1) run = send(run, { type: "Pass" }, tired.ctx);
    const offered = trigger(run.state, tired, "12182:response:1");
    expect(offered).toBeDefined();
    const used = finish(send(run, { ...(offered as Extract<PlayerIntent, { type: "Trigger" }>), payments: [{ heroId: t.hero, amount: 1 }] } as PlayerIntent, tired.ctx), tired.ctx);
    // Heavy Snow's When Revealed did not resolve: no character was exhausted by it and the readying bar did not start.
    expect(readyBarred(used.state, tired.hero, world.cards)).toBe(false);
    expect(used.state.cards[tired.hero]?.exhausted).toBe(false);
    expect(used.state.cards[idOf(used.state, CODES.layOfCourage)]?.zone).toBe("victory");
  });

  it("12182:A:1 without the cancel the revealed card resolves as it would", () => {
    const t = carrying({ deck: [CODES.heavySnow, "f0", "f0", "f0"] }, []);
    let run = start(t.state);
    for (let guard = 0; guard < 8 && run.state.window?.kind === "pass"; guard += 1) run = send(run, { type: "Pass" }, t.ctx);
    run = finish(run, t.ctx);
    expect(readyBarred(run.state, t.hero, world.cards)).toBe(true);
  });

  it("12182:A:1 it is a Quest Response: not offered in the combat phase", () => {
    const t = carrying({ phase: "Combat", hand: [CODES.layOfCourage] }, []);
    expect(legalIntents(t.state, t.ctx).filter((intent) => intent.type === "Trigger" && intent.effectId === "12182:response:1")).toEqual([]);
  });
});

describe("12183 Rhyme of the Slayer", () => {
  it("12183:A:1 Combat Action: the chosen enemy gets -4 Attack until the end of the phase, and the hero with Dragon-slayer gets +4 Attack while attacking that enemy", () => {
    const t = funded(carrying({ phase: "Combat", hand: [CODES.rhymeOfTheSlayer], engaged: [CODES.coldDrake, "f3"] }, [CODES.dragonSlayer]));
    const drake = idOf(t.state, CODES.coldDrake);
    const printed = world.cards.get(CODES.coldDrake)?.attack ?? 0;
    const run = play(t, CODES.rhymeOfTheSlayer, takes(CODES.coldDrake));
    expect(modifiedStat(run.state, run.state.cards[drake]!, "attack", world.cards)).toBe(printed - 4);
    expect(modifiedStat(run.state, run.state.cards[idOf(run.state, "f3")]!, "attack", world.cards)).toBe(world.cards.get("f3")?.attack ?? 0);
    const versus = run.state.modifiers.filter((modifier) => modifier.instanceId === t.hero && modifier.stat === "attack" && modifier.against != null);
    expect(versus).toMatchObject([{ amount: 4, against: drake }]);
    expect(run.state.modifiers.some((modifier) => modifier.instanceId === t.hero2)).toBe(false);
  });

  it("12183:A:1 with no Dragon-slayer in play the enemy still gets -4 Attack", () => {
    const t = funded(carrying({ phase: "Combat", hand: [CODES.rhymeOfTheSlayer], engaged: [CODES.coldDrake] }, []));
    const drake = idOf(t.state, CODES.coldDrake);
    const run = play(t, CODES.rhymeOfTheSlayer, takes(CODES.coldDrake));
    expect(modifiedStat(run.state, run.state.cards[drake]!, "attack", world.cards)).toBe((world.cards.get(CODES.coldDrake)?.attack ?? 0) - 4);
    expect(run.state.modifiers.filter((modifier) => modifier.against != null)).toEqual([]);
  });

  it("12183:A:1 the card says \"Choose an enemy\": an enemy engaged with a player and one in the staging area are both offered", () => {
    const t = funded(carrying({ phase: "Combat", hand: [CODES.rhymeOfTheSlayer], engaged: ["f3"], staging: ["mild"] }, []));
    const offered: string[][] = [];
    play(t, CODES.rhymeOfTheSlayer, (state) => {
      if (state.window?.kind === "choose") offered.push(state.window.options.map((id) => state.cards[id]?.code ?? id));
      return state.window?.kind === "choose" ? (state.window.options[0] ?? "") : "";
    });
    expect(offered[0]?.slice().sort()).toEqual(["f3", "mild"]);
  });

  it("12183:A:1 it can choose an enemy in the staging area, and is a Combat Action: not playable in the quest phase", () => {
    const t = funded(carrying({ phase: "Combat", hand: [CODES.rhymeOfTheSlayer], staging: ["mild"] }, []));
    expect(legalIntents(t.state, t.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idOf(t.state, CODES.rhymeOfTheSlayer))).toBe(true);
    const quest = funded(carrying({ phase: "Quest", hand: [CODES.rhymeOfTheSlayer], staging: ["mild"] }, []));
    expect(legalIntents(quest.state, quest.ctx).some((intent) => intent.type === "PlayCard" && intent.cardId === idOf(quest.state, CODES.rhymeOfTheSlayer))).toBe(false);
  });
});

// Damage dealt to a card as an enemy attack deals it.
function placeDamageOn(state: ScenarioState, id: string, amount: number): ScenarioState {
  return placeDamage(state, id, amount, world.cards, [], "combat", UNATTRIBUTED);
}

describe("the boons and burdens the earlier parts left in the pool, in part 4", () => {
  const pool = (...codes: string[]): CampaignLog => ({ ...emptyLog(1), campaignPool: codes.map((code) => poolCard(dealtCtx.cards.get(code)!, code, null, 0)) });
  const opened = (log: CampaignLog, seats: 1 | 2 = 1, choices?: readonly string[]): ScenarioState => {
    let state = startScenario(heathStart(seats, 1, "Normal", { prisoner: null, usedOnce: [], counters: {} }, log, undefined, choices), dealtCtx);
    while (state.window?.kind === "mulligan") state = expectOk(reduce(state, { type: "Keep" }, dealtCtx)).state;
    for (let guard = 0; guard < 40 && state.window?.kind === "choose"; guard += 1) state = expectOk(reduce(state, { type: "Choose", optionId: state.window.options[0] ?? "" }, dealtCtx)).state;
    return state;
  };
  const where = (state: ScenarioState, code: string) => Object.values(state.cards).filter((card) => card.code === code);

  it("12172 The Threat to Wilderland enters the staging area with X = 4 resources, the part number of The Withered Heath", () => {
    const state = opened(pool("12172"));
    expect(where(state, "12172")).toMatchObject([{ zone: "staging", resources: 4 }]);
  });

  it("12173 Dagnir's Spawn: its X is the part number too: a player distributes 4 damage among their characters", () => {
    const t = heathTable(world, { staging: ["12173"] });
    expect(t.state.part).toBe(4);
    const spawn1 = idOf(t.state, "12173");
    const run = resolveRecords(t.state, t.ctx, "12173", "whenRevealed", spawn1, (state) => (state.window?.kind === "choose" ? (state.window.options.includes("distribute") ? "distribute" : (state.window.options[0] ?? "")) : ""));
    const damage = [t.hero, t.hero2].reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0);
    expect(damage).toBe(4);
    expect(run.state.cards[spawn1]?.zone).toBe("encounterDeck");
  });

  it("12174 Abandoned Ruin is shuffled into this scenario's Caves deck at Setup", () => {
    const state = opened(pool("12174"));
    const caves = (state.piles?.cavesDeck ?? []).map((id) => state.cards[id]?.code);
    expect(caves).toHaveLength(9);
    expect(caves).toContain("12174");
  });

  it("12174 Abandoned Ruin: once it becomes the active location the first player looks at 3 undiscovered treasures and one guarded by it (once per game)", () => {
    const t = heathTable(world, { staging: ["12174"], phase: "Travel" });
    const run = finish(send(start(t.state), { type: "Travel", locationId: idOf(t.state, "12174") }, t.ctx), t.ctx);
    const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && intent.effectId === "12174:response:1");
    expect(offered).toBeDefined();
    const used = finish(send(run, offered as PlayerIntent, t.ctx), t.ctx);
    const treasures = Object.values(used.state.cards).filter((card) => world.cards.get(card.code)?.campaignKind === "treasure");
    expect(treasures).toHaveLength(1);
    expect(treasures[0]).toMatchObject({ zone: "staging" });
  });

  it("12167 A Growing Threat in the pool is shuffled into the encounter deck", () => {
    const log: CampaignLog = { ...emptyLog(1), encounterPool: { "12167": 1 } };
    const state = opened(log);
    expect(where(state, "12167")).toHaveLength(1);
    expect(["encounterDeck", "staging"]).toContain(where(state, "12167")[0]?.zone);
  });

  it("12166 Turayn, 12169 Melanwar and 12171 Isolde in the pool are dealt: shuffled into their player's deck, or in the hand of the player who searched for one", () => {
    const log = pool("12166", "12169", "12171");
    const searched = opened(log, 1, ["skip"]);
    for (const code of ["12166", "12169", "12171"]) expect(where(searched, code), code).toHaveLength(1);
    // The search offers each unique boon ally of the deck: the three of them.
    const taken = opened(log, 1, ["12169"]);
    expect(where(taken, "12169")[0]).toMatchObject({ zone: "hand" });
    expect(["hand", "deck"]).toContain(where(taken, "12166")[0]?.zone);
  });
});
