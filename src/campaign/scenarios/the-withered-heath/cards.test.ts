// Rules: emce.dragon-signs, emce.caves-deck, emce.deep, emce.guarded-x, emce.immune, rr.guarded, rr.victory, rr.cancel, rr.travel, rr.damage, rr.engaged (data/rules/entries.json); ledger lines 19011:A:1 to 19021:A:2.
// The encounter cards of The Withered Heath on the scenario's scene: each record runs in a real state.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../../catalog/boundary.ts";
import { UNATTRIBUTED } from "../../../rules/core/cause.ts";
import { expireModifiers, flagged, updateCard } from "../../../rules/core/state.ts";
import { readyBarred } from "../../../rules/core/holder-classes.ts";
import { readyCard } from "../../../rules/interpret/player-verbs.ts";
import { syncConstants } from "../../../rules/interpret/constants.ts";
import { guardWith } from "../../../rules/families/objectives/guard.ts";
import { modifiedStat, placeDamage } from "../../../rules/core/keywords.ts";
import { definePrinted } from "../../../rules/core/printed.ts";
import { attachTo, moveCard, spawn } from "../../../rules/core/zones.ts";
import { settle } from "../../../rules/engine/machine.ts";
import { offerResponses } from "../../../rules/windows/responses.ts";
import { stagingThreat } from "../../../rules/quest/quest.ts";
import { CODES, codesIn, finish, heathFight, heathTable, idOf, legalIntents, loadHeathWorld, resolveRecords, send, start, type HeathWorld, type PlayerIntent, type Run } from "../../../../test/scenarios/the-withered-heath/scene.ts";

let world: HeathWorld;
beforeAll(async () => {
  world = await loadHeathWorld();
}, 120_000);

type Layout = Parameters<typeof heathTable>[1];
const SIGNS = (n: number): string[] => Array.from({ length: n }, () => CODES.dragonSign);
// The players travel to the location; a Response the location offers is triggered (`effectId`) or passed, and the choices it opens are answered.
const travel = (code: string, layout: Layout, effectId?: string, pick?: (state: Run["state"]) => string): { run: Run; t: ReturnType<typeof heathTable> } => {
  const t = heathTable(world, { phase: "Travel", staging: [code], ...layout });
  let run = send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx);
  for (let guard = 0; guard < 6 && run.state.window?.kind === "response"; guard += 1) {
    const offered = legalIntents(run.state, t.ctx).find((intent) => intent.type === "Trigger" && (effectId == null || intent.effectId === effectId));
    run = send(run, (offered ?? { type: "Pass" }) as PlayerIntent, t.ctx);
    run = finish(run, t.ctx, pick);
  }
  return { run: finish(run, t.ctx, pick), t };
};
// A card leaves play: the settle sweep reads what is left.
const settled = (t: ReturnType<typeof heathTable>, state: Run["state"]): Run => {
  const steps: Run["steps"] = [];
  return finish({ state: settle(state, t.ctx, steps), steps }, t.ctx);
};

