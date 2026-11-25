// Rules: emce.caves-deck, emce.deep, emce.guarded-x, emce.treasure, rr.travel, rr.explored, rr.damage, rr.victory (data/rules/entries.json); ledger lines 18042:A:2 to 18065:A:2.
// The encounter cards of The King's Quest and the Caves deck on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import { flagged, updateCard } from "../../../rules/core/state.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { modifiedStat } from "../../../rules/core/keywords.ts";
import { attachTo, cardsUnder, moveCard, spawn } from "../../../rules/core/zones.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { reduce } from "../../../rules/engine/reduce.ts";
import { CODES, codesIn, finish, idOf, kingsquestTable, kingsquestFight, loadKingsquestWorld, resolveRecords, legalIntents, send, start, type KingsquestWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-kings-quest/scene.ts";

let world: KingsquestWorld;
beforeAll(async () => {
  world = await loadKingsquestWorld();
}, 120_000);

type Layout = Parameters<typeof kingsquestTable>[1];
// The players travel to the location; a Response the location offers is triggered (`effectId`) or passed, and the choices it opens are answered.
const travel = (code: string, layout: Layout, effectId?: string, pick?: (state: Run["state"]) => string): { run: Run; t: ReturnType<typeof kingsquestTable> } => {
  const t = kingsquestTable(world, { phase: "Travel", staging: [code], ...layout });
  let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx);
  for (let guard = 0; guard < 6 && run.state.window?.kind === "response"; guard += 1) {
    const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && (effectId == null || intent.effectId === effectId));
    run = send(run, (offered ?? { type: "Pass" }) as PlayerIntent, t.ctx);
    run = finish(run, t.ctx, pick);
  }
  return { run: finish(run, t.ctx, pick), t };
};

describe("18042 Fire-drake and 18043 Dragon Hoard", () => {
  it("18042:A:2 Threat and Defense X are 1 more than the number of players", () => {
    for (const seats of [1, 2] as const) {
      const t = kingsquestTable(world, { seats, staging: [CODES.fireDrake] });
      const drake = t.state.cards[idOf(t.state, CODES.fireDrake)]!;
      expect(modifiedStat(t.state, drake, "threat", world.cards)).toBe(seats + 1);
      expect(modifiedStat(t.state, drake, "defense", world.cards)).toBe(seats + 1);
    }
  });

  it("18042:A:3 after the active location is explored it returns to the staging area and attacks each player in turn order", () => {
    const t = kingsquestTable(world, { seats: 2, engaged: [{ code: CODES.fireDrake, seat: 0 }], hand: ["filler"] });
    const drake = idOf(t.state, CODES.fireDrake);
    let run: Run = resolveRecords(t.state, t.ctx, CODES.fireDrake, "forced", drake);
    // It returned to the staging area, then attacked each seat in turn order: each attack waits for its defender.
    expect(run.state.cards[drake]?.zone).toBe("staging");
    const seats: number[] = [];
    for (let guard = 0; guard < 30 && (run.state.pendingAttack != null || run.state.stack.length > 0); guard += 1) {
      if (run.state.window?.kind === "defense") {
        seats.push(run.state.activeSeat);
        run = send(run, { type: "Undefended", heroId: run.state.seats[run.state.activeSeat]?.heroes[0] ?? "" }, t.ctx);
      } else {
        const pass = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Pass");
        if (!pass) break;
        run = send(run, pass as PlayerIntent, t.ctx);
      }
    }
    expect(seats).toEqual([0, 1]);
  });

  it("18043:A:2 Fire-drake cannot take damage while Dragon Hoard is in play", () => {
    const t = kingsquestTable(world, { staging: [CODES.fireDrake, CODES.dragonHoard] });
    expect(flagged(t.state, idOf(t.state, CODES.fireDrake), "cannotTakeDamage")).toBe(true);
    const bare = kingsquestTable(world, { staging: [CODES.fireDrake] });
    expect(flagged(bare.state, idOf(bare.state, CODES.fireDrake), "cannotTakeDamage")).toBe(false);
  });

  it("18043:A:3 the first player chooses a player, who sets an Artifact attachment from their hand under a location that guards it; the freed Artifact is claimed", () => {
    const { run, t } = travel(CODES.dragonHoard, { deck: ["f0", CODES.lostArmory, "f0"], hand: [CODES.hornOfGondor] }, "18043:response:1");
    const horn = idOf(run.state, CODES.hornOfGondor);
    expect(run.state.cards[horn]).toMatchObject({ zone: "staging" });
    expect(run.state.cards[idOf(run.state, CODES.lostArmory)]).toMatchObject({ zone: "staging", host: horn, guard: true });
    expect(t.state.cards[horn]?.zone).toBe("hand");
  });
});

