// Rules: emce.discover, emce.loot, emce.treasure, rr.first-player, rr.optional-engagement, rr.player-elimination, rr.response (data/rules/entries.json); ledger lines 19094:A:3, 19099:A:3, 19104:A:2, 19106:A:1, 19110:B:1, 19108:A:2, 12189:B:2, 12189:B:3, 12191:A:1, 12192:A:1.
// The choices and prompts of The Ghost of Framsburg on the live sheet: each opens a real window (the engine's own frame, not a hand-made instruction), and the sheet says the number, the side of the table, the player, what declining does, and the cost before a choice that can lose the game.
// Two-handed a seat-by-seat sentence leads with the player and the sheet adds no "Player N chooses."; solo it has no lead; the first player's choice for the group leaves the sheet to say who chooses.
import { beforeAll, describe, expect, it } from "vitest";

import type { Effect } from "../../catalog/boundary.ts";
import { legalIntents } from "../../rules/engine/legal.ts";
import { settle } from "../../rules/engine/machine.ts";
import { withThreat, type ScenarioState } from "../../rules/core/state.ts";
import { spawn } from "../../rules/core/zones.ts";
import { undiscoveredTreasures } from "../../rules/families/wilderland/treasure.ts";
import { pushCardEffects } from "../../rules/interpret/effect-frames.ts";
import { CODES, GALADRIEL, framsburgTable, idOf, loadFramsburgWorld, send, start, withLoot, type FramsburgWorld, type Run } from "../../../test/scenarios/the-ghost-of-framsburg/scene.ts";

import { cardTriggerSheet } from "./bar-sheets.ts";
import { dockFor } from "./table-choice.ts";
import { sheetFor, triggerOptions } from "./sheets.ts";

let world: FramsburgWorld;
beforeAll(async () => {
  world = await loadFramsburgWorld();
}, 120_000);

type Table = ReturnType<typeof framsburgTable>;
const nameOf = (code: string): string => world.cards.get(code)?.name ?? code;
const names = (state: ScenarioState) => ({ card: (id: string) => nameOf(state.cards[id]?.code ?? id), line: () => null });

const sheetOf = (t: Table, state: ScenarioState) => {
  const sheet = sheetFor(state, t.ctx, legalIntents(state, t.ctx), names(state));
  if (!sheet || (sheet.kind !== "pick" && sheet.kind !== "trigger")) throw new Error(`no pick or trigger sheet: ${JSON.stringify(state.window)}`);
  return sheet;
};
const labels = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => option.label);
const cautions = (sheet: ReturnType<typeof sheetOf>) => sheet.options.map((option) => ("caution" in option ? option.caution : undefined));
const actions = (t: Table, state: ScenarioState) => triggerOptions(state, t.ctx, legalIntents(state, t.ctx), names(state));
const take = (t: Table, state: ScenarioState, optionId: string): Run => send({ state, steps: [] }, { type: "Choose", optionId }, t.ctx);
const travelTo = (t: Table, code: string): Run => send(start(t.state), { type: "Travel", locationId: idOf(t.state, code) }, t.ctx);
const use = (t: Table, run: Run): Run => {
  const intent = legalIntents(run.state, t.ctx).find((item) => item.type === "Trigger");
  if (!intent || intent.type !== "Trigger") throw new Error("no ability to use");
  return send(run, { type: "Trigger", cardId: intent.cardId, effectId: intent.effectId }, t.ctx);
};

// The record's frame is pushed and settled until the engine opens its window: the live state the sheet is built from.
function opened(t: Table, state: ScenarioState, code: string, timing: Effect["timing"], source: string, frame: "whenRevealed" | "forced" = "forced", actor = state.firstPlayer): ScenarioState {
  const effects = t.ctx.effects.filter((effect) => effect.cardCode === code && effect.timing === timing).map((effect) => ({ ...effect, condition: undefined }) as Effect);
  const pushed = pushCardEffects(state, frame, source, actor, false, effects, t.ctx, []);
  return settle({ ...pushed, window: null, mode: "stopped" }, t.ctx, []);
}

