// Rules: dcce.island-map, dcce.exploration, dcce.uncharted, rr.travel, rr.step-6-4-2, rr.shadow-effects, rr.forced, rr.doomed-x, rr.search (data/rules/entries.json); ledger lines 12072:A:2, 12074:A:2, 12073:A:1,
// 12075:A:1, 12075:A:2, 12076:A:1, 12076:A:2, 12077:A:1, 12077:A:2, 12078:A:1, 12079:A:1, 12079:A:2, 12080:A:1, 12080:A:2, 12081:A:2, 11198:A:1 to 11199:A:3. The Temple of the Deceived encounter cards, the
// locations of the map and Starla and Recurring Nightmare on a table of plain-number heroes (test/scenarios/temple-of-the-deceived/scene.ts).
import { beforeAll, describe, expect, it } from "vitest";

import { syncConstants } from "../rules/interpret/constants.ts";
import { modifiedStat, placeDamage } from "../rules/core/keywords.ts";
import { ruleCause } from "../rules/core/cause.ts";
import { stagingThreat } from "../rules/quest/quest.ts";
import { settle } from "../rules/engine/machine.ts";
import { moveCard, shadowCards } from "../rules/core/zones.ts";
import type { ScenarioState } from "../rules/core/state.ts";
import type { Effect } from "../catalog/boundary.ts";
import { CODES, finish, idOf, idsOf, legalIntents, loadTempleWorld, resolveRecords, send, start, templeFight, templeTable, type TempleLayout, type TempleWorld } from "../../test/scenarios/temple-of-the-deceived/scene.ts";

let world: TempleWorld;

beforeAll(async () => {
  world = await loadTempleWorld();
});

// Row by row; index 6 is the active location unless a test says otherwise. The Temple column is the last.
const MAP = [
  "12072", "12073", "12074", "11072", "?12068",
  "?11073", "11074", "?12072", "?12073", "?12069",
  "?12074", "?11072", "?11073", "?11074", "?12069",
] as const;
const STOP = { engaged: [{ code: "mild", seat: 0 }] } as const;

const make = (layout: TempleLayout = {}) => templeTable(world, { map: MAP, at: 6, ...STOP, ...layout });
type Table = ReturnType<typeof make>;
const stat = (state: ScenarioState, id: string, which: "attack" | "defense" | "threat" | "willpower" | "engagementCost") => modifiedStat(state, state.cards[id]!, which, world.cards);
const withMap = (index: number, code: string): readonly string[] => MAP.map((entry, at) => (at === index ? code : entry));
const resolve = (made: Table, code: string, timing: "whenRevealed" | "forced", pick?: (state: ScenarioState) => string) => resolveRecords(made.state, made.ctx, code, timing, undefined, pick);

describe("Jagged Cliffs (12072:A:2)", () => {
  it("looks at the facedown side of each adjacent copy of Lost Island once flipped over while active, and not at a Temple of the Deceived location", () => {
    // Jagged Cliffs at row 1 column 3 (index 8), Lost Islands above (3: face up already), left (7) and below (13), and the Temple column to the right.
    // It is flipped by traveling to it: the active location is first another.
    const from = templeTable(world, { map: withMap(7, "11074").map((code, at) => (at === 8 ? "?12072" : code)), at: 7, phase: "Travel", ...STOP, cellProgress: [[7, 1]] });
    const points = world.cards.get("11074")?.questPoints ?? 0;
    const ready = { ...from.state, cards: { ...from.state.cards, [from.cells[7]!]: { ...from.state.cards[from.cells[7]!]!, progress: points } } };
    const run = send(start(ready), { type: "Travel", locationId: from.cells[8]! }, from.ctx);
    // The windows that follow show the facedown sides of the Lost Islands next to Jagged Cliffs, one after another: the one above (3), the one below (13); the Temple location to the right (9) and the one just left (7, now explored) are not.
    const seen: string[] = [];
    let current = run;
    for (let guard = 0; guard < 10 && current.state.window != null; guard += 1) {
      const window = current.state.window;
      if (window.kind === "look") {
        seen.push(...window.cardIds);
        current = send(current, { type: "Pass" }, from.ctx);
      } else if (window.kind === "choose") current = send(current, { type: "Choose", optionId: window.options[0] ?? "" }, from.ctx);
      else break;
    }
    expect(seen.sort()).toEqual([from.cells[13]].filter((id): id is string => id != null).sort());
  });
});

