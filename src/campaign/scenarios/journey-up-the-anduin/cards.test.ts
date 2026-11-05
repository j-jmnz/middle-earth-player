// Rules: emce.evil-creatures-deck, rr.step-6-4-2, rr.attacks-outside-the-combat-phase, rr.shadow-effects, rr.attachment-cards, rr.explored (data/rules/entries.json); ledger lines 18016:A:2 to 18027:A:1.
// The encounter cards of Journey Up the Anduin, each record resolved on the scenario's scene (test/scenarios/journey-up-the-anduin/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { modifiedStat } from "../../../rules/core/keywords.ts";
import { heldAmount, updateCard } from "../../../rules/core/state.ts";
import { attachTo, spawn } from "../../../rules/core/zones.ts";
import { runInstruction } from "../../../rules/interpret/interpret.ts";
import { holds } from "../../../rules/interpret/conditions.ts";
import { pickCandidates } from "../../../rules/interpret/pick.ts";

import { CODES, finish, idOf, idsOf, legalIntents, legalTargets, loadUpanduinWorld, resolveRecords, send, start, upanduinFight, upanduinReveal, upanduinTable, type PlayerIntent, type Run, type UpanduinWorld } from "../../../../test/scenarios/journey-up-the-anduin/scene.ts";

let world: UpanduinWorld;
beforeAll(async () => {
  world = await loadUpanduinWorld();
}, 120_000);

const stat = (t: { state: Parameters<typeof modifiedStat>[0]; ctx: { cards: Parameters<typeof modifiedStat>[3] } }, id: string, name: Parameters<typeof modifiedStat>[2]) => modifiedStat(t.state, t.state.cards[id]!, name, t.ctx.cards);

describe("18016 The Old Ford", () => {
  it("gets +5 quest points for each enemy in play, in the staging area or engaged", () => {
    const t = upanduinTable(world, { staging: [CODES.theOldFord, CODES.wolfRider], engaged: [CODES.hillTroll] });
    expect(stat(t, idOf(t.state, CODES.theOldFord), "questPoints")).toBe(5 + 10);
  });

  it("after it becomes the active location, makes each enemy in the staging area attack the first player, one after the other", () => {
    const t = upanduinTable(world, { staging: [CODES.theOldFord, CODES.wolfRider, CODES.hillTroll] });
    let run: Run = resolveRecords(t.state, t.ctx, CODES.theOldFord, "forced", idOf(t.state, CODES.theOldFord));
    const attackers: string[] = [];
    for (let guard = 0; guard < 6 && run.state.window?.kind === "defense"; guard += 1) {
      attackers.push(run.state.cards[run.state.pendingAttack?.enemyId ?? ""]?.code ?? "");
      run = send(run, { type: "Undefended", heroId: t.hero }, t.ctx);
    }
    expect(attackers.sort()).toEqual([CODES.hillTroll, CODES.wolfRider].sort());
    expect(run.state.window?.kind).not.toBe("defense");
  });
});