describe("19011 Cold-Drake", () => {
  it("19011:A:1 cannot have attachments or take non-combat damage, but takes combat damage", () => {
    const t = heathTable(world, { staging: [CODES.coldDrake] });
    const drake = idOf(t.state, CODES.coldDrake);
    expect(flagged(t.state, drake, "cannotHaveAttachments")).toBe(true);
    expect(flagged(t.state, drake, "cannotTakeNonCombatDamage")).toBe(true);
    expect(placeDamage(t.state, drake, 3, world.cards, [], "framework", UNATTRIBUTED).cards[drake]?.damage).toBe(0);
    expect(placeDamage(t.state, drake, 3, world.cards, [], "combat", UNATTRIBUTED).cards[drake]?.damage).toBe(3);
  });

  it("19011:A:2 gets +1 Threat and +1 Defense for each Dragon Sign in the victory display", () => {
    const printed = world.cards.get(CODES.coldDrake)!;
    for (const signs of [0, 1, 3]) {
      const t = heathTable(world, { staging: [CODES.coldDrake], victory: SIGNS(signs) });
      const drake = t.state.cards[idOf(t.state, CODES.coldDrake)]!;
      expect(modifiedStat(t.state, drake, "threat", world.cards), `${signs} signs`).toBe((printed.threat ?? 0) + signs);
      expect(modifiedStat(t.state, drake, "defense", world.cards), `${signs} signs`).toBe((printed.defense ?? 0) + signs);
    }
    // Only Dragon Signs count: another card of the victory display does not.
    const other = heathTable(world, { staging: [CODES.coldDrake], victory: [CODES.lostArmory, CODES.dragonSign] });
    expect(modifiedStat(other.state, other.state.cards[idOf(other.state, CODES.coldDrake)]!, "defense", world.cards)).toBe((printed.defense ?? 0) + 1);
  });

  it("19011:A:3 dealt a shadow card with no shadow effect, the defending character cannot ready until the end of the round", () => {
    const fought = heathFight(world, "f0", CODES.coldDrake);
    expect(flagged(fought.run.state, fought.made.hero, "cannotReady")).toBe(true);
    // A shadow card with an effect is not "no shadow effect": a Snow-troll's Shadow leaves the defender able to ready.
    const effect = heathFight(world, CODES.snowTroll, CODES.coldDrake);
    expect(flagged(effect.run.state, effect.made.hero, "cannotReady")).toBe(false);
  });
});

describe("19012 Dragon Sign", () => {
  const guarded = (deck: readonly string[], layout: Layout = {}) => {
    const t = heathTable(world, { staging: [CODES.dragonSign], deck, ...layout });
    const sign = idOf(t.state, CODES.dragonSign);
    return { t, sign, run: resolveRecords(t.state, t.ctx, CODES.dragonSign, "whenRevealed", sign) };
  };

  it("19012:A:1 Guarded (enemy): cards are discarded until an enemy is, it is added to the staging area and guards the Dragon Sign", () => {
    const { run, sign } = guarded(["treachery", CODES.lostArmory, "f0", "f3"]);
    const guard = idOf(run.state, "f0");
    expect(run.state.cards[guard]).toMatchObject({ zone: "staging", host: sign, guard: true });
    expect(codesIn(run.state, "encounterDiscard").sort()).toEqual([CODES.lostArmory, "treachery"].sort());
    expect(codesIn(run.state, "encounterDeck")).toEqual(["f3"]);
  });

  it("19012:A:2 the enemy attached to it is immune to player card effects; the Dragon Sign itself is not", () => {
    const { run, sign, t } = guarded(["f0"]);
    const guard = idOf(run.state, "f0");
    expect(flagged(run.state, guard, "immuneToPlayerCards")).toBe(true);
    expect(flagged(run.state, sign, "immuneToPlayerCards")).toBe(false);
    // A card in the staging area with no Dragon Sign on it is not immune.
    expect(flagged(t.state, idOf(guarded(["f0"], { staging: [CODES.dragonSign, "f3"] }).t.state, "f3"), "immuneToPlayerCards")).toBe(false);
  });

  it("19012:A:2 a location attached to it as a guard is immune too", () => {
    const t = heathTable(world, { staging: [CODES.dragonSign, CODES.lostArmory] });
    const sign = idOf(t.state, CODES.dragonSign);
    const armory = idOf(t.state, CODES.lostArmory);
    expect(flagged(t.state, armory, "immuneToPlayerCards")).toBe(false);
    const guarded = syncConstants(guardWith(t.state, armory, sign), t.ctx);
    expect(flagged(guarded, armory, "immuneToPlayerCards")).toBe(true);
  });

  it("19012:A:3 free of encounters it is added to the victory display: not while its guard is in play, at once when the guard leaves play", () => {
    const { run, sign, t } = guarded(["f0"]);
    expect(run.state.cards[sign]?.zone).toBe("staging");
    const guard = idOf(run.state, "f0");
    const gone = settled(t, moveCard(run.state, guard, { zone: "encounterDiscard" }));
    expect(gone.state.cards[sign]?.zone).toBe("victory");
    expect(codesIn(gone.state, "victory")).toContain(CODES.dragonSign);
  });

  it("19012:A:3 a Dragon Sign no enemy could guard (none in the deck or the discard pile) is free at once", () => {
    const { run, sign } = guarded(["treachery"]);
    expect(run.state.cards[sign]?.zone).toBe("victory");
  });

  it("19012:A:3 a defeated guard sends the Dragon Sign to the victory display, where Cold-Drake and Dragon Hatchling count it", () => {
    const t = heathTable(world, { phase: "PlayerAttacks", staging: [CODES.dragonSign, CODES.coldDrake], engaged: [{ code: "f0", seat: 0 }] });
    const sign = idOf(t.state, CODES.dragonSign);
    const guard = idOf(t.state, "f0");
    const attached = updateCard(updateCard(t.state, guard, { host: sign, guard: true }), sign, { attachments: [guard] });
    const strong = { ...attached, modifiers: [...attached.modifiers, { instanceId: t.hero, sourceId: t.hero, stat: "attack" as const, amount: 6, until: "endOfPhase" as const }] };
    const run = finish(send(start(strong), { type: "DeclareAttackers", enemyId: guard, attackerIds: [t.hero] }, t.ctx), t.ctx);
    expect(run.state.cards[sign]?.zone).toBe("victory");
    const drake = run.state.cards[idOf(run.state, CODES.coldDrake)]!;
    expect(modifiedStat(run.state, drake, "defense", world.cards)).toBe((world.cards.get(CODES.coldDrake)?.defense ?? 0) + 1);
  });

  it("emce.dragon-signs a Dragon Sign that replaces the active location through Deep goes to the staging area and resolves Guarded", () => {
    const { run } = travel(CODES.dwarvenDoor, { deck: ["treachery", "f0", "f3"], caves: [CODES.dragonSign, CODES.lostArmory] });
    const sign = idOf(run.state, CODES.dragonSign);
    expect(run.state.cards[idOf(run.state, CODES.dwarvenDoor)]?.zone).toBe("encounterDiscard");
    expect(run.state.cards[sign]).toMatchObject({ zone: "staging" });
    expect(run.state.cards[idOf(run.state, "f0")]).toMatchObject({ zone: "staging", host: sign, guard: true });
    expect(run.state.activeLocation).toBeNull();
    expect(run.state.piles?.cavesDeck).toHaveLength(1);
  });
});