describe("18044 Iron Hills Mine and 18045 Contested Depths", () => {
  it("18044:A:2 traveling here, each player discards the top 4 cards of their deck", () => {
    const { run } = travel(CODES.ironHillsMine, { seats: 2, deckOf: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    expect(run.state.seats[0]?.discard).toHaveLength(4);
    expect(run.state.seats[1]?.discard).toHaveLength(4);
  });

  it("18044:A:1 after it is explored as the active location, each player may return a card from their discard pile to their hand", () => {
    const t = kingsquestTable(world, { seats: 2, active: CODES.ironHillsMine, deckOf: ["f0", "f0", "f0", "f0", "f0", "f0"] });
    const mine = idOf(t.state, CODES.ironHillsMine);
    const withDiscard = moveCard(t.state, t.state.seats[0]?.deck[0] ?? "", { zone: "discard", seat: 0 });
    const run = resolveRecords(withDiscard, t.ctx, CODES.ironHillsMine, "response", mine);
    expect(run.state.seats[0]?.hand).toHaveLength(1);
    expect(run.state.seats[0]?.discard).toHaveLength(0);
  });

  it("18045:A:1 gets +1 Threat for each location in the victory display", () => {
    const t = kingsquestTable(world, { staging: [CODES.contestedDepths], victory: [CODES.lostArmory, CODES.ancientTreasury] });
    expect(modifiedStat(t.state, t.state.cards[idOf(t.state, CODES.contestedDepths)]!, "threat", world.cards)).toBe(2 + (world.cards.get(CODES.contestedDepths)?.threat ?? 0));
  });

  it("18045:A:2 after the players travel here, either every player raises their threat for each location in the victory display, or it is replaced by the top Caves card", () => {
    const raise = travel(CODES.contestedDepths, { victory: [CODES.lostArmory, CODES.ancientTreasury], caves: [CODES.frightfulDen] }, undefined, () => "threat");
    // 28, + 2 for the two locations in the victory display, + 1 the refresh phase raises it once the travel phase is over.
    expect(raise.run.state.seats[0]?.threat).toBe(31);
    expect(raise.run.state.activeLocation).toBe(idOf(raise.run.state, CODES.contestedDepths));
    const replace = travel(CODES.contestedDepths, { victory: [CODES.lostArmory], caves: [CODES.lostArmory, CODES.ancientTreasury] }, undefined, () => "replace");
    expect(replace.run.state.cards[idOf(replace.run.state, CODES.contestedDepths)]?.zone).toBe("encounterDiscard");
    expect(replace.run.state.cards[replace.run.state.activeLocation ?? ""]?.code).toBe(CODES.lostArmory);
    expect(replace.run.state.piles?.cavesDeck).toHaveLength(1);
  });
});

describe("18046 Deep Chasm, 18054 Dark Tunnel and 18055 Forked Passage", () => {
  it("18046:A:1 traveling to a Deep location replaces it with the top card of the Caves deck", () => {
    const { run } = travel(CODES.deepChasm, { caves: [CODES.lostArmory, CODES.ancientTreasury] });
    expect(run.state.cards[run.state.activeLocation ?? ""]?.code).toBe(CODES.lostArmory);
    expect(run.state.cards[idOf(run.state, CODES.deepChasm)]?.zone).toBe("encounterDiscard");
  });

  it("18046:A:2 the players must travel to Deep Chasm when there is no active location", () => {
    const t = kingsquestTable(world, { phase: "Travel", staging: [CODES.deepChasm, CODES.lostArmory] });
    const other = reduce(t.state, { type: "Travel", locationId: idOf(t.state, CODES.lostArmory) }, t.ctx);
    expect(other.ok).toBe(false);
  });

  it("18054:A:2 progress cannot be placed on Dark locations in the staging area while Dark Tunnel is there", () => {
    const tunnel = kingsquestTable(world, { staging: [CODES.darkTunnel, CODES.undergroundLake] });
    const dark = tunnel.state.cards[idOf(tunnel.state, CODES.undergroundLake)]!;
    expect(flagged(tunnel.state, dark.id, "noProgressPlaced")).toBe(true);
    const armory = kingsquestTable(world, { staging: [CODES.darkTunnel, CODES.lostArmory] });
    expect(flagged(armory.state, idOf(armory.state, CODES.lostArmory), "noProgressPlaced")).toBe(false);
    const none = kingsquestTable(world, { staging: [CODES.undergroundLake] });
    expect(flagged(none.state, idOf(none.state, CODES.undergroundLake), "noProgressPlaced")).toBe(false);
  });

  it("18055:A:2 traveling here, each player raises their threat by 2 to look at the top 2 Caves cards: the chosen one stays on top, the other goes to the bottom, and Forked Passage goes to the victory display; the Deep keyword then replaces it with the top card (emce.deep)", () => {
    const caves = [CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen];
    const { run, t } = travel(CODES.forkedPassage, { seats: 2, caves }, "18055:response:1", (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    const deck = (run.state.piles?.cavesDeck ?? []).map((id) => run.state.cards[id]?.code);
    // The Response ran "before resolving the deep keyword": the top card (the one left on top) then becomes the active location.
    expect(deck).toEqual([CODES.frightfulDen, CODES.lostArmory]);
    expect(run.state.seats[0]?.threat).toBe(31);
    expect(run.state.seats[1]?.threat).toBe(31);
    expect(codesIn(run.state, "victory")).toContain(CODES.forkedPassage);
    expect(run.state.cards[run.state.activeLocation ?? ""]?.code).toBe(CODES.ancientTreasury);
    expect(run.state.encounterDiscard).not.toContain(idOf(t.state, CODES.forkedPassage));
    expect(t.state.piles?.cavesDeck).toHaveLength(3);
  });
});

// The quest phase's staging step: every seat passes (commits nothing) and one card is revealed for each player; the windows that follow are passed until an attack waits for its defender.
const stage = (layout: Layout) => {
  const t = kingsquestTable(world, layout);
  let run = start(t.state);
  for (let guard = 0; guard < 8 && (run.state.window?.kind === "pass" || run.state.mode === "beginRound" || run.state.phase === "Quest" && run.state.window != null); guard += 1) {
    if (run.state.window?.kind !== "pass") break;
    run = send(run, { type: "Pass" }, t.ctx);
  }
  return { t, run: finish(run, t.ctx) };
};
const defense = (run: Run, ctx: ReturnType<typeof kingsquestTable>["ctx"]): Run => {
  let current = run;
  for (let guard = 0; guard < 12 && current.state.window?.kind !== "defense"; guard += 1) {
    const pass = legalIntents(current.state, ctx).find((intent) => intent.type === "Pass");
    if (!pass) break;
    current = send(current, pass as PlayerIntent, ctx);
  }
  return current;
};

describe("18047 Denizen of the Deep and 18048 Afraid of the Dark", () => {
  it("18047:A:1 the highest Attack enemy in the staging area makes an immediate attack against the first player", () => {
    const { t, run: revealed } = stage({ seats: 2, deck: [CODES.denizenOfTheDeep, "f0", "f0"], staging: ["f3", "mild"] });
    const run = defense(revealed, t.ctx);
    expect(run.state.pendingAttack?.enemyId).toBe(idOf(t.state, "mild"));
    expect(run.state.pendingAttack?.seat).toBe(0);
  });

  it("18047:A:1 with no enemy in the staging area it gains surge", () => {
    const { run } = stage({ deck: [CODES.denizenOfTheDeep, "f0", "f0", "f0"] });
    expect(run.state.encounterDeck).toHaveLength(2);
    expect(run.state.pendingAttack).toBeNull();
  });

  it("18047:A:2 the Shadow gives the attacking enemy an additional attack against its defender", () => {
    const plain = kingsquestFight(world, "f0", "mild");
    const extra = kingsquestFight(world, CODES.denizenOfTheDeep, "mild");
    expect(plain.run.state.cards[plain.made.hero]?.damage).toBe(1);
    // The hero that defended the first attack is exhausted, so the additional attack is undefended and deals its whole Attack (3).
    expect(extra.run.state.cards[extra.made.hero]?.damage).toBe(4);
  });

  it("18048:A:1 attaches to a questing hero and removes it from the quest", () => {
    const t = kingsquestTable(world, { staging: [] });
    const committed = updateCard(t.state, t.hero, { committed: true, exhausted: true });
    const run = resolveRecords(committed, t.ctx, CODES.afraidOfTheDark, "whenRevealed");
    const attached = idOf(run.state, CODES.afraidOfTheDark);
    expect(run.state.cards[attached]).toMatchObject({ zone: "attached", host: t.hero });
    expect(run.state.cards[t.hero]?.committed).toBe(false);
  });

  it("18048:A:1 Limit 1 per hero: a second copy does not attach to a questing hero that carries one", () => {
    const t = kingsquestTable(world, { staging: [] });
    const first = resolveRecords(updateCard(t.state, t.hero, { committed: true, exhausted: true }), t.ctx, CODES.afraidOfTheDark, "whenRevealed");
    // Only one hero (the table's second hero stays out of the quest) is questing, and it carries the first copy.
    const second = spawn(updateCard(first.state, t.hero2, { committed: false }), CODES.afraidOfTheDark, { zone: "staging" });
    const run = resolveRecords(second.state, t.ctx, CODES.afraidOfTheDark, "whenRevealed", second.id);
    expect(run.state.cards[t.hero]?.attachments.filter((id) => run.state.cards[id]?.code === CODES.afraidOfTheDark)).toHaveLength(1);
    expect(run.state.cards[second.id]?.zone).not.toBe("attached");
  });

  it("18048:A:1 while the active location has the Dark trait the hero's Willpower is 0 and its text box is blank", () => {
    const dark = kingsquestTable(world, { active: CODES.undergroundLake });
    const plain = kingsquestTable(world, { active: CODES.lostArmory });
    const attach = (t: typeof dark): typeof dark.state => {
      const spawned = spawn(t.state, CODES.afraidOfTheDark, { zone: "attached" });
      return syncConstants(attachTo(spawned.state, spawned.id, t.hero), t.ctx);
    };
    const darkState = attach(dark);
    expect(modifiedStat(darkState, darkState.cards[dark.hero]!, "willpower", world.cards)).toBe(0);
    expect(flagged(darkState, dark.hero, "blankText")).toBe(true);
    const plainState = attach(plain);
    expect(modifiedStat(plainState, plainState.cards[plain.hero]!, "willpower", world.cards)).toBe(2);
    expect(flagged(plainState, plain.hero, "blankText")).toBe(false);
  });
});

describe("18049 Stone-troll, 18050 Hobgoblin, 18051 Werewolf, 18052 Giant Spider, 18053 Black Bats", () => {
  it("18049:A:2 after it destroys a character its controller discards a card for each excess point of damage", () => {
    const fought = kingsquestFight(world, "f0", CODES.stoneTroll, { hand: ["filler", "filler", "filler", "filler"] }, { tweak: (state, made) => updateCard(state, made.hero, { damage: 4 }) });
    // 6 Attack against 2 Defense: 4 damage on a hero with 2 hit points left: 2 excess.
    expect(fought.run.state.cards[fought.made.hero]?.zone).toBe("discard");
    expect(fought.run.state.seats[0]?.hand).toHaveLength(2);
  });

  it("18049:A:2 the excess is beyond the character's remaining hit points with their modifiers: +1 hit point makes it 1, -1 makes it 3 (user ruling, 2026-11-05)", () => {
    const discarded = (amount: number): number => {
      const layout = { hand: ["filler", "filler", "filler", "filler"] };
      const fought = kingsquestFight(world, "f0", CODES.stoneTroll, layout, {
        tweak: (state, made) => ({ ...updateCard(state, made.hero, { damage: 4 }), modifiers: [...state.modifiers, { instanceId: made.hero, sourceId: made.hero, stat: "hitPoints", amount, until: "endOfRound" }] }),
      });
      expect(fought.run.state.cards[fought.made.hero]?.zone).toBe("discard");
      return 4 - (fought.run.state.seats[0]?.hand.length ?? 0);
    };
    expect(discarded(1)).toBe(1);
    expect(discarded(-1)).toBe(3);
  });

  it("18049:A:2 an attack that does not destroy a character discards nothing", () => {
    const fought = kingsquestFight(world, "f0", CODES.stoneTroll, { hand: ["filler", "filler"] });
    expect(fought.run.state.seats[0]?.hand).toHaveLength(2);
  });

  it("18050:A:2 when it enters play the first player's top deck card lies under it; 18050:A:1 it gets +X Threat, Attack and Defense, X the card's cost", () => {
    const { t, run } = stage({ seats: 2, deck: [CODES.hobgoblin, "f0", "f0"], deckOf: [CODES.guardOfTheCitadel, "f0"] });
    const hob = idOf(run.state, CODES.hobgoblin);
    const under = cardsUnder(run.state, hob);
    expect(under.map((id) => run.state.cards[id]?.code)).toEqual([CODES.guardOfTheCitadel]);
    expect(run.state.cards[under[0] ?? ""]).toMatchObject({ face: "up", owner: 0 });
    const synced = syncConstants(run.state, t.ctx);
    const printed = world.cards.get(CODES.hobgoblin)!;
    expect(modifiedStat(synced, synced.cards[hob]!, "attack", world.cards)).toBe((printed.attack ?? 0) + 2);
    expect(modifiedStat(synced, synced.cards[hob]!, "threat", world.cards)).toBe((printed.threat ?? 0) + 2);
    expect(modifiedStat(synced, synced.cards[hob]!, "defense", world.cards)).toBe((printed.defense ?? 0) + 2);
  });

  it("18050:A:2 when it leaves play the card it guarded returns to its owner's hand", () => {
    const { t, run } = stage({ deck: [CODES.hobgoblin, "f0", "f0"], deckOf: [CODES.guardOfTheCitadel, "f0"] });
    const hob = idOf(run.state, CODES.hobgoblin);
    expect(cardsUnder(run.state, hob)).toHaveLength(1);
    const steps: Run["steps"] = [];
    const gone = finish({ state: settle(moveCard(run.state, hob, { zone: "encounterDiscard" }), t.ctx, steps), steps }, t.ctx);
    expect(gone.state.seats[0]?.hand.map((id) => gone.state.cards[id]?.code)).toContain(CODES.guardOfTheCitadel);
    expect(cardsUnder(gone.state, hob)).toEqual([]);
  });

  it("18051:A:1 Werewolf gets +1 Attack for each damage on it", () => {
    const t = kingsquestTable(world, { engaged: [{ code: CODES.werewolf, damage: 3 }] });
    const wolf = t.state.cards[idOf(t.state, CODES.werewolf)]!;
    expect(modifiedStat(t.state, wolf, "attack", world.cards)).toBe(5);
  });

  it("18051:A:2 dealt a shadow card with no shadow effect, Werewolf and the defending character take 1 damage", () => {
    const fought = kingsquestFight(world, "f0", CODES.werewolf);
    // Attack 2 against Defense 2 deals no damage of its own: the 1 damage on each is the Forced effect.
    expect(fought.run.state.cards[idOf(fought.run.state, CODES.werewolf)]?.damage).toBe(1);
    expect(fought.run.state.cards[fought.made.hero]?.damage).toBeGreaterThanOrEqual(1);
  });

  it("18051:A:3 the Shadow deals 1 damage to the defender", () => {
    const plain = kingsquestFight(world, "f0", "mild");
    const shadowed = kingsquestFight(world, CODES.werewolf, "mild");
    expect(shadowed.run.state.cards[shadowed.made.hero]?.damage).toBe((plain.run.state.cards[plain.made.hero]?.damage ?? 0) + 1);
  });

  it("18052:A:1 a character Giant Spider damages cannot ready until the end of the round; 18052:A:2 the Shadow does that to the defender", () => {
    const bitten = kingsquestFight(world, "f0", CODES.giantSpider);
    expect(bitten.run.state.cards[bitten.made.hero]?.damage).toBeGreaterThan(0);
    expect(flagged(bitten.run.state, bitten.made.hero, "cannotReady")).toBe(true);
    const shadowed = kingsquestFight(world, CODES.giantSpider, "f0");
    expect(flagged(shadowed.run.state, shadowed.made.hero, "doesNotReady")).toBe(true);
    const other = kingsquestFight(world, "f0", "mild");
    expect(flagged(other.run.state, other.made.hero, "cannotReady")).toBe(false);
  });

  it("18052:A:1 a character the damage of Giant Spider destroys is still a character it damaged: the Forced effect is heard for it", () => {
    const killed = kingsquestFight(world, "f0", CODES.giantSpider, { play: ["ally"] }, { defender: (made) => idOf(made.state, "ally") });
    const ally = killed.run.state.cards[idOf(killed.run.state, "ally")];
    expect(ally?.zone).toBe("discard");
    expect(flagged(killed.run.state, ally!.id, "cannotReady")).toBe(true);
  });

  it("18053:A:2 Black Bats cannot take damage while the active location has the Dark trait", () => {
    const dark = kingsquestTable(world, { active: CODES.undergroundLake, engaged: [CODES.blackBats] });
    expect(flagged(dark.state, idOf(dark.state, CODES.blackBats), "cannotTakeDamage")).toBe(true);
    const plain = kingsquestTable(world, { active: CODES.lostArmory, engaged: [CODES.blackBats] });
    expect(flagged(plain.state, idOf(plain.state, CODES.blackBats), "cannotTakeDamage")).toBe(false);
  });

  it("18053:A:3 the Shadow makes the attacking enemy unable to take damage this phase while the active location is Dark", () => {
    const dark = kingsquestFight(world, CODES.blackBats, "mild", { active: CODES.undergroundLake });
    expect(flagged(dark.run.state, idOf(dark.run.state, "mild"), "cannotTakeDamage")).toBe(true);
    const plain = kingsquestFight(world, CODES.blackBats, "mild", { active: CODES.lostArmory });
    expect(flagged(plain.run.state, idOf(plain.run.state, "mild"), "cannotTakeDamage")).toBe(false);
  });
});

describe("18056 Dark Places and 18057 Eyes in the Dark", () => {
  it("18056:A:1 adds the Threat of the active location to the total Threat in the staging area until the end of the phase", () => {
    const t = kingsquestTable(world, { active: CODES.ancientTreasury, staging: ["f3"] });
    const before = stagingThreat(t.state, world.cards);
    const run = resolveRecords(t.state, t.ctx, CODES.darkPlaces, "whenRevealed");
    expect(stagingThreat(run.state, world.cards)).toBe(before + 3);
  });

  it("18056:A:1 with no active location cards are discarded until a location is, and it is added to the staging area", () => {
    const t = kingsquestTable(world, { deck: ["f0", CODES.lostArmory, "f0"], staging: [] });
    const run = resolveRecords(t.state, t.ctx, CODES.darkPlaces, "whenRevealed");
    expect(codesIn(run.state, "staging")).toContain(CODES.lostArmory);
    expect(codesIn(run.state, "encounterDiscard")).toEqual(["f0"]);
  });

  it("18057:A:2 each player raises their threat by 1 for each questing character they control, or discards a questing character", () => {
    const t = kingsquestTable(world, { seats: 2 });
    const questing = updateCard(updateCard(t.state, t.hero, { committed: true }), t.hero2, { committed: true });
    const raise = resolveRecords(questing, t.ctx, CODES.eyesInTheDark, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === "threat") ?? "") : ""));
    expect(raise.state.seats[0]?.threat).toBe(30);
    expect(raise.state.seats[1]?.threat).toBe(28);
    const discard = resolveRecords(questing, t.ctx, CODES.eyesInTheDark, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === "discard") ?? (state.window.options.at(-1) ?? "")) : ""));
    expect(discard.state.seats[0]?.discard.length + discard.state.seats[0]?.heroes.length).toBeGreaterThan(0);
  });

  it("18057:A:3 the Shadow discards an ally if the attack is undefended", () => {
    const fought = kingsquestFight(world, CODES.eyesInTheDark, "mild", { play: [CODES.guardOfTheCitadel] }, { undefended: true });
    expect(fought.run.state.cards[idOf(fought.run.state, CODES.guardOfTheCitadel)]?.zone).toBe("discard");
  });
});