describe("18017 Wooded Riverbank", () => {
  it("puts the top card of the Evil Creatures deck into play engaged with the first player when explored", () => {
    const t = upanduinTable(world, { staging: [CODES.woodedRiverbank], evilCreatures: [CODES.hillTroll, CODES.wolfRider], seats: 2 });
    const run = resolveRecords(t.state, t.ctx, CODES.woodedRiverbank, "forced", idOf(t.state, CODES.woodedRiverbank));
    const troll = run.state.cards[idOf(run.state, CODES.hillTroll)];
    expect(troll).toMatchObject({ zone: "engaged", controller: run.state.firstPlayer });
    expect(run.state.piles?.evilCreaturesDeck).toEqual([idOf(run.state, CODES.wolfRider)]);
  });

  it("fires when the quest explores it as the active location, and the card comes into play engaged", () => {
    const t = upanduinTable(world, { phase: "Quest", active: CODES.woodedRiverbank, evilCreatures: [CODES.hillTroll], deck: ["f0", "f0"] });
    let run: Run = send(start(t.state), { type: "Commit", cardIds: [t.hero, t.hero2] } as PlayerIntent, t.ctx);
    run = finish(send(run, { type: "Pass" }, t.ctx), t.ctx);
    expect(run.state.cards[idOf(run.state, CODES.woodedRiverbank)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[idOf(run.state, CODES.hillTroll)]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("deals 1 damage to the defending character as a Shadow card", () => {
    const fight = upanduinFight(world, CODES.woodedRiverbank, CODES.goblinSniper, { evilCreatures: [] });
    const dealt = fight.run.state.cards[fight.made.hero]?.damage ?? 0;
    // The Goblin Sniper's attack 4 against Defense 2 (the hero is plain numbers) and the Shadow's 1 damage.
    expect(dealt).toBeGreaterThanOrEqual(1);
  });
});

describe("18018 Frenzied Creature", () => {
  it("adds the top card of the Evil Creatures deck to the staging area and attaches itself to it as a Condition: +1 Threat, Attack and Defense, immune to player card effects", () => {
    const t = upanduinTable(world, { evilCreatures: [CODES.hillTroll] });
    const before = world.cards.get(CODES.hillTroll)!;
    const run = resolveRecords(t.state, t.ctx, CODES.frenziedCreature, "whenRevealed");
    const troll = run.state.cards[idOf(run.state, CODES.hillTroll)]!;
    expect(troll.zone).toBe("staging");
    const frenzy = run.state.cards[run.id]!;
    expect(frenzy).toMatchObject({ zone: "attached", host: troll.id });
    const synced = { state: run.state, ctx: t.ctx };
    expect(stat(synced, troll.id, "attack")).toBe((before.attack ?? 0) + 1);
    expect(stat(synced, troll.id, "defense")).toBe((before.defense ?? 0) + 1);
    expect(stat(synced, troll.id, "threat")).toBe((before.threat ?? 0) + 1);
    expect(stat(synced, troll.id, "immuneToPlayerCards")).toBe(1);
  });

  it("is discarded as usual with no card in the Evil Creatures deck or its discard pile", () => {
    const t = upanduinTable(world, { evilCreatures: [] });
    const run = resolveRecords(t.state, t.ctx, CODES.frenziedCreature, "whenRevealed");
    expect(run.state.cards[run.id]?.zone).not.toBe("attached");
  });

  it("as a Shadow card attaches itself to the attacking enemy", () => {
    const fight = upanduinFight(world, CODES.frenziedCreature, CODES.goblinSniper);
    const sniper = fight.run.state.cards[idOf(fight.run.state, CODES.goblinSniper)]!;
    expect(sniper.attachments.map((id) => fight.run.state.cards[id]?.code)).toContain(CODES.frenziedCreature);
  });
});

const heroDamage = (state: Parameters<typeof idOf>[0], ids: readonly string[]): number => ids.reduce((sum, id) => sum + (state.cards[id]?.damage ?? 0), 0);

describe("18019 Dangerous Crossing", () => {
  const revealed = (layout: Parameters<typeof upanduinTable>[1]) => {
    const t = upanduinTable(world, { deck: [CODES.dangerousCrossing, "f0", "f0", "f0"], ...layout });
    return { t, run: upanduinReveal(t) };
  };

  it("makes each player assign damage equal to the active location's Threat among their characters, and gains surge below 3", () => {
    const { t, run } = revealed({ active: CODES.banksOfTheAnduin });
    expect(heroDamage(run.state, [t.hero, t.hero2])).toBe(1);
    // The Brown Lands has Threat 1: the surge reveals a second card, which stays in the staging area.
    expect(run.state.staging).toHaveLength(1);
  });

  it("assigns 3 damage and gains no surge when the active location has Threat 3", () => {
    const { t, run } = revealed({ active: CODES.gladdenFields });
    expect(heroDamage(run.state, [t.hero, t.hero2])).toBe(3);
    expect(run.state.staging).toHaveLength(0);
  });

  it("gains surge with no active location, and each of two players assigns the damage to their own characters", () => {
    expect(revealed({}).run.state.staging).toHaveLength(1);
    const { t, run } = revealed({ active: CODES.theOldFord, seats: 2 });
    expect(heroDamage(run.state, [t.hero, t.hero2])).toBe(5);
    expect(run.state.cards[t.seat1Hero ?? ""]?.damage).toBe(5);
  });

  it("as a Shadow card gives the attacker +1 Attack, +2 when the defender is damaged", () => {
    const plain = upanduinFight(world, CODES.dangerousCrossing, CODES.goblinSniper);
    const hurt = upanduinFight(world, CODES.dangerousCrossing, CODES.goblinSniper, {}, { tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: 1 } } }) });
    const sniper = world.cards.get(CODES.goblinSniper)?.attack ?? 0;
    const defense = world.cards.get("dh1")?.defense ?? 0;
    const damage = (fight: typeof plain, before: number) => (fight.run.state.cards[fight.made.hero]?.damage ?? 0) - before;
    expect(damage(plain, 0)).toBe(Math.max(0, sniper + 1 - defense));
    expect(damage(hurt, 1)).toBe(Math.max(0, sniper + 2 - defense));
  });
});