describe("19013 Snow-troll and 19014 Dragon Hatchling", () => {
  it("19013:A:2 after it attacks and destroys a character it returns to the staging area", () => {
    const killed = heathFight(world, "f0", CODES.snowTroll, {}, { tweak: (state, made) => updateCard(state, made.hero, { damage: 4 }) });
    expect(killed.run.state.cards[killed.made.hero]?.zone).toBe("discard");
    expect(killed.run.state.cards[idOf(killed.run.state, CODES.snowTroll)]?.zone).toBe("staging");
    const spared = heathFight(world, "f0", CODES.snowTroll);
    expect(spared.run.state.cards[spared.made.hero]?.zone).toBe("heroes");
    expect(spared.run.state.cards[idOf(spared.run.state, CODES.snowTroll)]?.zone).toBe("engaged");
  });

  it("19013:A:3 the Shadow gives the attacking enemy an additional attack against its defender", () => {
    const plain = heathFight(world, "f0", "mild");
    const extra = heathFight(world, CODES.snowTroll, "mild");
    expect(plain.run.state.cards[plain.made.hero]?.damage).toBe(1);
    // The hero that defended the first attack is exhausted, so the additional attack is undefended and deals its whole Attack (3).
    expect(extra.run.state.cards[extra.made.hero]?.damage).toBe(4);
  });

  it("19014:A:1 Dragon Hatchling gets +1 Attack and +1 Defense for each Dragon Sign in the victory display", () => {
    const printed = world.cards.get(CODES.dragonHatchling)!;
    for (const signs of [0, 2]) {
      const t = heathTable(world, { staging: [CODES.dragonHatchling], victory: SIGNS(signs) });
      const hatchling = t.state.cards[idOf(t.state, CODES.dragonHatchling)]!;
      expect(modifiedStat(t.state, hatchling, "attack", world.cards)).toBe((printed.attack ?? 0) + signs);
      expect(modifiedStat(t.state, hatchling, "defense", world.cards)).toBe((printed.defense ?? 0) + signs);
    }
  });

  it("19014:A:2 the Shadow gives the attacking enemy +1 Attack and +1 Defense for each Dragon Sign in the victory display until the end of the phase", () => {
    const fought = heathFight(world, CODES.dragonHatchling, "mild", { victory: SIGNS(2) });
    const mild = fought.run.state.cards[idOf(fought.run.state, "mild")]!;
    expect(modifiedStat(fought.run.state, mild, "attack", world.cards)).toBe(3 + 2);
    expect(modifiedStat(fought.run.state, mild, "defense", world.cards)).toBe(1 + 2);
    const none = heathFight(world, CODES.dragonHatchling, "mild");
    expect(modifiedStat(none.run.state, none.run.state.cards[idOf(none.run.state, "mild")]!, "attack", world.cards)).toBe(3);
  });
});