describe("Winding Caverns (12073:A:1)", () => {
  it("gives each enemy +10 engagement cost while it is the active location", () => {
    const made = make({ map: withMap(6, "12073"), staging: ["mild"] });
    const enemy = idOf(made.state, "mild");
    expect(stat(made.state, enemy, "engagementCost")).toBe(20);
    const away = make({ staging: ["mild"] });
    expect(stat(away.state, idOf(away.state, "mild"), "engagementCost")).toBe(10);
  });
});

describe("Jungle Path (12074:A:2)", () => {
  it("makes each player exhaust a character with at least 2 Attack once flipped over while active", () => {
    // Heroes have 2 Attack; Temple Halls is not active, so there is no -1.
    const made = templeTable(world, { map: withMap(7, "?12074"), at: 6, phase: "Travel", ...STOP, seats: 2 });
    const points = world.cards.get("11074")?.questPoints ?? 0;
    const ready = { ...made.state, cards: { ...made.state.cards, [made.cells[6]!]: { ...made.state.cards[made.cells[6]!]!, progress: points } } };
    const run = finish(send(start(ready), { type: "Travel", locationId: made.cells[7]! }, made.ctx), made.ctx);
    // One hero of each seat is exhausted.
    const exhausted = [made.hero, made.hero2, made.seat1Hero ?? ""].filter((id) => run.state.cards[id]?.exhausted);
    expect(exhausted).toHaveLength(2);
    expect(run.state.cards[made.seat1Hero ?? ""]?.exhausted).toBe(true);
  });
});

describe("Faithless Desecrator (12075:A:1, 12075:A:2)", () => {
  it("contributes its Threat to the staging area while it is engaged with a player", () => {
    const staged = make({ staging: [CODES.desecrator] });
    const engaged = make({ engaged: [{ code: CODES.desecrator, seat: 0 }, { code: "mild", seat: 0 }] });
    const bare = make();
    expect(stagingThreat(engaged.state, engaged.ctx.cards) - stagingThreat(bare.state, bare.ctx.cards)).toBe(2);
    expect(stagingThreat(staged.state, staged.ctx.cards) - stagingThreat(bare.state, bare.ctx.cards)).toBe(2);
  });

  it("gives the attacking enemy +1 Attack, and +2 when the active location is a Ruins location (Shadow)", () => {
    const ruins = templeFight(world, CODES.desecrator, "mild", { map: MAP, at: 12 });
    const plain = templeFight(world, CODES.desecrator, "mild", { map: MAP, at: 0 });
    // Row 2 column 2 is Drowned Graves (Ruins, face down: a Lost Island); row 0 column 0 is Jagged Cliffs (Mountain).
    expect(stat(plain.during, idOf(plain.during, "mild"), "attack")).toBe(3 + 1);
    expect(stat(ruins.during, idOf(ruins.during, "mild"), "attack")).toBeGreaterThanOrEqual(3 + 1);
  });

  it("is +2 with a Ruins location active that is faceup", () => {
    const fight = templeFight(world, CODES.desecrator, "mild", { map: withMap(6, "11074"), at: 6 });
    // Cursed Temple has the Ruins trait.
    expect(stat(fight.during, idOf(fight.during, "mild"), "attack")).toBe(3 + 2);
  });
});

describe("Island Watcher (12076:A:1, 12076:A:2)", () => {
  it("cannot be optionally engaged", () => {
    const made = make({ staging: [CODES.watcher] });
    expect(made.state.modifiers.some((modifier) => modifier.stat === "cannotBeOptionallyEngaged" && modifier.instanceId === idOf(made.state, CODES.watcher))).toBe(true);
  });

  it("engages the player with the highest threat at the beginning of the encounter phase, if the active location is a Ruins location, and is dealt 2 shadow cards", () => {
    const made = templeTable(world, { map: MAP, at: 6, seats: 2, phase: "Quest", staging: [CODES.watcher], threat: [30, 38], deck: ["f0", "f0", "f0", "f0", "f0"] });
    const watcher = idOf(made.state, CODES.watcher);
    // Cursed Temple is a Ruins location: the effect fires as the encounter phase begins.
    const run = resolveRecords({ ...made.state, phase: "Encounter", mode: "optionalEngage", window: null }, made.ctx, CODES.watcher, "forced", watcher);
    expect(run.state.cards[watcher]).toMatchObject({ zone: "engaged", controller: 1 });
    expect(shadowCards(run.state.cards[watcher])).toHaveLength(2);
  });

  it("stays in the staging area when the active location is no Ruins location", () => {
    const made = templeTable(world, { map: withMap(6, "12073"), at: 6, seats: 2, phase: "Encounter", staging: [CODES.watcher], threat: [30, 38] });
    const watcher = idOf(made.state, CODES.watcher);
    const run = resolveRecords({ ...made.state, window: null }, made.ctx, CODES.watcher, "forced", watcher);
    expect(run.state.cards[watcher]?.zone).toBe("staging");
  });
});