describe("Discover and the Loot and Hazard cards it looks at (emce.discover, 19106:A:1)", () => {
  it("the keyword asks the first player which of the Loot objectives looked at to attach, and says what becomes of the rest; two-handed the sheet adds who chooses", () => {
    for (const [seats, suffix] of [[1, ""], [2, " Player 1 chooses."]] as const) {
      const t = framsburgTable(world, { seats, phase: "Travel", staging: [CODES.moonlitPassage], deck: [CODES.cryptKey, CODES.oldLantern, CODES.hauntedHall, "f0"] });
      const sheet = sheetOf(t, travelTo(t, CODES.moonlitPassage).state);
      expect(sheet.note).toBe(`Discover 2 at Moonlit Passage. The top 2 cards of the encounter deck were looked at: 2 of them are Loot objectives. Choose 1 to attach to Moonlit Passage as a guarded objective; the other cards looked at go to the encounter discard pile.${suffix}`);
      expect(labels(sheet)).toEqual(["Crypt Key", "Old Lantern"]);
    }
  });

  it("names the Hazard card looked at: it is picked at random, revealed and added to the staging area", () => {
    const t = framsburgTable(world, { phase: "Travel", staging: [CODES.hauntedHall], deck: [CODES.cryptKey, CODES.oldLantern, CODES.terribleShadows, "f0"] });
    const sheet = sheetOf(t, travelTo(t, CODES.hauntedHall).state);
    expect(sheet.note).toContain("Discover 4 at Haunted Hall. The top 4 cards of the encounter deck were looked at: 2 of them are Loot objectives.");
    // Terrible Shadows is a treachery: it has no place in the staging area, so its When Revealed effect resolves and it is discarded (emce.discover).
    expect(sheet.note).toContain("the 1 Hazard card looked at is revealed, its When Revealed effect resolves and it is discarded, and the other cards looked at go to the encounter discard pile.");
  });

  it("names a Hazard enemy or location as added to the staging area, a pair of copies as copies, and a mix of kinds for what each becomes", () => {
    const enemy = framsburgTable(world, { phase: "Travel", staging: [CODES.hauntedHall], deck: [CODES.cryptKey, CODES.oldLantern, CODES.cryptStalker, "f0"] });
    expect(sheetOf(enemy, travelTo(enemy, CODES.hauntedHall).state).note).toContain("the 1 Hazard card looked at is revealed and added to the staging area, and the other cards looked at");
    const copies = framsburgTable(world, { phase: "Travel", staging: [CODES.hauntedHall], deck: [CODES.cryptKey, CODES.oldLantern, CODES.slammedShut, CODES.slammedShut] });
    expect(sheetOf(copies, travelTo(copies, CODES.hauntedHall).state).note).toContain("1 of the 2 copies of Slammed Shut looked at is revealed, its When Revealed effect resolves and it is discarded, and the other cards looked at");
    const mixed = framsburgTable(world, { phase: "Travel", staging: [CODES.hauntedHall], deck: [CODES.cryptKey, CODES.oldLantern, CODES.cryptStalker, CODES.slammedShut] });
    expect(sheetOf(mixed, travelTo(mixed, CODES.hauntedHall).state).note).toContain("1 of the 2 Hazard cards looked at, picked at random, is revealed: an enemy or location is added to the staging area, a treachery resolves its When Revealed effect and is discarded, and the other cards looked at");
  });

  it("Abandoned Ruins asks each player in turn: Player 1, then Player 2, each led by the player and with no \"chooses\" after it; solo has no lead", () => {
    for (const seats of [1, 2] as const) {
      const t = framsburgTable(world, { seats, phase: "Quest", staging: [CODES.moonlitPassage, CODES.abandonedRuins], deck: [CODES.cryptKey, CODES.oldLantern, CODES.scathaSTeeth, CODES.ashenBrazier, "f0", "f0"] });
      const place = { ...t.state, activeLocation: idOf(t.state, CODES.moonlitPassage) };
      const state = opened(t, place, CODES.abandonedRuins, "whenRevealed", idOf(t.state, CODES.abandonedRuins), "whenRevealed");
      const first = sheetOf(t, state);
      const lead = seats === 1 ? "" : "Player 1, ";
      expect(first.note).toBe(`${lead}Abandoned Ruins: resolve Discover 2 at Moonlit Passage. The top 2 cards of the encounter deck were looked at: 2 of them are Loot objectives. Choose 1 to attach to Moonlit Passage as a guarded objective; the other cards looked at go to the encounter discard pile.`);
      expect(first.note).not.toContain("chooses");
      if (seats === 2) {
        const second = sheetOf(t, take(t, state, first.options[0]!.id).state);
        expect(second.note).toMatch(/^Player 2, Abandoned Ruins: resolve Discover 2/);
        expect(second.note).not.toContain("chooses");
      }
    }
  });
});