describe("19015 Mountain Pass", () => {
  // A Response that cancels the When Revealed effects of the card just revealed, on an attachment in play.
  const cancels: Effect = { id: "blade:response:9", cardCode: "blade", lines: ["blade:A:1"], timing: "response", trigger: "whenRevealedPending", instructions: [{ verb: "CancelEffect" }] };
  const offered = (layout: Layout, revealed: string): string[] => {
    const t = heathTable(world, layout);
    const ctx = { ...t.ctx, effects: [...t.ctx.effects, cancels], cards: new Map([...t.ctx.cards, ["blade", definePrinted({ code: "blade", name: "Blade", type: "attachment" })]]) };
    const blade = spawn(t.state, "blade", { zone: "play", seat: 0 });
    const card = spawn(attachTo(blade.state, blade.id, t.hero), revealed, { zone: "staging" });
    const opened = offerResponses(card.state, { trigger: "whenRevealedPending", seat: 0, subject: card.id }, ctx, []);
    const top = opened.stack[opened.stack.length - 1];
    return top?.data.kind === "responses" ? top.data.offers.map((offer) => offer.effectId) : [];
  };

  it("19015:A:1 while it is in the staging area the When Revealed effects of a Weather treachery cannot be canceled", () => {
    expect(offered({}, CODES.heavySnow)).toEqual(["blade:response:9"]);
    expect(offered({ staging: [CODES.mountainPass] }, CODES.heavySnow)).toEqual([]);
    expect(offered({ staging: [CODES.mountainPass] }, CODES.deadlyCold)).toEqual([]);
  });

  it("19015:A:1 only Weather treacheries: any other card can still be canceled; and not once Mountain Pass is the active location", () => {
    expect(offered({ staging: [CODES.mountainPass] }, CODES.ruinedSupplies)).toEqual(["blade:response:9"]);
    expect(offered({ active: CODES.mountainPass }, CODES.heavySnow)).toEqual(["blade:response:9"]);
  });
});