describe("Profane Dead (12077:A:1, 12077:A:2)", () => {
  it("makes an immediate attack against the player it is engaged with when the players travel to the right", () => {
    const points = world.cards.get("11074")?.questPoints ?? 0;
    const made = templeTable(world, { map: MAP, at: 6, phase: "Travel", engaged: [{ code: CODES.profane, seat: 0 }], cellProgress: [[6, points]], hand: ["filler"] });
    const profane = idOf(made.state, CODES.profane);
    // Row 1 column 2 lies to the right of row 1 column 1.
    const right = finish(send(start(made.state), { type: "Travel", locationId: made.cells[7]! }, made.ctx), made.ctx);
    const attacked = right.steps.some((step) => step.kind === "attack" && step.enemyId === profane);
    expect(attacked).toBe(true);
    // To the left it does not attack.
    const left = finish(send(start(made.state), { type: "Travel", locationId: made.cells[5]! }, made.ctx), made.ctx);
    expect(left.steps.some((step) => step.kind === "attack" && step.enemyId === profane)).toBe(false);
  });

  it("gives the attacking enemy +3 Attack if the players control the Gate Key (Shadow)", () => {
    const with_ = templeFight(world, CODES.profane, "mild", { map: MAP, at: 6, key: "hero" });
    const without = templeFight(world, CODES.profane, "mild", { map: MAP, at: 6 });
    expect(stat(with_.during, idOf(with_.during, "mild"), "attack")).toBe(3 + 3);
    expect(stat(without.during, idOf(without.during, "mild"), "attack")).toBe(3);
  });

  it("does not count a Gate Key that lies in the staging area (nobody controls it) or stays guarded", () => {
    for (const key of ["free", "guard"] as const) {
      const fight = templeFight(world, CODES.profane, "mild", { map: MAP, at: 6, key });
      expect(stat(fight.during, idOf(fight.during, "mild"), "attack"), key).toBe(3);
    }
  });
});

describe("Deeper into the Ruins (12078:A:1)", () => {
  it("adds the total Threat of the locations to the left of the active location, in its row, to the staging area until the end of the phase", () => {
    // Row 1: a Lost Island (index 5, Threat 2) lies left of Cursed Temple (index 6).
    const made = make({ phase: "Quest" });
    const before = stagingThreat(made.state, world.cards);
    const run = resolve(made, CODES.deeper, "whenRevealed");
    expect(stagingThreat(syncConstants(run.state, made.ctx), world.cards) - before).toBe(2);
    // With nothing to its left it gains Doomed 1: the player raises their threat by 1.
    const edge = make({ at: 5, phase: "Quest" });
    const threat = edge.state.seats[0].threat;
    const next = resolve(edge, CODES.deeper, "whenRevealed");
    expect(next.state.seats[0].threat).toBe(threat + 1);
    expect(stagingThreat(next.state, world.cards)).toBe(stagingThreat(edge.state, world.cards));
  });
});