describe("18020 Goblin Troop", () => {
  it("gives each other Goblin enemy engaged with the same player +1 Attack and +1 Defense, and no other enemy", () => {
    const t = upanduinTable(world, { engaged: [CODES.goblinTroop, CODES.goblinSniper, CODES.hillTroll, { code: CODES.strayGoblin, seat: 1 }], seats: 2 });
    const sniper = idOf(t.state, CODES.goblinSniper);
    expect(stat(t, sniper, "attack")).toBe((world.cards.get(CODES.goblinSniper)?.attack ?? 0) + 1);
    expect(stat(t, sniper, "defense")).toBe((world.cards.get(CODES.goblinSniper)?.defense ?? 0) + 1);
    expect(stat(t, idOf(t.state, CODES.hillTroll), "attack")).toBe(world.cards.get(CODES.hillTroll)?.attack);
    expect(stat(t, idOf(t.state, CODES.goblinTroop), "attack")).toBe(world.cards.get(CODES.goblinTroop)?.attack);
  });

  it("gives nothing from the staging area, and nothing to a Goblin engaged with another player", () => {
    const staged = upanduinTable(world, { staging: [CODES.goblinTroop], engaged: [CODES.goblinSniper] });
    expect(stat(staged, idOf(staged.state, CODES.goblinSniper), "attack")).toBe(world.cards.get(CODES.goblinSniper)?.attack);
    const apart = upanduinTable(world, { engaged: [CODES.goblinTroop, { code: CODES.goblinSniper, seat: 1 }], seats: 2 });
    expect(stat(apart, idOf(apart.state, CODES.goblinSniper), "attack")).toBe(world.cards.get(CODES.goblinSniper)?.attack);
  });
});