describe("19016 Dwarven Door, 19017 Cave Entrance and 19018 Creature Den", () => {
  it("19016:A:1 traveling to Dwarven Door replaces it with the top card of the Caves deck", () => {
    const { run } = travel(CODES.dwarvenDoor, { caves: [CODES.lostArmory, CODES.ancientTreasury] });
    expect(run.state.cards[run.state.activeLocation ?? ""]?.code).toBe(CODES.lostArmory);
    expect(run.state.cards[idOf(run.state, CODES.dwarvenDoor)]?.zone).toBe("encounterDiscard");
  });

  it("19016:A:2 progress cannot be placed on Dwarven Door while it is in the staging area", () => {
    const door = heathTable(world, { staging: [CODES.dwarvenDoor] });
    expect(flagged(door.state, idOf(door.state, CODES.dwarvenDoor), "noProgressPlaced")).toBe(true);
    const active = heathTable(world, { active: CODES.dwarvenDoor });
    expect(flagged(active.state, idOf(active.state, CODES.dwarvenDoor), "noProgressPlaced")).toBe(false);
    const other = heathTable(world, { staging: [CODES.dwarvenDoor, CODES.lostArmory] });
    expect(flagged(other.state, idOf(other.state, CODES.lostArmory), "noProgressPlaced")).toBe(false);
  });

  it("19017:A:1 Cave Entrance is replaced by the top Caves card; with the Caves deck empty the Deep keyword is ignored", () => {
    const { run } = travel(CODES.caveEntrance, { caves: [CODES.ancientTreasury] });
    expect(run.state.cards[run.state.activeLocation ?? ""]?.code).toBe(CODES.ancientTreasury);
    const empty = travel(CODES.caveEntrance, { caves: [] });
    expect(empty.run.state.cards[empty.run.state.activeLocation ?? ""]?.code).toBe(CODES.caveEntrance);
  });

  it("19017:A:2 gets +1 Threat for each Dragon Sign in the victory display", () => {
    const printed = world.cards.get(CODES.caveEntrance)?.threat ?? 0;
    const t = heathTable(world, { staging: [CODES.caveEntrance], victory: SIGNS(3) });
    expect(stagingThreat(t.state, world.cards)).toBe(printed + 3);
  });

  it("19017:A:3 Travel: each player raises their threat by 1", () => {
    const { run } = travel(CODES.caveEntrance, { seats: 2, caves: [] });
    // 28, +1 for the Travel effect, +1 the refresh phase raises it once the travel phase is over.
    expect(run.state.seats[0]?.threat).toBe(30);
    expect(run.state.seats[1]?.threat).toBe(30);
  });

  it("19018:A:1 after the players travel to Creature Den a Dragon Sign is searched out of the Caves deck and guarded by it; the deck is shuffled", () => {
    const caves = [CODES.lostArmory, CODES.dragonSign, CODES.ancientTreasury, CODES.frightfulDen];
    const { run } = travel(CODES.creatureDen, { caves, deck: ["f3"] }, "19018:response:1");
    const sign = idOf(run.state, CODES.dragonSign);
    const den = idOf(run.state, CODES.creatureDen);
    expect(run.state.cards[sign]).toMatchObject({ zone: "staging" });
    expect(run.state.cards[den]).toMatchObject({ host: sign, guard: true });
    expect(run.state.activeLocation).toBe(den);
    expect(run.state.piles?.cavesDeck).toHaveLength(3);
    expect(codesIn(run.state, "cavesDeck").slice().sort()).toEqual([CODES.lostArmory, CODES.ancientTreasury, CODES.frightfulDen].sort());
    // The den is the guard, and a guard is immune to player card effects.
    expect(flagged(run.state, den, "immuneToPlayerCards")).toBe(true);
  });

  it("19018:A:1 the Dragon Sign goes to the victory display when Creature Den is explored", () => {
    const { run, t } = travel(CODES.creatureDen, { caves: [CODES.dragonSign], deck: ["f3"] }, "19018:response:1");
    const sign = idOf(run.state, CODES.dragonSign);
    expect(run.state.cards[sign]?.zone).toBe("staging");
    const den = idOf(run.state, CODES.creatureDen);
    const explored = settled(t, moveCard(run.state, den, { zone: "victory" }));
    expect(explored.state.cards[sign]?.zone).toBe("victory");
  });

  it("19018:A:1 with no Dragon Sign in the Caves deck the Response changes nothing but the shuffle", () => {
    const { run } = travel(CODES.creatureDen, { caves: [CODES.lostArmory, CODES.ancientTreasury], deck: ["f3"] }, "19018:response:1");
    expect(codesIn(run.state, "staging")).not.toContain(CODES.dragonSign);
    expect(run.state.piles?.cavesDeck).toHaveLength(2);
  });

  it("19018:A:2 Travel: the encounter discard pile is shuffled into the deck and cards are discarded until an enemy is, which is added to the staging area", () => {
    const { run } = travel(CODES.creatureDen, { caves: [], deck: ["treachery", "f3"], discard: ["place", "f0"] }, "19018:response:1");
    // The discard pile is back in the deck, so the first enemy of the shuffled four is the one added, whichever it was; the cards discarded before it are in the pile.
    const enemies = codesIn(run.state, "staging").filter((code) => world.cards.get(code)?.type === "enemy");
    expect(enemies).toHaveLength(1);
    expect(["f0", "f3"]).toContain(enemies[0]);
    expect(run.state.encounterDeck.length + run.state.encounterDiscard.length).toBe(3);
    expect(run.state.encounterDiscard.length).toBeGreaterThanOrEqual(0);
  });

  it("19018:A:2 with no enemy in the deck or the discard pile nothing is added", () => {
    const { run } = travel(CODES.creatureDen, { caves: [], deck: ["treachery"], discard: ["place"] }, "19018:response:1");
    expect(codesIn(run.state, "staging").filter((code) => world.cards.get(code)?.type === "enemy")).toEqual([]);
  });
});