describe("Furious Rainstorm (12079:A:1, 12079:A:2)", () => {
  it("makes each player choose to raise their threat by the number of their committed characters, or deal 1 damage to each of them", () => {
    const made = make({ phase: "Quest", play: ["ally"] });
    const committed = { ...made.state, cards: Object.fromEntries(Object.entries(made.state.cards).map(([id, card]) => [id, [made.hero, made.hero2].includes(id) ? { ...card, committed: true } : card])) };
    const threat = resolveRecords(committed, made.ctx, CODES.rainstorm, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? "threat" : ""));
    expect(threat.state.seats[0].threat).toBe(28 + 2);
    const damage = resolveRecords(committed, made.ctx, CODES.rainstorm, "whenRevealed", undefined, (state) => (state.window?.kind === "choose" ? "damage" : ""));
    expect([made.hero, made.hero2].map((id) => damage.state.cards[id]?.damage)).toEqual([1, 1]);
    expect(damage.state.seats[0].threat).toBe(28);
    expect(idsOf(damage.state, "ally").map((id) => damage.state.cards[id]?.damage)).toEqual([0]);
  });

  it("offers nothing when no character is committed", () => {
    const made = make({ phase: "Quest" });
    const run = resolve(made, CODES.rainstorm, "whenRevealed");
    expect(run.state.seats[0].threat).toBe(28);
    expect(run.state.window).toBeNull();
  });

  it("raises the defending player's threat by the attacking enemy's Threat if the attack destroys a character (Shadow)", () => {
    const fatal = templeFight(world, CODES.rainstorm, "mild", {}, { undefended: true, tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: 5 } } }) });
    expect(fatal.run.state.seats[0].threat).toBe(28 + 1);
    const safe = templeFight(world, CODES.rainstorm, "mild", {}, { undefended: true });
    expect(safe.run.state.seats[0].threat).toBe(28);
  });

  it("reads the attacking enemy's current Threat, so Temple Guardian's Threat X (one for each player) counts", () => {
    for (const seats of [1, 2] as const) {
      for (const guardian of [CODES.guardianOriginal, CODES.guardian]) {
        const fatal = templeFight(world, CODES.rainstorm, guardian, { seats }, { undefended: true, tweak: (state, made) => ({ ...state, cards: { ...state.cards, [made.hero]: { ...state.cards[made.hero]!, damage: 5 } } }) });
        expect(fatal.run.state.seats[0].threat, `${guardian} with ${seats} players`).toBe(28 + seats);
      }
    }
  });
});

describe("Dwindling Supplies (12080:A:1, 12080:A:2)", () => {
  it("makes each player randomly discard cards from their hand until they hold 3", () => {
    const made = make({ phase: "Quest", hand: ["c0", "c1", "c2", "c3", "event", "filler"] });
    const run = resolve(made, CODES.dwindling, "whenRevealed");
    expect(run.state.seats[0].hand).toHaveLength(3);
    expect(run.state.seats[0].discard).toHaveLength(3);
    // They discarded, so Dwindling Supplies does not gain Doomed 2: the threat is unchanged.
    expect(run.state.seats[0].threat).toBe(28);
  });

  it("gains Doomed 2 when no player had to discard", () => {
    const made = make({ phase: "Quest", hand: ["c0", "c1", "c2"] });
    const run = resolve(made, CODES.dwindling, "whenRevealed");
    expect(run.state.seats[0].hand).toHaveLength(3);
    expect(run.state.seats[0].threat).toBe(30);
  });

  it("is two players: one with a full hand discards, so no Doomed", () => {
    const made = make({ phase: "Quest", seats: 2, hand: ["c0", "c1", "c2", "c3"] });
    const run = resolve(made, CODES.dwindling, "whenRevealed");
    expect(run.state.seats[0].threat).toBe(28);
  });

  it("gives the defending character -2 Defense for this attack (Shadow)", () => {
    const fight = templeFight(world, CODES.dwindling, "mild");
    expect(stat(fight.during, fight.made.hero, "defense")).toBe(2 - 2);
  });
});

describe("Sunken Ruins (12081:A:2)", () => {
  it("gives each Uncharted location in the staging area +1 Threat until the end of the phase, and with a Ruins location active discards 1 resource from each hero and objective ally", () => {
    const made = make({ phase: "Quest", allies: true });
    const hero = made.hero;
    const heroes = { ...made.state, cards: { ...made.state.cards, [hero]: { ...made.state.cards[hero]!, resources: 2 } } };
    const sahir = idOf(heroes, CODES.sahirAlly);
    const tokens = { ...heroes, cards: { ...heroes.cards, [sahir]: { ...heroes.cards[sahir]!, resources: 3 } } };
    const before = stagingThreat(tokens, world.cards);
    const run = resolveRecords(tokens, made.ctx, CODES.sunken, "whenRevealed");
    // Row 1 column 1 is Cursed Temple (a Ruins location): resources go.
    expect(run.state.cards[hero]?.resources).toBe(1);
    expect(run.state.cards[sahir]?.resources).toBe(2);
    // The Lost Islands next to it (index 5, 7, 11) lie Uncharted side up: +1 each.
    const lost = [5, 7, 11].filter((at) => run.state.cards[made.cells[at] ?? ""]?.face === "B").length;
    expect(stagingThreat(syncConstants(run.state, made.ctx), world.cards) - before).toBe(lost);
  });

  it("takes no resources with no Ruins location active", () => {
    const made = make({ phase: "Quest", map: withMap(6, "12073") });
    const hero = made.hero;
    const heroes = { ...made.state, cards: { ...made.state.cards, [hero]: { ...made.state.cards[hero]!, resources: 2 } } };
    const run = resolveRecords(heroes, made.ctx, CODES.sunken, "whenRevealed");
    expect(run.state.cards[hero]?.resources).toBe(2);
  });
});