describe("Crypt Key's Response before the keyword resolves (19094:A:3)", () => {
  const keyed = (seats: 1 | 2) => withLoot(framsburgTable(world, { seats, phase: "Travel", staging: [CODES.moonlitPassage], deck: ["f0", "f0", "f0", CODES.oldLantern] }), [CODES.cryptKey]);

  it("is offered on the travel, before the keyword: the sheet names the location, its Discover value and what passing does", () => {
    for (const [seats, lead] of [[1, "You"], [2, "Player 1: you"]] as const) {
      const t = keyed(seats);
      const run = travelTo(t, CODES.moonlitPassage);
      expect(run.state.window).toMatchObject({ kind: "response" });
      const sheet = sheetOf(t, run.state);
      expect(sheet.kind).toBe("trigger");
      expect(sheet.note).toBe(`${lead} traveled to Moonlit Passage, Discover 2. Crypt Key may be exhausted now to add 1 to that value or take 1 off it; the keyword resolves after this window. Pass and it resolves as printed.`);
      expect(sheet.kind === "trigger" && sheet.pass).toBe("Pass");
      // Passing: the keyword resolves as printed, looking at 2 cards.
      const passed = send(run, { type: "Pass" }, t.ctx);
      expect(passed.state.encounterDeck).toHaveLength(2);
    }
  });

  it("then asks which way, with the value now and after each option; two-handed it leads Player 1 and the sheet adds no \"chooses\"", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1, "]] as const) {
      const t = keyed(seats);
      const asked = use(t, travelTo(t, CODES.moonlitPassage)).state;
      expect(asked.window).toMatchObject({ kind: "choose" });
      const sheet = sheetOf(t, asked);
      expect(sheet.note).toBe(`${lead}Crypt Key: Moonlit Passage has Discover 2. Change it until the end of the phase, before the keyword resolves.`);
      expect(labels(sheet)).toEqual(["Add 1 (Discover 3)", "Take 1 off (Discover 1)"]);
    }
  });
});