describe("19019 High Falls", () => {
  it("19019:A:2 gets a Threat equal to the number of locations in the staging area", () => {
    const t = heathTable(world, { staging: [CODES.highFalls, CODES.lostArmory, CODES.ancientTreasury] });
    const falls = t.state.cards[idOf(t.state, CODES.highFalls)]!;
    expect(modifiedStat(t.state, falls, "threat", world.cards)).toBe(3);
  });

  it("19019:A:3 Travel: X damage is assigned among characters in play, X the locations left in the staging area", () => {
    // The Travel effect is a cost of traveling, resolved before the location becomes the active location (rr.travel): High Falls is still in the staging area and counts.
    const { run, t } = travel(CODES.highFalls, { caves: [], staging: [CODES.highFalls, CODES.lostArmory, CODES.ancientTreasury] });
    const before = [t.hero, t.hero2].reduce((sum, id) => sum + (t.state.cards[id]?.damage ?? 0), 0);
    const after = [t.hero, t.hero2].reduce((sum, id) => sum + (run.state.cards[id]?.damage ?? 0), 0);
    expect(after - before).toBe(3);
  });

  it("19019:A:3 two-handed, the damage may be assigned to any player's characters", () => {
    const { run, t } = travel(CODES.highFalls, { seats: 2, caves: [], staging: [CODES.highFalls, CODES.lostArmory] }, undefined, (state) => (state.window?.kind === "choose" ? (state.window.options.at(-1) ?? "") : ""));
    const seat1 = t.seat1Hero ?? "";
    expect(run.state.cards[seat1]?.damage).toBe(2);
  });
});