describe("Starla (11198:A:1 to 11198:A:3)", () => {
  it("has Willpower, Attack and Defense X, half her level rounded up", () => {
    const made = make({ play: [CODES.starla] });
    const starla = idOf(made.state, CODES.starla);
    expect(["willpower", "attack", "defense"].map((which) => stat(made.state, starla, which as "attack"))).toEqual([0, 0, 0]);
    for (const [level, expected] of [[1, 1], [2, 1], [3, 2]] as const) {
      const leveled = syncConstants({ ...made.state, campaignFacts: { prisoner: null, usedOnce: [], counters: {}, levels: { [CODES.starla]: level } } }, made.ctx);
      expect(["willpower", "attack", "defense"].map((which) => stat(leveled, starla, which as "attack")), `level ${level}`).toEqual([expected, expected, expected]);
    }
  });

  it("is played when she is discarded from a hand or from a deck (A:2)", () => {
    for (const [trigger, effectId] of [["discardedFromHand", "11198:response:1"], ["discardedFromDeck", "11198:response:2"]] as const) {
      const made = make({ phase: "Planning", discard: [], hand: ["filler"] });
      const spawned = idOf(made.state, "filler");
      void spawned;
      const table = templeTable(world, { map: MAP, at: 6, ...STOP, phase: "Quest" });
      const card = idOf(table.state, "mild");
      void card;
      // Starla is in her owner's discard pile, just discarded from the hand or the deck.
      const base = make({ phase: "Planning" });
      const placed = { ...base.state, cards: { ...base.state.cards, starla: { ...base.state.cards[base.hero]!, id: "starla", code: CODES.starla, zone: "discard" as const, controller: 0, host: null, attachments: [] } } };
      const state = { ...placed, seats: [{ ...placed.seats[0], discard: ["starla"] }, placed.seats[1]] as typeof placed.seats, pendingEvents: [{ trigger, seat: 0, cardId: "starla" }] };
      const offered = settle(state, base.ctx, []);
      expect(legalIntents(offered, base.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === effectId), trigger).toBe(true);
      const run = finish(send(start(offered), { type: "Trigger", cardId: "starla", effectId }, base.ctx), base.ctx);
      expect(run.state.cards.starla?.zone, trigger).toBe("play");
      expect(run.state.cards.starla?.controller, trigger).toBe(0);
    }
  });

  it("places 1 progress on a location after she exhausts (A:3)", () => {
    const made = make({ phase: "Quest", play: [CODES.starla] });
    const starla = idOf(made.state, CODES.starla);
    const offered = settle({ ...made.state, window: null, mode: "stopped", pendingEvents: [{ trigger: "exhausted", seat: 0, cardId: starla }] }, made.ctx, []);
    expect(legalIntents(offered, made.ctx).some((intent) => intent.type === "Trigger" && intent.effectId === "11198:response:3")).toBe(true);
    // Any location in play may take it: a Lost Island in the staging area, or one outside the staging area on the map.
    const far = made.cells[13] ?? "";
    const run = finish(send(start(offered), { type: "Trigger", cardId: starla, effectId: "11198:response:3" }, made.ctx), made.ctx, (state) => (state.window?.kind === "choose" ? (state.window.options.includes(far) ? far : (state.window.options[0] ?? "")) : ""));
    expect(run.state.cards[far]?.progress).toBe(1);
  });
});