describe("the treasure for Fram's Shade (12189:B:2)", () => {
  it("the Response says what it does, that it is once per game and that passing keeps it for a later engagement; two-handed it leads Player 1", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1: "]] as const) {
      const t = framsburgTable(world, { seats, phase: "Encounter", campaign: true, staging: [CODES.framSShade] });
      const run = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, CODES.framSShade) }, t.ctx);
      expect(run.state.window).toMatchObject({ kind: "response" });
      const sheet = sheetOf(t, run.state);
      expect(sheet.note).toBe(`${lead}Fram's Shade engaged you. Look at 3 random undiscovered treasures and attach 1 to Fram's Shade as a guarded objective: Fram's Shade stays engaged with you, the players cannot claim the treasure until it is free of encounters, when Fram's Shade leaves play, and if they win with it they discover it. Group limit once per game. Pass and it stays unused for a later engagement at stage 1B or 2B.`);
      // Passing attaches nothing.
      const passed = send(run, { type: "Pass" }, t.ctx);
      expect(Object.values(passed.state.cards).filter((card) => world.cards.get(card.code)?.campaignKind === "treasure")).toEqual([]);
      // Using it asks which of the 3 treasures, the first player's.
      const asked = use(t, run).state;
      const pick = sheetOf(t, asked);
      expect(pick.note).toContain("Choose 1 of 3 random undiscovered treasures to attach as a guarded objective. Fram's Shade stays engaged; the players cannot claim the treasure until it is free of encounters, when Fram's Shade leaves play.");
      expect(labels(pick)).toHaveLength(3);
    }
  });

  it("says so when no undiscovered treasure is left to look at", () => {
    const t = framsburgTable(world, { phase: "Encounter", campaign: true, staging: [CODES.framSShade] });
    const all = [...(t.state.campaignFacts?.treasures ?? []), ...undiscoveredTreasures(t.state, t.ctx)];
    const spent = { ...t, state: { ...t.state, campaignFacts: { ...t.state.campaignFacts!, treasures: all } } };
    const run = send(start(spent.state), { type: "Engage", enemyId: idOf(spent.state, CODES.framSShade) }, spent.ctx);
    expect(run.state.window).toMatchObject({ kind: "response" });
    expect(sheetOf(spent, run.state).note).toBe("Fram's Shade engaged you. No undiscovered treasure is left to look at, so nothing can be attached to Fram's Shade.");
  });

  it("is not offered at stage 3, where the campaign card has no Response for it", () => {
    const t = framsburgTable(world, { phase: "Encounter", campaign: true, stage: "19111", staging: [CODES.framSShade] });
    const run = send(start(t.state), { type: "Engage", enemyId: idOf(t.state, CODES.framSShade) }, t.ctx);
    expect(run.state.window?.kind).not.toBe("response");
  });
});

describe("the Action that shuffles the encounter discard pile (12189:B:3)", () => {
  it("says every player raises their threat and how many cards are shuffled in; any player may use it", () => {
    for (const seats of [1, 2] as const) {
      const t = framsburgTable(world, { seats, phase: "Planning", campaign: true, discard: ["f0", "f3"] });
      const [option] = actions(t, t.state);
      expect(option?.text).toBe("Each player raises their threat by 1, then the encounter discard pile (2 cards) is shuffled into the encounter deck. Any player may use it.");
    }
  });

  it("warns which players it would eliminate: one of two reaches 50, or every player and the game is lost", () => {
    const base = framsburgTable(world, { seats: 2, phase: "Planning", campaign: true, discard: ["f0"] });
    const one = { ...base, state: withThreat(base.state, 1, 49) };
    expect(actions(one, one.state)[0]?.text).toContain("Player 2 would reach 50 threat and be eliminated.");
    const all = { ...one, state: withThreat(one.state, 0, 49) };
    expect(actions(all, all.state)[0]?.text).toContain("Every player would reach 50 threat and the game would be lost.");
    const solo = framsburgTable(world, { seats: 1, phase: "Planning", campaign: true, discard: ["f0"] });
    expect(actions(solo, solo.state)[0]?.text).not.toContain("would reach 50");
    // Solo, the one player is every player: the warning speaks to them.
    const edge = { ...solo, state: withThreat(solo.state, 0, 49) };
    expect(actions(edge, edge.state)[0]?.text).toContain("Your threat would reach 50 and the game would be lost.");
    expect(actions(edge, edge.state)[0]?.text).not.toContain("Every player");
  });

  it("arms the Use button when it eliminates a player or loses the game, and not otherwise", () => {
    const base = framsburgTable(world, { seats: 2, phase: "Planning", campaign: true, discard: ["f0"] });
    expect(actions(base, base.state)[0]?.caution).toBeUndefined();
    const one = { ...base, state: withThreat(base.state, 1, 49) };
    expect(actions(one, one.state)[0]?.caution).toBe("Tap again: Player 2 reaches 50 threat and is eliminated");
    const all = { ...one, state: withThreat(one.state, 0, 49) };
    expect(actions(all, all.state)[0]?.caution).toBe("Tap again: every player reaches 50 threat and the game is lost");
    const solo = framsburgTable(world, { seats: 1, phase: "Planning", campaign: true, discard: ["f0"] });
    const edge = { ...solo, state: withThreat(solo.state, 0, 49) };
    expect(actions(edge, edge.state)[0]?.caution).toBe("Tap again: you reach 50 threat and the game is lost");
  });

  it("the dock asks twice for the Action that loses the game: the first tap arms it, the second uses it", () => {
    const dock = (t: Table) => {
      const triggers = actions(t, t.state);
      const sheet = cardTriggerSheet(t.state, { ...names(t.state), facedown: (id: string) => id }, triggers, triggers[0]?.cardId ?? "");
      if (!sheet) throw new Error("no trigger sheet");
      const legal = legalIntents(t.state, t.ctx);
      return dockFor(sheet, { key: sheet.key, ids: [triggers[0]?.id ?? ""], shares: [] }, { game: t.state, ctx: t.ctx, legal, names: { ...names(t.state), facedown: (id: string) => id } }, { overlay: true, passLegal: false, surface: "table" });
    };
    const solo = framsburgTable(world, { seats: 1, phase: "Planning", campaign: true, discard: ["f0"] });
    const edge = { ...solo, state: withThreat(solo.state, 0, 49) };
    expect(dock(edge).primary).toMatchObject({ label: "Use", arm: true, armed: "Tap again: you reach 50 threat and the game is lost" });
    // Safe at lower threat: one tap uses it.
    expect(dock(solo).primary).toMatchObject({ label: "Use", arm: false });
  });

  it("is offered only with a card in the encounter discard pile", () => {
    const t = framsburgTable(world, { phase: "Planning", campaign: true });
    expect(actions(t, t.state)).toEqual([]);
  });
});