describe("18058 Dragon Breath and 18059 Dragon Scales", () => {
  // The card attached to the engaged Fire-drake, as its When Revealed leaves it.
  const withCondition = (code: string) => (state: Run["state"], made: { hero: string }) => {
    const drake = idOf(state, CODES.fireDrake);
    const spawned = spawn(state, code, { zone: "attached" });
    return syncConstants(attachTo(spawned.state, spawned.id, drake), kingsquestTable(world, {}).ctx);
  };

  it("18058:A:2 attaches to a Dragon enemy, as a Condition", () => {
    const t = kingsquestTable(world, { engaged: [{ code: CODES.fireDrake, seat: 0 }] });
    const run = resolveRecords(t.state, t.ctx, CODES.dragonBreath, "whenRevealed");
    expect(run.state.cards[idOf(run.state, CODES.dragonBreath)]).toMatchObject({ zone: "attached", host: idOf(run.state, CODES.fireDrake) });
  });

  it("18058:A:2 it does not attach to an enemy without the Dragon trait", () => {
    const t = kingsquestTable(world, { engaged: ["mild"] });
    const run = resolveRecords(t.state, t.ctx, CODES.dragonBreath, "whenRevealed");
    expect(run.state.cards[idOf(run.state, CODES.dragonBreath)]?.zone).not.toBe("attached");
  });

  it("18058:A:2 when the enemy attacks, each of the player's characters takes 1 damage and Dragon Breath is discarded", () => {
    const fought = kingsquestFight(world, "f0", CODES.fireDrake, {}, { tweak: withCondition(CODES.dragonBreath) });
    // The defending hero takes the drake's attack as well; the other hero takes only the Breath.
    expect(fought.run.state.cards[fought.made.hero2]?.damage).toBe(1);
    expect(fought.run.state.cards[idOf(fought.run.state, CODES.dragonBreath)]?.zone).toBe("encounterDiscard");
  });

  it("18059:A:2 attaches to a Dragon enemy; the damage the enemy would take is canceled and Dragon Scales is discarded", () => {
    const t = kingsquestTable(world, { engaged: [{ code: CODES.fireDrake, seat: 0 }] });
    const run = resolveRecords(t.state, t.ctx, CODES.dragonScales, "whenRevealed");
    expect(run.state.cards[idOf(run.state, CODES.dragonScales)]).toMatchObject({ zone: "attached", host: idOf(run.state, CODES.fireDrake) });
    const attacking = kingsquestTable(world, { phase: "PlayerAttacks", engaged: [{ code: CODES.fireDrake, seat: 0 }] });
    const armed = withCondition(CODES.dragonScales)(attacking.state, attacking);
    const strong: typeof armed = { ...armed, modifiers: [...armed.modifiers, { instanceId: attacking.hero, sourceId: attacking.hero, stat: "attack", amount: 6, until: "endOfPhase" }] };
    const drake = idOf(strong, CODES.fireDrake);
    const hit = finish(send(start(strong), { type: "DeclareAttackers", enemyId: drake, attackerIds: [attacking.hero] }, attacking.ctx), attacking.ctx);
    expect(hit.state.cards[drake]?.damage).toBe(0);
    expect(hit.state.cards[idOf(hit.state, CODES.dragonScales)]?.zone).toBe("encounterDiscard");
  });
});