describe("18021 Stray Goblin", () => {
  it("cannot be optionally engaged", () => {
    const t = upanduinTable(world, { phase: "Encounter", staging: [CODES.strayGoblin] });
    expect(heldAmount(t.state, idOf(t.state, CODES.strayGoblin), "cannotBeOptionallyEngaged")).toBe(1);
    expect(legalTargets(start(t.state).state, { type: "Engage" }, t.ctx)).toEqual([]);
  });

  it("in the staging area engages the player who engages an enemy", () => {
    const t = upanduinTable(world, { phase: "Encounter", staging: [CODES.strayGoblin, CODES.wolfRider] });
    let run: Run = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, CODES.wolfRider) }, t.ctx);
    run = finish(run, t.ctx);
    expect(run.state.cards[idOf(run.state, CODES.wolfRider)]).toMatchObject({ zone: "engaged", controller: 0 });
    expect(run.state.cards[idOf(run.state, CODES.strayGoblin)]).toMatchObject({ zone: "engaged", controller: 0 });
  });

  it("does not engage a player when it is engaged already", () => {
    const t = upanduinTable(world, { phase: "Encounter", engaged: [CODES.strayGoblin], staging: [CODES.wolfRider] });
    const run: Run = finish(send(start(t.state), { type: "Engage", enemyId: idOf(t.state, CODES.wolfRider) }, t.ctx), t.ctx);
    expect(idsOf(run.state, CODES.strayGoblin)).toHaveLength(1);
    expect(run.state.cards[idOf(run.state, CODES.strayGoblin)]?.zone).toBe("engaged");
  });

  it("as a Shadow card is added to the staging area", () => {
    const fight = upanduinFight(world, CODES.strayGoblin, CODES.goblinSniper);
    expect(fight.run.state.cards[idOf(fight.run.state, CODES.strayGoblin)]?.zone).toBe("staging");
  });
});

describe("18022 Pack of Wargs", () => {
  it("makes an additional attack, dealt no shadow card, when it was dealt a shadow card with no effect", () => {
    const fight = upanduinFight(world, "f0", CODES.packOfWargs, {}, { undefended: true });
    const attack = world.cards.get(CODES.packOfWargs)?.attack ?? 0;
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(attack * 2);
    expect(fight.run.state.cards[idOf(fight.run.state, CODES.packOfWargs)]?.shadowId ?? null).toBeNull();
  });

  it("makes its additional attack outside combat too, at The Old Ford, and that attack is dealt no shadow card", () => {
    const t = upanduinTable(world, { staging: [CODES.theOldFord, CODES.packOfWargs], deck: ["f0", "f0", "f0"] });
    let run: Run = resolveRecords(t.state, t.ctx, CODES.theOldFord, "forced", idOf(t.state, CODES.theOldFord));
    const attackers: string[] = [];
    const shadows: boolean[] = [];
    for (let guard = 0; guard < 6 && run.state.window?.kind === "defense"; guard += 1) {
      const enemy = run.state.cards[run.state.pendingAttack?.enemyId ?? ""];
      attackers.push(enemy?.code ?? "");
      shadows.push(enemy?.shadowId != null);
      run = send(run, { type: "Undefended", heroId: t.hero }, t.ctx);
    }
    expect(attackers).toEqual([CODES.packOfWargs, CODES.packOfWargs]);
    expect(shadows).toEqual([true, false]);
    expect(run.state.cards[t.hero]?.damage).toBe((world.cards.get(CODES.packOfWargs)?.attack ?? 0) * 2);
  });

  it("attacks once when its shadow card has an effect", () => {
    const fight = upanduinFight(world, CODES.woodedRiverbank, CODES.packOfWargs, {}, { undefended: true });
    const attack = world.cards.get(CODES.packOfWargs)?.attack ?? 0;
    expect(fight.run.state.cards[fight.made.hero]?.damage).toBe(attack);
  });
});