describe("Gundabad Hunter's choice of a player (12191:A:1)", () => {
  it("names the players engaged with a unique enemy and what happens to the one chosen; the first player chooses for the group", () => {
    const t = framsburgTable(world, { seats: 2, staging: [CODES.gundabadHunter], engaged: [{ code: CODES.framSShade, seat: 0 }, { code: CODES.framSShade, seat: 1 }] });
    const state = opened(t, t.state, CODES.gundabadHunter, "whenRevealed", idOf(t.state, CODES.gundabadHunter), "whenRevealed");
    expect(state.window).toMatchObject({ kind: "choose" });
    const sheet = sheetOf(t, state);
    expect(sheet.note).toBe("Gundabad Hunter: choose a player engaged with a unique enemy (Player 1 with Fram's Shade and Player 2 with Fram's Shade). Gundabad Hunter makes an immediate attack against that player from the staging area. Player 1 chooses.");
    expect(labels(sheet)).toEqual(["Player 1", "Player 2"]);
  });

  it("with only one player engaged with a unique enemy nobody is asked: that player is attacked; with none it attacks no one", () => {
    const t = framsburgTable(world, { seats: 2, staging: [CODES.gundabadHunter], engaged: [{ code: CODES.framSShade, seat: 1 }] });
    const attacked = opened(t, t.state, CODES.gundabadHunter, "whenRevealed", idOf(t.state, CODES.gundabadHunter), "whenRevealed");
    expect(attacked.window).toMatchObject({ kind: "defense", seat: 1 });
    const none = framsburgTable(world, { seats: 2, staging: [CODES.gundabadHunter] });
    const quiet = opened(none, none.state, CODES.gundabadHunter, "whenRevealed", idOf(none.state, CODES.gundabadHunter), "whenRevealed");
    expect(quiet.window?.kind).not.toBe("defense");
  });
});