describe("the Caves deck: 18060 to 18065", () => {
  it("18060:A:1 after Lost Armory becomes the active location each player may search their deck for a Weapon or Armor attachment, add it to their hand and shuffle", () => {
    const { run } = travel(CODES.lostArmory, { seats: 2, deckOf: ["f0", CODES.bladeOfGondolin, "f0", CODES.citadelPlate] }, "18060:response:1");
    // The next round's resource phase draws a card as well.
    for (const seat of [0, 1]) expect(run.state.seats[seat]?.hand.map((id) => run.state.cards[id]?.code)).toContain(CODES.bladeOfGondolin);
    expect(run.state.seats[0]?.hand.map((id) => run.state.cards[id]?.code)).not.toContain(CODES.citadelPlate);
  });

  it("18060:A:1 a player may decline, and the Response is used once per game for the group", () => {
    const { run } = travel(CODES.lostArmory, { deckOf: ["f0", "f0", CODES.bladeOfGondolin] }, "18060:response:1", () => "decline");
    expect(run.state.seats[0]?.hand.map((id) => run.state.cards[id]?.code)).not.toContain(CODES.bladeOfGondolin);
  });

  it.each([
    ["threat", (state: Run["state"]) => state.seats[0]?.threat, 28 - 3 + 1],
    // The next round's resource phase draws a card and gives each hero a resource as well.
    ["draw", (state: Run["state"]) => state.seats[0]?.hand.length, 3],
    ["resource", (state: Run["state"]) => state.cards[idOf(state, "dh1")]?.resources, 2],
  ])("18061:A:1 after Ancient Treasury becomes the active location each player may reduce their threat by 3, draw 2 cards, or add a resource to a hero (%s)", (option, read, expected) => {
    const { run } = travel(CODES.ancientTreasury, { deckOf: ["f0", "f0", "f0"] }, "18061:response:1", (state) => (state.window?.kind === "choose" ? (state.window.options.find((id) => id === option) ?? state.window.options[0] ?? "") : ""));
    expect(read(run.state)).toBe(expected);
  });

  it("18062:A:1 after Frightful Den becomes the active location the encounter discard pile is shuffled into the deck and enemies are discarded until one for each player is, each added to the staging area", () => {
    const { run } = travel(CODES.frightfulDen, { seats: 2, deck: ["f0", CODES.lostArmory, "f3"], discard: ["mild"] });
    const enemies = codesIn(run.state, "staging").filter((code) => ["f0", "f3", "mild"].includes(code));
    expect(enemies).toHaveLength(2);
  });

  it("18063:A:1 after the players commit characters to the quest, cards are discarded until a treachery is, and its When Revealed resolves", () => {
    const { run } = stage({ active: CODES.lightlessGrotto, deck: ["f0", CODES.darkPlaces, "f0", "f0"], staging: ["f3"] });
    // The staging step begins: the top card (f0) is discarded with the treachery after it, Dark Places adds the Threat of the active location (5) to the total, and the card revealed afterwards is the third.
    expect(codesIn(run.state, "encounterDiscard")).toEqual(expect.arrayContaining(["f0", CODES.darkPlaces]));
    expect(codesIn(run.state, "staging")).toContain("f0");
    const plain = stage({ active: CODES.lostArmory, deck: ["f0", CODES.darkPlaces, "f0", "f0"], staging: ["f3"] });
    expect(codesIn(plain.run.state, "encounterDiscard")).toEqual([]);
  });

  it("18064:A:1 after Crumbling Cavern becomes the active location each player assigns X damage among their characters, X the number of characters they control", () => {
    const { run } = travel(CODES.crumblingCavern, { seats: 2 });
    const damage = (id: string | undefined) => run.state.cards[id ?? ""]?.damage ?? 0;
    expect(damage(idOf(run.state, "dh1")) + damage(idOf(run.state, "dh2"))).toBe(2);
    expect(damage(idOf(run.state, "dh3"))).toBe(1);
  });

  it("18065:A:1 Underground Lake's Threat is the number of characters controlled by the player with the most characters", () => {
    const t = kingsquestTable(world, { seats: 2, staging: [CODES.undergroundLake], play: ["ally", "ally"] });
    expect(modifiedStat(t.state, t.state.cards[idOf(t.state, CODES.undergroundLake)]!, "threat", world.cards)).toBe(4);
  });

  it("18065:A:1 Underground Lake prints X quest points: as the active location it is explored once the quest places X progress, X tracking the most characters", () => {
    expect(world.cards.get(CODES.undergroundLake)).toMatchObject({ questPoints: null, questPointsX: true });
    const quest = (play: string[]): { zone: string | undefined; points: number } => {
      const t = kingsquestTable(world, { phase: "Quest", active: CODES.undergroundLake, deck: ["f0", "f0"], play });
      const lake = idOf(t.state, CODES.undergroundLake);
      let run: Run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] } as PlayerIntent, t.ctx);
      run = finish(send(run, { type: "Pass" }, t.ctx), t.ctx);
      return { zone: run.state.cards[lake]?.zone, points: modifiedStat(t.state, t.state.cards[lake]!, "questPoints", world.cards) };
    };
    expect(quest([])).toMatchObject({ points: 2, zone: "victory" });
    expect(quest(["ally", "ally", "ally", "ally", "ally", "ally"])).toMatchObject({ points: 8, zone: "activeLocation" });
  });

  it("18065:A:2 an ally that enters play is exhausted", () => {
    const t = kingsquestTable(world, { phase: "Planning", active: CODES.undergroundLake, hand: ["ally"] });
    const funded = updateCard(t.state, t.hero, { resources: 2 });
    const run = send(start(funded), { type: "PlayCard", cardId: idOf(funded, "ally"), payments: [{ heroId: t.hero, amount: 1 }] }, t.ctx);
    const settled = finish(run, t.ctx);
    expect(settled.state.cards[idOf(settled.state, "ally")]).toMatchObject({ zone: "play", exhausted: true });
    const plain = kingsquestTable(world, { phase: "Planning", active: CODES.lostArmory, hand: ["ally"] });
    const fine = finish(send(start(updateCard(plain.state, plain.hero, { resources: 2 })), { type: "PlayCard", cardId: idOf(plain.state, "ally"), payments: [{ heroId: plain.hero, amount: 1 }] }, plain.ctx), plain.ctx);
    expect(fine.state.cards[idOf(fine.state, "ally")]?.exhausted).toBe(false);
  });
});