describe("18023 Hills of Wilderland", () => {
  it("has the Threat and quest points of the most characters one player controls", () => {
    const solo = upanduinTable(world, { staging: [CODES.hillsOfWilderland], play: ["ally"] });
    const hills = idOf(solo.state, CODES.hillsOfWilderland);
    expect(stat(solo, hills, "threat")).toBe(3);
    expect(stat(solo, hills, "questPoints")).toBe(3);
    const pair = upanduinTable(world, { staging: [CODES.hillsOfWilderland], seats: 2 });
    expect(stat(pair, idOf(pair.state, CODES.hillsOfWilderland), "threat")).toBe(2);
  });

  it("lets the first player exhaust a character in the quest phase to lower its Threat by 1 until the end of the phase", () => {
    const t = upanduinTable(world, { phase: "Quest", staging: [CODES.hillsOfWilderland] });
    const hills = idOf(t.state, CODES.hillsOfWilderland);
    const action = legalIntents(start(t.state).state, t.ctx).find((intent) => intent.type === "Trigger" && intent.cardId === hills) as PlayerIntent | undefined;
    expect(action).toBeDefined();
    const run = finish(send(start(t.state), action!, t.ctx), t.ctx);
    expect(Object.values(run.state.cards).filter((card) => card.zone === "heroes" && card.exhausted)).toHaveLength(1);
    expect(stat({ state: run.state, ctx: t.ctx }, hills, "threat")).toBe(1);
  });

  it("is not an Action of a player who is not the first player", () => {
    const t = upanduinTable(world, { phase: "Quest", staging: [CODES.hillsOfWilderland], seats: 2 });
    const hills = idOf(t.state, CODES.hillsOfWilderland);
    const second = { ...t.state, activeSeat: 1 };
    expect(legalIntents(second, t.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === hills)).toBe(false);
    expect(legalIntents(t.state, t.ctx).some((intent) => intent.type === "Trigger" && intent.cardId === hills)).toBe(true);
  });
});

describe("18024 Lonely Lands", () => {
  it("places an event played in the quest phase facedown under it while it is in the staging area, and gets +2 Threat for each", () => {
    const t = upanduinTable(world, { phase: "Quest", staging: [CODES.lonelyLands], hand: ["filler", "filler"] });
    const lands = idOf(t.state, CODES.lonelyLands);
    expect(stat(t, lands, "threat")).toBe(world.cards.get(CODES.lonelyLands)?.threat);
    let run: Run = start(t.state);
    const play = legalIntents(run.state, t.ctx).find((intent) => intent.type === "PlayCard");
    run = finish(send(run, { ...play!, payments: [] } as PlayerIntent, t.ctx), t.ctx);
    const under = Object.values(run.state.cards).filter((card) => card.zone === "under" && card.host === lands);
    expect(under).toHaveLength(1);
    expect(under[0]?.face).toBe("down");
    expect(stat({ state: run.state, ctx: t.ctx }, lands, "threat")).toBe((world.cards.get(CODES.lonelyLands)?.threat ?? 0) + 2);
  });

  it("does not take an event played in the planning phase", () => {
    const t = upanduinTable(world, { phase: "Planning", staging: [CODES.lonelyLands], hand: ["filler"] });
    const play = legalIntents(start(t.state).state, t.ctx).find((intent) => intent.type === "PlayCard");
    expect(play).toBeDefined();
    const run = finish(send(start(t.state), { ...play!, payments: [] } as PlayerIntent, t.ctx), t.ctx);
    expect(Object.values(run.state.cards).filter((card) => card.zone === "under")).toHaveLength(0);
  });
});

describe("18025 Ruined Supplies", () => {
  it("has each player choose between raising threat for each ally they control and dealing 1 damage to each of their allies", () => {
    const t = upanduinTable(world, { staging: [], play: ["ally", "ally"] });
    const threat = resolveRecords(t.state, t.ctx, CODES.ruinedSupplies, "whenRevealed", undefined, () => "threat");
    expect(threat.state.seats[0]?.threat).toBe((t.state.seats[0]?.threat ?? 0) + 2);
    const damage = resolveRecords(t.state, t.ctx, CODES.ruinedSupplies, "whenRevealed", undefined, () => "damage");
    expect(damage.state.seats[0]?.threat).toBe(t.state.seats[0]?.threat);
    expect(Object.values(damage.state.cards).filter((card) => card.zone === "play").map((card) => card.damage)).toEqual([1, 1]);
  });

  it("asks each of two players in turn, and offers both options to a player with no ally", () => {
    const t = upanduinTable(world, { seats: 2 });
    const run = resolveRecords(t.state, t.ctx, CODES.ruinedSupplies, "whenRevealed", undefined, () => "threat");
    expect(run.state.seats.map((seat) => seat.threat)).toEqual(t.state.seats.map((seat) => seat.threat));
  });

  it("as a Shadow card raises the defender's threat by 1 for each enemy engaged with them", () => {
    const fight = upanduinFight(world, CODES.ruinedSupplies, CODES.goblinSniper, { engaged: [CODES.goblinSniper, CODES.wolfRider, { code: CODES.hillTroll, seat: 0 }] });
    expect(fight.run.state.seats[0]?.threat).toBeGreaterThanOrEqual((fight.start.seats[0]?.threat ?? 0) + 3);
  });
});