describe("the optional engagement of a unique-only enemy (12192:A:1)", () => {
  it("says Gundabad Stalker may be engaged only by a player engaged with a unique enemy, and whether this player is one", () => {
    for (const [seats, title] of [[1, "Optional engagement"], [2, "Player 1: optional engagement"]] as const) {
      const without = framsburgTable(world, { seats, phase: "Encounter", staging: [CODES.gundabadStalker, CODES.cryptStalker] });
      const sheet = sheetOf(without, without.state);
      expect(sheet.title).toBe(title);
      expect(sheet.note).toContain("Gundabad Stalker may be engaged only by a player engaged with a unique enemy, and you are not engaged with one, so you cannot choose it here.");
      expect(labels(sheet)).toEqual(["Crypt Stalker"]);
      const engaged = framsburgTable(world, { seats, phase: "Encounter", staging: [CODES.gundabadStalker, CODES.cryptStalker], engaged: [CODES.framSShade] });
      const yes = sheetOf(engaged, engaged.state);
      expect(yes.note).toContain("Gundabad Stalker may be engaged only by a player engaged with a unique enemy, and you are engaged with Fram's Shade, so you may choose it.");
      expect(labels(yes)).toEqual(["Gundabad Stalker", "Crypt Stalker"]);
      expect(yes.kind === "pick" && yes.alternative && "label" in yes.alternative && yes.alternative.label).toBe("Do not engage");
    }
  });

  it("says nothing of it when no such enemy is in the staging area", () => {
    const t = framsburgTable(world, { phase: "Encounter", staging: [CODES.cryptStalker] });
    expect(sheetOf(t, t.state).note).not.toContain("unique");
  });
});

describe("Moonlit Passage's cap (19104:A:2)", () => {
  const galadriel = (seats: 1 | 2, staging: readonly string[]) => {
    const t = framsburgTable(world, { seats, phase: "Planning", staging, threat: [30, 30] });
    return { ...t, state: spawn(t.state, GALADRIEL, { zone: "heroes", seat: 0 }).state };
  };

  it("a player card that reduces threat says the cap while Moonlit Passage is in the staging area, and nothing otherwise", () => {
    for (const [seats, text] of [
      [1, "Moonlit Passage is in the staging area. Player card effects reduce your threat by 1 at most each round. You have not lowered it yet this round, so Galadriel reduces it by 1 at most."],
      // Galadriel lets her player choose whose threat goes down: each player's room is named.
      [2, "Player 1: Moonlit Passage is in the staging area. Player card effects reduce a player's threat by 1 at most each round. Player 1 has 1 left and Player 2 has 1 left this round."],
    ] as const) {
      const capped = galadriel(seats, [CODES.moonlitPassage]);
      const [option] = actions(capped, capped.state);
      expect(option?.text).toBe(text);
      const free = galadriel(seats, []);
      expect(actions(free, free.state)[0]?.text ?? null).toBeNull();
    }
  });

  it("two-handed it names each player's room after one player's reduction", () => {
    const t = galadriel(2, [CODES.moonlitPassage]);
    const used = { ...t, state: { ...t.state, playerThreatLoweredBy: { 0: 1 } } };
    expect(actions(used, used.state)[0]?.text).toBe("Player 1: Moonlit Passage is in the staging area. Player card effects reduce a player's threat by 1 at most each round. Player 1 has 0 left and Player 2 has 1 left this round.");
  });

  it("says the round's reduction is used once a player card effect has lowered the threat", () => {
    const t = galadriel(1, [CODES.moonlitPassage]);
    const used = { ...t, state: { ...t.state, playerThreatLoweredBy: { 0: 1 } } };
    expect(actions(used, used.state)[0]?.text).toContain("Your 1 for this round is used, so Galadriel reduces it by 0.");
  });
});