describe("19020 Heavy Snow and 19021 Deadly Cold", () => {
  it("19020:A:2 the first player exhausts a character and, until the end of the round, characters cannot be readied by player card effects", () => {
    const t = heathTable(world, { seats: 2, staging: [CODES.heavySnow] });
    const snow = idOf(t.state, CODES.heavySnow);
    const run = resolveRecords(t.state, t.ctx, CODES.heavySnow, "whenRevealed", snow);
    const exhausted = [t.hero, t.hero2, t.seat1Hero ?? ""].filter((id) => run.state.cards[id]?.exhausted);
    expect(exhausted).toHaveLength(1);
    for (const id of [t.hero, t.hero2, t.seat1Hero ?? ""]) expect(readyBarred(run.state, id, world.cards), id).toBe(true);
    const calm = heathTable(world, { staging: [CODES.heavySnow] });
    expect(readyBarred(calm.state, calm.hero, world.cards)).toBe(false);
  });

  it("19020:A:2 rr.lasting-effects: a character entering play later that round is barred too, a card effect of the encounter deck is not, and the round's end lifts it", () => {
    const t = heathTable(world, { staging: [CODES.heavySnow] });
    const snow = idOf(t.state, CODES.heavySnow);
    const run = resolveRecords(t.state, t.ctx, CODES.heavySnow, "whenRevealed", snow);
    const entered = spawn(run.state, CODES.turayn, { zone: "play", seat: 0 });
    // Only a player card effect is barred from readying: the refresh phase and an encounter card's effect still ready.
    expect(readyBarred(entered.state, entered.id, world.cards)).toBe(true);
    expect(readyBarred(entered.state, entered.id)).toBe(false);
    const enemy = spawn(entered.state, CODES.snowTroll, { zone: "staging" });
    expect(readyBarred(enemy.state, enemy.id, world.cards)).toBe(false);
    expect(expireModifiers(entered.state, ["endOfRound"]).modifiers.some((modifier) => modifier.stat === "cannotReadyByPlayerCard")).toBe(false);
  });

  it("19020:A:2 a player card's Ready is refused for a character that entered play after Heavy Snow", () => {
    const t = heathTable(world, { staging: [CODES.heavySnow] });
    const snow = idOf(t.state, CODES.heavySnow);
    const run = resolveRecords(t.state, t.ctx, CODES.heavySnow, "whenRevealed", snow);
    const entered = spawn(run.state, CODES.turayn, { zone: "play", seat: 0 });
    const tired = updateCard(entered.state, entered.id, { exhausted: true });
    expect(readyCard(tired, entered.id, true, world.cards).cards[entered.id]?.exhausted).toBe(true);
    expect(readyCard(tired, entered.id).cards[entered.id]?.exhausted).toBe(false);
  });

  it("19020:A:3 the Shadow exhausts a character the defender controls", () => {
    const fought = heathFight(world, CODES.heavySnow, "mild");
    // The refresh phase readies every card once the combat phase is over: the state while the attack was still in progress shows the exhaustion.
    expect(fought.during.cards[fought.made.hero2]?.exhausted).toBe(true);
  });

  it("19021:A:1 each player chooses, for each ready character they control, to exhaust it or deal it 1 damage", () => {
    const t = heathTable(world, { seats: 2, staging: [CODES.deadlyCold] });
    const cold = idOf(t.state, CODES.deadlyCold);
    // Seat 1 exhausts the first character they are asked about and damages the second; seat 2 (one hero) damages it.
    const seen: string[] = [];
    const run = resolveRecords(t.state, t.ctx, CODES.deadlyCold, "whenRevealed", cold, (state) => {
      if (state.window?.kind !== "choose") return "";
      seen.push(`${state.window.seat}:${state.window.options.join("/")}`);
      return seen.length === 1 ? "exhaust" : "damage";
    });
    expect(seen).toEqual(["0:exhaust/damage", "0:exhaust/damage", "1:exhaust/damage"]);
    expect(run.state.cards[t.hero]?.exhausted).toBe(true);
    expect(run.state.cards[t.hero]?.damage).toBe(0);
    expect(run.state.cards[t.hero2]?.damage).toBe(1);
    expect(run.state.cards[t.hero2]?.exhausted).toBe(false);
    expect(run.state.cards[t.seat1Hero ?? ""]?.damage).toBe(1);
  });

  it("19021:A:1 an exhausted character is not asked about", () => {
    const t = heathTable(world, { staging: [CODES.deadlyCold] });
    const cold = idOf(t.state, CODES.deadlyCold);
    const tired = updateCard(t.state, t.hero, { exhausted: true });
    let asked = 0;
    const run = resolveRecords(tired, t.ctx, CODES.deadlyCold, "whenRevealed", cold, (state) => {
      if (state.window?.kind === "choose") asked += 1;
      return "damage";
    });
    expect(asked).toBe(1);
    expect(run.state.cards[t.hero]?.damage).toBe(0);
    expect(run.state.cards[t.hero2]?.damage).toBe(1);
  });

  it("19021:A:2 the Shadow gives the attacking enemy +1 Attack, +2 against a damaged defender", () => {
    const plain = heathFight(world, CODES.deadlyCold, "mild");
    const hurt = heathFight(world, CODES.deadlyCold, "mild", {}, { tweak: (state, made) => updateCard(state, made.hero, { damage: 1 }) });
    const attackOf = (fought: typeof plain): number => modifiedStat(fought.during, fought.during.cards[idOf(fought.during, "mild")]!, "attack", world.cards);
    expect(attackOf(plain)).toBe(3 + 1);
    expect(attackOf(hurt)).toBe(3 + 2);
  });
});