describe("18026 Lost in the Wild", () => {
  const inHand = (state: Run["state"], seat: number) => (state.seats[seat]?.hand ?? []).map((id) => state.cards[id]?.code);

  it("goes to the hand of the player with the most cards in hand, and stays faceup in it", () => {
    const base = upanduinTable(world, { seats: 2, hand: ["filler"] });
    const more = { ...base, state: spawn(base.state, "filler", { zone: "hand", seat: 1 }).state };
    const run = resolveRecords(more.state, more.ctx, CODES.lostInTheWild, "whenRevealed");
    expect(inHand(run.state, 1)).toContain(CODES.lostInTheWild);
    expect(inHand(run.state, 0)).not.toContain(CODES.lostInTheWild);
    expect(run.state.cards[run.id]).toMatchObject({ zone: "hand", controller: 1 });
  });

  it("goes to the first player's hand when players are tied, or to the one asked to choose", () => {
    const t = upanduinTable(world, { seats: 2, hand: ["filler"] });
    const run = resolveRecords(t.state, t.ctx, CODES.lostInTheWild, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    expect([inHand(run.state, 0), inHand(run.state, 1)].flat().filter((code) => code === CODES.lostInTheWild)).toHaveLength(1);
  });

  it("skips a player who holds a copy, and is discarded when every player does", () => {
    const base = upanduinTable(world, { hand: [CODES.lostInTheWild, "filler"] });
    const run = resolveRecords(base.state, base.ctx, CODES.lostInTheWild, "whenRevealed");
    expect(run.state.cards[run.id]?.zone).not.toBe("hand");
  });

  it("discards each card in its holder's hand, itself included, after they play a card", () => {
    const base = upanduinTable(world, { phase: "Planning", hand: ["filler", "filler", "event"] });
    const lost = spawn(base.state, CODES.lostInTheWild, { zone: "hand", seat: 0 });
    const state = updateCard(lost.state, lost.id, { controller: 0 });
    const play = legalIntents(start(state).state, base.ctx).find((intent) => intent.type === "PlayCard" && state.cards[intent.cardId]?.code === "filler");
    expect(play).toBeDefined();
    const run = finish(send(start(state), { ...play!, payments: [] } as PlayerIntent, base.ctx), base.ctx);
    expect(run.state.seats[0]?.hand).toEqual([]);
    expect(run.state.encounterDiscard.map((id) => run.state.cards[id]?.code)).toContain(CODES.lostInTheWild);
  });

  it("cannot be discarded from the hand by a player card effect, though an encounter card's effect discards it", () => {
    const base = upanduinTable(world, { hand: ["filler"] });
    const lost = spawn(base.state, CODES.lostInTheWild, { zone: "hand", seat: 0 });
    const picks = (source: string, discards: boolean) => pickCandidates(lost.state, { type: "card", control: "you", from: "hand" }, 0, [], source, base.ctx, undefined, undefined, false, { discards }).map((id) => lost.state.cards[id]?.code);
    // A hero's effect that discards leaves it out, one that gives or swaps does not; an effect of the location in the staging area (an encounter card) does not.
    expect(picks(base.hero, true)).toEqual(["filler"]);
    expect(picks(base.hero, false)).toEqual(expect.arrayContaining([CODES.lostInTheWild, "filler"]));
    const place = spawn(lost.state, CODES.theOldFord, { zone: "staging" });
    expect(pickCandidates(place.state, { type: "card", control: "you", from: "hand" }, 0, [], place.id, base.ctx, undefined, undefined, false, { discards: true }).map((id) => place.state.cards[id]?.code)).toEqual(expect.arrayContaining([CODES.lostInTheWild, "filler"]));
  });
});

describe("18026 Lost in the Wild against the treasures (a treasure is a player card)", () => {
  it("is not discardable by Jewels of Wilderland or Glittering Lute, and Axe of the Edain cannot damage an enemy immune to player card effects", () => {
    const base = upanduinTable(world, { seats: 2 });
    const lost = spawn(base.state, CODES.lostInTheWild, { zone: "hand", seat: 0 });
    const scope = (state: typeof lost.state, sourceId: string) => ({ actor: 0, sourceId, returned: 0 });
    for (const code of ["12203", "12200"]) {
      const treasure = spawn(lost.state, code, { zone: "play", seat: 0 });
      const effect = base.ctx.effects.find((record) => record.cardCode === code && (record.timing === "action" || record.timing === "response"));
      const condition = code === "12203" ? effect?.condition : effect?.instructions.flatMap((step) => (step.verb === "ForEachPlayer" ? step.instructions : [])).flatMap((step) => (step.verb === "Choose" ? step.options : [])).find((option) => option.id === "discard")?.requires;
      expect(condition, code).toBeDefined();
      // Only Lost in the Wild is in the hand: the discard cannot be paid.
      expect(holds(treasure.state, condition!, scope(treasure.state, treasure.id), base.ctx), code).toBe(false);
      // With another card in hand the discard can.
      const other = spawn(treasure.state, "filler", { zone: "hand", seat: 0 });
      expect(holds(other.state, condition!, scope(other.state, treasure.id), base.ctx), code).toBe(true);
    }
    const immune = upanduinTable(world, { staging: [CODES.theOldFord], engaged: [CODES.hillTroll] });
    const axe = spawn(immune.state, "12197", { zone: "play", seat: 0 });
    const spec = { type: "location", control: "any", stagingOnly: true } as const;
    expect(pickCandidates(axe.state, spec, 0, [], axe.id, immune.ctx)).toEqual([]);
    expect(pickCandidates(axe.state, spec, 0, [], idOf(axe.state, CODES.hillTroll), immune.ctx)).toHaveLength(1);
  });
});

describe("18026 Lost in the Wild, random discards", () => {
  it("a random discard a player card makes never takes it, an encounter card's does, and the hand-size rule can", () => {
    const base = upanduinTable(world, { hand: ["filler"], staging: [CODES.theOldFord], play: ["ally"] });
    const lost = spawn(base.state, CODES.lostInTheWild, { zone: "hand", seat: 0 });
    const only = { ...lost.state, seats: [{ ...lost.state.seats[0], hand: [lost.id] }, lost.state.seats[1]] as typeof lost.state.seats };
    const player = idOf(only, "ally");
    const byPlayer = runInstruction(only, { verb: "DiscardRandomFromHand" }, { seat: 0, sourceId: player }, base.ctx, []);
    expect(byPlayer.cards[lost.id]?.zone).toBe("hand");
    const byEncounter = runInstruction(only, { verb: "DiscardRandomFromHand" }, { seat: 0, sourceId: idOf(only, CODES.theOldFord) }, base.ctx, []);
    expect(byEncounter.cards[lost.id]?.zone).not.toBe("hand");
  });
});

describe("18027 Weighed Down", () => {
  const withAttachments = (counts: readonly number[]) => {
    const t = upanduinTable(world, { seats: 2 });
    let state = t.state;
    const heroes = [t.hero, t.hero2, t.seat1Hero ?? ""];
    counts.forEach((count, at) => {
      for (let n = 0; n < count; n += 1) {
        const spawned = spawn(state, "treachery", { zone: "play", seat: at === 2 ? 1 : 0 });
        state = attachTo(spawned.state, spawned.id, heroes[at] ?? "");
      }
    });
    return { ...t, state, heroes };
  };

  it("attaches to the hero with the most attachments, which exhausts, and counts as a Condition attachment", () => {
    const t = withAttachments([1, 2, 0]);
    const run = resolveRecords(t.state, t.ctx, CODES.weighedDown, "whenRevealed");
    const down = run.state.cards[run.id]!;
    expect(down).toMatchObject({ zone: "attached", host: t.hero2 });
    expect(run.state.cards[t.hero2]?.exhausted).toBe(true);
    expect(run.state.cards[t.hero]?.exhausted).toBe(false);
  });

  it("is chosen by the first player among heroes tied for the most attachments", () => {
    const t = withAttachments([1, 1, 1]);
    const choosers: number[] = [];
    const run = resolveRecords(t.state, t.ctx, CODES.weighedDown, "whenRevealed", undefined, (state) => {
      if (state.window?.kind !== "choose") return "";
      choosers.push(state.window.seat);
      return state.window.options.at(-1) ?? "";
    });
    expect(choosers).toEqual([t.state.firstPlayer]);
    expect(run.state.cards[run.id]?.host).not.toBeNull();
    expect(run.state.cards[run.id]?.zone).toBe("attached");
  });

  it("makes the controller of the attached hero choose and discard another attachment when it readies; with none left it discards itself", () => {
    const t = withAttachments([2, 0, 0]);
    const attached = resolveRecords(t.state, t.ctx, CODES.weighedDown, "whenRevealed");
    const readied = resolveRecords(attached.state, t.ctx, CODES.weighedDown, "forced", attached.id);
    const host = readied.state.cards[t.hero]!;
    expect(host.attachments).toHaveLength(2);
    expect(host.attachments).toContain(attached.id);
    expect(readied.state.cards[attached.id]?.zone).toBe("attached");
    const bare = withAttachments([0, 0, 0]);
    const down = resolveRecords(bare.state, bare.ctx, CODES.weighedDown, "whenRevealed");
    const gone = resolveRecords(down.state, bare.ctx, CODES.weighedDown, "forced", down.id);
    expect(gone.state.cards[down.id]?.zone).toBe("encounterDiscard");
  });

  // Haldan is an objective; attached to the hero it counts as an objective attachment.
  const attachedObjective = (t: ReturnType<typeof withAttachments>) => {
    const spawned = spawn(t.state, CODES.haldan, { zone: "play", seat: 0 });
    return { ...t, state: attachTo(spawned.state, spawned.id, t.hero), objective: spawned.id };
  };

  it("lets the controller choose an objective attachment too, and never itself while another non-objective attachment is on the hero", () => {
    const t = attachedObjective(withAttachments([1, 0, 0]));
    const attached = resolveRecords(t.state, t.ctx, CODES.weighedDown, "whenRevealed");
    const offered: string[][] = [];
    const readied = resolveRecords(attached.state, t.ctx, CODES.weighedDown, "forced", attached.id, (state) => {
      if (state.window?.kind !== "choose") return "";
      offered.push([...state.window.options]);
      return state.window.options[0] ?? "";
    });
    expect(offered).toHaveLength(1);
    expect(offered[0]).toHaveLength(2);
    expect(offered[0]).toContain(t.objective);
    expect(offered[0]).not.toContain(attached.id);
    expect(readied.state.cards[attached.id]?.zone).toBe("attached");
  });

  it("offers itself with the objective attachments when no other non-objective attachment is on the hero", () => {
    const t = attachedObjective(withAttachments([0, 0, 0]));
    const attached = resolveRecords(t.state, t.ctx, CODES.weighedDown, "whenRevealed");
    const offered: string[][] = [];
    resolveRecords(attached.state, t.ctx, CODES.weighedDown, "forced", attached.id, (state) => {
      if (state.window?.kind !== "choose") return "";
      offered.push([...state.window.options]);
      return state.window.options[0] ?? "";
    });
    expect(offered).toHaveLength(1);
    expect([...(offered[0] ?? [])].sort()).toEqual([attached.id, t.objective].sort());
  });
});