describe("Searching the Ruins' choice (19110:B:1)", () => {
  const stage2 = (seats: 1 | 2, threat: readonly [number, number] = [28, 28]) => {
    const t = framsburgTable(world, { seats, stage: "19110", phase: "Quest", threat });
    return { t, state: opened(t, t.state, "19110", "forced", t.state.questStage ?? "") };
  };

  it("is the first player's choice for the group: it names both threats, and the sheet adds who chooses", () => {
    const { t, state } = stage2(1);
    const sheet = sheetOf(t, state);
    expect(sheet.note).toBe("Searching the Ruins: raise each player's threat by 2 (now 28), or discard cards from the encounter deck until a location is discarded and add it to the staging area?");
    expect(labels(sheet)).toEqual(["Each player raises their threat by 2", "Discard cards until a location is discarded, then add it to the staging area"]);
    expect(cautions(sheet)).toEqual([undefined, undefined]);
    const pair = stage2(2, [28, 31]);
    expect(sheetOf(pair.t, pair.state).note).toBe("Searching the Ruins: raise each player's threat by 2 (now Player 1 28 and Player 2 31), or discard cards from the encounter deck until a location is discarded and add it to the staging area? Player 1 chooses.");
  });

  it("arms the raise when it eliminates a player or loses the game", () => {
    const solo = stage2(1, [48, 0]);
    expect(cautions(sheetOf(solo.t, solo.state))).toEqual(["Tap again: you reach 50 threat and the game is lost", undefined]);
    const some = stage2(2, [49, 40]);
    expect(cautions(sheetOf(some.t, some.state))[0]).toBe("Tap again: Player 1 reaches 50 threat and is eliminated");
    const all = stage2(2, [49, 48]);
    expect(cautions(sheetOf(all.t, all.state))[0]).toBe("Tap again: every player reaches 50 threat and the game is lost");
    // Declining the raise discards for a location instead and leaves the threat as it is.
    const taken = take(some.t, some.state, "location");
    expect(taken.state.seats[0]?.threat).toBe(49);
  });
});

describe("Crypt Stalker's Shadow (19099:A:3)", () => {
  const shadow = (seats: 1 | 2, seat: number, threat: readonly [number, number] = [28, 28]) => {
    const t = framsburgTable(world, { seats, threat });
    // The Werewolf is the attacker whose Shadow card is Crypt Stalker's; the Shadow names it as the enemy it returns.
    const attacker = spawn(t.state, CODES.werewolf, { zone: "engaged", seat });
    const spawned = spawn({ ...attacker.state, pendingAttack: { enemyId: attacker.id, seat } }, CODES.cryptStalker, { zone: "engaged", seat });
    return { t, state: opened(t, spawned.state, CODES.cryptStalker, "shadow", spawned.id, "forced", seat) };
  };

  it("asks the defending player to raise their threat or return the attacker to the staging area; two-handed it leads with the player and arms the raise that eliminates them", () => {
    const solo = shadow(1, 0);
    expect(solo.state.window).toMatchObject({ kind: "choose", seat: 0 });
    expect(sheetOf(solo.t, solo.state).note).toBe("Crypt Stalker: raise your threat by 2 (now 28), or return Werewolf to the staging area, which ends the attack?");
    const pair = shadow(2, 1, [28, 49]);
    expect(pair.state.window).toMatchObject({ kind: "choose", seat: 1 });
    const sheet = sheetOf(pair.t, pair.state);
    expect(sheet.note).toBe("Player 2, Crypt Stalker: raise your threat by 2 (now 49), or return Werewolf to the staging area, which ends the attack?");
    expect(cautions(sheet)).toEqual(["Tap again: Player 2 reaches 50 threat and is eliminated", undefined]);
    expect(labels(sheet)).toEqual(["Raise your threat by 2", "Return Werewolf to the staging area"]);
  });
});

describe("Slammed Shut (19108:A:2)", () => {
  it("each player in turn exhausts a ready character: two-handed the sentence leads with the player and the sheet adds no \"chooses\"", () => {
    for (const [seats, lead] of [[1, ""], [2, "Player 1, "]] as const) {
      const t = framsburgTable(world, { seats, staging: [CODES.slammedShut] });
      const state = opened(t, t.state, CODES.slammedShut, "whenRevealed", idOf(t.state, CODES.slammedShut), "whenRevealed");
      const sheet = sheetOf(t, state);
      expect(sheet.note).toBe(`${lead}Slammed Shut: choose a ready character you control to exhaust. It cannot be readied by player card effects this round.`);
    }
  });
});