describe("Recurring Nightmare (11199:A:1 to 11199:A:3)", () => {
  it("has Defense X, the number of players", () => {
    for (const seats of [1, 2] as const) {
      const made = make({ seats, engaged: [{ code: CODES.nightmare, seat: 0 }, { code: "mild", seat: 0 }] });
      expect(stat(made.state, idOf(made.state, CODES.nightmare), "defense")).toBe(seats);
    }
  });

  it("is shuffled into a player's deck when it leaves play, the first player choosing whose with more than one", () => {
    const solo = make({ phase: "Combat", engaged: [{ code: CODES.nightmare, seat: 0 }, { code: "mild", seat: 0 }], deckOf: ["c0", "c1"] });
    const nightmare = idOf(solo.state, CODES.nightmare);
    const watchedSolo = settle({ ...solo.state, window: null, mode: "stopped" }, solo.ctx, []);
    const gone = finish({ state: settle(placeDamage(watchedSolo, nightmare, 99, world.cards, [], "framework", ruleCause("test")), solo.ctx, []), steps: [] }, solo.ctx);
    expect(gone.state.cards[nightmare]).toMatchObject({ zone: "deck", controller: 0 });
    expect(gone.state.seats[0].deck).toContain(nightmare);
    const duo = make({ seats: 2, phase: "Combat", engaged: [{ code: CODES.nightmare, seat: 0 }, { code: "mild", seat: 0 }], deckOf: ["c0", "c1"] });
    const second = idOf(duo.state, CODES.nightmare);
    const watchedDuo = settle({ ...duo.state, window: null, mode: "stopped" }, duo.ctx, []);
    const asked = settle(placeDamage(watchedDuo, second, 99, world.cards, [], "framework", ruleCause("test")), duo.ctx, []);
    expect(asked.window).toMatchObject({ kind: "choose", options: ["seat:0", "seat:1"] });
    const done = finish({ state: asked, steps: [] }, duo.ctx, () => "seat:1");
    expect(done.state.cards[second]).toMatchObject({ zone: "deck", controller: 1 });
  });

  it("is shuffled into a player's deck on every way out of play: discarded, shuffled into the encounter deck, returned to a hand, removed", () => {
    for (const zone of ["encounterDiscard", "encounterDeck", "hand", "removed"] as const) {
      const made = make({ phase: "Combat", staging: [CODES.nightmare], deckOf: ["c0", "c1"] });
      const nightmare = idOf(made.state, CODES.nightmare);
      // The game settles after every intent: the Nightmare in play is watched before it leaves.
      const watched = settle({ ...made.state, window: null, mode: "stopped" }, made.ctx, []);
      const settled = settle(moveCard(watched, nightmare, zone === "hand" ? { zone, seat: 0 } : { zone }), made.ctx, []);
      expect(finish({ state: settled, steps: [] }, made.ctx).state.cards[nightmare], zone).toMatchObject({ zone: "deck", controller: 0 });
    }
  });

  it("is shuffled into a player's deck when an effect shuffles it into the encounter deck, as Put Off Pursuit does (21008:response:1)", () => {
    const made = make({ phase: "Travel", engaged: [], staging: [CODES.nightmare], deckOf: ["c0", "c1"] });
    const nightmare = idOf(made.state, CODES.nightmare);
    const pursuit: Effect = {
      id: "filler:forced:9",
      cardCode: "filler",
      lines: ["filler:A:9"],
      timing: "forced",
      instructions: [
        { verb: "Pick", pick: { type: "enemy", control: "any", stagingOnly: true, nonUnique: true } },
        { verb: "MoveEncounterCard", to: "shuffle", when: { kind: "matches", card: "picked", pick: { type: "enemy", control: "any" }, inPlay: true } },
      ],
    };
    const ctx = { ...made.ctx, effects: [...made.ctx.effects, pursuit] };
    const watched = settle({ ...made.state, window: null, mode: "stopped" }, ctx, []);
    const run = resolveRecords(watched, ctx, "filler", "forced");
    expect(run.state.cards[nightmare]).toMatchObject({ zone: "deck", controller: 0 });
    expect(run.state.encounterDeck).not.toContain(nightmare);
  });

  it("is added to the staging area when a draw puts it into a hand, in a real resource phase draw through reduce", () => {
    const made = make({ phase: "Refresh", deckOf: [CODES.nightmare, "c1"] });
    const nightmare = idOf(made.state, CODES.nightmare);
    expect(made.state.seats[0].deck[0]).toBe(nightmare);
    // The Refresh phase has no intent to give: the machine (the settle every reduce ends with) carries the round into the resource phase, whose draw step draws the Nightmare.
    const drawn = finish({ state: settle(made.state, made.ctx, []), steps: [] }, made.ctx);
    expect(drawn.state.cards[nightmare]?.zone).toBe("staging");
    expect(drawn.state.seats[0].hand).not.toContain(nightmare);
  });
});

export type { Table };