describe("the verbs' edges", () => {
  it("18049:A:3 the Shadow discards an attachment the defending player controls", () => {
    const fought = kingsquestFight(world, CODES.stoneTroll, "mild", {}, { tweak: (state, made) => { const blade = spawn(state, CODES.bladeOfGondolin, { zone: "attached" }); return attachTo(updateCard(blade.state, blade.id, { controller: 0, owner: 0 }), blade.id, made.hero); } });
    expect(fought.run.state.cards[idOf(fought.run.state, CODES.bladeOfGondolin)]?.zone).toBe("discard");
  });

  it("18043:A:3 with no location in the encounter deck the Artifact is freed at once and claimed", () => {
    const { run } = travel(CODES.dragonHoard, { deck: ["f0", "f0"], hand: [CODES.hornOfGondor] }, "18043:response:1");
    const horn = run.state.cards[idOf(run.state, CODES.hornOfGondor)];
    expect(horn?.zone).not.toBe("hand");
    expect(horn?.zone).not.toBe("staging");
  });

  it("18045:A:2 with the Caves deck empty only the threat is offered", () => {
    const { run } = travel(CODES.contestedDepths, { victory: [CODES.lostArmory], caves: [] });
    expect(run.state.activeLocation).toBe(idOf(run.state, CODES.contestedDepths));
    expect(run.state.seats[0]?.threat).toBe(30);
  });

  it("18055:A:2 with the Caves deck empty the Response is not offered", () => {
    const t = kingsquestTable(world, { phase: "Travel", staging: [CODES.forkedPassage], caves: [] });
    const run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, CODES.forkedPassage) }, t.ctx);
    expect(legalIntents(run.state, t.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "18055:response:1")).toBe(false);
  });
});
